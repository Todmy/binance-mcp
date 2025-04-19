import type { FuturesOrder as BinanceFuturesOrder, NewFuturesOrder, FuturesOrderParams } from 'binance-api-node';

export interface FuturesBookTicker {
  symbol: string;
  bestBidPrice: string;
  bestBidQty: string;
  bestAskPrice: string;
  bestAskQty: string;
  time: number;
}

export type { BinanceFuturesOrder as FuturesOrder };
export type { NewFuturesOrder };
export type { FuturesOrderParams };

export interface BinanceClient {
  futuresAllBookTickers(): Promise<{ [key: string]: FuturesBookTicker }>;
  futuresOrder(options: FuturesOrderParams): Promise<BinanceFuturesOrder>;
}
