'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { 
  FileText, 
  Search, 
  Download, 
  Printer,
  Eye,
  Mail,
  Filter,
  Calendar,
  Users,
  IndianRupee,
  Receipt,
  Send
} from 'lucide-react';
import { format } from 'date-fns';

// Mock data for receipts and invoices - replace with actual API call
const mockReceipts = [
  {
    id: '1',
    transaction_id: 'SALE-20240803-0001',
    transaction_number: 'SALE-20240803-0001',
    receipt_number: 'RCP-20240803-0001',
    invoice_number: 'INV-20240803-0001',
    customer_name: 'Tech Solutions Ltd',
    customer_email: 'contact@techsolutions.com',
    transaction_date: '2024-08-03T10:30:00Z',
    amount: 15000.00,
    tax_amount: 2700.00,
    total_amount: 17700.00,
    payment_status: 'PAID',
    receipt_status: 'GENERATED',
    invoice_sent: true,
    items_count: 3,
    receipt_url: '/api/receipts/RCP-20240803-0001.pdf',
    invoice_url: '/api/invoices/INV-20240803-0001.pdf'
  },
  {
    id: '2',
    transaction_id: 'SALE-20240802-0003',
    transaction_number: 'SALE-20240802-0003',
    receipt_number: 'RCP-20240802-0003',
    invoice_number: 'INV-20240802-0003',
    customer_name: 'Digital Works Inc',
    customer_email: 'info@digitalworks.com',
    transaction_date: '2024-08-02T14:15:00Z',
    amount: 8500.00,
    tax_amount: 1530.00,
    total_amount: 10030.00,
    payment_status: 'PAID',
    receipt_status: 'GENERATED',
    invoice_sent: false,
    items_count: 2,
    receipt_url: '/api/receipts/RCP-20240802-0003.pdf',
    invoice_url: '/api/invoices/INV-20240802-0003.pdf'
  },
  {
    id: '3',
    transaction_id: 'SALE-20240801-0005',
    transaction_number: 'SALE-20240801-0005',
    receipt_number: 'RCP-20240801-0005',
    invoice_number: 'INV-20240801-0005',
    customer_name: 'Innovation Corp',
    customer_email: 'orders@innovationcorp.com',
    transaction_date: '2024-08-01T16:45:00Z',
    amount: 12000.00,
    tax_amount: 2160.00,
    total_amount: 14160.00,
    payment_status: 'PARTIAL',
    receipt_status: 'PENDING',
    invoice_sent: true,
    items_count: 4,
    receipt_url: null,
    invoice_url: '/api/invoices/INV-20240801-0005.pdf'
  }
];

function SalesReceiptsContent() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('ALL');

  const getPaymentStatusBadge = (status: string) => {
    const statusColors = {
      PAID: 'bg-green-100 text-green-800',
      PARTIAL: 'bg-yellow-100 text-yellow-800',
      PENDING: 'bg-orange-100 text-orange-800',
      FAILED: 'bg-red-100 text-red-800'
    };
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  };

  const getReceiptStatusBadge = (status: string) => {
    const statusColors = {
      GENERATED: 'bg-blue-100 text-blue-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      FAILED: 'bg-red-100 text-red-800'
    };
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const filteredReceipts = mockReceipts.filter(receipt => {
    const matchesSearch = searchTerm === '' || 
      receipt.receipt_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      receipt.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      receipt.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      receipt.transaction_number.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = selectedStatus === 'ALL' || receipt.receipt_status === selectedStatus;
    const matchesPaymentStatus = selectedPaymentStatus === 'ALL' || receipt.payment_status === selectedPaymentStatus;
    
    return matchesSearch && matchesStatus && matchesPaymentStatus;
  });

  const totalReceipts = mockReceipts.length;
  const generatedReceipts = mockReceipts.filter(r => r.receipt_status === 'GENERATED').length;
  const pendingReceipts = mockReceipts.filter(r => r.receipt_status === 'PENDING').length;
  const totalAmount = mockReceipts.reduce((sum, receipt) => sum + receipt.total_amount, 0);

  const handleDownloadReceipt = (receiptUrl: string | null, receiptNumber: string) => {
    if (receiptUrl) {
      // In a real app, this would trigger a download
      console.log(`Downloading receipt: ${receiptNumber}`);
    } else {
      console.log(`Receipt not available: ${receiptNumber}`);
    }
  };

  const handleSendInvoice = (email: string, invoiceNumber: string) => {
    // In a real app, this would trigger email sending
    console.log(`Sending invoice ${invoiceNumber} to ${email}`);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Receipts & Invoices
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage sales receipts, invoices, and customer documentation
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Bulk Download
          </Button>
          <Button variant="outline" size="sm">
            <Mail className="mr-2 h-4 w-4" />
            Bulk Email
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Receipts</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReceipts}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Generated</CardTitle>
            <Receipt className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{generatedReceipts}</div>
            <p className="text-xs text-muted-foreground">Ready receipts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Calendar className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingReceipts}</div>
            <p className="text-xs text-muted-foreground">Awaiting generation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <IndianRupee className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
            <p className="text-xs text-muted-foreground">Receipt value</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter Receipts & Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by receipt, invoice, customer, or transaction..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Receipt Status</option>
              <option value="GENERATED">Generated</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
            </select>
            <select
              value={selectedPaymentStatus}
              onChange={(e) => setSelectedPaymentStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Payment Status</option>
              <option value="PAID">Paid</option>
              <option value="PARTIAL">Partial</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Receipts Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Receipts & Invoices ({filteredReceipts.length})</CardTitle>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Export List
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredReceipts.length > 0 ? (
              filteredReceipts.map((receipt) => (
                <div 
                  key={receipt.id} 
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  {/* Receipt Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{receipt.receipt_number}</h3>
                        <Badge className={getReceiptStatusBadge(receipt.receipt_status)}>
                          {receipt.receipt_status}
                        </Badge>
                        <Badge className={getPaymentStatusBadge(receipt.payment_status)}>
                          {receipt.payment_status}
                        </Badge>
                        {receipt.invoice_sent && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            Invoice Sent
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          Transaction: {receipt.transaction_number}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {receipt.customer_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(receipt.transaction_date), 'MMM dd, yyyy')}
                        </span>
                        <span>
                          Invoice: {receipt.invoice_number}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => router.push(`/sales/${receipt.transaction_id}`)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Sale
                      </Button>
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-sm text-gray-700 mb-1">Subtotal</div>
                      <div className="text-lg font-bold text-gray-900">
                        {formatCurrency(receipt.amount)}
                      </div>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="text-sm text-blue-700 mb-1">Tax Amount</div>
                      <div className="text-lg font-bold text-blue-900">
                        {formatCurrency(receipt.tax_amount)}
                      </div>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <div className="text-sm text-green-700 mb-1">Total Amount</div>
                      <div className="text-lg font-bold text-green-900">
                        {formatCurrency(receipt.total_amount)}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-3 border-t">
                    <div className="text-sm text-gray-500">
                      {receipt.items_count} item{receipt.items_count !== 1 ? 's' : ''} • 
                      Customer: {receipt.customer_email}
                    </div>
                    <div className="flex gap-2">
                      {receipt.receipt_url && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDownloadReceipt(receipt.receipt_url, receipt.receipt_number)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Receipt
                        </Button>
                      )}
                      {receipt.invoice_url && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDownloadReceipt(receipt.invoice_url, receipt.invoice_number)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Invoice
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleSendInvoice(receipt.customer_email, receipt.invoice_number)}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Email
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                      >
                        <Printer className="mr-2 h-4 w-4" />
                        Print
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="font-medium">No receipts found</p>
                <p className="text-sm mt-1">
                  {searchTerm || selectedStatus !== 'ALL' || selectedPaymentStatus !== 'ALL'
                    ? 'Try adjusting your filters' 
                    : 'No receipts or invoices available'
                  }
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SalesReceiptsPage() {
  return (
    <ProtectedRoute requiredPermissions={['SALE_VIEW']}>
      <SalesReceiptsContent />
    </ProtectedRoute>
  );
}