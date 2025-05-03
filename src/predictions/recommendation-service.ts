import { BinanceClient } from '../core/binance-types';
import { PredictionTracker } from './prediction-tracker';
import { PredictionType, PredictionStats } from '../types/predictions';

export interface Recommendation {
  symbol: string;
  type: 'ENTRY' | 'EXIT' | 'RISK_ADJUSTMENT';
  confidence: number;
  reasoning: string[];
  suggestedAction: {
    direction?: 'LONG' | 'SHORT';
    targetPrice?: string;
    stopLoss?: string;
    timeframe?: string;
    riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  historicalContext: {
    totalPredictions: number;
    successRate: number;
    averageAccuracy: number;
    recentTrend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  };
}

export class RecommendationService {
  private readonly MINIMUM_PREDICTIONS = 5;
  private readonly HIGH_CONFIDENCE_THRESHOLD = 75;
  private readonly MEDIUM_CONFIDENCE_THRESHOLD = 60;

  constructor(
    private readonly client: BinanceClient,
    private readonly predictionTracker: PredictionTracker
  ) {}

  async generateRecommendation(symbol: string): Promise<Recommendation | null> {
    const stats = this.predictionTracker.getSymbolStats(symbol);
    if (!stats || stats.total < this.MINIMUM_PREDICTIONS) {
      return null;
    }

    const currentPrice = await this.getCurrentPrice(symbol);
    const symbolStats = await this.getMarketStats(symbol);
    const recentSuccess = this.analyzeRecentPerformance(stats);

    const confidence = this.calculateConfidence(stats, recentSuccess);
    const reasoning: string[] = [];
    let type: Recommendation['type'] = 'ENTRY';
    const suggestedAction: Recommendation['suggestedAction'] = {};

    // Analyze price target predictions
    const priceTargetStats = this.predictionTracker.getStats().byType[PredictionType.PRICE_TARGET];
    if (priceTargetStats.accuracy > this.HIGH_CONFIDENCE_THRESHOLD) {
      reasoning.push(`High accuracy (${priceTargetStats.accuracy.toFixed(1)}%) in price target predictions`);
    }

    // Analyze trend predictions
    const trendStats = this.predictionTracker.getStats().byType[PredictionType.TREND_DIRECTION];
    if (trendStats.accuracy > this.MEDIUM_CONFIDENCE_THRESHOLD) {
      reasoning.push(`Good trend prediction accuracy (${trendStats.accuracy.toFixed(1)}%)`);
    }

    // Market volatility check
    const volatility = this.calculateVolatility(symbolStats);
    if (volatility > 0.02) { // 2% volatility threshold
      reasoning.push(`High market volatility detected (${(volatility * 100).toFixed(1)}%)`);
      type = 'RISK_ADJUSTMENT';
      suggestedAction.riskLevel = 'HIGH';
    }

    // Recent performance trend
    const trend = this.calculateTrend(stats);
    reasoning.push(`${trend} prediction accuracy trend`);

    if (confidence >= this.HIGH_CONFIDENCE_THRESHOLD) {
      const direction = this.determineTradingDirection(symbolStats);
      suggestedAction.direction = direction;
      suggestedAction.targetPrice = this.calculateTargetPrice(currentPrice, direction, volatility);
      suggestedAction.stopLoss = this.calculateStopLoss(currentPrice, direction, volatility);
      suggestedAction.timeframe = this.determineTimeframe(volatility);
    }

    return {
      symbol,
      type,
      confidence,
      reasoning,
      suggestedAction,
      historicalContext: {
        totalPredictions: stats.total,
        successRate: (stats.successful / stats.total) * 100,
        averageAccuracy: stats.accuracy,
        recentTrend: trend
      }
    };
  }

  private async getCurrentPrice(symbol: string): Promise<string> {
    const tickers = await this.client.futuresAllBookTickers();
    const ticker = tickers[symbol];
    if (!ticker) {
      throw new Error(`No price data available for ${symbol}`);
    }
    return ticker.bestBidPrice;
  }

  private async getMarketStats(symbol: string) {
    const stats = await this.client.futures24hr();
    return stats.find(s => s.symbol === symbol);
  }

  private calculateConfidence(
    stats: PredictionStats['bySymbol'][string],
    recentSuccess: number
  ): number {
    const historicalWeight = 0.7;
    const recentWeight = 0.3;

    const historicalConfidence = (stats.successful / stats.total) * 100;
    const weightedConfidence = (historicalConfidence * historicalWeight) + (recentSuccess * recentWeight);

    return Math.min(100, Math.max(0, weightedConfidence));
  }

  private analyzeRecentPerformance(stats: PredictionStats['bySymbol'][string]): number {
    // In a real implementation, we would analyze the most recent predictions
    // For now, we'll use the overall accuracy as a placeholder
    return (stats.successful / stats.total) * 100;
  }

  private calculateVolatility(stats: any): number {
    if (!stats) return 0;
    return Math.abs(parseFloat(stats.priceChangePercent)) / 100;
  }

  private calculateTrend(stats: PredictionStats['bySymbol'][string]): 'IMPROVING' | 'STABLE' | 'DECLINING' {
    // In a real implementation, we would analyze the trend of prediction accuracy over time
    // For now, we'll return a placeholder based on overall accuracy
    const accuracy = (stats.successful / stats.total) * 100;
    if (accuracy > 70) return 'IMPROVING';
    if (accuracy > 50) return 'STABLE';
    return 'DECLINING';
  }

  private determineTradingDirection(stats: any): 'LONG' | 'SHORT' {
    if (!stats) return 'LONG';
    return parseFloat(stats.priceChangePercent) > 0 ? 'LONG' : 'SHORT';
  }

  private calculateTargetPrice(currentPrice: string, direction: 'LONG' | 'SHORT', volatility: number): string {
    const price = parseFloat(currentPrice);
    const movement = price * (volatility * 2); // Target 2x the current volatility
    return direction === 'LONG'
      ? (price + movement).toFixed(8)
      : (price - movement).toFixed(8);
  }

  private calculateStopLoss(currentPrice: string, direction: 'LONG' | 'SHORT', volatility: number): string {
    const price = parseFloat(currentPrice);
    const movement = price * (volatility * 0.5); // Stop at 0.5x the current volatility
    return direction === 'LONG'
      ? (price - movement).toFixed(8)
      : (price + movement).toFixed(8);
  }

  private determineTimeframe(volatility: number): string {
    if (volatility > 0.05) return '15m';
    if (volatility > 0.02) return '1h';
    return '4h';
  }
}
