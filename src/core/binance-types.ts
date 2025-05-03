export type OrderType = 'LIMIT' | 'MARKET' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT' | 'LIMIT_MAKER';
export type OrderSide = 'BUY' | 'SELL';

export interface SpotBookTicker {
  symbol: string;
  bestBidPrice: string;
  bestBidQty: string;
  bestAskPrice: string;
  bestAskQty: string;
  time: number;
}

export interface SpotOrder {
  symbol: string;
  orderId: number;
  clientOrderId: string;
  price: string;
  origQty: string;
  executedQty: string;
  status: 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'REJECTED' | 'EXPIRED';
  timeInForce: 'GTC' | 'IOC' | 'FOK';
  type: OrderType;
  side: OrderSide;
  stopPrice: string;
  time: number;
  updateTime: number;
  isWorking: boolean;
}

export interface NewSpotOrder {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: string;
  price?: string;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  newClientOrderId?: string;
  stopPrice?: string;
  newOrderRespType?: 'ACK' | 'RESULT' | 'FULL';
}

export interface BinanceClient {
  prices(): Promise<{ [key: string]: string }>;
  dailyStats(): Promise<Array<{
    symbol: string;
    priceChange: string;
    priceChangePercent: string;
    weightedAvgPrice: string;
    prevClosePrice: string;
    lastPrice: string;
    lastQty: string;
    bidPrice: string;
    bidQty: string;
    askPrice: string;
    askQty: string;
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
  bookTickers(): Promise<Array<SpotBookTicker>>;
  candles(options: {
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
  order(options: NewSpotOrder): Promise<SpotOrder>;
  cancelOrder(options: {
    symbol: string;
    orderId?: number;
    origClientOrderId?: string;
  }): Promise<SpotOrder>;
  myTrades(options: {
    symbol: string;
    limit?: number;
    fromId?: number;
  }): Promise<Array<{
    id: number;
    orderId: number;
    price: string;
    qty: string;
    commission: string;
    commissionAsset: string;
    time: number;
    isBuyer: boolean;
    isMaker: boolean;
    isBestMatch: boolean;
  }>>;
}
