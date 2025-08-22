'use client';

import React, { useState } from 'react';
import {
  Download,
  FileText,
  FileSpreadsheet,
  Database,
  Calendar,
  Filter,
  CheckSquare,
  Square,
  AlertCircle,
  Loader
} from 'lucide-react';
import { PaymentHistoryItem } from '@/types/payment';
import {
  exportPayments,
  validateExportOptions,
  PaymentExportOptions,
  DEFAULT_EXPORT_FIELDS,
  FIELD_LABELS,
  exportPaymentSummary
} from '@/utils/payment-export';
import { format } from 'date-fns';

interface PaymentExportProps {
  payments: PaymentHistoryItem[];
  onClose?: () => void;
  defaultDateRange?: {
    from: string;
    to: string;
  };
}

export const PaymentExport: React.FC<PaymentExportProps> = ({
  payments,
  onClose,
  defaultDateRange
}) => {
  const [exportFormat, setExportFormat] = useState<'CSV' | 'Excel' | 'JSON'>('CSV');
  const [selectedFields, setSelectedFields] = useState<string[]>(DEFAULT_EXPORT_FIELDS);
  const [dateRange, setDateRange] = useState(defaultDateRange || {
    from: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd')
  });
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customFilename, setCustomFilename] = useState('');

  const handleFieldToggle = (field: string) => {
    if (selectedFields.includes(field)) {
      setSelectedFields(prev => prev.filter(f => f !== field));
    } else {
      setSelectedFields(prev => [...prev, field]);
    }
  };

  const selectAllFields = () => {
    setSelectedFields(DEFAULT_EXPORT_FIELDS);
  };

  const clearAllFields = () => {
    setSelectedFields([]);
  };

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const options: PaymentExportOptions = {
        format: exportFormat,
        fields: selectedFields,
        dateRange: dateRange,
        filename: customFilename || undefined,
        includeHeaders: true,
        companyInfo: {
          name: 'Rental Management System',
          address: '123 Business Street, City - 123456',
          phone: '+91 12345 67890',
          email: 'info@rentalsystem.com'
        }
      };

      // Validate options
      const validationErrors = validateExportOptions(options);
      if (validationErrors.length > 0) {
        setError(validationErrors.join(', '));
        return;
      }

      await exportPayments(payments, options);
      
      // Close modal after successful export
      setTimeout(() => {
        onClose?.();
      }, 1000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const getFilteredPaymentsCount = () => {
    if (!dateRange.from || !dateRange.to) return payments.length;
    
    return payments.filter(payment => {
      const paymentDate = new Date(payment.date);
      return paymentDate >= new Date(dateRange.from) && paymentDate <= new Date(dateRange.to);
    }).length;
  };

  const summary = exportPaymentSummary(payments);

  const formatIcons = {
    CSV: <FileText className="w-5 h-5" />,
    Excel: <FileSpreadsheet className="w-5 h-5" />,
    JSON: <Database className="w-5 h-5" />
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Download className="w-5 h-5" />
              Export Payment Data
            </h2>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-xl"
                disabled={isExporting}
              >
                ×
              </button>
            )}
          </div>
          
          {/* Summary */}
          <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
            <div className="text-center p-2 bg-blue-50 rounded">
              <div className="font-semibold text-blue-900">{summary.total_payments}</div>
              <div className="text-blue-600">Total Payments</div>
            </div>
            <div className="text-center p-2 bg-green-50 rounded">
              <div className="font-semibold text-green-900">
                ₹{summary.total_amount.toLocaleString('en-IN')}
              </div>
              <div className="text-green-600">Total Amount</div>
            </div>
            <div className="text-center p-2 bg-purple-50 rounded">
              <div className="font-semibold text-purple-900">{getFilteredPaymentsCount()}</div>
              <div className="text-purple-600">Selected for Export</div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Export Format Selection */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Export Format</h3>
            <div className="grid grid-cols-3 gap-3">
              {(['CSV', 'Excel', 'JSON'] as const).map(format => (
                <button
                  key={format}
                  onClick={() => setExportFormat(format)}
                  disabled={isExporting}
                  className={`flex items-center justify-center gap-2 p-4 border-2 rounded-lg transition-colors ${
                    exportFormat === format
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  } disabled:opacity-50`}
                >
                  {formatIcons[format]}
                  <span className="font-medium">{format}</span>
                </button>
              ))}
            </div>
            <div className="mt-2 text-sm text-gray-500">
              {exportFormat === 'CSV' && 'Comma-separated values, compatible with Excel and spreadsheet applications'}
              {exportFormat === 'Excel' && 'Excel-compatible format for advanced data analysis'}
              {exportFormat === 'JSON' && 'Structured data format with metadata, suitable for technical analysis'}
            </div>
          </div>

          {/* Date Range Filter */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Date Range Filter
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                  disabled={isExporting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                  disabled={isExporting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Field Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Fields to Export
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={selectAllFields}
                  disabled={isExporting}
                  className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  Select All
                </button>
                <button
                  onClick={clearAllFields}
                  disabled={isExporting}
                  className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  Clear All
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {DEFAULT_EXPORT_FIELDS.map(field => (
                <div
                  key={field}
                  className="flex items-center gap-2 p-2 border border-gray-200 rounded cursor-pointer hover:bg-gray-50"
                  onClick={() => handleFieldToggle(field)}
                >
                  {selectedFields.includes(field) ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="text-sm text-gray-700">{FIELD_LABELS[field]}</span>
                </div>
              ))}
            </div>
            
            <div className="mt-2 text-sm text-gray-500">
              Selected: {selectedFields.length} of {DEFAULT_EXPORT_FIELDS.length} fields
            </div>
          </div>

          {/* Custom Filename */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Custom Filename (Optional)</h3>
            <input
              type="text"
              value={customFilename}
              onChange={(e) => setCustomFilename(e.target.value)}
              placeholder="payment-export-custom"
              disabled={isExporting}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              Leave empty to use auto-generated filename with timestamp
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-900">Export Error</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            {onClose && (
              <button
                onClick={onClose}
                disabled={isExporting}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleExport}
              disabled={isExporting || selectedFields.length === 0}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Export {exportFormat}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};