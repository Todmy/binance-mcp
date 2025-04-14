import { Trade } from '../../config/types';
import { FormattedBookTicker } from '../format/market-data-formatter';
import { FormattedOrderWithRisk } from '../format/order-formatter';

export class TradingLogger {
  private logEntries: LogEntry[] = [];
  private readonly maxEntries: number;

  constructor(maxEntries: number = 1000) {
    this.maxEntries = maxEntries;
  }

  /**
   * Log a new trade
   */
  public logTrade(trade: Trade, executionDetails?: FormattedOrderWithRisk): void {
    this.addLogEntry({
      timestamp: Date.now(),
      type: 'TRADE',
      level: 'INFO',
      symbol: trade.symbol,
      data: {
        trade,
        executionDetails
      }
    });
  }

  /**
   * Log market data updates
   */
  public logMarketData(bookTicker: FormattedBookTicker): void {
    this.addLogEntry({
      timestamp: Date.now(),
      type: 'MARKET_DATA',
      level: 'DEBUG',
      symbol: bookTicker.symbol,
      data: bookTicker
    });
  }

  /**
   * Log risk assessment results
   */
  public logRiskAssessment(
    trade: Trade,
    riskMetrics: FormattedOrderWithRisk['riskMetrics'],
    isValid: boolean
  ): void {
    this.addLogEntry({
      timestamp: Date.now(),
      type: 'RISK_ASSESSMENT',
      level: isValid ? 'INFO' : 'WARNING',
      symbol: trade.symbol,
      data: {
        trade,
        riskMetrics,
        isValid
      }
    });
  }

  /**
   * Log execution results
   */
  public logExecution(
    trade: Trade,
    executionResult: any,
    success: boolean,
    error?: Error
  ): void {
    this.addLogEntry({
      timestamp: Date.now(),
      type: 'EXECUTION',
      level: success ? 'INFO' : 'ERROR',
      symbol: trade.symbol,
      data: {
        trade,
        executionResult,
        success,
        error: error?.message
      }
    });
  }

  /**
   * Log position updates
   */
  public logPositionUpdate(
    symbol: string,
    currentPosition: number,
    newPosition: number,
    pnl: number
  ): void {
    this.addLogEntry({
      timestamp: Date.now(),
      type: 'POSITION_UPDATE',
      level: 'INFO',
      symbol,
      data: {
        previousPosition: currentPosition,
        newPosition,
        pnl,
        changeAmount: newPosition - currentPosition
      }
    });
  }

  /**
   * Log errors
   */
  public logError(error: Error, context?: any): void {
    this.addLogEntry({
      timestamp: Date.now(),
      type: 'ERROR',
      level: 'ERROR',
      symbol: context?.symbol || 'SYSTEM',
      data: {
        error: {
          message: error.message,
          stack: error.stack
        },
        context
      }
    });
  }

  /**
   * Log warnings
   */
  public logWarning(message: string, context?: any): void {
    this.addLogEntry({
      timestamp: Date.now(),
      type: 'WARNING',
      level: 'WARNING',
      symbol: context?.symbol || 'SYSTEM',
      data: {
        message,
        context
      }
    });
  }

  /**
   * Get logs filtered by various criteria
   */
  public getLogs(options: LogFilterOptions = {}): LogEntry[] {
    let filtered = [...this.logEntries];

    if (options.symbol) {
      filtered = filtered.filter(entry => entry.symbol === options.symbol);
    }

    if (options.type) {
      filtered = filtered.filter(entry => entry.type === options.type);
    }

    if (options.level) {
      filtered = filtered.filter(entry => entry.level === options.level);
    }

    if (options.startTime) {
      filtered = filtered.filter(entry => entry.timestamp >= options.startTime!);
    }

    if (options.endTime) {
      filtered = filtered.filter(entry => entry.timestamp <= options.endTime!);
    }

    if (options.limit) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered;
  }

  /**
   * Clear old logs
   */
  public clearOldLogs(olderThan: number = 24 * 60 * 60 * 1000): void {
    const cutoffTime = Date.now() - olderThan;
    this.logEntries = this.logEntries.filter(entry => entry.timestamp >= cutoffTime);
  }

  private addLogEntry(entry: LogEntry): void {
    this.logEntries.push(entry);

    // Maintain max entries limit
    if (this.logEntries.length > this.maxEntries) {
      this.logEntries = this.logEntries.slice(-this.maxEntries);
    }

    // Optional: Log to console for development
    if (process.env.NODE_ENV === 'development') {
      console.info(JSON.stringify(entry, null, 2));
    }
  }
}

export interface LogEntry {
  timestamp: number;
  type: LogType;
  level: LogLevel;
  symbol: string;
  data: any;
}

export interface LogFilterOptions {
  symbol?: string;
  type?: LogType;
  level?: LogLevel;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

export type LogType =
  | 'TRADE'
  | 'MARKET_DATA'
  | 'RISK_ASSESSMENT'
  | 'EXECUTION'
  | 'POSITION_UPDATE'
  | 'ERROR'
  | 'WARNING';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
