import { TradingEngine } from '../core/trading-engine';
import { MarketDataError } from '../common/errors';
import { SymbolSchema } from '../common/validation';
import { z } from 'zod';

export interface MarketOperations {
  monitorSymbol(params: z.infer<typeof SymbolSchema>): Promise<void>;
  stopMonitoringSymbol(params: z.infer<typeof SymbolSchema>): Promise<void>;
  getCurrentPrice(symbol: string): Promise<number>;
}

export class BinanceMarketOperations implements MarketOperations {
  constructor(private readonly engine: TradingEngine) {}

  async monitorSymbol(params: z.infer<typeof SymbolSchema>): Promise<void> {
    try {
      const { symbol } = SymbolSchema.parse(params);
      await this.engine.monitorSymbol(symbol);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new MarketDataError('Invalid symbol format');
      }
      throw new MarketDataError(`Failed to monitor symbol: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async stopMonitoringSymbol(params: z.infer<typeof SymbolSchema>): Promise<void> {
    try {
      const { symbol } = SymbolSchema.parse(params);
      await this.engine.stopMonitoringSymbol(symbol);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new MarketDataError('Invalid symbol format');
      }
      throw new MarketDataError(`Failed to stop monitoring symbol: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getCurrentPrice(symbol: string): Promise<number> {
    const price = await this.engine.getCurrentPrice(symbol);
    if (price === null) {
      throw new MarketDataError(`Unable to get current price for ${symbol}`);
    }
    return price;
  }
}

// Helper function to create market operations instance
export function createMarketOperations(engine: TradingEngine): MarketOperations {
  return new BinanceMarketOperations(engine);
}
