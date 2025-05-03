declare module 'binance-api-node' {
  export type OrderType = 'LIMIT' | 'MARKET' | 'STOP' | 'STOP_MARKET' | 'TAKE_PROFIT' | 'TAKE_PROFIT_MARKET';
  export type OrderSide = 'BUY' | 'SELL';
  export type TimeInForce = 'GTC' | 'IOC' | 'FOK';
  export type PositionSide = 'BOTH' | 'LONG' | 'SHORT';
  export type WorkingType = 'MARK_PRICE' | 'CONTRACT_PRICE';

  export interface FuturesOrder {
    symbol: string;
    orderId: number;
    clientOrderId: string;
    transactTime: number;
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
  }

  export interface NewFuturesOrder {
    symbol: string;
    side: OrderSide;
    type: OrderType;
    quantity: string | number;
    price?: string | number;
    timeInForce?: TimeInForce;
    stopPrice?: string | number;
    closePosition?: boolean;
    activationPrice?: string | number;
    callbackRate?: string | number;
    workingType?: WorkingType;
    priceProtect?: boolean;
    newClientOrderId?: string;
    reduceOnly?: boolean;
    positionSide?: PositionSide;
  }

  export interface FuturesCandle {
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
  }

  export interface BinanceAPI {
    futuresAllBookTickers(): Promise<{
      [key: string]: {
        symbol: string;
        bidPrice: string;
        bidQty: string;
        askPrice: string;
        askQty: string;
        time: number;
      }
    }>;
    futuresCandles(options: {
      symbol: string;
      interval: string;
      limit?: number;
      startTime?: number;
      endTime?: number;
    }): Promise<FuturesCandle[]>;
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
  }

  export default function Binance(options?: {
    apiKey?: string;
    apiSecret?: string;
    getTime?: () => number | Promise<number>;
    httpFutures?: string;
    wsFutures?: string;
    httpBase?: string;
  }): BinanceAPI;
}
