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
import type { SaleTransactionWithLines } from '@/types/sales';
import type { CompanyInfo } from '@/types/system';

interface SalePrintDocumentProps {
  transaction: SaleTransactionWithLines;
  companyInfo?: CompanyInfo;
  documentType?: 'receipt' | 'invoice';
}

export function SalePrintDocument({ 
  transaction, 
  companyInfo,
  documentType = 'receipt'
}: SalePrintDocumentProps) {
  const defaultCompanyInfo = useCompanyProfileWithDefaults();
  const actualCompanyInfo = companyInfo || defaultCompanyInfo;

  const formatCurrency = (amount: number) => {
    return formatCurrencyWithProfile(amount, actualCompanyInfo);
  };

  const getStatusClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'status-completed';
      case 'pending': return 'status-pending';
      case 'cancelled': return 'status-cancelled';
      default: return 'status-pending';
    }
  };

  const customStyles = `
    .receipt-summary {
      background: #f8fafc;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .summary-row:last-child {
      border-bottom: none;
    }
    
    .summary-row.total {
      font-weight: bold;
      font-size: 16px;
      border-top: 2px solid #2563eb;
      background: #f1f5f9;
      margin-top: 10px;
      padding: 12px 0;
    }
    
    .payment-info {
      background: #f0f9ff;
      border: 1px solid #0ea5e9;
      border-radius: 6px;
      padding: 15px;
      margin: 15px 0;
    }
    
    .payment-method {
      font-weight: bold;
      color: #0369a1;
    }
    
    .thank-you {
      text-align: center;
      margin-top: 30px;
      padding: 20px;
      background: #f8fafc;
      border-radius: 8px;
    }
    
    .thank-you h3 {
      color: #2563eb;
      margin-bottom: 10px;
    }
    
    .customer-copy {
      text-align: center;
      margin-top: 20px;
      font-size: 10px;
      color: #6b7280;
    }
  `;

  const title = documentType === 'receipt' ? 'Sales Receipt' : 'Sales Invoice';
  
  const documentContent = `
    <!-- Transaction Information -->
    <div class="info-grid">
      <div class="info-section">
        <h3>Transaction Information</h3>
        <div class="info-row">
          <span class="info-label">Transaction #:</span>
          <span class="info-value">${transaction.transaction_number || transaction.id.slice(0, 8)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Date:</span>
          <span class="info-value">${format(new Date(transaction.transaction_date), 'MMMM dd, yyyy')}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Time:</span>
          <span class="info-value">${format(new Date(transaction.transaction_date), 'HH:mm:ss')}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Status:</span>
          <span class="info-value">
            <span class="status-badge ${getStatusClass(transaction.status)}">${transaction.status}</span>
          </span>
        </div>
      </div>

      <div class="info-section">
        <h3>Customer Information</h3>
        <div class="info-row">
          <span class="info-label">Customer:</span>
          <span class="info-value">${transaction.customer_name || 'Walk-in Customer'}</span>
        </div>
        ${transaction.customer_id ? `
        <div class="info-row">
          <span class="info-label">Customer ID:</span>
          <span class="info-value">${transaction.customer_id}</span>
        </div>
        ` : ''}
        ${transaction.customer_phone ? `
        <div class="info-row">
          <span class="info-label">Phone:</span>
          <span class="info-value">${transaction.customer_phone}</span>
        </div>
        ` : ''}
        ${transaction.customer_email ? `
        <div class="info-row">
          <span class="info-label">Email:</span>
          <span class="info-value">${transaction.customer_email}</span>
        </div>
        ` : ''}
      </div>
    </div>

    <!-- Items Table -->
    <table class="table-container">
      <thead>
        <tr>
          <th style="width: 45%">Item Description</th>
          <th style="width: 10%" class="text-center">Qty</th>
          <th style="width: 15%" class="text-right">Unit Price</th>
          <th style="width: 15%" class="text-right">Total</th>
          <th style="width: 15%" class="text-right">Discount</th>
        </tr>
      </thead>
      <tbody>
        ${transaction.lines?.map((line) => `
          <tr>
            <td>
              <div class="item-description">${line.item_name || 'Unknown Item'}</div>
              <div class="item-details">
                ${line.item_sku ? `SKU: ${line.item_sku}` : ''}
                ${line.item_description ? `• ${line.item_description}` : ''}
              </div>
            </td>
            <td class="text-center">${line.quantity}</td>
            <td class="text-right">${formatCurrency(line.unit_price)}</td>
            <td class="text-right">${formatCurrency(line.line_total)}</td>
            <td class="text-right">${line.discount_amount ? formatCurrency(line.discount_amount) : '—'}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="text-center">No items found</td></tr>'}
      </tbody>
    </table>

    <!-- Payment Information -->
    <div class="payment-info">
      <div class="payment-method">Payment Method: ${transaction.payment_method || 'Cash'}</div>
      <div class="info-row">
        <span class="info-label">Payment Status:</span>
        <span class="info-value">
          <span class="status-badge ${getStatusClass(transaction.payment_status)}">${transaction.payment_status}</span>
        </span>
      </div>
      ${transaction.payment_reference ? `
      <div class="info-row">
        <span class="info-label">Payment Reference:</span>
        <span class="info-value">${transaction.payment_reference}</span>
      </div>
      ` : ''}
    </div>

    <!-- Financial Summary -->
    <div class="receipt-summary">
      <div class="summary-row">
        <span>Subtotal:</span>
        <span>${formatCurrency(transaction.subtotal_amount)}</span>
      </div>
      <div class="summary-row">
        <span>Tax Amount:</span>
        <span>${formatCurrency(transaction.tax_amount)}</span>
      </div>
      <div class="summary-row">
        <span>Discount:</span>
        <span>-${formatCurrency(transaction.discount_amount)}</span>
      </div>
      <div class="summary-row total">
        <span>Total Amount:</span>
        <span>${formatCurrency(transaction.total_amount)}</span>
      </div>
    </div>

    <!-- Thank You Message -->
    <div class="thank-you">
      <h3>Thank You for Your Business!</h3>
      <p>We appreciate your trust in our services.</p>
      ${transaction.notes ? `<p><em>Note: ${transaction.notes}</em></p>` : ''}
    </div>

    <!-- Customer Copy Notice -->
    <div class="customer-copy">
      <p>--- Customer Copy ---</p>
      <p>Please retain this ${documentType} for your records</p>
    </div>
  `;

  const { documentHTML } = BasePrintDocument({
    title,
    documentType: title,
    documentId: transaction.transaction_number || transaction.id,
    children: documentContent,
    companyInfo: actualCompanyInfo,
    printOptions: {
      customStyles,
    },
  });

  return { documentContent: documentHTML };
}

// Backward compatibility export
export default SalePrintDocument;