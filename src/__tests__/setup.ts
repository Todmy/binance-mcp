import 'dotenv/config';

// Mock environment variables for testing
process.env.BINANCE_API_KEY = 'test-api-key';
process.env.BINANCE_API_SECRET = 'test-api-secret';
process.env.BINANCE_TESTNET = 'true';
process.env.MAX_POSITION_SIZE = '10000';
process.env.MAX_LEVERAGE = '20';
process.env.STOP_LOSS_PERCENTAGE = '0.02';
process.env.DAILY_LOSS_LIMIT = '1000';
process.env.PRICE_DEVIATION_LIMIT = '0.05';
process.env.TIME_IN_FORCE = 'GTC';

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
    }),
    futuresOrder: jest.fn().mockResolvedValue({
      orderId: 12345,
      symbol: 'BTCUSDT',
      status: 'FILLED',
      price: '50000',
      origQty: '0.001',
      side: 'BUY',
      type: 'LIMIT'
    })
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

// Clean up after all tests
afterAll(() => {
  jest.clearAllMocks();
  jest.resetModules();
});
