// Unit tests for payment export utilities

import {
  convertToCSV,
  convertToJSON,
  formatPaymentForExport,
  generateFilename,
  validateExportOptions,
  exportPaymentSummary
} from '@/utils/payment-export';
import { PaymentHistoryItem, PaymentMethod } from '@/types/payment';

describe('Payment Export Utilities', () => {
  const samplePayments: PaymentHistoryItem[] = [
    {
      id: '1',
      payment_type: 'ORIGINAL',
      method: PaymentMethod.CASH,
      amount: 1000,
      reference: undefined,
      date: '2024-01-15T10:00:00Z',
      recorded_by: 'User A',
      notes: 'Cash payment'
    },
    {
      id: '2',
      payment_type: 'EXTENSION',
      method: PaymentMethod.UPI,
      amount: 2500,
      reference: 'UPI123456789',
      date: '2024-01-16T14:30:00Z',
      recorded_by: 'User B',
      notes: 'Extension payment via UPI'
    },
    {
      id: '3',
      payment_type: 'RETURN',
      method: PaymentMethod.CARD,
      amount: 1500,
      reference: '1234567890123456',
      date: '2024-01-17T16:45:00Z',
      recorded_by: 'User C',
      notes: undefined
    }
  ];

  describe('formatPaymentForExport', () => {
    it('should format payment data correctly', () => {
      const formatted = formatPaymentForExport(samplePayments[0]);
      
      expect(formatted).toHaveProperty('id', '1');
      expect(formatted).toHaveProperty('payment_type', 'Original');
      expect(formatted).toHaveProperty('method', 'Cash');
      expect(formatted).toHaveProperty('amount', '1000.00');
      expect(formatted).toHaveProperty('date');
      expect(formatted.date).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/);
    });

    it('should handle missing optional fields', () => {
      const formatted = formatPaymentForExport(samplePayments[2]);
      
      expect(formatted.notes).toBe('');
      expect(formatted.reference).toBe('1234567890123456');
    });

    it('should format payment type correctly', () => {
      const formatted = formatPaymentForExport(samplePayments[1]);
      expect(formatted.payment_type).toBe('Extension');
    });

    it('should respect field selection', () => {
      const formatted = formatPaymentForExport(samplePayments[0], ['id', 'amount']);
      
      expect(Object.keys(formatted)).toEqual(['id', 'amount']);
      expect(formatted.id).toBe('1');
      expect(formatted.amount).toBe('1000.00');
    });
  });

  describe('convertToCSV', () => {
    it('should convert payments to CSV format', () => {
      const options = {
        format: 'CSV' as const,
        fields: ['id', 'method', 'amount'],
        includeHeaders: true
      };

      const csv = convertToCSV(samplePayments, options);
      const lines = csv.trim().split('\n');
      
      expect(lines[0]).toBe('Payment ID,Payment Method,Amount (₹)');
      expect(lines[1]).toBe('1,Cash,1000.00');
      expect(lines[2]).toBe('2,UPI,2500.00');
      expect(lines[3]).toBe('3,Credit/Debit Card,1500.00');
    });

    it('should handle CSV without headers', () => {
      const options = {
        format: 'CSV' as const,
        fields: ['id', 'amount'],
        includeHeaders: false
      };

      const csv = convertToCSV([samplePayments[0]], options);
      expect(csv.trim()).toBe('1,1000.00');
    });

    it('should escape special characters in CSV', () => {
      const paymentWithComma: PaymentHistoryItem = {
        ...samplePayments[0],
        notes: 'Payment with, comma'
      };

      const options = {
        format: 'CSV' as const,
        fields: ['id', 'notes']
      };

      const csv = convertToCSV([paymentWithComma], options);
      expect(csv).toContain('"Payment with, comma"');
    });
  });

  describe('convertToJSON', () => {
    it('should convert payments to JSON format', () => {
      const options = {
        format: 'JSON' as const,
        fields: ['id', 'method', 'amount'],
        companyInfo: {
          name: 'Test Company',
          address: 'Test Address',
          phone: '1234567890',
          email: 'test@test.com'
        }
      };

      const json = convertToJSON(samplePayments, options);
      const parsed = JSON.parse(json);
      
      expect(parsed).toHaveProperty('metadata');
      expect(parsed).toHaveProperty('payments');
      expect(parsed.metadata.total_records).toBe(3);
      expect(parsed.metadata.company_info.name).toBe('Test Company');
      expect(parsed.payments).toHaveLength(3);
      expect(parsed.payments[0]).toHaveProperty('id', '1');
    });

    it('should include export metadata', () => {
      const options = {
        format: 'JSON' as const,
        dateRange: {
          from: '2024-01-15',
          to: '2024-01-17'
        }
      };

      const json = convertToJSON(samplePayments, options);
      const parsed = JSON.parse(json);
      
      expect(parsed.metadata).toHaveProperty('export_date');
      expect(parsed.metadata).toHaveProperty('format_version', '1.0');
      expect(parsed.metadata.date_range).toEqual({
        from: '2024-01-15',
        to: '2024-01-17'
      });
    });
  });

  describe('generateFilename', () => {
    beforeAll(() => {
      // Mock Date to ensure consistent testing
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-15T10:30:45Z'));
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it('should generate filename with timestamp', () => {
      const filename = generateFilename('test-export', 'CSV');
      expect(filename).toBe('test-export-2024-01-15-103045.csv');
    });

    it('should generate filename with date range', () => {
      const dateRange = { from: '2024-01-01', to: '2024-01-31' };
      const filename = generateFilename('payments', 'JSON', dateRange);
      expect(filename).toBe('payments-2024-01-01-to-2024-01-31-2024-01-15-103045.json');
    });

    it('should use default base name', () => {
      const filename = generateFilename(undefined, 'Excel');
      expect(filename).toBe('payment-export-2024-01-15-103045.excel');
    });
  });

  describe('validateExportOptions', () => {
    it('should validate valid export options', () => {
      const options = {
        format: 'CSV' as const,
        fields: ['id', 'amount']
      };

      const errors = validateExportOptions(options);
      expect(errors).toHaveLength(0);
    });

    it('should require format', () => {
      const options = {} as any;
      const errors = validateExportOptions(options);
      expect(errors).toContain('Export format is required');
    });

    it('should validate format values', () => {
      const options = {
        format: 'INVALID' as any
      };
      const errors = validateExportOptions(options);
      expect(errors).toContain('Invalid export format');
    });

    it('should validate fields array', () => {
      const options = {
        format: 'CSV' as const,
        fields: []
      };
      const errors = validateExportOptions(options);
      expect(errors).toContain('At least one field must be selected');
    });

    it('should validate date range', () => {
      const options = {
        format: 'CSV' as const,
        dateRange: {
          from: '2024-01-31',
          to: '2024-01-01' // Invalid: start after end
        }
      };
      const errors = validateExportOptions(options);
      expect(errors).toContain('Start date must be before end date');
    });

    it('should require both dates in range', () => {
      const options = {
        format: 'CSV' as const,
        dateRange: {
          from: '2024-01-01'
          // Missing 'to'
        } as any
      };
      const errors = validateExportOptions(options);
      expect(errors).toContain('Both start and end dates are required');
    });
  });

  describe('exportPaymentSummary', () => {
    it('should generate payment summary', () => {
      const summary = exportPaymentSummary(samplePayments);
      
      expect(summary.total_payments).toBe(3);
      expect(summary.total_amount).toBe(5000); // 1000 + 2500 + 1500
      expect(summary.payment_methods).toHaveProperty('Cash');
      expect(summary.payment_methods).toHaveProperty('UPI');
      expect(summary.payment_methods).toHaveProperty('Credit/Debit Card');
    });

    it('should group by payment method correctly', () => {
      const summary = exportPaymentSummary(samplePayments);
      
      expect(summary.payment_methods['Cash']).toEqual({
        count: 1,
        amount: 1000
      });
      expect(summary.payment_methods['UPI']).toEqual({
        count: 1,
        amount: 2500
      });
      expect(summary.payment_methods['Credit/Debit Card']).toEqual({
        count: 1,
        amount: 1500
      });
    });

    it('should group by payment type correctly', () => {
      const summary = exportPaymentSummary(samplePayments);
      
      expect(summary.payment_types['ORIGINAL']).toEqual({
        count: 1,
        amount: 1000
      });
      expect(summary.payment_types['EXTENSION']).toEqual({
        count: 1,
        amount: 2500
      });
      expect(summary.payment_types['RETURN']).toEqual({
        count: 1,
        amount: 1500
      });
    });

    it('should handle empty payment array', () => {
      const summary = exportPaymentSummary([]);
      
      expect(summary.total_payments).toBe(0);
      expect(summary.total_amount).toBe(0);
      expect(summary.date_range.earliest).toBeNull();
      expect(summary.date_range.latest).toBeNull();
    });

    it('should find date range correctly', () => {
      const summary = exportPaymentSummary(samplePayments);
      
      expect(summary.date_range.earliest).toBe('2024-01-15T10:00:00Z');
      expect(summary.date_range.latest).toBe('2024-01-17T16:45:00Z');
    });
  });
});