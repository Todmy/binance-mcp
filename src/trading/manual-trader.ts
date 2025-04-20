import { EventEmitter } from 'events';
import { MarketScanner } from '../analysis/market-scanner';
import { OpportunityScorer } from '../analysis/opportunity-scorer';
import { TradingEngine } from '../core/trading-engine';
import { Trade } from '../config/types';

interface TradeSuggestion {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  price?: number;
  quantity: number;
  stopLoss?: number;
  takeProfit?: number;
  score: number;
  reason: string;
}

interface ManualTraderConfig {
  maxConcurrentTrades: number;
  defaultStopLossPercent: number;
  defaultTakeProfitPercent: number;
  minimumScore: number;
  tradingEnabled: boolean;
}

export class ManualTrader extends EventEmitter {
  private scanner: MarketScanner;
  private scorer: OpportunityScorer;
  private engine: TradingEngine;
  private config: ManualTraderConfig;
  private pendingSuggestions: Map<string, TradeSuggestion> = new Map();
  private activeTrades: Map<string, Trade> = new Map();

  constructor(
    engine: TradingEngine,
    scanner: MarketScanner,
    scorer: OpportunityScorer
  ) {
    super();
    this.engine = engine;
    this.scanner = scanner;
    this.scorer = scorer;
    this.config = {
      maxConcurrentTrades: 3,
      defaultStopLossPercent: 1,
      defaultTakeProfitPercent: 2,
      minimumScore: 0.7,
      tradingEnabled: false
    };

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for market opportunities
    this.scanner.on('opportunity', ({ symbol, metrics }) => {
      const score = this.scorer.scoreOpportunity(symbol, metrics);
      if (score.totalScore >= this.config.minimumScore) {
        this.generateTradeSuggestion(symbol, score);
      }
    });

    // Listen for trade executions
    this.engine.on('tradeExecuted', ({ trade }) => {
      this.activeTrades.set(trade.id, trade);
      this.emit('tradeExecuted', trade);
    });

    // Listen for trade completions
    this.engine.on('tradeClosed', (tradeId: string) => {
      this.activeTrades.delete(tradeId);
      this.emit('tradeClosed', tradeId);
    });
  }

  private async generateTradeSuggestion(
    symbol: string,
    score: any
  ): Promise<void> {
    const currentPrice = await this.engine.getCurrentPrice(symbol);
    if (!currentPrice) return;

    // Determine trade direction based on momentum
    const side = score.raw.momentum > 0 ? 'BUY' : 'SELL';

    // Calculate suggested position size based on volatility and volume
    const baseQuantity = 100; // Base position size in quote currency
    const adjustedQuantity = baseQuantity * (1 + score.metrics.volumeScore);
    const quantity = adjustedQuantity / currentPrice;

    // Calculate stop loss and take profit levels
    const stopLossPercent = this.config.defaultStopLossPercent * (1 + score.metrics.volatilityScore);
    const takeProfitPercent = this.config.defaultTakeProfitPercent * (1 + score.metrics.volatilityScore);

    const stopLoss = side === 'BUY'
      ? currentPrice * (1 - stopLossPercent / 100)
      : currentPrice * (1 + stopLossPercent / 100);

    const takeProfit = side === 'BUY'
      ? currentPrice * (1 + takeProfitPercent / 100)
      : currentPrice * (1 - takeProfitPercent / 100);

    const suggestion: TradeSuggestion = {
      symbol,
      side,
      type: 'LIMIT',
      price: currentPrice,
      quantity,
      stopLoss,
      takeProfit,
      score: score.totalScore,
      reason: `High ${side === 'BUY' ? 'bullish' : 'bearish'} momentum with volatility score ${score.metrics.volatilityScore.toFixed(2)}`
    };

    const suggestionId = `${symbol}_${Date.now()}`;
    this.pendingSuggestions.set(suggestionId, suggestion);
    this.emit('tradeSuggestion', { id: suggestionId, ...suggestion });

    // Auto-cleanup old suggestions after 5 minutes
    setTimeout(() => {
      this.pendingSuggestions.delete(suggestionId);
    }, 5 * 60 * 1000);
  }

  public async approveSuggestion(suggestionId: string): Promise<string | null> {
    if (!this.config.tradingEnabled) {
      throw new Error('Trading is currently disabled');
    }

    const suggestion = this.pendingSuggestions.get(suggestionId);
    if (!suggestion) {
      throw new Error('Trade suggestion not found or expired');
    }

    if (this.activeTrades.size >= this.config.maxConcurrentTrades) {
      throw new Error('Maximum number of concurrent trades reached');
    }

    try {
      const trade = await this.engine.createTrade({
        symbol: suggestion.symbol,
        side: suggestion.side,
        type: suggestion.type,
        quantity: suggestion.quantity,
        price: suggestion.price,
        stopLoss: suggestion.stopLoss,
        takeProfit: suggestion.takeProfit
      });

      await this.engine.approveTrade(trade.id);
      this.pendingSuggestions.delete(suggestionId);
      return trade.id;
    } catch (error) {
      console.error('Failed to execute trade:', error);
      return null;
    }
  }

  public rejectSuggestion(suggestionId: string): void {
    this.pendingSuggestions.delete(suggestionId);
    this.emit('suggestionRejected', suggestionId);
  }

  public async closePosition(tradeId: string): Promise<boolean> {
    const trade = this.activeTrades.get(tradeId);
    if (!trade) {
      throw new Error('Trade not found');
    }

    try {
      await this.engine.createTrade({
        symbol: trade.symbol,
        side: trade.side === 'BUY' ? 'SELL' : 'BUY',
        type: 'MARKET',
        quantity: trade.quantity,
        reduceOnly: true
      });
      return true;
    } catch (error) {
      console.error('Failed to close position:', error);
      return false;
    }
  }

  public updateConfig(newConfig: Partial<ManualTraderConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getActiveTrades(): Trade[] {
    return Array.from(this.activeTrades.values());
  }

  public getPendingSuggestions(): { id: string; suggestion: TradeSuggestion }[] {
    return Array.from(this.pendingSuggestions.entries()).map(([id, suggestion]) => ({
      id,
      suggestion
    }));
  }

  public enableTrading(enabled: boolean): void {
    this.config.tradingEnabled = enabled;
    this.emit('tradingStatusChanged', enabled);
  }
}
