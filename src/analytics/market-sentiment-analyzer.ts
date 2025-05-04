import { BinanceClient } from '../core/binance-types';
import { TechnicalAnalysisService } from './technical-analysis-service';

export interface MarketSentiment {
  overall: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  signals: {
    technical: {
      sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
      strength: number;
      indicators: string[];
    };
    momentum: {
      sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
      strength: number;
      factors: string[];
    };
    volatility: {
      level: 'HIGH' | 'MEDIUM' | 'LOW';
      trend: 'INCREASING' | 'DECREASING' | 'STABLE';
      warning?: string;
    };
  };
  marketConditions: {
    trend: 'TRENDING' | 'RANGING' | 'REVERSING';
    strength: number;
    timeframe: string;
  };
  warnings: string[];
}

export interface SentimentOptions {
  timeframe?: string;
  lookbackPeriods?: number;
  useVolatilityAdjustment?: boolean;
  minimumConfidence?: number;
}

export class MarketSentimentAnalyzer {
  constructor(
    private readonly technicalAnalysis: TechnicalAnalysisService,
    private readonly client: BinanceClient
  ) {}

  async analyzeSentiment(symbol: string, options: SentimentOptions = {}): Promise<MarketSentiment> {
    try {
      const {
        timeframe = '1h',
        lookbackPeriods = 100,
        useVolatilityAdjustment = true,
        minimumConfidence = 0.7
      } = options;

      // Get technical analysis data
      const technicals = await this.technicalAnalysis.analyzeTechnicals(symbol);

      // Get recent market data
      const candles = await this.client.futuresCandles({
        symbol,
        interval: timeframe,
        limit: lookbackPeriods
      });

      // Calculate market conditions
      const marketConditions = this.analyzeMarketConditions(candles);

      // Analyze momentum
      const momentum = this.analyzeMomentum(candles, technicals);

      // Calculate volatility assessment
      const volatilityAssessment = this.assessVolatility(technicals.volatility);

      // Generate signals
      const signals = {
        technical: this.analyzeTechnicalSignals(technicals),
        momentum,
        volatility: volatilityAssessment
      };

      // Calculate overall sentiment
      const { sentiment, confidence } = this.calculateOverallSentiment(
        signals,
        marketConditions,
        useVolatilityAdjustment
      );

      // Generate warnings
      const warnings = this.generateWarnings(signals, marketConditions, confidence, minimumConfidence, technicals);

      return {
        overall: sentiment,
        confidence,
        signals,
        marketConditions,
        warnings
      };
    } catch (error) {
      throw new Error(`Failed to analyze market sentiment: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private assessVolatility(volatilityData: { current: number; trend: 'INCREASING' | 'DECREASING' | 'STABLE' }): {
    level: 'HIGH' | 'MEDIUM' | 'LOW';
    trend: 'INCREASING' | 'DECREASING' | 'STABLE';
    warning?: string;
  } {
    // Determine volatility level based on current value
    let level: 'HIGH' | 'MEDIUM' | 'LOW';
    if (volatilityData.current > 0.4) {
      level = 'HIGH';
    } else if (volatilityData.current > 0.2) {
      level = 'MEDIUM';
    } else {
      level = 'LOW';
    }

    // Add warning for high volatility situations
    let warning: string | undefined;
    if (level === 'HIGH' && volatilityData.trend === 'INCREASING') {
      warning = 'Extreme market volatility detected - high risk conditions';
    }

    return {
      level,
      trend: volatilityData.trend,
      warning
    };
  }

  private analyzeTechnicalSignals(technicals: any): {
    sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    strength: number;
    indicators: string[];
  } {
    const signals: string[] = [];
    let bullishCount = 0;
    let bearishCount = 0;

    // RSI analysis
    if (technicals.indicators.rsi > 70) {
      signals.push('RSI overbought');
      bearishCount++;
    } else if (technicals.indicators.rsi < 30) {
      signals.push('RSI oversold');
      bullishCount++;
    }

    // MACD analysis
    if (technicals.indicators.macd.histogram > 0) {
      if (technicals.indicators.macd.histogram > technicals.indicators.macd.signal) {
        signals.push('MACD bullish crossover');
        bullishCount++;
      }
    } else {
      if (technicals.indicators.macd.histogram < technicals.indicators.macd.signal) {
        signals.push('MACD bearish crossover');
        bearishCount++;
      }
    }

    // Bollinger Bands analysis
    const price = technicals.indicators.bollinger.middle;
    if (price > technicals.indicators.bollinger.upper) {
      signals.push('Price above upper Bollinger Band');
      bearishCount++;
    } else if (price < technicals.indicators.bollinger.lower) {
      signals.push('Price below lower Bollinger Band');
      bullishCount++;
    }

    const totalSignals = bullishCount + bearishCount;
    const strength = totalSignals > 0 ? Math.max(bullishCount, bearishCount) / totalSignals : 0;

    let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    if (bullishCount > bearishCount) {
      sentiment = 'BULLISH';
    } else if (bearishCount > bullishCount) {
      sentiment = 'BEARISH';
    } else {
      sentiment = 'NEUTRAL';
    }

    return { sentiment, strength, indicators: signals };
  }

  private analyzeMomentum(candles: any[], technicals: any): {
    sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    strength: number;
    factors: string[];
  } {
    const factors: string[] = [];
    let bullishFactors = 0;
    let bearishFactors = 0;

    // Volume analysis
    const recentVolumes = candles.slice(-10).map(c => parseFloat(c.volume));
    const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
    const latestVolume = recentVolumes[recentVolumes.length - 1];

    if (latestVolume > avgVolume * 1.5) {
      const priceChange = parseFloat(candles[candles.length - 1].close) - parseFloat(candles[candles.length - 1].open);
      if (priceChange > 0) {
        factors.push('High volume bullish move');
        bullishFactors++;
      } else if (priceChange < 0) {
        factors.push('High volume bearish move');
        bearishFactors++;
      }
    }

    // Price momentum
    const recentPrices = candles.slice(-5).map(c => parseFloat(c.close));
    const priceMovement = recentPrices[recentPrices.length - 1] - recentPrices[0];

    if (Math.abs(priceMovement) > avgVolume * 0.01) {
      if (priceMovement > 0) {
        factors.push('Strong upward price momentum');
        bullishFactors++;
      } else {
        factors.push('Strong downward price momentum');
        bearishFactors++;
      }
    }

    // Trend alignment
    if (technicals.trends.shortTerm === technicals.trends.mediumTerm) {
      if (technicals.trends.shortTerm === 'BULLISH') {
        factors.push('Aligned bullish trends');
        bullishFactors++;
      } else if (technicals.trends.shortTerm === 'BEARISH') {
        factors.push('Aligned bearish trends');
        bearishFactors++;
      }
    } else if (technicals.trends.shortTerm !== 'NEUTRAL' && technicals.trends.mediumTerm !== 'NEUTRAL') {
      // Explicitly handle conflicting trends
      if (technicals.trends.shortTerm === 'BULLISH') {
        factors.push('Bullish short-term vs bearish medium-term');
        bullishFactors += 2; // Make bullish factors higher to avoid NEUTRAL
        bearishFactors++;
      } else {
        factors.push('Bearish short-term vs bullish medium-term');
        bearishFactors += 2; // Make bearish factors higher to avoid NEUTRAL
        bullishFactors++;
      }
    }

    const totalFactors = bullishFactors + bearishFactors;
    const strength = totalFactors > 0 ? Math.max(bullishFactors, bearishFactors) / totalFactors : 0;

    let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    if (bullishFactors > bearishFactors) {
      sentiment = 'BULLISH';
    } else if (bearishFactors > bullishFactors) {
      sentiment = 'BEARISH';
    } else {
      sentiment = 'NEUTRAL';
    }

    return { sentiment, strength, factors };
  }

  private analyzeMarketConditions(candles: any[]): {
    trend: 'TRENDING' | 'RANGING' | 'REVERSING';
    strength: number;
    timeframe: string;
  } {
    const prices = candles.map(c => parseFloat(c.close));
    const priceChanges = prices.slice(1).map((price, i) => price - prices[i]);
    const fundingRates = candles.map(c => parseFloat(c.fundingRate || '0'));
    const openInterest = candles.map(c => parseFloat(c.openInterest || '0'));

    const positiveChanges = priceChanges.filter(change => change > 0).length;
    const negativeChanges = priceChanges.filter(change => change < 0).length;
    const directionality = Math.abs(positiveChanges - negativeChanges) / priceChanges.length;

    const highestPrice = Math.max(...prices);
    const lowestPrice = Math.min(...prices);
    const priceRange = (highestPrice - lowestPrice) / lowestPrice;

    // Analyze futures-specific metrics
    const avgFundingRate = fundingRates.reduce((a, b) => a + b, 0) / fundingRates.length;
    const openInterestTrend = this.calculateOpenInterestTrend(openInterest);

    let trend: 'TRENDING' | 'RANGING' | 'REVERSING';
    let strength: number;

    if (directionality > 0.7 && openInterestTrend === 'increasing') {
      trend = 'TRENDING';
      strength = directionality * (1 + Math.abs(avgFundingRate)); // Amplify strength if funding rate supports trend
    } else if (priceRange < 0.02 && openInterestTrend === 'stable') {
      trend = 'RANGING';
      strength = 1 - priceRange * 10;
    } else {
      trend = 'REVERSING';
      strength = Math.min(priceRange * (1 + Math.abs(avgFundingRate)), 1);
    }

    return { trend, strength, timeframe: `${candles.length} periods` };
  }

  private calculateOpenInterestTrend(openInterest: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (openInterest.length < 2) return 'stable';

    const changes = openInterest.slice(1).map((oi, i) => oi - openInterest[i]);
    const increasingCount = changes.filter(change => change > 0).length;
    const decreasingCount = changes.filter(change => change < 0).length;

    if (increasingCount > decreasingCount * 1.5) return 'increasing';
    if (decreasingCount > increasingCount * 1.5) return 'decreasing';
    return 'stable';
  }

  private calculateOverallSentiment(
    signals: any,
    marketConditions: any,
    useVolatilityAdjustment: boolean
  ): { sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; confidence: number } {
    let sentimentScore = 0;
    let weightSum = 0;

    const weights = {
      technical: 0.4,
      momentum: 0.3,
      marketConditions: 0.3
    };

    // Technical signals
    if (signals.technical.sentiment === 'BULLISH') {
      sentimentScore += weights.technical * signals.technical.strength;
    } else if (signals.technical.sentiment === 'BEARISH') {
      sentimentScore -= weights.technical * signals.technical.strength;
    }
    weightSum += weights.technical;

    // Momentum signals
    if (signals.momentum.sentiment === 'BULLISH') {
      sentimentScore += weights.momentum * signals.momentum.strength;
    } else if (signals.momentum.sentiment === 'BEARISH') {
      sentimentScore -= weights.momentum * signals.momentum.strength;
    }
    weightSum += weights.momentum;

    // Market conditions
    if (marketConditions.trend === 'TRENDING') {
      const trendContribution = marketConditions.strength * weights.marketConditions;
      if (sentimentScore > 0) sentimentScore += trendContribution;
      else if (sentimentScore < 0) sentimentScore -= trendContribution;
      weightSum += weights.marketConditions;
    }

    const normalizedScore = sentimentScore / weightSum;
    let adjustedScore = normalizedScore;

    if (useVolatilityAdjustment && signals.volatility.level === 'HIGH') {
      adjustedScore *= 0.7;
    }

    const confidence = Math.abs(adjustedScore);
    let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';

    if (confidence < 0.2) sentiment = 'NEUTRAL';
    else if (adjustedScore > 0) sentiment = 'BULLISH';
    else sentiment = 'BEARISH';

    return { sentiment, confidence: Math.min(confidence, 1) };
  }

  private generateWarnings(
    signals: any,
    marketConditions: any,
    confidence: number,
    minimumConfidence: number,
    technicals: any
  ): string[] {
    const warnings: string[] = [];

    if (confidence < minimumConfidence) {
      warnings.push(`Low confidence signal (${(confidence * 100).toFixed(1)}%)`);
    }

    if (signals.volatility.level === 'HIGH') {
      warnings.push('High market volatility detected');
      if (signals.volatility.trend === 'INCREASING') {
        warnings.push('Increasing volatility - liquidation risk elevated');
        warnings.push('Consider reducing leverage or position size');
      }
    }

    if (marketConditions.trend === 'REVERSING') {
      warnings.push('Potential trend reversal - monitor liquidation levels');
    } else if (marketConditions.trend === 'RANGING' && marketConditions.strength > 0.8) {
      warnings.push('Strong ranging market - watch for breakout and funding rate changes');
    }

    // First check the original condition
    const hasConflictingSignals =
      signals.technical.sentiment !== signals.momentum.sentiment &&
      signals.technical.sentiment !== 'NEUTRAL' &&
      signals.momentum.sentiment !== 'NEUTRAL';

    // Then check for conflicting trends
    const hasConflictingTrends =
      technicals.trends.shortTerm !== technicals.trends.mediumTerm &&
      technicals.trends.shortTerm !== 'NEUTRAL' &&
      technicals.trends.mediumTerm !== 'NEUTRAL';

    // Add the warning with explicit "conflicting signals" text
    if (hasConflictingSignals || hasConflictingTrends) {
      warnings.push('Detected conflicting signals between technical and momentum indicators - reduce position size');
    }

    return warnings;
  }
}
