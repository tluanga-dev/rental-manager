/**
 * Comprehensive tests for calculation utilities
 */

import {
  calculatePurchaseLineTotal,
  calculateRentalLineTotal,
  calculateTaxAmount,
  calculateDiscountAmount,
  calculateRentalDays,
  calculateTransactionTotal,
  formatCurrency,
  roundFinancial,
  toSafeNumber,
  validateCalculationResult,
  LineItem,
  RentalLineItem,
} from '../calculations';

describe('calculatePurchaseLineTotal', () => {
  it('should calculate basic line total correctly', () => {
    const item: LineItem = {
      quantity: 2,
      unit_price: 100,
    };

    const result = calculatePurchaseLineTotal(item);

    expect(result.subtotal).toBe(200);
    expect(result.discount_amount).toBe(0);
    expect(result.tax_amount).toBe(0);
    expect(result.line_total).toBe(200);
  });

  it('should calculate line total with discount', () => {
    const item: LineItem = {
      quantity: 2,
      unit_price: 100,
      discount_amount: 20,
    };

    const result = calculatePurchaseLineTotal(item);

    expect(result.subtotal).toBe(200);
    expect(result.discount_amount).toBe(20);
    expect(result.tax_amount).toBe(0);
    expect(result.line_total).toBe(180);
  });

  it('should calculate line total with tax', () => {
    const item: LineItem = {
      quantity: 2,
      unit_price: 100,
      tax_amount: 36,
    };

    const result = calculatePurchaseLineTotal(item);

    expect(result.subtotal).toBe(200);
    expect(result.discount_amount).toBe(0);
    expect(result.tax_amount).toBe(36);
    expect(result.line_total).toBe(236);
  });

  it('should calculate line total with discount and tax', () => {
    const item: LineItem = {
      quantity: 2,
      unit_price: 100,
      discount_amount: 20,
      tax_amount: 32.4, // 18% tax on (200 - 20)
    };

    const result = calculatePurchaseLineTotal(item);

    expect(result.subtotal).toBe(200);
    expect(result.discount_amount).toBe(20);
    expect(result.tax_amount).toBe(32.4);
    expect(result.line_total).toBe(212.4);
  });

  it('should handle decimal quantities and prices', () => {
    const item: LineItem = {
      quantity: 2.5,
      unit_price: 99.99,
    };

    const result = calculatePurchaseLineTotal(item);

    expect(result.subtotal).toBe(249.975);
    expect(result.line_total).toBe(249.975);
  });
});

describe('calculateRentalLineTotal', () => {
  it('should calculate rental line total with rental days', () => {
    const item: RentalLineItem = {
      quantity: 1,
      unit_rate: 50,
      rental_days: 7,
    };

    const result = calculateRentalLineTotal(item);

    expect(result.subtotal).toBe(350); // 1 * 50 * 7
    expect(result.line_total).toBe(350);
  });

  it('should calculate rental line total with rental period', () => {
    const item: RentalLineItem = {
      quantity: 2,
      unit_rate: 25,
      rental_period: 5,
    };

    const result = calculateRentalLineTotal(item);

    expect(result.subtotal).toBe(250); // 2 * 25 * 5
    expect(result.line_total).toBe(250);
  });

  it('should default to 1 day if no rental period specified', () => {
    const item: RentalLineItem = {
      quantity: 1,
      unit_rate: 100,
    };

    const result = calculateRentalLineTotal(item);

    expect(result.subtotal).toBe(100); // 1 * 100 * 1
    expect(result.line_total).toBe(100);
  });

  it('should calculate rental with discount and tax', () => {
    const item: RentalLineItem = {
      quantity: 2,
      unit_rate: 100,
      rental_days: 3,
      discount_amount: 50,
      tax_amount: 95, // 18% tax on (600 - 50)
    };

    const result = calculateRentalLineTotal(item);

    expect(result.subtotal).toBe(600); // 2 * 100 * 3
    expect(result.discount_amount).toBe(50);
    expect(result.tax_amount).toBe(95);
    expect(result.line_total).toBe(645); // 600 - 50 + 95
  });

  it('should use unit_price if unit_rate not provided', () => {
    const item: RentalLineItem = {
      quantity: 1,
      unit_price: 75,
      rental_days: 2,
    };

    const result = calculateRentalLineTotal(item);

    expect(result.subtotal).toBe(150); // 1 * 75 * 2
    expect(result.line_total).toBe(150);
  });
});

describe('calculateTaxAmount', () => {
  it('should calculate exclusive tax correctly', () => {
    const taxAmount = calculateTaxAmount(1000, 18, false);
    expect(taxAmount).toBe(180);
  });

  it('should calculate inclusive tax correctly', () => {
    const taxAmount = calculateTaxAmount(1180, 18, true);
    expect(taxAmount).toBeCloseTo(180, 2);
  });

  it('should handle zero tax rate', () => {
    const taxAmount = calculateTaxAmount(1000, 0, false);
    expect(taxAmount).toBe(0);
  });

  it('should handle fractional tax rates', () => {
    const taxAmount = calculateTaxAmount(1000, 12.5, false);
    expect(taxAmount).toBe(125);
  });
});

describe('calculateDiscountAmount', () => {
  it('should calculate percentage discount', () => {
    const discount = calculateDiscountAmount(1000, 10, true);
    expect(discount).toBe(100);
  });

  it('should calculate fixed discount', () => {
    const discount = calculateDiscountAmount(1000, 150, false);
    expect(discount).toBe(150);
  });

  it('should cap fixed discount at original amount', () => {
    const discount = calculateDiscountAmount(1000, 1500, false);
    expect(discount).toBe(1000);
  });

  it('should handle zero discount', () => {
    const discount = calculateDiscountAmount(1000, 0, true);
    expect(discount).toBe(0);
  });
});

describe('calculateRentalDays', () => {
  it('should calculate rental days correctly', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-07');
    const days = calculateRentalDays(startDate, endDate);
    expect(days).toBe(6);
  });

  it('should handle same day rental', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-01');
    const days = calculateRentalDays(startDate, endDate);
    expect(days).toBe(0);
  });

  it('should handle reversed dates', () => {
    const startDate = new Date('2024-01-07');
    const endDate = new Date('2024-01-01');
    const days = calculateRentalDays(startDate, endDate);
    expect(days).toBe(6);
  });
});

describe('calculateTransactionTotal', () => {
  it('should calculate totals for multiple items', () => {
    const items: LineItem[] = [
      {
        quantity: 2,
        unit_price: 100,
        discount_amount: 10,
        tax_amount: 34.2,
      },
      {
        quantity: 1,
        unit_price: 50,
        discount_amount: 5,
        tax_amount: 8.1,
      },
    ];

    const result = calculateTransactionTotal(items);

    expect(result.subtotal).toBe(250); // 200 + 50
    expect(result.total_discount).toBe(15); // 10 + 5
    expect(result.total_tax).toBe(42.3); // 34.2 + 8.1
    expect(result.grand_total).toBe(277.3); // 250 - 15 + 42.3
  });

  it('should handle empty items array', () => {
    const result = calculateTransactionTotal([]);

    expect(result.subtotal).toBe(0);
    expect(result.total_discount).toBe(0);
    expect(result.total_tax).toBe(0);
    expect(result.grand_total).toBe(0);
  });
});

describe('formatCurrency', () => {
  it('should format INR currency correctly', () => {
    const formatted = formatCurrency(1234.56);
    expect(formatted).toBe('₹1,234.56');
  });

  it('should format USD currency correctly', () => {
    const formatted = formatCurrency(1234.56, 'USD', 'en-US');
    expect(formatted).toBe('$1,234.56');
  });

  it('should handle zero amount', () => {
    const formatted = formatCurrency(0);
    expect(formatted).toBe('₹0.00');
  });

  it('should handle negative amounts', () => {
    const formatted = formatCurrency(-1234.56);
    expect(formatted).toBe('-₹1,234.56');
  });
});

describe('roundFinancial', () => {
  it('should round to 2 decimal places by default', () => {
    expect(roundFinancial(123.456789)).toBe(123.46);
  });

  it('should round to specified decimal places', () => {
    expect(roundFinancial(123.456789, 3)).toBe(123.457);
  });

  it('should handle whole numbers', () => {
    expect(roundFinancial(123)).toBe(123.00);
  });

  it('should use half-up rounding', () => {
    expect(roundFinancial(123.125, 2)).toBe(123.13);
    expect(roundFinancial(123.124, 2)).toBe(123.12);
  });
});

describe('toSafeNumber', () => {
  it('should return valid numbers unchanged', () => {
    expect(toSafeNumber(123.45)).toBe(123.45);
    expect(toSafeNumber(0)).toBe(0);
    expect(toSafeNumber(-123)).toBe(-123);
  });

  it('should parse valid string numbers', () => {
    expect(toSafeNumber('123.45')).toBe(123.45);
    expect(toSafeNumber('0')).toBe(0);
    expect(toSafeNumber('-123')).toBe(-123);
  });

  it('should return default for invalid inputs', () => {
    expect(toSafeNumber('abc')).toBe(0);
    expect(toSafeNumber('')).toBe(0);
    expect(toSafeNumber(null)).toBe(0);
    expect(toSafeNumber(undefined)).toBe(0);
    expect(toSafeNumber(NaN)).toBe(0);
    expect(toSafeNumber(Infinity)).toBe(0);
  });

  it('should use custom default value', () => {
    expect(toSafeNumber('abc', 100)).toBe(100);
  });
});

describe('validateCalculationResult', () => {
  it('should validate correct calculation result', () => {
    const result = {
      subtotal: 200,
      discount_amount: 20,
      tax_amount: 32.4,
      line_total: 212.4,
    };

    const validation = validateCalculationResult(result);

    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should detect negative subtotal', () => {
    const result = {
      subtotal: -100,
      discount_amount: 0,
      tax_amount: 0,
      line_total: -100,
    };

    const validation = validateCalculationResult(result);

    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('Subtotal cannot be negative');
  });

  it('should detect negative discount', () => {
    const result = {
      subtotal: 100,
      discount_amount: -10,
      tax_amount: 0,
      line_total: 110,
    };

    const validation = validateCalculationResult(result);

    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('Discount amount cannot be negative');
  });

  it('should detect discount exceeding subtotal', () => {
    const result = {
      subtotal: 100,
      discount_amount: 150,
      tax_amount: 0,
      line_total: -50,
    };

    const validation = validateCalculationResult(result);

    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('Discount amount cannot exceed subtotal');
    expect(validation.errors).toContain('Line total cannot be negative');
  });

  it('should detect negative tax amount', () => {
    const result = {
      subtotal: 100,
      discount_amount: 0,
      tax_amount: -18,
      line_total: 82,
    };

    const validation = validateCalculationResult(result);

    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('Tax amount cannot be negative');
  });

  it('should detect multiple validation errors', () => {
    const result = {
      subtotal: -100,
      discount_amount: -20,
      tax_amount: -18,
      line_total: -138,
    };

    const validation = validateCalculationResult(result);

    expect(validation.isValid).toBe(false);
    expect(validation.errors).toHaveLength(4);
  });
});

describe('Edge cases and precision', () => {
  it('should handle very small amounts', () => {
    const item: LineItem = {
      quantity: 0.001,
      unit_price: 0.01,
    };

    const result = calculatePurchaseLineTotal(item);

    expect(result.subtotal).toBe(0.00001);
    expect(result.line_total).toBe(0.00001);
  });

  it('should handle very large amounts', () => {
    const item: LineItem = {
      quantity: 1000000,
      unit_price: 999999.99,
    };

    const result = calculatePurchaseLineTotal(item);

    expect(result.subtotal).toBe(999999990000);
    expect(result.line_total).toBe(999999990000);
  });

  it('should maintain precision with complex calculations', () => {
    const item: RentalLineItem = {
      quantity: 3.33,
      unit_rate: 99.99,
      rental_days: 7,
      discount_amount: 123.45,
      tax_amount: 456.78,
    };

    const result = calculateRentalLineTotal(item);

    // Expected: 3.33 * 99.99 * 7 = 2332.767
    expect(result.subtotal).toBeCloseTo(2332.767, 3);
    
    // Expected: 2332.767 - 123.45 + 456.78 = 2666.097
    expect(result.line_total).toBeCloseTo(2666.097, 3);
  });
});