import { TradingEngine } from '../core/trading-engine';
import { BinanceConfig, RiskConfig } from '../config/types';
import { TimeInForce } from 'binance-api-node';

describe('TradingEngine', () => {
  let engine: TradingEngine;
  const mockConfig: BinanceConfig = {
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    testnet: true
  };

  const mockRiskConfig: RiskConfig = {
    maxPositionSize: 10000,
    maxLeverage: 20,
    stopLossPercentage: 0.02,
    dailyLossLimit: 1000,
    priceDeviationLimit: 0.05
  };

  beforeEach(() => {
    engine = new TradingEngine(mockConfig, mockRiskConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTrade', () => {
    it('should create a trade with valid parameters', async () => {
      const tradeSpy = jest.spyOn(engine, 'createTrade');

      const trade = await engine.createTrade({
        symbol: 'BTCUSDT',
        side: 'BUY' as const,
        type: 'LIMIT' as const,
        quantity: 0.001,
        price: 50000,
        stopLoss: 49000,
        takeProfit: 52000,
        timeInForce: 'GTC' as TimeInForce
      });

      expect(tradeSpy).toHaveBeenCalled();
      expect(trade).toHaveProperty('id');
      expect(trade).toHaveProperty('status', 'PENDING');
      expect(trade.symbol).toBe('BTCUSDT');
    });

    it('should reject trade if risk limits are exceeded', async () => {
      const largeTrade = {
        symbol: 'BTCUSDT',
        side: 'BUY' as const,
        type: 'MARKET' as const,
        quantity: 1000,  // Very large quantity
        timeInForce: 'GTC' as TimeInForce
      };

      await expect(engine.createTrade(largeTrade)).rejects.toThrow(/Position size exceeds maximum/);
    });
  });

  describe('approveTrade', () => {
    it('should approve and execute a valid trade', async () => {
      const trade = await engine.createTrade({
        symbol: 'BTCUSDT',
        side: 'BUY' as const,
        type: 'MARKET' as const,
        quantity: 0.001
      });

      const executeSpy = jest.fn();
      engine.on('tradeExecuted', executeSpy);

      await engine.approveTrade(trade.id);

      expect(executeSpy).toHaveBeenCalled();
      expect(executeSpy.mock.calls[0][0].trade.status).toBe('EXECUTED');
    });

    it('should throw error for non-existent trade', async () => {
      await expect(engine.approveTrade('non-existent-id')).rejects.toThrow('Trade not found');
    });
  });

  describe('cancelTrade', () => {
    it('should cancel a pending trade', async () => {
      const trade = await engine.createTrade({
        symbol: 'BTCUSDT',
        side: 'BUY' as const,
        type: 'LIMIT' as const,
        quantity: 0.001,
        price: 50000
      });

      const cancelSpy = jest.fn();
      engine.on('tradeCancelled', cancelSpy);

      await engine.cancelTrade(trade.id);

      expect(cancelSpy).toHaveBeenCalled();
      expect(cancelSpy.mock.calls[0][0].status).toBe('CANCELLED');
    });
  });

  describe('error handling', () => {
    it('should emit error events', (done) => {
      engine.on('error', (error) => {
        expect(error).toBeTruthy();
        done();
      });

      // Trigger an error by trying to approve a non-existent trade
      engine.approveTrade('invalid-id').catch(() => {});
    });
  });
});
