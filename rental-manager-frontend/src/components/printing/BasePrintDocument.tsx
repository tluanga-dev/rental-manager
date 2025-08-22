import React from 'react';
import { format } from 'date-fns';
import { useCompanyProfileWithDefaults, formatCurrencyWithProfile } from '@/hooks/use-company-profile';
import type { CompanyInfo } from '@/types/system';

export interface BasePrintDocumentProps {
  title: string;
  documentType: string;
  documentId?: string;
  children: React.ReactNode;
  companyInfo?: CompanyInfo;
  printOptions?: {
    includeHeader?: boolean;
    includeFooter?: boolean;
    customStyles?: string;
  };
}

/**
 * Base component for all print documents
 * Provides consistent layout, styling, and company information integration
 */
export function BasePrintDocument({
  title,
  documentType,
  documentId,
  children,
  companyInfo,
  printOptions = {}
}: BasePrintDocumentProps) {
  const companyProfileDefaults = useCompanyProfileWithDefaults();
  const actualCompanyInfo = companyInfo || companyProfileDefaults;
  
  const { includeHeader = true, includeFooter = true, customStyles = '' } = printOptions;

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
      
      .company-logo {
        width: 80px;
        height: 80px;
        object-fit: contain;
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
      
      .font-bold {
        font-weight: bold;
      }
      
      .text-sm {
        font-size: 11px;
      }
      
      .text-xs {
        font-size: 10px;
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
      
      .no-print {
        display: none !important;
      }
      
      @media print {
        .no-print {
          display: none !important;
        }
        
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        
        .print-document {
          max-width: none;
          margin: 0;
        }
      }
      
      ${customStyles}
    </style>
  `;

  const getDocumentHTML = () => {
    const headerHTML = includeHeader ? `
      <header class="document-header">
        <div class="company-info">
          <div class="company-details">
            <h1>${actualCompanyInfo.company_name}</h1>
            <p>${actualCompanyInfo.company_address?.replace(/\n/g, '<br>') || ''}</p>
            <p>Phone: ${actualCompanyInfo.company_phone || 'N/A'}</p>
            <p>Email: ${actualCompanyInfo.company_email || 'N/A'}</p>
            ${actualCompanyInfo.company_gst_no ? `<p>GST: ${actualCompanyInfo.company_gst_no}</p>` : ''}
            ${actualCompanyInfo.company_registration_number ? `<p>Reg: ${actualCompanyInfo.company_registration_number}</p>` : ''}
          </div>
        </div>
        <div class="document-title">
          <h2>${title}</h2>
          ${documentId ? `<p class="document-subtitle">Document ID: ${documentId}</p>` : ''}
        </div>
      </header>
    ` : '';

    const footerHTML = includeFooter ? `
      <footer class="document-footer">
        <div class="footer-content">
          <div class="footer-left">
            <p>Generated by ${actualCompanyInfo.company_name} Rental Management System</p>
            <p>Document Type: ${documentType}</p>
            ${documentId ? `<p>Document ID: ${documentId}</p>` : ''}
          </div>
          <div class="footer-right">
            <p>Generated on: ${format(new Date(), 'MMMM dd, yyyy')}</p>
            <p>Time: ${format(new Date(), 'HH:mm:ss')}</p>
          </div>
        </div>
      </footer>
    ` : '';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        ${baseStyles}
      </head>
      <body>
        <div class="print-document">
          ${headerHTML}
          <div class="document-content">
            ${children}
          </div>
          ${footerHTML}
        </div>
      </body>
      </html>
    `;
  };

  return {
    documentHTML: getDocumentHTML(),
    companyInfo: actualCompanyInfo,
    formatCurrency: (amount: number) => formatCurrencyWithProfile(amount, actualCompanyInfo),
  };
}

/**
 * Utility component for creating print-ready tables
 */
export function PrintTable({ 
  headers, 
  children, 
  className = '' 
}: { 
  headers: string[]; 
  children: React.ReactNode; 
  className?: string; 
}) {
  return (
    <table className={`table-container ${className}`}>
      <thead>
        <tr>
          {headers.map((header, index) => (
            <th key={index}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {children}
      </tbody>
    </table>
  );
}

/**
 * Utility component for creating print-ready info grids
 */
export function PrintInfoGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="info-grid">
      {children}
    </div>
  );
}

/**
 * Utility component for creating print-ready info sections
 */
export function PrintInfoSection({ 
  title, 
  children 
}: { 
  title: string; 
  children: React.ReactNode; 
}) {
  return (
    <div className="info-section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

/**
 * Utility component for creating print-ready info rows
 */
export function PrintInfoRow({ 
  label, 
  value 
}: { 
  label: string; 
  value: React.ReactNode; 
}) {
  return (
    <div className="info-row">
      <span className="info-label">{label}:</span>
      <span className="info-value">{value}</span>
    </div>
  );
}