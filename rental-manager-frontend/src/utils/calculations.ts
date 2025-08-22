/**
 * Calculation utilities for line totals, pricing, and financial operations
 * Provides type-safe calculation functions with proper precision handling
 */

import { Decimal } from 'decimal.js';

// Configure Decimal for financial precision
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Common calculation types
 */
export interface LineItem {
  quantity: number;
  unit_price: number;
  discount_amount?: number;
  tax_rate?: number;
  tax_amount?: number;
}

export interface RentalLineItem extends LineItem {
  rental_days?: number;
  rental_period?: number;
  unit_rate?: number;
}

export interface CalculationResult {
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
}

/**
 * Calculate line total for standard purchase items
 * Formula: (quantity × unit_price) - discount_amount + tax_amount
 */
export function calculatePurchaseLineTotal(item: LineItem): CalculationResult {
  const quantity = new Decimal(item.quantity);
  const unitPrice = new Decimal(item.unit_price);
  const discountAmount = new Decimal(item.discount_amount || 0);
  const taxAmount = new Decimal(item.tax_amount || 0);

  const subtotal = quantity.mul(unitPrice);
  const afterDiscount = subtotal.minus(discountAmount);
  const lineTotal = afterDiscount.plus(taxAmount);

  return {
    subtotal: subtotal.toNumber(),
    discount_amount: discountAmount.toNumber(),
    tax_amount: taxAmount.toNumber(),
    line_total: lineTotal.toNumber(),
  };
}

/**
 * Calculate line total for rental items
 * Formula: (quantity × unit_rate × rental_period) - discount_amount + tax_amount
 */
export function calculateRentalLineTotal(item: RentalLineItem): CalculationResult {
  const quantity = new Decimal(item.quantity);
  const unitRate = new Decimal(item.unit_rate || item.unit_price);
  const rentalPeriod = new Decimal(item.rental_period || item.rental_days || 1);
  const discountAmount = new Decimal(item.discount_amount || 0);
  const taxAmount = new Decimal(item.tax_amount || 0);

  const subtotal = quantity.mul(unitRate).mul(rentalPeriod);
  const afterDiscount = subtotal.minus(discountAmount);
  const lineTotal = afterDiscount.plus(taxAmount);

  return {
    subtotal: subtotal.toNumber(),
    discount_amount: discountAmount.toNumber(),
    tax_amount: taxAmount.toNumber(),
    line_total: lineTotal.toNumber(),
  };
}

/**
 * Calculate rental item total for frontend components
 * Simplified version for UI calculations
 */
export function calculateRentalItemTotal(
  quantity: number,
  unitRate: number,
  rentalPeriod: number,
  discountValue: number = 0
): number {
  const baseTotal = quantity * unitRate * rentalPeriod;
  return Math.max(0, baseTotal - discountValue);
}

/**
 * Calculate tax amount based on taxable amount and tax rate
 */
export function calculateTaxAmount(
  taxableAmount: number,
  taxRate: number,
  isInclusive: boolean = false
): number {
  const amount = new Decimal(taxableAmount);
  const rate = new Decimal(taxRate).div(100);

  if (isInclusive) {
    // Tax inclusive: tax = amount - (amount / (1 + rate))
    const baseAmount = amount.div(new Decimal(1).plus(rate));
    return amount.minus(baseAmount).toNumber();
  } else {
    // Tax exclusive: tax = amount * rate
    return amount.mul(rate).toNumber();
  }
}

/**
 * Calculate discount amount based on original amount and discount parameters
 */
export function calculateDiscountAmount(
  originalAmount: number,
  discountValue: number,
  isPercentage: boolean = false
): number {
  const amount = new Decimal(originalAmount);
  const discount = new Decimal(discountValue);

  if (isPercentage) {
    const rate = discount.div(100);
    return amount.mul(rate).toNumber();
  } else {
    return Math.min(discount.toNumber(), originalAmount);
  }
}

/**
 * Calculate rental days between two dates
 */
export function calculateRentalDays(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate total for multiple line items
 */
export function calculateTransactionTotal(items: LineItem[]): {
  subtotal: number;
  total_discount: number;
  total_tax: number;
  grand_total: number;
} {
  let subtotal = new Decimal(0);
  let totalDiscount = new Decimal(0);
  let totalTax = new Decimal(0);

  items.forEach(item => {
    const result = calculatePurchaseLineTotal(item);
    subtotal = subtotal.plus(result.subtotal);
    totalDiscount = totalDiscount.plus(result.discount_amount);
    totalTax = totalTax.plus(result.tax_amount);
  });

  const grandTotal = subtotal.minus(totalDiscount).plus(totalTax);

  return {
    subtotal: subtotal.toNumber(),
    total_discount: totalDiscount.toNumber(),
    total_tax: totalTax.toNumber(),
    grand_total: grandTotal.toNumber(),
  };
}

/**
 * Format currency with proper precision
 */
export function formatCurrency(
  amount: number,
  currency: string = 'INR',
  locale: string = 'en-IN'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Round to specified decimal places using financial rounding
 */
export function roundFinancial(amount: number, decimalPlaces: number = 2): number {
  return new Decimal(amount).toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Safe number conversion with validation
 */
export function toSafeNumber(value: any, defaultValue: number = 0): number {
  if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && isFinite(parsed)) {
      return parsed;
    }
  }
  return defaultValue;
}

/**
 * Validate calculation results for potential issues
 */
export function validateCalculationResult(result: CalculationResult): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (result.subtotal < 0) {
    errors.push('Subtotal cannot be negative');
  }

  if (result.discount_amount < 0) {
    errors.push('Discount amount cannot be negative');
  }

  if (result.tax_amount < 0) {
    errors.push('Tax amount cannot be negative');
  }

  if (result.discount_amount > result.subtotal) {
    errors.push('Discount amount cannot exceed subtotal');
  }

  if (result.line_total < 0) {
    errors.push('Line total cannot be negative');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}