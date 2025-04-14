export class PriceCalculator {
  /**
   * Calculate the average price from a series of prices
   */
  public calculateAveragePrice(prices: number[]): number {
    if (prices.length === 0) return 0;
    return prices.reduce((sum, price) => sum + price, 0) / prices.length;
  }

  /**
   * Calculate volume-weighted average price (VWAP)
   */
  public calculateVWAP(trades: Array<{ price: number; quantity: number }>): number {
    if (trades.length === 0) return 0;

    const sumPriceVolume = trades.reduce(
      (sum, trade) => sum + trade.price * trade.quantity,
      0
    );
    const sumVolume = trades.reduce((sum, trade) => sum + trade.quantity, 0);

    return sumVolume === 0 ? 0 : sumPriceVolume / sumVolume;
  }

  /**
   * Calculate price movement percentage
   */
  public calculatePriceChange(startPrice: number, endPrice: number): PriceChangeResult {
    const absoluteChange = endPrice - startPrice;
    const percentageChange = (absoluteChange / startPrice) * 100;

    return {
      absoluteChange,
      percentageChange,
      direction: absoluteChange > 0 ? 'up' : absoluteChange < 0 ? 'down' : 'unchanged'
    };
  }

  /**
   * Calculate moving average
   */
  public calculateMA(prices: number[], period: number): number[] {
    if (period <= 0 || period > prices.length) {
      return [];
    }

    const ma: number[] = [];
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      ma.push(sum / period);
    }

    return ma;
  }

  /**
   * Calculate exponential moving average (EMA)
   */
  public calculateEMA(prices: number[], period: number): number[] {
    if (period <= 0 || period > prices.length) {
      return [];
    }

    const multiplier = 2 / (period + 1);
    const ema: number[] = [prices[0]];

    for (let i = 1; i < prices.length; i++) {
      const currentEMA =
        (prices[i] - ema[i - 1]) * multiplier + ema[i - 1];
      ema.push(currentEMA);
    }

    return ema;
  }

  /**
   * Calculate price volatility over a period
   */
  public calculateVolatility(prices: number[]): VolatilityResult {
    if (prices.length < 2) {
      return {
        standardDeviation: 0,
        variance: 0,
        meanPrice: 0,
        coefficientOfVariation: 0
      };
    }

    const meanPrice = this.calculateAveragePrice(prices);
    const squaredDiffs = prices.map(price => Math.pow(price - meanPrice, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / prices.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = (standardDeviation / meanPrice) * 100;

    return {
      standardDeviation,
      variance,
      meanPrice,
      coefficientOfVariation
    };
  }

  /**
   * Calculate support and resistance levels using recent price history
   */
  public calculateSupportResistance(
    prices: number[],
    periods: number = 14
  ): SupportResistanceResult {
    if (prices.length < periods) {
      return {
        support: [],
        resistance: [],
        currentSupport: 0,
        currentResistance: 0
      };
    }

    const recentPrices = prices.slice(-periods);
    const sortedPrices = [...recentPrices].sort((a, b) => a - b);
    const currentPrice = prices[prices.length - 1];

    // Find price clusters
    const clusters = this.findPriceClusters(sortedPrices);

    // Separate into support and resistance levels
    const support = clusters.filter(price => price < currentPrice);
    const resistance = clusters.filter(price => price > currentPrice);

    return {
      support,
      resistance,
      currentSupport: support.length ? support[support.length - 1] : 0,
      currentResistance: resistance.length ? resistance[0] : 0
    };
  }

  /**
   * Find price clusters for support/resistance calculation
   */
  private findPriceClusters(sortedPrices: number[], threshold: number = 0.001): number[] {
    const clusters: number[] = [];
    let currentCluster: number[] = [sortedPrices[0]];

    for (let i = 1; i < sortedPrices.length; i++) {
      const price = sortedPrices[i];
      const prevPrice = sortedPrices[i - 1];
      const priceDiff = Math.abs(price - prevPrice) / prevPrice;

      if (priceDiff <= threshold) {
        currentCluster.push(price);
      } else {
        clusters.push(
          currentCluster.reduce((sum, p) => sum + p, 0) / currentCluster.length
        );
        currentCluster = [price];
      }
    }

    if (currentCluster.length > 0) {
      clusters.push(
        currentCluster.reduce((sum, p) => sum + p, 0) / currentCluster.length
      );
    }

    return clusters;
  }
}

export interface PriceChangeResult {
  absoluteChange: number;
  percentageChange: number;
  direction: 'up' | 'down' | 'unchanged';
}

export interface VolatilityResult {
  standardDeviation: number;
  variance: number;
  meanPrice: number;
  coefficientOfVariation: number;
}

export interface SupportResistanceResult {
  support: number[];
  resistance: number[];
  currentSupport: number;
  currentResistance: number;
}
