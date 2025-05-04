import { BinanceClient, NewFuturesOrder, FuturesOrder, FuturesPositionRisk } from '../core/binance-types';
import { PositionManager } from './position-manager';
import { RiskManagementService } from '../risk/risk-management-service';
import { ValidationError } from '../common/errors';

export interface TradingService {
  createOrder(order: NewFuturesOrder): Promise<FuturesOrder>;
  cancelOrder(orderId: string, symbol: string): Promise<boolean>;
  getOrderStatus(orderId: string, symbol: string): Promise<FuturesOrder>;
  getOpenOrders(symbol?: string): Promise<FuturesOrder[]>;
  getCurrentPosition(symbol: string): Promise<FuturesPositionRisk | null>;
  getPositionRisk(symbol: string): Promise<FuturesPositionRisk>;
  setLeverage(symbol: string, leverage: number): Promise<boolean>;
  setMarginType(symbol: string, marginType: 'ISOLATED' | 'CROSS'): Promise<boolean>;
  getOptimalLeverage(symbol: string, targetRisk: 'LOW' | 'MEDIUM' | 'HIGH'): Promise<any>;
}

export class BinanceTradingService implements TradingService {
  constructor(
    private readonly client: BinanceClient,
    private readonly positionManager: PositionManager,
    private readonly riskManagementService: RiskManagementService
  ) {}

  async createOrder(order: NewFuturesOrder): Promise<FuturesOrder> {
    // Validate order
    this.validateOrder(order);

    // Validate position size
    const isValidSize = await this.positionManager.validatePositionSize(
      order.symbol,
      parseFloat(order.quantity)
    );

    if (!isValidSize) {
      throw new ValidationError('Order size exceeds position limits', 'quantity');
    }

    // Check risk before placing order
    await this.riskManagementService.checkOrderRisk(order);

    // Place the order
    const placedOrder = await this.client.futuresOrder(order);

    // Update position manager
    await this.positionManager.updatePosition(placedOrder);

    return placedOrder;
  }

  async cancelOrder(orderId: string, symbol: string): Promise<boolean> {
    try {
      await this.client.futuresCancelOrder({
        symbol,
        orderId: parseInt(orderId),
      });
      return true;
    } catch (error) {
      console.error('Failed to cancel order:', error);
      return false;
    }
  }

  async getOrderStatus(orderId: string, symbol: string): Promise<FuturesOrder> {
    return await this.client.futuresGetOrder({
      symbol,
      orderId: parseInt(orderId),
    });
  }

  async getOpenOrders(symbol?: string): Promise<FuturesOrder[]> {
    return await this.client.futuresOpenOrders({ symbol });
  }

  async getCurrentPosition(symbol: string): Promise<FuturesPositionRisk | null> {
    const positions = await this.client.futuresPositionRisk({ symbol });
    return positions.find(pos => pos.symbol === symbol) || null;
  }

  async getPositionRisk(symbol: string): Promise<FuturesPositionRisk> {
    const positions = await this.client.futuresPositionRisk({ symbol });
    const position = positions.find(pos => pos.symbol === symbol);

    if (!position) {
      throw new ValidationError(`No position found for symbol ${symbol}`);
    }

    return position;
  }

  async setLeverage(symbol: string, leverage: number): Promise<boolean> {
    if (leverage < 1 || leverage > 125) {
      throw new ValidationError('Leverage must be between 1 and 125', 'leverage');
    }
    return await this.positionManager.setLeverage(symbol, leverage);
  }

  async setMarginType(symbol: string, marginType: 'ISOLATED' | 'CROSS'): Promise<boolean> {
    return await this.positionManager.setMarginType(symbol, marginType);
  }

  async getOptimalLeverage(
    symbol: string,
    targetRisk: 'LOW' | 'MEDIUM' | 'HIGH'
  ): Promise<any> {
    return await this.positionManager.getOptimalLeverage(symbol, targetRisk);
  }

  private validateOrder(order: NewFuturesOrder): void {
    if (!order.symbol) {
      throw new ValidationError('Symbol is required', 'symbol');
    }

    if (!order.side || !['BUY', 'SELL'].includes(order.side)) {
      throw new ValidationError('Invalid order side', 'side', order.side);
    }

    if (!order.type || !['LIMIT', 'MARKET', 'STOP', 'STOP_MARKET', 'TAKE_PROFIT', 'TAKE_PROFIT_MARKET'].includes(order.type)) {
      throw new ValidationError('Invalid order type', 'type', order.type);
    }

    if (!order.quantity || parseFloat(order.quantity) <= 0) {
      throw new ValidationError('Invalid quantity', 'quantity', order.quantity);
    }

    if (order.type === 'LIMIT' && !order.timeInForce) {
      throw new ValidationError('TimeInForce is required for LIMIT orders', 'timeInForce');
    }

    if ((order.type === 'STOP' || order.type === 'TAKE_PROFIT') && !order.stopPrice) {
      throw new ValidationError('Stop price is required for STOP/TAKE_PROFIT orders', 'stopPrice');
    }

    if (order.positionSide && !['BOTH', 'LONG', 'SHORT'].includes(order.positionSide)) {
      throw new ValidationError('Invalid position side', 'positionSide', order.positionSide);
    }
  }
}
