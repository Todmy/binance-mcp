import type { OrderType, OrderSide, TimeInForce, PositionSide, WorkingType } from 'binance-api-node';

export interface FuturesBookTicker {
  symbol: string;
  bestBidPrice: string;
  bestBidQty: string;
  bestAskPrice: string;
  bestAskQty: string;
  time: number;
  fundingRate?: string;  // Adding optional funding rate for futures
}

export interface FuturesOrder {
  symbol: string;
  orderId: number;
  clientOrderId: string;
  price: string;
  origQty: string;
  executedQty: string;
  status: 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'REJECTED' | 'EXPIRED';
  timeInForce: TimeInForce;
  type: OrderType;
  side: OrderSide;
  stopPrice?: string;
  closePosition?: boolean;
  activatePrice?: string;
  priceRate?: string;
  workingType?: WorkingType;
  priceProtect?: boolean;
  positionSide?: PositionSide;
  time: number;
  updateTime?: number;
}

export interface NewFuturesOrder {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: string;
  price?: string;
  timeInForce?: TimeInForce;
  stopPrice?: string;
  closePosition?: boolean;
  activationPrice?: string;
  callbackRate?: string;
  workingType?: WorkingType;
  priceProtect?: boolean;
  newClientOrderId?: string;
  reduceOnly?: boolean;
  positionSide?: PositionSide;
}

export interface FuturesAccountBalance {
  accountAlias: string;
  asset: string;
  balance: string;
  crossWalletBalance: string;
  crossUnPnl: string;
  availableBalance: string;
  maxWithdrawAmount: string;
  marginAvailable: boolean;
  updateTime: number;
}

export interface FuturesPositionRisk {
  symbol: string;
  positionAmount: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  liquidationPrice: string;
  leverage: string;
  marginType: 'isolated' | 'cross';
  isolatedMargin: string;
  isAutoAddMargin: string;
  positionSide: 'BOTH' | 'LONG' | 'SHORT';
  notional: string;
  isolatedWallet: string;
  updateTime: number;
}

export interface BinanceClient {
  futuresAllBookTickers(): Promise<{ [key: string]: FuturesBookTicker }>;
  futuresCandles(options: {
    symbol: string;
    interval: string;
    limit?: number;
    startTime?: number;
    endTime?: number;
  }): Promise<Array<{
    openTime: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    closeTime: number;
    quoteVolume: string;
    trades: number;
    baseAssetVolume: string;
    quoteAssetVolume: string;
  }>>;
  futures24hr(): Promise<Array<{
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
  }>>;
  futuresOrder(options: NewFuturesOrder): Promise<FuturesOrder>;
  futuresCancelOrder(options: {
    symbol: string;
    orderId?: number;
    origClientOrderId?: string;
  }): Promise<FuturesOrder>;
  futuresGetOrder(options: {
    symbol: string;
    orderId?: number;
    origClientOrderId?: string;
  }): Promise<FuturesOrder>;
  futuresOpenOrders(options: { symbol?: string }): Promise<FuturesOrder[]>;
  futuresPositionRisk(options: { symbol?: string }): Promise<FuturesPositionRisk[]>;
  futuresAccountBalance(): Promise<FuturesAccountBalance[]>;
  futuresDaily(options: { symbol: string }): Promise<{
    priceChangePercent: string;
    lastPrice: string;
  }>;
  futuresLeverage(options: { symbol: string; leverage: number }): Promise<{
    leverage: number;
    maxNotionalValue: string;
    symbol: string;
  }>;
  futuresMarginType(options: { symbol: string; marginType: 'ISOLATED' | 'CROSS' }): Promise<{
    code: number;
    msg: string;
  }>;
}
