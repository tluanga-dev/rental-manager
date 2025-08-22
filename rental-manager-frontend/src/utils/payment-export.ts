// Payment export utilities for various formats

import { PaymentHistoryItem, PaymentMethodInfo } from '@/types/payment';
import { format } from 'date-fns';

export interface PaymentExportOptions {
  format: 'CSV' | 'Excel' | 'PDF' | 'JSON';
  fields?: string[];
  dateRange?: {
    from: string;
    to: string;
  };
  filename?: string;
  includeHeaders?: boolean;
  companyInfo?: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
}

// Default export fields
export const DEFAULT_EXPORT_FIELDS = [
  'id',
  'date',
  'payment_type',
  'method',
  'amount',
  'reference',
  'notes',
  'recorded_by'
];

// Field labels for headers
export const FIELD_LABELS: Record<string, string> = {
  id: 'Payment ID',
  date: 'Date',
  payment_type: 'Payment Type',
  method: 'Payment Method',
  amount: 'Amount (₹)',
  reference: 'Reference/Transaction ID',
  notes: 'Notes',
  recorded_by: 'Recorded By'
};

// Format payment data for export
export const formatPaymentForExport = (payment: PaymentHistoryItem, fields?: string[]) => {
  const selectedFields = fields || DEFAULT_EXPORT_FIELDS;
  const formattedPayment: Record<string, any> = {};
  
  selectedFields.forEach(field => {
    switch (field) {
      case 'id':
        formattedPayment[field] = payment.id;
        break;
      case 'date':
        formattedPayment[field] = format(new Date(payment.date), 'dd/MM/yyyy HH:mm:ss');
        break;
      case 'payment_type':
        formattedPayment[field] = payment.payment_type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
        break;
      case 'method':
        formattedPayment[field] = PaymentMethodInfo[payment.method].label;
        break;
      case 'amount':
        formattedPayment[field] = payment.amount.toFixed(2);
        break;
      case 'reference':
        formattedPayment[field] = payment.reference || '';
        break;
      case 'notes':
        formattedPayment[field] = payment.notes || '';
        break;
      case 'recorded_by':
        formattedPayment[field] = payment.recorded_by || '';
        break;
    }
  });
  
  return formattedPayment;
};

// Convert to CSV format
export const convertToCSV = (
  payments: PaymentHistoryItem[],
  options: PaymentExportOptions
): string => {
  const fields = options.fields || DEFAULT_EXPORT_FIELDS;
  const includeHeaders = options.includeHeaders !== false;
  
  let csv = '';
  
  // Add headers
  if (includeHeaders) {
    const headers = fields.map(field => FIELD_LABELS[field] || field);
    csv += headers.join(',') + '\n';
  }
  
  // Add data rows
  payments.forEach(payment => {
    const formattedPayment = formatPaymentForExport(payment, fields);
    const row = fields.map(field => {
      const value = formattedPayment[field] || '';
      // Escape commas and quotes in CSV
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csv += row.join(',') + '\n';
  });
  
  return csv;
};

// Convert to JSON format
export const convertToJSON = (
  payments: PaymentHistoryItem[],
  options: PaymentExportOptions
): string => {
  const formattedPayments = payments.map(payment => 
    formatPaymentForExport(payment, options.fields)
  );
  
  const exportData = {
    metadata: {
      export_date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      total_records: payments.length,
      date_range: options.dateRange,
      format_version: '1.0',
      company_info: options.companyInfo
    },
    payments: formattedPayments
  };
  
  return JSON.stringify(exportData, null, 2);
};

// Generate filename with timestamp
export const generateFilename = (
  baseName: string = 'payment-export',
  format: string,
  dateRange?: { from: string; to: string }
): string => {
  const timestamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
  let filename = `${baseName}-${timestamp}`;
  
  if (dateRange) {
    const fromDate = format(new Date(dateRange.from), 'yyyy-MM-dd');
    const toDate = format(new Date(dateRange.to), 'yyyy-MM-dd');
    filename = `${baseName}-${fromDate}-to-${toDate}-${timestamp}`;
  }
  
  return `${filename}.${format.toLowerCase()}`;
};

// Download file to browser
export const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// Main export function
export const exportPayments = async (
  payments: PaymentHistoryItem[],
  options: PaymentExportOptions
): Promise<void> => {
  if (!payments.length) {
    throw new Error('No payment data to export');
  }
  
  // Filter by date range if provided
  let filteredPayments = payments || [];
  if (options.dateRange) {
    filteredPayments = (payments || []).filter(payment => {
      const paymentDate = new Date(payment?.date);
      const fromDate = new Date(options.dateRange!.from);
      const toDate = new Date(options.dateRange!.to);
      return paymentDate >= fromDate && paymentDate <= toDate;
    });
  }
  
  if (!filteredPayments.length) {
    throw new Error('No payments found in the specified date range');
  }
  
  const filename = options.filename || generateFilename('payment-export', options.format, options.dateRange);
  
  switch (options.format) {
    case 'CSV':
      const csvContent = convertToCSV(filteredPayments, options);
      downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
      break;
      
    case 'JSON':
      const jsonContent = convertToJSON(filteredPayments, options);
      downloadFile(jsonContent, filename, 'application/json;charset=utf-8;');
      break;
      
    case 'Excel':
      // For Excel export, we'll use CSV format which Excel can open
      const excelContent = convertToCSV(filteredPayments, options);
      const excelFilename = filename.replace('.excel', '.csv');
      downloadFile(excelContent, excelFilename, 'application/vnd.ms-excel;charset=utf-8;');
      break;
      
    case 'PDF':
      // PDF export would require a library like jsPDF or server-side generation
      // For now, we'll fall back to CSV
      console.warn('PDF export not yet implemented, falling back to CSV');
      const pdfContent = convertToCSV(filteredPayments, options);
      const pdfFilename = filename.replace('.pdf', '.csv');
      downloadFile(pdfContent, pdfFilename, 'text/csv;charset=utf-8;');
      break;
      
    default:
      throw new Error(`Unsupported export format: ${options.format}`);
  }
};

// Export summary statistics
export const exportPaymentSummary = (payments: PaymentHistoryItem[]) => {
  const summary = {
    total_payments: payments.length,
    total_amount: payments.reduce((sum, p) => sum + p.amount, 0),
    payment_methods: {} as Record<string, { count: number; amount: number }>,
    payment_types: {} as Record<string, { count: number; amount: number }>,
    date_range: {
      earliest: payments.length > 0 ? payments.reduce((earliest, p) => 
        new Date(p.date) < new Date(earliest.date) ? p : earliest
      ).date : null,
      latest: payments.length > 0 ? payments.reduce((latest, p) => 
        new Date(p.date) > new Date(latest.date) ? p : latest
      ).date : null
    }
  };
  
  // Group by payment method
  payments.forEach(payment => {
    const method = PaymentMethodInfo[payment.method].label;
    if (!summary.payment_methods[method]) {
      summary.payment_methods[method] = { count: 0, amount: 0 };
    }
    summary.payment_methods[method].count++;
    summary.payment_methods[method].amount += payment.amount;
  });
  
  // Group by payment type
  payments.forEach(payment => {
    const type = payment.payment_type;
    if (!summary.payment_types[type]) {
      summary.payment_types[type] = { count: 0, amount: 0 };
    }
    summary.payment_types[type].count++;
    summary.payment_types[type].amount += payment.amount;
  });
  
  return summary;
};

// Validate export options
export const validateExportOptions = (options: PaymentExportOptions): string[] => {
  const errors: string[] = [];
  
  if (!options.format) {
    errors.push('Export format is required');
  }
  
  if (!['CSV', 'Excel', 'PDF', 'JSON'].includes(options.format)) {
    errors.push('Invalid export format');
  }
  
  if (options.fields && options.fields.length === 0) {
    errors.push('At least one field must be selected for export');
  }
  
  if (options.dateRange) {
    if (!options.dateRange.from || !options.dateRange.to) {
      errors.push('Both start and end dates are required for date range filtering');
    } else if (new Date(options.dateRange.from) > new Date(options.dateRange.to)) {
      errors.push('Start date must be before end date');
    }
  }
  
  return errors;
};