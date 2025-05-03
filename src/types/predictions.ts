export enum PredictionType {
  PRICE_TARGET = 'PRICE_TARGET',
  TREND_DIRECTION = 'TREND_DIRECTION',
  SUPPORT_RESISTANCE = 'SUPPORT_RESISTANCE'
}

export interface Prediction {
  id: string;
  symbol: string;
  type: PredictionType;
  createdAt: number;
  validUntil: number;
  context?: string;
  metadata: {
    currentPrice: string;
    predictionDetails: {
      // Price target prediction
      targetPrice?: string;
      stopLoss?: string;
      takeProfit?: string;
      // Trend direction prediction
      direction?: 'UP' | 'DOWN' | 'SIDEWAYS';
      expectedPercentage?: string;
      timeframe?: string;
      // Support/Resistance prediction
      supportLevel?: string;
      resistanceLevel?: string;
    };
  };
}

export interface PredictionResult {
  predictionId: string;
  success: boolean;
  actualResult: {
    finalPrice: string;
    highestPrice: string;
    lowestPrice: string;
    percentageChange: string;
    timeElapsed: number;
    reason?: string;
  };
  accuracy: number;
  metrics: {
    priceDifference: string;
    percentageError: string;
    directionCorrect?: boolean;
    levelsTested?: {
      support: boolean;
      resistance: boolean;
    };
  };
}

export interface PredictionStats {
  totalPredictions: number;
  successfulPredictions: number;
  averageAccuracy: number;
  bySymbol: {
    [symbol: string]: {
      total: number;
      successful: number;
      accuracy: number;
      lastPrediction: Prediction;
    };
  };
  byType: {
    [key in PredictionType]: {
      total: number;
      successful: number;
      accuracy: number;
    };
  };
}
