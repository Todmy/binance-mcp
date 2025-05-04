import { PriceCalculator } from '../../../tools/math/price-calculator';

describe('PriceCalculator', () => {
  let calculator: PriceCalculator;

  beforeEach(() => {
    calculator = new PriceCalculator();
  });

  describe('calculateAveragePrice', () => {
    it('should calculate average price correctly', () => {
      expect(calculator.calculateAveragePrice([10, 20, 30])).toBe(20);
    });

    it('should return 0 for empty array', () => {
      expect(calculator.calculateAveragePrice([])).toBe(0);
    });
  });

  describe('calculateVWAP', () => {
    it('should calculate VWAP correctly', () => {
      const trades = [
        { price: 10, quantity: 2 },
        { price: 20, quantity: 3 },
      ];
      // (10 * 2 + 20 * 3) / (2 + 3) = 16
      expect(calculator.calculateVWAP(trades)).toBe(16);
    });

    it('should return 0 for empty trades array', () => {
      expect(calculator.calculateVWAP([])).toBe(0);
    });
  });

  describe('calculatePriceChange', () => {
    it('should calculate price increase correctly', () => {
      const result = calculator.calculatePriceChange(100, 120);
      expect(result.absoluteChange).toBe(20);
      expect(result.percentageChange).toBe(20);
      expect(result.direction).toBe('up');
    });

    it('should calculate price decrease correctly', () => {
      const result = calculator.calculatePriceChange(100, 80);
      expect(result.absoluteChange).toBe(-20);
      expect(result.percentageChange).toBe(-20);
      expect(result.direction).toBe('down');
    });

    it('should handle no price change', () => {
      const result = calculator.calculatePriceChange(100, 100);
      expect(result.absoluteChange).toBe(0);
      expect(result.percentageChange).toBe(0);
      expect(result.direction).toBe('unchanged');
    });
  });

  describe('calculateMA', () => {
    it('should calculate moving average correctly', () => {
      const prices = [1, 2, 3, 4, 5];
      const ma = calculator.calculateMA(prices, 3);
      expect(ma).toEqual([2, 3, 4]); // (1+2+3)/3, (2+3+4)/3, (3+4+5)/3
    });

    it('should return empty array for invalid period', () => {
      expect(calculator.calculateMA([1, 2, 3], 4)).toEqual([]);
      expect(calculator.calculateMA([1, 2, 3], 0)).toEqual([]);
    });
  });

  describe('calculateEMA', () => {
    it('should calculate EMA correctly', () => {
      const prices = [2, 4, 6, 8, 10];
      const ema = calculator.calculateEMA(prices, 3);
      expect(ema.length).toBe(prices.length);
      expect(ema[0]).toBe(2); // First value is same as price
    });

    it('should return empty array for invalid period', () => {
      expect(calculator.calculateEMA([1, 2, 3], 4)).toEqual([]);
      expect(calculator.calculateEMA([1, 2, 3], 0)).toEqual([]);
    });
  });

  describe('calculateVolatility', () => {
    it('should calculate volatility metrics correctly', () => {
      const prices = [10, 12, 8, 11, 9];
      const result = calculator.calculateVolatility(prices);

      expect(result.meanPrice).toBe(10);
      expect(result.standardDeviation).toBeGreaterThan(0);
      expect(result.variance).toBeGreaterThan(0);
      expect(result.coefficientOfVariation).toBeGreaterThan(0);
    });

    it('should handle insufficient data', () => {
      // Empty array
      const emptyResult = calculator.calculateVolatility([]);
      expect(emptyResult.standardDeviation).toBe(0);
      expect(emptyResult.variance).toBe(0);
      expect(emptyResult.meanPrice).toBe(0);
      expect(emptyResult.coefficientOfVariation).toBe(0);

      // Single price
      const singleResult = calculator.calculateVolatility([10]);
      expect(singleResult.standardDeviation).toBe(0);
      expect(singleResult.variance).toBe(0);
      expect(singleResult.meanPrice).toBe(0);
      expect(singleResult.coefficientOfVariation).toBe(0);

      // All same prices (should have zero volatility)
      const sameResult = calculator.calculateVolatility([10, 10, 10]);
      expect(sameResult.standardDeviation).toBe(0);
      expect(sameResult.variance).toBe(0);
      expect(sameResult.meanPrice).toBe(10);
      expect(sameResult.coefficientOfVariation).toBe(0);
    });
  });
});
