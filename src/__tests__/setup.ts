// Test setup and configuration
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FuturesOrder } from '../core/binance-types';

// Ensure TypeScript uses isolated modules
(global as any).__TS_CONFIG__ = {
  ...((global as any).__TS_CONFIG__ || {}),
  isolatedModules: true
};

const SETTINGS_PATH = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'Code',
  'User',
  'globalStorage',
  'saoudrizwan.claude-dev',
  'settings',
  'cline_mcp_settings.json'
);

// Read current settings
const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));

// Set test configuration
settings.mcpServers.binanceMcp = {
  binance: {
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    testnet: true
  },
  risk: {
    maxPositionSize: 10000,
    maxLeverage: 20,
    stopLossPercentage: 0.02,
    dailyLossLimit: 1000,
    priceDeviationLimit: 0.05
  },
  strategy: {
    riskLevel: 'conservative',
    timeframe: '1h',
    indicators: [],
    customRules: []
  }
};

// Write test configuration back to settings file
fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));

// Mock Binance API
jest.mock('binance-api-node', () => {
  return jest.fn().mockImplementation(() => ({
    futuresAllBookTickers: jest.fn().mockResolvedValue({
      'BTCUSDT': {
        symbol: 'BTCUSDT',
        bestBidPrice: '50000',
        bestBidQty: '1.5',
        bestAskPrice: '50001',
        bestAskQty: '2.0'
      }
    } as Record<string, any>),
    futuresOrder: jest.fn().mockResolvedValue({
      orderId: 12345,
      symbol: 'BTCUSDT',
      status: 'FILLED',
      price: '50000',
      origQty: '0.001',
      executedQty: '0.001',  // Added missing required field
      side: 'BUY',
      type: 'LIMIT',
      time: Date.now(),      // Added missing required field
      timeInForce: 'GTC',    // Added missing required field
      clientOrderId: 'test1' // Added missing required field
    } as FuturesOrder)
  }));
});

// Global test timeout
jest.setTimeout(10000);

// Suppress console output during tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

// Global test cleanup and setup
beforeEach(() => {
  // Clear any mocked implementation state
  jest.clearAllMocks();
  // Reset all modules between tests
  jest.resetModules();
  // Reset timers
  jest.useRealTimers();
  // Clear any intervals/timeouts
  jest.clearAllTimers();
});

afterEach(() => {
  // Clean up any remaining mock state
  jest.restoreAllMocks();
  // Ensure WebSocket connections are closed
  jest.clearAllTimers();
});

// Clean up after all tests
afterAll(() => {
  jest.clearAllMocks();
  jest.resetModules();
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
});
