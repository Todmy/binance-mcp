# Binance MCP Server

A Model Context Protocol (MCP) server implementation for Binance Futures trading, designed for LLM integration.

## Features

- Real-time futures market data access
- Price prediction tracking and evaluation
- Market analytics and recommendations
- Simple, LLM-friendly interface
- Comprehensive error handling

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

   - Get current futures price for a trading symbol
   - Parameters: symbol (e.g., "BTCUSDT")

2. `get_daily_stats`

   - Get 24-hour futures statistics for a symbol
   - Parameters: symbol
   - Returns: price change, percentage change, high/low prices, volume

3. `get_book_ticker`

   - Get best bid/ask prices and quantities for futures
   - Parameters: symbol

4. `get_candles`
   - Get historical futures candlestick data
   - Parameters:
     - symbol: Trading pair
     - interval: Time interval (1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M)
     - limit: Number of candles (optional, max 1000)

### Prediction Tools

1. `create_prediction`

   - Create a new futures price prediction
   - Parameters:
     - symbol: Trading pair
     - type: PRICE_TARGET, TREND_DIRECTION, or SUPPORT_RESISTANCE
     - validityPeriod: Time in milliseconds
     - metadata: Prediction details

2. `evaluate_prediction`

   - Evaluate a prediction result
   - Parameters: predictionId

3. `get_prediction_stats`

   - Get prediction statistics for a symbol
   - Parameters: symbol

4. `get_recommendation`
   - Get trading recommendations based on prediction history
   - Parameters: symbol

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

## Architecture

The server is built with a modular architecture:

- `src/core/`: Core types and futures trading interfaces
- `src/operations/`: Market operations
- `src/predictions/`: Prediction tracking and analytics
- `src/common/`: Shared utilities and error handling
- `src/types/`: TypeScript type definitions

## Key Components

1. Market Operations

   - Futures market data retrieval
   - Real-time price monitoring
   - Order book access

2. Prediction Tracking

   - Multi-type prediction support
   - Performance analytics
   - Historical tracking

3. Recommendation System
   - AI-driven trading suggestions
   - Performance-based confidence scoring
   - Risk level assessment

## Error Handling

The server implements comprehensive error handling:

- Market data errors
- Configuration errors
- API errors
- Validation errors

Each error response includes:

- Clear error message
- Error type identification
- Relevant context information

## Documentation

For detailed API documentation and examples, see:

- [API Documentation](docs/API.md)
- [Example Workflows](docs/API.md#example-workflows)
- [Error Handling Guidelines](docs/API.md#error-handling)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details.
