import { PredictionTracker } from '../../predictions/prediction-tracker';
import { Prediction } from '../../types/predictions';
import { BinanceClient } from '../../core/binance-types';
import { PredictionType } from '../../types/predictions';

describe('PredictionTracker', () => {
  let predictionTracker: PredictionTracker;
  let mockClient: jest.Mocked<BinanceClient>;

  beforeEach(() => {
    mockClient = {
      futuresGetOrder: jest.fn(),
      futuresAccountBalance: jest.fn(),
      futuresAllBookTickers: jest.fn()
    } as any;
    predictionTracker = new PredictionTracker(mockClient);
    jest.clearAllMocks();
  });

  describe('trackPrediction', () => {
    it('should track a new prediction', async () => {
      const prediction = await predictionTracker.createPrediction(
        'BTCUSDT',
        PredictionType.PRICE_TARGET,
        3600000,
        {
          currentPrice: '50000',
          predictionDetails: {
            targetPrice: '51000',
            timeframe: '1h'
          }
        }
      );

      const tracked = await predictionTracker.getPrediction(prediction.id);
      expect(tracked).toBeDefined();
      expect(tracked?.symbol).toBe('BTCUSDT');
      expect(tracked?.type).toBe(PredictionType.PRICE_TARGET);
    });

    it('should store multiple predictions', async () => {
      const predictions: Prediction[] = [
        {
          id: '1',
          symbol: 'BTCUSDT',
          type: PredictionType.PRICE_TARGET,
          createdAt: Date.now(),
          validUntil: Date.now() + 3600000,
          metadata: {
            currentPrice: '50000',
            predictionDetails: {
              targetPrice: '51000',
              timeframe: '1h'
            }
          }
        },
        {
          id: '2',
          symbol: 'ETHUSDT',
          type: PredictionType.TREND_DIRECTION,
          createdAt: Date.now(),
          validUntil: Date.now() + 14400000,
          metadata: {
            currentPrice: '3000',
            predictionDetails: {
              direction: 'UP',
              timeframe: '4h'
            }
          }
        }
      ];

      const [prediction1, prediction2] = await Promise.all(predictions.map(p =>
        predictionTracker.createPrediction(
          p.symbol,
          p.type,
          p.validUntil - p.createdAt,
          p.metadata
        )
      ));

      const tracked1 = await predictionTracker.getPrediction(prediction1.id);
      const tracked2 = await predictionTracker.getPrediction(prediction2.id);
      expect(tracked1).toBeDefined();
      expect(tracked2).toBeDefined();
      expect(predictionTracker.getStats().totalPredictions).toBe(2);
    });

    it('should evaluate prediction results', async () => {
      const prediction = await predictionTracker.createPrediction(
        'BTCUSDT',
        PredictionType.PRICE_TARGET,
        3600000,
        {
          currentPrice: '50000',
          predictionDetails: {
            targetPrice: '51000',
            timeframe: '1h'
          }
        }
      );

      mockClient.futuresAllBookTickers.mockResolvedValue({
        'BTCUSDT': {
          symbol: 'BTCUSDT',
          bestBidPrice: '51000',
          bestBidQty: '1.234',
          bestAskPrice: '51001',
          bestAskQty: '2.345',
          time: Date.now()
        }
      });

      await predictionTracker.evaluatePrediction(prediction.id);
      const result = await predictionTracker.getPredictionResult(prediction.id);
      expect(result).toBeDefined();
      expect(result?.success).toBe(true);
    });

    it('should calculate performance metrics', async () => {
      // Create multiple predictions
      const predictions = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          predictionTracker.createPrediction(
            'BTCUSDT',
            PredictionType.PRICE_TARGET,
            3600000,
            {
              currentPrice: (50000 + i * 100).toString(),
              predictionDetails: {
                targetPrice: (51000 + i * 100).toString(),
                timeframe: '1h'
              }
            }
          )
        )
      );

      // Mock price data for evaluations
      mockClient.futuresAllBookTickers.mockResolvedValue({
        'BTCUSDT': {
          symbol: 'BTCUSDT',
          bestBidPrice: '51000',
          bestBidQty: '1.234',
          bestAskPrice: '51001',
          bestAskQty: '2.345',
          time: Date.now()
        }
      });

      // Evaluate all predictions
      await Promise.all(predictions.map(p => predictionTracker.evaluatePrediction(p.id)));

      const stats = await predictionTracker.getStats();
      expect(stats.totalPredictions).toBe(10);
      expect(stats.successfulPredictions).toBeDefined();
      expect(stats.averageAccuracy).toBeDefined();
    });

    it('should handle symbol-specific performance', async () => {
      const prediction = await predictionTracker.createPrediction(
        'BTCUSDT',
        PredictionType.PRICE_TARGET,
        3600000,
        {
          currentPrice: '50000',
          predictionDetails: {
            targetPrice: '51000',
            timeframe: '1h'
          }
        }
      );

      mockClient.futuresAllBookTickers.mockResolvedValue({
        'BTCUSDT': {
          symbol: 'BTCUSDT',
          bestBidPrice: '51000',
          bestBidQty: '1.234',
          bestAskPrice: '51001',
          bestAskQty: '2.345',
          time: Date.now()
        }
      });

      await predictionTracker.evaluatePrediction(prediction.id);

      const stats = predictionTracker.getStats();
      const symbolStats = stats.bySymbol['BTCUSDT'];
      expect(symbolStats.total).toBe(1);
      expect(symbolStats.successful).toBe(1);
      expect(symbolStats.accuracy).toBe(100);
    });
  });

  describe('createPrediction', () => {
    it('should create a new prediction with correct properties', async () => {
      const symbol = 'BTCUSDT';
      const type = PredictionType.PRICE_TARGET;
      const validityPeriod = 3600000; // 1 hour
      const metadata = {
        currentPrice: '50000',
        predictionDetails: {
          targetPrice: '52000'
        }
      };

      const prediction = await predictionTracker.createPrediction(
        symbol,
        type,
        validityPeriod,
        metadata
      );

      expect(prediction).toMatchObject({
        symbol,
        type,
        metadata,
        id: expect.any(String),
        createdAt: expect.any(Number),
        validUntil: expect.any(Number)
      });
      expect(prediction.validUntil - prediction.createdAt).toBe(validityPeriod);
    });
  });

  describe('evaluatePrediction', () => {
    beforeEach(() => {
      mockClient.futuresAllBookTickers.mockResolvedValue({
        'BTCUSDT': {
          symbol: 'BTCUSDT',
          bestBidPrice: '51000',
          bestBidQty: '1.234',
          bestAskPrice: '51001',
          bestAskQty: '2.345',
          time: Date.now()
        }
      });
    });

    it('should correctly evaluate a successful price target prediction', async () => {
      const prediction = await predictionTracker.createPrediction(
        'BTCUSDT',
        PredictionType.PRICE_TARGET,
        3600000,
        {
          currentPrice: '50000',
          predictionDetails: {
            targetPrice: '51000'
          }
        }
      );

      const result = await predictionTracker.evaluatePrediction(prediction.id);

      expect(result).toMatchObject({
        predictionId: prediction.id,
        success: true,
        accuracy: expect.any(Number),
        metrics: {
          priceDifference: expect.any(String),
          percentageError: expect.any(String)
        }
      });
    });

    it('should correctly evaluate a failed price target prediction', async () => {
      const prediction = await predictionTracker.createPrediction(
        'BTCUSDT',
        PredictionType.PRICE_TARGET,
        3600000,
        {
          currentPrice: '50000',
          predictionDetails: {
            targetPrice: '55000'
          }
        }
      );

      const result = await predictionTracker.evaluatePrediction(prediction.id);

      expect(result).toMatchObject({
        predictionId: prediction.id,
        success: false,
        metrics: {
          priceDifference: expect.any(String),
          percentageError: expect.any(String)
        }
      });
    });

    it('should handle trend direction predictions', async () => {
      const prediction = await predictionTracker.createPrediction(
        'BTCUSDT',
        PredictionType.TREND_DIRECTION,
        3600000,
        {
          currentPrice: '50000',
          predictionDetails: {
            direction: 'UP'
          }
        }
      );

      const result = await predictionTracker.evaluatePrediction(prediction.id);

      expect(result).toMatchObject({
        predictionId: prediction.id,
        success: true,
        metrics: {
          directionCorrect: true
        }
      });
    });

    it('should evaluate prediction within time window', async () => {
      const prediction = await predictionTracker.createPrediction(
        'BTCUSDT',
        PredictionType.PRICE_TARGET,
        3600000, // 1 hour
        {
          currentPrice: '50000',
          predictionDetails: { targetPrice: '51000' }
        }
      );

      // Fast forward less than the time window
      const result = await predictionTracker.evaluatePrediction(prediction.id);
      expect(result.success).toBe(true);
      expect(result.metrics.priceDifference).toBeDefined();
      expect(result.metrics.percentageError).toBeDefined();
    });

    it('should handle multiple concurrent evaluations', async () => {
      const predictions = await Promise.all([
        predictionTracker.createPrediction('BTCUSDT', PredictionType.PRICE_TARGET, 3600000, {
          currentPrice: '50000',
          predictionDetails: { targetPrice: '51000' }
        }),
        predictionTracker.createPrediction('ETHUSDT', PredictionType.PRICE_TARGET, 3600000, {
          currentPrice: '3000',
          predictionDetails: { targetPrice: '3100' }
        })
      ]);

      mockClient.futuresAllBookTickers.mockResolvedValue({
        'BTCUSDT': {
          symbol: 'BTCUSDT',
          bestBidPrice: '51000',
          bestBidQty: '1.234',
          bestAskPrice: '51001',
          bestAskQty: '2.345',
          time: Date.now()
        },
        'ETHUSDT': {
          symbol: 'ETHUSDT',
          bestBidPrice: '3100',
          bestBidQty: '10.234',
          bestAskPrice: '3101',
          bestAskQty: '5.345',
          time: Date.now()
        }
      });

      const results = await Promise.all(
        predictions.map(p => predictionTracker.evaluatePrediction(p.id))
      );

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      mockClient.futuresAllBookTickers.mockResolvedValue({
        'BTCUSDT': {
          symbol: 'BTCUSDT',
          bestBidPrice: '51000',
          bestBidQty: '1.234',
          bestAskPrice: '51001',
          bestAskQty: '2.345',
          time: Date.now()
        },
        'ETHUSDT': {
          symbol: 'ETHUSDT',
          bestBidPrice: '3100',
          bestBidQty: '10.234',
          bestAskPrice: '3101',
          bestAskQty: '5.345',
          time: Date.now()
        }
      });
    });

    it('should track statistics correctly', async () => {
      // Create and evaluate multiple predictions
      const prediction1 = await predictionTracker.createPrediction(
        'BTCUSDT',
        PredictionType.PRICE_TARGET,
        3600000,
        {
          currentPrice: '50000',
          predictionDetails: { targetPrice: '51000' }
        }
      );

      const prediction2 = await predictionTracker.createPrediction(
        'ETHUSDT',
        PredictionType.PRICE_TARGET,
        3600000,
        {
          currentPrice: '3000',
          predictionDetails: { targetPrice: '3500' }
        }
      );

      await predictionTracker.evaluatePrediction(prediction1.id);
      await predictionTracker.evaluatePrediction(prediction2.id);

      const stats = predictionTracker.getStats();

      expect(stats).toMatchObject({
        totalPredictions: 2,
        successfulPredictions: expect.any(Number),
        averageAccuracy: expect.any(Number),
        bySymbol: {
          BTCUSDT: expect.any(Object),
          ETHUSDT: expect.any(Object)
        },
        byType: {
          [PredictionType.PRICE_TARGET]: expect.any(Object)
        }
      });
    });
  });

  describe('error handling', () => {
    it('should throw error when evaluating non-existent prediction', async () => {
      await expect(predictionTracker.evaluatePrediction('non-existent-id'))
        .rejects
        .toThrow('Prediction non-existent-id not found');
    });

    it('should handle missing price data', async () => {
      mockClient.futuresAllBookTickers.mockResolvedValue({});

      const prediction = await predictionTracker.createPrediction(
        'BTCUSDT',
        PredictionType.PRICE_TARGET,
        3600000,
        {
          currentPrice: '50000',
          predictionDetails: { targetPrice: '51000' }
        }
      );

      await expect(predictionTracker.evaluatePrediction(prediction.id))
        .rejects
        .toThrow('No price data available for BTCUSDT');
    });
  });
});
