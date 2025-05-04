import { BinanceClient, FuturesOrder } from '../core/binance-types';
import { EventEmitter } from 'events';

export interface OrderHistory {
  orderId: number;
  symbol: string;
  status: string;
  type: string;
  side: string;
  price: string;
  quantity: string;
  executedQuantity: string;
  createdAt: number;
  updatedAt: number;
}

export type OrderUpdateCallback = (update: OrderHistory) => void;

export interface OrderTracker {
  trackOrder(order: FuturesOrder): void;
  updateOrderStatus(orderId: number, status: string): void;
  updateOrderExecution(orderId: number, executedQuantity: string): void;
  getOrder(orderId: number): OrderHistory | undefined;
  getOrderHistory(symbol: string): OrderHistory[];
  subscribeToOrderUpdates(callback: OrderUpdateCallback): void;
}

export class BinanceOrderTracker extends EventEmitter implements OrderTracker {
  private readonly orderHistory: Map<number, OrderHistory> = new Map();
  private readonly subscribers: OrderUpdateCallback[] = [];

  constructor(private readonly client: BinanceClient) {
    super();
  }

  private emitUpdate(data: OrderHistory): boolean {
    try {
      this.subscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in order update subscriber:', error);
        }
      });
      return true;
    } catch (error) {
      console.error('Failed to emit order update:', error);
      return false;
    }
  }

  trackOrder(order: FuturesOrder): void {
    try {
      const orderHistory: OrderHistory = this.createOrderHistory(order);

      this.orderHistory.set(order.orderId, orderHistory);
      this.emitUpdate(orderHistory);
    } catch (error) {
      console.error('Failed to track order:', error);
    }
  }

  updateOrderStatus(orderId: number, status: string): void {
    try {
      const order = this.orderHistory.get(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      const updatedOrder = {
        ...order,
        status,
        updatedAt: Date.now()
      };

      this.orderHistory.set(orderId, updatedOrder);
      this.emitUpdate(updatedOrder);
    } catch (error) {
      throw new Error(`Failed to update order status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getOrderHistory(symbol: string): OrderHistory[] {
    try {
      return Array.from(this.orderHistory.values())
        .filter(order => order.symbol === symbol)
        .sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      throw new Error(`Failed to get order history: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  subscribeToOrderUpdates(callback: OrderUpdateCallback): void {
    try {
      if (!callback || typeof callback !== 'function') {
        throw new Error('Invalid callback provided');
      }
      this.subscribers.push(callback);
    } catch (error) {
      throw new Error(`Failed to subscribe to order updates: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Helper method to check if order exists
  hasOrder(orderId: number): boolean {
    return this.orderHistory.has(orderId);
  }

  // Helper method to get a specific order
  getOrder(orderId: number): OrderHistory | undefined {
    return this.orderHistory.get(orderId);
  }

  // Helper method to update order execution details
  updateOrderExecution(orderId: number, executedQty: string): void {
    const order = this.orderHistory.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    const updatedOrder = {
      ...order,
      executedQuantity: executedQty,
      updatedAt: Date.now()
    };

    this.orderHistory.set(orderId, updatedOrder);
    this.emitUpdate(updatedOrder);
  }

  private createOrderHistory(order: FuturesOrder): OrderHistory {
    return {
      orderId: order.orderId,
      symbol: order.symbol,
      status: order.status,
      type: order.type,
      side: order.side,
      price: order.price,
      quantity: order.origQty,
      executedQuantity: order.executedQty,
      createdAt: order.time,
      updatedAt: order.updateTime || order.time
    };
  }
}
