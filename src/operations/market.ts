import { z } from 'zod';
import { MarketDataError } from '../common/errors';
import { BinanceClient, FuturesBookTicker } from '../core/binance-types';

export const SymbolSchema = z.object({
  symbol: z.string().min(1)
});

export interface MarketOperations {
  getPrice(symbol: string): Promise<string>;
  getDailyStats(symbol: string): Promise<{
    priceChange: string;
    priceChangePercent: string;
    lastPrice: string;
    volume: string;
    highPrice: string;
    lowPrice: string;
  }>;
  getBookTicker(symbol: string): Promise<FuturesBookTicker>;
  getCandles(params: {
    symbol: string;
    interval: string;
    limit?: number;
  }): Promise<Array<{
    openTime: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
  }>>;
}

export class BinanceMarketOperations implements MarketOperations {
  constructor(private readonly client: BinanceClient) {}

  async getPrice(symbol: string): Promise<string> {
    try {
      const tickers = await this.client.futuresAllBookTickers();
      const ticker = tickers[symbol];

      if (!ticker) {
        throw new MarketDataError(`No price data available for ${symbol}`);
      }

      return ticker.bestBidPrice; // Using best bid as current price
    } catch (error) {
      throw new MarketDataError(`Failed to get price for ${symbol}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getDailyStats(symbol: string): Promise<{
    priceChange: string;
    priceChangePercent: string;
    lastPrice: string;
    volume: string;
    highPrice: string;
    lowPrice: string;
  }> {
    try {
      const allStats = await this.client.futures24hr();
      const stats = allStats.find(stat => stat.symbol === symbol);

      if (!stats) {
        throw new MarketDataError(`No daily stats available for ${symbol}`);
      }

      return {
        priceChange: stats.priceChange,
        priceChangePercent: stats.priceChangePercent,
        lastPrice: stats.lastPrice,
        volume: stats.volume,
        highPrice: stats.highPrice,
        lowPrice: stats.lowPrice
      };
    } catch (error) {
      throw new MarketDataError(`Failed to get daily stats for ${symbol}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getBookTicker(symbol: string): Promise<FuturesBookTicker> {
    try {
      const tickers = await this.client.futuresAllBookTickers();
      const ticker = tickers[symbol];

      if (!ticker) {
        throw new MarketDataError(`No book ticker available for ${symbol}`);
      }

      return {
        symbol: ticker.symbol,
        bestBidPrice: ticker.bestBidPrice,
        bestBidQty: ticker.bestBidQty,
        bestAskPrice: ticker.bestAskPrice,
        bestAskQty: ticker.bestAskQty,
        time: ticker.time
      };
    } catch (error) {
      throw new MarketDataError(`Failed to get book ticker for ${symbol}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getCandles(params: {
    symbol: string;
    interval: string;
    limit?: number;
  }): Promise<Array<{
    openTime: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
  }>> {
    try {
      const candles = await this.client.futuresCandles(params);
      return candles.map(candle => ({
        openTime: candle.openTime,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume
      }));
    } catch (error) {
      throw new MarketDataError(`Failed to get candles for ${params.symbol}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Helper function to create market operations instance
export function createMarketOperations(client: BinanceClient): MarketOperations {
  return new BinanceMarketOperations(client);
}
