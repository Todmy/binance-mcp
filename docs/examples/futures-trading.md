# Futures Trading Examples

This document provides practical examples of using the Binance MCP Server for futures trading operations.

## Basic Market Data Flow

```javascript
// Get current market status
const price = await mcp.call("get_price", {
  symbol: "BTCUSDT",
});

const stats = await mcp.call("get_daily_stats", {
  symbol: "BTCUSDT",
});

const ticker = await mcp.call("get_book_ticker", {
  symbol: "BTCUSDT",
});
```

## Price Target Prediction

```javascript
// Create a price target prediction
const prediction = await mcp.call("create_prediction", {
  symbol: "BTCUSDT",
  type: "PRICE_TARGET",
  validityPeriod: 3600000, // 1 hour
  metadata: {
    targetPrice: "45500.00",
    direction: "UP",
    timeframe: "1h",
  },
});

// Later, evaluate the prediction
const result = await mcp.call("evaluate_prediction", {
  predictionId: prediction.id,
});

// Check prediction statistics
const stats = await mcp.call("get_prediction_stats", {
  symbol: "BTCUSDT",
});
```

## Trend Direction Prediction

```javascript
// Create a trend direction prediction
const prediction = await mcp.call("create_prediction", {
  symbol: "BTCUSDT",
  type: "TREND_DIRECTION",
  validityPeriod: 14400000, // 4 hours
  metadata: {
    direction: "UP",
    expectedPercentage: "2.5",
    timeframe: "4h",
  },
});
```

## Support/Resistance Prediction

```javascript
// Create a support/resistance prediction
const prediction = await mcp.call("create_prediction", {
  symbol: "BTCUSDT",
  type: "SUPPORT_RESISTANCE",
  validityPeriod: 86400000, // 24 hours
  metadata: {
    supportLevel: "44000.00",
    resistanceLevel: "46000.00",
    timeframe: "1d",
  },
});
```

## Getting Trading Recommendations

```javascript
// Get recommendation based on prediction history
const recommendation = await mcp.call('get_recommendation', {
  symbol: 'BTCUSDT'
});

// Example recommendation response:
{
  symbol: 'BTCUSDT',
  type: 'ENTRY',
  confidence: 85.5,
  reasoning: [
    'Strong upward trend in recent predictions',
    'High accuracy in price target predictions',
    'Favorable market volatility conditions'
  ],
  suggestedAction: {
    direction: 'LONG',
    targetPrice: '46500.00',
    stopLoss: '44500.00',
    timeframe: '4h',
    riskLevel: 'MEDIUM'
  }
}
```

## Error Handling Examples

### Rate Limiting

```javascript
try {
  const response = await mcp.call("get_price", {
    symbol: "BTCUSDT",
  });
} catch (error) {
  if (error instanceof RateLimitError) {
    // Wait for the specified time before retrying
    await new Promise((resolve) => setTimeout(resolve, error.retryAfter));
    // Retry the request
    const response = await mcp.call("get_price", {
      symbol: "BTCUSDT",
    });
  }
}
```

### Validation Errors

```javascript
try {
  const prediction = await mcp.call("create_prediction", {
    symbol: "BTCUSDT",
    type: "INVALID_TYPE",
    validityPeriod: 3600000,
    metadata: {},
  });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(`Validation failed: ${error.field} - ${error.message}`);
  }
}
```

### Market Data Errors

```javascript
try {
  const price = await mcp.call("get_price", {
    symbol: "INVALID_PAIR",
  });
} catch (error) {
  if (error instanceof MarketDataError) {
    console.error(`Market data error: ${error.message}`);
  }
}
```

### Futures-Specific Errors

```javascript
try {
  const prediction = await mcp.call("create_prediction", {
    symbol: "BTCUSDT",
    type: "PRICE_TARGET",
    validityPeriod: 3600000,
    metadata: {
      targetPrice: "45500.00",
      direction: "UP",
    },
  });
} catch (error) {
  if (error instanceof FuturesError) {
    console.error(`Futures error for ${error.symbol}: ${error.message}`);
  } else if (error instanceof LiquidationError) {
    console.error(`Liquidation warning for ${error.symbol}: ${error.message}`);
    console.error(`Position: ${error.position.side} at ${error.position.liquidationPrice}`);
  }
}
```

## Advanced Usage

### Combining Predictions with Market Data

```javascript
// Get current market conditions
const stats = await mcp.call("get_daily_stats", {
  symbol: "BTCUSDT",
});

// Create prediction based on volatility
const prediction = await mcp.call("create_prediction", {
  symbol: "BTCUSDT",
  type: "PRICE_TARGET",
  validityPeriod: 3600000,
  metadata: {
    targetPrice: calculateTarget(stats),
    direction: determineDirection(stats),
    timeframe: selectTimeframe(stats),
  },
});

// Helper functions (example implementations)
function calculateTarget(stats) {
  const volatility = Math.abs(parseFloat(stats.priceChangePercent)) / 100;
  const currentPrice = parseFloat(stats.lastPrice);
  const movement = currentPrice * (volatility * 2);
  return (currentPrice + movement).toFixed(2);
}

function determineDirection(stats) {
  return parseFloat(stats.priceChangePercent) > 0 ? "UP" : "DOWN";
}

function selectTimeframe(stats) {
  const volatility = Math.abs(parseFloat(stats.priceChangePercent)) / 100;
  if (volatility > 0.05) return "15m";
  if (volatility > 0.02) return "1h";
  return "4h";
}
```

### Using Multiple Predictions for Complex Analysis

```javascript
// Create multiple predictions with different timeframes
const predictions = await Promise.all([
  mcp.call("create_prediction", {
    symbol: "BTCUSDT",
    type: "TREND_DIRECTION",
    validityPeriod: 900000, // 15m
    metadata: { direction: "UP", timeframe: "15m" },
  }),
  mcp.call("create_prediction", {
    symbol: "BTCUSDT",
    type: "PRICE_TARGET",
    validityPeriod: 3600000, // 1h
    metadata: { targetPrice: "45500.00", timeframe: "1h" },
  }),
  mcp.call("create_prediction", {
    symbol: "BTCUSDT",
    type: "SUPPORT_RESISTANCE",
    validityPeriod: 14400000, // 4h
    metadata: {
      supportLevel: "44000.00",
      resistanceLevel: "46000.00",
      timeframe: "4h",
    },
  }),
]);

// Later, evaluate all predictions
const results = await Promise.all(
  predictions.map((p) =>
    mcp.call("evaluate_prediction", {
      predictionId: p.id,
    })
  )
);

// Analyze results
const accuracy = results.reduce((acc, r) => acc + r.accuracy, 0) / results.length;
console.log(`Average prediction accuracy: ${accuracy}%`);
```

## Position and Leverage Management

```javascript
// Set up leverage for a symbol
await mcp.call("set_leverage", {
  symbol: "BTCUSDT",
  leverage: 10
});

// Set margin type
await mcp.call("set_margin_type", {
  symbol: "BTCUSDT",
  marginType: "ISOLATED"
});

// Get current position details
const position = await mcp.call("get_position", {
  symbol: "BTCUSDT"
});

// Calculate optimal position size based on risk parameters
const positionSize = await mcp.call("get_risk/position-size", {
  symbol: "BTCUSDT",
  riskPercentage: 1, // Risk 1% of account
  stopLoss: 44000,
  leverage: 10,
  marginType: "ISOLATED"
});

// Monitor liquidation risk
const riskAnalysis = await mcp.call("get_risk/analysis", {
  symbol: "BTCUSDT",
  position: position
});

// Example responses:
// Position details:
{
  symbol: "BTCUSDT",
  positionSide: "LONG",
  leverage: 10,
  entryPrice: "45000",
  markPrice: "45500",
  unrealizedPnl: "500",
  marginType: "ISOLATED",
  isolatedMargin: "1000",
  liquidationPrice: "41000"
}

// Risk analysis:
{
  liquidationRisk: "LOW",
  marginRatio: "0.15",
  suggestedActions: [
    "Consider taking partial profits",
    "Current leverage is optimal for market conditions"
  ],
  warnings: []
}
```

## Advanced Risk Management

```javascript
// Get optimal leverage based on market conditions
const leverageRec = await mcp.call("get_risk/optimal-leverage", {
  symbol: "BTCUSDT",
  targetRisk: "MEDIUM", // LOW, MEDIUM, HIGH
  marginType: "ISOLATED"
});

// Monitor multiple positions
const portfolioRisk = await mcp.call("get_risk/portfolio", {
  positions: ["BTCUSDT", "ETHUSDT"]
});

// Example responses:
// Leverage recommendation:
{
  recommendedLeverage: 5,
  maxSafeLeverage: 10,
  reasoning: [
    "High market volatility detected",
    "Current trend strength: medium",
    "Recent price action suggests moderate risk"
  ]
}

// Portfolio risk:
{
  totalRisk: "MEDIUM",
  marginUtilization: "45%",
  positions: [
    {
      symbol: "BTCUSDT",
      riskLevel: "LOW",
      marginRatio: "0.15"
    },
    {
      symbol: "ETHUSDT",
      riskLevel: "MEDIUM",
      marginRatio: "0.25"
    }
  ],
  recommendations: [
    "Consider reducing ETHUSDT position size",
    "Portfolio correlation: 0.75 - high risk"
  ]
}
```

## Automated Position Management

```javascript
// Set up automated stop-loss and take-profit
await mcp.call("set_position_automation", {
  symbol: "BTCUSDT",
  stopLoss: {
    price: "44000",
    type: "TRAILING", // or "FIXED"
    callbackRate: 0.8 // For trailing stop
  },
  takeProfit: {
    price: "47000"
  }
});

// Monitor position with alerts
const subscription = await mcp.call("subscribe_position_alerts", {
  symbol: "BTCUSDT",
  alerts: [
    {
      type: "LIQUIDATION_RISK",
      threshold: "75%" // Alert when within 75% of liquidation
    },
    {
      type: "PNL",
      condition: "UNREALIZED",
      threshold: "500" // Alert on $500 unrealized PnL
    }
  ]
});

// Example alert response:
{
  type: "LIQUIDATION_RISK",
  symbol: "BTCUSDT",
  message: "Position approaching liquidation price",
  details: {
    currentPrice: "41500",
    liquidationPrice: "41000",
    marginRatio: "0.85",
    suggestedActions: [
      "Add margin to position",
      "Reduce position size",
      "Close position"
    ]
  }
}
```
