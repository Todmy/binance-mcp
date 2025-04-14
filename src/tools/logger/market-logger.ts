import {
  FormattedBookTicker,
  FormattedKline,
  FormattedOrderBook,
  MarketDepthResult
} from '../format/market-data-formatter';
import { PriceCalculator, VolatilityResult } from '../math/price-calculator';

export class MarketLogger {
  private readonly priceCalculator: PriceCalculator;
  private readonly marketData: Map<string, SymbolMarketData>;
  private readonly maxDataPoints: number;

  constructor(maxDataPoints: number = 1000) {
    this.priceCalculator = new PriceCalculator();
    this.marketData = new Map();
    this.maxDataPoints = maxDataPoints;
  }

  /**
   * Log book ticker update
   */
  public logBookTicker(ticker: FormattedBookTicker): void {
    const data = this.getOrCreateMarketData(ticker.symbol);
    data.bookTickers.push({
      ...ticker,
      timestamp: Date.now()
    });

    // Maintain size limit
    if (data.bookTickers.length > this.maxDataPoints) {
      data.bookTickers = data.bookTickers.slice(-this.maxDataPoints);
    }

    // Update market metrics
    this.updateMarketMetrics(ticker.symbol);
  }

  /**
   * Log candlestick data
   */
  public logKline(kline: FormattedKline): void {
    const data = this.getOrCreateMarketData(kline.symbol);
    data.klines.set(kline.interval, [
      ...(data.klines.get(kline.interval) || []),
      kline
    ].slice(-this.maxDataPoints));

    // Update market metrics
    this.updateMarketMetrics(kline.symbol);
  }

  /**
   * Log order book update
   */
  public logOrderBook(orderBook: FormattedOrderBook, depth: MarketDepthResult): void {
    const data = this.getOrCreateMarketData(orderBook.symbol);
    data.orderBook = {
      ...orderBook,
      depth,
      timestamp: Date.now()
    };

    // Update market metrics
    this.updateMarketMetrics(orderBook.symbol);
  }

  /**
   * Get market analysis for a symbol
   */
  public getMarketAnalysis(symbol: string): MarketAnalysis | null {
    const data = this.marketData.get(symbol);
    if (!data) return null;

    return {
      symbol,
      currentPrice: this.getCurrentPrice(symbol),
      priceHistory: this.getPriceHistory(symbol),
      volatility: this.calculateVolatility(symbol),
      marketDepth: data.orderBook?.depth,
      volume24h: this.calculate24hVolume(symbol),
      lastUpdate: Date.now()
    };
  }

  /**
   * Get volume profile for a symbol
   */
  public getVolumeProfile(
    symbol: string,
    interval: string = '1h',
    periods: number = 24
  ): VolumeProfile | null {
    const data = this.marketData.get(symbol);
    if (!data) return null;

    const klines = data.klines.get(interval) || [];
    const recentKlines = klines.slice(-periods);

    if (recentKlines.length === 0) return null;

    const totalVolume = recentKlines.reduce((sum, k) => sum + k.volume, 0);
    const buyVolume = recentKlines.reduce((sum, k) => sum + k.buyVolume, 0);
    const sellVolume = totalVolume - buyVolume;

    return {
      symbol,
      interval,
      totalVolume,
      buyVolume,
      sellVolume,
      buyPercentage: (buyVolume / totalVolume) * 100,
      sellPercentage: (sellVolume / totalVolume) * 100,
      periods: recentKlines.length
    };
  }

  /**
   * Get market data for a time range
   */
  public getMarketDataRange(
    symbol: string,
    startTime: number,
    endTime: number
  ): MarketDataRange {
    const data = this.marketData.get(symbol);
    if (!data) {
      return {
        symbol,
        bookTickers: [],
        klines: new Map(),
        orderBook: null
      };
    }

    return {
      symbol,
      bookTickers: data.bookTickers.filter(
        t => t.timestamp >= startTime && t.timestamp <= endTime
      ),
      klines: new Map(
        Array.from(data.klines.entries()).map(([interval, klines]) => [
          interval,
          klines.filter(k => k.startTime >= startTime && k.endTime <= endTime)
        ])
      ),
      orderBook: data.orderBook
    };
  }

  private getOrCreateMarketData(symbol: string): SymbolMarketData {
    if (!this.marketData.has(symbol)) {
      this.marketData.set(symbol, {
        bookTickers: [],
        klines: new Map(),
        orderBook: null,
        metrics: {
          volatility: null,
          volume24h: 0,
          lastUpdate: Date.now()
        }
      });
    }
    return this.marketData.get(symbol)!;
  }

  private getCurrentPrice(symbol: string): number | null {
    const data = this.marketData.get(symbol);
    if (!data || data.bookTickers.length === 0) return null;

    const lastTicker = data.bookTickers[data.bookTickers.length - 1];
    return (lastTicker.bid.price + lastTicker.ask.price) / 2;
  }

  private getPriceHistory(symbol: string): number[] {
    const data = this.marketData.get(symbol);
    if (!data) return [];

    return data.bookTickers.map(
      ticker => (ticker.bid.price + ticker.ask.price) / 2
    );
  }

  private calculateVolatility(symbol: string): VolatilityResult | null {
    const prices = this.getPriceHistory(symbol);
    if (prices.length < 2) return null;

    return this.priceCalculator.calculateVolatility(prices);
  }

  private calculate24hVolume(symbol: string): number {
    const data = this.marketData.get(symbol);
    if (!data) return 0;

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return Array.from(data.klines.values())
      .flat()
      .filter(k => k.startTime >= oneDayAgo)
      .reduce((sum, k) => sum + k.volume, 0);
  }

  private updateMarketMetrics(symbol: string): void {
    const data = this.marketData.get(symbol);
    if (!data) return;

    data.metrics = {
      volatility: this.calculateVolatility(symbol),
      volume24h: this.calculate24hVolume(symbol),
      lastUpdate: Date.now()
    };
  }
}

interface SymbolMarketData {
  bookTickers: Array<FormattedBookTicker & { timestamp: number }>;
  klines: Map<string, FormattedKline[]>;
  orderBook: (FormattedOrderBook & {
    depth: MarketDepthResult;
    timestamp: number;
  }) | null;
  metrics: {
    volatility: VolatilityResult | null;
    volume24h: number;
    lastUpdate: number;
  };
}

export interface MarketAnalysis {
  symbol: string;
  currentPrice: number | null;
  priceHistory: number[];
  volatility: VolatilityResult | null;
  marketDepth: MarketDepthResult | undefined;
  volume24h: number;
  lastUpdate: number;
}

export interface VolumeProfile {
  symbol: string;
  interval: string;
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  buyPercentage: number;
  sellPercentage: number;
  periods: number;
}

export interface MarketDataRange {
  symbol: string;
  bookTickers: Array<FormattedBookTicker & { timestamp: number }>;
  klines: Map<string, FormattedKline[]>;
  orderBook: (FormattedOrderBook & {
    depth: MarketDepthResult;
    timestamp: number;
  }) | null;
}
