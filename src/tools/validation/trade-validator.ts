import { Trade, RiskConfig } from '../../config/types';
import { ValidationResult } from './config-validator';

export class TradeValidator {
  constructor(private readonly riskConfig: RiskConfig) {}

  public validateTrade(trade: Trade, currentPrice: number): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: []
    };

    // Validate required fields
    this.validateRequiredFields(trade, result);

    // Validate trade type specific fields
    this.validateTradeTypeFields(trade, result);

    // Validate position size
    this.validatePositionSize(trade, currentPrice, result);

    // Validate stop loss and take profit
    this.validateStopLossAndTakeProfit(trade, currentPrice, result);

    // Validate price deviation
    this.validatePriceDeviation(trade, currentPrice, result);

    return result;
  }

  private validateRequiredFields(trade: Trade, result: ValidationResult): void {
    const requiredFields = ['symbol', 'side', 'type', 'quantity'];
    for (const field of requiredFields) {
      if (!(field in trade)) {
        result.isValid = false;
        result.errors.push(`Missing required field: ${field}`);
      }
    }

    if (trade.side !== 'BUY' && trade.side !== 'SELL') {
      result.isValid = false;
      result.errors.push('Invalid trade side: must be BUY or SELL');
    }

    const validTypes = ['MARKET', 'LIMIT', 'STOP_MARKET', 'TAKE_PROFIT_MARKET'];
    if (!validTypes.includes(trade.type)) {
      result.isValid = false;
      result.errors.push(`Invalid trade type: must be one of ${validTypes.join(', ')}`);
    }
  }

  private validateTradeTypeFields(trade: Trade, result: ValidationResult): void {
    if (trade.type === 'LIMIT' && !trade.price) {
      result.isValid = false;
      result.errors.push('LIMIT orders require a price');
    }

    if (trade.type === 'STOP_MARKET' && !trade.stopLoss) {
      result.isValid = false;
      result.errors.push('STOP_MARKET orders require a stop loss price');
    }

    if (trade.type === 'TAKE_PROFIT_MARKET' && !trade.takeProfit) {
      result.isValid = false;
      result.errors.push('TAKE_PROFIT_MARKET orders require a take profit price');
    }

    if (trade.timeInForce && !['GTC', 'IOC', 'FOK'].includes(trade.timeInForce)) {
      result.isValid = false;
      result.errors.push('Invalid timeInForce: must be GTC, IOC, or FOK');
    }
  }

  private validatePositionSize(trade: Trade, currentPrice: number, result: ValidationResult): void {
    const positionValue = trade.quantity * currentPrice;

    if (positionValue > this.riskConfig.maxPositionSize) {
      result.isValid = false;
      result.errors.push(`Position size ${positionValue} exceeds maximum allowed ${this.riskConfig.maxPositionSize}`);
    }

    if (trade.quantity <= 0) {
      result.isValid = false;
      result.errors.push('Quantity must be greater than 0');
    }
  }

  private validateStopLossAndTakeProfit(
    trade: Trade,
    currentPrice: number,
    result: ValidationResult
  ): void {
    if (trade.stopLoss) {
      const stopLossPercentage = this.calculateStopLossPercentage(
        trade.side,
        currentPrice,
        trade.stopLoss
      );

      if (stopLossPercentage > this.riskConfig.stopLossPercentage) {
        result.isValid = false;
        result.errors.push(
          `Stop loss percentage ${(stopLossPercentage * 100).toFixed(2)}% exceeds maximum allowed ${(this.riskConfig.stopLossPercentage * 100).toFixed(2)
          }%`
        );
      }

      if (trade.side === 'BUY' && trade.stopLoss >= currentPrice) {
        result.isValid = false;
        result.errors.push('Stop loss must be below current price for buy orders');
      } else if (trade.side === 'SELL' && trade.stopLoss <= currentPrice) {
        result.isValid = false;
        result.errors.push('Stop loss must be above current price for sell orders');
      }
    }

    if (trade.takeProfit) {
      if (trade.side === 'BUY' && trade.takeProfit <= currentPrice) {
        result.isValid = false;
        result.errors.push('Take profit must be above current price for buy orders');
      } else if (trade.side === 'SELL' && trade.takeProfit >= currentPrice) {
        result.isValid = false;
        result.errors.push('Take profit must be below current price for sell orders');
      }
    }
  }

  private validatePriceDeviation(trade: Trade, currentPrice: number, result: ValidationResult): void {
    if (trade.type === 'LIMIT' && trade.price) {
      const priceDeviation = Math.abs(trade.price - currentPrice) / currentPrice;

      if (priceDeviation > this.riskConfig.priceDeviationLimit) {
        result.isValid = false;
        result.errors.push(
          `Price deviation ${(priceDeviation * 100).toFixed(2)}% exceeds maximum allowed ${(this.riskConfig.priceDeviationLimit * 100).toFixed(2)
          }%`
        );
      }
    }
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
}
