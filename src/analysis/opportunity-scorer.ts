interface ScoringWeights {
  volatility: number;
  volume: number;
  momentum: number;
  priceChange: number;
}

interface ScoringThresholds {
  minimumVolatility: number;
  minimumVolume: number;
  minimumMomentum: number;
  minimumPriceChange: number;
}

interface OpportunityScore {
  symbol: string;
  totalScore: number;
  metrics: {
    volatilityScore: number;
    volumeScore: number;
    momentumScore: number;
    priceChangeScore: number;
  };
  raw: {
    volatility: number;
    volume: number;
    momentum: number;
    priceChange: number;
  };
}

export class OpportunityScorer {
  private weights: ScoringWeights;
  private thresholds: ScoringThresholds;

  constructor() {
    this.weights = {
      volatility: 0.4,    // 40% weight on volatility
      volume: 0.3,        // 30% weight on volume
      momentum: 0.2,      // 20% weight on momentum
      priceChange: 0.1    // 10% weight on price change
    };

    this.thresholds = {
      minimumVolatility: 1.5,  // 1.5% minimum volatility
      minimumVolume: 1000000,  // $1M minimum volume
      minimumMomentum: 0.5,    // 0.5% minimum momentum
      minimumPriceChange: 0.5  // 0.5% minimum price change
    };
  }

  public updateWeights(newWeights: Partial<ScoringWeights>): void {
    this.weights = { ...this.weights, ...newWeights };

    // Normalize weights to ensure they sum to 1
    const total = Object.values(this.weights).reduce((sum, weight) => sum + weight, 0);
    if (total !== 1) {
      for (const key in this.weights) {
        this.weights[key as keyof ScoringWeights] /= total;
      }
    }
  }

  public updateThresholds(newThresholds: Partial<ScoringThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }

  private normalizeScore(value: number, threshold: number, max: number): number {
    if (value < threshold) return 0;
    return Math.min((value - threshold) / (max - threshold), 1);
  }

  public scoreOpportunity(
    symbol: string,
    metrics: {
      volatility: number;
      volume: number;
      momentum: number;
      priceChange: number;
    }
  ): OpportunityScore {
    // Calculate individual scores
    const volatilityScore = this.normalizeScore(
      metrics.volatility,
      this.thresholds.minimumVolatility,
      10 // Assume 10% is max meaningful volatility
    );

    const volumeScore = this.normalizeScore(
      metrics.volume,
      this.thresholds.minimumVolume,
      10000000 // $10M as reference max volume
    );

    const momentumScore = this.normalizeScore(
      Math.abs(metrics.momentum),
      this.thresholds.minimumMomentum,
      5 // 5% as reference max momentum
    );

    const priceChangeScore = this.normalizeScore(
      Math.abs(metrics.priceChange),
      this.thresholds.minimumPriceChange,
      5 // 5% as reference max price change
    );

    // Calculate weighted total score
    const totalScore =
      volatilityScore * this.weights.volatility +
      volumeScore * this.weights.volume +
      momentumScore * this.weights.momentum +
      priceChangeScore * this.weights.priceChange;

    return {
      symbol,
      totalScore,
      metrics: {
        volatilityScore,
        volumeScore,
        momentumScore,
        priceChangeScore
      },
      raw: {
        volatility: metrics.volatility,
        volume: metrics.volume,
        momentum: metrics.momentum,
        priceChange: metrics.priceChange
      }
    };
  }

  public rankOpportunities(opportunities: Array<{
    symbol: string;
    metrics: {
      volatility: number;
      volume: number;
      momentum: number;
      priceChange: number;
    };
  }>): OpportunityScore[] {
    return opportunities
      .map(opp => this.scoreOpportunity(opp.symbol, opp.metrics))
      .sort((a, b) => b.totalScore - a.totalScore);
  }

  public getTopOpportunities(
    opportunities: Array<{
      symbol: string;
      metrics: {
        volatility: number;
        volume: number;
        momentum: number;
        priceChange: number;
      };
    }>,
    limit: number = 10
  ): OpportunityScore[] {
    return this.rankOpportunities(opportunities).slice(0, limit);
  }
}
