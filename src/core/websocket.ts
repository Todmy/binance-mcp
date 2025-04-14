import * as WS from 'ws';
import { EventEmitter } from 'events';

interface WebSocketEvent {
  type: string;
  data: any;
}

export class WebSocketManager extends EventEmitter {
  private connections: Map<string, WS.WebSocket>;
  private baseUrl: string;
  private reconnectAttempts: Map<string, number>;
  private readonly maxReconnectAttempts = 5;

  constructor(testnet: boolean = false) {
    super();
    this.connections = new Map();
    this.reconnectAttempts = new Map();
    this.baseUrl = testnet
      ? 'wss://stream.binancefuture.com/ws'
      : 'wss://fstream.binance.com/ws';
  }

  public async connectToStream(
    symbol: string,
    streamType: 'trade' | 'kline' | 'miniTicker' | 'bookTicker'
  ): Promise<void> {
    const streamName = `${symbol.toLowerCase()}@${streamType}`;

    if (this.connections.has(streamName)) {
      return;
    }

    const ws = new WS.WebSocket(`${this.baseUrl}/${streamName}`);
    this.setupWebSocketHandlers(ws, streamName);
    this.connections.set(streamName, ws);
  }

  public async disconnectFromStream(
    symbol: string,
    streamType: 'trade' | 'kline' | 'miniTicker' | 'bookTicker'
  ): Promise<void> {
    const streamName = `${symbol.toLowerCase()}@${streamType}`;
    const ws = this.connections.get(streamName);

    if (ws) {
      ws.close();
      this.connections.delete(streamName);
      this.reconnectAttempts.delete(streamName);
    }
  }

  private setupWebSocketHandlers(ws: WS.WebSocket, streamName: string): void {
    ws.on('open', () => {
      console.info(`Connected to stream: ${streamName}`);
      this.reconnectAttempts.set(streamName, 0);
      this.emit('connected', streamName);
    });

    ws.on('message', (data: string) => {
      try {
        const parsedData = JSON.parse(data);
        const event: WebSocketEvent = {
          type: streamName,
          data: parsedData
        };
        this.emit('data', event);
      } catch (error) {
        console.error(`Error parsing message from ${streamName}:`, error);
      }
    });

    ws.on('error', (error: Error) => {
      console.error(`WebSocket error on ${streamName}:`, error);
      this.emit('error', { streamName, error });
    });

    ws.on('close', () => {
      console.info(`Disconnected from stream: ${streamName}`);
      this.emit('disconnected', streamName);
      this.handleReconnect(streamName);
    });
  }

  private async handleReconnect(streamName: string): Promise<void> {
    const attempts = this.reconnectAttempts.get(streamName) || 0;

    if (attempts < this.maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
      console.info(`Attempting to reconnect to ${streamName} in ${delay}ms...`);

      await new Promise(resolve => setTimeout(resolve, delay));

      const [symbol, streamType] = streamName.split('@') as [string, 'trade' | 'kline' | 'miniTicker' | 'bookTicker'];
      this.reconnectAttempts.set(streamName, attempts + 1);
      await this.connectToStream(symbol, streamType);
    } else {
      console.error(`Max reconnection attempts reached for ${streamName}`);
      this.emit('maxReconnectAttemptsReached', streamName);
    }
  }

  public closeAll(): void {
    for (const [streamName, ws] of this.connections.entries()) {
      ws.close();
      this.connections.delete(streamName);
      this.reconnectAttempts.delete(streamName);
    }
  }
}

// Example usage:
// const wsManager = new WebSocketManager(true); // true for testnet
// wsManager.on('data', (event) => {
//   console.log('Received data:', event);
// });
// await wsManager.connectToStream('BTCUSDT', 'trade');
