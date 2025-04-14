import Binance from 'binance-api-node';
import { EventEmitter } from 'events';
import { WebSocketManager } from './websocket';
import { RiskManager } from './risk-manager';
import { Trade, BinanceConfig, RiskConfig } from '../config/types';
import { BinanceClient, FuturesOrderParams, FuturesBookTicker } from './binance-types';

export class TradingEngine extends EventEmitter {
  private client: BinanceClient;
  private wsManager: WebSocketManager;
  private riskManager: RiskManager;
  private readonly pendingTrades: Map<string, Trade> = new Map();
  private readonly activePositions: Map<string, any> = new Map();
  private readonly priceCache: Map<string, number> = new Map();

  constructor(binanceConfig: BinanceConfig, riskConfig: RiskConfig) {
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
    void this.setupWebSocket();
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

  private async getCurrentPrice(symbol: string): Promise<number | null> {
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
    await this.wsManager.closeAll();
  }
}
