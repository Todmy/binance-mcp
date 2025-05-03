import { v4 as uuidv4 } from 'uuid';
import { BinanceClient } from '../core/binance-types';
import {
  Prediction,
  PredictionType,
  PredictionResult,
  PredictionStats
} from '../types/predictions';

export class PredictionTracker {
  private predictions: Map<string, Prediction> = new Map();
  private results: Map<string, PredictionResult> = new Map();
  private stats: PredictionStats = {
    totalPredictions: 0,
    successfulPredictions: 0,
    averageAccuracy: 0,
    bySymbol: {},
    byType: {
      [PredictionType.PRICE_TARGET]: { total: 0, successful: 0, accuracy: 0 },
      [PredictionType.TREND_DIRECTION]: { total: 0, successful: 0, accuracy: 0 },
      [PredictionType.SUPPORT_RESISTANCE]: { total: 0, successful: 0, accuracy: 0 }
    }
  };

  constructor(private readonly client: BinanceClient) {}

  async createPrediction(
    symbol: string,
    type: PredictionType,
    validityPeriod: number, // in milliseconds
    metadata: Prediction['metadata'],
    context?: string
  ): Promise<Prediction> {
    const prediction: Prediction = {
      id: uuidv4(),
      symbol,
      type,
      createdAt: Date.now(),
      validUntil: Date.now() + validityPeriod,
      context,
      metadata
    };

    this.predictions.set(prediction.id, prediction);
    this.updateStats(prediction);

    return prediction;
  }

  async evaluatePrediction(predictionId: string): Promise<PredictionResult> {
    const prediction = this.predictions.get(predictionId);
    if (!prediction) {
      throw new Error(`Prediction ${predictionId} not found`);
    }

    const currentPrice = await this.getCurrentPrice(prediction.symbol);
    let success = false;
    let accuracy = 0;
    let metrics: PredictionResult['metrics'] = {
      priceDifference: '0',
      percentageError: '0'
    };

    switch (prediction.type) {
      case PredictionType.PRICE_TARGET: {
        const targetPrice = parseFloat(prediction.metadata.predictionDetails.targetPrice || '0');
        const actualPrice = parseFloat(currentPrice);
        const difference = Math.abs(targetPrice - actualPrice);
        const percentError = (difference / targetPrice) * 100;

        success = difference <= targetPrice * 0.02; // Within 2% margin
        accuracy = Math.max(0, 100 - percentError);
        metrics = {
          priceDifference: difference.toString(),
          percentageError: percentError.toFixed(2)
        };
        break;
      }

      case PredictionType.TREND_DIRECTION: {
        const startPrice = parseFloat(prediction.metadata.currentPrice);
        const actualPrice = parseFloat(currentPrice);
        const actualDirection = actualPrice > startPrice ? 'UP' : actualPrice < startPrice ? 'DOWN' : 'SIDEWAYS';
        const expectedDirection = prediction.metadata.predictionDetails.direction;

        success = actualDirection === expectedDirection;
        accuracy = success ? 100 : 0;
        metrics = {
          priceDifference: (actualPrice - startPrice).toString(),
          percentageError: '0',
          directionCorrect: success
        };
        break;
      }

      case PredictionType.SUPPORT_RESISTANCE: {
        const support = parseFloat(prediction.metadata.predictionDetails.supportLevel || '0');
        const resistance = parseFloat(prediction.metadata.predictionDetails.resistanceLevel || '0');
        const actualPrice = parseFloat(currentPrice);

        const withinRange = actualPrice >= support && actualPrice <= resistance;
        success = withinRange;
        accuracy = withinRange ? 100 : 50;
        metrics = {
          priceDifference: '0',
          percentageError: '0',
          levelsTested: {
            support: actualPrice <= support * 1.01,
            resistance: actualPrice >= resistance * 0.99
          }
        };
        break;
      }
    }

    const result: PredictionResult = {
      predictionId,
      success,
      actualResult: {
        finalPrice: currentPrice,
        highestPrice: currentPrice, // TODO: Track high/low over prediction period
        lowestPrice: currentPrice,
        percentageChange: ((parseFloat(currentPrice) / parseFloat(prediction.metadata.currentPrice) - 1) * 100).toFixed(2),
        timeElapsed: Date.now() - prediction.createdAt,
        reason: success ? undefined : 'Prediction target not met'
      },
      accuracy,
      metrics
    };

    this.results.set(predictionId, result);
    this.updateStatsWithResult(prediction, result);

    return result;
  }

  getPrediction(id: string): Prediction | undefined {
    return this.predictions.get(id);
  }

  getPredictionResult(id: string): PredictionResult | undefined {
    return this.results.get(id);
  }

  getStats(): PredictionStats {
    return this.stats;
  }

  getSymbolStats(symbol: string): PredictionStats['bySymbol'][string] | undefined {
    return this.stats.bySymbol[symbol];
  }

  private async getCurrentPrice(symbol: string): Promise<string> {
    const tickers = await this.client.futuresAllBookTickers();
    const ticker = tickers[symbol];
    if (!ticker) {
      throw new Error(`No price data available for ${symbol}`);
    }
    return ticker.bestBidPrice;
  }

  private updateStats(prediction: Prediction) {
    // Update total predictions
    this.stats.totalPredictions++;

    // Update by symbol
    if (!this.stats.bySymbol[prediction.symbol]) {
      this.stats.bySymbol[prediction.symbol] = {
        total: 0,
        successful: 0,
        accuracy: 0,
        lastPrediction: prediction
      };
    }
    this.stats.bySymbol[prediction.symbol].total++;
    this.stats.bySymbol[prediction.symbol].lastPrediction = prediction;

    // Update by type
    this.stats.byType[prediction.type].total++;

    // Recalculate averages
    this.recalculateAverages();
  }

  private updateStatsWithResult(prediction: Prediction, result: PredictionResult) {
    if (result.success) {
      this.stats.successfulPredictions++;
      this.stats.bySymbol[prediction.symbol].successful++;
      this.stats.byType[prediction.type].successful++;
    }

    // Update accuracy
    this.stats.bySymbol[prediction.symbol].accuracy =
      (this.stats.bySymbol[prediction.symbol].successful / this.stats.bySymbol[prediction.symbol].total) * 100;

    this.stats.byType[prediction.type].accuracy =
      (this.stats.byType[prediction.type].successful / this.stats.byType[prediction.type].total) * 100;

    this.recalculateAverages();
  }

  private recalculateAverages() {
    this.stats.averageAccuracy = this.stats.successfulPredictions / this.stats.totalPredictions * 100;
  }
}
