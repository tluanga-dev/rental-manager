'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { 
  RotateCcw, 
  Search, 
  Filter, 
  Plus, 
  FileText, 
  Calendar,
  IndianRupee,
  Users,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';

// Mock data for sales returns - replace with actual API call
const mockReturns = [
  {
    id: '1',
    return_number: 'RET-20240803-0001',
    original_sale_id: 'SALE-20240801-0001',
    original_sale_number: 'SALE-20240801-0001',
    customer_name: 'John Doe',
    return_date: '2024-08-03T10:30:00Z',
    return_amount: 2500.00,
    refund_amount: 2500.00,
    status: 'COMPLETED',
    return_reason: 'CUSTOMER_RETURN',
    items_count: 2,
    notes: 'Customer requested return within 7 days'
  },
  {
    id: '2',
    return_number: 'RET-20240803-0002',
    original_sale_id: 'SALE-20240802-0003',
    original_sale_number: 'SALE-20240802-0003',
    customer_name: 'Jane Smith',
    return_date: '2024-08-03T14:15:00Z',
    return_amount: 1200.00,
    refund_amount: 1080.00,
    status: 'PROCESSING',
    return_reason: 'DEFECTIVE',
    items_count: 1,
    notes: 'Defective item - partial refund due to restocking fee'
  }
];

function SalesReturnsContent() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  const getStatusBadge = (status: string) => {
    const statusColors = {
      COMPLETED: 'bg-green-100 text-green-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      CANCELLED: 'bg-red-100 text-red-800'
    };
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  };

  const getReasonBadge = (reason: string) => {
    const reasonColors = {
      CUSTOMER_RETURN: 'bg-purple-100 text-purple-800',
      DEFECTIVE: 'bg-red-100 text-red-800',
      WRONG_ITEM: 'bg-orange-100 text-orange-800',
      QUALITY_ISSUE: 'bg-yellow-100 text-yellow-800',
      OTHER: 'bg-gray-100 text-gray-800'
    };
    return reasonColors[reason as keyof typeof reasonColors] || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const filteredReturns = mockReturns.filter(returnItem => {
    const matchesSearch = searchTerm === '' || 
      returnItem.return_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      returnItem.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      returnItem.original_sale_number.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = selectedStatus === 'ALL' || returnItem.status === selectedStatus;
    
    return matchesSearch && matchesStatus;
  });

  const totalReturns = mockReturns.length;
  const totalRefundAmount = mockReturns.reduce((sum, ret) => sum + ret.refund_amount, 0);
  const pendingReturns = mockReturns.filter(ret => ret.status === 'PROCESSING').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Sales Returns
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage sales returns and refund processing
          </p>
        </div>
        <Button onClick={() => router.push('/sales/returns/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Process Return
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Returns</CardTitle>
            <RotateCcw className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReturns}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Refund Amount</CardTitle>
            <IndianRupee className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRefundAmount)}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Returns</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingReturns}</div>
            <p className="text-xs text-muted-foreground">Awaiting processing</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter Returns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by return number, customer, or original sale..."
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
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="PROCESSING">Processing</option>
              <option value="PENDING">Pending</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Returns Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Returns History ({filteredReturns.length})</CardTitle>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredReturns.length > 0 ? (
              filteredReturns.map((returnItem) => (
                <div 
                  key={returnItem.id} 
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/sales/returns/${returnItem.id}`)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="font-medium">{returnItem.return_number}</div>
                      <Badge className={getStatusBadge(returnItem.status)}>
                        {returnItem.status}
                      </Badge>
                      <Badge variant="outline" className={getReasonBadge(returnItem.return_reason)}>
                        {returnItem.return_reason.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Original: {returnItem.original_sale_number}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {returnItem.customer_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(returnItem.return_date), 'MMM dd, yyyy')}
                      </span>
                      <span>
                        {returnItem.items_count} item{returnItem.items_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {returnItem.notes && (
                      <div className="text-sm text-gray-500 mt-1 italic">
                        {returnItem.notes}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg text-red-600">
                      -{formatCurrency(returnItem.refund_amount)}
                    </div>
                    {returnItem.return_amount !== returnItem.refund_amount && (
                      <div className="text-sm text-gray-500">
                        of {formatCurrency(returnItem.return_amount)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <RotateCcw className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="font-medium">No returns found</p>
                <p className="text-sm mt-1">
                  {searchTerm || selectedStatus !== 'ALL' 
                    ? 'Try adjusting your filters' 
                    : 'No sales returns have been processed yet'
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

export default function SalesReturnsPage() {
  return (
    <ProtectedRoute requiredPermissions={['SALE_VIEW']}>
      <SalesReturnsContent />
    </ProtectedRoute>
  );
}