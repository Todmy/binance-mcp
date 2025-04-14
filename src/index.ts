import { TradingEngine } from './core/trading-engine';
import { BinanceConfig, RiskConfig } from './config/types';
import { TimeInForce } from 'binance-api-node';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main(): Promise<void> {
  // Load configuration from environment variables
  const binanceConfig: BinanceConfig = {
    apiKey: process.env.BINANCE_API_KEY || '',
    apiSecret: process.env.BINANCE_API_SECRET || '',
    testnet: process.env.BINANCE_TESTNET === 'true'
  };

  const riskConfig: RiskConfig = {
    maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '10000'),
    maxLeverage: parseInt(process.env.MAX_LEVERAGE || '20'),
    stopLossPercentage: parseFloat(process.env.STOP_LOSS_PERCENTAGE || '0.02'),
    dailyLossLimit: parseFloat(process.env.DAILY_LOSS_LIMIT || '1000'),
    priceDeviationLimit: parseFloat(process.env.PRICE_DEVIATION_LIMIT || '0.05')
  };

  // Initialize trading engine
  const engine = new TradingEngine(binanceConfig, riskConfig);

  // Set up event handlers
  engine.on('tradePending', (trade) => {
    console.info('Trade pending:', trade);
  });

  engine.on('tradeExecuted', ({ trade, order }) => {
    console.info('Trade executed:', { trade, order });
  });

  engine.on('tradeRejected', ({ trade, error }) => {
    console.error('Trade rejected:', { trade, error });
  });

  engine.on('tradeCancelled', (trade) => {
    console.info('Trade cancelled:', trade);
  });

  engine.on('error', (error) => {
    console.error('Trading engine error:', error);
  });

  // Example: Create and execute a trade
  try {
    // Start monitoring the symbol
    await engine.monitorSymbol('BTCUSDT');

    // Create a trade
    const trade = await engine.createTrade({
      symbol: 'BTCUSDT',
      side: 'BUY',
      type: 'LIMIT',
      quantity: 0.001,
      price: 50000,
      stopLoss: 49000,
      takeProfit: 52000,
      timeInForce: process.env.TIME_IN_FORCE as TimeInForce || 'GTC' as TimeInForce
    });

    console.info('Trade created:', trade);

    // Approve the trade after 5 seconds
    setTimeout(async () => {
      try {
        await engine.approveTrade(trade.id);
        console.info('Trade approved and executed');
      } catch (error) {
        console.error('Error approving trade:', error);
      }
    }, 5000);

  } catch (error) {
    console.error('Error in trading example:', error);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.info('Shutting down...');
  process.exit(0);
});

// Run the main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
