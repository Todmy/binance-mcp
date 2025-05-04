import { BinanceClient, FuturesOrder } from '../core/binance-types';
import { RiskCalculator } from '../risk/risk-calculator';

export interface Position {
  symbol: string;
  positionAmount: string;
  entryPrice: string;
  markPrice?: string;
  leverage: number;
  marginType: 'isolated' | 'cross';
  positionSide: 'BOTH' | 'LONG' | 'SHORT';
  isolatedMargin?: string;
  unrealizedProfit: string;
  liquidationPrice: string;
}

export interface PositionRisk {
  liquidationRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  marginRatio: number;
  leverageLevel: number;
  maxLoss: number;
  suggestedActions?: string[];
  warnings?: string[];
}

export interface PositionManager {
  getCurrentPosition(symbol: string): Promise<Position | null>;
  calculateMaxPosition(symbol: string): Promise<number>;
  validatePositionSize(symbol: string, size: number): Promise<boolean>;
  getPositionRisk(symbol: string): Promise<PositionRisk>;
  setLeverage(symbol: string, leverage: number): Promise<boolean>;
  setMarginType(symbol: string, marginType: 'ISOLATED' | 'CROSS'): Promise<boolean>;
  getOptimalLeverage(symbol: string, targetRisk: 'LOW' | 'MEDIUM' | 'HIGH'): Promise<{
    recommendedLeverage: number;
    maxSafeLeverage: number;
    reasoning: string[];
  }>;
  updatePosition(order: FuturesOrder): Promise<void>;
}

export class BinancePositionManager implements PositionManager {
  constructor(
    private readonly client: BinanceClient,
    private readonly riskCalculator: RiskCalculator
  ) {}

  async getCurrentPosition(symbol: string): Promise<Position | null> {
    try {
      const positions = await this.client.futuresPositionRisk({ symbol });
      const position = positions.find(p => p.symbol === symbol);

      if (!position || parseFloat(position.positionAmount) === 0) {
        return null;
      }

      return {
        symbol: position.symbol,
        positionAmount: position.positionAmount,
        entryPrice: position.entryPrice,
        markPrice: position.markPrice,
        leverage: parseFloat(position.leverage),
        marginType: position.marginType.toLowerCase() as 'isolated' | 'cross',
        positionSide: position.positionSide,
        isolatedMargin: position.isolatedMargin,
        unrealizedProfit: position.unRealizedProfit,
        liquidationPrice: position.liquidationPrice
      };
    } catch (error) {
      throw new Error(`Failed to get current position: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async calculateMaxPosition(symbol: string): Promise<number> {
    try {
      // Get account balance
      const balances = await this.client.futuresAccountBalance();
      const usdtBalance = balances.find(b => b.asset === 'USDT');

      if (!usdtBalance) {
        throw new Error('No USDT balance found');
      }

      // Get current market price
      const tickers = await this.client.futuresAllBookTickers();
      const ticker = tickers[symbol];

      if (!ticker) {
        throw new Error('No market data available');
      }

      const availableBalance = parseFloat(usdtBalance.availableBalance);
      const currentPrice = parseFloat(ticker.bestBidPrice);

      // Calculate max position size based on available balance and current price
      // Using 80% of available balance as a safety margin
      return (availableBalance * 0.8) / currentPrice;
    } catch (error) {
      throw new Error(`Failed to calculate max position: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async validatePositionSize(symbol: string, size: number): Promise<boolean> {
    try {
      // Get max allowed position size
      const maxPosition = await this.calculateMaxPosition(symbol);

      // Get current position if any
      const currentPosition = await this.getCurrentPosition(symbol);
      const currentSize = currentPosition ? Math.abs(parseFloat(currentPosition.positionAmount)) : 0;

      // Calculate total position size
      const totalSize = currentSize + Math.abs(size);

      // Validate against max position
      return totalSize <= maxPosition;
    } catch (error) {
      throw new Error(`Failed to validate position size: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getPositionRisk(symbol: string): Promise<PositionRisk> {
    try {
      const position = await this.getCurrentPosition(symbol);

      if (!position) {
        return {
          maxLoss: 0,
          liquidationRisk: 'LOW',
          leverageLevel: 0,
          marginRatio: 0
        };
      }

      const riskAssessment = await this.riskCalculator.validateRiskLevels([{
        symbol: position.symbol,
        positionAmount: position.positionAmount,
        entryPrice: position.entryPrice,
        markPrice: position.markPrice || position.entryPrice,
        unRealizedProfit: position.unrealizedProfit,
        liquidationPrice: position.liquidationPrice,
        leverage: position.leverage.toString(),
        marginType: position.marginType,
        isolatedMargin: position.isolatedMargin || '0',
        isAutoAddMargin: 'false',
        positionSide: position.positionSide,
        notional: (parseFloat(position.positionAmount) * parseFloat(position.entryPrice)).toString(),
        isolatedWallet: position.isolatedMargin || '0',
        updateTime: Date.now()
      }]);

      const marginRatio = position.isolatedMargin ?
        parseFloat(position.isolatedMargin) / (parseFloat(position.positionAmount) * parseFloat(position.entryPrice)) : 0;

      // Convert numerical risk assessment to categorical
      const riskLevel = marginRatio > 0.75 ? 'HIGH' :
        marginRatio > 0.5 ? 'MEDIUM' : 'LOW';

      return {
        maxLoss: riskAssessment.maxLoss,
        liquidationRisk: riskLevel,
        leverageLevel: position.leverage,
        marginRatio
      };
    } catch (error) {
      throw new Error(`Failed to get position risk: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async setLeverage(symbol: string, leverage: number): Promise<boolean> {
    try {
      await this.client.futuresLeverage({
        symbol: symbol,
        leverage: leverage
      });
      return true;
    } catch (error) {
      throw new Error(`Failed to set leverage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async setMarginType(symbol: string, marginType: 'ISOLATED' | 'CROSS'): Promise<boolean> {
    try {
      await this.client.futuresMarginType({
        symbol: symbol,
        marginType: marginType
      });
      return true;
    } catch (error) {
      throw new Error(`Failed to set margin type: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getOptimalLeverage(
    symbol: string,
    targetRisk: 'LOW' | 'MEDIUM' | 'HIGH'
  ): Promise<{ recommendedLeverage: number; maxSafeLeverage: number; reasoning: string[] }> {
    try {
      const marketStats = await this.client.futuresDaily({ symbol });
      const volatility = Math.abs(parseFloat(marketStats.priceChangePercent)) / 100;

      let maxLeverage: number;
      let recommendedLeverage: number;
      const reasoning: string[] = [];

      // Calculate based on volatility and target risk
      if (volatility > 0.05) {
        maxLeverage = 10;
        reasoning.push('High market volatility detected');
      } else if (volatility > 0.02) {
        maxLeverage = 20;
        reasoning.push('Moderate market volatility detected');
      } else {
        maxLeverage = 50;
        reasoning.push('Low market volatility detected');
      }

      // Adjust based on target risk level
      switch (targetRisk) {
        case 'LOW':
          recommendedLeverage = Math.min(5, maxLeverage);
          reasoning.push('Conservative risk profile selected');
          break;
        case 'MEDIUM':
          recommendedLeverage = Math.min(10, maxLeverage);
          reasoning.push('Balanced risk profile selected');
          break;
        case 'HIGH':
          recommendedLeverage = Math.min(20, maxLeverage);
          reasoning.push('Aggressive risk profile selected');
          break;
      }

      // Add current market context
      reasoning.push(`Current trend strength: ${volatility > 0.03 ? 'strong' : 'moderate'}`);

      return {
        recommendedLeverage,
        maxSafeLeverage: maxLeverage,
        reasoning
      };
    } catch (error) {
      throw new Error(`Failed to calculate optimal leverage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updatePosition(order: FuturesOrder): Promise<void> {
    try {
      // Refresh position data after order execution
      const currentPosition = await this.getCurrentPosition(order.symbol);

      // If position exists, validate risk levels
      if (currentPosition) {
        await this.riskCalculator.validateRiskLevels([{
          symbol: currentPosition.symbol,
          positionAmount: currentPosition.positionAmount,
          entryPrice: currentPosition.entryPrice,
          markPrice: currentPosition.markPrice || currentPosition.entryPrice,
          leverage: currentPosition.leverage.toString(),
          marginType: currentPosition.marginType.toLowerCase() as 'isolated' | 'cross',
          isolatedMargin: currentPosition.isolatedMargin || '0',
          isAutoAddMargin: 'false',
          positionSide: currentPosition.positionSide,
          notional: (parseFloat(currentPosition.positionAmount) * parseFloat(currentPosition.entryPrice)).toString(),
          isolatedWallet: currentPosition.isolatedMargin || '0',
          updateTime: Date.now(),
          unRealizedProfit: currentPosition.unrealizedProfit,
          liquidationPrice: currentPosition.liquidationPrice
        }]);
      }
    } catch (error) {
      throw new Error(`Failed to update position: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
