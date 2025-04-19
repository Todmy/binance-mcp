import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BinanceConfig, RiskConfig, StrategyConfig } from './types';

interface BinanceMcpSettings {
  binance: BinanceConfig;
  risk: RiskConfig;
  strategy: StrategyConfig;
}

export class VSCodeSettingsManager {
  private static readonly SETTINGS_PATH = path.join(
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

  private static readSettings(): any {
    try {
      const content = fs.readFileSync(this.SETTINGS_PATH, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to read VSCode settings: ${error}`);
    }
  }

  static getBinanceConfig(): BinanceMcpSettings {
    const settings = this.readSettings();
    const binanceMcp = settings.mcpServers.binanceMcp;

    if (!binanceMcp) {
      throw new Error('Binance MCP configuration not found in VSCode settings');
    }

    return {
      binance: binanceMcp.binance,
      risk: binanceMcp.risk,
      strategy: binanceMcp.strategy
    };
  }

  static validateConfig(config: BinanceMcpSettings): void {
    // Validate Binance config
    if (!config.binance.apiKey || !config.binance.apiSecret) {
      throw new Error('Binance API credentials are required');
    }

    // Validate Risk config
    const { risk } = config;
    if (
      risk.maxPositionSize <= 0 ||
      risk.maxLeverage <= 0 ||
      risk.stopLossPercentage <= 0 ||
      risk.dailyLossLimit <= 0 ||
      risk.priceDeviationLimit <= 0
    ) {
      throw new Error('Invalid risk management parameters');
    }

    // Validate Strategy config
    const { strategy } = config;
    if (!['conservative', 'moderate', 'aggressive'].includes(strategy.riskLevel)) {
      throw new Error('Invalid risk level in strategy configuration');
    }

    const validTimeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
    if (!validTimeframes.includes(strategy.timeframe)) {
      throw new Error('Invalid timeframe in strategy configuration');
    }
  }

  static async saveConfig(config: BinanceMcpSettings): Promise<void> {
    try {
      const settings = this.readSettings();
      settings.mcpServers = settings.mcpServers || {};
      settings.mcpServers.binanceMcp = config;

      await fs.promises.writeFile(
        this.SETTINGS_PATH,
        JSON.stringify(settings, null, 2),
        'utf8'
      );
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error}`);
    }
  }
}
