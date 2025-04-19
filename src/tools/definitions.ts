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
  }
];

export const ALL_TOOLS: Tool[] = [...TRADING_TOOLS, ...MARKET_TOOLS];
