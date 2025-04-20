export type AlertType = 'PRICE' | 'INDICATOR' | 'PATTERN' | 'VOLUME';
export type ComparisonOperator = '>' | '<' | '==' | 'CROSS_ABOVE' | 'CROSS_BELOW';

export interface AlertCondition {
  indicator?: string;
  threshold?: number;
  comparison: ComparisonOperator;
  value: number;
}

export interface OrderConfig {
  type: 'MARKET' | 'LIMIT';
  side: 'BUY' | 'SELL';
  quantity: number | 'AUTO';
  stopLoss?: number;
  takeProfit?: number;
}

export interface AlertConfig {
  id?: string;
  symbol: string;
  type: AlertType;
  conditions: AlertCondition[];
  order?: OrderConfig;
  isEnabled: boolean;
  description?: string;
}

export interface Alert extends AlertConfig {
  id: string;
  createdAt: number;
  lastTriggered?: number;
  triggerCount: number;
}

export interface AlertResult {
  alert: Alert;
  triggered: boolean;
  values: {
    [key: string]: number;
  };
  timestamp: number;
}

export interface StoredAlert extends Alert {
  lastCheck: number;
  status: 'ACTIVE' | 'TRIGGERED' | 'DISABLED';
}
