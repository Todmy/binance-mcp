import { RiskConfig } from '../../config/types';

export class PositionCalculator {
  constructor(private readonly riskConfig: RiskConfig) {}

  /**
   * Calculate the maximum position size based on risk parameters
   */
  public calculateMaxPositionSize(currentPrice: number, leverage: number): number {
    const maxLeverage = Math.min(leverage, this.riskConfig.maxLeverage);
    return Math.min(
      this.riskConfig.maxPositionSize,
      this.riskConfig.maxPositionSize * maxLeverage
    );
  }

  /**
   * Calculate optimal position size based on risk per trade
   */
  public calculateRiskAdjustedQuantity(
    currentPrice: number,
    stopLossPrice: number,
    riskAmount: number,
    leverage: number = 1
  ): PositionSizeResult {
    const riskPerUnit = Math.abs(currentPrice - stopLossPrice);
    if (riskPerUnit === 0) {
      return {
        quantity: 0,
        positionValue: 0,
        effectiveLeverage: 0,
        riskPercentage: 0,
        errors: ['Invalid stop loss: must be different from entry price']
      };
    }

    // Calculate base quantity from risk amount
    let quantity = riskAmount / riskPerUnit;

    // Calculate position value
    const positionValue = quantity * currentPrice;

    // Check against maximum position size with leverage
    const maxPositionSize = this.calculateMaxPositionSize(currentPrice, leverage);
    const errors: string[] = [];

    if (positionValue > maxPositionSize) {
      quantity = maxPositionSize / currentPrice;
      errors.push('Position size reduced to meet maximum allowed size');
    }

    // Calculate effective risk percentage
    const adjustedPositionValue = quantity * currentPrice;
    const potentialLoss = quantity * riskPerUnit;
    const riskPercentage = (potentialLoss / adjustedPositionValue) * 100;

    // Validate against risk config
    if (riskPercentage > this.riskConfig.stopLossPercentage * 100) {
      errors.push('Warning: Risk percentage exceeds recommended maximum');
    }

    return {
      quantity: this.roundToLotSize(quantity),
      positionValue: adjustedPositionValue,
      effectiveLeverage: leverage,
      riskPercentage,
      errors
    };
  }

  /**
   * Calculate position size based on a percentage of available capital
   */
  public calculatePositionSizeByCapital(
    currentPrice: number,
    capitalPercentage: number,
    availableCapital: number,
    leverage: number = 1
  ): PositionSizeResult {
    if (capitalPercentage <= 0 || capitalPercentage > 100) {
      return {
        quantity: 0,
        positionValue: 0,
        effectiveLeverage: 0,
        riskPercentage: 0,
        errors: ['Invalid capital percentage: must be between 0 and 100']
      };
    }

    const targetPositionValue = (availableCapital * capitalPercentage) / 100;
    const effectiveLeverage = Math.min(leverage, this.riskConfig.maxLeverage);
    const maxPositionSize = this.calculateMaxPositionSize(currentPrice, effectiveLeverage);
    const errors: string[] = [];

    let positionValue = Math.min(targetPositionValue * effectiveLeverage, maxPositionSize);
    let quantity = positionValue / currentPrice;

    if (positionValue > maxPositionSize) {
      positionValue = maxPositionSize;
      quantity = positionValue / currentPrice;
      errors.push('Position size reduced to meet maximum allowed size');
    }

    return {
      quantity: this.roundToLotSize(quantity),
      positionValue,
      effectiveLeverage,
      riskPercentage: (capitalPercentage * effectiveLeverage) / 100,
      errors
    };
  }

  /**
   * Calculate optimal take profit levels based on risk/reward ratios
   */
  public calculateTakeProfitLevels(
    entryPrice: number,
    stopLossPrice: number,
    riskRewardRatios: number[] = [2, 3]
  ): TakeProfitLevel[] {
    const riskAmount = Math.abs(entryPrice - stopLossPrice);

    return riskRewardRatios.map(ratio => ({
      ratio,
      price: entryPrice > stopLossPrice
        ? entryPrice + (riskAmount * ratio)
        : entryPrice - (riskAmount * ratio),
      profitAmount: riskAmount * ratio
    }));
  }

  /**
   * Round quantity to valid lot size (implement based on exchange requirements)
   */
  private roundToLotSize(quantity: number, lotSize: number = 0.001): number {
    return Math.floor(quantity / lotSize) * lotSize;
  }
}

export interface PositionSizeResult {
  quantity: number;
  positionValue: number;
  effectiveLeverage: number;
  riskPercentage: number;
  errors: string[];
}

export interface TakeProfitLevel {
  ratio: number;
  price: number;
  profitAmount: number;
}
