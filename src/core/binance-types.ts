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
  futuresCandles(options: {
    symbol: string;
    interval: string;
    limit?: number;
    startTime?: number;
    endTime?: number;
  }): Promise<Array<[number, string, string, string, string, string, number, string, number, string, string, string]>>;
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
}
