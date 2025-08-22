import React from 'react';
import { format } from 'date-fns';
import { 
  BasePrintDocument, 
  PrintTable, 
  PrintInfoGrid, 
  PrintInfoSection, 
  PrintInfoRow 
} from '@/components/printing/BasePrintDocument';
import { useCompanyProfileWithDefaults, formatCurrencyWithProfile } from '@/hooks/use-company-profile';
import type { PurchaseResponse } from '@/services/api/purchases';
import type { CompanyInfo } from '@/types/system';

interface PurchasePrintDocumentProps {
  purchase: PurchaseResponse;
  companyInfo?: CompanyInfo;
}

export function PurchasePrintDocument({ 
  purchase, 
  companyInfo 
}: PurchasePrintDocumentProps) {
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
    .financial-summary {
      margin-left: auto;
      width: 300px;
      margin-top: 20px;
    }
    
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .summary-row.total {
      font-weight: bold;
      font-size: 16px;
      border-top: 2px solid #2563eb;
      border-bottom: 3px double #2563eb;
      background: #f8fafc;
      padding: 12px 0;
    }
    
    .terms {
      margin-bottom: 30px;
    }
    
    .terms h4 {
      font-size: 12px;
      font-weight: bold;
      margin: 0 0 10px 0;
      color: #374151;
    }
    
    .terms p {
      font-size: 10px;
      color: #6b7280;
      margin: 5px 0;
    }
    
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 50px;
      margin-top: 40px;
    }
    
    .signature-line {
      border-top: 1px solid #374151;
      padding-top: 5px;
      text-align: center;
      font-size: 10px;
      color: #6b7280;
    }
    
    .condition-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 9px;
      font-weight: bold;
      background: #f3f4f6;
      color: #374151;
    }
    
    .item-description {
      font-weight: 500;
    }
    
    .item-details {
      font-size: 10px;
      color: #6b7280;
      margin-top: 2px;
    }
  `;

  const documentContent = `
    <!-- Purchase Information -->
    <div class="info-grid">
      <div class="info-section">
        <h3>Purchase Information</h3>
        <div class="info-row">
          <span class="info-label">Invoice #:</span>
          <span class="info-value">${purchase.reference_number || purchase.id.slice(0, 8)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Date:</span>
          <span class="info-value">${format(new Date(purchase.purchase_date), 'MMMM dd, yyyy')}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Status:</span>
          <span class="info-value">
            <span class="status-badge ${getStatusClass(purchase.status)}">${purchase.status}</span>
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">Payment:</span>
          <span class="info-value">
            <span class="status-badge ${getStatusClass(purchase.payment_status)}">${purchase.payment_status}</span>
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">Location:</span>
          <span class="info-value">${purchase.location?.name || 'N/A'}</span>
        </div>
      </div>

      <div class="info-section">
        <h3>Supplier Information</h3>
        <div class="info-row">
          <span class="info-label">Supplier:</span>
          <span class="info-value">${purchase.supplier?.display_name || purchase.supplier?.company_name || 'Unknown Supplier'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Supplier ID:</span>
          <span class="info-value">${purchase.supplier?.id || 'N/A'}</span>
        </div>
        ${purchase.supplier?.supplier_code ? `
        <div class="info-row">
          <span class="info-label">Code:</span>
          <span class="info-value">${purchase.supplier.supplier_code}</span>
        </div>
        ` : ''}
      </div>
    </div>

    <!-- Items Table -->
    <table class="table-container">
      <thead>
        <tr>
          <th style="width: 40%">Item Description</th>
          <th style="width: 10%" class="text-center">Qty</th>
          <th style="width: 15%" class="text-right">Unit Price</th>
          <th style="width: 10%" class="text-center">Condition</th>
          <th style="width: 15%" class="text-right">Line Total</th>
          <th style="width: 10%" class="text-center">Notes</th>
        </tr>
      </thead>
      <tbody>
        ${purchase.items?.map((item, index) => `
          <tr>
            <td>
              <div class="item-description">${item.description || item.sku?.display_name || 'Unknown Item'}</div>
              <div class="item-details">
                ${item.sku?.sku_code ? `SKU: ${item.sku.sku_code}` : ''}
                ${item.item_id ? `• ID: ${item.item_id.slice(0, 8)}...` : ''}
              </div>
            </td>
            <td class="text-center">${item.quantity}</td>
            <td class="text-right">${formatCurrency(item.unit_cost || item.unit_price || 0)}</td>
            <td class="text-center">
              ${item.condition ? `<span class="condition-badge">${item.condition}</span>` : '—'}
            </td>
            <td class="text-right">${formatCurrency(item.total_cost || item.line_total || 0)}</td>
            <td class="text-center">${item.notes || '—'}</td>
          </tr>
        `).join('') || '<tr><td colspan="6" class="text-center">No items found</td></tr>'}
      </tbody>
    </table>

    <!-- Financial Summary -->
    <div class="financial-summary">
      <div class="summary-row">
        <span>Subtotal:</span>
        <span>${formatCurrency(purchase.subtotal || 0)}</span>
      </div>
      <div class="summary-row">
        <span>Tax Amount:</span>
        <span>${formatCurrency(purchase.tax_amount || 0)}</span>
      </div>
      <div class="summary-row">
        <span>Discount:</span>
        <span>-${formatCurrency(purchase.discount_amount || 0)}</span>
      </div>
      <div class="summary-row total">
        <span>Total Amount:</span>
        <span>${formatCurrency(purchase.total_amount || 0)}</span>
      </div>
    </div>

    <!-- Terms and Conditions -->
    <div class="terms">
      <h4>Terms and Conditions</h4>
      <p>• Payment is due within 30 days of invoice date.</p>
      <p>• All items are subject to availability and final approval.</p>
      <p>• Returns must be authorized and in original condition.</p>
      <p>• This document serves as an official purchase record.</p>
    </div>

    ${purchase.notes ? `
    <div class="terms">
      <h4>Additional Notes</h4>
      <p>${purchase.notes}</p>
    </div>
    ` : ''}

    <!-- Signatures -->
    <div class="signatures">
      <div>
        <div style="height: 40px;"></div>
        <div class="signature-line">Authorized Signature</div>
      </div>
      <div>
        <div style="height: 40px;"></div>
        <div class="signature-line">Date: ${format(new Date(), 'MM/dd/yyyy')}</div>
      </div>
    </div>
  `;

  const { documentHTML } = BasePrintDocument({
    title: 'Purchase Invoice',
    documentType: 'Purchase Invoice',
    documentId: purchase.reference_number || purchase.id,
    children: documentContent,
    companyInfo: actualCompanyInfo,
    printOptions: {
      customStyles,
    },
  });

  return { documentContent: documentHTML };
}

/**
 * Generate purchase print document without hooks (for use outside React context)
 */
export function generatePurchasePrintDocument(
  purchase: PurchaseResponse,
  companyInfo: CompanyInfo
): { documentContent: string } {
  const formatCurrency = (amount: number) => {
    return formatCurrencyWithProfile(amount, companyInfo);
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
    .financial-summary {
      margin-left: auto;
      width: 300px;
      margin-top: 20px;
    }
    
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .summary-row.total {
      font-weight: bold;
      font-size: 16px;
      border-top: 2px solid #2563eb;
      border-bottom: 3px double #2563eb;
      background: #f8fafc;
      padding: 12px 0;
    }
    
    .terms {
      margin-bottom: 30px;
    }
    
    .terms h4 {
      font-size: 12px;
      font-weight: bold;
      margin: 0 0 10px 0;
      color: #374151;
    }
    
    .terms p {
      font-size: 10px;
      color: #6b7280;
      margin: 5px 0;
    }
    
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 50px;
      margin-top: 40px;
    }
    
    .signature-line {
      border-top: 1px solid #374151;
      padding-top: 5px;
      text-align: center;
      font-size: 10px;
      color: #6b7280;
    }
    
    .condition-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 9px;
      font-weight: bold;
      background: #f3f4f6;
      color: #374151;
    }
    
    .item-description {
      font-weight: 500;
    }
    
    .item-details {
      font-size: 10px;
      color: #6b7280;
      margin-top: 2px;
    }
  `;

  const documentContent = `
    <!-- Purchase Information -->
    <div class="info-grid">
      <div class="info-section">
        <h3>Purchase Information</h3>
        <div class="info-row">
          <span class="info-label">Invoice #:</span>
          <span class="info-value">${purchase.reference_number || purchase.id.slice(0, 8)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Date:</span>
          <span class="info-value">${format(new Date(purchase.purchase_date), 'MMMM dd, yyyy')}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Status:</span>
          <span class="info-value">
            <span class="status-badge ${getStatusClass(purchase.status)}">${purchase.status}</span>
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">Payment:</span>
          <span class="info-value">
            <span class="status-badge ${getStatusClass(purchase.payment_status)}">${purchase.payment_status}</span>
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">Location:</span>
          <span class="info-value">${purchase.location?.name || 'N/A'}</span>
        </div>
      </div>

      <div class="info-section">
        <h3>Supplier Information</h3>
        <div class="info-row">
          <span class="info-label">Supplier:</span>
          <span class="info-value">${purchase.supplier?.display_name || purchase.supplier?.company_name || 'Unknown Supplier'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Supplier ID:</span>
          <span class="info-value">${purchase.supplier?.id || 'N/A'}</span>
        </div>
        ${purchase.supplier?.supplier_code ? `
        <div class="info-row">
          <span class="info-label">Code:</span>
          <span class="info-value">${purchase.supplier.supplier_code}</span>
        </div>
        ` : ''}
      </div>
    </div>

    <!-- Items Table -->
    <table class="table-container">
      <thead>
        <tr>
          <th style="width: 40%">Item Description</th>
          <th style="width: 10%" class="text-center">Qty</th>
          <th style="width: 15%" class="text-right">Unit Price</th>
          <th style="width: 10%" class="text-center">Condition</th>
          <th style="width: 15%" class="text-right">Line Total</th>
          <th style="width: 10%" class="text-center">Notes</th>
        </tr>
      </thead>
      <tbody>
        ${purchase.items?.map((item, index) => `
          <tr>
            <td>
              <div class="item-description">${item.description || item.sku?.display_name || 'Unknown Item'}</div>
              <div class="item-details">
                ${item.sku?.sku_code ? `SKU: ${item.sku.sku_code}` : ''}
                ${item.item_id ? `• ID: ${item.item_id.slice(0, 8)}...` : ''}
              </div>
            </td>
            <td class="text-center">${item.quantity}</td>
            <td class="text-right">${formatCurrency(item.unit_cost || item.unit_price || 0)}</td>
            <td class="text-center">
              ${item.condition ? `<span class="condition-badge">${item.condition}</span>` : '—'}
            </td>
            <td class="text-right">${formatCurrency(item.total_cost || item.line_total || 0)}</td>
            <td class="text-center">${item.notes || '—'}</td>
          </tr>
        `).join('') || '<tr><td colspan="6" class="text-center">No items found</td></tr>'}
      </tbody>
    </table>

    <!-- Financial Summary -->
    <div class="financial-summary">
      <div class="summary-row">
        <span>Subtotal:</span>
        <span>${formatCurrency(purchase.subtotal || 0)}</span>
      </div>
      <div class="summary-row">
        <span>Tax Amount:</span>
        <span>${formatCurrency(purchase.tax_amount || 0)}</span>
      </div>
      <div class="summary-row">
        <span>Discount:</span>
        <span>-${formatCurrency(purchase.discount_amount || 0)}</span>
      </div>
      <div class="summary-row total">
        <span>Total Amount:</span>
        <span>${formatCurrency(purchase.total_amount || 0)}</span>
      </div>
    </div>

    <!-- Terms and Conditions -->
    <div class="terms">
      <h4>Terms and Conditions</h4>
      <p>• Payment is due within 30 days of invoice date.</p>
      <p>• All items are subject to availability and final approval.</p>
      <p>• Returns must be authorized and in original condition.</p>
      <p>• This document serves as an official purchase record.</p>
    </div>

    ${purchase.notes ? `
    <div class="terms">
      <h4>Additional Notes</h4>
      <p>${purchase.notes}</p>
    </div>
    ` : ''}

    <!-- Signatures -->
    <div class="signatures">
      <div>
        <div style="height: 40px;"></div>
        <div class="signature-line">Authorized Signature</div>
      </div>
      <div>
        <div style="height: 40px;"></div>
        <div class="signature-line">Date: ${format(new Date(), 'MM/dd/yyyy')}</div>
      </div>
    </div>
  `;

  const baseStyles = `
    <style>
      @page {
        margin: 0.5in;
        size: A4;
      }
      
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: 'Arial', 'Helvetica', sans-serif;
        font-size: 12px;
        line-height: 1.4;
        color: #333;
        background: white;
      }
      
      .print-document {
        width: 100%;
        max-width: 100%;
        margin: 0 auto;
        background: white;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }
      
      .document-header {
        border-bottom: 3px solid #2563eb;
        padding-bottom: 20px;
        margin-bottom: 30px;
        flex-shrink: 0;
      }
      
      .company-info {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 20px;
      }
      
      .company-details h1 {
        font-size: 24px;
        font-weight: bold;
        color: #2563eb;
        margin: 0 0 8px 0;
      }
      
      .company-details p {
        margin: 2px 0;
        color: #666;
        font-size: 11px;
      }
      
      .document-title {
        text-align: center;
        margin: 20px 0;
      }
      
      .document-title h2 {
        font-size: 28px;
        font-weight: bold;
        color: #1f2937;
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 2px;
      }
      
      .document-subtitle {
        font-size: 14px;
        color: #6b7280;
        margin-top: 5px;
      }
      
      .document-content {
        flex: 1;
        margin-bottom: 30px;
      }
      
      .document-footer {
        margin-top: auto;
        padding-top: 20px;
        border-top: 1px solid #e5e7eb;
        font-size: 10px;
        color: #6b7280;
        flex-shrink: 0;
      }
      
      .footer-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .footer-left p {
        margin: 2px 0;
      }
      
      .footer-right {
        text-align: right;
      }
      
      .footer-right p {
        margin: 2px 0;
      }
      
      .info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 40px;
        margin-bottom: 30px;
      }
      
      .info-section h3 {
        font-size: 14px;
        font-weight: bold;
        color: #2563eb;
        margin: 0 0 10px 0;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      
      .info-row {
        display: flex;
        margin-bottom: 5px;
      }
      
      .info-label {
        font-weight: bold;
        width: 120px;
        color: #4b5563;
      }
      
      .info-value {
        flex: 1;
      }
      
      .table-container {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
      }
      
      .table-container th {
        background: #f8fafc;
        border: 1px solid #e5e7eb;
        padding: 12px 8px;
        text-align: left;
        font-weight: bold;
        color: #374151;
        text-transform: uppercase;
        font-size: 11px;
        letter-spacing: 0.5px;
      }
      
      .table-container td {
        border: 1px solid #e5e7eb;
        padding: 10px 8px;
        vertical-align: top;
      }
      
      .table-container tr:nth-child(even) {
        background: #f9fafb;
      }
      
      .text-right {
        text-align: right;
      }
      
      .text-center {
        text-align: center;
      }
      
      .status-badge {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: bold;
        text-transform: uppercase;
      }
      
      .status-completed {
        background: #dcfce7;
        color: #166534;
      }
      
      .status-pending {
        background: #fef3c7;
        color: #92400e;
      }
      
      .status-cancelled {
        background: #fee2e2;
        color: #991b1b;
      }
      
      ${customStyles}
    </style>
  `;

  const headerHTML = `
    <header class="document-header">
      <div class="company-info">
        <div class="company-details">
          <h1>${companyInfo.company_name}</h1>
          <p>${companyInfo.company_address?.replace(/\n/g, '<br>') || ''}</p>
          <p>Phone: ${companyInfo.company_phone || 'N/A'}</p>
          <p>Email: ${companyInfo.company_email || 'N/A'}</p>
          ${companyInfo.company_gst_no ? `<p>GST: ${companyInfo.company_gst_no}</p>` : ''}
          ${companyInfo.company_registration_number ? `<p>Reg: ${companyInfo.company_registration_number}</p>` : ''}
        </div>
      </div>
      <div class="document-title">
        <h2>Purchase Invoice</h2>
        <p class="document-subtitle">Document ID: ${purchase.reference_number || purchase.id}</p>
      </div>
    </header>
  `;

  const footerHTML = `
    <footer class="document-footer">
      <div class="footer-content">
        <div class="footer-left">
          <p>Generated by ${companyInfo.company_name} Rental Management System</p>
          <p>Document Type: Purchase Invoice</p>
          <p>Document ID: ${purchase.reference_number || purchase.id}</p>
        </div>
        <div class="footer-right">
          <p>Generated on: ${format(new Date(), 'MMMM dd, yyyy')}</p>
          <p>Time: ${format(new Date(), 'HH:mm:ss')}</p>
        </div>
      </div>
    </footer>
  `;

  const completeDocument = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Purchase Invoice</title>
      ${baseStyles}
    </head>
    <body>
      <div class="print-document">
        ${headerHTML}
        <div class="document-content">
          ${documentContent}
        </div>
        ${footerHTML}
      </div>
    </body>
    </html>
  `;

  return { documentContent: completeDocument };
}

// Backward compatibility export
export default PurchasePrintDocument;