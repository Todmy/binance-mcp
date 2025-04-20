import { WebSocketManager } from '../core/websocket';
import { EventEmitter } from 'events';
import { HistoricalAnalyzer } from './historical-analyzer';
import { HistoricalAnalysis } from '../types/analysis';

export interface MarketStats {
  symbol: string;
  volatility: number;      // 24h price volatility percentage
  volume: number;          // 24h trading volume
  priceChange: number;     // 24h price change percentage
  momentum: number;        // Recent price momentum score
  historicalAnalysis?: HistoricalAnalysis;  // Historical data analysis
}

interface ScannerConfig {
  updateInterval: number;  // Milliseconds between updates
  volatilityWindow: number; // Number of periods for volatility calculation
  minimumVolume: number;   // Minimum 24h volume to consider
  minimumVolatility: number; // Minimum volatility percentage to consider
}

export class MarketScanner extends EventEmitter {
  private wsManager: WebSocketManager;
  private stats: Map<string, MarketStats> = new Map();
  private priceHistory: Map<string, number[]> = new Map();
  private config: ScannerConfig;

  private readonly historicalAnalyzer: HistoricalAnalyzer;

  public getHistoricalAnalyzer(): HistoricalAnalyzer {
    return this.historicalAnalyzer;
  }

  constructor(testnet: boolean = false, binanceClient: any) {
    super();
    this.wsManager = new WebSocketManager(testnet);
    this.config = {
      updateInterval: 60000,    // 1 minute
      volatilityWindow: 24,     // 24 periods
      minimumVolume: 1000000,   // $1M minimum volume
      minimumVolatility: 1.5    // 1.5% minimum volatility
    };

    this.historicalAnalyzer = new HistoricalAnalyzer(binanceClient);
    this.setupWebSocket();
  }

  private setupWebSocket(): void {
    this.wsManager.on('data', (event: { type: string; data: any }) => {
      const [symbol] = event.type.split('@');
      this.updatePriceHistory(symbol.toUpperCase(), parseFloat(event.data.p || event.data.c));
    });

    setInterval(() => this.calculateStats(), this.config.updateInterval);
  }

  private updatePriceHistory(symbol: string, price: number): void {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }

    const history = this.priceHistory.get(symbol)!;
    history.push(price);

    // Keep only needed history
    if (history.length > this.config.volatilityWindow) {
      history.shift();
    }
  }

  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;

    const returns = prices.slice(1).map((price, i) =>
      ((price - prices[i]) / prices[i]) * 100
    );

    const mean = returns.reduce((sum, val) => sum + val, 0) / returns.length;
    const variance = returns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / returns.length;

    return Math.sqrt(variance);
  }

  private calculateMomentum(prices: number[]): number {
    if (prices.length < 2) return 0;

    // Calculate ROC (Rate of Change)
    const currentPrice = prices[prices.length - 1];
    const oldPrice = prices[0];
    return ((currentPrice - oldPrice) / oldPrice) * 100;
  }

  private calculateStats(): void {
    for (const [symbol, prices] of this.priceHistory.entries()) {
      const volatility = this.calculateVolatility(prices);
      const momentum = this.calculateMomentum(prices);
      const volume = 0; // To be implemented with actual volume data
      const priceChange = momentum; // Simplified for now

      this.stats.set(symbol, {
        symbol,
        volatility,
        volume,
        priceChange,
        momentum
      });

      // Emit opportunity if metrics exceed thresholds
      if (volatility >= this.config.minimumVolatility) {
        this.emit('opportunity', {
          symbol,
          metrics: this.stats.get(symbol)
        });
      }
    }

    // Emit updated stats
    this.emit('statsUpdated', Array.from(this.stats.values()));
  }

  public getCachedAnalysis(symbol: string): HistoricalAnalysis | undefined {
    const stats = this.stats.get(symbol);
    return stats?.historicalAnalysis;
  }

  public async getSymbolAnalysis(symbol: string, maxAge: number = 5 * 60 * 1000): Promise<HistoricalAnalysis | undefined> {
    try {
      const analysis = await this.historicalAnalyzer.getSymbolAnalysis(symbol, maxAge);
      const stats = this.stats.get(symbol);
      if (stats) {
        this.stats.set(symbol, {
          ...stats,
          historicalAnalysis: analysis
        });
      }
      return analysis;
    } catch (error) {
      console.error(`Error getting analysis for ${symbol}:`, error);
      throw error;
    }
  }

  public async startScanning(symbols: string[]): Promise<void> {
    for (const symbol of symbols) {
      await this.wsManager.connectToStream(symbol, 'trade');
      await this.getSymbolAnalysis(symbol);
    }
  }

  public async stopScanning(symbols: string[]): Promise<void> {
    for (const symbol of symbols) {
      await this.wsManager.disconnectFromStream(symbol, 'trade');
      this.priceHistory.delete(symbol);
      this.stats.delete(symbol);
    }
  }

  public getTopOpportunities(limit: number = 10): MarketStats[] {
    return Array.from(this.stats.values())
      .filter(stat => stat.historicalAnalysis) // Only consider pairs with historical analysis
      .sort((a, b) => {
        // Calculate composite score including historical analysis
        const getScore = (stat: MarketStats): number => {
          const historical = stat.historicalAnalysis!;
          const dayAnalysis = historical.timeframes['1d'];

          // Weight different factors
          const volatilityScore = stat.volatility * 0.3;
          const volumeScore = (stat.volume / this.config.minimumVolume) * 0.2;
          const trendScore = dayAnalysis.trendStrength * 0.3;
          const technicalScore = (
            (dayAnalysis.indicators.rsi / 100) * 0.1 +
            Math.abs(dayAnalysis.indicators.macd.histogram) * 0.1
          );

          return volatilityScore + volumeScore + trendScore + technicalScore;
        };

        return getScore(b) - getScore(a);
      })
      .slice(0, limit);
  }

  public updateConfig(newConfig: Partial<ScannerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public async cleanup(): Promise<void> {
    await this.wsManager.closeAll();
  }
}
