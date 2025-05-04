import { jest } from '@jest/globals';
import Binance from 'binance-api-node';

jest.mock('binance-api-node', () => {
  return jest.fn().mockImplementation(() => ({
    futuresCandles: jest.fn(),
    futuresAllBookTickers: jest.fn()
  }));
});

describe('Prediction Service Tests', () => {
  let binanceClient: any;

  beforeEach(() => {
    binanceClient = Binance();
    jest.clearAllMocks();
  });

  describe('create_prediction functionality', () => {
    it('should create a price target prediction', async () => {
      const currentPrice = {
        'BTCUSDT': {
          symbol: 'BTCUSDT',
          bidPrice: '44999.50',
          bidQty: '1.234',
          askPrice: '45000.50',
          askQty: '0.567'
        }
      };

      binanceClient.futuresAllBookTickers.mockResolvedValue(currentPrice);

      const predictionData = {
        symbol: 'BTCUSDT',
        type: 'PRICE_TARGET',
        validityPeriod: 3600000,
        metadata: {
          targetPrice: '46000.00',
          direction: 'UP',
          timeframe: '1h'
        }
      };

      const result = await createPrediction(binanceClient, predictionData);

      expect(result).toMatchObject({
        id: expect.any(String),
        symbol: 'BTCUSDT',
        type: 'PRICE_TARGET',
        createdAt: expect.any(Number),
        validUntil: expect.any(Number),
        metadata: {
          currentPrice: '45000.50',
          predictionDetails: {
            targetPrice: '46000.00',
            direction: 'UP',
            timeframe: '1h'
          }
        }
      });
    });

    it('should handle invalid symbol errors', async () => {
      binanceClient.futuresAllBookTickers.mockRejectedValue(new Error('Invalid symbol'));

      const predictionData = {
        symbol: 'INVALID',
        type: 'PRICE_TARGET',
        validityPeriod: 3600000,
        metadata: {
          targetPrice: '46000.00',
          direction: 'UP',
          timeframe: '1h'
        }
      };

      await expect(createPrediction(binanceClient, predictionData))
        .rejects.toThrow('Invalid symbol');
    });
  });

  describe('evaluate_prediction functionality', () => {
    it('should evaluate a successful prediction', async () => {
      const historicalData = [
        {
          openTime: 1683115200000,
          open: '45000.50',
          high: '46100.00',
          low: '44900.00',
          close: '46050.00',
          volume: '100.5',
          closeTime: 1683118800000,
          quoteVolume: '4525025.00',
          trades: 1000
        }
      ];

      binanceClient.futuresCandles.mockResolvedValue(historicalData);

      const prediction = {
        id: 'pred_1',
        symbol: 'BTCUSDT',
        type: 'PRICE_TARGET',
        createdAt: 1683115200000,
        validUntil: 1683118800000,
        metadata: {
          currentPrice: '45000.50',
          predictionDetails: {
            targetPrice: '46000.00',
            direction: 'UP',
            timeframe: '1h'
          }
        }
      };

      const result = await evaluatePrediction(binanceClient, prediction);

      expect(result).toMatchObject({
        predictionId: 'pred_1',
        success: true,
        actualResult: {
          finalPrice: '46050.00',
          highestPrice: '46100.00',
          lowestPrice: '44900.00',
          percentageChange: expect.any(String),
          timeElapsed: expect.any(Number)
        },
        accuracy: expect.any(Number),
        metrics: {
          priceDifference: expect.any(String),
          percentageError: expect.any(String),
          directionCorrect: true
        }
      });
    });

    it('should handle invalid prediction evaluation', async () => {
      binanceClient.futuresCandles.mockRejectedValue(new Error('No historical data'));

      const prediction = {
        id: 'pred_1',
        symbol: 'BTCUSDT',
        type: 'PRICE_TARGET',
        createdAt: 1683115200000,
        validUntil: 1683118800000,
        metadata: {
          currentPrice: '45000.50',
          predictionDetails: {
            targetPrice: '46000.00',
            direction: 'UP',
            timeframe: '1h'
          }
        }
      };

      await expect(evaluatePrediction(binanceClient, prediction))
        .rejects.toThrow('No historical data');
    });
  });
});

// Helper functions (these would normally be imported from the actual implementation)
async function createPrediction(client: any, data: any) {
  const currentPrice = await client.futuresAllBookTickers();
  const price = currentPrice[data.symbol].askPrice;

  return {
    id: `pred_${Date.now()}`,
    symbol: data.symbol,
    type: data.type,
    createdAt: Date.now(),
    validUntil: Date.now() + data.validityPeriod,
    metadata: {
      currentPrice: price,
      predictionDetails: data.metadata
    }
  };
}

async function evaluatePrediction(client: any, prediction: any) {
  const historicalData = await client.futuresCandles({
    symbol: prediction.symbol,
    interval: prediction.metadata.predictionDetails.timeframe,
    startTime: prediction.createdAt,
    endTime: prediction.validUntil
  });

  if (!historicalData || historicalData.length === 0) {
    throw new Error('No historical data available');
  }

  const lastCandle = historicalData[historicalData.length - 1];
  const targetPrice = parseFloat(prediction.metadata.predictionDetails.targetPrice);
  const finalPrice = parseFloat(lastCandle.close);
  const success = prediction.metadata.predictionDetails.direction === 'UP'
    ? finalPrice >= targetPrice
    : finalPrice <= targetPrice;

  return {
    predictionId: prediction.id,
    success,
    actualResult: {
      finalPrice: lastCandle.close,
      highestPrice: lastCandle.high,
      lowestPrice: lastCandle.low,
      percentageChange: ((finalPrice - parseFloat(prediction.metadata.currentPrice)) / parseFloat(prediction.metadata.currentPrice) * 100).toFixed(2),
      timeElapsed: lastCandle.closeTime - prediction.createdAt
    },
    accuracy: calculateAccuracy(targetPrice, finalPrice),
    metrics: {
      priceDifference: Math.abs(targetPrice - finalPrice).toFixed(2),
      percentageError: (Math.abs(targetPrice - finalPrice) / targetPrice * 100).toFixed(2),
      directionCorrect: (prediction.metadata.predictionDetails.direction === 'UP') === (finalPrice > parseFloat(prediction.metadata.currentPrice))
    }
  };
}

function calculateAccuracy(target: number, actual: number): number {
  const percentageError = Math.abs(target - actual) / target;
  return Math.max(0, 100 * (1 - percentageError));
}
