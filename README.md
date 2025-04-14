# Binance Futures Trading MCP Server

A Model Context Protocol (MCP) server implementation for automated trading on Binance Futures.

## Features

- Real-time market data streaming using WebSocket
- Risk management with configurable parameters
- Trade execution with stop-loss and take-profit orders
- Support for multiple order types (MARKET, LIMIT, STOP_MARKET, TAKE_PROFIT_MARKET)
- Testnet support for safe testing
- Event-driven architecture for trade monitoring

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Binance API key and secret with Futures trading permissions

## Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/binance-mcp.git
cd binance-mcp
```

2. Install dependencies:

```bash
npm install
```

3. Create environment configuration:

```bash
cp .env.example .env
```

4. Update the .env file with your Binance API credentials and configuration.

## Configuration

### Environment Variables

- `BINANCE_API_KEY`: Your Binance API key
- `BINANCE_API_SECRET`: Your Binance API secret
- `BINANCE_TESTNET`: Use testnet (true/false)
- `TIME_IN_FORCE`: Default time in force for limit orders (GTC/IOC/FOK)
- `MAX_POSITION_SIZE`: Maximum position size in USDT
- `MAX_LEVERAGE`: Maximum allowed leverage
- `STOP_LOSS_PERCENTAGE`: Default stop loss percentage
- `DAILY_LOSS_LIMIT`: Maximum daily loss limit in USDT
- `PRICE_DEVIATION_LIMIT`: Maximum allowed price deviation

## Running the Server

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

## Usage Example

```typescript
import { TradingEngine } from "./core/trading-engine";

const engine = new TradingEngine(binanceConfig, riskConfig);

// Create a trade
const trade = await engine.createTrade({
  symbol: "BTCUSDT",
  side: "BUY",
  type: "LIMIT",
  quantity: 0.001,
  price: 50000,
  stopLoss: 49000,
  takeProfit: 52000,
});

// Approve the trade
await engine.approveTrade(trade.id);
```

## Event Handling

The trading engine emits the following events:

- `tradePending`: When a trade is created and pending approval
- `tradeExecuted`: When a trade is successfully executed
- `tradeRejected`: When a trade is rejected
- `tradeCancelled`: When a trade is cancelled
- `error`: When an error occurs

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Security

Never commit your .env file or expose your API credentials. Always use testnet for development and testing.

## Disclaimer

Trading cryptocurrencies carries significant risks. This software is for educational purposes only. Use at your own risk.
