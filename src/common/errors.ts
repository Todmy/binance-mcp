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

export class MarketDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarketDataError";
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export class PredictionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PredictionError";
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class FuturesError extends Error {
  constructor(
    message: string,
    public readonly symbol: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "FuturesError";
  }
}

export class LiquidationError extends Error {
  constructor(
    message: string,
    public readonly symbol: string,
    public readonly position: {
      side: 'LONG' | 'SHORT';
      size: string;
      liquidationPrice: string;
    }
  ) {
    super(message);
    this.name = "LiquidationError";
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfter: number
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

export interface ErrorDetails {
  code?: number;
  message: string;
  field?: string;
  value?: unknown;
  symbol?: string;
  retryAfter?: number;
  position?: {
    side: 'LONG' | 'SHORT';
    size: string;
    liquidationPrice: string;
  };
}

export function createError(type: string, details: ErrorDetails): Error {
  switch (type) {
    case 'BinanceError':
      return new BinanceError(details.message, details.code || 0, details);

    case 'MarketDataError':
      return new MarketDataError(details.message);

    case 'ConfigurationError':
      return new ConfigurationError(details.message);

    case 'PredictionError':
      return new PredictionError(details.message);

    case 'ValidationError':
      return new ValidationError(details.message, details.field, details.value);

    case 'FuturesError':
      if (!details.symbol) throw new Error('Symbol is required for FuturesError');
      return new FuturesError(details.message, details.symbol, details);

    case 'LiquidationError':
      if (!details.symbol || !details.position) {
        throw new Error('Symbol and position details are required for LiquidationError');
      }
      return new LiquidationError(details.message, details.symbol, details.position);

    case 'RateLimitError':
      if (typeof details.retryAfter !== 'number') {
        throw new Error('retryAfter is required for RateLimitError');
      }
      return new RateLimitError(details.message, details.retryAfter);

    default:
      return new Error(details.message);
  }
}

export function isBinanceError(error: unknown): error is BinanceError {
  return error instanceof BinanceError;
}

export function isMarketDataError(error: unknown): error is MarketDataError {
  return error instanceof MarketDataError;
}

export function isFuturesError(error: unknown): error is FuturesError {
  return error instanceof FuturesError;
}

export function isLiquidationError(error: unknown): error is LiquidationError {
  return error instanceof LiquidationError;
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

export function formatErrorResponse(error: Error): { content: Array<{ type: 'text', text: string }>, isError: true } {
  let errorMessage = error.message;

  if (error instanceof LiquidationError) {
    errorMessage = `Liquidation warning for ${error.symbol}: ${error.message} (${error.position.side} position at ${error.position.liquidationPrice})`;
  } else if (error instanceof FuturesError) {
    errorMessage = `Futures error for ${error.symbol}: ${error.message}`;
  } else if (error instanceof RateLimitError) {
    errorMessage = `Rate limit exceeded: ${error.message}. Retry after ${error.retryAfter}ms`;
  } else if (error instanceof ValidationError && error.field) {
    errorMessage = `Validation error in ${error.field}: ${error.message}`;
  }

  return {
    content: [{
      type: 'text',
      text: errorMessage
    }],
    isError: true
  };
}
