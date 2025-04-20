import { EventEmitter } from 'events';
import { Alert, AlertConfig, AlertCondition, AlertResult } from '../types/alerts';
import { TradingEngine } from '../core/trading-engine';
import { MarketScanner } from '../analysis/market-scanner';
import { HistoricalAnalyzer } from '../analysis/historical-analyzer';
import { SQLiteStorage } from '../storage/sqlite-storage';
import { v4 as uuidv4 } from 'uuid';

interface AlertHistoryEntry {
  value: number;
  timestamp: number;
}

export class AlertManager extends EventEmitter {
  private alerts: Map<string, Alert> = new Map();
  private valueHistory: Map<string, AlertHistoryEntry[]> = new Map();
  private storage: SQLiteStorage;
  private engine: TradingEngine;
  private scanner: MarketScanner;
  private analyzer: HistoricalAnalyzer;
  private checkInterval: number = 60 * 1000; // 1 minute
  private intervalId?: NodeJS.Timeout;

  constructor(
    storage: SQLiteStorage,
    engine: TradingEngine,
    scanner: MarketScanner,
    analyzer: HistoricalAnalyzer
  ) {
    super();
    this.storage = storage;
    this.engine = engine;
    this.scanner = scanner;
    this.analyzer = analyzer;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.scanner.on('statsUpdated', async () => {
      await this.checkAlerts();
    });
  }

  public async initialize(): Promise<void> {
    // Load alerts from storage
    const storedAlerts = await this.storage.getAlerts();
    storedAlerts.forEach(alert => {
      this.alerts.set(alert.id, alert);
    });

    // Start periodic checks
    this.intervalId = setInterval(() => this.checkAlerts(), this.checkInterval);
  }

  public async createAlert(config: AlertConfig): Promise<Alert> {
    const alert: Alert = {
      ...config,
      id: config.id || uuidv4(),
      createdAt: Date.now(),
      triggerCount: 0
    };

    this.alerts.set(alert.id, alert);
    await this.storage.saveAlert(alert);
    return alert;
  }

  public async updateAlert(id: string, update: Partial<AlertConfig>): Promise<Alert | null> {
    const alert = this.alerts.get(id);
    if (!alert) return null;

    const updatedAlert: Alert = {
      ...alert,
      ...update,
      id: alert.id,
      createdAt: alert.createdAt,
      lastTriggered: alert.lastTriggered,
      triggerCount: alert.triggerCount
    };

    this.alerts.set(id, updatedAlert);
    await this.storage.saveAlert(updatedAlert);
    return updatedAlert;
  }

  public async deleteAlert(id: string): Promise<boolean> {
    const exists = this.alerts.has(id);
    if (!exists) return false;

    this.alerts.delete(id);
    await this.storage.deleteAlert(id);
    return true;
  }

  public async getAlert(id: string): Promise<Alert | null> {
    return this.alerts.get(id) || null;
  }

  public async getAlerts(): Promise<Alert[]> {
    return Array.from(this.alerts.values());
  }

  public async getTriggeredAlerts(since?: number): Promise<AlertResult[]> {
    return this.storage.getTriggeredAlerts(since);
  }

  private async checkAlertConditions(alert: Alert): Promise<AlertResult> {
    const values: { [key: string]: number } = {};
    let allConditionsMet = true;

    for (const condition of alert.conditions) {
      let value: number;

      switch (alert.type) {
        case 'PRICE':
          value = await this.engine.getCurrentPrice(alert.symbol) || 0;
          break;

        case 'INDICATOR':
          const analysis = await this.analyzer.getSymbolAnalysis(alert.symbol);
          if (!analysis || !condition.indicator) {
            allConditionsMet = false;
            continue;
          }

          switch (condition.indicator) {
            case 'RSI':
              value = analysis.timeframes['1h'].indicators.rsi;
              break;
            case 'MACD':
              value = analysis.timeframes['1h'].indicators.macd.histogram;
              break;
            default:
              allConditionsMet = false;
              continue;
          }
          break;

        case 'VOLUME':
        case 'PATTERN':
          const stats = await this.scanner.getTopOpportunities(1);
          if (!stats.length) {
            allConditionsMet = false;
            continue;
          }
          value = stats[0].volume;
          break;

        default:
          allConditionsMet = false;
          continue;
      }

      values[condition.indicator || alert.type] = value;
      this.updateValueHistory(alert.id, condition.indicator || alert.type, value);

      const isTriggered = this.evaluateCondition(condition, value, alert.id);
      if (!isTriggered) {
        allConditionsMet = false;
        break;
      }
    }

    return {
      alert,
      triggered: allConditionsMet,
      values,
      timestamp: Date.now()
    };
  }

  private updateValueHistory(alertId: string, indicator: string, value: number): void {
    const key = `${alertId}_${indicator}`;
    const history = this.valueHistory.get(key) || [];
    history.push({ value, timestamp: Date.now() });

    // Keep last 100 values
    if (history.length > 100) {
      history.shift();
    }

    this.valueHistory.set(key, history);
  }

  private evaluateCondition(condition: AlertCondition, value: number, alertId: string): boolean {
    const key = `${alertId}_${condition.indicator || 'price'}`;
    const history = this.valueHistory.get(key) || [];

    switch (condition.comparison) {
      case '>':
        return value > condition.value;
      case '<':
        return value < condition.value;
      case '==':
        return Math.abs(value - condition.value) < 0.0001;
      case 'CROSS_ABOVE':
        if (history.length < 2) return false;
        const prevValue = history[history.length - 2].value;
        return prevValue <= condition.value && value > condition.value;
      case 'CROSS_BELOW':
        if (history.length < 2) return false;
        const lastValue = history[history.length - 2].value;
        return lastValue >= condition.value && value < condition.value;
      default:
        return false;
    }
  }

  private async checkAlerts(): Promise<void> {
    for (const alert of this.alerts.values()) {
      if (!alert.isEnabled) continue;

      try {
        const result = await this.checkAlertConditions(alert);

        if (result.triggered) {
          alert.lastTriggered = Date.now();
          alert.triggerCount++;

          await this.storage.saveAlertResult(result);
          this.emit('alertTriggered', result);

          if (alert.order) {
            await this.executeAlertOrder(alert);
          }
        }
      } catch (error) {
        console.error(`Error checking alert ${alert.id}:`, error);
      }
    }
  }

  private async executeAlertOrder(alert: Alert): Promise<void> {
    if (!alert.order) return;

    try {
      const order = { ...alert.order };

      // Handle automatic quantity calculation
      if (order.quantity === 'AUTO') {
        const price = await this.engine.getCurrentPrice(alert.symbol);
        if (!price) throw new Error('Could not get current price');

        // Calculate quantity based on a percentage of available balance
        // This is a simplified version - you would need to implement proper position sizing
        order.quantity = 100 / price; // Example: $100 worth
      }

      const trade = await this.engine.createTrade({
        symbol: alert.symbol,
        side: order.side,
        type: order.type,
        quantity: order.quantity as number,
        stopLoss: order.stopLoss,
        takeProfit: order.takeProfit
      });

      await this.engine.approveTrade(trade.id);
      this.emit('alertOrderExecuted', { alert, trade });
    } catch (error) {
      console.error(`Error executing alert order for ${alert.id}:`, error);
      this.emit('alertOrderFailed', { alert, error });
    }
  }

  public setCheckInterval(interval: number): void {
    this.checkInterval = interval;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = setInterval(() => this.checkAlerts(), this.checkInterval);
    }
  }

  public async cleanup(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}
