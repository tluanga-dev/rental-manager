// Payment-related TypeScript interfaces and enums

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  UPI = 'UPI',
  NET_BANKING = 'NET_BANKING', 
  CHEQUE = 'CHEQUE',
  BANK_TRANSFER = 'BANK_TRANSFER',
  WALLET = 'WALLET'
}

export interface PaymentRecord {
  method: PaymentMethod;
  amount: number;
  reference?: string; // Optional transaction/reference ID
  notes?: string;
  recorded_at: string;
  recorded_by?: string;
}

export interface PaymentHistoryItem {
  id: string;
  payment_type: 'ORIGINAL' | 'EXTENSION' | 'RETURN' | 'ADJUSTMENT';
  method: PaymentMethod;
  amount: number;
  reference?: string;
  date: string;
  recorded_by?: string;
  notes?: string;
}

export interface PaymentSummary {
  total_paid: number;
  outstanding_balance: number;
  payment_history: PaymentHistoryItem[];
  payment_methods_used: {
    method: PaymentMethod;
    total_amount: number;
    transaction_count: number;
  }[];
}

// Payment method display information
export const PaymentMethodInfo = {
  [PaymentMethod.CASH]: {
    label: 'Cash',
    icon: '💵',
    requiresReference: false
  },
  [PaymentMethod.CARD]: {
    label: 'Credit/Debit Card',
    icon: '💳',
    requiresReference: true
  },
  [PaymentMethod.UPI]: {
    label: 'UPI',
    icon: '📱',
    requiresReference: true
  },
  [PaymentMethod.NET_BANKING]: {
    label: 'Net Banking',
    icon: '🏦',
    requiresReference: true
  },
  [PaymentMethod.CHEQUE]: {
    label: 'Cheque',
    icon: '📝',
    requiresReference: true
  },
  [PaymentMethod.BANK_TRANSFER]: {
    label: 'Bank Transfer',
    icon: '🔄',
    requiresReference: true
  },
  [PaymentMethod.WALLET]: {
    label: 'Digital Wallet',
    icon: '👛',
    requiresReference: true
  }
};