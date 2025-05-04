import { RiskCalculator } from '../../risk/risk-calculator';
import { VolatilityAnalyzer } from '../../risk/volatility-analyzer';
import { BinanceClient } from '../../core/binance-types';
import { VolatilityMetrics } from '../../risk/volatility-analyzer';
import { FuturesPositionRisk } from '../../core/binance-types';

jest.mock('../../risk/volatility-analyzer');

describe('RiskCalculator', () => {
  let riskCalculator: RiskCalculator;
  let mockClient: jest.Mocked<BinanceClient>;

  const mockPosition: FuturesPositionRisk = {
    symbol: 'BTCUSDT',
    positionAmount: '1',
    entryPrice: '45000',
    leverage: '10',
    marginType: 'isolated',
    isolatedWallet: '4500',
    unRealizedProfit: '0',
    markPrice: '45000',
    liquidationPrice: '30000',
    isolatedMargin: '4500',
    isAutoAddMargin: "false",
    positionSide: 'BOTH',
    notional: '45000',
    updateTime: 1234567890
  };

  const mockVolatilityMetrics: VolatilityMetrics = {
    volatilityScore: 0.02,
    standardDeviation: 0.015,
    coefficientOfVariation: 0.02,
    priceRange: {
      min: 44000,
      max: 46000
    },
    trend: 'STABLE'
  };

  const mockVolatilityHighRisk: VolatilityMetrics = {
    volatilityScore: 0.08,
    standardDeviation: 0.065,
    coefficientOfVariation: 0.08,
    priceRange: {
      min: 40000,
      max: 50000
    },
    trend: 'INCREASING'
  };

  beforeEach(() => {
    mockClient = {
      futuresCandles: jest.fn().mockResolvedValue([]),
      futuresAllBookTickers: jest.fn().mockResolvedValue({}),
      futuresOrder: jest.fn(),
      futuresCancelOrder: jest.fn(),
      futuresGetOrder: jest.fn(),
      futuresOpenOrders: jest.fn(),
      futuresPositionRisk: jest.fn(),
      futuresAccountBalance: jest.fn(),
      futures24hr: jest.fn()
    } as unknown as jest.Mocked<BinanceClient>;

    const mockVolatilityAnalyzer = {
      calculateVolatility: jest.fn().mockResolvedValue(mockVolatilityMetrics)
    };

    (VolatilityAnalyzer as jest.Mock).mockImplementation(() => mockVolatilityAnalyzer);

    riskCalculator = new RiskCalculator(mockClient);
  });

  describe('validateRiskLevels', () => {
    it('should accurately assess normal risk levels for positions', async () => {
      const positions = [mockPosition];
      const assessment = await riskCalculator.validateRiskLevels(positions);

      expect(assessment).toEqual(expect.objectContaining({
        maxLoss: expect.any(Number),
        currentRisk: expect.any(Number),
        warnings: expect.any(Array),
        recommendedActions: expect.any(Array)
      }));

      expect(assessment.currentRisk).toBeLessThan(0.5); // Risk score should be low for normal conditions
      expect(assessment.warnings).toHaveLength(0); // No warnings for normal conditions
    });

    it('should identify high leverage risk scenarios', async () => {
      const highRiskPosition: FuturesPositionRisk = {
        ...mockPosition,
        leverage: '20',
        isolatedMargin: '2250' // Reduced margin due to higher leverage
      };

      const assessment = await riskCalculator.validateRiskLevels([highRiskPosition]);

      expect(assessment.currentRisk).toBeGreaterThan(0.5);

      // Fix: Use arrayContaining with expect.stringMatching
      expect(assessment.warnings).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/high leverage/i)
        ])
      );

      expect(assessment.recommendedActions).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/reduce leverage/i)
        ])
      );
    });

    it('should identify increased risk during high volatility', async () => {
      const mockVolatilityAnalyzer = {
        calculateVolatility: jest.fn().mockResolvedValue(mockVolatilityHighRisk)
      };
      (VolatilityAnalyzer as jest.Mock).mockImplementation(() => mockVolatilityAnalyzer);

      const positions = [mockPosition];
      const assessment = await riskCalculator.validateRiskLevels(positions);

      expect(assessment.currentRisk).toBeGreaterThan(0.5);

      // Fix: Use arrayContaining with expect.stringMatching
      expect(assessment.warnings).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/high volatility/i)
        ])
      );

      expect(assessment.recommendedActions).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/reduce position size/i)
        ])
      );
    });

    it('should assess aggregate risk for multiple positions', async () => {
      const positions = [
        mockPosition,
        { ...mockPosition, symbol: 'ETHUSDT', entryPrice: '3000', notional: '3000' }
      ];

      const assessment = await riskCalculator.validateRiskLevels(positions);

      expect(assessment.maxLoss).toBeGreaterThan(0);
      expect(assessment.currentRisk).toBeGreaterThan(0);

      // Fix: Use arrayContaining with expect.stringMatching
      expect(assessment.warnings).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/multiple positions/i)
        ])
      );
    });
  });

  describe('assessOrderRisk', () => {
    it('should calculate accurate risk assessment for standard order parameters', async () => {
      const orderParams = {
        symbol: 'BTCUSDT',
        size: '1',
        price: '45000',
        leverage: 10
      };

      const assessment = await riskCalculator.assessOrderRisk(orderParams);

      expect(assessment).toEqual(expect.objectContaining({
        maxLoss: expect.any(Number),
        currentRisk: expect.any(Number),
        warnings: expect.any(Array),
        recommendedActions: expect.any(Array)
      }));

      expect(assessment.currentRisk).toBeLessThan(0.5);
      expect(assessment.warnings).toHaveLength(0);
    });

    it('should warn about high leverage and suggest risk mitigation', async () => {
      const highLeverageOrder = {
        symbol: 'BTCUSDT',
        size: '1',
        price: '45000',
        leverage: 20
      };

      const assessment = await riskCalculator.assessOrderRisk(highLeverageOrder);

      expect(assessment.currentRisk).toBeGreaterThan(0.5);

      // Fix: Use arrayContaining with expect.stringMatching
      expect(assessment.warnings).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/high leverage/i)
        ])
      );

      expect(assessment.recommendedActions).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/reduce leverage/i)
        ])
      );
    });

    it('should evaluate position sizing relative to account balance', async () => {
      const largeOrder = {
        symbol: 'BTCUSDT',
        size: '10',
        price: '45000',
        leverage: 5
      };

      mockClient.futuresAccountBalance.mockResolvedValueOnce([{
        asset: 'USDT',
        balance: '100000',
        accountAlias: 'test',
        crossWalletBalance: '100000',
        crossUnPnl: '0',
        availableBalance: '100000',
        maxWithdrawAmount: '100000',
        marginAvailable: true,
        updateTime: 1234567890
      }]);

      const assessment = await riskCalculator.assessOrderRisk(largeOrder);

      // Fix: Use arrayContaining with expect.stringMatching
      expect(assessment.warnings).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/large position/i)
        ])
      );

      expect(assessment.recommendedActions).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/reduce position size/i)
        ])
      );
    });
  });

  describe('error handling', () => {
    it('should handle volatility calculation errors gracefully', async () => {
      const mockError = new Error('API error');
      mockClient.futuresCandles.mockRejectedValueOnce(mockError);

      // Fix: Use expect().rejects pattern instead of try/catch with fail
      await expect(riskCalculator.validateRiskLevels([mockPosition]))
        .rejects.toThrow('Failed to validate risk levels');

      // Reset the mock to succeed for the second call
      mockClient.futuresCandles.mockResolvedValueOnce([]);

      const errorAssessment = await riskCalculator.validateRiskLevels([mockPosition]);

      // Use arrayContaining with expect.stringMatching
      expect(errorAssessment.warnings).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/volatility data unavailable/i)
        ])
      );

      expect(errorAssessment.currentRisk).toBeGreaterThan(0.5); // Higher risk when data is missing
    });

    it('should handle market data errors during order assessment', async () => {
      const mockError = new Error('Market data error');
      mockClient.futuresAllBookTickers.mockRejectedValueOnce(mockError);

      // Fix: Use expect().rejects pattern instead of try/catch with fail
      await expect(riskCalculator.assessOrderRisk({
        symbol: 'BTCUSDT',
        size: '1',
        price: '45000',
        leverage: 10
      })).rejects.toThrow('Failed to assess order risk');
    });

    it('should handle invalid position data', async () => {
      const invalidPosition = {
        ...mockPosition,
        entryPrice: 'invalid'
      };

      await expect(riskCalculator.validateRiskLevels([invalidPosition]))
        .rejects.toThrow('Invalid position data');
    });

    it('should handle network timeout errors', async () => {
      const timeoutError = new Error('Network timeout');
      mockClient.futuresCandles.mockRejectedValueOnce(timeoutError);
      mockClient.futuresAllBookTickers.mockRejectedValueOnce(timeoutError);

      const assessment = await riskCalculator.validateRiskLevels([mockPosition]);

      // Fix: Use arrayContaining with expect.stringMatching
      expect(assessment.warnings).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/network issues/i)
        ])
      );

      expect(assessment.recommendedActions).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/retry/i)
        ])
      );
    });
  });
});
