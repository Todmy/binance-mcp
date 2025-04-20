import { z } from 'zod';
import { TimeInForce } from 'binance-api-node';

// Trading Operation Schemas
export const CreateTradeSchema = z.object({
  symbol: z.string().describe("Trading pair symbol (e.g. BTCUSDT)"),
  side: z.enum(['BUY', 'SELL']).describe("Trade direction"),
  type: z.enum(['MARKET', 'LIMIT', 'STOP_MARKET', 'TAKE_PROFIT_MARKET']).describe("Order type"),
  quantity: z.number().positive().describe("Trade quantity"),
  price: z.number().positive().optional().describe("Limit price (required for LIMIT orders)"),
  stopLoss: z.number().positive().optional().describe("Stop loss price"),
  takeProfit: z.number().positive().optional().describe("Take profit price"),
  timeInForce: z.enum(['GTC', 'IOC', 'FOK'] as [TimeInForce, ...TimeInForce[]]).optional()
    .describe("Time in force policy"),
});

export const TradeIdSchema = z.object({
  id: z.string().describe("Trade ID to operate on")
});

// Market Data Schemas
export const SymbolSchema = z.object({
  symbol: z.string().describe("Trading pair symbol to monitor")
});

export const TimeframeSchema = z.object({
  symbol: z.string().describe("Trading pair symbol"),
  interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).describe("Timeframe interval"),
  limit: z.number().min(1).max(1000).optional().describe("Number of candles to fetch")
});

// Market Scanner Schemas
export const ScanMarketSchema = z.object({
  symbols: z.array(z.string()).describe("List of symbols to scan"),
  config: z.object({
    updateInterval: z.number().optional(),
    volatilityWindow: z.number().optional(),
    minimumVolume: z.number().optional(),
    minimumVolatility: z.number().optional()
  }).optional()
});

export const GetOpportunitiesSchema = z.object({
  limit: z.number().min(1).max(50).optional().describe("Maximum number of opportunities to return")
});

// Manual Trading Schemas
export const GetTradeSuggestionsSchema = z.object({
  minScore: z.number().min(0).max(1).optional().describe("Minimum score threshold")
});

export const SuggestionIdSchema = z.object({
  suggestionId: z.string().describe("ID of the trade suggestion")
});

export const EnableTradingSchema = z.object({
  enabled: z.boolean().describe("Whether to enable or disable trading")
});

// Tool Schemas for MCP
export const CreateTradeToolSchema = CreateTradeSchema;
export const ApproveTradeToolSchema = TradeIdSchema;
export const CancelTradeToolSchema = TradeIdSchema;
export const MonitorSymbolToolSchema = SymbolSchema;
export const GetMarketDataToolSchema = TimeframeSchema;
export const ScanMarketToolSchema = ScanMarketSchema;
export const GetOpportunitiesToolSchema = GetOpportunitiesSchema;
export const GetTradeSuggestionsToolSchema = GetTradeSuggestionsSchema;
export const ApproveSuggestionToolSchema = SuggestionIdSchema;
export const RejectSuggestionToolSchema = SuggestionIdSchema;
export const ClosePositionToolSchema = TradeIdSchema;
export const EnableTradingToolSchema = EnableTradingSchema;

// Configuration Schemas
export const RiskConfigSchema = z.object({
  maxPositionSize: z.number().positive(),
  maxLeverage: z.number().positive(),
  stopLossPercentage: z.number().min(0).max(1),
  dailyLossLimit: z.number().positive(),
  priceDeviationLimit: z.number().positive()
});

export const BinanceConfigSchema = z.object({
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
  testnet: z.boolean()
});

export const FullConfigSchema = z.object({
  binance: BinanceConfigSchema,
  risk: RiskConfigSchema,
  strategy: z.object({
    riskLevel: z.enum(['conservative', 'moderate', 'aggressive']),
    timeframe: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']),
    indicators: z.array(z.object({
      name: z.string(),
      parameters: z.record(z.number())
    })),
    customRules: z.array(z.string()).optional()
  })
});

// Helper function to validate config
export function validateConfig(config: unknown): boolean {
  try {
    FullConfigSchema.parse(config);
    return true;
  } catch (error) {
    return false;
  }
}
