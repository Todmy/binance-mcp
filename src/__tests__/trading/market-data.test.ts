import { jest } from '@jest/globals';
import Binance from 'binance-api-node';

jest.mock('binance-api-node', () => {
  return jest.fn().mockImplementation(() => ({
    futuresCandles: jest.fn(),
    futures24h: jest.fn(),
    futuresAllBookTickers: jest.fn()
  }));
});

describe('Market Data Tests', () => {
  let binanceClient: any;

  beforeEach(() => {
    binanceClient = Binance();
    jest.clearAllMocks();
  });

  describe('get_price functionality', () => {
    it('should return candle data', async () => {
      const mockResponse = [{
        openTime: 1683115200000,
        open: '45000.50',
        high: '45100.00',
        low: '44900.00',
        close: '45050.00',
        volume: '100.5',
        closeTime: 1683118800000,
        quoteVolume: '4525025.00',
        trades: 1000,
        baseAssetVolume: '50.25',
        quoteAssetVolume: '2262512.50'
      }];

      binanceClient.futuresCandles.mockResolvedValue(mockResponse);

      const result = await binanceClient.futuresCandles({
        symbol: 'BTCUSDT',
        interval: '1m'
      });

      expect(result).toEqual(mockResponse);
      expect(binanceClient.futuresCandles).toHaveBeenCalledWith({
        symbol: 'BTCUSDT',
        interval: '1m'
      });
    });

    it('should handle invalid symbol errors', async () => {
      binanceClient.futuresCandles.mockRejectedValue(new Error('Invalid symbol'));

      await expect(
        binanceClient.futuresCandles({
          symbol: 'INVALID',
          interval: '1m'
        })
      ).rejects.toThrow('Invalid symbol');
    });
  });

  describe('get_24hr_stats functionality', () => {
    it('should return 24h statistics', async () => {
      const mockResponse = [{
        symbol: 'BTCUSDT',
        priceChange: '1500.00',
        priceChangePercent: '3.45',
        weightedAvgPrice: '44750.25',
        lastPrice: '45000.50',
        lastQty: '0.125',
        openPrice: '43500.50',
        highPrice: '46000.00',
        lowPrice: '44000.00',
        volume: '1234.567',
        quoteVolume: '55555555.55',
        openTime: 1683115200000,
        closeTime: 1683201600000,
        firstId: 1000,
        lastId: 2000,
        count: 1000
      }];

      binanceClient.futures24h.mockResolvedValue(mockResponse);

      const result = await binanceClient.futures24h();

      expect(result).toEqual(mockResponse);
      expect(binanceClient.futures24h).toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      binanceClient.futures24h.mockRejectedValue(new Error('API error'));

      await expect(binanceClient.futures24h()).rejects.toThrow('API error');
    });
  });

  describe('get_book_ticker functionality', () => {
    it('should return best bid/ask prices', async () => {
      const mockResponse = {
        'BTCUSDT': {
          symbol: 'BTCUSDT',
          bidPrice: '44999.50',
          bidQty: '1.234',
          askPrice: '45000.50',
          askQty: '0.567',
          time: 1683115200000,
          eventTime: 1683115200000,
          eventType: 'bookTicker',
          priceChange: '500.00',
          priceChangePercent: '1.12',
          weightedAvgPrice: '44750.25',
          prevClosePrice: '44500.00',
          lastQty: '0.125',
          bestBid: '44999.50',
          bestBidQty: '1.234',
          bestAsk: '45000.50',
          bestAskQty: '0.567',
          openPrice: '44500.00',
          highPrice: '45100.00',
          lowPrice: '44400.00',
          volume: '1234.567',
          volumeQuote: '55555555.55',
          openTime: 1683115200000,
          closeTime: 1683201600000,
          firstTradeId: 1000,
          lastTradeId: 2000,
          totalTrades: 1000
        }
      };

      binanceClient.futuresAllBookTickers.mockResolvedValue(mockResponse);

      const result = await binanceClient.futuresAllBookTickers();

      expect(result).toEqual(mockResponse);
      expect(binanceClient.futuresAllBookTickers).toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      binanceClient.futuresAllBookTickers.mockRejectedValue(new Error('Network error'));

      await expect(binanceClient.futuresAllBookTickers()).rejects.toThrow('Network error');
    });

    it('should handle empty responses', async () => {
      binanceClient.futuresAllBookTickers.mockResolvedValue({});

      const result = await binanceClient.futuresAllBookTickers();

      expect(result).toEqual({});
    });
  });
});
