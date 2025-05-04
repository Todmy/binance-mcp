# Binance Futures MCP Server API Documentation

## Overview

This Model Context Protocol (MCP) server provides specialized interfaces for futures trading on Binance. It supports leveraged trading, position management, futures market data retrieval, and advanced risk management features.

## Server Configuration

### Setting Up the Server

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

### Futures Market Data Tools

1. `get_price`

   - Description: Get current futures price and funding rate for a trading symbol
   - Parameters:
     ```json
     {
       "symbol": "BTCUSDT"
     }
     ```
   - Response:
     ```json
     {
       "content": [
         {
           "type": "text",
           "text": {
             "price": "45000.50",
             "fundingRate": "0.0001",
             "nextFundingTime": 1683115200000,
             "markPrice": "45001.20"
           }
         }
       ]
     }
     ```

2. `get_daily_stats`

   - Description: Get 24h futures statistics for a symbol
   - Parameters:
     ```json
     {
       "symbol": "BTCUSDT"
     }
     ```
   - Response:
     ```json
     {
       "content": [
         {
           "type": "text",
           "text": {
             "priceChange": "1500.00",
             "priceChangePercent": "3.45",
             "lastPrice": "45000.50",
             "volume": "1234.567",
             "highPrice": "46000.00",
             "lowPrice": "44000.00"
           }
         }
       ]
     }
     ```

3. `get_book_ticker`
   - Description: Get best bid/ask prices and quantities for futures
   - Parameters:
     ```json
     {
       "symbol": "BTCUSDT"
     }
     ```
   - Response:
     ```json
     {
       "content": [
         {
           "type": "text",
           "text": {
             "symbol": "BTCUSDT",
             "bestBidPrice": "44999.50",
             "bestBidQty": "1.234",
             "bestAskPrice": "45000.50",
             "bestAskQty": "0.567",
             "time": 1683115200000
           }
         }
       ]
     }
     ```

### Prediction Tools

1. `create_prediction`

   - Description: Create a new price prediction
   - Parameters:
     ```json
     {
       "symbol": "BTCUSDT",
       "type": "PRICE_TARGET",
       "validityPeriod": 3600000,
       "metadata": {
         "targetPrice": "46000.00",
         "direction": "UP",
         "timeframe": "1h"
       }
     }
     ```
   - Response:
     ```json
     {
       "content": [
         {
           "type": "text",
           "text": {
             "id": "pred_uuid",
             "symbol": "BTCUSDT",
             "type": "PRICE_TARGET",
             "createdAt": 1683115200000,
             "validUntil": 1683118800000,
             "metadata": {
               "currentPrice": "45000.50",
               "predictionDetails": {
                 "targetPrice": "46000.00",
                 "direction": "UP",
                 "timeframe": "1h"
               }
             }
           }
         }
       ]
     }
     ```

2. `evaluate_prediction`

   - Description: Evaluate a prediction result
   - Parameters:
     ```json
     {
       "predictionId": "pred_uuid"
     }
     ```
   - Response:
     ```json
     {
       "content": [
         {
           "type": "text",
           "text": {
             "predictionId": "pred_uuid",
             "success": true,
             "actualResult": {
               "finalPrice": "46100.00",
               "highestPrice": "46200.00",
               "lowestPrice": "45000.50",
               "percentageChange": "2.44",
               "timeElapsed": 3600000
             },
             "accuracy": 95.5,
             "metrics": {
               "priceDifference": "100.00",
               "percentageError": "0.22",
               "directionCorrect": true
             }
           }
         }
       ]
     }
     ```

3. `get_prediction_stats`

   - Description: Get prediction statistics for a symbol
   - Parameters:
     ```json
     {
       "symbol": "BTCUSDT"
     }
     ```
   - Response:
     ```json
     {
       "content": [
         {
           "type": "text",
           "text": {
             "totalPredictions": 100,
             "successfulPredictions": 75,
             "averageAccuracy": 82.5,
             "byType": {
               "PRICE_TARGET": {
                 "total": 50,
                 "successful": 40,
                 "accuracy": 85.5
               }
             }
           }
         }
       ]
     }
     ```

4. `get_recommendation`
   - Description: Get trading recommendation based on prediction history
   - Parameters:
     ```json
     {
       "symbol": "BTCUSDT"
     }
     ```
   - Response:
     ```json
     {
       "content": [
         {
           "type": "text",
           "text": {
             "symbol": "BTCUSDT",
             "type": "ENTRY",
             "confidence": 85.5,
             "reasoning": [
               "High accuracy in recent predictions",
               "Strong trend direction consistency",
               "Favorable market volatility"
             ],
             "suggestedAction": {
               "direction": "LONG",
               "targetPrice": "46500.00",
               "stopLoss": "44500.00",
               "timeframe": "4h",
               "riskLevel": "MEDIUM"
             }
           }
         }
       ]
     }
     ```

### Position Management Tools

1. `get_position`

   - Description: Get current futures position details
   - Parameters:
     ```json
     {
       "symbol": "BTCUSDT"
     }
     ```
   - Response:
     ```json
     {
       "content": [
         {
           "type": "text",
           "text": {
             "symbol": "BTCUSDT",
             "positionSide": "LONG",
             "leverage": 10,
             "entryPrice": "44500.00",
             "markPrice": "45000.50",
             "unrealizedPnl": "500.50",
             "liquidationPrice": "41000.00",
             "marginType": "ISOLATED",
             "isolatedMargin": "1000.00"
           }
         }
       ]
     }
     ```

2. `set_leverage`

   - Description: Set leverage for a futures symbol
   - Parameters:
     ```json
     {
       "symbol": "BTCUSDT",
       "leverage": 10
     }
     ```
   - Response:
     ```json
     {
       "content": [
         {
           "type": "text",
           "text": {
             "symbol": "BTCUSDT",
             "leverage": 10,
             "maxNotionalValue": "1000000"
           }
         }
       ]
     }
     ```

3. `set_margin_type`
   - Description: Set margin type (ISOLATED/CROSS) for a futures symbol
   - Parameters:
     ```json
     {
       "symbol": "BTCUSDT",
       "marginType": "ISOLATED"
     }
     ```
   - Response:
     ```json
     {
       "content": [
         {
           "type": "text",
           "text": {
             "symbol": "BTCUSDT",
             "marginType": "ISOLATED"
           }
         }
       ]
     }
     ```

## Error Handling

### Common Error Types

1. Configuration Errors

   ```json
   {
     "content": [
       {
         "type": "text",
         "text": "Configuration error: Invalid API credentials"
       }
     ],
     "isError": true
   }
   ```

2. Market Data Errors

   ```json
   {
     "content": [
       {
         "type": "text",
         "text": "Market data error: Symbol INVALIDPAIR not found"
       }
     ],
     "isError": true
   }
   ```

3. Validation Errors
   ```json
   {
     "content": [
       {
         "type": "text",
         "text": "Validation error: Required parameter 'symbol' is missing"
       }
     ],
     "isError": true
   }
   ```

### Error Response Format

All errors follow a consistent format:

```typescript
interface ErrorResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError: true;
}
```

## Best Practices

1. Symbol Format

   - Always use uppercase symbols (e.g., "BTCUSDT", "ETHUSDT")
   - Include the quote currency (USDT) in the symbol

2. Timeframes

   - Use standard intervals: '1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'
   - Specify timeframes in milliseconds for validity periods

3. Price Formatting

   - All prices are strings to maintain precision
   - Use decimal format (e.g., "45000.50" not "45,000.50")

4. Error Handling
   - Always check for the `isError` field in responses
   - Handle rate limiting errors with exponential backoff
   - Validate parameters before sending requests

## Example Workflows

### Price Prediction Workflow

1. Get current market data:

```javascript
await mcp.call("get_price", { symbol: "BTCUSDT" });
await mcp.call("get_daily_stats", { symbol: "BTCUSDT" });
```

2. Create a prediction:

```javascript
const prediction = await mcp.call("create_prediction", {
  symbol: "BTCUSDT",
  type: "PRICE_TARGET",
  validityPeriod: 3600000, // 1 hour
  metadata: {
    targetPrice: "46000.00",
    direction: "UP",
    timeframe: "1h",
  },
});
```

3. Evaluate the prediction after the validity period:

```javascript
const result = await mcp.call("evaluate_prediction", {
  predictionId: prediction.id,
});
```

4. Get trading recommendation:

```javascript
const recommendation = await mcp.call("get_recommendation", {
  symbol: "BTCUSDT",
});
```

### Error Handling Example

```javascript
try {
  const response = await mcp.call("get_price", { symbol: "BTCUSDT" });
  if (response.isError) {
    console.error("Error:", response.content[0].text);
    return;
  }
  // Process successful response
} catch (error) {
  console.error("Network or system error:", error);
}
```
