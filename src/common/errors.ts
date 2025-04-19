export class BinanceError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly response?: unknown
  ) {
    super(message);
    this.name = "BinanceError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export class TradingError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = "TradingError";
  }
}

export class MarketDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarketDataError";
  }
}

export function isBinanceError(error: unknown): error is BinanceError {
  return error instanceof BinanceError;
}
