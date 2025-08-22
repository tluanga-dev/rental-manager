import React from 'react';
import { format } from 'date-fns';
import { 
  BasePrintDocument, 
  PrintTable, 
  PrintInfoGrid, 
  PrintInfoSection, 
  PrintInfoRow 
} from './BasePrintDocument';
import { useCompanyProfileWithDefaults, formatCurrencyWithProfile } from '@/hooks/use-company-profile';
import type { CompanyInfo } from '@/types/system';

interface ReceiptItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
}

interface GenericReceipt {
  id: string;
  receipt_number: string;
  receipt_date: string;
  receipt_type: 'payment' | 'refund' | 'deposit' | 'other';
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  amount: number;
  tax_amount?: number;
  discount_amount?: number;
  payment_method: string;
  payment_reference?: string;
  description?: string;
  items?: ReceiptItem[];
  notes?: string;
  status: string;
}

interface ReceiptPrintDocumentProps {
  receipt: GenericReceipt;
  companyInfo?: CompanyInfo;
}

export function ReceiptPrintDocument({ 
  receipt, 
  companyInfo
}: ReceiptPrintDocumentProps) {
  const defaultCompanyInfo = useCompanyProfileWithDefaults();
  const actualCompanyInfo = companyInfo || defaultCompanyInfo;

  const formatCurrency = (amount: number) => {
    return formatCurrencyWithProfile(amount, actualCompanyInfo);
  };

  const getReceiptTypeLabel = (type: string) => {
    switch (type.toLowerCase()) {
      case 'payment': return 'Payment Receipt';
      case 'refund': return 'Refund Receipt';
      case 'deposit': return 'Deposit Receipt';
      case 'other': return 'Receipt';
      default: return 'Receipt';
    }
  };

  const getStatusClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'status-completed';
      case 'pending': return 'status-pending';
      case 'cancelled': return 'status-cancelled';
      case 'refunded': return 'status-cancelled';
      default: return 'status-pending';
    }
  };

  const customStyles = `
    .receipt-header {
      background: #f8fafc;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 30px;
      text-align: center;
    }
    
    .receipt-number {
      font-size: 18px;
      font-weight: bold;
      color: #2563eb;
      margin-bottom: 10px;
    }
    
    .receipt-type {
      font-size: 14px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .amount-summary {
      background: #f0f9ff;
      border: 2px solid #0ea5e9;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      text-align: center;
    }
    
    .amount-summary h3 {
      color: #0369a1;
      margin-bottom: 15px;
    }
    
    .total-amount {
      font-size: 24px;
      font-weight: bold;
      color: #1e293b;
    }
    
    .payment-details {
      background: #f8fafc;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 15px;
      margin: 15px 0;
    }
    
    .payment-method {
      font-weight: bold;
      color: #374151;
      margin-bottom: 10px;
    }
    
    .breakdown {
      margin: 20px 0;
    }
    
    .breakdown-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .breakdown-row:last-child {
      border-bottom: none;
    }
    
    .breakdown-row.total {
      font-weight: bold;
      font-size: 16px;
      border-top: 2px solid #2563eb;
      background: #f1f5f9;
      margin-top: 10px;
      padding: 12px 0;
    }
    
    .receipt-footer {
      text-align: center;
      margin-top: 30px;
      padding: 20px;
      background: #f8fafc;
      border-radius: 8px;
    }
    
    .validity-notice {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 6px;
      padding: 15px;
      margin: 15px 0;
      text-align: center;
    }
    
    .validity-notice h4 {
      color: #92400e;
      margin-bottom: 10px;
    }
    
    .duplicate-notice {
      text-align: center;
      margin-top: 20px;
      font-size: 10px;
      color: #6b7280;
    }
  `;

  const documentContent = `
    <!-- Receipt Header -->
    <div class="receipt-header">
      <div class="receipt-number">${receipt.receipt_number}</div>
      <div class="receipt-type">${getReceiptTypeLabel(receipt.receipt_type)}</div>
    </div>

    <!-- Receipt Information -->
    <div class="info-grid">
      <div class="info-section">
        <h3>Receipt Information</h3>
        <div class="info-row">
          <span class="info-label">Receipt #:</span>
          <span class="info-value">${receipt.receipt_number}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Date:</span>
          <span class="info-value">${format(new Date(receipt.receipt_date), 'MMMM dd, yyyy')}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Time:</span>
          <span class="info-value">${format(new Date(receipt.receipt_date), 'HH:mm:ss')}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Type:</span>
          <span class="info-value">${getReceiptTypeLabel(receipt.receipt_type)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Status:</span>
          <span class="info-value">
            <span class="status-badge ${getStatusClass(receipt.status)}">${receipt.status}</span>
          </span>
        </div>
      </div>

      <div class="info-section">
        <h3>Customer Information</h3>
        <div class="info-row">
          <span class="info-label">Name:</span>
          <span class="info-value">${receipt.customer_name || 'Walk-in Customer'}</span>
        </div>
        ${receipt.customer_phone ? `
        <div class="info-row">
          <span class="info-label">Phone:</span>
          <span class="info-value">${receipt.customer_phone}</span>
        </div>
        ` : ''}
        ${receipt.customer_email ? `
        <div class="info-row">
          <span class="info-label">Email:</span>
          <span class="info-value">${receipt.customer_email}</span>
        </div>
        ` : ''}
      </div>
    </div>

    <!-- Items (if any) -->
    ${receipt.items && receipt.items.length > 0 ? `
    <table class="table-container">
      <thead>
        <tr>
          <th style="width: 45%">Item Description</th>
          <th style="width: 10%" class="text-center">Qty</th>
          <th style="width: 15%" class="text-right">Unit Price</th>
          <th style="width: 15%" class="text-right">Total</th>
          <th style="width: 15%" class="text-center">Notes</th>
        </tr>
      </thead>
      <tbody>
        ${receipt.items.map((item) => `
          <tr>
            <td>
              <div class="item-description">${item.name}</div>
              ${item.description ? `<div class="item-details">${item.description}</div>` : ''}
            </td>
            <td class="text-center">${item.quantity}</td>
            <td class="text-right">${formatCurrency(item.unit_price)}</td>
            <td class="text-right">${formatCurrency(item.total_price)}</td>
            <td class="text-center">${item.notes || '—'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}

    <!-- Description (if no items) -->
    ${!receipt.items || receipt.items.length === 0 ? `
    <div class="info-section">
      <h3>Description</h3>
      <p style="padding: 15px; background: #f8fafc; border-radius: 6px; margin: 10px 0;">
        ${receipt.description || 'General payment receipt'}
      </p>
    </div>
    ` : ''}

    <!-- Payment Details -->
    <div class="payment-details">
      <div class="payment-method">Payment Method: ${receipt.payment_method}</div>
      ${receipt.payment_reference ? `
      <div class="info-row">
        <span class="info-label">Reference:</span>
        <span class="info-value">${receipt.payment_reference}</span>
      </div>
      ` : ''}
    </div>

    <!-- Amount Summary -->
    <div class="amount-summary">
      <h3>Amount ${receipt.receipt_type === 'refund' ? 'Refunded' : 'Received'}</h3>
      
      ${receipt.items && receipt.items.length > 0 ? `
      <div class="breakdown">
        <div class="breakdown-row">
          <span>Subtotal:</span>
          <span>${formatCurrency(receipt.amount - (receipt.tax_amount || 0))}</span>
        </div>
        ${receipt.tax_amount ? `
        <div class="breakdown-row">
          <span>Tax Amount:</span>
          <span>${formatCurrency(receipt.tax_amount)}</span>
        </div>
        ` : ''}
        ${receipt.discount_amount ? `
        <div class="breakdown-row">
          <span>Discount:</span>
          <span>-${formatCurrency(receipt.discount_amount)}</span>
        </div>
        ` : ''}
        <div class="breakdown-row total">
          <span>Total Amount:</span>
          <span>${formatCurrency(receipt.amount)}</span>
        </div>
      </div>
      ` : `
      <div class="total-amount">${formatCurrency(receipt.amount)}</div>
      `}
    </div>

    <!-- Validity Notice -->
    <div class="validity-notice">
      <h4>Important Notice</h4>
      <p>This receipt is valid for 30 days from the date of issue.</p>
      <p>Please retain this receipt for your records.</p>
    </div>

    ${receipt.notes ? `
    <div class="info-section">
      <h3>Additional Notes</h3>
      <p style="padding: 15px; background: #f8fafc; border-radius: 6px; margin: 10px 0;">
        ${receipt.notes}
      </p>
    </div>
    ` : ''}

    <!-- Footer -->
    <div class="receipt-footer">
      <p style="font-weight: bold; margin-bottom: 10px;">Thank you for your business!</p>
      <p style="font-size: 10px; color: #6b7280;">
        For any queries regarding this receipt, please contact us.
      </p>
    </div>

    <!-- Duplicate Notice -->
    <div class="duplicate-notice">
      <p>--- Customer Copy ---</p>
      <p>This is a computer-generated receipt and does not require signature</p>
    </div>
  `;

  const { documentHTML } = BasePrintDocument({
    title: getReceiptTypeLabel(receipt.receipt_type),
    documentType: getReceiptTypeLabel(receipt.receipt_type),
    documentId: receipt.receipt_number,
    children: documentContent,
    companyInfo: actualCompanyInfo,
    printOptions: {
      customStyles,
    },
  });

  return { documentContent: documentHTML };
}

// Backward compatibility export
export default ReceiptPrintDocument;