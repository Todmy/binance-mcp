import { BinanceClient } from '../core/binance-types';
import { Kline, HistoricalAnalysis, TechnicalIndicators, VolumeProfile, TimeframeAnalysis } from '../types/analysis';

export class HistoricalAnalyzer {
  private client: BinanceClient;
  private cache: Map<string, HistoricalAnalysis>;
  private readonly timeframes = ['1h', '4h', '1d'];

  constructor(client: BinanceClient) {
    this.client = client;
    this.cache = new Map();
  }

  private async fetchKlines(symbol: string, interval: string, limit: number = 100): Promise<Kline[]> {
    const rawKlines = await this.client.futuresCandles({ symbol, interval, limit });
    return rawKlines.map(k => ({
      openTime: k[0],
      open: k[1],
      high: k[2],
      low: k[3],
      close: k[4],
      volume: k[5],
      closeTime: k[6],
      quoteAssetVolume: k[7],
      trades: k[8],
      takerBuyBaseAssetVolume: k[9],
      takerBuyQuoteAssetVolume: k[10]
    }));
  }

  private calculateRSI(closes: number[], period: number = 14): number {
    if (closes.length < period + 1) return 0;

    const changes = closes.slice(1).map((price, i) => price - closes[i]);
    const gains = changes.map(change => change > 0 ? change : 0);
    const losses = changes.map(change => change < 0 ? -change : 0);

    const avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain) / period;
    const avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss) / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(closes: number[]): { value: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);
    const macdLine = ema12 - ema26;
    const signalLine = this.calculateEMA([macdLine], 9);

    return {
      value: macdLine,
      signal: signalLine,
      histogram: macdLine - signalLine
    };
  }

  private calculateEMA(values: number[], period: number): number {
    const k = 2 / (period + 1);
    let ema = values[0];

    for (let i = 1; i < values.length; i++) {
      ema = (values[i] * k) + (ema * (1 - k));
    }

    return ema;
  }

  private analyzeVolume(klines: Kline[]): VolumeProfile {
    const volumes = klines.map(k => parseFloat(k.volume));
    const average24h = volumes.slice(-24).reduce((sum, vol) => sum + vol, 0) / 24;

    // Detect volume spikes
    const stdDev = Math.sqrt(
      volumes.reduce((sum, vol) => sum + Math.pow(vol - average24h, 2), 0) / volumes.length
    );

    const volumeSpikes = klines
      .filter((k) => parseFloat(k.volume) > average24h + (2 * stdDev))
      .map(k => ({
        time: k.openTime,
        volume: parseFloat(k.volume)
      }));

    // Calculate volume trend
    const recentVolumes = volumes.slice(-24);
    const volumeTrend = this.calculateTrend(recentVolumes);

    // Calculate volume distribution
    const sortedVolumes = [...volumes].sort((a, b) => a - b);
    const lowThreshold = sortedVolumes[Math.floor(sortedVolumes.length * 0.33)];
    const highThreshold = sortedVolumes[Math.floor(sortedVolumes.length * 0.66)];

    const distribution = volumes.reduce(
      (acc, vol) => {
        if (vol <= lowThreshold) acc.low++;
        else if (vol >= highThreshold) acc.high++;
        else acc.medium++;
        return acc;
      },
      { low: 0, medium: 0, high: 0 }
    );

    return {
      average24h,
      volumeSpikes,
      trend: volumeTrend,
      distribution
    };
  }

  private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    const linearRegression = this.calculateLinearRegression(values);
    if (linearRegression.slope > 0.01) return 'increasing';
    if (linearRegression.slope < -0.01) return 'decreasing';
    return 'stable';
  }

  private calculateLinearRegression(values: number[]): { slope: number; intercept: number } {
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + (xi * values[i]), 0);
    const sumXX = x.reduce((sum, xi) => sum + (xi * xi), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  private calculateTechnicalIndicators(klines: Kline[]): TechnicalIndicators {
    const closes = klines.map(k => parseFloat(k.close));
    const volumes = klines.map(k => parseFloat(k.volume));

    return {
      rsi: this.calculateRSI(closes),
      macd: this.calculateMACD(closes),
      volume: {
        sma: volumes.slice(-20).reduce((sum, vol) => sum + vol) / 20,
        trend: this.calculateTrend(volumes.slice(-20))
      }
    };
  }

  private async analyzeTimeframe(symbol: string, interval: string): Promise<TimeframeAnalysis> {
    const klines = await this.fetchKlines(symbol, interval, 100);
    const indicators = this.calculateTechnicalIndicators(klines);
    const volumeProfile = this.analyzeVolume(klines);

    // Calculate trend strength based on multiple factors
    const closes = klines.map(k => parseFloat(k.close));

    // Calculate price trend
    const priceTrendDirection = this.calculateTrend(closes);
    const priceStrength = Math.abs(closes[closes.length - 1] - closes[0]) / closes[0];

    const rsiStrength = Math.abs(indicators.rsi - 50) / 50;
    const macdStrength = Math.abs(indicators.macd.histogram) / Math.abs(indicators.macd.value);
    const volumeStrength = volumeProfile.distribution.high / (volumeProfile.distribution.low + volumeProfile.distribution.medium);

    // Include price trend strength in the calculation
    const trendStrength = (rsiStrength + macdStrength + volumeStrength + priceStrength) / 4;

    return {
      klines,
      indicators,
      volumeProfile,
      priceTrend: {
        direction: priceTrendDirection,
        strength: priceStrength
      },
      trendStrength
    };
  }

  public async analyzeSymbol(symbol: string): Promise<HistoricalAnalysis> {
    const timeframeAnalyses = await Promise.all(
      this.timeframes.map(async (interval) => [interval, await this.analyzeTimeframe(symbol, interval)])
    );

    const analysis: HistoricalAnalysis = {
      symbol,
      timeframes: {
        '1h': timeframeAnalyses.find(([int]) => int === '1h')![1] as TimeframeAnalysis,
        '4h': timeframeAnalyses.find(([int]) => int === '4h')![1] as TimeframeAnalysis,
        '1d': timeframeAnalyses.find(([int]) => int === '1d')![1] as TimeframeAnalysis
      },
      lastUpdate: Date.now()
    };

    this.cache.set(symbol, analysis);
    return analysis;
  }

  public async getSymbolAnalysis(symbol: string, maxAge: number = 5 * 60 * 1000): Promise<HistoricalAnalysis> {
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.lastUpdate < maxAge) {
      return cached;
    }
    return this.analyzeSymbol(symbol);
  }

  public getCachedAnalysis(symbol: string): HistoricalAnalysis | undefined {
    return this.cache.get(symbol);
  }
}
