import { BinanceClient, NewFuturesOrder } from '../../core/binance-types';
import { OrderSide, OrderType } from 'binance-api-node';
import { RiskManagementService } from '../../risk/risk-management-service';
import { Position } from '../../trading/position-manager';

const mockOrder: NewFuturesOrder = {
  symbol: 'BTCUSDT',
  side: 'BUY' as OrderSide,
  type: 'LIMIT' as OrderType,
  quantity: '1',
  price: '50000'
};

const mockPosition: Position = {
  symbol: 'BTCUSDT',
  positionAmount: '1',
  entryPrice: '50000',
  unrealizedProfit: '1000',
  leverage: 10,
  liquidationPrice: '45000',
  marginType: 'isolated',
  isolatedMargin: '5000',
  positionSide: 'BOTH'
};

const mockClient: jest.Mocked<BinanceClient> = {
  futures24hr: jest.fn().mockResolvedValue([{
    symbol: 'BTCUSDT',
    priceChangePercent: '-1.5',
    lastPrice: '49000',
    volume: '1000',
    quoteVolume: '49000000'
  }]),
  futuresPositionRisk: jest.fn().mockResolvedValue([{
    symbol: 'BTCUSDT',
    positionAmount: '1',
    entryPrice: '50000',
    markPrice: '49000',
    unRealizedProfit: '-1000',
    liquidationPrice: '45000',
    leverage: '10',
    marginType: 'isolated',
    isolatedMargin: '5000',
    isAutoAddMargin: 'false',
    positionSide: 'BOTH',
    notional: '49000',
    isolatedWallet: '5000',
    updateTime: Date.now()
  }])
} as unknown as jest.Mocked<BinanceClient>;

describe('RiskManagementService', () => {
  let riskManagementService: RiskManagementService;

  beforeEach(() => {
    riskManagementService = new RiskManagementService(mockClient);
    jest.clearAllMocks();
  });

  describe('checkOrderRisk', () => {
    it('should validate order risk within limits', async () => {
      const result = await riskManagementService.checkOrderRisk(mockOrder);
      expect(result).toBe(true);
    });

    it('should reject high-risk orders', async () => {
      const highRiskOrder = {
        ...mockOrder,
        quantity: '10'
      };

      await expect(riskManagementService.checkOrderRisk(highRiskOrder))
        .rejects.toThrow(/risk limits/);
    });
  });

  describe('validateRiskLevels', () => {
    it('should validate position risk levels', async () => {
      const positions = [mockPosition];
      const result = await riskManagementService.validateRiskLevels(positions);
      expect(result).toBe(true);
    });
  });

  describe('position risk assessment', () => {
    it('should integrate volatility analysis in risk assessment', async () => {
      mockClient.futuresMarkPrice.mockResolvedValueOnce({
        symbol: 'BTCUSDT',
        markPrice: '45000',
        indexPrice: '45100',
        estimatedSettlePrice: '45050'
      });

      const assessment = await riskManagementService.assessPositionRisk('BTCUSDT');

      expect(assessment).toMatchObject({
        riskLevel: expect.stringMatching(/LOW|MEDIUM|HIGH/),
        marginRatio: expect.any(Number),
        effectiveLeverage: expect.any(Number),
        volatilityScore: expect.any(Number),
        liquidationRisk: {
          percentageToLiquidation: expect.any(Number),
          status: expect.stringMatching(/SAFE|WARNING|DANGER/)
        }
      });
    });

    it('should provide comprehensive risk recommendations', async () => {
      const position = {
        symbol: 'BTCUSDT',
        positionAmount: '1',
        entryPrice: '45000',
        markPrice: '44000',
        leverage: 20,
        marginType: 'ISOLATED',
        isolatedMargin: '2250'
      };

      mockClient.futuresPositionRisk.mockResolvedValueOnce([position]);

      const assessment = await riskManagementService.assessPositionRisk('BTCUSDT');

      expect(assessment.recommendations).toContain(expect.stringMatching(/leverage|margin|volatility/i));
      expect(assessment.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('portfolio risk analysis', () => {
    it('should analyze portfolio-wide risk factors', async () => {
      const positions = [
        {
          symbol: 'BTCUSDT',
          positionAmount: '1',
          entryPrice: '45000',
          markPrice: '45500',
          leverage: 10,
          marginType: 'ISOLATED'
        },
        {
          symbol: 'ETHUSDT',
          positionAmount: '10',
          entryPrice: '3000',
          markPrice: '3100',
          leverage: 5,
          marginType: 'ISOLATED'
        }
      ];

      mockClient.futuresPositionRisk.mockResolvedValueOnce(positions);

      const analysis = await riskManagementService.analyzePortfolioRisk();

      expect(analysis).toMatchObject({
        totalExposure: expect.any(Number),
        netExposure: expect.any(Number),
        correlationFactor: expect.any(Number),
        diversificationScore: expect.any(Number),
        riskConcentration: expect.any(Object),
        recommendations: expect.any(Array)
      });
    });

    it('should detect portfolio concentration risk', async () => {
      const positions = [
        {
          symbol: 'BTCUSDT',
          positionAmount: '2',
          entryPrice: '45000',
          markPrice: '45500',
          leverage: 15,
          marginType: 'ISOLATED'
        },
        {
          symbol: 'ETHUSDT',
          positionAmount: '0.1',
          entryPrice: '3000',
          markPrice: '3100',
          leverage: 5,
          marginType: 'ISOLATED'
        }
      ];

      mockClient.futuresPositionRisk.mockResolvedValueOnce(positions);

      const analysis = await riskManagementService.analyzePortfolioRisk();
      expect(analysis.riskConcentration.highConcentrationPairs).toContain('BTCUSDT');
      expect(analysis.recommendations).toContain(
        expect.stringMatching(/diversification|concentration/i)
      );
    });
  });

  describe('risk limit management', () => {
    it('should enforce position size limits based on risk parameters', async () => {
      const order = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: '5',
        price: '45000',
        leverage: 20
      };

      mockClient.futuresAccountBalance.mockResolvedValueOnce([{
        asset: 'USDT',
        balance: '100000',
        availableBalance: '50000'
      }]);

      await expect(riskManagementService.validateOrderRisk(order))
        .rejects.toThrow(/exceeds maximum position size/i);
    });

    it('should validate aggregate risk exposure', async () => {
      const positions = [
        {
          symbol: 'BTCUSDT',
          positionAmount: '1',
          entryPrice: '45000',
          markPrice: '45500',
          leverage: 10
        },
        {
          symbol: 'ETHUSDT',
          positionAmount: '10',
          entryPrice: '3000',
          markPrice: '3100',
          leverage: 5
        }
      ];

      mockClient.futuresPositionRisk.mockResolvedValueOnce(positions);

      const riskMetrics = await riskManagementService.calculateAggregateRisk();
      expect(riskMetrics).toMatchObject({
        totalNotional: expect.any(Number),
        weightedAvgLeverage: expect.any(Number),
        marginUtilization: expect.any(Number),
        riskScore: expect.any(Number)
      });
    });
  });
});
