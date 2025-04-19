import { TradingEngine } from '../core/trading-engine';
import { Trade } from '../config/types';
import { BinanceError, TradingError } from '../common/errors';
import { CreateTradeSchema, TradeIdSchema } from '../common/validation';
import { z } from 'zod';

export interface TradingOperations {
  createTrade(params: z.infer<typeof CreateTradeSchema>): Promise<string>;
  approveTrade(params: z.infer<typeof TradeIdSchema>): Promise<void>;
  cancelTrade(params: z.infer<typeof TradeIdSchema>): Promise<void>;
  listTrades(): Promise<Trade[]>;
}

export class BinanceTradingOperations implements TradingOperations {
  constructor(private readonly engine: TradingEngine) {}

  async createTrade(params: z.infer<typeof CreateTradeSchema>): Promise<string> {
    try {
      const validatedParams = CreateTradeSchema.parse(params);
      const trade = await this.engine.createTrade(validatedParams);
      return trade.id;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new TradingError('Invalid trade parameters: ' + error.message);
      }
      if (error instanceof BinanceError) {
        throw new TradingError('Binance API error: ' + error.message, error);
      }
      throw error;
    }
  }

  async approveTrade(params: z.infer<typeof TradeIdSchema>): Promise<void> {
    try {
      const { id } = TradeIdSchema.parse(params);
      await this.engine.approveTrade(id);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new TradingError('Invalid trade ID format');
      }
      if (error instanceof BinanceError) {
        throw new TradingError('Failed to approve trade: ' + error.message, error);
      }
      throw error;
    }
  }

  async cancelTrade(params: z.infer<typeof TradeIdSchema>): Promise<void> {
    try {
      const { id } = TradeIdSchema.parse(params);
      await this.engine.cancelTrade(id);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new TradingError('Invalid trade ID format');
      }
      if (error instanceof BinanceError) {
        throw new TradingError('Failed to cancel trade: ' + error.message, error);
      }
      throw error;
    }
  }

  async listTrades(): Promise<Trade[]> {
    try {
      return await this.engine.listTrades();
    } catch (error) {
      if (error instanceof BinanceError) {
        throw new TradingError('Failed to list trades: ' + error.message, error);
      }
      throw error;
    }
  }
}

// Helper function to create trading operations instance
export function createTradingOperations(engine: TradingEngine): TradingOperations {
  return new BinanceTradingOperations(engine);
}
