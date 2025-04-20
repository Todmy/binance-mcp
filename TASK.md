# Task: Implement Runtime WebSocket Configuration

## Objective

Add the ability to configure WebSocket server details during runtime, similar to MarketScanner's configuration approach.

## Implementation Details

1. Create WebSocketConfig interface:

```typescript
interface WebSocketConfig {
  baseUrl?: string; // Custom WebSocket URL
  maxReconnectAttempts?: number; // Default: 5
  reconnectDelayBase?: number; // Base delay for exponential backoff
  maxReconnectDelay?: number; // Default: 30000
  testnet?: boolean; // Default: false
}
```

2. Modify WebSocketManager class:

- Update constructor to accept WebSocketConfig
- Add updateConfig method for runtime changes
- Implement configuration validation
- Update reconnection logic to use config values

3. Update dependent classes:

- Update MarketScanner to work with new WebSocketManager interface
- Ensure backward compatibility

## Acceptance Criteria

- [ ] WebSocketManager accepts partial configuration object
- [ ] Configuration can be updated at runtime
- [ ] Maintains backward compatibility
- [ ] All WebSocket functionality works with custom configuration
- [ ] Configuration changes properly affect connection behavior

## Technical Notes

- Add configuration validation
- Update documentation
- Add usage examples
- Consider adding configuration events to notify about config changes
- Implement proper error handling for invalid configurations
