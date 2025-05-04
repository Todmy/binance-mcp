import { BinanceClient, NewFuturesOrder, FuturesPositionRisk } from '../core/binance-types';
import { MarketDataError } from '../common/errors';
import { PriceCalculator, VolatilityResult } from '../tools/math/price-calculator';

export interface RiskAssessment {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  marginRatio: number;
  effectiveLeverage: number;
  potentialLoss: number;
  volatilityScore: number;
  liquidationRisk: {
    distanceToLiquidation: number;
    percentageToLiquidation: number;
    estimatedLiquidationTime?: number;
  };
  recommendations: {
    maxPositionSize: number;
    suggestedLeverage: number;
    stopLossPrice: number;
    takeProfitPrice: number;
  };
  warnings: string[];
}

export interface RiskParameters {
  maxRiskPerTrade: number;
  maxLeverage: number;
  stopLossPercentage: number;
  takeProfitRatio: number;
  marginBuffer: number;
  volatilityThreshold: number;
  maxLeverageMultiplier: number;
  maxLossPercent: number;
}

const DEFAULT_RISK_PARAMS: RiskParameters = {
  maxRiskPerTrade: 0.02, // 2% of account balance
  maxLeverage: 20,
  stopLossPercentage: 0.02, // 2%
  takeProfitRatio: 2, // 2:1 reward-to-risk ratio
  marginBuffer: 0.5, // 50% buffer on required margin
  volatilityThreshold: 0.05, // 5% volatility threshold
  maxLeverageMultiplier: 10,
  maxLossPercent: 2 // 2% maximum loss per trade
};

export class RiskManagementService {
  private readonly priceCalculator: PriceCalculator;
  private readonly riskParams: RiskParameters;

  constructor(
    private readonly client: BinanceClient,
    private readonly customRiskParams?: Partial<RiskParameters>
  ) {
    this.priceCalculator = new PriceCalculator();
    this.riskParams = {
      ...DEFAULT_RISK_PARAMS,
      ...customRiskParams
    };
  }

  async assessPositionRisk(symbol: string): Promise<RiskAssessment> {
    try {
      const [positionRisk, balance] = await Promise.all([
        this.getPositionRisk(symbol),
        this.getAccountBalance()
      ]);

      const volatility = await this.calculateVolatility(symbol);
      const marginRatio = this.calculateMarginRatio(positionRisk);
      const warnings: string[] = [];

      // Calculate risk level based on multiple factors
      const riskLevel = this.determineRiskLevel({
        marginRatio,
        volatility,
        positionRisk
      });

      // Calculate potential loss
      const potentialLoss = this.calculatePotentialLoss(positionRisk);

      // Analyze liquidation risk
      const liquidationRisk = this.analyzeLiquidationRisk(positionRisk, volatility);

      // Generate position recommendations
      const recommendations = this.generateRecommendations(
        positionRisk,
        balance,
        volatility
      );

      // Add warnings based on risk analysis
      if (marginRatio > 0.7) {
        warnings.push('High margin utilization - consider reducing position size');
      }
      if (liquidationRisk.percentageToLiquidation < 0.1) {
        warnings.push('Close to liquidation price - immediate action recommended');
      }
      if (volatility.coefficientOfVariation > 0.1) {
        warnings.push('High market volatility - consider reducing exposure');
      }

      return {
        riskLevel,
        marginRatio,
        effectiveLeverage: parseFloat(positionRisk.leverage),
        potentialLoss,
        volatilityScore: volatility.coefficientOfVariation,
        liquidationRisk,
        recommendations,
        warnings
      };
    } catch (error) {
      throw new Error(`Failed to assess position risk: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async validatePosition(
    symbol: string,
    size: number,
    leverage: number
  ): Promise<boolean> {
    try {
      const balance = await this.getAccountBalance();
      const positionValue = size * leverage;
      const maxPositionValue = balance * this.getRiskParams().maxRiskPerTrade * leverage;

      if (positionValue > maxPositionValue) {
        throw new Error('Position size exceeds maximum allowed risk exposure');
      }

      if (leverage > this.getRiskParams().maxLeverage) {
        throw new Error(`Leverage exceeds maximum allowed (${this.getRiskParams().maxLeverage})`);
      }

      return true;
    } catch (error) {
      throw new Error(`Position validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async calculateOptimalPositionSize(
    symbol: string,
    accountRisk: number = this.getRiskParams().maxRiskPerTrade
  ): Promise<{
    maxPositionSize: number;
    recommendedLeverage: number;
    stopLoss: number;
    takeProfit: number;
  }> {
    try {
      const [balance, positionRisk] = await Promise.all([
        this.getAccountBalance(),
        this.getPositionRisk(symbol)
      ]);

      const volatility = await this.calculateVolatility(symbol);
      const currentPrice = parseFloat(positionRisk.markPrice);
      const riskAmount = balance * accountRisk;

      // Calculate optimal position size based on volatility and risk parameters
      const stopLossDistance = Math.max(
        currentPrice * this.getRiskParams().stopLossPercentage,
        currentPrice * volatility.standardDeviation
      );

      const stopLoss = currentPrice - stopLossDistance;
      const takeProfit = currentPrice + (stopLossDistance * this.getRiskParams().takeProfitRatio);

      // Calculate position size that risks the specified amount
      const maxPositionSize = riskAmount / (currentPrice - stopLoss);

      // Determine recommended leverage based on position size and available margin
      const recommendedLeverage = Math.min(
        this.getRiskParams().maxLeverage,
        Math.ceil(maxPositionSize * currentPrice / (balance * this.getRiskParams().marginBuffer))
      );

      return {
        maxPositionSize,
        recommendedLeverage,
        stopLoss,
        takeProfit
      };
    } catch (error) {
      throw new Error(`Failed to calculate optimal position size: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async checkOrderRisk(order: NewFuturesOrder): Promise<void> {
    try {
      const position = await this.getCurrentPosition(order.symbol);
      const dailyStats = await this.client.futures24hr();
      const stats = dailyStats.find(s => s.symbol === order.symbol);

      if (!stats) {
        throw new MarketDataError(`No market data found for ${order.symbol}`);
      }

      // Calculate volatility
      const volatility = Math.abs(parseFloat(stats.priceChangePercent)) / 100;
      const currentPrice = parseFloat(stats.lastPrice);
      const orderSize = parseFloat(order.quantity);
      const exposure = orderSize * currentPrice;

      // Check position limits
      if (position) {
        const totalExposure = exposure + parseFloat(position.notional);
        const maxAllowedExposure = this.calculateMaxExposure(position);

        if (totalExposure > maxAllowedExposure) {
          throw new MarketDataError('Order would exceed maximum allowed position exposure');
        }
      }

      // Check volatility risk
      if (volatility > this.riskParams.volatilityThreshold) {
        throw new MarketDataError('Market volatility exceeds risk threshold');
      }

      // Check leverage risk
      if (position && parseFloat(position.leverage) > this.riskParams.maxLeverageMultiplier) {
        throw new MarketDataError('Current leverage exceeds maximum allowed');
      }

      // Calculate potential loss
      const potentialLoss = this.calculatePotentialLoss(order, currentPrice);
      if (potentialLoss > this.riskParams.maxLossPercent) {
        throw new MarketDataError('Potential loss exceeds maximum allowed percentage');
      }
    } catch (error) {
      if (error instanceof MarketDataError) {
        throw error;
      }
      throw new MarketDataError(`Failed to check order risk: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async getCurrentPosition(symbol: string): Promise<FuturesPositionRisk | null> {
    const positions = await this.client.futuresPositionRisk({ symbol });
    return positions.find(p => p.symbol === symbol) || null;
  }

  private calculateMaxExposure(position: FuturesPositionRisk): number {
    const accountValue = parseFloat(position.isolatedWallet);
    return accountValue * this.riskParams.maxLeverageMultiplier;
  }

  private calculatePotentialLoss(input: NewFuturesOrder | FuturesPositionRisk, currentPrice?: number): number {
    if ('positionAmount' in input) {
      // Handle FuturesPositionRisk
      const position = input;
      const entryPrice = parseFloat(position.entryPrice);
      const positionSize = parseFloat(position.positionAmount);
      const leverage = parseFloat(position.leverage);

      return Math.abs((parseFloat(position.markPrice) - entryPrice) * positionSize * leverage);
    } else {
      // Handle NewFuturesOrder
      const order = input;
      if (!currentPrice) {
        throw new Error('Current price is required for order risk calculation');
      }

      const orderSize = parseFloat(order.quantity);
      const orderPrice = order.price ? parseFloat(order.price) : currentPrice;

      // Calculate maximum potential loss based on order type
      let maxLoss: number;
      if (order.type === 'MARKET' || order.type === 'LIMIT') {
        maxLoss = Math.abs(orderSize * (orderPrice - currentPrice));
      } else if (order.stopPrice) {
        maxLoss = Math.abs(orderSize * (parseFloat(order.stopPrice) - orderPrice));
      } else {
        maxLoss = orderSize * orderPrice * 0.1; // Default to 10% for other order types
      }

      return (maxLoss / (orderSize * orderPrice)) * 100;
    }
  }

  private async getPositionRisk(symbol: string): Promise<FuturesPositionRisk> {
    try {
      const positions = await this.client.futuresPositionRisk({ symbol });
      const position = positions.find(p => p.symbol === symbol);

      if (!position) {
        throw new Error(`No position found for ${symbol}`);
      }

      return position;
    } catch (error) {
      throw new MarketDataError(`Failed to get position risk: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async getAccountBalance(): Promise<number> {
    try {
      const balances = await this.client.futuresAccountBalance();
      const usdtBalance = balances.find(b => b.asset === 'USDT');

      if (!usdtBalance) {
        throw new Error('No USDT balance found');
      }

      return parseFloat(usdtBalance.availableBalance);
    } catch (error) {
      throw new Error(`Failed to get account balance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async calculateVolatility(symbol: string): Promise<VolatilityResult> {
    try {
      const candles = await this.client.futuresCandles({
        symbol,
        interval: '1h',
        limit: 24
      });

      const prices = candles.map(candle => parseFloat(candle.close));
      return this.priceCalculator.calculateVolatility(prices);
    } catch (error) {
      throw new MarketDataError(`Failed to calculate volatility: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private calculateMarginRatio(position: FuturesPositionRisk): number {
    const notional = parseFloat(position.notional);
    const isolatedMargin = parseFloat(position.isolatedMargin);
    return notional > 0 ? isolatedMargin / notional : 0;
  }

  private determineRiskLevel(params: {
    marginRatio: number;
    volatility: VolatilityResult;
    positionRisk: FuturesPositionRisk;
  }): RiskAssessment['riskLevel'] {
    const { marginRatio, volatility, positionRisk } = params;
    const leverage = parseFloat(positionRisk.leverage);

    // High risk if any of these conditions are met
    if (
      marginRatio > 0.8 ||
      volatility.coefficientOfVariation > 0.15 ||
      leverage > 10
    ) {
      return 'HIGH';
    }

    // Medium risk if any of these conditions are met
    if (
      marginRatio > 0.6 ||
      volatility.coefficientOfVariation > 0.1 ||
      leverage > 5
    ) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  private analyzeLiquidationRisk(
    position: FuturesPositionRisk,
    volatility: VolatilityResult
  ): RiskAssessment['liquidationRisk'] {
    const currentPrice = parseFloat(position.markPrice);
    const liquidationPrice = parseFloat(position.liquidationPrice);
    const distanceToLiquidation = Math.abs(currentPrice - liquidationPrice);
    const percentageToLiquidation = (distanceToLiquidation / currentPrice) * 100;

    // Estimate time to liquidation based on volatility
    let estimatedLiquidationTime: number | undefined;
    if (volatility.standardDeviation > 0) {
      const hoursToLiquidation = distanceToLiquidation / (currentPrice * volatility.standardDeviation);
      estimatedLiquidationTime = hoursToLiquidation * 3600000; // Convert to milliseconds
    }

    return {
      distanceToLiquidation,
      percentageToLiquidation,
      estimatedLiquidationTime
    };
  }

  private generateRecommendations(
    position: FuturesPositionRisk,
    balance: number,
    volatility: VolatilityResult
  ): RiskAssessment['recommendations'] {
    const currentPrice = parseFloat(position.markPrice);

    // Calculate maximum safe position size based on account balance and volatility
    const maxPositionSize = (balance * this.getRiskParams().maxRiskPerTrade) /
      (currentPrice * volatility.standardDeviation);

    // Suggest lower leverage in high volatility conditions
    const volatilityAdjustedLeverage = Math.min(
      this.getRiskParams().maxLeverage,
      Math.floor(1 / volatility.coefficientOfVariation)
    );

    // Calculate stop loss and take profit levels
    const stopLossDistance = currentPrice * Math.max(
      this.getRiskParams().stopLossPercentage,
      volatility.standardDeviation
    );

    const stopLossPrice = currentPrice - stopLossDistance;
    const takeProfitPrice = currentPrice + (stopLossDistance * this.getRiskParams().takeProfitRatio);

    return {
      maxPositionSize,
      suggestedLeverage: volatilityAdjustedLeverage,
      stopLossPrice,
      takeProfitPrice
    };
  }

  private getRiskParams(): RiskParameters {
    return {
      ...this.riskParams
    };
  }
}
