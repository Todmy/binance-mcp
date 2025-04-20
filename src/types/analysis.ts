export interface Kline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteAssetVolume: string;
  trades: number;
  takerBuyBaseAssetVolume: string;
  takerBuyQuoteAssetVolume: string;
}

export interface Symbol24hr {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  lastPrice: string;
  lastQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

export interface TimeframeAnalysis {
  klines: Kline[];
  indicators: TechnicalIndicators;
  volumeProfile: VolumeProfile;
  priceTrend: {
    direction: 'increasing' | 'decreasing' | 'stable';
    strength: number;
  };
  trendStrength: number;
}

export interface TechnicalIndicators {
  rsi: number;
  macd: {
    value: number;
    signal: number;
    histogram: number;
  };
  volume: {
    sma: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
}

export interface VolumeProfile {
  average24h: number;
  volumeSpikes: Array<{
    time: number;
    volume: number;
  }>;
  trend: 'increasing' | 'decreasing' | 'stable';
  distribution: {
    high: number;
    medium: number;
    low: number;
  };
}

export interface TimeframeAnalysis {
  klines: Kline[];
  indicators: TechnicalIndicators;
  volumeProfile: VolumeProfile;
  trendStrength: number;
}

export interface HistoricalAnalysis {
  symbol: string;
  timeframes: {
    '1h': TimeframeAnalysis;
    '4h': TimeframeAnalysis;
    '1d': TimeframeAnalysis;
  };
  lastUpdate: number;
}
