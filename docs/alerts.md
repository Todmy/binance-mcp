# Alert System Documentation

The MCP Alert System allows you to create and manage trading alerts based on various conditions, with optional automatic order execution.

## Alert Types

1. **Price Alerts**

   - Monitor specific price levels
   - Support for above/below thresholds
   - Cross-over detection

2. **Indicator Alerts**

   - RSI conditions
   - MACD crossovers
   - Volume profile changes

3. **Pattern Alerts**
   - Support/resistance breaks
   - Trend reversals
   - Volume spikes

## Creating an Alert

```typescript
const alertConfig: AlertConfig = {
  symbol: "BTCUSDT",
  type: "INDICATOR",
  conditions: [
    {
      indicator: "RSI",
      comparison: "<",
      value: 30,
    },
  ],
  order: {
    // Optional: Automatically execute trade when alert triggers
    type: "MARKET",
    side: "BUY",
    quantity: "AUTO", // Will calculate based on available balance
    stopLoss: 29000,
    takeProfit: 31000,
  },
  isEnabled: true,
  description: "BTC RSI oversold alert",
};

const alert = await tradingEngine.createAlert(alertConfig);
```

## Managing Alerts

```typescript
// List all alerts
const alerts = await tradingEngine.listAlerts();

// Get specific alert
const alert = await tradingEngine.getAlert("alert-id");

// Update alert
await tradingEngine.updateAlert("alert-id", {
  isEnabled: false,
});

// Delete alert
await tradingEngine.deleteAlert("alert-id");

// Get triggered alerts
const triggeredAlerts = await tradingEngine.getTriggeredAlerts();

// Get alerts triggered in the last hour
const recentAlerts = await tradingEngine.getTriggeredAlerts(Date.now() - 3600000);
```

## Alert Event Handling

```typescript
// Listen for alert triggers
tradingEngine.on("alertTriggered", (result) => {
  console.log("Alert triggered:", result.alert.description);
  console.log("Trigger values:", result.values);
});

// Listen for automatic order execution
tradingEngine.on("alertOrderExecuted", ({ alert, trade }) => {
  console.log("Alert order executed:", trade.id);
});

// Listen for order execution failures
tradingEngine.on("alertOrderFailed", ({ alert, error }) => {
  console.error("Alert order failed:", error.message);
});
```

## Alert Conditions

### Price Conditions

```typescript
{
  type: 'PRICE',
  conditions: [{
    comparison: '>',
    value: 30000
  }]
}
```

### Indicator Conditions

```typescript
{
  type: 'INDICATOR',
  conditions: [{
    indicator: 'RSI',
    comparison: 'CROSS_BELOW',
    value: 30
  }, {
    indicator: 'MACD',
    comparison: 'CROSS_ABOVE',
    value: 0
  }]
}
```

### Volume Conditions

```typescript
{
  type: 'VOLUME',
  conditions: [{
    comparison: '>',
    value: 1000000  // $1M volume
  }]
}
```

### Pattern Conditions

```typescript
{
  type: 'PATTERN',
  conditions: [{
    indicator: 'SUPPORT',
    comparison: 'CROSS_BELOW',
    value: 29000
  }]
}
```

## Data Persistence

Alerts and their trigger history are automatically persisted to SQLite storage. The data is retained even after system restarts. You can specify a custom database path when initializing the TradingEngine:

```typescript
const tradingEngine = new TradingEngine(binanceConfig, riskConfig, "path/to/alerts.db");
```

## Performance Considerations

1. Alert checks run every minute by default
2. You can adjust the check interval:
   ```typescript
   tradingEngine.setAlertCheckInterval(30000); // 30 seconds
   ```
3. Historical data is cached to reduce API calls
4. Cross-over conditions require at least two data points
5. Complex conditions may impact system performance

## Best Practices

1. Use reasonable alert thresholds to avoid excessive triggers
2. Implement error handling for alert order execution
3. Monitor alert performance and adjust as needed
4. Clean up unused alerts to maintain system performance
5. Use description field for clear alert identification
6. Test alerts with small quantities before automation
7. Regularly backup the alert database

## Database Schema

```sql
CREATE TABLE alerts (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  type TEXT NOT NULL,
  conditions TEXT NOT NULL,
  order_config TEXT,
  is_enabled INTEGER NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  last_triggered INTEGER,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  last_check INTEGER
);

CREATE TABLE alert_results (
  id TEXT PRIMARY KEY,
  alert_id TEXT NOT NULL,
  triggered INTEGER NOT NULL,
  values TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (alert_id) REFERENCES alerts (id)
);
```
