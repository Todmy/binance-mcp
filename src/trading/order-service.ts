import { BinanceClient, FuturesOrder, NewFuturesOrder } from '../core/binance-types';

export interface OrderService {
  createOrder(params: NewFuturesOrder): Promise<FuturesOrder>;
  cancelOrder(symbol: string, orderId: number): Promise<boolean>;
  getOrderStatus(symbol: string, orderId: number): Promise<FuturesOrder>;
  getOpenOrders(symbol?: string): Promise<FuturesOrder[]>;
}

export class BinanceOrderService implements OrderService {
  constructor(private readonly client: BinanceClient) {}

  async createOrder(params: NewFuturesOrder): Promise<FuturesOrder> {
    try {
      return await this.client.futuresOrder(params);
    } catch (error) {
      throw new Error(`Failed to create order: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async cancelOrder(symbol: string, orderId: number): Promise<boolean> {
    try {
      await this.client.futuresCancelOrder({
        symbol,
        orderId
      });
      return true;
    } catch (error) {
      throw new Error(`Failed to cancel order: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getOrderStatus(symbol: string, orderId: number): Promise<FuturesOrder> {
    try {
      return await this.client.futuresGetOrder({
        symbol,
        orderId
      });
    } catch (error) {
      throw new Error(`Failed to get order status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getOpenOrders(symbol?: string): Promise<FuturesOrder[]> {
    try {
      return await this.client.futuresOpenOrders({
        symbol
      });
    } catch (error) {
      throw new Error(`Failed to get open orders: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
