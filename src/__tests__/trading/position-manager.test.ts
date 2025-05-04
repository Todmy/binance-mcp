import { BinanceClient, FuturesPositionRisk, FuturesOrder } from '../../core/binance-types';
import { BinancePositionManager } from '../../trading/position-manager';
import { RiskCalculator } from '../../risk/risk-calculator';

const mockPositionRisk: FuturesPositionRisk = {
  symbol: 'BTCUSDT',
  positionAmount: '1',
  entryPrice: '50000',
  markPrice: '51000',
  unRealizedProfit: '1000',
  liquidationPrice: '45000',
  leverage: '10',
  marginType: 'isolated',
  isolatedMargin: '5000',
  isAutoAddMargin: 'false',
  positionSide: 'BOTH',
  notional: '50000',
  isolatedWallet: '5000',
  updateTime: Date.now()
};

const mockClient: jest.Mocked<BinanceClient> = {
  futuresPositionRisk: jest.fn().mockResolvedValue([mockPositionRisk]),
  futuresAccountBalance: jest.fn().mockResolvedValue([{
    accountAlias: 'test',
    asset: 'USDT',
    balance: '10000',
    crossWalletBalance: '10000',
    crossUnPnl: '0',
    availableBalance: '10000',
    maxWithdrawAmount: '10000',
    marginAvailable: true,
    updateTime: Date.now()
  }]),
  futures24hr: jest.fn().mockResolvedValue([{
    symbol: 'BTCUSDT',
    priceChange: '1000',
    priceChangePercent: '2',
    weightedAvgPrice: '50500',
    lastPrice: '51000',
    lastQty: '1',
    openPrice: '50000',
    highPrice: '52000',
    lowPrice: '49000',
    volume: '100',
    quoteVolume: '5050000',
    openTime: Date.now() - 86400000,
    closeTime: Date.now(),
    firstId: 1,
    lastId: 1000,
    count: 1000
  }]),
  futuresAllBookTickers: jest.fn(),
  futuresCandles: jest.fn(),
  futuresOrder: jest.fn(),
  futuresCancelOrder: jest.fn(),
  futuresGetOrder: jest.fn(),
  futuresOpenOrders: jest.fn()
} as unknown as jest.Mocked<BinanceClient>;

describe('BinancePositionManager', () => {
  let positionManager: BinancePositionManager;

  beforeEach(() => {
    const mockRiskCalculator = new RiskCalculator(mockClient);
    positionManager = new BinancePositionManager(mockClient, mockRiskCalculator);
    jest.clearAllMocks();
  });

  describe('getCurrentPosition', () => {
    it('should get current position successfully', async () => {
      const result = await positionManager.getCurrentPosition('BTCUSDT');
      expect(result).toMatchObject({
        symbol: 'BTCUSDT',
        positionAmount: '1',
        entryPrice: '50000',
        unrealizedProfit: '1000'
      });
      expect(mockClient.futuresPositionRisk).toHaveBeenCalledWith({
        symbol: 'BTCUSDT'
      });
    });

    it('should handle position not found error', async () => {
      mockClient.futuresPositionRisk.mockResolvedValueOnce([]);
      await expect(positionManager.getCurrentPosition('BTCUSDT')).rejects.toThrow('No position found for BTCUSDT');
    });

    it('should handle API error', async () => {
      const error = new Error('API error');
      mockClient.futuresPositionRisk.mockRejectedValueOnce(error);
      await expect(positionManager.getCurrentPosition('BTCUSDT')).rejects.toThrow('Failed to get current position: API error');
    });
  });

  describe('calculateMaxPosition', () => {
    it('should calculate max position size successfully', async () => {
      const result = await positionManager.calculateMaxPosition('BTCUSDT');
      // 10000 (balance) * 10 (leverage) * 0.1 (risk factor) / 51000 (current price) ≈ 0.196
      expect(result).toBeCloseTo(0.196, 3);
    });

    it('should handle missing USDT balance error', async () => {
      mockClient.futuresAccountBalance.mockResolvedValueOnce([]);
      await expect(positionManager.calculateMaxPosition('BTCUSDT')).rejects.toThrow('No USDT balance found');
    });

    it('should handle missing market data error', async () => {
      mockClient.futures24hr.mockResolvedValueOnce([]);
      await expect(positionManager.calculateMaxPosition('BTCUSDT')).rejects.toThrow('No market data found for BTCUSDT');
    });
  });

  describe('validatePositionSize', () => {
    it('should validate position size successfully', async () => {
      const result = await positionManager.validatePositionSize('BTCUSDT', 0.1);
      expect(result).toBe(true);
    });

    it('should reject position size exceeding max position', async () => {
      const result = await positionManager.validatePositionSize('BTCUSDT', 1000);
      expect(result).toBe(false);
    });
  });

  describe('getPositionRisk', () => {
    it('should get position risk information successfully', async () => {
      const result = await positionManager.getPositionRisk('BTCUSDT');
      expect(result).toMatchObject({
        liquidationRisk: expect.stringMatching(/LOW|MEDIUM|HIGH/),
        marginRatio: expect.any(String),
        unrealizedPnL: '1000'
      });
    });

    it('should handle position risk calculation error', async () => {
      const error = new Error('Risk calculation error');
      mockClient.futuresPositionRisk.mockRejectedValueOnce(error);
      await expect(positionManager.getPositionRisk('BTCUSDT')).rejects.toThrow('Failed to get position risk: Risk calculation error');
    });
  });

  describe('setMarginType', () => {
    it('should set margin type successfully', async () => {
      const result = await positionManager.setMarginType('BTCUSDT', 'ISOLATED');
      expect(result).toBe(true);
    });

    it('should handle margin type switch errors', async () => {
      mockClient.futuresPositionRisk.mockRejectedValueOnce(new Error('Margin change failed'));
      await expect(positionManager.setMarginType('BTCUSDT', 'CROSS'))
        .rejects.toThrow('Failed to set margin type');
    });
  });

  describe('getOptimalLeverage', () => {
    it('should calculate optimal leverage based on volatility', async () => {
      const result = await positionManager.getOptimalLeverage('BTCUSDT', 'MEDIUM');
      expect(result).toMatchObject({
        recommendedLeverage: expect.any(Number),
        maxLeverage: expect.any(Number),
        volatilityAdjustment: expect.any(Number),
        confidenceScore: expect.any(Number)
      });
    });

    it('should adjust leverage for different risk levels', async () => {
      const lowRisk = await positionManager.getOptimalLeverage('BTCUSDT', 'LOW');
      const highRisk = await positionManager.getOptimalLeverage('BTCUSDT', 'HIGH');

      expect(lowRisk.recommendedLeverage).toBeLessThan(highRisk.recommendedLeverage);
      expect(lowRisk.confidenceScore).toBeGreaterThan(0.7);
    });

    it('should consider market volatility in leverage calculation', async () => {
      // Mock high volatility scenario
      mockClient.futures24hr.mockResolvedValueOnce([{
        symbol: 'BTCUSDT',
        priceChange: '5000',
        priceChangePercent: '10',
        weightedAvgPrice: '50500',
        lastPrice: '55000',
        lastQty: '1',
        openPrice: '50000',
        highPrice: '56000',
        lowPrice: '49000',
        volume: '1000',
        quoteVolume: '50500000',
        openTime: Date.now() - 86400000,
        closeTime: Date.now(),
        firstId: 1,
        lastId: 1000,
        count: 1000
      }]);

      const result = await positionManager.getOptimalLeverage('BTCUSDT', 'MEDIUM');
      expect(result.recommendedLeverage).toBeLessThanOrEqual(5);
      expect(result.warnings).toContain(expect.stringMatching(/volatility|risk/i));
    });
  });

  describe('updatePosition', () => {
    it('should update position with new order', async () => {
      const order: FuturesOrder = {
        symbol: 'BTCUSDT',
        orderId: 1,
        clientOrderId: 'test1',
        status: 'FILLED',
        executedQty: '0.5',
        origQty: '0.5',
        price: '50000',
        side: 'BUY',
        positionSide: 'BOTH',
        type: 'LIMIT',
        time: Date.now(),
        timeInForce: 'GTC'
      };

      await positionManager.updatePosition(order);
      const position = await positionManager.getCurrentPosition('BTCUSDT');
      expect(position?.positionAmount).toBe('1.5'); // Previous 1 + new 0.5
    });

    it('should handle partial fills correctly', async () => {
      const partialOrder: FuturesOrder = {
        symbol: 'BTCUSDT',
        orderId: 1,
        clientOrderId: 'test1',
        status: 'PARTIALLY_FILLED',
        executedQty: '0.3',
        origQty: '0.5',
        price: '50000',
        side: 'BUY',
        positionSide: 'BOTH',
        type: 'LIMIT',
        time: Date.now(),
        timeInForce: 'GTC'
      };

      await positionManager.updatePosition(partialOrder);
      const position = await positionManager.getCurrentPosition('BTCUSDT');
      expect(position?.positionAmount).toBe('1.3');
    });

    it('should validate position updates against risk limits', async () => {
      const largeOrder: FuturesOrder = {
        symbol: 'BTCUSDT',
        orderId: 1,
        clientOrderId: 'test1',
        status: 'FILLED',
        executedQty: '10',
        origQty: '10',
        price: '50000',
        side: 'BUY',
        positionSide: 'BOTH',
        type: 'LIMIT',
        time: Date.now(),
        timeInForce: 'GTC'
      };

      await expect(positionManager.updatePosition(largeOrder))
        .rejects.toThrow(/position limit|risk threshold/i);
    });
  });

  describe('hedge mode positions', () => {
    it('should handle hedge mode position updates', async () => {
      const longPosition: FuturesPositionRisk = {
        ...mockPositionRisk,
        positionSide: 'LONG',
        positionAmount: '1'
      };

      const shortPosition: FuturesPositionRisk = {
        ...mockPositionRisk,
        positionSide: 'SHORT',
        positionAmount: '-0.5'
      };

      mockClient.futuresPositionRisk.mockResolvedValueOnce([longPosition, shortPosition]);

      const result = await positionManager.getCurrentPosition('BTCUSDT');
      expect(result.longPositionAmount).toBe('1');
      expect(result.shortPositionAmount).toBe('-0.5');
      expect(result.netPositionAmount).toBe('0.5');
    });

    it('should calculate correct risk for hedged positions', async () => {
      const longPosition: FuturesPositionRisk = {
        ...mockPositionRisk,
        positionSide: 'LONG',
        positionAmount: '1',
        entryPrice: '45000'
      };

      const shortPosition: FuturesPositionRisk = {
        ...mockPositionRisk,
        positionSide: 'SHORT',
        positionAmount: '-1',
        entryPrice: '46000'
      };

      mockClient.futuresPositionRisk.mockResolvedValueOnce([longPosition, shortPosition]);

      const risk = await positionManager.getPositionRisk('BTCUSDT');
      expect(risk.hedgedPositionRisk).toBeDefined();
      expect(risk.netExposure).toBe(0);
      expect(risk.spreadPnL).toBe(1000); // (46000 - 45000) * 1
    });
  });

  describe('position netting', () => {
    it('should correctly net multiple orders for the same position', async () => {
      const order1: FuturesOrder = {
        symbol: 'BTCUSDT',
        orderId: 1,
        clientOrderId: 'test1',
        status: 'FILLED',
        executedQty: '1',
        origQty: '1',
        price: '45000',
        side: 'BUY',
        positionSide: 'BOTH',
        type: 'LIMIT',
        time: Date.now(),
        timeInForce: 'GTC'
      };

      const order2: FuturesOrder = {
        ...order1,
        orderId: 2,
        executedQty: '0.5',
        origQty: '0.5',
        side: 'SELL'
      };

      await positionManager.updatePosition(order1);
      await positionManager.updatePosition(order2);

      const position = await positionManager.getCurrentPosition('BTCUSDT');
      expect(position.positionAmount).toBe('0.5');
      expect(position.averageEntryPrice).toBe('45000');
    });

    it('should handle position reversal correctly', async () => {
      const buyOrder: FuturesOrder = {
        symbol: 'BTCUSDT',
        orderId: 1,
        clientOrderId: 'test1',
        status: 'FILLED',
        executedQty: '1',
        origQty: '1',
        price: '45000',
        side: 'BUY',
        positionSide: 'BOTH',
        type: 'LIMIT',
        time: Date.now(),
        timeInForce: 'GTC'
      };

      const reversalOrder: FuturesOrder = {
        ...buyOrder,
        orderId: 2,
        executedQty: '2',
        origQty: '2',
        side: 'SELL'
      };

      await positionManager.updatePosition(buyOrder);
      await positionManager.updatePosition(reversalOrder);

      const position = await positionManager.getCurrentPosition('BTCUSDT');
      expect(position.positionAmount).toBe('-1');
      expect(position.side).toBe('SHORT');
    });
  });
});
