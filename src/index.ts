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
import { PredictionTracker } from './predictions/prediction-tracker';
import { RecommendationService } from './predictions/recommendation-service';
import { PredictionType } from './types/predictions';

// Market tools
const MARKET_TOOLS = [
  {
    name: 'get_price',
    description: 'Get current futures price for a trading symbol',
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
    description: 'Get 24h futures statistics for a symbol',
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
    description: 'Get best bid/ask prices and quantities for futures',
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
    description: 'Get historical futures candlestick data',
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

// Prediction tools
const PREDICTION_TOOLS = [
  {
    name: 'create_prediction',
    description: 'Create a new price prediction',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string' },
        type: {
          type: 'string',
          enum: [PredictionType.PRICE_TARGET, PredictionType.TREND_DIRECTION, PredictionType.SUPPORT_RESISTANCE]
        },
        validityPeriod: { type: 'number' },
        metadata: {
          type: 'object',
          properties: {
            targetPrice: { type: 'string' },
            direction: { type: 'string', enum: ['UP', 'DOWN', 'SIDEWAYS'] },
            supportLevel: { type: 'string' },
            resistanceLevel: { type: 'string' },
            timeframe: { type: 'string' }
          }
        },
        context: { type: 'string' }
      },
      required: ['symbol', 'type', 'validityPeriod', 'metadata']
    }
  },
  {
    name: 'evaluate_prediction',
    description: 'Evaluate a prediction result',
    inputSchema: {
      type: 'object',
      properties: {
        predictionId: { type: 'string' }
      },
      required: ['predictionId']
    }
  },
  {
    name: 'get_prediction_stats',
    description: 'Get prediction statistics for a symbol',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string' }
      },
      required: ['symbol']
    }
  },
  {
    name: 'get_recommendation',
    description: 'Get trading recommendation based on prediction history',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string' }
      },
      required: ['symbol']
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
  private predictionTracker?: PredictionTracker;
  private recommendationService?: RecommendationService;
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
        httpFutures: 'https://fapi.binance.com',
        wsFutures: 'wss://fstream.binance.com'
      }) as unknown as BinanceClient;

      this.market = createMarketOperations(this.client);
      this.predictionTracker = new PredictionTracker(this.client);
      this.recommendationService = new RecommendationService(this.client, this.predictionTracker);
      this.isConfigured = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize client:', error);
      return false;
    }
  }

  private getAvailableTools(): any[] {
    if (this.isConfigured) {
      return [...CONFIG_TOOLS, ...MARKET_TOOLS, ...PREDICTION_TOOLS];
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

        // Ensure server is configured for operations
        if (!this.isConfigured || !this.client || !this.market || !this.predictionTracker || !this.recommendationService) {
          throw new Error('Server must be configured before using operations');
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

          // Handle prediction tools
          case 'create_prediction':
            if (!args?.symbol || typeof args.symbol !== 'string' ||
              !args?.type || typeof args.type !== 'string' ||
              !args?.validityPeriod || typeof args.validityPeriod !== 'number' ||
              !args?.metadata || typeof args.metadata !== 'object' ||
              !Object.keys(args.metadata).length) {
              throw new Error('Required prediction parameters missing');
            }

            // Get current price for the prediction
            const currentPrice = await this.market.getPrice(args.symbol);

            // Type the metadata object
            const metadata = args.metadata as {
              targetPrice?: string;
              direction?: 'UP' | 'DOWN' | 'SIDEWAYS';
              supportLevel?: string;
              resistanceLevel?: string;
              timeframe?: string;
              expectedPercentage?: string;
            };

            // Construct proper metadata structure
            const predictionMetadata = {
              currentPrice,
              predictionDetails: {
                targetPrice: metadata.targetPrice,
                direction: metadata.direction,
                supportLevel: metadata.supportLevel,
                resistanceLevel: metadata.resistanceLevel,
                timeframe: metadata.timeframe,
                expectedPercentage: metadata.expectedPercentage
              }
            };

            const prediction = await this.predictionTracker.createPrediction(
              args.symbol,
              args.type as PredictionType,
              args.validityPeriod,
              predictionMetadata,
              typeof args.context === 'string' ? args.context : undefined
            );
            return {
              content: [{ type: 'text', text: JSON.stringify(prediction, null, 2) }],
            };

          case 'evaluate_prediction':
            if (!args?.predictionId || typeof args.predictionId !== 'string') throw new Error('Prediction ID is required');
            const result = await this.predictionTracker.evaluatePrediction(args.predictionId);
            return {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            };

          case 'get_prediction_stats':
            if (!args?.symbol || typeof args.symbol !== 'string') throw new Error('Symbol is required');
            const predictionStats = this.predictionTracker.getSymbolStats(args.symbol);
            return {
              content: [{ type: 'text', text: JSON.stringify(predictionStats, null, 2) }],
            };

          case 'get_recommendation':
            if (!args?.symbol || typeof args.symbol !== 'string') throw new Error('Symbol is required');
            const recommendation = await this.recommendationService.generateRecommendation(args.symbol);
            return {
              content: [{ type: 'text', text: JSON.stringify(recommendation, null, 2) }],
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
