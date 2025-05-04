import { BinanceClient } from '../../core/binance-types';
import { TechnicalAnalysisService } from '../../analytics/technical-analysis-service';

// Test Data Helpers
const createBaseCandle = (i: number) => ({
  openTime: i,
  closeTime: i + 1,
  quoteVolume: '50050000',
  trades: 1000,
  baseAssetVolume: '1000',
  quoteAssetVolume: '50050000'
});

// Market Condition Generators
const generateUptrendCandles = (length = 100, startPrice = 50000, increment = 300) =>
  Array.from({ length }, (_, i) => ({
    ...createBaseCandle(i),
    open: `${startPrice + i * increment}`,
    high: `${startPrice + 200 + i * increment}`,
    low: `${startPrice - 50 + i * increment}`,
    close: `${startPrice + 150 + i * increment}`,
    volume: `${1000 + i * 50}` // Increasing volume trend
  }));

const generateDowntrendCandles = (length = 100, startPrice = 50000, decrement = 300) =>
  Array.from({ length }, (_, i) => ({
    ...createBaseCandle(i),
    open: `${startPrice - i * decrement}`,
    high: `${startPrice + 50 - i * decrement}`,
    low: `${startPrice - 200 - i * decrement}`,
    close: `${startPrice - 150 - i * decrement}`,
    volume: `${1000 + i * 50}`
  }));

const generateSidewaysCandles = (length = 100, basePrice = 50000, range = 500) =>
  Array.from({ length }, (_, i) => ({
    ...createBaseCandle(i),
    open: `${basePrice + Math.sin(i * 0.1) * range}`,
    high: `${basePrice + range}`,
    low: `${basePrice - range}`,
    close: `${basePrice + Math.cos(i * 0.1) * range}`,
    volume: `${1000 + Math.abs(Math.sin(i * 0.1)) * 500}`
  }));

const generateVolatileCandles = (baseCandles: ReturnType<typeof generateUptrendCandles>, volatilityRange = 2000) => {
  const makeVolatilePeriod = (candle: ReturnType<typeof generateUptrendCandles>[0], i: number) => {
    const swing = Math.sin((i - 80) * Math.PI / 5) * volatilityRange;
    const high = parseFloat(candle.high) + Math.abs(swing);
    const low = parseFloat(candle.low) - Math.abs(swing);
    const close = parseFloat(candle.close) + swing;

    return {
      ...candle,
      open: candle.open,
      high: `${high}`,
      low: `${low}`,
      close: `${close}`,
      volume: `${2000 + Math.abs(swing)}`
    };
  };

  return baseCandles.map((candle, i) =>
    i >= 80 && i < 90 ? makeVolatilePeriod(candle, i) : candle
  );
};

const generateSupportResistanceCandles = (length = 100, basePrice = 50000) =>
  Array.from({ length }, (_, i) => {
    const base = {
      ...createBaseCandle(i),
      volume: '1000',
      open: `${basePrice}`
    };

    if (i % 25 === 0) { // Support tests
      return {
        ...base,
        low: `${basePrice - 2000}`,
        high: `${basePrice}`,
        close: `${basePrice - 500}`
      };
    } else if (i % 20 === 0) { // Resistance tests
      return {
        ...base,
        low: `${basePrice}`,
        high: `${basePrice + 2000}`,
        close: `${basePrice + 500}`
      };
    }
    return {
      ...base,
      low: `${basePrice - 500}`,
      high: `${basePrice + 500}`,
      close: `${basePrice}`
    };
  });

// Test Data Sets
const mockUptrendCandles = generateUptrendCandles();
const mockDowntrendCandles = generateDowntrendCandles();
const mockSidewaysCandles = generateSidewaysCandles();
const volatileCandles = generateVolatileCandles(mockUptrendCandles);
const bounceCandles = generateSupportResistanceCandles();

// Helper Functions
const expectTrendConsistency = (
  analysis: { trends: { shortTerm: string; mediumTerm: string; longTerm: string } },
  expectedTrend: string
) => {
  expect(analysis.trends.shortTerm).toBe(expectedTrend);
  expect(analysis.trends.mediumTerm).toBe(expectedTrend);
  expect(analysis.trends.longTerm).toBe(expectedTrend);
};

const validateSupportResistance = (
  support: number[],
  resistance: number[],
  currentPrice: number
) => {
  expect(support.length).toBeGreaterThanOrEqual(1);
  expect(resistance.length).toBeGreaterThanOrEqual(1);
  support.forEach(level => expect(level).toBeLessThan(currentPrice));
  resistance.forEach(level => expect(level).toBeGreaterThan(currentPrice));
  expect(Math.min(...resistance)).toBeGreaterThan(Math.max(...support));
};

describe('TechnicalAnalysisService', () => {
  let technicalAnalysis: TechnicalAnalysisService;
  let mockClient: jest.Mocked<BinanceClient>;

  beforeEach(() => {
    mockClient = {
      futuresCandles: jest.fn().mockResolvedValue(mockUptrendCandles),
      futuresAllBookTickers: jest.fn().mockResolvedValue({}),
      futures24hr: jest.fn().mockResolvedValue([]),
      futuresOrder: jest.fn().mockResolvedValue({}),
      futuresCancelOrder: jest.fn().mockResolvedValue({}),
      futuresGetOrder: jest.fn().mockResolvedValue({}),
      futuresPositionRisk: jest.fn().mockResolvedValue([]),
      futuresLeverage: jest.fn().mockResolvedValue({}),
      futuresMarginType: jest.fn().mockResolvedValue({}),
      futuresAccountBalance: jest.fn().mockResolvedValue([]),
      futuresOpenOrders: jest.fn().mockResolvedValue([])
    } as unknown as jest.Mocked<BinanceClient>;

    technicalAnalysis = new TechnicalAnalysisService(mockClient);
    jest.clearAllMocks();
  });

  describe('analyzeTechnicals', () => {
    describe('trend detection', () => {
      it('should detect strong upward trend', async () => {
        mockClient.futuresCandles.mockResolvedValueOnce(mockUptrendCandles);
        const analysis = await technicalAnalysis.analyzeTechnicals('BTCUSDT');
        expectTrendConsistency(analysis, 'BULLISH');
      });

      it('should detect strong downward trend', async () => {
        mockClient.futuresCandles.mockResolvedValueOnce(mockDowntrendCandles);
        const analysis = await technicalAnalysis.analyzeTechnicals('BTCUSDT');
        expectTrendConsistency(analysis, 'BEARISH');
      });

      it('should identify sideways market', async () => {
        mockClient.futuresCandles.mockResolvedValueOnce(mockSidewaysCandles);
        const analysis = await technicalAnalysis.analyzeTechnicals('BTCUSDT');
        expect(analysis.trends.shortTerm).toBe('NEUTRAL');
        expect(analysis.trends.mediumTerm).toBe('NEUTRAL');
      });

      it('should detect trend reversals', async () => {
        const reversalCandles = [
          ...generateDowntrendCandles(50),
          ...generateUptrendCandles(50, 35000) // Start uptrend from lower price
        ];
        mockClient.futuresCandles.mockResolvedValueOnce(reversalCandles);

        const analysis = await technicalAnalysis.analyzeTechnicals('BTCUSDT');
        expect(analysis.trends.shortTerm).toBe('BULLISH');
        expect(analysis.trends.longTerm).toBe('BEARISH');
      });
    });

    describe('support and resistance', () => {
      it('should identify clear support and resistance levels', async () => {
        mockClient.futuresCandles.mockResolvedValueOnce(bounceCandles);
        const analysis = await technicalAnalysis.analyzeTechnicals('BTCUSDT');

        const currentPrice = parseFloat(bounceCandles[bounceCandles.length - 1].close);
        validateSupportResistance(analysis.support, analysis.resistance, currentPrice);

        // Verify support/resistance spacing
        const avgSpacing = Math.abs(
          analysis.resistance[0] - analysis.support[0]
        );
        expect(avgSpacing).toBeGreaterThan(1000); // Meaningful price separation
      });

      it('should adapt levels based on recent price action', async () => {
        const priceBreakoutCandles = [
          ...generateSupportResistanceCandles(80),
          ...generateUptrendCandles(20, 55000, 500) // Strong breakout
        ];
        mockClient.futuresCandles.mockResolvedValueOnce(priceBreakoutCandles);

        const analysis = await technicalAnalysis.analyzeTechnicals('BTCUSDT');
        const lastPrice = parseFloat(priceBreakoutCandles[priceBreakoutCandles.length - 1].close);

        // Previous resistance should become support after breakout
        expect(Math.min(...analysis.support)).toBeLessThan(lastPrice);
        expect(analysis.resistance.every(level => level > lastPrice)).toBe(true);
      });
    });

    describe('volatility analysis', () => {
      it('should detect increasing volatility in volatile periods', async () => {
        mockClient.futuresCandles.mockResolvedValueOnce(volatileCandles);
        const analysis = await technicalAnalysis.analyzeTechnicals('BTCUSDT');

        // Basic volatility checks
        expect(analysis.volatility.current).toBeGreaterThan(0);
        expect(analysis.volatility.trend).toBe('INCREASING');

        // Verify ATR and Bollinger band responses to volatility
        const baselineATR = analysis.indicators.atr;
        const bandWidth = analysis.indicators.bollinger.upper - analysis.indicators.bollinger.lower;

        mockClient.futuresCandles.mockResolvedValueOnce(mockUptrendCandles);
        const stableAnalysis = await technicalAnalysis.analyzeTechnicals('BTCUSDT');
        const stableBandWidth = stableAnalysis.indicators.bollinger.upper - stableAnalysis.indicators.bollinger.lower;

        // Verify technical indicators reflect volatility
        expect(baselineATR).toBeGreaterThan(stableAnalysis.indicators.atr);
        expect(bandWidth).toBeGreaterThan(stableBandWidth);
      });

      it('should identify stable market conditions', async () => {
        mockClient.futuresCandles.mockResolvedValueOnce(mockSidewaysCandles);
        const analysis = await technicalAnalysis.analyzeTechnicals('BTCUSDT');

        expect(analysis.volatility.trend).toBe('STABLE');
        expect(analysis.volatility.current).toBeLessThan(0.5); // Lower volatility in sideways market
      });

      it('should handle transition from stable to volatile conditions', async () => {
        const transitionCandles = [
          ...mockSidewaysCandles.slice(0, 80),
          ...volatileCandles.slice(80)
        ];
        mockClient.futuresCandles.mockResolvedValueOnce(transitionCandles);
        const analysis = await technicalAnalysis.analyzeTechnicals('BTCUSDT');

        // Expecting increased volatility measures
        expect(analysis.volatility.trend).toBe('INCREASING');
        expect(analysis.indicators.atr).toBeGreaterThan(0);

        // Bollinger bands should widen
        const bandWidth = analysis.indicators.bollinger.upper - analysis.indicators.bollinger.lower;
        expect(bandWidth).toBeGreaterThan(1000); // Significant band width during volatility
      });
    });
  });

  describe('custom parameters', () => {
    it('should respect custom indicator parameters', async () => {
      const standardAnalysis = await technicalAnalysis.analyzeTechnicals('BTCUSDT');

      const customAnalysis = await technicalAnalysis.analyzeTechnicals('BTCUSDT', {
        standardDeviations: 3 // Wider Bollinger bands
      });

      // Verify Bollinger bands are wider with higher standard deviations
      const standardBandWidth = standardAnalysis.indicators.bollinger.upper - standardAnalysis.indicators.bollinger.lower;
      const customBandWidth = customAnalysis.indicators.bollinger.upper - customAnalysis.indicators.bollinger.lower;
      expect(customBandWidth).toBeGreaterThan(standardBandWidth);
    });
  });

  describe('error handling', () => {
    it('should handle insufficient data', async () => {
      mockClient.futuresCandles.mockResolvedValueOnce(mockUptrendCandles.slice(0, 10));
      await expect(technicalAnalysis.analyzeTechnicals('BTCUSDT'))
        .rejects.toThrow('Insufficient data for technical analysis');
    });

    it('should validate input parameters', async () => {

      // Provide sufficient data to avoid insufficient data error
      mockClient.futuresCandles.mockResolvedValue(Array(100).fill({
        openTime: 1,
        open: '45000',
        high: '46000',
        low: '44000',
        close: '45500',
        volume: '1000',
        closeTime: 2,
        quoteVolume: '45500000',
        trades: 100,
        baseAssetVolume: '1000',
        quoteAssetVolume: '45500000'
      }));

      await expect(technicalAnalysis.analyzeTechnicals('BTCUSDT', {
        period: -1
      })).rejects.toThrow('Invalid period parameter');

      await expect(technicalAnalysis.analyzeTechnicals('BTCUSDT', {
        standardDeviations: -1
      })).rejects.toThrow('Invalid standardDeviations parameter');

      await expect(technicalAnalysis.analyzeTechnicals('BTCUSDT', {
        period: 0
      })).rejects.toThrow('Invalid period parameter');

      // Test other invalid parameters
      await expect(technicalAnalysis.analyzeTechnicals('BTCUSDT', {
        fastPeriod: -1
      })).rejects.toThrow('Invalid fastPeriod parameter');

      await expect(technicalAnalysis.analyzeTechnicals('BTCUSDT', {
        slowPeriod: 0
      })).rejects.toThrow('Invalid slowPeriod parameter');
    });
  });
});
