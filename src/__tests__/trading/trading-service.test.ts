import { BinanceClient, FuturesOrder, NewFuturesOrder, FuturesPositionRisk } from '../../core/binance-types';
import { OrderSide, OrderType, TimeInForce } from 'binance-api-node';
import { BinanceTradingService } from '../../trading/trading-service';
import { PositionManager, Position } from '../../trading/position-manager';
import { RiskManagementService } from '../../risk/risk-management-service';

describe('BinanceTradingService', () => {
  let tradingService: BinanceTradingService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let mockClient: jest.Mocked<BinanceClient>;
  let mockPositionManager: jest.Mocked<PositionManager>;
  let mockRiskManagement: jest.Mocked<RiskManagementService>;

  beforeEach(() => {
    mockClient = {
      futuresOrder: jest.fn(),
      futuresCancelOrder: jest.fn(),
      futuresGetOrder: jest.fn(),
      futuresOpenOrders: jest.fn(),
      futuresPositionRisk: jest.fn(),
      futuresAccountBalance: jest.fn(),
      futuresCandles: jest.fn(),
      futures24hr: jest.fn(),
      futuresAllBookTickers: jest.fn(),
      futuresMarginType: jest.fn()
    } as unknown as jest.Mocked<BinanceClient>;

    mockPositionManager = {
      getCurrentPosition: jest.fn(),
      getPositionRisk: jest.fn(),
      calculateMaxPosition: jest.fn(),
      validatePositionSize: jest.fn(),
      setLeverage: jest.fn(),
      setMarginType: jest.fn(),
      getOptimalLeverage: jest.fn(),
      updatePosition: jest.fn()
    } as unknown as jest.Mocked<PositionManager>;

    mockRiskManagement = {
      analyzePortfolioRisk: jest.fn(),
      analyzeOrderRisk: jest.fn(),
      checkOrderRisk: jest.fn()
    } as unknown as jest.Mocked<RiskManagementService>;

    tradingService = new BinanceTradingService(
      mockClient,
      mockPositionManager,
      mockRiskManagement
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    it('should create a futures order successfully', async () => {
      const orderParams: NewFuturesOrder = {
        symbol: 'BTCUSDT',
        side: 'BUY' as OrderSide,
        type: 'LIMIT' as OrderType,
        quantity: '1',
        price: '45000',
        timeInForce: 'GTC' as TimeInForce
      };

      mockPositionManager.validatePositionSize.mockResolvedValueOnce(true);
      mockRiskManagement.checkOrderRisk.mockResolvedValueOnce();

      const mockResponse: FuturesOrder = {
        orderId: 1,
        clientOrderId: 'test1',
        symbol: 'BTCUSDT',
        status: 'NEW',
        price: '45000',
        origQty: '1',
        executedQty: '0',
        type: 'LIMIT' as OrderType,
        side: 'BUY' as OrderSide,
        timeInForce: 'GTC' as TimeInForce,
        time: Date.now()
      };

      mockClient.futuresOrder.mockResolvedValueOnce(mockResponse);
      const result = await tradingService.createOrder(orderParams);
      expect(result.orderId).toBe(1);
      expect(result.status).toBe('NEW');
    });
  });

  describe('cancelOrder', () => {
    it('should cancel a futures order successfully', async () => {
      const orderId = '1';
      const symbol = 'BTCUSDT';

      const mockCancelResponse: FuturesOrder = {
        orderId: 1,
        clientOrderId: 'test1',
        symbol,
        status: 'CANCELED',
        price: '45000',
        origQty: '1',
        executedQty: '0',
        type: 'LIMIT' as OrderType,
        side: 'BUY' as OrderSide,
        timeInForce: 'GTC' as TimeInForce,
        time: Date.now()
      };

      mockClient.futuresCancelOrder.mockResolvedValueOnce(mockCancelResponse);
      const result = await tradingService.cancelOrder(orderId, symbol);
      expect(result).toBe(true);
    });
  });

  describe('getOrderStatus', () => {
    it('should get order status successfully', async () => {
      const orderId = '1';
      const symbol = 'BTCUSDT';

      const mockOrderResponse: FuturesOrder = {
        orderId: 1,
        clientOrderId: 'test1',
        symbol,
        status: 'FILLED',
        price: '45000',
        origQty: '1',
        executedQty: '1',
        type: 'LIMIT' as OrderType,
        side: 'BUY' as OrderSide,
        timeInForce: 'GTC' as TimeInForce,
        time: Date.now()
      };

      mockClient.futuresGetOrder.mockResolvedValueOnce(mockOrderResponse);
      const result = await tradingService.getOrderStatus(orderId, symbol);
      expect(result.status).toBe('FILLED');
    });
  });

  describe('getCurrentPosition', () => {
    it('should get current position successfully', async () => {
      const symbol = 'BTCUSDT';
      const mockPos: Position = {
        symbol,
        positionAmount: '1',
        entryPrice: '45000',
        markPrice: '45000',
        leverage: 10,
        marginType: 'isolated',
        positionSide: 'BOTH',
        isolatedMargin: '4500',
        unrealizedProfit: '0',
        liquidationPrice: '40000'
      };

      mockPositionManager.getCurrentPosition.mockResolvedValueOnce(mockPos);
      const result = await tradingService.getCurrentPosition(symbol);
      expect(result).toEqual(mockPos);
    });
  });

  describe('getPositionRisk', () => {
    it('should get position risk information successfully', async () => {
      const symbol = 'BTCUSDT';

      const mockPositionRisk: FuturesPositionRisk = {
        symbol,
        entryPrice: '45000',
        markPrice: '44000',
        liquidationPrice: '40000',
        unRealizedProfit: '-1000',
        leverage: '10',
        marginType: 'isolated',
        isolatedMargin: '4500',
        positionSide: 'BOTH',
        positionAmount: '1',
        notional: '44000',
        isolatedWallet: '4500',
        isAutoAddMargin: 'false',
        updateTime: Date.now()
      };

      mockPositionManager.getPositionRisk.mockResolvedValueOnce(mockPositionRisk);
      const result = await tradingService.getPositionRisk(symbol);
      expect(result).toEqual(mockPositionRisk);
    });
  });

  describe('setMarginType', () => {
    it('should set margin type successfully', async () => {
      mockClient.futuresMarginType.mockResolvedValueOnce({ code: 200, msg: 'success' });
      const result = await tradingService.setMarginType('BTCUSDT', 'ISOLATED');
      expect(result).toBe(true);
      expect(mockClient.futuresMarginType).toHaveBeenCalledWith({
        symbol: 'BTCUSDT',
        marginType: 'ISOLATED'
      });
    });

    it('should handle margin type setting errors', async () => {
      mockClient.futuresMarginType.mockRejectedValueOnce(new Error('Invalid margin type'));
      await expect(tradingService.setMarginType('BTCUSDT', 'ISOLATED'))
        .rejects.toThrow('Failed to set margin type');
    });
  });

  describe('error handling', () => {
    it('should handle validation errors for invalid orders', async () => {
      const invalidOrder: NewFuturesOrder = {
        symbol: 'BTCUSDT',
        side: 'BUY' as OrderSide,
        type: 'STOP' as OrderType,
        quantity: '1',
        price: '45000',
        timeInForce: 'GTC' as TimeInForce
      };

      await expect(tradingService.createOrder(invalidOrder))
        .rejects.toThrow('Stop price is required');
    });

    it('should handle position limit errors', async () => {
      const orderParams: NewFuturesOrder = {
        symbol: 'BTCUSDT',
        side: 'BUY' as OrderSide,
        type: 'LIMIT' as OrderType,
        quantity: '1',
        price: '45000',
        timeInForce: 'GTC' as TimeInForce
      };

      mockPositionManager.validatePositionSize.mockResolvedValueOnce(false);
      await expect(tradingService.createOrder(orderParams))
        .rejects.toThrow('position limits');
    });

    it('should handle API errors gracefully', async () => {
      mockClient.futuresOrder.mockRejectedValueOnce(new Error('API Error'));

      const orderParams: NewFuturesOrder = {
        symbol: 'BTCUSDT',
        side: 'BUY' as OrderSide,
        type: 'LIMIT' as OrderType,
        quantity: '1',
        price: '45000',
        timeInForce: 'GTC' as TimeInForce
      };

      await expect(tradingService.createOrder(orderParams))
        .rejects.toThrow('Failed to create order');
    });
  });
});
