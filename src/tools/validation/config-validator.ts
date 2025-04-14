import { readFile } from 'fs/promises';
import { RiskConfig } from '../../config/types';
import * as path from 'path';

export class ConfigValidator {
  private marketDataSchema: any;
  private configSchema: any;

  constructor() {
    this.loadSchemas();
  }

  private async loadSchemas(): Promise<void> {
    try {
      const marketDataSchemaPath = path.join(__dirname, '../../resources/schemas/market-data.schema.json');
      const configSchemaPath = path.join(__dirname, '../../resources/schemas/config.schema.json');

      const [marketDataSchema, configSchema] = await Promise.all([
        readFile(marketDataSchemaPath, 'utf-8'),
        readFile(configSchemaPath, 'utf-8')
      ]);

      this.marketDataSchema = JSON.parse(marketDataSchema);
      this.configSchema = JSON.parse(configSchema);
    } catch (error) {
      console.error('Error loading schemas:', error);
      throw error;
    }
  }

  public validateRiskConfig(config: RiskConfig): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: []
    };

    // Validate maxPositionSize
    if (config.maxPositionSize <= 0) {
      result.isValid = false;
      result.errors.push('maxPositionSize must be greater than 0');
    }

    // Validate maxLeverage
    if (config.maxLeverage <= 0 || config.maxLeverage > 125) {
      result.isValid = false;
      result.errors.push('maxLeverage must be between 1 and 125');
    }

    // Validate stopLossPercentage
    if (config.stopLossPercentage <= 0 || config.stopLossPercentage > 1) {
      result.isValid = false;
      result.errors.push('stopLossPercentage must be between 0 and 1');
    }

    // Validate dailyLossLimit
    if (config.dailyLossLimit <= 0) {
      result.isValid = false;
      result.errors.push('dailyLossLimit must be greater than 0');
    }

    // Validate priceDeviationLimit
    if (config.priceDeviationLimit <= 0 || config.priceDeviationLimit > 1) {
      result.isValid = false;
      result.errors.push('priceDeviationLimit must be between 0 and 1');
    }

    return result;
  }

  public validateTradingPairConfig(config: any): ValidationResult {
    return this.validateAgainstSchema(config, this.configSchema, '#/definitions/tradingPair');
  }

  public validateStrategyConfig(config: any): ValidationResult {
    return this.validateAgainstSchema(config, this.configSchema, '#/definitions/strategy');
  }

  public validateBookTicker(data: any): ValidationResult {
    return this.validateAgainstSchema(data, this.marketDataSchema, '#/definitions/bookTicker');
  }

  public validateTrades(data: any): ValidationResult {
    return this.validateAgainstSchema(data, this.marketDataSchema, '#/definitions/trade');
  }

  private validateAgainstSchema(data: any, schema: any, definitionRef: string): ValidationResult {
    // Note: In a production environment, you would use a JSON Schema validator library
    // This is a basic implementation for demonstration
    const result: ValidationResult = {
      isValid: true,
      errors: []
    };

    try {
      // Basic type checking
      if (!data || typeof data !== 'object') {
        result.isValid = false;
        result.errors.push('Invalid data format');
        return result;
      }

      // Get the definition from the schema
      const definition = this.getDefinition(schema, definitionRef);
      if (!definition) {
        result.isValid = false;
        result.errors.push(`Schema definition not found: ${definitionRef}`);
        return result;
      }

      // Check required properties
      if (definition.required) {
        for (const requiredProp of definition.required) {
          if (!(requiredProp in data)) {
            result.isValid = false;
            result.errors.push(`Missing required property: ${requiredProp}`);
          }
        }
      }

      // Validate property types
      if (definition.properties) {
        for (const [prop, propSchema] of Object.entries(definition.properties)) {
          if (prop in data) {
            const value = data[prop];
            if (!this.validateType(value, (propSchema as any).type)) {
              result.isValid = false;
              result.errors.push(`Invalid type for property ${prop}`);
            }
          }
        }
      }
    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation error: ${(error as Error).message}`);
    }

    return result;
  }

  private getDefinition(schema: any, ref: string): any {
    const path = ref.split('/');
    let current = schema;

    for (let i = 1; i < path.length; i++) {
      current = current[path[i]];
      if (!current) return null;
    }

    return current;
  }

  private validateType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'integer':
        return Number.isInteger(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}
