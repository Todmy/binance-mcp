# Binance MCP Server

A Model Context Protocol (MCP) server implementation for Binance Futures trading.

## Features

- Create, approve, and cancel trades
- Monitor trading pairs
- Get real-time price updates
- Risk management and trade validation
- WebSocket connection management
- Error handling and logging

## Installation

```bash
npm install
```

## Configuration

Configure the server through VSCode settings. Add the following to your `.vscode/settings.json`:

```json
{
  "mcpServers": {
    "binance": {
      "command": "npx",
      "args": ["-y", "binance-mcp"],
      "env": {
        "BINANCE_API_KEY": "your_api_key",
        "BINANCE_API_SECRET": "your_api_secret"
      },
      "trading": {
        "maxPositionSize": 10000,
        "maxLeverage": 20,
        "stopLossPercentage": 0.05,
        "priceDeviationLimit": 0.02,
        "dailyLossLimit": 1000
      }
    }
  }
}
```

## Available Tools

### Trading Operations

1. `create_trade`

   - Create a new trade in pending status
   - Parameters: symbol, side, type, quantity, price (for limit orders), stopLoss, takeProfit

2. `approve_trade`

   - Approve a pending trade for execution
   - Parameters: id

3. `cancel_trade`

   - Cancel a pending trade
   - Parameters: id

4. `list_trades`
   - List all trades (both pending and active)
   - No parameters required

### Market Operations

1. `monitor_symbol`

   - Start monitoring price updates for a trading symbol
   - Parameters: symbol

2. `stop_monitoring_symbol`

   - Stop monitoring price updates for a trading symbol
   - Parameters: symbol

3. `get_current_price`
   - Get the current price for a trading symbol
   - Parameters: symbol

## Development

```bash
# Run in development mode
npm run mcp:dev

# Build the project
npm run mcp:build

# Start the production server
npm run mcp:start

# Run tests
npm test
```

## Error Handling

The server handles various types of errors:

- Trading errors (position size, leverage, etc.)
- Market data errors
- Binance API errors
- Configuration errors
- Validation errors

## Architecture

- `src/core/`: Core trading engine and WebSocket management
- `src/operations/`: Trading and market operations
- `src/tools/`: MCP tool definitions
- `src/common/`: Shared utilities, validation, and error handling
- `src/config/`: Configuration management

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details.
