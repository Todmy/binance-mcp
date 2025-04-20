// Tool type definition based on MCP SDK
export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  CreateTradeToolSchema,
  ApproveTradeToolSchema,
  CancelTradeToolSchema,
  MonitorSymbolToolSchema,
} from '../common/validation';

export const TRADING_TOOLS: Tool[] = [
  {
    name: 'create_trade',
    description: 'Create a new trade in pending status',
    inputSchema: zodToJsonSchema(CreateTradeToolSchema)
  },
  {
    name: 'approve_trade',
    description: 'Approve a pending trade for execution',
    inputSchema: zodToJsonSchema(ApproveTradeToolSchema)
  },
  {
    name: 'cancel_trade',
    description: 'Cancel a pending trade',
    inputSchema: zodToJsonSchema(CancelTradeToolSchema)
  },
  {
    name: 'list_trades',
    description: 'List all trades (both pending and active)',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

export const MARKET_TOOLS: Tool[] = [
  {
    name: 'monitor_symbol',
    description: 'Start monitoring price updates for a trading symbol',
    inputSchema: zodToJsonSchema(MonitorSymbolToolSchema)
  },
  {
    name: 'stop_monitoring_symbol',
    description: 'Stop monitoring price updates for a trading symbol',
    inputSchema: zodToJsonSchema(MonitorSymbolToolSchema)
  },
  {
    name: 'get_current_price',
    description: 'Get the current price for a trading symbol',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading symbol (e.g. BTCUSDT)'
        }
      },
      required: ['symbol']
    }
  },
  {
    name: 'scan_market',
    description: 'Start scanning market for trading opportunities',
    inputSchema: {
      type: 'object',
      properties: {
        symbols: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'List of symbols to scan'
        },
        config: {
          type: 'object',
          properties: {
            updateInterval: {
              type: 'number',
              description: 'Update interval in milliseconds'
            },
            volatilityWindow: {
              type: 'number',
              description: 'Number of periods for volatility calculation'
            },
            minimumVolume: {
              type: 'number',
              description: 'Minimum 24h volume to consider'
            },
            minimumVolatility: {
              type: 'number',
              description: 'Minimum volatility percentage to consider'
            }
          }
        }
      },
      required: ['symbols']
    }
  },
  {
    name: 'get_opportunities',
    description: 'Get current trading opportunities',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of opportunities to return'
        }
      }
    }
  }
];

export const MANUAL_TRADING_TOOLS: Tool[] = [
  {
    name: 'get_trade_suggestions',
    description: 'Get current trade suggestions',
    inputSchema: {
      type: 'object',
      properties: {
        minScore: {
          type: 'number',
          description: 'Minimum score threshold (0-1)'
        }
      }
    }
  },
  {
    name: 'approve_suggestion',
    description: 'Approve and execute a trade suggestion',
    inputSchema: {
      type: 'object',
      properties: {
        suggestionId: {
          type: 'string',
          description: 'ID of the trade suggestion to approve'
        }
      },
      required: ['suggestionId']
    }
  },
  {
    name: 'reject_suggestion',
    description: 'Reject a trade suggestion',
    inputSchema: {
      type: 'object',
      properties: {
        suggestionId: {
          type: 'string',
          description: 'ID of the trade suggestion to reject'
        }
      },
      required: ['suggestionId']
    }
  },
  {
    name: 'close_position',
    description: 'Close an active position',
    inputSchema: {
      type: 'object',
      properties: {
        tradeId: {
          type: 'string',
          description: 'ID of the trade to close'
        }
      },
      required: ['tradeId']
    }
  },
  {
    name: 'enable_trading',
    description: 'Enable or disable trading',
    inputSchema: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          description: 'Whether to enable or disable trading'
        }
      },
      required: ['enabled']
    }
  }
];

export const ALL_TOOLS: Tool[] = [...TRADING_TOOLS, ...MARKET_TOOLS, ...MANUAL_TRADING_TOOLS];
