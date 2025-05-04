import { BinanceClient } from '../../core/binance-types';
import { PredictionTracker } from '../../predictions/prediction-tracker';
import { RecommendationService } from '../../predictions/recommendation-service';
import { PredictionType } from '../../types/predictions';

jest.mock('../../predictions/prediction-tracker');

describe('RecommendationService', () => {
  let recommendationService: RecommendationService;
  let mockClient: jest.Mocked<BinanceClient>;
  let mockPredictionTracker: jest.Mocked<PredictionTracker>;

  const mockLastPrediction = {
    id: 'test-prediction-1',
    symbol: 'BTCUSDT',
    type: PredictionType.PRICE_TARGET,
    createdAt: Date.now(),
    validUntil: Date.now() + 14400000,
    context: 'Test prediction for BTCUSDT',
    metadata: {
      currentPrice: '50000',
      predictionDetails: {
        targetPrice: '51000',
        stopLoss: '49500',
        timeframe: '4h',
        direction: 'UP' as const,
        expectedPercentage: '2.0'
      }
    }
  };

  const mockBookTicker = {
    symbol: 'BTCUSDT',
    bestBidPrice: '50000',
    bestBidQty: '1.5',
    bestAskPrice: '50001',
    bestAskQty: '2.0',
    time: Date.now()
  };

  const marketData = {
    symbol: 'BTCUSDT',
    priceChange: '1000',
    priceChangePercent: '2.5',
    weightedAvgPrice: '49500',
    lastPrice: '50000',
    lastQty: '1.2',
    openPrice: '48000',
    highPrice: '51000',
    lowPrice: '47500',
    volume: '1000',
    quoteVolume: '50000000',
    openTime: Date.now() - 86400000,
    closeTime: Date.now(),
    firstId: 1,
    lastId: 1000,
    count: 1000
  };

  beforeEach(() => {
    mockClient = {
      futuresAllBookTickers: jest.fn(),
      futures24hr: jest.fn()
    } as any;

    mockPredictionTracker = new PredictionTracker(mockClient) as jest.Mocked<PredictionTracker>;
    recommendationService = new RecommendationService(mockClient, mockPredictionTracker);

    // Default mock implementations
    mockClient.futuresAllBookTickers.mockResolvedValue({
      BTCUSDT: mockBookTicker
    });

    mockClient.futures24hr.mockResolvedValue([marketData]);


    mockPredictionTracker.getStats.mockReturnValue({
      totalPredictions: 20,
      successfulPredictions: 16,
      averageAccuracy: 80,
      bySymbol: {
        BTCUSDT: {
          total: 10,
          successful: 8,
          accuracy: 80,
          lastPrediction: mockLastPrediction
        }
      },
      byType: {
        [PredictionType.PRICE_TARGET]: {
          total: 10,
          successful: 8,
          accuracy: 80
        },
        [PredictionType.TREND_DIRECTION]: {
          total: 10,
          successful: 8,
          accuracy: 80
        },
        [PredictionType.SUPPORT_RESISTANCE]: {
          total: 10,
          successful: 8,
          accuracy: 80
        }
      }
    });
  });

  describe('generateRecommendation', () => {
    it('should return null when insufficient predictions', async () => {
      mockPredictionTracker.getSymbolStats.mockReturnValue({
        total: 3,
        successful: 2,
        accuracy: 66.67,
        lastPrediction: mockLastPrediction
      });

      const recommendation = await recommendationService.generateRecommendation('BTCUSDT');
      expect(recommendation).toBeNull();
    });

    it('should generate high confidence recommendation', async () => {
      mockPredictionTracker.getSymbolStats.mockReturnValue({
        total: 10,
        successful: 8,
        accuracy: 80,
        lastPrediction: mockLastPrediction
      });

      mockPredictionTracker.getStats.mockReturnValue({
        totalPredictions: 20,
        successfulPredictions: 16,
        averageAccuracy: 80,
        bySymbol: {
          BTCUSDT: {
            total: 10,
            successful: 8,
            accuracy: 80,
            lastPrediction: mockLastPrediction
          }
        },
        byType: {
          [PredictionType.PRICE_TARGET]: {
            total: 10,
            successful: 8,
            accuracy: 80
          },
          [PredictionType.TREND_DIRECTION]: {
            total: 10,
            successful: 8,
            accuracy: 80
          },
          [PredictionType.SUPPORT_RESISTANCE]: {
            total: 10,
            successful: 8,
            accuracy: 80
          }
        }
      });

      const recommendation = await recommendationService.generateRecommendation('BTCUSDT');

      expect(recommendation).toMatchObject({
        symbol: 'BTCUSDT',
        confidence: expect.any(Number),
        type: 'ENTRY',
        reasoning: expect.any(Array),
        suggestedAction: expect.any(Object)
      });

      expect(recommendation!.confidence).toBeGreaterThanOrEqual(75);
      expect(recommendation!.reasoning.length).toBeGreaterThan(0);
    });

    it('should handle high volatility scenarios', async () => {
      mockPredictionTracker.getSymbolStats.mockReturnValue({
        total: 10,
        successful: 7,
        accuracy: 70,
        lastPrediction: mockLastPrediction
      });

      mockClient.futures24hr.mockResolvedValue([{
        symbol: 'BTCUSDT',
        priceChange: '2750',
        priceChangePercent: '5.5',
        weightedAvgPrice: '49500',
        lastPrice: '50000',
        lastQty: '1.2',
        openPrice: '47250',
        highPrice: '51000',
        lowPrice: '47000',
        volume: '1000',
        quoteVolume: '50000000',
        openTime: Date.now() - 86400000,
        closeTime: Date.now(),
        firstId: 1,
        lastId: 1000,
        count: 1000
      }]);

      const recommendation = await recommendationService.generateRecommendation('BTCUSDT');

      expect(recommendation).toMatchObject({
        symbol: 'BTCUSDT',
        type: 'RISK_ADJUSTMENT',
        suggestedAction: {
          riskLevel: 'HIGH',
          timeframe: '15m'
        },
        historicalContext: {
          totalPredictions: 10,
          successRate: 70,
          averageAccuracy: 70,
          recentTrend: expect.any(String)
        }
      });
    });

    it('should handle getCurrentPrice failure', async () => {
      // Make sure getSymbolStats returns valid data to pass the initial check
      mockPredictionTracker.getSymbolStats.mockReturnValue({
        total: 10,
        successful: 8,
        accuracy: 80,
        lastPrediction: mockLastPrediction
      });

      // Now mock the bookTickers function to return empty object
      mockClient.futuresAllBookTickers.mockResolvedValue({});

      await expect(recommendationService.generateRecommendation('BTCUSDT'))
        .rejects.toThrow('No price data available for BTCUSDT');
    });

    it('should calculate correct stop loss and target prices', async () => {
      mockPredictionTracker.getSymbolStats.mockReturnValue({
        total: 10,
        successful: 8,
        accuracy: 80,
        lastPrediction: mockLastPrediction
      });

      const recommendation = await recommendationService.generateRecommendation('BTCUSDT');

      expect(recommendation).toMatchObject({
        suggestedAction: {
          targetPrice: expect.any(String),
          stopLoss: expect.any(String)
        }
      });

      const targetPrice = parseFloat(recommendation!.suggestedAction.targetPrice!);
      const stopLoss = parseFloat(recommendation!.suggestedAction.stopLoss!);
      const currentPrice = 50000;

      // Verify price calculations based on volatility
      expect(Math.abs(targetPrice - currentPrice)).toBeGreaterThan(0);
      expect(Math.abs(stopLoss - currentPrice)).toBeGreaterThan(0);
    });

    it('should provide appropriate timeframes based on volatility', async () => {
      mockPredictionTracker.getSymbolStats.mockReturnValue({
        total: 10,
        successful: 8,
        accuracy: 80,
        lastPrediction: mockLastPrediction
      });

      // Test different volatility scenarios
      const volatilityScenarios = [
        { volatility: '6.0', expectedTimeframe: '15m' },
        { volatility: '3.0', expectedTimeframe: '1h' },
        { volatility: '1.0', expectedTimeframe: '4h' }
      ];

      for (const scenario of volatilityScenarios) {
        mockClient.futures24hr.mockResolvedValue([{
          ...marketData,
          priceChangePercent: scenario.volatility
        }]);

        const recommendation = await recommendationService.generateRecommendation('BTCUSDT');

        expect(recommendation).toMatchObject({
          suggestedAction: {
            timeframe: scenario.expectedTimeframe
          }
        });
      }
    });

    it('should handle missing market stats gracefully', async () => {
      mockClient.futures24hr.mockResolvedValue([]);
      mockPredictionTracker.getSymbolStats.mockReturnValue({
        total: 10,
        successful: 8,
        accuracy: 80,
        lastPrediction: mockLastPrediction
      });

      const recommendation = await recommendationService.generateRecommendation('BTCUSDT');

      expect(recommendation).toMatchObject({
        type: 'ENTRY',
        suggestedAction: {
          timeframe: '4h',
          direction: 'LONG'
        }
      });
    });
  });

  describe('analysis functions', () => {
    it('should calculate trend correctly', async () => {
      const stats = {
        total: 10,
        successful: 8,
        accuracy: 80,
        lastPrediction: mockLastPrediction
      };

      const service = new RecommendationService(mockClient, mockPredictionTracker);

      const trend = service['calculateTrend'](stats);

      expect(trend).toBe('IMPROVING');
    });

    it('should calculate volatility correctly', async () => {
      const marketStats = {
        priceChangePercent: '2.5'
      };

      const service = new RecommendationService(mockClient, mockPredictionTracker);

      const volatility = service['calculateVolatility'](marketStats);

      expect(volatility).toBe(0.025);
    });

    it('should calculate confidence scores appropriately', async () => {
      const stats = {
        total: 10,
        successful: 8,
        accuracy: 80,
        lastPrediction: mockLastPrediction
      };

      const service = new RecommendationService(mockClient, mockPredictionTracker);

      const confidence = service['calculateConfidence'](stats, 85);

      expect(confidence).toBeGreaterThanOrEqual(75);
    });
  });
});
