import { BinanceClient } from '../core/binance-types';
import { PriceCalculator } from '../tools/math/price-calculator';

export interface VolatilityMetrics {
  volatilityScore: number;
  standardDeviation: number;
  coefficientOfVariation: number;
  priceRange: {
    min: number;
    max: number;
  };
  trend?: 'INCREASING' | 'DECREASING' | 'STABLE';
}

export interface PositionSizingParams {
  accountBalance: number;
  riskPercentage: number;
  stopLossPercent: number;
  leverage: number;
  symbol: string;
}

export interface PositionSizeResult {
  maxPositionSize: number;
  recommendedSize: number;
  riskAmount: number;
  effectiveLeverage: number;
  marginRequired: number;
  adjustedForVolatility: boolean;
  recommendedLeverage: number;
}

export class VolatilityAnalyzer {
  private priceCalculator: PriceCalculator;
  private readonly VOLATILITY_THRESHOLD_HIGH = 0.05; // 5%
  private readonly VOLATILITY_THRESHOLD_MEDIUM = 0.03; // 3%
  private readonly HISTORY_PERIODS = 30; // 30 periods for historical calculation

  constructor(private readonly client: BinanceClient) {
    this.priceCalculator = new PriceCalculator();
  }

  async calculateVolatility(symbol: string, periodHours: number = 24): Promise<VolatilityMetrics> {
    try {
      // Get historical candle data
      const candles = await this.client.futuresCandles({
        symbol,
        interval: '1h',
        limit: periodHours
      });

      // Extract close prices
      const prices = candles.map(candle => parseFloat(candle.close));
      const priceStats = this.priceCalculator.calculateVolatility(prices);

      // Calculate min and max prices
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      // Get trend
      const trend = await this.getVolatilityTrend(symbol);

      return {
        volatilityScore: priceStats.coefficientOfVariation,
        standardDeviation: priceStats.standardDeviation,
        coefficientOfVariation: priceStats.coefficientOfVariation,
        priceRange: {
          min: minPrice,
          max: maxPrice
        },
        trend
      };
    } catch (error) {
      throw new Error(`Failed to calculate volatility: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async calculateHistoricalVolatility(symbol: string, period: number = this.HISTORY_PERIODS): Promise<number> {
    const candles = await this.client.futuresCandles({
      symbol,
      interval: '1h',
      limit: period
    });

    const prices = candles.map(c => parseFloat(c.close));
    const volatility = this.priceCalculator.calculateVolatility(prices);
    return volatility.coefficientOfVariation;
  }

  private async getVolatilityTrend(symbol: string): Promise<'INCREASING' | 'DECREASING' | 'STABLE'> {
    const shortTermVolatility = await this.calculateHistoricalVolatility(symbol, 12);
    const longTermVolatility = await this.calculateHistoricalVolatility(symbol, this.HISTORY_PERIODS);

    const difference = shortTermVolatility - longTermVolatility;
    if (Math.abs(difference) < 0.005) return 'STABLE';
    return difference > 0 ? 'INCREASING' : 'DECREASING';
  }

  async calculateOptimalPositionSize(
    params: PositionSizingParams
  ): Promise<PositionSizeResult> {
    try {
      const volatilityMetrics = await this.calculateVolatility(params.symbol);
      const tickers = await this.client.futuresAllBookTickers();
      const ticker = tickers[params.symbol];

      if (!ticker) {
        throw new Error('No market data available');
      }

      const currentPrice = parseFloat(ticker.bestBidPrice);
      const riskAmount = params.accountBalance * (params.riskPercentage / 100);

      // Adjust based on volatility
      const adjustmentFactor = this.calculateVolatilityAdjustment(volatilityMetrics.coefficientOfVariation);

      // Calculate position size based on stop loss and volatility
      const stopLossDistance = Math.max(
        currentPrice * params.stopLossPercent,
        currentPrice * volatilityMetrics.standardDeviation
      );

      const maxPositionSize = (riskAmount / stopLossDistance) * params.leverage;

      // Calculate recommended size with volatility adjustment
      const recommendedSize = maxPositionSize * adjustmentFactor;

      // Calculate margin required
      const marginRequired = (currentPrice * recommendedSize) / params.leverage;

      // Calculate recommended leverage based on volatility
      const recommendedLeverage = this.calculateRecommendedLeverage(volatilityMetrics.coefficientOfVariation);

      return {
        maxPositionSize,
        recommendedSize,
        riskAmount,
        effectiveLeverage: Math.min(params.leverage, recommendedLeverage),
        marginRequired,
        adjustedForVolatility: adjustmentFactor < 1,
        recommendedLeverage
      };
    } catch (error) {
      throw new Error(`Failed to calculate position size: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private calculateVolatilityAdjustment(volatility: number): number {
    if (volatility > this.VOLATILITY_THRESHOLD_HIGH) return 0.5;
    if (volatility > this.VOLATILITY_THRESHOLD_MEDIUM) return 0.75;
    return 1.0;
  }

  private calculateRecommendedLeverage(volatility: number): number {
    if (volatility > this.VOLATILITY_THRESHOLD_HIGH) return 5;
    if (volatility > this.VOLATILITY_THRESHOLD_MEDIUM) return 10;
    return 20;
  }

  private async getCurrentPrice(symbol: string): Promise<number> {
    const tickers = await this.client.futuresAllBookTickers();
    const ticker = tickers[symbol];
    if (!ticker) {
      throw new Error(`No price data available for ${symbol}`);
    }
    return parseFloat(ticker.bestBidPrice);
  }
}
