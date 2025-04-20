import Binance from 'binance-api-node';
import { EventEmitter } from 'events';
import { WebSocketManager } from './websocket';
import { RiskManager } from './risk-manager';
import { MarketScanner } from '../analysis/market-scanner';
import { AlertManager } from '../alerts/alert-manager';
import { SQLiteStorage } from '../storage/sqlite-storage';
import { Trade, BinanceConfig, RiskConfig } from '../config/types';
import { BinanceClient, FuturesOrderParams, FuturesBookTicker } from './binance-types';
import { HistoricalAnalysis } from '../types/analysis';
import { MarketStats } from '../analysis/market-scanner';
import { Alert, AlertConfig, AlertResult } from '../types/alerts';

export class TradingEngine extends EventEmitter {
  private client: BinanceClient;
  private wsManager: WebSocketManager;
  private riskManager: RiskManager;
  private marketScanner: MarketScanner;
  private alertManager: AlertManager;
  private storage: SQLiteStorage;
  private readonly pendingTrades: Map<string, Trade> = new Map();
  private readonly activePositions: Map<string, any> = new Map();
  private readonly priceCache: Map<string, number> = new Map();

  constructor(
    binanceConfig: BinanceConfig,
    riskConfig: RiskConfig,
    dbPath: string = ':memory:'
  ) {
    super();
    this.client = Binance({
      apiKey: binanceConfig.apiKey,
      apiSecret: binanceConfig.apiSecret,
      httpFutures: 'https://fapi.binance.com',
      wsFutures: 'wss://fstream.binance.com',
      httpBase: binanceConfig.testnet ? 'https://testnet.binance.vision' : 'https://api.binance.com'
    }) as unknown as BinanceClient;

    this.wsManager = new WebSocketManager(binanceConfig.testnet);
    this.riskManager = new RiskManager(riskConfig);
    this.storage = new SQLiteStorage(dbPath);
    this.marketScanner = new MarketScanner(binanceConfig.testnet, this.client);
    this.alertManager = new AlertManager(
      this.storage,
      this,
      this.marketScanner,
      this.marketScanner.getHistoricalAnalyzer()
    );

    void this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.storage.initialize();
    await this.alertManager.initialize();
    await this.setupWebSocket();
    this.setupAlertListeners();
  }

  private setupAlertListeners(): void {
    this.alertManager.on('alertTriggered', (result: AlertResult) => {
      this.emit('alertTriggered', result);
    });

    this.alertManager.on('alertOrderExecuted', ({ alert, trade }) => {
      this.emit('alertOrderExecuted', { alert, trade });
    });

    this.alertManager.on('alertOrderFailed', ({ alert, error }) => {
      this.emit('alertOrderFailed', { alert, error });
    });
  }

  public getBinanceClient(): BinanceClient {
    return this.client;
  }

  private async setupWebSocket(): Promise<void> {
    this.wsManager.on('data', (event: { type: string; data: { b: string } }) => {
      if (event.type.includes('@bookTicker')) {
        const symbol = event.type.split('@')[0].toUpperCase();
        this.priceCache.set(symbol, parseFloat(event.data.b));
      }
    });

    this.wsManager.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    });
  }

  public async createTrade(trade: Omit<Trade, 'id' | 'timestamp' | 'status'>): Promise<Trade> {
    const id = this.generateTradeId();
    const timestamp = Date.now();
    const newTrade: Trade = {
      ...trade,
      id,
      timestamp,
      status: 'PENDING'
    };

    const currentPrice = await this.getCurrentPrice(trade.symbol);
    if (!currentPrice) {
      throw new Error(`Unable to get current price for ${trade.symbol}`);
    }

    const assessment = await this.riskManager.validateTrade(newTrade, currentPrice);
    if (!assessment.isValid) {
      throw new Error(`Trade validation failed: ${assessment.reasons.join(', ')}`);
    }

    this.pendingTrades.set(id, newTrade);
    this.emit('tradePending', newTrade);

    return newTrade;
  }

  public async approveTrade(tradeId: string): Promise<void> {
    const trade = this.pendingTrades.get(tradeId);
    if (!trade) {
      throw new Error('Trade not found');
    }

    try {
      const orderParams = this.prepareOrderParams(trade);
      const order = await this.client.futuresOrder(orderParams);

      if (trade.stopLoss) {
        await this.client.futuresOrder({
          ...orderParams,
          type: 'STOP_MARKET',
          stopPrice: trade.stopLoss.toString(),
          reduceOnly: 'true'
        });
      }

      if (trade.takeProfit) {
        await this.client.futuresOrder({
          ...orderParams,
          type: 'TAKE_PROFIT_MARKET',
          stopPrice: trade.takeProfit.toString(),
          reduceOnly: 'true'
        });
      }

      trade.status = 'EXECUTED';
      this.pendingTrades.delete(tradeId);
      this.activePositions.set(tradeId, order);
      this.emit('tradeExecuted', { trade, order });

    } catch (error) {
      trade.status = 'REJECTED';
      this.emit('tradeRejected', { trade, error });
      throw error;
    }
  }

  public async cancelTrade(tradeId: string): Promise<void> {
    const trade = this.pendingTrades.get(tradeId);
    if (!trade) {
      throw new Error('Trade not found');
    }

    trade.status = 'CANCELLED';
    this.pendingTrades.delete(tradeId);
    this.emit('tradeCancelled', trade);
  }

  public async monitorSymbol(symbol: string): Promise<void> {
    try {
      await this.wsManager.connectToStream(symbol, 'bookTicker');
    } catch (error) {
      console.error(`Error monitoring symbol ${symbol}:`, error);
      throw error;
    }
  }

  public async stopMonitoringSymbol(symbol: string): Promise<void> {
    await this.wsManager.disconnectFromStream(symbol, 'bookTicker');
  }

  public async getCurrentPrice(symbol: string): Promise<number | null> {
    const cachedPrice = this.priceCache.get(symbol);
    if (cachedPrice) {
      return cachedPrice;
    }

    try {
      const tickers = await this.client.futuresAllBookTickers();
      const symbolTicker = Object.values(tickers).find(t => t.symbol === symbol) as FuturesBookTicker | undefined;
      if (!symbolTicker) {
        throw new Error(`No ticker found for symbol ${symbol}`);
      }
      const price = parseFloat(symbolTicker.bestBidPrice);
      this.priceCache.set(symbol, price);
      return price;
    } catch (error) {
      console.error(`Error getting price for ${symbol}:`, error);
      return null;
    }
  }

  private prepareOrderParams(trade: Trade): FuturesOrderParams {
    const baseParams = {
      symbol: trade.symbol,
      side: trade.side,
      quantity: trade.quantity.toString()
    };

    if (trade.type === 'LIMIT' && trade.price) {
      return {
        ...baseParams,
        type: 'LIMIT',
        price: trade.price.toString(),
        timeInForce: 'GTC'
      } as FuturesOrderParams;
    }

    if (trade.type === 'STOP_MARKET' && trade.stopLoss) {
      return {
        ...baseParams,
        type: 'STOP_MARKET',
        stopPrice: trade.stopLoss.toString(),
        reduceOnly: 'true'
      } as FuturesOrderParams;
    }

    if (trade.type === 'TAKE_PROFIT_MARKET' && trade.takeProfit) {
      return {
        ...baseParams,
        type: 'TAKE_PROFIT_MARKET',
        stopPrice: trade.takeProfit.toString(),
        reduceOnly: 'true'
      } as FuturesOrderParams;
    }

    return {
      ...baseParams,
      type: 'MARKET'
    } as FuturesOrderParams;
  }

  private generateTradeId(): string {
    return `trade_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  public async cleanup(): Promise<void> {
    await Promise.all([
      this.wsManager.closeAll(),
      this.marketScanner.cleanup(),
      this.alertManager.cleanup(),
      this.storage.cleanup()
    ]);
  }

  public async getMarketAnalysis(symbol: string): Promise<HistoricalAnalysis | undefined> {
    return this.marketScanner.getCachedAnalysis(symbol);
  }

  public async refreshMarketAnalysis(symbol: string): Promise<void> {
    try {
      await this.marketScanner.getSymbolAnalysis(symbol, 0); // Force refresh
    } catch (error) {
      console.error(`Error refreshing analysis for ${symbol}:`, error);
      throw error;
    }
  }

  public async getBestTradingPairs(limit: number = 10): Promise<MarketStats[]> {
    return this.marketScanner.getTopOpportunities(limit);
  }

  public async startMarketScanning(symbols: string[]): Promise<void> {
    await this.marketScanner.startScanning(symbols);
  }

  public async stopMarketScanning(symbols: string[]): Promise<void> {
    await this.marketScanner.stopScanning(symbols);
  }

  // Alert management methods
  public async createAlert(config: AlertConfig): Promise<Alert> {
    return this.alertManager.createAlert(config);
  }

  public async updateAlert(id: string, config: Partial<AlertConfig>): Promise<Alert | null> {
    return this.alertManager.updateAlert(id, config);
  }

  public async deleteAlert(id: string): Promise<boolean> {
    return this.alertManager.deleteAlert(id);
  }

  public async getAlert(id: string): Promise<Alert | null> {
    return this.alertManager.getAlert(id);
  }

  public async listAlerts(): Promise<Alert[]> {
    return this.alertManager.getAlerts();
  }

  public async getTriggeredAlerts(since?: number): Promise<AlertResult[]> {
    return this.alertManager.getTriggeredAlerts(since);
  }

  public setAlertCheckInterval(interval: number): void {
    this.alertManager.setCheckInterval(interval);
  }

  public async listTrades(): Promise<Trade[]> {
    // Convert pendingTrades Map to array
    const pendingTradeArray = Array.from(this.pendingTrades.values());

    // Get active positions and convert to Trade objects
    const activeTradeArray = Array.from(this.activePositions.keys()).map(id => {
      const position = this.activePositions.get(id);
      return {
        id,
        symbol: position.symbol,
        side: position.side,
        type: position.type,
        quantity: parseFloat(position.quantity),
        price: position.price ? parseFloat(position.price) : undefined,
        stopLoss: position.stopPrice ? parseFloat(position.stopPrice) : undefined,
        timeInForce: position.timeInForce,
        timestamp: position.time,
        status: 'EXECUTED' as const
      };
    });

    // Combine both arrays
    return [...pendingTradeArray, ...activeTradeArray];
  }
}
