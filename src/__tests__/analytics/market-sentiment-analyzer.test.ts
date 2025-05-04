import { BinanceClient } from '../../core/binance-types';
import { MarketSentimentAnalyzer } from '../../analytics/market-sentiment-analyzer';
import { TechnicalAnalysisService } from '../../analytics/technical-analysis-service';

jest.mock('../../analytics/technical-analysis-service');

describe('MarketSentimentAnalyzer', () => {
  let technicalAnalysis: jest.Mocked<TechnicalAnalysisService>;
  let sentimentAnalyzer: MarketSentimentAnalyzer;
  const mockUptrendCandle = {
    openTime: 1,
    open: '45000',
    high: '46000',
    low: '44000',
    close: '45500',
    volume: '100',
    closeTime: 2,
    quoteVolume: '4500000',
    trades: 1000,
    baseAssetVolume: '100',
    quoteAssetVolume: '4500000',
    fundingRate: '0.0001',
    openInterest: '1000000'
  };

  let mockClient: jest.Mocked<BinanceClient>;

  beforeEach(() => {
    mockClient = {
      futuresAllBookTickers: jest.fn().mockResolvedValue({}),
      futuresCandles: jest.fn().mockResolvedValue(Array(20).fill(mockUptrendCandle)),
      futures24hr: jest.fn().mockResolvedValue([]),
      futuresOrder: jest.fn().mockResolvedValue({}),
      futuresCancelOrder: jest.fn().mockResolvedValue({}),
      futuresGetOrder: jest.fn().mockResolvedValue({}),
      futuresPositionRisk: jest.fn().mockResolvedValue([]),
      futuresLeverage: jest.fn().mockResolvedValue({}),
      futuresMarginType: jest.fn().mockResolvedValue({}),
      futuresAccountBalance: jest.fn().mockResolvedValue([]),
      futuresOpenOrders: jest.fn().mockResolvedValue([])
    } as unknown as jest.Mocked<BinanceClient>;

    technicalAnalysis = jest.mocked(new TechnicalAnalysisService(mockClient));

    technicalAnalysis.analyzeTechnicals.mockResolvedValue({
      indicators: {
        rsi: 65, // Bullish RSI
        macd: {
          macd: 50,
          signal: 20,
          histogram: 30
        },
        bollinger: {
          upper: 45000,
          middle: 44000,
          lower: 43000
        },
        atr: 100,
        volume: {
          obv: 1000,
          vwap: 44500
        }
      },
      trends: {
        shortTerm: 'BULLISH',
        mediumTerm: 'BULLISH',
        longTerm: 'BULLISH'
      },
      support: [42000, 41000, 40000],
      resistance: [46000, 47000, 48000],
      volatility: {
        current: 0.02,
        trend: 'STABLE'
      }
    });

    sentimentAnalyzer = new MarketSentimentAnalyzer(technicalAnalysis, mockClient);
  });

  describe('analyzeSentiment', () => {
    it('should provide comprehensive market sentiment analysis', async () => {
      const analysis = await sentimentAnalyzer.analyzeSentiment('BTCUSDT');

      expect(analysis).toEqual({
        overall: expect.stringMatching(/BULLISH|BEARISH|NEUTRAL/),
        confidence: expect.any(Number),
        signals: {
          technical: {
            sentiment: expect.stringMatching(/BULLISH|BEARISH|NEUTRAL/),
            strength: expect.any(Number),
            indicators: expect.arrayContaining([
              expect.stringMatching(/RSI|MACD|Bollinger/)
            ])
          },
          momentum: {
            sentiment: expect.stringMatching(/BULLISH|BEARISH|NEUTRAL/),
            strength: expect.any(Number),
            factors: expect.arrayContaining([
              expect.stringMatching(/volume|momentum|trend/)
            ])
          },
          volatility: {
            level: expect.stringMatching(/HIGH|MEDIUM|LOW/),
            trend: expect.stringMatching(/INCREASING|DECREASING|STABLE/),
          }
        },
        marketConditions: {
          trend: expect.stringMatching(/TRENDING|RANGING|REVERSING/),
          strength: expect.any(Number),
          timeframe: '20 periods'
        },
        warnings: expect.arrayContaining([expect.any(String)])
      });
    });

    it('should detect bullish sentiment in strong uptrend', async () => {
      technicalAnalysis.analyzeTechnicals.mockResolvedValueOnce({
        indicators: {
          rsi: 65,
          macd: {
            macd: 100,
            signal: 50,
            histogram: 50
          },
          bollinger: {
            upper: 45000,
            middle: 44000,
            lower: 43000
          },
          atr: 100,
          volume: {
            obv: 1000,
            vwap: 44500
          }
        },
        trends: {
          shortTerm: 'BULLISH',
          mediumTerm: 'BULLISH',
          longTerm: 'BULLISH'
        },
        support: [42000, 41000, 40000],
        resistance: [46000, 47000, 48000],
        volatility: {
          current: 0.02,
          trend: 'STABLE'
        }
      });

      const analysis = await sentimentAnalyzer.analyzeSentiment('BTCUSDT');
      expect(analysis.overall).toBe('BULLISH');
      expect(analysis.confidence).toBeGreaterThan(0.4);
    });

    it('should generate appropriate warnings for high volatility', async () => {
      technicalAnalysis.analyzeTechnicals.mockResolvedValueOnce({
        indicators: {
          rsi: 50,
          macd: {
            macd: 0,
            signal: 0,
            histogram: 0
          },
          bollinger: {
            upper: 45000,
            middle: 44000,
            lower: 43000
          },
          atr: 200,
          volume: {
            obv: 1000,
            vwap: 44500
          }
        },
        trends: {
          shortTerm: 'NEUTRAL',
          mediumTerm: 'NEUTRAL',
          longTerm: 'NEUTRAL'
        },
        support: [42000, 41000, 40000],
        resistance: [46000, 47000, 48000],
        volatility: {
          current: 0.5,
          trend: 'INCREASING'
        }
      });

      const analysis = await sentimentAnalyzer.analyzeSentiment('BTCUSDT');
      expect(analysis.warnings).toContain('High market volatility detected');
      expect(analysis.confidence).toBeLessThan(0.5);
    });

    it('should detect conflicting signals and include appropriate warnings', async () => {
      // Mock data with conflicting signals
      technicalAnalysis.analyzeTechnicals.mockResolvedValueOnce({
        indicators: {
          rsi: 65, // Bullish RSI
          macd: {
            macd: -10, // Bearish MACD
            signal: 0,
            histogram: -10
          },
          bollinger: {
            upper: 45000,
            middle: 44000,
            lower: 43000
          },
          atr: 100,
          volume: {
            obv: 1000, // Strong volume
            vwap: 44500
          }
        },
        trends: {
          shortTerm: 'BULLISH',
          mediumTerm: 'BEARISH', // Conflicting trends
          longTerm: 'BEARISH'
        },
        support: [42000, 41000, 40000],
        resistance: [46000, 47000, 48000],
        volatility: {
          current: 0.02,
          trend: 'STABLE'
        }
      });

      mockClient.futuresCandles.mockResolvedValueOnce(Array(100).fill({
        ...mockUptrendCandle,
        volume: '2000', // High volume
        fundingRate: '-0.0002' // Negative funding rate (bearish)
      }));

      const analysis = await sentimentAnalyzer.analyzeSentiment('BTCUSDT');
      expect(analysis.warnings.some(warning => warning.match(/conflicting signals/i))).toBe(true);
      expect(analysis.warnings.some(warning => warning.match(/reduce position size/i))).toBe(true);

      // Verify that the confidence is reduced due to conflicts
      expect(analysis.confidence).toBeLessThan(0.8);
    });
  });

  describe('error handling', () => {
    it('should handle technical analysis errors', async () => {
      technicalAnalysis.analyzeTechnicals.mockRejectedValueOnce(
        new Error('Technical analysis failed')
      );

      await expect(sentimentAnalyzer.analyzeSentiment('BTCUSDT'))
        .rejects.toThrow('Failed to analyze market sentiment');
    });

    it('should handle market data errors', async () => {
      mockClient.futuresCandles.mockRejectedValueOnce(
        new Error('Failed to fetch candles')
      );

      await expect(sentimentAnalyzer.analyzeSentiment('BTCUSDT'))
        .rejects.toThrow('Failed to analyze market sentiment');
    });
  });
});
