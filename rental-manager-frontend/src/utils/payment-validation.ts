// Payment validation utilities and rules

import { PaymentMethod, PaymentRecord, PaymentMethodInfo } from '@/types/payment';

export interface PaymentValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: string[];
}

export interface PaymentValidationRules {
  minAmount?: number;
  maxAmount?: number;
  requiresReference: boolean;
  referencePattern?: RegExp;
  referenceMinLength?: number;
  referenceMaxLength?: number;
}

// Enhanced validation rules for each payment method
export const PaymentValidationRules: Record<PaymentMethod, PaymentValidationRules> = {
  [PaymentMethod.CASH]: {
    minAmount: 1,
    maxAmount: 100000, // ₹1 Lakh limit for cash transactions
    requiresReference: false,
  },
  [PaymentMethod.CARD]: {
    minAmount: 1,
    maxAmount: 500000, // ₹5 Lakh limit for card transactions
    requiresReference: true,
    referencePattern: /^[0-9]{4,16}$/, // 4-16 digit card reference
    referenceMinLength: 4,
    referenceMaxLength: 16,
  },
  [PaymentMethod.UPI]: {
    minAmount: 1,
    maxAmount: 200000, // ₹2 Lakh UPI daily limit
    requiresReference: true,
    referencePattern: /^[a-zA-Z0-9@.-]{8,50}$/, // UPI transaction ID format
    referenceMinLength: 8,
    referenceMaxLength: 50,
  },
  [PaymentMethod.NET_BANKING]: {
    minAmount: 1,
    maxAmount: 1000000, // ₹10 Lakh limit for net banking
    requiresReference: true,
    referencePattern: /^[a-zA-Z0-9]{6,30}$/, // Bank transaction reference
    referenceMinLength: 6,
    referenceMaxLength: 30,
  },
  [PaymentMethod.CHEQUE]: {
    minAmount: 100, // Minimum cheque amount ₹100
    maxAmount: 1000000, // ₹10 Lakh limit for cheques
    requiresReference: true,
    referencePattern: /^[0-9]{6,10}$/, // Cheque number format
    referenceMinLength: 6,
    referenceMaxLength: 10,
  },
  [PaymentMethod.BANK_TRANSFER]: {
    minAmount: 1,
    maxAmount: 2000000, // ₹20 Lakh limit for bank transfers
    requiresReference: true,
    referencePattern: /^[a-zA-Z0-9]{8,35}$/, // UTR/NEFT reference format
    referenceMinLength: 8,
    referenceMaxLength: 35,
  },
  [PaymentMethod.WALLET]: {
    minAmount: 1,
    maxAmount: 200000, // ₹2 Lakh wallet limit
    requiresReference: true,
    referencePattern: /^[a-zA-Z0-9]{8,40}$/, // Wallet transaction ID
    referenceMinLength: 8,
    referenceMaxLength: 40,
  },
};

// Business hours validation
export const isWithinBusinessHours = (date: Date = new Date()): boolean => {
  const hour = date.getHours();
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Monday to Saturday, 9 AM to 8 PM
  return day >= 1 && day <= 6 && hour >= 9 && hour < 20;
};

// Large amount validation
export const isLargeAmount = (amount: number): boolean => {
  return amount >= 50000; // ₹50,000 or more
};

// Suspicious pattern detection
export const detectSuspiciousPatterns = (payment: PaymentRecord): string[] => {
  const warnings: string[] = [];
  
  // Round number detection (might indicate estimated amounts)
  if (payment.amount % 1000 === 0 && payment.amount >= 10000) {
    warnings.push('Round amount detected - verify if exact amount');
  }
  
  // Late hour transactions
  if (payment.recorded_at) {
    const recordedTime = new Date(payment.recorded_at);
    if (!isWithinBusinessHours(recordedTime)) {
      warnings.push('Transaction recorded outside business hours');
    }
  }
  
  // Large cash transactions
  if (payment.method === PaymentMethod.CASH && payment.amount >= 20000) {
    warnings.push('Large cash transaction - consider compliance requirements');
  }
  
  // Repeated similar amounts in short time
  // This would require historical data - placeholder for future enhancement
  
  return warnings;
};

// Main payment validation function
export const validatePayment = (
  payment: Partial<PaymentRecord>,
  customRules?: Partial<PaymentValidationRules>
): PaymentValidationResult => {
  const errors: Record<string, string> = {};
  const warnings: string[] = [];
  
  // Basic required field validation
  if (!payment.method) {
    errors.method = 'Payment method is required';
  }
  
  if (!payment.amount || payment.amount <= 0) {
    errors.amount = 'Valid payment amount is required';
  }
  
  // Method-specific validation
  if (payment.method && payment.amount) {
    const rules = { ...PaymentValidationRules[payment.method], ...customRules };
    
    // Amount range validation
    if (rules.minAmount && payment.amount < rules.minAmount) {
      errors.amount = `Minimum amount for ${PaymentMethodInfo[payment.method].label} is ₹${rules.minAmount}`;
    }
    
    if (rules.maxAmount && payment.amount > rules.maxAmount) {
      errors.amount = `Maximum amount for ${PaymentMethodInfo[payment.method].label} is ₹${rules.maxAmount.toLocaleString('en-IN')}`;
    }
    
    // Reference validation
    if (rules.requiresReference) {
      if (!payment.reference?.trim()) {
        errors.reference = `Reference is required for ${PaymentMethodInfo[payment.method].label}`;
      } else {
        const ref = payment.reference.trim();
        
        if (rules.referenceMinLength && ref.length < rules.referenceMinLength) {
          errors.reference = `Reference must be at least ${rules.referenceMinLength} characters`;
        }
        
        if (rules.referenceMaxLength && ref.length > rules.referenceMaxLength) {
          errors.reference = `Reference must not exceed ${rules.referenceMaxLength} characters`;
        }
        
        if (rules.referencePattern && !rules.referencePattern.test(ref)) {
          errors.reference = `Invalid reference format for ${PaymentMethodInfo[payment.method].label}`;
        }
      }
    }
    
    // Generate warnings for suspicious patterns
    if (Object.keys(errors).length === 0) {
      const suspiciousWarnings = detectSuspiciousPatterns(payment as PaymentRecord);
      warnings.push(...suspiciousWarnings);
      
      // Large amount warnings
      if (isLargeAmount(payment.amount)) {
        warnings.push(`Large amount transaction (₹${payment.amount.toLocaleString('en-IN')}) - additional verification recommended`);
      }
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings,
  };
};

// Payment method specific helpers
export const getPaymentMethodGuidance = (method: PaymentMethod): string[] => {
  const guidance: Record<PaymentMethod, string[]> = {
    [PaymentMethod.CASH]: [
      'Verify currency notes for authenticity',
      'Count cash in presence of customer',
      'Provide physical receipt',
    ],
    [PaymentMethod.CARD]: [
      'Verify cardholder signature',
      'Check card expiry date',
      'Enter last 4 digits as reference',
      'Keep card payment receipt',
    ],
    [PaymentMethod.UPI]: [
      'Confirm UPI transaction ID',
      'Verify amount in banking app',
      'Take screenshot of successful transaction',
    ],
    [PaymentMethod.NET_BANKING]: [
      'Confirm bank transaction reference',
      'Verify transfer in bank statement',
      'Keep digital receipt/confirmation',
    ],
    [PaymentMethod.CHEQUE]: [
      'Verify cheque date and signature',
      'Confirm bank and branch details',
      'Enter cheque number as reference',
      'Hold cheque until clearance',
    ],
    [PaymentMethod.BANK_TRANSFER]: [
      'Confirm UTR/NEFT reference number',
      'Verify transfer in bank account',
      'Match transferred amount exactly',
    ],
    [PaymentMethod.WALLET]: [
      'Confirm wallet transaction ID',
      'Verify payment in wallet app',
      'Check wallet balance deduction',
    ],
  };
  
  return guidance[method] || [];
};

// Format validation errors for display
export const formatValidationErrors = (result: PaymentValidationResult): string => {
  if (result.isValid) return '';
  
  const errorMessages = Object.values(result.errors);
  return errorMessages.join('; ');
};

// Format validation warnings for display
export const formatValidationWarnings = (result: PaymentValidationResult): string => {
  if (result.warnings.length === 0) return '';
  
  return result.warnings.join('; ');
};