// Unit tests for payment validation utilities

import {
  validatePayment,
  PaymentValidationRules,
  isWithinBusinessHours,
  isLargeAmount,
  detectSuspiciousPatterns,
  getPaymentMethodGuidance
} from '@/utils/payment-validation';
import { PaymentMethod, PaymentRecord } from '@/types/payment';

describe('Payment Validation', () => {
  describe('validatePayment', () => {
    it('should validate a valid cash payment', () => {
      const payment: Partial<PaymentRecord> = {
        method: PaymentMethod.CASH,
        amount: 1000,
        recorded_at: new Date().toISOString()
      };

      const result = validatePayment(payment);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should require reference for UPI payments', () => {
      const payment: Partial<PaymentRecord> = {
        method: PaymentMethod.UPI,
        amount: 1000,
        recorded_at: new Date().toISOString()
      };

      const result = validatePayment(payment);
      expect(result.isValid).toBe(false);
      expect(result.errors.reference).toContain('Reference is required');
    });

    it('should validate UPI reference format', () => {
      const payment: Partial<PaymentRecord> = {
        method: PaymentMethod.UPI,
        amount: 1000,
        reference: 'invalid',
        recorded_at: new Date().toISOString()
      };

      const result = validatePayment(payment);
      expect(result.isValid).toBe(false);
      expect(result.errors.reference).toContain('Invalid reference format');
    });

    it('should validate card reference format', () => {
      const payment: Partial<PaymentRecord> = {
        method: PaymentMethod.CARD,
        amount: 1000,
        reference: '1234567890123456',
        recorded_at: new Date().toISOString()
      };

      const result = validatePayment(payment);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should enforce cash amount limits', () => {
      const payment: Partial<PaymentRecord> = {
        method: PaymentMethod.CASH,
        amount: 150000, // Exceeds ₹1 Lakh limit
        recorded_at: new Date().toISOString()
      };

      const result = validatePayment(payment);
      expect(result.isValid).toBe(false);
      expect(result.errors.amount).toContain('Maximum amount');
    });

    it('should enforce minimum cheque amount', () => {
      const payment: Partial<PaymentRecord> = {
        method: PaymentMethod.CHEQUE,
        amount: 50, // Below ₹100 minimum
        reference: '123456',
        recorded_at: new Date().toISOString()
      };

      const result = validatePayment(payment);
      expect(result.isValid).toBe(false);
      expect(result.errors.amount).toContain('Minimum amount');
    });

    it('should validate cheque number format', () => {
      const payment: Partial<PaymentRecord> = {
        method: PaymentMethod.CHEQUE,
        amount: 1000,
        reference: '123456789',
        recorded_at: new Date().toISOString()
      };

      const result = validatePayment(payment);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });
  });

  describe('Business Hours Validation', () => {
    it('should return true for weekday business hours', () => {
      // Tuesday, 2 PM
      const businessHour = new Date('2024-01-16T14:00:00');
      expect(isWithinBusinessHours(businessHour)).toBe(true);
    });

    it('should return false for weekend', () => {
      // Sunday, 2 PM
      const weekend = new Date('2024-01-14T14:00:00');
      expect(isWithinBusinessHours(weekend)).toBe(false);
    });

    it('should return false for after hours', () => {
      // Tuesday, 9 PM
      const afterHours = new Date('2024-01-16T21:00:00');
      expect(isWithinBusinessHours(afterHours)).toBe(false);
    });
  });

  describe('Large Amount Detection', () => {
    it('should detect large amounts', () => {
      expect(isLargeAmount(50000)).toBe(true);
      expect(isLargeAmount(100000)).toBe(true);
    });

    it('should not flag small amounts', () => {
      expect(isLargeAmount(49999)).toBe(false);
      expect(isLargeAmount(1000)).toBe(false);
    });
  });

  describe('Suspicious Pattern Detection', () => {
    it('should detect round number patterns', () => {
      const payment: PaymentRecord = {
        method: PaymentMethod.CASH,
        amount: 50000, // Round number
        recorded_at: new Date().toISOString()
      };

      const warnings = detectSuspiciousPatterns(payment);
      expect(warnings).toContain('Round amount detected');
    });

    it('should detect large cash transactions', () => {
      const payment: PaymentRecord = {
        method: PaymentMethod.CASH,
        amount: 25000, // Large cash amount
        recorded_at: new Date().toISOString()
      };

      const warnings = detectSuspiciousPatterns(payment);
      expect(warnings).toContain('Large cash transaction');
    });

    it('should detect after-hours transactions', () => {
      const payment: PaymentRecord = {
        method: PaymentMethod.UPI,
        amount: 1000,
        recorded_at: new Date('2024-01-16T22:00:00').toISOString() // After hours
      };

      const warnings = detectSuspiciousPatterns(payment);
      expect(warnings).toContain('outside business hours');
    });
  });

  describe('Payment Method Guidance', () => {
    it('should provide guidance for cash payments', () => {
      const guidance = getPaymentMethodGuidance(PaymentMethod.CASH);
      expect(guidance).toContain('Verify currency notes for authenticity');
      expect(guidance).toContain('Count cash in presence of customer');
    });

    it('should provide guidance for UPI payments', () => {
      const guidance = getPaymentMethodGuidance(PaymentMethod.UPI);
      expect(guidance).toContain('Confirm UPI transaction ID');
      expect(guidance).toContain('Verify amount in banking app');
    });

    it('should provide guidance for card payments', () => {
      const guidance = getPaymentMethodGuidance(PaymentMethod.CARD);
      expect(guidance).toContain('Verify cardholder signature');
      expect(guidance).toContain('Check card expiry date');
    });
  });

  describe('Validation Rules', () => {
    it('should have correct cash payment rules', () => {
      const rules = PaymentValidationRules[PaymentMethod.CASH];
      expect(rules.minAmount).toBe(1);
      expect(rules.maxAmount).toBe(100000);
      expect(rules.requiresReference).toBe(false);
    });

    it('should have correct UPI payment rules', () => {
      const rules = PaymentValidationRules[PaymentMethod.UPI];
      expect(rules.maxAmount).toBe(200000);
      expect(rules.requiresReference).toBe(true);
      expect(rules.referenceMinLength).toBe(8);
    });

    it('should have correct cheque payment rules', () => {
      const rules = PaymentValidationRules[PaymentMethod.CHEQUE];
      expect(rules.minAmount).toBe(100);
      expect(rules.requiresReference).toBe(true);
      expect(rules.referencePattern).toEqual(/^[0-9]{6,10}$/);
    });
  });
});