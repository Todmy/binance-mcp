import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  CreateTradeToolSchema,
  ScanMarketToolSchema,
  GetOpportunitiesToolSchema,
  GetTradeSuggestionsToolSchema,
  ApproveSuggestionToolSchema,
  RejectSuggestionToolSchema,
  ClosePositionToolSchema,
  EnableTradingToolSchema
} from './common/validation';
import { VSCodeSettingsManager } from './config/vscode-settings';
import { TradingEngine } from './core/trading-engine';
import { MarketScanner } from './analysis/market-scanner';
import { OpportunityScorer } from './analysis/opportunity-scorer';
import { ManualTrader } from './trading/manual-trader';
import { BinanceError, TradingError, MarketDataError } from './common/errors';
import { createTradingOperations } from './operations/trading';
import { createMarketOperations } from './operations/market';
import { ALL_TOOLS } from './tools/definitions';
import Binance from 'binance-api-node';
import { BinanceClient } from './core/binance-types';

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
        },
        risk: {
          type: 'object',
          properties: {
            maxPositionSize: { type: 'number' },
            maxLeverage: { type: 'number' },
            stopLossPercentage: { type: 'number' },
            dailyLossLimit: { type: 'number' },
            priceDeviationLimit: { type: 'number' }
          },
          required: ['maxPositionSize', 'maxLeverage', 'stopLossPercentage', 'dailyLossLimit', 'priceDeviationLimit']
        },
        strategy: {
          type: 'object',
          properties: {
            riskLevel: { type: 'string', enum: ['conservative', 'moderate', 'aggressive'] },
            timeframe: { type: 'string', enum: ['1m', '5m', '15m', '1h', '4h', '1d'] }
          },
          required: ['riskLevel', 'timeframe']
        }
      },
      required: ['binance', 'risk', 'strategy']
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
  private engine?: TradingEngine;
  private trading?: ReturnType<typeof createTradingOperations>;
  private market?: ReturnType<typeof createMarketOperations>;
  private scanner?: MarketScanner;
  private scorer?: OpportunityScorer;
  private manualTrader?: ManualTrader;
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

  private async initializeTrading(config: any): Promise<boolean> {
    try {
      VSCodeSettingsManager.validateConfig(config);

      const { binance: binanceConfig, risk: riskConfig } = config;
      const client = Binance({
        apiKey: binanceConfig.apiKey,
        apiSecret: binanceConfig.apiSecret,
        httpFutures: 'https://fapi.binance.com',
        wsFutures: 'wss://fstream.binance.com',
        httpBase: binanceConfig.testnet ? 'https://testnet.binance.vision' : 'https://api.binance.com'
      }) as unknown as BinanceClient;
      this.engine = new TradingEngine(binanceConfig, riskConfig);
      this.trading = createTradingOperations(this.engine);
      this.market = createMarketOperations(this.engine);

      // Initialize scanner and scorer
      this.scanner = new MarketScanner(binanceConfig.testnet, client);
      this.scorer = new OpportunityScorer();

      // Initialize manual trader with all components
      this.manualTrader = new ManualTrader(
        this.engine,
        this.scanner,
        this.scorer
      );

      // Save configuration to VSCode settings
      await VSCodeSettingsManager.saveConfig(config);

      this.isConfigured = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize trading:', error);
      return false;
    }
  }

  private getAvailableTools(): any[] {
    if (this.isConfigured) {
      return [...CONFIG_TOOLS, ...ALL_TOOLS];
    }
    return CONFIG_TOOLS;
  }

  async start(): Promise<void> {
    // Try to load existing configuration
    try {
      const config = VSCodeSettingsManager.getBinanceConfig();
      await this.initializeTrading(config);
    } catch (error) {
      console.error('No existing configuration found, starting in unconfigured state');
    }

    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getAvailableTools(),
      version: '1.0.0'
    }));

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args = {} } = request.params;

        // Handle configuration tools
        if (name === 'set_configuration') {
          const success = await this.initializeTrading(args);
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

        // Ensure server is configured for trading operations
        if (!this.isConfigured || !this.engine || !this.trading || !this.market) {
          throw new Error('Server must be configured before using trading operations');
        }

        // Handle trading tools
        switch (name) {
          // Market scanning tools
          case 'scan_market':
            const scanArgs = ScanMarketToolSchema.parse(args);
            await this.scanner!.startScanning(scanArgs.symbols);
            if (scanArgs.config) {
              this.scanner!.updateConfig(scanArgs.config);
            }
            return {
              content: [{ type: 'text', text: `Started scanning ${scanArgs.symbols.length} symbols` }],
            };

          case 'get_opportunities':
            const opportunityArgs = GetOpportunitiesToolSchema.parse(args);
            const opportunities = this.scanner!.getTopOpportunities(opportunityArgs.limit);
            return {
              content: [{ type: 'text', text: JSON.stringify(opportunities, null, 2) }],
            };

          // Manual trading tools
          case 'get_trade_suggestions':
            const suggestionArgs = GetTradeSuggestionsToolSchema.parse(args);
            const suggestions = this.manualTrader!.getPendingSuggestions()
              .filter(({ suggestion }) =>
                !suggestionArgs.minScore || suggestion.score >= suggestionArgs.minScore
              );
            return {
              content: [{ type: 'text', text: JSON.stringify(suggestions, null, 2) }],
            };

          case 'approve_suggestion':
            const approveArgs = ApproveSuggestionToolSchema.parse(args);
            const executedTradeId = await this.manualTrader!.approveSuggestion(approveArgs.suggestionId);
            return {
              content: [{ type: 'text', text: executedTradeId ? `Trade executed with ID: ${executedTradeId}` : 'Failed to execute trade' }],
            };

          case 'reject_suggestion':
            const rejectArgs = RejectSuggestionToolSchema.parse(args);
            this.manualTrader!.rejectSuggestion(rejectArgs.suggestionId);
            return {
              content: [{ type: 'text', text: 'Trade suggestion rejected' }],
            };

          case 'close_position':
            const closeArgs = ClosePositionToolSchema.parse(args);
            const closed = await this.manualTrader!.closePosition(closeArgs.id);
            return {
              content: [{ type: 'text', text: closed ? 'Position closed successfully' : 'Failed to close position' }],
            };

          case 'enable_trading':
            const enableArgs = EnableTradingToolSchema.parse(args);
            this.manualTrader!.enableTrading(enableArgs.enabled);
            return {
              content: [{ type: 'text', text: `Trading ${enableArgs.enabled ? 'enabled' : 'disabled'}` }],
            };

          // Original trading tools
          case 'create_trade':
            if (!args) throw new Error('Missing trade parameters');
            const tradeId = await this.trading!.createTrade(args as z.infer<typeof CreateTradeToolSchema>);
            return {
              content: [{ type: 'text', text: `Trade created with ID: ${tradeId}` }],
            };

          case 'approve_trade':
            if (!args || typeof args.id !== 'string') throw new Error('Missing or invalid trade ID');
            await this.trading!.approveTrade({ id: args.id });
            return {
              content: [{ type: 'text', text: 'Trade approved and executed' }],
            };

          case 'cancel_trade':
            if (!args || typeof args.id !== 'string') throw new Error('Missing or invalid trade ID');
            await this.trading!.cancelTrade({ id: args.id });
            return {
              content: [{ type: 'text', text: 'Trade cancelled' }],
            };

          case 'list_trades':
            const trades = await this.trading!.listTrades();
            return {
              content: [{ type: 'text', text: JSON.stringify(trades, null, 2) }],
            };

          // Market tools
          case 'monitor_symbol':
            if (!args || typeof args.symbol !== 'string') throw new Error('Missing or invalid symbol');
            await this.market!.monitorSymbol({ symbol: args.symbol });
            return {
              content: [{ type: 'text', text: `Started monitoring ${args.symbol}` }],
            };

          case 'stop_monitoring_symbol':
            if (!args || typeof args.symbol !== 'string') throw new Error('Missing or invalid symbol');
            await this.market!.stopMonitoringSymbol({ symbol: args.symbol });
            return {
              content: [{ type: 'text', text: `Stopped monitoring ${args.symbol}` }],
            };

          case 'get_current_price':
            if (!args || typeof args.symbol !== 'string') throw new Error('Missing or invalid symbol');
            const price = await this.market!.getCurrentPrice(args.symbol);
            return {
              content: [{ type: 'text', text: `Current price for ${args.symbol}: ${price}` }],
            };

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        console.error('Error executing tool:', error);

        let errorMessage = 'An unknown error occurred';
        if (error instanceof TradingError || error instanceof MarketDataError) {
          errorMessage = error.message;
        } else if (error instanceof BinanceError) {
          errorMessage = `Binance API error: ${error.message}`;
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
    process.on('SIGINT', async () => {
      console.info('Shutting down...');
      if (this.engine) {
        await this.engine.cleanup();
      }
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
