import { VolatilityAnalyzer } from '../../risk/volatility-analyzer';
import { BinanceClient } from 'binance-api-node';

jest.mock('binance-api-node');

const mockClient = {
  futuresCandles: jest.fn(),
  futuresMarkPrice: jest.fn()
} as unknown as jest.Mocked<BinanceClient>;

describe('VolatilityAnalyzer', () => {
  let volatilityAnalyzer: VolatilityAnalyzer;

  beforeEach(() => {
    volatilityAnalyzer = new VolatilityAnalyzer(mockClient);
    jest.clearAllMocks();
  });

  describe('calculateHistoricalVolatility', () => {
    it('should calculate historical volatility correctly', async () => {
      const period = 14;
      mockClient.futuresCandles.mockResolvedValueOnce([
        { close: '45000', volume: '100' },
        { close: '46000', volume: '150' },
        // ...simulate historical data...
      ]);

      const volatility = await volatilityAnalyzer.calculateHistoricalVolatility('BTCUSDT', period);
      expect(volatility).toBeGreaterThan(0);
      expect(typeof volatility).toBe('number');
    });

    it('should handle periods with low volatility', async () => {
      const period = 14;
      mockClient.futuresCandles.mockResolvedValueOnce([
        { close: '45000', volume: '100' },
        { close: '45100', volume: '120' },
        // ...simulate stable price data...
      ]);

      const volatility = await volatilityAnalyzer.calculateHistoricalVolatility('BTCUSDT', period);
      expect(volatility).toBeLessThan(0.1); // Low volatility threshold
    });
  });

  describe('getVolatilityTrend', () => {
    it('should detect increasing volatility trend', async () => {
      mockClient.futuresCandles.mockResolvedValueOnce([
        // Simulate increasing price swings
        { close: '45000', volume: '100' },
        { close: '46000', volume: '150' },
        { close: '44000', volume: '200' },
      ]);

      const trend = await volatilityAnalyzer.getVolatilityTrend('BTCUSDT');
      expect(trend).toBe('INCREASING');
    });

    it('should detect stable volatility', async () => {
      mockClient.futuresCandles.mockResolvedValueOnce([
        // Simulate stable price movement
        { close: '45000', volume: '100' },
        { close: '45100', volume: '98' },
        { close: '45050', volume: '102' },
      ]);

      const trend = await volatilityAnalyzer.getVolatilityTrend('BTCUSDT');
      expect(trend).toBe('STABLE');
    });
  });

  describe('getOptimalPositionSize', () => {
    it('should calculate optimal position size based on volatility', async () => {
      const params = {
        symbol: 'BTCUSDT',
        accountBalance: 10000,
        riskPercentage: 1,
        leverage: 10
      };

      mockClient.futuresCandles.mockResolvedValueOnce([
        // Simulate historical data for volatility calculation
        { close: '45000', volume: '100' },
        { close: '46000', volume: '150' },
      ]);

      mockClient.futuresMarkPrice.mockResolvedValueOnce({
        symbol: 'BTCUSDT',
        markPrice: '45000',
        indexPrice: '45100',
        estimatedSettlePrice: '45050',
        lastFundingRate: '0.0001',
        nextFundingTime: Date.now() + 3600000,
        interestRate: '0.0001',
        time: Date.now()
      });

      const positionSize = await volatilityAnalyzer.getOptimalPositionSize(params);
      expect(positionSize).toBeGreaterThan(0);
      expect(typeof positionSize).toBe('number');
    });

    it('should reduce position size in high volatility conditions', async () => {
      const params = {
        symbol: 'BTCUSDT',
        accountBalance: 10000,
        riskPercentage: 1,
        leverage: 10
      };

      // Mock high volatility data
      mockClient.futuresCandles.mockResolvedValueOnce([
        { close: '45000', volume: '100' },
        { close: '48000', volume: '200' },
        { close: '43000', volume: '300' },
      ]);

      const positionSizeHighVol = await volatilityAnalyzer.getOptimalPositionSize(params);

      // Mock low volatility data
      mockClient.futuresCandles.mockResolvedValueOnce([
        { close: '45000', volume: '100' },
        { close: '45100', volume: '98' },
        { close: '45050', volume: '102' },
      ]);

      const positionSizeLowVol = await volatilityAnalyzer.getOptimalPositionSize(params);

      expect(positionSizeHighVol).toBeLessThan(positionSizeLowVol);
    });
  });
});
