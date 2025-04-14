import { Trade, RiskConfig } from '../../config/types';
import { FuturesOrderParams } from '../../core/binance-types';
import { PositionCalculator } from '../math/position-calculator';
import { PriceCalculator } from '../math/price-calculator';

export class OrderFormatter {
  private positionCalculator: PositionCalculator;
  private priceCalculator: PriceCalculator;

  constructor(private readonly riskConfig: RiskConfig) {
    this.positionCalculator = new PositionCalculator(riskConfig);
    this.priceCalculator = new PriceCalculator();
  }

  /**
   * Format a trade into a Binance futures order
   */
  public formatFuturesOrder(trade: Trade): FuturesOrderParams {
    const baseParams = {
      symbol: trade.symbol,
      side: trade.side,
      quantity: trade.quantity.toString()
    };

    switch (trade.type) {
      case 'LIMIT':
        return this.formatLimitOrder(baseParams, trade);
      case 'STOP_MARKET':
        return this.formatStopMarketOrder(baseParams, trade);
      case 'TAKE_PROFIT_MARKET':
        return this.formatTakeProfitOrder(baseParams, trade);
      default:
        return this.formatMarketOrder(baseParams);
    }
  }

  /**
   * Format order parameters with risk management
   */
  public formatOrderWithRiskManagement(
    orderParams: Partial<Trade>,
    currentPrice: number
  ): FormattedOrderWithRisk {
    const positionSize = this.positionCalculator.calculateRiskAdjustedQuantity(
      currentPrice,
      orderParams.stopLoss || 0,
      this.riskConfig.maxPositionSize * 0.01, // Risk 1% of max position size
      1 // Default leverage
    );

    const takeProfitLevels = orderParams.stopLoss
      ? this.positionCalculator.calculateTakeProfitLevels(
        currentPrice,
        orderParams.stopLoss,
        [2, 3] // Risk:Reward ratios
      )
      : [];

    return {
      orderParams: this.formatFuturesOrder({
        ...orderParams,
        id: '', // Not needed for new orders
        timestamp: Date.now(),
        status: 'PENDING',
        quantity: positionSize.quantity,
        symbol: orderParams.symbol!,
        side: orderParams.side!,
        type: orderParams.type || 'MARKET'
      } as Trade),
      riskMetrics: {
        positionSize: positionSize.positionValue,
        riskPercentage: positionSize.riskPercentage,
        potentialLoss: positionSize.quantity * Math.abs(currentPrice - (orderParams.stopLoss || 0)),
        takeProfitLevels: takeProfitLevels,
        effectiveLeverage: positionSize.effectiveLeverage
      }
    };
  }

  /**
   * Format multiple take profit orders
   */
  public formatTakeProfitOrders(
    baseOrder: Trade,
    levels: number[] = [25, 50, 25]
  ): FormattedTakeProfitOrders {
    if (!baseOrder.takeProfit || !baseOrder.quantity) {
      throw new Error('Take profit price and quantity are required');
    }

    const totalQuantity = baseOrder.quantity;
    let remainingQuantity = totalQuantity;
    const orders: FuturesOrderParams[] = [];

    // Calculate quantities for each level
    levels.forEach((percentage, index) => {
      const levelQuantity = index === levels.length - 1
        ? remainingQuantity
        : (totalQuantity * percentage) / 100;

      remainingQuantity -= levelQuantity;

      if (levelQuantity > 0) {
        orders.push({
          symbol: baseOrder.symbol,
          side: baseOrder.side === 'BUY' ? 'SELL' : 'BUY',
          type: 'TAKE_PROFIT_MARKET',
          quantity: levelQuantity.toString(),
          stopPrice: baseOrder.takeProfit!.toString(),
          reduceOnly: 'true'
        });
      }
    });

    return {
      orders,
      totalQuantity: totalQuantity,
      distributions: levels
    };
  }

  private formatLimitOrder(
    baseParams: Partial<FuturesOrderParams>,
    trade: Trade
  ): FuturesOrderParams {
    return {
      ...baseParams,
      type: 'LIMIT',
      price: trade.price!.toString(),
      timeInForce: trade.timeInForce || 'GTC'
    } as FuturesOrderParams;
  }

  private formatStopMarketOrder(
    baseParams: Partial<FuturesOrderParams>,
    trade: Trade
  ): FuturesOrderParams {
    return {
      ...baseParams,
      type: 'STOP_MARKET',
      stopPrice: trade.stopLoss!.toString(),
      reduceOnly: 'true'
    } as FuturesOrderParams;
  }

  private formatTakeProfitOrder(
    baseParams: Partial<FuturesOrderParams>,
    trade: Trade
  ): FuturesOrderParams {
    return {
      ...baseParams,
      type: 'TAKE_PROFIT_MARKET',
      stopPrice: trade.takeProfit!.toString(),
      reduceOnly: 'true'
    } as FuturesOrderParams;
  }

  private formatMarketOrder(
    baseParams: Partial<FuturesOrderParams>
  ): FuturesOrderParams {
    return {
      ...baseParams,
      type: 'MARKET'
    } as FuturesOrderParams;
  }
}

export interface FormattedOrderWithRisk {
  orderParams: FuturesOrderParams;
  riskMetrics: {
    positionSize: number;
    riskPercentage: number;
    potentialLoss: number;
    takeProfitLevels: {
      ratio: number;
      price: number;
      profitAmount: number;
    }[];
    effectiveLeverage: number;
  };
}

export interface FormattedTakeProfitOrders {
  orders: FuturesOrderParams[];
  totalQuantity: number;
  distributions: number[];
}
