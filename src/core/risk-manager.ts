import { RiskConfig, Trade, RiskAssessment } from '../config/types';

export class RiskManager {
  private readonly riskConfig: RiskConfig;
  private dailyTradeVolume: number = 0;
  private dailyLoss: number = 0;
  private resetTime: number;

  constructor(config: RiskConfig) {
    this.riskConfig = config;
    this.resetTime = this.getNextResetTime();
  }

  public async validateTrade(trade: Trade, currentPrice: number): Promise<RiskAssessment> {
    const assessment: RiskAssessment = {
      isValid: true,
      reasons: [],
      suggestions: {}
    };

    // Check if we need to reset daily counters
    if (Date.now() >= this.resetTime) {
      this.resetDailyCounters();
    }

    // Validate position size
    const positionValue = trade.quantity * currentPrice;
    if (positionValue > this.riskConfig.maxPositionSize && assessment.suggestions) {
      assessment.isValid = false;
      assessment.reasons.push('Position size exceeds maximum allowed');
      assessment.suggestions.maxQuantity = this.riskConfig.maxPositionSize / currentPrice;
    }

    // Calculate and validate potential loss
    const potentialLoss = this.calculatePotentialLoss(trade, currentPrice);
    if (this.dailyLoss + potentialLoss > this.riskConfig.dailyLossLimit) {
      assessment.isValid = false;
      assessment.reasons.push('Trade could exceed daily loss limit');
    }

    // Validate stop loss
    if (!trade.stopLoss && assessment.suggestions) {
      assessment.isValid = false;
      assessment.reasons.push('Stop loss is required');
      assessment.suggestions.recommendedStopLoss = this.calculateRecommendedStopLoss(
        trade.side,
        currentPrice
      );
    } else if (trade.stopLoss) {
      const stopLossPercentage = this.calculateStopLossPercentage(
        trade.side,
        currentPrice,
        trade.stopLoss
      );

      if (stopLossPercentage > this.riskConfig.stopLossPercentage && assessment.suggestions) {
        assessment.isValid = false;
        assessment.reasons.push('Stop loss percentage exceeds maximum allowed');
        assessment.suggestions.recommendedStopLoss = this.calculateRecommendedStopLoss(
          trade.side,
          currentPrice
        );
      }
    }

    // Suggest take profit if not set
    if (!trade.takeProfit && assessment.suggestions && assessment.suggestions.recommendedStopLoss) {
      assessment.suggestions.recommendedTakeProfit = this.calculateRecommendedTakeProfit(
        trade.side,
        currentPrice,
        trade.stopLoss || assessment.suggestions.recommendedStopLoss
      );
    }

    return assessment;
  }

  private calculatePotentialLoss(trade: Trade, currentPrice: number): number {
    const stopLoss = trade.stopLoss || currentPrice * (1 - this.riskConfig.stopLossPercentage);
    return Math.abs(trade.quantity * (currentPrice - stopLoss));
  }

  private calculateStopLossPercentage(
    side: 'BUY' | 'SELL',
    currentPrice: number,
    stopLossPrice: number
  ): number {
    return side === 'BUY'
      ? (currentPrice - stopLossPrice) / currentPrice
      : (stopLossPrice - currentPrice) / currentPrice;
  }

  private calculateRecommendedStopLoss(side: 'BUY' | 'SELL', currentPrice: number): number {
    const percentage = this.riskConfig.stopLossPercentage;
    return side === 'BUY'
      ? currentPrice * (1 - percentage)
      : currentPrice * (1 + percentage);
  }

  private calculateRecommendedTakeProfit(
    side: 'BUY' | 'SELL',
    currentPrice: number,
    stopLossPrice: number
  ): number {
    const riskAmount = Math.abs(currentPrice - stopLossPrice);
    // Aim for 2:1 reward-to-risk ratio
    return side === 'BUY'
      ? currentPrice + (riskAmount * 2)
      : currentPrice - (riskAmount * 2);
  }

  private getNextResetTime(): number {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime();
  }

  private resetDailyCounters(): void {
    this.dailyTradeVolume = 0;
    this.dailyLoss = 0;
    this.resetTime = this.getNextResetTime();
  }

  public updateDailyStats(tradeVolume: number, tradePnL: number): void {
    this.dailyTradeVolume += tradeVolume;
    if (tradePnL < 0) {
      this.dailyLoss += Math.abs(tradePnL);
    }
  }
}

// Example usage:
// const riskConfig: RiskConfig = {
//   maxPositionSize: 10000,
//   maxLeverage: 20,
//   stopLossPercentage: 0.02,
//   dailyLossLimit: 1000,
//   priceDeviationLimit: 0.05
// };
// const riskManager = new RiskManager(riskConfig);
