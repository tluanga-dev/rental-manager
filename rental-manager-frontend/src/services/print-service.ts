import { systemApi } from '@/services/api/system';
import type { CompanyInfo } from '@/types/system';

export interface PrintOptions {
  orientation?: 'portrait' | 'landscape';
  paperSize?: 'A4' | 'Letter' | 'Legal';
  margins?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
  includeHeader?: boolean;
  includeFooter?: boolean;
  customStyles?: string;
}

export interface PrintableDocument {
  title: string;
  content: string;
  companyInfo: CompanyInfo;
  documentType: string;
  documentId?: string;
  generatedAt: Date;
}

/**
 * Centralized service for all print operations in the application
 * Automatically injects company profile information and provides consistent styling
 */
export class PrintService {
  private static instance: PrintService;
  private companyInfoCache: CompanyInfo | null = null;
  private cacheExpiry: number = 0;

  private constructor() {}

  static getInstance(): PrintService {
    if (!PrintService.instance) {
      PrintService.instance = new PrintService();
    }
    return PrintService.instance;
  }

  /**
   * Get company information with caching
   */
  private async getCompanyInfo(): Promise<CompanyInfo> {
    const now = Date.now();
    
    // Return cached data if still valid (5 minutes)
    if (this.companyInfoCache && now < this.cacheExpiry) {
      return this.companyInfoCache;
    }

    try {
      this.companyInfoCache = await systemApi.getCompanyInfo();
      this.cacheExpiry = now + (5 * 60 * 1000); // 5 minutes
      return this.companyInfoCache;
    } catch (error) {
      console.error('Failed to fetch company info for printing:', error);
      // Return default company info if API fails
      return {
        company_name: 'Your Company Name',
        company_address: '123 Business Street\nCity, State 12345',
        company_email: 'info@yourcompany.com',
        company_phone: '(555) 123-4567',
        company_gst_no: '',
        company_registration_number: '',
      };
    }
  }

  /**
   * Generate base styles for all print documents
   */
  private getBaseStyles(options: PrintOptions = {}): string {
    const margins = options.margins || {};
    
    return `
      <style>
        @page {
          size: ${options.paperSize || 'A4'};
          margin: ${margins.top || '0.5in'} ${margins.right || '0.5in'} ${margins.bottom || '0.5in'} ${margins.left || '0.5in'};
          orientation: ${options.orientation || 'portrait'};
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
        
        .print-container {
          width: 100%;
          max-width: 100%;
          margin: 0 auto;
          background: white;
        }
        
        .company-header {
          border-bottom: 3px solid #2563eb;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        
        .company-info {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        
        .company-details h1 {
          font-size: 24px;
          font-weight: bold;
          color: #2563eb;
          margin: 0 0 5px 0;
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
        
        .document-footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 10px;
          color: #6b7280;
        }
        
        .print-date {
          text-align: right;
          margin-top: 10px;
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
          
          .print-container {
            max-width: none;
            margin: 0;
          }
        }
        
        ${options.customStyles || ''}
      </style>
    `;
  }

  /**
   * Generate company header HTML
   */
  private generateCompanyHeader(companyInfo: CompanyInfo, includeHeader: boolean = true): string {
    if (!includeHeader) return '';
    
    return `
      <header class="company-header">
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
      </header>
    `;
  }

  /**
   * Generate document footer HTML
   */
  private generateDocumentFooter(document: PrintableDocument, includeFooter: boolean = true): string {
    if (!includeFooter) return '';
    
    return `
      <footer class="document-footer">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <p>Generated by ${document.companyInfo.company_name} Rental Management System</p>
            <p>Document Type: ${document.documentType}</p>
            ${document.documentId ? `<p>Document ID: ${document.documentId}</p>` : ''}
          </div>
          <div class="print-date">
            <p>Generated on: ${document.generatedAt.toLocaleDateString()}</p>
            <p>Time: ${document.generatedAt.toLocaleTimeString()}</p>
          </div>
        </div>
      </footer>
    `;
  }

  /**
   * Generate complete print document HTML
   */
  private generatePrintDocument(document: PrintableDocument, options: PrintOptions = {}): string {
    const styles = this.getBaseStyles(options);
    const header = this.generateCompanyHeader(document.companyInfo, options.includeHeader !== false);
    const footer = this.generateDocumentFooter(document, options.includeFooter !== false);
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${document.title}</title>
        ${styles}
      </head>
      <body>
        <div class="print-container">
          ${header}
          ${document.content}
          ${footer}
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Open print window with document
   */
  private openPrintWindow(htmlContent: string): void {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (!printWindow) {
      console.error('Failed to open print window. Please allow popups.');
      return;
    }

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Wait for content to load before printing
    printWindow.onload = () => {
      printWindow.focus();
      
      // Small delay to ensure styles are applied
      setTimeout(() => {
        printWindow.print();
        
        // Close window after printing (optional)
        printWindow.onafterprint = () => {
          printWindow.close();
        };
      }, 100);
    };
  }

  /**
   * Main method to print any document
   */
  public async printDocument(
    documentType: string,
    title: string,
    content: string,
    options: PrintOptions = {},
    documentId?: string
  ): Promise<void> {
    try {
      const companyInfo = await this.getCompanyInfo();
      
      const document: PrintableDocument = {
        title,
        content,
        companyInfo,
        documentType,
        documentId,
        generatedAt: new Date(),
      };

      const htmlContent = this.generatePrintDocument(document, options);
      this.openPrintWindow(htmlContent);
      
    } catch (error) {
      console.error('Failed to print document:', error);
      throw new Error('Failed to print document. Please try again.');
    }
  }

  /**
   * Print purchase document
   */
  public async printPurchase(
    purchaseId: string, 
    purchaseData: any, 
    companyInfo?: any, 
    options: PrintOptions = {}
  ): Promise<void> {
    try {
      // Import and use the purchase print document function
      const { generatePurchasePrintDocument } = await import('@/components/purchases/PurchasePrintDocument');
      
      const actualCompanyInfo = companyInfo || await this.getCompanyInfo();
      const { documentContent } = generatePurchasePrintDocument(purchaseData, actualCompanyInfo);
      
      // Open the document directly since it's already a complete HTML document
      this.openPrintWindow(documentContent);
    } catch (error) {
      console.error('Failed to generate purchase document:', error);
      throw new Error('Failed to generate purchase document. Please try again.');
    }
  }

  /**
   * Print sale document
   */
  public async printSale(saleId: string, content: string, options: PrintOptions = {}): Promise<void> {
    await this.printDocument('Sale Receipt', `Sale Receipt - ${saleId}`, content, options, saleId);
  }

  /**
   * Print rental document
   */
  public async printRental(rentalId: string, content: string, options: PrintOptions = {}): Promise<void> {
    await this.printDocument('Rental Agreement', `Rental Agreement - ${rentalId}`, content, options, rentalId);
  }

  /**
   * Print generic receipt
   */
  public async printReceipt(receiptId: string, content: string, options: PrintOptions = {}): Promise<void> {
    await this.printDocument('Receipt', `Receipt - ${receiptId}`, content, options, receiptId);
  }

  /**
   * Clear company info cache (useful when company info is updated)
   */
  public clearCache(): void {
    this.companyInfoCache = null;
    this.cacheExpiry = 0;
  }
}

// Export singleton instance
export const printService = PrintService.getInstance();