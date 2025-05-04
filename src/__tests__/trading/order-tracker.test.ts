import { BinanceClient, FuturesOrder } from '../../core/binance-types';
import { OrderSide, OrderType, TimeInForce } from 'binance-api-node';
import { BinanceOrderTracker, OrderHistory } from '../../trading/order-tracker';

const mockOrder: FuturesOrder = {
  symbol: 'BTCUSDT',
  orderId: 1,
  clientOrderId: 'test1',
  price: '50000',
  origQty: '1',
  executedQty: '0',
  status: 'NEW',
  timeInForce: TimeInForce.GTC,
  type: OrderType.LIMIT,
  side: OrderSide.BUY,
  time: Date.now()
};

const mockClient = {
  futuresOrder: jest.fn().mockResolvedValue(mockOrder),
  futuresCancelOrder: jest.fn().mockResolvedValue(mockOrder),
  futuresGetOrder: jest.fn().mockResolvedValue(mockOrder),
  futuresOpenOrders: jest.fn().mockResolvedValue([mockOrder]),
  futuresAllBookTickers: jest.fn(),
  futuresCandles: jest.fn(),
  futures24hr: jest.fn(),
  futuresPositionRisk: jest.fn(),
  futuresAccountBalance: jest.fn()
} as unknown as jest.Mocked<BinanceClient>;

describe('BinanceOrderTracker', () => {
  let orderTracker: BinanceOrderTracker;

  beforeEach(() => {
    orderTracker = new BinanceOrderTracker(mockClient);
    jest.clearAllMocks();
  });

  describe('trackOrder', () => {
    it('should track a new order', () => {
      const expectedHistory: OrderHistory = {
        orderId: mockOrder.orderId,
        symbol: mockOrder.symbol,
        status: mockOrder.status,
        type: mockOrder.type,
        side: mockOrder.side,
        price: mockOrder.price,
        quantity: mockOrder.origQty,
        executedQuantity: mockOrder.executedQty,
        createdAt: mockOrder.time,
        updatedAt: mockOrder.time
      };

      orderTracker.trackOrder(mockOrder);
      expect(orderTracker.getOrder(mockOrder.orderId)).toEqual(expectedHistory);
    });

    it('should update existing order status', () => {
      const callback = jest.fn();
      orderTracker.subscribeToOrderUpdates(callback);

      // First track the order
      orderTracker.trackOrder(mockOrder);

      // Then update its status
      const updatedStatus: FuturesOrder['status'] = 'FILLED';
      orderTracker.updateOrderStatus(mockOrder.orderId, updatedStatus);

      const lastCall = callback.mock.calls[callback.mock.calls.length - 1][0];
      expect(lastCall.status).toBe(updatedStatus);
      expect(orderTracker.getOrder(mockOrder.orderId)?.status).toBe(updatedStatus);
    });

    it('should handle order execution updates', () => {
      const callback = jest.fn();
      orderTracker.subscribeToOrderUpdates(callback);

      // Track initial order
      orderTracker.trackOrder(mockOrder);

      // Update executed quantity
      const executedQty = '0.5';
      orderTracker.updateOrderExecution(mockOrder.orderId, executedQty);

      const lastCall = callback.mock.calls[callback.mock.calls.length - 1][0];
      expect(lastCall.executedQuantity).toBe(executedQty);
      expect(orderTracker.getOrder(mockOrder.orderId)?.executedQuantity).toBe(executedQty);
    });
  });

  describe('getOrderHistory', () => {
    it('should return order history for a symbol', () => {
      const orders = [
        { ...mockOrder, orderId: 1, symbol: 'BTCUSDT' },
        { ...mockOrder, orderId: 2, symbol: 'ETHUSDT' },
        { ...mockOrder, orderId: 3, symbol: 'BTCUSDT' }
      ];

      orders.forEach(order => orderTracker.trackOrder(order));

      const btcHistory = orderTracker.getOrderHistory('BTCUSDT');
      expect(btcHistory).toHaveLength(2);
      expect(btcHistory.every(order => order.symbol === 'BTCUSDT')).toBe(true);
    });

    it('should sort order history by creation time', () => {
      const now = Date.now();
      const orders = [
        { ...mockOrder, orderId: 1, time: now },
        { ...mockOrder, orderId: 2, time: now + 1000 },
        { ...mockOrder, orderId: 3, time: now + 2000 }
      ];

      orders.forEach(order => orderTracker.trackOrder(order));

      const history = orderTracker.getOrderHistory('BTCUSDT');
      expect(history[0].orderId).toBe(3); // Most recent first
      expect(history[2].orderId).toBe(1); // Oldest last
    });
  });

  describe('subscribeToOrderUpdates', () => {
    it('should notify subscribers of order updates', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      orderTracker.subscribeToOrderUpdates(callback1);
      orderTracker.subscribeToOrderUpdates(callback2);

      orderTracker.trackOrder(mockOrder);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();

      const update = callback1.mock.calls[0][0];
      expect(update).toMatchObject({
        orderId: mockOrder.orderId,
        symbol: mockOrder.symbol,
        status: mockOrder.status
      });
    });

    it('should handle errors in subscribers', () => {
      const errorCallback = jest.fn(() => { throw new Error('Subscriber error'); });
      const validCallback = jest.fn();

      orderTracker.subscribeToOrderUpdates(errorCallback);
      orderTracker.subscribeToOrderUpdates(validCallback);

      expect(() => orderTracker.trackOrder(mockOrder)).not.toThrow();
      expect(validCallback).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle order not found error', () => {
      expect(() => orderTracker.updateOrderStatus(999, 'FILLED')).toThrow('Order 999 not found');
    });

    it('should handle update execution error', () => {
      expect(() => orderTracker.updateOrderExecution(999, '1')).toThrow('Order 999 not found');
    });
  });

  describe('order history management', () => {
    it('should cleanup old order history', () => {
      const oldOrder = {
        ...mockOrder,
        orderId: 1,
        time: Date.now() - (30 * 24 * 60 * 60 * 1000) // 30 days old
      };

      const recentOrder = {
        ...mockOrder,
        orderId: 2,
        time: Date.now() - (5 * 24 * 60 * 60 * 1000) // 5 days old
      };

      orderTracker.trackOrder(oldOrder);
      orderTracker.trackOrder(recentOrder);
      orderTracker.cleanupOldHistory(7); // 7 days retention

      const history = orderTracker.getOrderHistory('BTCUSDT');
      expect(history).toHaveLength(1);
      expect(history[0].orderId).toBe(2);
    });

    it('should maintain order update sequence', () => {
      const order = { ...mockOrder, orderId: 1 };
      const updates = [
        { status: 'NEW', executedQty: '0' },
        { status: 'PARTIALLY_FILLED', executedQty: '0.5' },
        { status: 'FILLED', executedQty: '1' }
      ];

      orderTracker.trackOrder(order);

      // Apply updates out of order
      orderTracker.updateOrderStatus(1, updates[2].status);
      orderTracker.updateOrderExecution(1, updates[1].executedQty);
      orderTracker.updateOrderStatus(1, updates[0].status);

      const orderHistory = orderTracker.getOrder(1);
      expect(orderHistory?.status).toBe('FILLED');
      expect(orderHistory?.executedQuantity).toBe('1');
    });
  });

  describe('concurrent order updates', () => {
    it('should handle multiple rapid order updates', async () => {
      const order = { ...mockOrder, orderId: 1 };
      const callback = jest.fn();
      orderTracker.subscribeToOrderUpdates(callback);
      orderTracker.trackOrder(order);

      // Simulate rapid concurrent updates
      await Promise.all([
        orderTracker.updateOrderStatus(1, 'NEW'),
        orderTracker.updateOrderExecution(1, '0.3'),
        orderTracker.updateOrderStatus(1, 'PARTIALLY_FILLED'),
        orderTracker.updateOrderExecution(1, '0.7'),
        orderTracker.updateOrderStatus(1, 'FILLED')
      ]);

      const finalOrder = orderTracker.getOrder(1);
      expect(finalOrder?.status).toBe('FILLED');
      expect(finalOrder?.executedQuantity).toBe('0.7');
      expect(callback).toHaveBeenCalledTimes(6); // Initial + 5 updates
    });

    it('should maintain update order for multiple orders', async () => {
      const orders = [
        { ...mockOrder, orderId: 1 },
        { ...mockOrder, orderId: 2 }
      ];

      orders.forEach(order => orderTracker.trackOrder(order));

      // Simulate interleaved updates
      await Promise.all([
        orderTracker.updateOrderStatus(1, 'PARTIALLY_FILLED'),
        orderTracker.updateOrderStatus(2, 'NEW'),
        orderTracker.updateOrderExecution(1, '0.5'),
        orderTracker.updateOrderExecution(2, '0.3'),
        orderTracker.updateOrderStatus(1, 'FILLED'),
        orderTracker.updateOrderStatus(2, 'PARTIALLY_FILLED')
      ]);

      const order1 = orderTracker.getOrder(1);
      const order2 = orderTracker.getOrder(2);

      expect(order1?.status).toBe('FILLED');
      expect(order1?.executedQuantity).toBe('0.5');
      expect(order2?.status).toBe('PARTIALLY_FILLED');
      expect(order2?.executedQuantity).toBe('0.3');
    });
  });
});
