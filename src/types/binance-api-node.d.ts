declare module 'binance-api-node' {
  export type OrderType = 'LIMIT' | 'MARKET' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT' | 'LIMIT_MAKER';
  export type OrderSide = 'BUY' | 'SELL';
  export type TimeInForce = 'GTC' | 'IOC' | 'FOK';

  export interface SpotOrder {
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
    timeInForce?: TimeInForce;
    newClientOrderId?: string;
    stopPrice?: string;
    newOrderRespType?: 'ACK' | 'RESULT' | 'FULL';
  }

  export interface CandleChartResult {
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
    bookTickers(): Promise<Array<{
      symbol: string;
      bidPrice: string;
      bidQty: string;
      askPrice: string;
      askQty: string;
    }>>;
    candles(options: {
      symbol: string;
      interval: string;
      limit?: number;
      startTime?: number;
      endTime?: number;
    }): Promise<CandleChartResult[]>;
    order(options: NewSpotOrder): Promise<SpotOrder>;
    cancelOrder(options: {
      symbol: string;
      orderId?: number;
      origClientOrderId?: string;
    }): Promise<SpotOrder>;
  }

  export default function Binance(options?: {
    apiKey?: string;
    apiSecret?: string;
    getTime?: () => number | Promise<number>;
    httpBase?: string;
  }): BinanceAPI;
}
