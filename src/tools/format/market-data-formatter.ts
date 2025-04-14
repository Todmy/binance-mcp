import { FuturesBookTicker } from '../../core/binance-types';

export class MarketDataFormatter {
  /**
   * Format book ticker data for internal use
   */
  public formatBookTicker(ticker: FuturesBookTicker): FormattedBookTicker {
    return {
      symbol: ticker.symbol,
      bid: {
        price: parseFloat(ticker.bestBidPrice),
        quantity: parseFloat(ticker.bestBidQty)
      },
      ask: {
        price: parseFloat(ticker.bestAskPrice),
        quantity: parseFloat(ticker.bestAskQty)
      },
      timestamp: ticker.time || Date.now()
    };
  }

  /**
   * Format trade data for internal use
   */
  public formatTrade(trade: any): FormattedTrade {
    return {
      id: trade.id,
      symbol: trade.symbol,
      price: parseFloat(trade.price),
      quantity: parseFloat(trade.qty),
      quoteQuantity: parseFloat(trade.quoteQty),
      commission: parseFloat(trade.commission),
      commissionAsset: trade.commissionAsset,
      time: trade.time,
      isBuyer: trade.isBuyer,
      isMaker: trade.isMaker,
      realizedPnl: parseFloat(trade.realizedPnl),
      side: trade.isBuyer ? 'BUY' : 'SELL'
    };
  }

  /**
   * Format candlestick data for internal use
   */
  public formatKline(kline: any): FormattedKline {
    return {
      symbol: kline.symbol,
      interval: kline.interval,
      startTime: kline.openTime,
      endTime: kline.closeTime,
      open: parseFloat(kline.open),
      high: parseFloat(kline.high),
      low: parseFloat(kline.low),
      close: parseFloat(kline.close),
      volume: parseFloat(kline.volume),
      quoteVolume: parseFloat(kline.quoteVolume),
      trades: kline.trades,
      buyVolume: parseFloat(kline.buyVolume || '0'),
      quoteBuyVolume: parseFloat(kline.quoteBuyVolume || '0')
    };
  }

  /**
   * Format market depth data
   */
  public formatOrderBook(orderBook: any): FormattedOrderBook {
    return {
      symbol: orderBook.symbol,
      lastUpdateId: orderBook.lastUpdateId,
      bids: orderBook.bids.map((bid: string[]) => ({
        price: parseFloat(bid[0]),
        quantity: parseFloat(bid[1])
      })),
      asks: orderBook.asks.map((ask: string[]) => ({
        price: parseFloat(ask[0]),
        quantity: parseFloat(ask[1])
      })),
      timestamp: orderBook.time || Date.now()
    };
  }

  /**
   * Calculate market depth from order book
   */
  public calculateMarketDepth(
    orderBook: FormattedOrderBook,
    levels: number = 10
  ): MarketDepthResult {
    const bidLevels = orderBook.bids.slice(0, levels);
    const askLevels = orderBook.asks.slice(0, levels);

    const totalBidVolume = bidLevels.reduce((sum, bid) => sum + bid.quantity, 0);
    const totalAskVolume = askLevels.reduce((sum, ask) => sum + ask.quantity, 0);

    const weightedBidPrice =
      bidLevels.reduce((sum, bid) => sum + bid.price * bid.quantity, 0) / totalBidVolume;
    const weightedAskPrice =
      askLevels.reduce((sum, ask) => sum + ask.price * ask.quantity, 0) / totalAskVolume;

    return {
      bidLevels,
      askLevels,
      totalBidVolume,
      totalAskVolume,
      weightedBidPrice,
      weightedAskPrice,
      spread: askLevels[0].price - bidLevels[0].price,
      spreadPercentage:
        ((askLevels[0].price - bidLevels[0].price) / bidLevels[0].price) * 100
    };
  }
}

export interface FormattedBookTicker {
  symbol: string;
  bid: PriceLevel;
  ask: PriceLevel;
  timestamp: number;
}

export interface FormattedTrade {
  id: number;
  symbol: string;
  price: number;
  quantity: number;
  quoteQuantity: number;
  commission: number;
  commissionAsset: string;
  time: number;
  isBuyer: boolean;
  isMaker: boolean;
  realizedPnl: number;
  side: 'BUY' | 'SELL';
}

export interface FormattedKline {
  symbol: string;
  interval: string;
  startTime: number;
  endTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  trades: number;
  buyVolume: number;
  quoteBuyVolume: number;
}

export interface FormattedOrderBook {
  symbol: string;
  lastUpdateId: number;
  bids: PriceLevel[];
  asks: PriceLevel[];
  timestamp: number;
}

export interface PriceLevel {
  price: number;
  quantity: number;
}

export interface MarketDepthResult {
  bidLevels: PriceLevel[];
  askLevels: PriceLevel[];
  totalBidVolume: number;
  totalAskVolume: number;
  weightedBidPrice: number;
  weightedAskPrice: number;
  spread: number;
  spreadPercentage: number;
}
