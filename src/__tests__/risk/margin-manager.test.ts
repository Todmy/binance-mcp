import { BinanceClient, NewFuturesOrder, FuturesAccountBalance, FuturesBookTicker } from '../../core/binance-types';
import type { OrderSide, OrderType, TimeInForce } from 'binance-api-node';
import { MarginManager } from '../../risk/margin-manager';
import { Position } from '../../trading/position-manager';

// Define test constants with type assertions
const TEST_ORDER_SIDE = {
  BUY: 'BUY' as OrderSide,
  SELL: 'SELL' as OrderSide
} as const;

const TEST_ORDER_TYPE = {
  LIMIT: 'LIMIT' as OrderType,
  MARKET: 'MARKET' as OrderType,
  STOP: 'STOP' as OrderType,
  STOP_MARKET: 'STOP_MARKET' as OrderType,
  TAKE_PROFIT: 'TAKE_PROFIT' as OrderType,
  TAKE_PROFIT_MARKET: 'TAKE_PROFIT_MARKET' as OrderType
} as const;

const TEST_TIME_IN_FORCE = {
  GTC: 'GTC' as TimeInForce,
  IOC: 'IOC' as TimeInForce,
  FOK: 'FOK' as TimeInForce
} as const;

// Test constants with type annotations
const TEST_PRICES: Record<string, string> = {
  BTC: '50000',
  ETH: '3000'
};

const createMockOrder = (overrides: Partial<NewFuturesOrder> = {}): NewFuturesOrder => ({
  symbol: 'BTCUSDT',
  side: TEST_ORDER_SIDE.BUY,
  type: TEST_ORDER_TYPE.LIMIT,
  quantity: '1',
  price: TEST_PRICES.BTC,
  timeInForce: TEST_TIME_IN_FORCE.GTC,
  ...overrides
});

const createMockPosition = (overrides: Partial<Position> = {}): Position => ({
  symbol: 'BTCUSDT',
  positionAmount: '0.1',
  entryPrice: TEST_PRICES.BTC,
  markPrice: TEST_PRICES.BTC,
  leverage: 10,
  marginType: 'isolated',
  positionSide: 'BOTH',
  isolatedMargin: '450',
  unrealizedProfit: '50',
  liquidationPrice: '42000',
  ...overrides
});

const createMockBalance = (overrides: Partial<FuturesAccountBalance> = {}): FuturesAccountBalance => ({
  accountAlias: 'test',
  asset: 'USDT',
  balance: '10000',
  crossWalletBalance: '10000',
  crossUnPnl: '0',
  availableBalance: '10000',
  maxWithdrawAmount: '10000',
  marginAvailable: true,
  updateTime: Date.now(),
  ...overrides
});

const createMockBookTicker = (symbol: string, price: string): FuturesBookTicker => ({
  symbol,
  bestBidPrice: price,
  bestBidQty: '1.5',
  bestAskPrice: (parseFloat(price) + 1).toString(),
  bestAskQty: '2.0',
  time: Date.now()
});

// Mock client factory
const createMockClient = (overrides: Partial<BinanceClient> = {}): jest.Mocked<BinanceClient> => ({
  futuresAccountBalance: jest.fn().mockResolvedValue([createMockBalance()]),
  futuresAllBookTickers: jest.fn().mockResolvedValue({
    'BTCUSDT': createMockBookTicker('BTCUSDT', TEST_PRICES.BTC),
    'ETHUSDT': createMockBookTicker('ETHUSDT', TEST_PRICES.ETH)
  }),
  // Required by BinanceClient interface but not used in these tests
  futuresCandles: jest.fn(),
  futures24hr: jest.fn(),
  futuresOrder: jest.fn(),
  futuresCancelOrder: jest.fn(),
  futuresGetOrder: jest.fn(),
  futuresOpenOrders: jest.fn(),
  futuresPositionRisk: jest.fn(),
  futuresDaily: jest.fn(),
  futuresLeverage: jest.fn(),
  futuresMarginType: jest.fn(),
  ...overrides
}) as jest.Mocked<BinanceClient>;

describe('MarginManager', () => {
  let marginManager: MarginManager;
  let mockClient: jest.Mocked<BinanceClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = createMockClient();
    marginManager = new MarginManager(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateMarginRequirements', () => {
    it('should validate margin successfully for a new position', async () => {
      const position = createMockPosition();
      const result = await marginManager.validateMarginRequirements([position]);

      expect(result.isValid).toBe(true);
      expect(result.marginRatio).toBeLessThan(0.8); // MAX_MARGIN_RATIO
      expect(result.warnings).toHaveLength(0);
      expect(result.availableMargin).toBe(10000);
      expect(result.requiredMargin).toBe(500); // 10% of position value (50000 * 0.1)
    });

    it('should validate margin successfully for multiple positions', async () => {
      const positions = [
        createMockPosition(),
        createMockPosition({
          symbol: 'ETHUSDT',
          positionAmount: '5',
          entryPrice: TEST_PRICES.ETH,
          markPrice: TEST_PRICES.ETH
        })
      ];

      const result = await marginManager.validateMarginRequirements(positions);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('High margin usage for ETHUSDT');
      // Calculate the correct expected margin:
      // BTC: 50000 * 0.1 = 5000 * 0.1 (leverage 10%) = 500
      // ETH: 3000 * 5 = 15000 * 0.1 (leverage 10%) = 1500
      // Total: 500 + 1500 = 2000
      expect(result.requiredMargin).toBe(2000);
      expect(result.marginRatio).toBeCloseTo(0.2); // 2000 / 10000
    });

    it('should handle USDT balance not found error', async () => {
      const clientWithNoBalance = createMockClient({
        futuresAccountBalance: jest.fn().mockResolvedValue([])
      });
      marginManager = new MarginManager(clientWithNoBalance);

      await expect(marginManager.validateMarginRequirements([createMockPosition()]))
        .rejects.toThrow('No USDT balance found');
    });

    it('should flag high leverage positions', async () => {
      const highLeveragePosition = createMockPosition({
        leverage: 25,
        symbol: 'BTCUSDT'
      });

      const result = await marginManager.validateMarginRequirements([highLeveragePosition]);

      expect(result.warnings).toContain('High leverage (25x) for BTCUSDT');
      expect(result.isValid).toBe(true); // High leverage alone doesn't invalidate
    });

    it('should handle API errors gracefully', async () => {
      const clientWithError = createMockClient({
        futuresAccountBalance: jest.fn().mockRejectedValue(new Error('API Error'))
      });
      marginManager = new MarginManager(clientWithError);

      await expect(marginManager.validateMarginRequirements([createMockPosition()]))
        .rejects.toThrow('Failed to validate margin requirements: API Error');
    });

    it('should handle positions with different margin types', async () => {
      const positions = [
        createMockPosition(),
        createMockPosition({
          marginType: 'cross',
          symbol: 'ETHUSDT'
        })
      ];

      const result = await marginManager.validateMarginRequirements(positions);
      expect(result.isValid).toBe(true);
      expect(result.marginRatio).toBeLessThan(0.8);
      expect(result.warnings).toEqual(expect.arrayContaining([
        expect.stringMatching(/margin usage/i)
      ]));
    });

    it('should handle cross-margin positions', async () => {
      const crossMarginPosition = createMockPosition({
        marginType: 'cross',
        positionAmount: '1',
        leverage: 5
      });

      const result = await marginManager.validateMarginRequirements([crossMarginPosition]);
      expect(result).toMatchObject({
        isValid: expect.any(Boolean),
        marginRatio: expect.any(Number),
        availableMargin: expect.any(Number),
        requiredMargin: expect.any(Number),
        warnings: expect.arrayContaining([])
      });
    });
  });

  describe('calculateRequiredMargin', () => {
    it('should calculate margin requirements correctly for limit orders', async () => {
      const order = createMockOrder();
      const requirements = await marginManager.calculateRequiredMargin(order);

      const notionalValue = parseFloat(TEST_PRICES.BTC) * parseFloat(order.quantity);
      const expectedInitialMargin = notionalValue * 0.1;
      const expectedMaintenanceMargin = notionalValue * 0.05;

      expect(requirements.initialMargin).toBe(expectedInitialMargin);
      expect(requirements.maintenanceMargin).toBe(expectedMaintenanceMargin);
      expect(requirements.marginRatio).toBe(0.5); // maintenance/initial = 0.5
    });

    it('should handle market orders using current price', async () => {
      const marketOrder = createMockOrder({
        type: TEST_ORDER_TYPE.MARKET,
        quantity: '0.1',
        price: undefined
      });

      const requirements = await marginManager.calculateRequiredMargin(marketOrder);

      const expectedNotional = parseFloat(TEST_PRICES.BTC) * 0.1;
      expect(requirements.initialMargin).toBe(expectedNotional * 0.1);
      expect(requirements.maintenanceMargin).toBe(expectedNotional * 0.05);
      expect(mockClient.futuresAllBookTickers).toHaveBeenCalled();
    });

    it('should throw error for invalid symbol', async () => {
      const invalidOrder = createMockOrder({
        symbol: 'INVALIDPAIR',
        // Remove price so it has to fetch from API
        price: undefined
      });

      // Mock the API to return empty object for the tickers
      mockClient.futuresAllBookTickers.mockResolvedValueOnce({});

      await expect(marginManager.calculateRequiredMargin(invalidOrder))
        .rejects.toThrow('Failed to calculate required margin: No price data available for INVALIDPAIR');
    });

    it('should handle API errors gracefully', async () => {
      const clientWithError = createMockClient({
        futuresAllBookTickers: jest.fn().mockRejectedValue(new Error('API Error'))
      });
      marginManager = new MarginManager(clientWithError);

      const marketOrder = createMockOrder({ type: TEST_ORDER_TYPE.MARKET, price: undefined });

      await expect(marginManager.calculateRequiredMargin(marketOrder))
        .rejects.toThrow('Failed to calculate required margin: API Error');
    });
  });

  describe('calculateMarginImpact', () => {
    it('should calculate margin impact for new orders', async () => {
      const order = createMockOrder();
      const position = createMockPosition();

      const result = await marginManager.calculateMarginImpact(order, [position]);

      const orderNotional = parseFloat(TEST_PRICES.BTC) * parseFloat(order.quantity);
      const positionNotional = parseFloat(position.positionAmount) * parseFloat(position.entryPrice);

      expect(result.availableMargin).toBe(10000);
      expect(result.requiredMargin).toBe((orderNotional + positionNotional) * 0.1);
      expect(result.marginRatio).toBeLessThan(0.8); // Should be within MAX_MARGIN_RATIO
      expect(result.isWithinLimits).toBe(true);
    });

    it('should identify when margin impact exceeds limits', async () => {
      const largeOrder = createMockOrder({ quantity: '100' }); // Large position
      const existingPosition = createMockPosition({ positionAmount: '1' });

      const result = await marginManager.calculateMarginImpact(largeOrder, [existingPosition]);

      expect(result.isWithinLimits).toBe(false);
      expect(result.marginRatio).toBeGreaterThan(0.8); // Should exceed MAX_MARGIN_RATIO
    });

    it('should handle concurrent API calls efficiently', async () => {
      // Force the order to have no price, so we need to fetch it
      const order = createMockOrder({ price: undefined });
      const position = createMockPosition();

      await marginManager.calculateMarginImpact(order, [position]);

      // Both calculateRequiredMargin and validateMarginRequirements should be called once
      expect(mockClient.futuresAccountBalance).toHaveBeenCalledTimes(1);
      expect(mockClient.futuresAllBookTickers).toHaveBeenCalledTimes(1);
    });
  });
});
