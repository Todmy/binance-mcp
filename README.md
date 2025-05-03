# Binance MCP Server

A Model Context Protocol (MCP) server implementation for Binance Spot Market operations.

## Features

- Get real-time price updates
- Access market statistics
- View order book data
- Get historical candlestick data
- Simple configuration
- Error handling and logging

## Installation

```bash
npm install
```

## Configuration

Configure the server by providing your Binance API credentials:

```json
{
  "mcpServers": {
    "binance": {
      "command": "npx",
      "args": ["-y", "binance-mcp"],
      "env": {
        "BINANCE_API_KEY": "your_api_key",
        "BINANCE_API_SECRET": "your_api_secret"
      }
    }
  }
}
```

## Available Tools

### Market Data Tools

1. `get_price`

   - Get current price for a trading symbol
   - Parameters: symbol (e.g., "BTCUSDT")

2. `get_daily_stats`

   - Get 24-hour statistics for a symbol
   - Parameters: symbol
   - Returns: price change, percentage change, high/low prices, volume

3. `get_book_ticker`

   - Get best bid/ask prices and quantities
   - Parameters: symbol

4. `get_candles`
   - Get historical candlestick data
   - Parameters:
     - symbol: Trading pair
     - interval: Time interval (1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M)
     - limit: Number of candles (optional, max 1000)

### Configuration Tools

1. `set_configuration`

   - Configure the server with API credentials
   - Parameters: binance.apiKey, binance.apiSecret

2. `get_configuration_status`
   - Check if the server is configured
   - No parameters required

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

- Market data errors (invalid symbol, no data available)
- Configuration errors (missing or invalid credentials)
- API errors (rate limits, server issues)
- Validation errors (invalid parameters)

## Architecture

- `src/core/`: Core types and interfaces
- `src/operations/`: Market operations
- `src/common/`: Shared utilities and error handling

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details.
