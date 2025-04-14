import type { FuturesOrder as BinanceFuturesOrder } from 'binance-api-node';

export interface FuturesBookTicker {
  symbol: string;
  bestBidPrice: string;
  bestBidQty: string;
  bestAskPrice: string;
  bestAskQty: string;
  time: number;
}

export type { BinanceFuturesOrder as FuturesOrder };

export interface BinanceClient {
  futuresAllBookTickers(): Promise<{ [key: string]: FuturesBookTicker }>;
  futuresOrder(options: FuturesOrderParams): Promise<BinanceFuturesOrder>;
}

import type { NewFuturesOrder } from 'binance-api-node';

export type FuturesOrderParams = NewFuturesOrder;

// Re-export necessary types from binance-api-node
export type {
  NewFuturesOrder,
  MarketNewFuturesOrder,
  LimitNewFuturesOrder,
  StopMarketNewFuturesOrder,
  TakeProfitMarketNewFuturesOrder
} from 'binance-api-node';
