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

interface RentalItem {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  quantity: number;
  daily_rate: number;
  rental_days: number;
  total_amount: number;
  condition?: string;
  notes?: string;
}

interface RentalAgreement {
  id: string;
  rental_number: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  rental_start_date: string;
  rental_end_date: string;
  return_date?: string;
  status: string;
  total_amount: number;
  security_deposit?: number;
  tax_amount?: number;
  discount_amount?: number;
  payment_status: string;
  payment_method?: string;
  items: RentalItem[];
  terms_conditions?: string;
  notes?: string;
}

interface RentalPrintDocumentProps {
  rental: RentalAgreement;
  companyInfo?: CompanyInfo;
  documentType?: 'agreement' | 'receipt' | 'return';
}

export function RentalPrintDocument({ 
  rental, 
  companyInfo,
  documentType = 'agreement'
}: RentalPrintDocumentProps) {
  const defaultCompanyInfo = useCompanyProfileWithDefaults();
  const actualCompanyInfo = companyInfo || defaultCompanyInfo;

  const formatCurrency = (amount: number) => {
    return formatCurrencyWithProfile(amount, actualCompanyInfo);
  };

  const getStatusClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'status-completed';
      case 'pending': return 'status-pending';
      case 'completed': return 'status-completed';
      case 'cancelled': return 'status-cancelled';
      case 'overdue': return 'status-cancelled';
      default: return 'status-pending';
    }
  };

  const customStyles = `
    .rental-period {
      background: #f0f9ff;
      border: 2px solid #0ea5e9;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      text-align: center;
    }
    
    .rental-period h3 {
      color: #0369a1;
      margin-bottom: 10px;
    }
    
    .rental-dates {
      display: flex;
      justify-content: space-between;
      margin-top: 15px;
    }
    
    .date-box {
      background: white;
      border: 1px solid #0ea5e9;
      border-radius: 6px;
      padding: 10px;
      text-align: center;
      flex: 1;
      margin: 0 5px;
    }
    
    .date-label {
      font-size: 10px;
      color: #0369a1;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    
    .date-value {
      font-weight: bold;
      color: #1e293b;
    }
    
    .security-deposit {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 6px;
      padding: 15px;
      margin: 15px 0;
    }
    
    .security-deposit h4 {
      color: #92400e;
      margin-bottom: 10px;
    }
    
    .terms-section {
      background: #f8fafc;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    
    .terms-section h4 {
      color: #374151;
      margin-bottom: 15px;
    }
    
    .terms-section ul {
      list-style-type: disc;
      margin-left: 20px;
    }
    
    .terms-section li {
      margin-bottom: 5px;
      font-size: 10px;
    }
    
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 50px;
      margin-top: 50px;
    }
    
    .signature-box {
      text-align: center;
    }
    
    .signature-line {
      border-top: 2px solid #374151;
      margin-top: 40px;
      padding-top: 10px;
      font-size: 12px;
      color: #6b7280;
    }
    
    .return-conditions {
      background: #fee2e2;
      border: 1px solid #ef4444;
      border-radius: 6px;
      padding: 15px;
      margin: 15px 0;
    }
    
    .return-conditions h4 {
      color: #dc2626;
      margin-bottom: 10px;
    }
  `;

  const getTitle = () => {
    switch (documentType) {
      case 'agreement': return 'Rental Agreement';
      case 'receipt': return 'Rental Receipt';
      case 'return': return 'Return Receipt';
      default: return 'Rental Agreement';
    }
  };

  const documentContent = `
    <!-- Rental Period Information -->
    <div class="rental-period">
      <h3>Rental Period</h3>
      <div class="rental-dates">
        <div class="date-box">
          <div class="date-label">Start Date</div>
          <div class="date-value">${format(new Date(rental.rental_start_date), 'MMM dd, yyyy')}</div>
        </div>
        <div class="date-box">
          <div class="date-label">End Date</div>
          <div class="date-value">${format(new Date(rental.rental_end_date), 'MMM dd, yyyy')}</div>
        </div>
        ${rental.return_date ? `
        <div class="date-box">
          <div class="date-label">Returned</div>
          <div class="date-value">${format(new Date(rental.return_date), 'MMM dd, yyyy')}</div>
        </div>
        ` : ''}
      </div>
    </div>

    <!-- Rental Information -->
    <div class="info-grid">
      <div class="info-section">
        <h3>Rental Information</h3>
        <div class="info-row">
          <span class="info-label">Rental #:</span>
          <span class="info-value">${rental.rental_number}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Agreement Date:</span>
          <span class="info-value">${format(new Date(), 'MMMM dd, yyyy')}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Status:</span>
          <span class="info-value">
            <span class="status-badge ${getStatusClass(rental.status)}">${rental.status}</span>
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">Payment Status:</span>
          <span class="info-value">
            <span class="status-badge ${getStatusClass(rental.payment_status)}">${rental.payment_status}</span>
          </span>
        </div>
      </div>

      <div class="info-section">
        <h3>Customer Information</h3>
        <div class="info-row">
          <span class="info-label">Name:</span>
          <span class="info-value">${rental.customer_name}</span>
        </div>
        ${rental.customer_phone ? `
        <div class="info-row">
          <span class="info-label">Phone:</span>
          <span class="info-value">${rental.customer_phone}</span>
        </div>
        ` : ''}
        ${rental.customer_email ? `
        <div class="info-row">
          <span class="info-label">Email:</span>
          <span class="info-value">${rental.customer_email}</span>
        </div>
        ` : ''}
        ${rental.customer_address ? `
        <div class="info-row">
          <span class="info-label">Address:</span>
          <span class="info-value">${rental.customer_address}</span>
        </div>
        ` : ''}
      </div>
    </div>

    <!-- Rental Items -->
    <table class="table-container">
      <thead>
        <tr>
          <th style="width: 30%">Item Description</th>
          <th style="width: 8%" class="text-center">Qty</th>
          <th style="width: 12%" class="text-right">Daily Rate</th>
          <th style="width: 10%" class="text-center">Days</th>
          <th style="width: 15%" class="text-right">Total</th>
          <th style="width: 10%" class="text-center">Condition</th>
          <th style="width: 15%" class="text-center">Notes</th>
        </tr>
      </thead>
      <tbody>
        ${rental.items?.map((item) => `
          <tr>
            <td>
              <div class="item-description">${item.name}</div>
              <div class="item-details">
                ${item.sku ? `SKU: ${item.sku}` : ''}
                ${item.description ? `• ${item.description}` : ''}
              </div>
            </td>
            <td class="text-center">${item.quantity}</td>
            <td class="text-right">${formatCurrency(item.daily_rate)}</td>
            <td class="text-center">${item.rental_days}</td>
            <td class="text-right">${formatCurrency(item.total_amount)}</td>
            <td class="text-center">
              ${item.condition ? `<span class="condition-badge">${item.condition}</span>` : '—'}
            </td>
            <td class="text-center">${item.notes || '—'}</td>
          </tr>
        `).join('') || '<tr><td colspan="7" class="text-center">No items found</td></tr>'}
      </tbody>
    </table>

    <!-- Financial Summary -->
    <div class="financial-summary">
      <div class="summary-row">
        <span>Subtotal:</span>
        <span>${formatCurrency(rental.total_amount - (rental.tax_amount || 0))}</span>
      </div>
      <div class="summary-row">
        <span>Tax Amount:</span>
        <span>${formatCurrency(rental.tax_amount || 0)}</span>
      </div>
      <div class="summary-row">
        <span>Discount:</span>
        <span>-${formatCurrency(rental.discount_amount || 0)}</span>
      </div>
      <div class="summary-row total">
        <span>Total Rental Amount:</span>
        <span>${formatCurrency(rental.total_amount)}</span>
      </div>
    </div>

    <!-- Security Deposit Information -->
    ${rental.security_deposit ? `
    <div class="security-deposit">
      <h4>Security Deposit</h4>
      <div class="info-row">
        <span class="info-label">Amount:</span>
        <span class="info-value">${formatCurrency(rental.security_deposit)}</span>
      </div>
      <p style="font-size: 10px; margin-top: 10px;">
        Security deposit will be refunded upon return of items in original condition.
      </p>
    </div>
    ` : ''}

    <!-- Terms and Conditions -->
    <div class="terms-section">
      <h4>Terms and Conditions</h4>
      <ul>
        <li>All rental items must be returned by the agreed return date to avoid additional charges.</li>
        <li>Customer is responsible for the care and security of rented items.</li>
        <li>Any damage or loss of items will be charged to the customer.</li>
        <li>Late return charges may apply as per company policy.</li>
        <li>Security deposit is refundable upon return of items in original condition.</li>
        <li>Customer must provide valid identification and contact information.</li>
        <li>All payments are non-refundable except for security deposit.</li>
        <li>Company reserves the right to collect items if payment is overdue.</li>
      </ul>
      ${rental.terms_conditions ? `
      <div style="margin-top: 15px;">
        <h5 style="color: #374151; margin-bottom: 5px;">Additional Terms:</h5>
        <p style="font-size: 10px;">${rental.terms_conditions}</p>
      </div>
      ` : ''}
    </div>

    ${rental.notes ? `
    <div class="terms-section">
      <h4>Additional Notes</h4>
      <p style="font-size: 11px;">${rental.notes}</p>
    </div>
    ` : ''}

    <!-- Signatures -->
    <div class="signatures">
      <div class="signature-box">
        <div style="height: 50px;"></div>
        <div class="signature-line">
          <div>Customer Signature</div>
          <div style="margin-top: 5px; font-size: 10px;">${rental.customer_name}</div>
        </div>
      </div>
      <div class="signature-box">
        <div style="height: 50px;"></div>
        <div class="signature-line">
          <div>Authorized Signature</div>
          <div style="margin-top: 5px; font-size: 10px;">${actualCompanyInfo.company_name}</div>
        </div>
      </div>
    </div>
  `;

  const { documentHTML } = BasePrintDocument({
    title: getTitle(),
    documentType: getTitle(),
    documentId: rental.rental_number,
    children: documentContent,
    companyInfo: actualCompanyInfo,
    printOptions: {
      customStyles,
    },
  });

  return { documentContent: documentHTML };
}

// Backward compatibility export
export default RentalPrintDocument;