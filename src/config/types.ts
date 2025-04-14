import { TimeInForce } from 'binance-api-node';

export interface RiskConfig {
  maxPositionSize: number;
  maxLeverage: number;
  stopLossPercentage: number;
  dailyLossLimit: number;
  priceDeviationLimit: number;
}

export interface BinanceConfig {
  apiKey: string;
  apiSecret: string;
  testnet: boolean;
}

export interface StrategyConfig {
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  indicators: {
    name: string;
    parameters: Record<string, number>;
  }[];
  customRules?: string[];
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';
  quantity: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  timeInForce?: TimeInForce;
  timestamp: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'CANCELLED';
}

export interface RiskAssessment {
  isValid: boolean;
  reasons: string[];
  suggestions?: {
    maxQuantity?: number;
    recommendedStopLoss?: number;
    recommendedTakeProfit?: number;
  };
}
