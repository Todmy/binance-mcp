import { BinanceClient, FuturesOrder, NewFuturesOrder } from '../../core/binance-types';
import { OrderSide, OrderType, TimeInForce } from 'binance-api-node';
import { BinanceOrderService } from '../../trading/order-service';

const mockOrder: FuturesOrder = {
  symbol: 'BTCUSDT',
  orderId: 1,
  clientOrderId: 'test1',
  price: '50000',
  origQty: '1',
  executedQty: '0',
  status: 'NEW',
  timeInForce: 'GTC' as TimeInForce,
  type: 'LIMIT' as OrderType,
  side: 'BUY' as OrderSide,
  time: Date.now()
};

const mockClient: jest.Mocked<BinanceClient> = {
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

describe('BinanceOrderService', () => {
  let orderService: BinanceOrderService;

  beforeEach(() => {
    orderService = new BinanceOrderService(mockClient);
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    it('should create an order successfully', async () => {
      const orderParams: NewFuturesOrder = {
        symbol: 'BTCUSDT',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        quantity: '1',
        price: '50000'
      };

      const result = await orderService.createOrder(orderParams);
      expect(result).toEqual(mockOrder);
      expect(mockClient.futuresOrder).toHaveBeenCalledWith(orderParams);
    });

    it('should handle order creation error', async () => {
      const error = new Error('Order creation failed');
      mockClient.futuresOrder.mockRejectedValueOnce(error);

      const orderParams: NewFuturesOrder = {
        symbol: 'BTCUSDT',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        quantity: '1',
        price: '50000'
      };

      await expect(orderService.createOrder(orderParams)).rejects.toThrow('Failed to create order: Order creation failed');
    });

    describe('order type validation', () => {
      it('should create STOP_LIMIT order successfully', async () => {
        const orderParams: NewFuturesOrder = {
          symbol: 'BTCUSDT',
          side: OrderSide.BUY,
          type: OrderType.STOP_LOSS_LIMIT,
          quantity: '1',
          price: '50000',
          stopPrice: '49000',
          timeInForce: 'GTC' as TimeInForce
        };

        mockClient.futuresOrder.mockResolvedValueOnce({
          ...mockOrder,
          type: OrderType.STOP_LOSS_LIMIT,
          stopPrice: '49000'
        });

        const result = await orderService.createOrder(orderParams);
        expect(result.type).toBe('STOP_LIMIT');
        expect(result.stopPrice).toBe('49000');
      });

      it('should create TAKE_PROFIT_MARKET order successfully', async () => {
        const orderParams: NewFuturesOrder = {
          symbol: 'BTCUSDT',
          side: OrderSide.SELL,
          type: OrderType.TAKE_PROFIT_MARKET,
          quantity: '1',
          stopPrice: '51000'
        };

        mockClient.futuresOrder.mockResolvedValueOnce({
          ...mockOrder,
          type: OrderType.TAKE_PROFIT_MARKET,
          stopPrice: '51000',
          side: OrderSide.SELL
        });

        const result = await orderService.createOrder(orderParams);
        expect(result.type).toBe('TAKE_PROFIT_MARKET');
        expect(result.stopPrice).toBe('51000');
      });

      it('should validate time in force for different order types', async () => {
        const orderParams: NewFuturesOrder = {
          symbol: 'BTCUSDT',
          side: OrderSide.BUY,
          type: OrderType.LIMIT,
          quantity: '1',
          price: '50000',
          timeInForce: 'IOC' as TimeInForce
        };

        mockClient.futuresOrder.mockResolvedValueOnce({
          ...mockOrder,
          timeInForce: 'IOC' as TimeInForce
        });

        const result = await orderService.createOrder(orderParams);
        expect(result.timeInForce).toBe('IOC');
      });
    });
  });

  describe('cancelOrder', () => {
    it('should cancel an order successfully', async () => {
      const result = await orderService.cancelOrder('BTCUSDT', 1);
      expect(result).toBe(true);
      expect(mockClient.futuresCancelOrder).toHaveBeenCalledWith({
        symbol: 'BTCUSDT',
        orderId: 1
      });
    });

    it('should handle cancel order error', async () => {
      const error = new Error('Cancel order failed');
      mockClient.futuresCancelOrder.mockRejectedValueOnce(error);

      await expect(orderService.cancelOrder('BTCUSDT', 1)).rejects.toThrow('Failed to cancel order: Cancel order failed');
    });
  });

  describe('getOrderStatus', () => {
    it('should get order status successfully', async () => {
      const result = await orderService.getOrderStatus('BTCUSDT', 1);
      expect(result).toEqual(mockOrder);
      expect(mockClient.futuresGetOrder).toHaveBeenCalledWith({
        symbol: 'BTCUSDT',
        orderId: 1
      });
    });

    it('should handle get order status error', async () => {
      const error = new Error('Get order status failed');
      mockClient.futuresGetOrder.mockRejectedValueOnce(error);

      await expect(orderService.getOrderStatus('BTCUSDT', 1)).rejects.toThrow('Failed to get order status: Get order status failed');
    });
  });

  describe('getOpenOrders', () => {
    it('should get open orders successfully', async () => {
      const result = await orderService.getOpenOrders('BTCUSDT');
      expect(result).toEqual([mockOrder]);
      expect(mockClient.futuresOpenOrders).toHaveBeenCalledWith({
        symbol: 'BTCUSDT'
      });
    });

    it('should get all open orders when symbol is not provided', async () => {
      const result = await orderService.getOpenOrders();
      expect(result).toEqual([mockOrder]);
      expect(mockClient.futuresOpenOrders).toHaveBeenCalledWith({
        symbol: undefined
      });
    });

    it('should handle get open orders error', async () => {
      const error = new Error('Get open orders failed');
      mockClient.futuresOpenOrders.mockRejectedValueOnce(error);

      await expect(orderService.getOpenOrders('BTCUSDT')).rejects.toThrow('Failed to get open orders: Get open orders failed');
    });
  });
});
