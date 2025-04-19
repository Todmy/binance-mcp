declare module 'binance-api-node' {
  export interface FuturesOrder {
    symbol: string;
    orderId: number;
    clientOrderId: string;
    transactTime: number;
    price: string;
    origQty: string;
    executedQty: string;
    status: string;
    timeInForce: string;
    type: string;
    side: string;
    stopPrice?: string;
    closePosition?: boolean;
    activatePrice?: string;
    priceRate?: string;
    workingType?: string;
    priceProtect?: boolean;
  }

  export interface NewFuturesOrder {
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'LIMIT' | 'MARKET' | 'STOP' | 'STOP_MARKET' | 'TAKE_PROFIT' | 'TAKE_PROFIT_MARKET';
    quantity: string | number;
    price?: string | number;
    timeInForce?: 'GTC' | 'IOC' | 'FOK';
    stopPrice?: string | number;
    closePosition?: boolean;
    activationPrice?: string | number;
    callbackRate?: string | number;
    workingType?: 'MARK_PRICE' | 'CONTRACT_PRICE';
    priceProtect?: boolean;
    newClientOrderId?: string;
    reduceOnly?: boolean;
    positionSide?: 'BOTH' | 'LONG' | 'SHORT';
  }

  export type TimeInForce = 'GTC' | 'IOC' | 'FOK';

  export interface BinanceAPI {
    futuresOrder(options: NewFuturesOrder): Promise<FuturesOrder>;
    ws: {
      futuresTicker(symbol: string, callback: (ticker: any) => void): void;
      futuresCandles(symbol: string, interval: string, callback: (candle: any) => void): void;
    };
  }

  export default function Binance(options?: {
    apiKey?: string;
    apiSecret?: string;
    getTime?: () => number | Promise<number>;
    httpFutures?: string;
    wsFutures?: string;
    httpBase?: string;
  }): BinanceAPI;

  export interface FuturesOrderParams {
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'LIMIT' | 'MARKET' | 'STOP' | 'STOP_MARKET' | 'TAKE_PROFIT' | 'TAKE_PROFIT_MARKET';
    quantity: string;
    price?: string;
    timeInForce?: TimeInForce;
    stopPrice?: string;
    closePosition?: boolean;
    activationPrice?: string;
    callbackRate?: string;
    workingType?: 'MARK_PRICE' | 'CONTRACT_PRICE';
    priceProtect?: boolean;
    newClientOrderId?: string;
    reduceOnly?: string | boolean;
    positionSide?: 'BOTH' | 'LONG' | 'SHORT';
  }
}
