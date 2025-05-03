import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { BinanceClient } from './core/binance-types';
import { createMarketOperations } from './operations/market';
import { MarketDataError } from './common/errors';
import Binance from 'binance-api-node';

// Market tools
const MARKET_TOOLS = [
  {
    name: 'get_price',
    description: 'Get current price for a symbol',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string' }
      },
      required: ['symbol']
    }
  },
  {
    name: 'get_daily_stats',
    description: 'Get 24h price statistics for a symbol',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string' }
      },
      required: ['symbol']
    }
  },
  {
    name: 'get_book_ticker',
    description: 'Get current best price/qty on the order book',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string' }
      },
      required: ['symbol']
    }
  },
  {
    name: 'get_candles',
    description: 'Get candlestick data for a symbol',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string' },
        interval: {
          type: 'string',
          enum: ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M']
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 1000
        }
      },
      required: ['symbol', 'interval']
    }
  }
];

// Configuration tools
const CONFIG_TOOLS = [
  {
    name: 'set_configuration',
    description: 'Set Binance MCP configuration',
    inputSchema: {
      type: 'object',
      properties: {
        binance: {
          type: 'object',
          properties: {
            apiKey: { type: 'string' },
            apiSecret: { type: 'string' }
          },
          required: ['apiKey', 'apiSecret']
        }
      },
      required: ['binance']
    }
  },
  {
    name: 'get_configuration_status',
    description: 'Check if Binance MCP is configured',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

class BinanceMCPServer {
  private server: Server;
  private client?: BinanceClient;
  private market?: ReturnType<typeof createMarketOperations>;
  private isConfigured: boolean = false;

  constructor() {
    this.server = new Server(
      {
        name: 'binance-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
  }

  private initializeClient(config: any): boolean {
    try {
      const { binance: binanceConfig } = config;
      this.client = Binance({
        apiKey: binanceConfig.apiKey,
        apiSecret: binanceConfig.apiSecret,
      }) as unknown as BinanceClient;

      this.market = createMarketOperations(this.client);
      this.isConfigured = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize client:', error);
      return false;
    }
  }

  private getAvailableTools(): any[] {
    if (this.isConfigured) {
      return [...CONFIG_TOOLS, ...MARKET_TOOLS];
    }
    return CONFIG_TOOLS;
  }

  async start(): Promise<void> {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getAvailableTools(),
      version: '1.0.0'
    }));

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        // Handle configuration tools
        if (name === 'set_configuration') {
          const success = this.initializeClient(args);
          return {
            content: [{
              type: 'text',
              text: success ? 'Configuration set successfully' : 'Failed to set configuration'
            }],
            isError: !success
          };
        }

        if (name === 'get_configuration_status') {
          return {
            content: [{
              type: 'text',
              text: `Server is ${this.isConfigured ? 'configured' : 'not configured'}`
            }]
          };
        }

        // Ensure server is configured for market operations
        if (!this.isConfigured || !this.client || !this.market) {
          throw new Error('Server must be configured before using market operations');
        }

        // Handle market tools
        switch (name) {
          case 'get_price':
            if (!args?.symbol || typeof args.symbol !== 'string') throw new Error('Symbol is required');
            const price = await this.market.getPrice(args.symbol);
            return {
              content: [{ type: 'text', text: `Current price for ${args.symbol}: ${price}` }],
            };

          case 'get_daily_stats':
            if (!args?.symbol || typeof args.symbol !== 'string') throw new Error('Symbol is required');
            const stats = await this.market.getDailyStats(args.symbol);
            return {
              content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }],
            };

          case 'get_book_ticker':
            if (!args?.symbol || typeof args.symbol !== 'string') throw new Error('Symbol is required');
            const ticker = await this.market.getBookTicker(args.symbol);
            return {
              content: [{ type: 'text', text: JSON.stringify(ticker, null, 2) }],
            };

          case 'get_candles':
            if (!args?.symbol || !args?.interval || typeof args.symbol !== 'string' || typeof args.interval !== 'string') {
              throw new Error('Symbol and interval are required');
            }
            const candles = await this.market.getCandles({
              symbol: args.symbol,
              interval: args.interval,
              limit: typeof args.limit === 'number' ? args.limit : undefined
            });
            return {
              content: [{ type: 'text', text: JSON.stringify(candles, null, 2) }],
            };

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        console.error('Error executing tool:', error);

        let errorMessage = 'An unknown error occurred';
        if (error instanceof MarketDataError) {
          errorMessage = error.message;
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }

        return {
          content: [{ type: 'text', text: errorMessage }],
          isError: true,
        };
      }
    });

    // Set up cleanup on shutdown
    process.on('SIGINT', () => {
      console.info('Shutting down...');
      process.exit(0);
    });

    // Start the server
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Binance MCP Server running on stdio');
  }
}

// Create and start the server
async function main(): Promise<void> {
  const server = new BinanceMCPServer();
  await server.start();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
