'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft,
  Edit,
  Users,
  Building,
  CreditCard,
  AlertTriangle,
  UserCheck,
  UserX,
  Mail,
  Phone,
  MapPin,
  Calendar,
  ShoppingCart,
  Package,
  Clock,
  TrendingUp,
  FileText,
  Eye,
  Ban,
  CheckCircle
} from 'lucide-react';
import { customersApi, type CustomerResponse, type CustomerTransactionHistory } from '@/services/api/customers';
import { useAppStore } from '@/stores/app-store';

function CustomerDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { addNotification } = useAppStore();
  
  const customerId = params.id as string;
  
  const [customer, setCustomer] = useState<CustomerResponse | null>(null);
  const [transactionHistory, setTransactionHistory] = useState<CustomerTransactionHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactionLoading, setTransactionLoading] = useState(true);

  useEffect(() => {
    if (customerId) {
      loadCustomer();
      loadTransactionHistory();
    }
  }, [customerId]);

  const loadCustomer = async () => {
    setLoading(true);
    try {
      const data = await customersApi.getById(customerId);
      setCustomer(data);
    } catch (error) {
      console.error('Error loading customer:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to load customer details'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTransactionHistory = async () => {
    setTransactionLoading(true);
    try {
      const data = await customersApi.getTransactionHistory(customerId);
      // Ensure we have a valid structure even if the API returns unexpected data
      setTransactionHistory({
        customer: data.customer,
        transactions: data.transactions || [],
        summary: {
          total_transactions: data.summary?.total_transactions || 0,
          total_spent: data.summary?.total_spent || 0,
          average_transaction: data.summary?.average_transaction || 0,
          last_transaction_date: data.summary?.last_transaction_date || null,
          favorite_items: data.summary?.favorite_items || []
        }
      });
    } catch (error) {
      console.error('Error loading transaction history:', error);
      // Set empty transaction history on error
      setTransactionHistory({
        customer: customer!,
        transactions: [],
        summary: {
          total_transactions: 0,
          total_spent: 0,
          average_transaction: 0,
          last_transaction_date: null,
          favorite_items: []
        }
      });
    } finally {
      setTransactionLoading(false);
    }
  };

  const handleBlacklistToggle = async () => {
    if (!customer) return;
    
    const action = customer.blacklist_status === 'BLACKLISTED' ? 'unblacklist' : 'blacklist';
    
    try {
      await customersApi.manageBlacklist(customerId, action);
      addNotification({
        type: 'success',
        title: 'Success',
        message: `Customer ${action === 'blacklist' ? 'blacklisted' : 'removed from blacklist'} successfully`
      });
      loadCustomer();
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to ${action} customer`
      });
    }
  };

  const getCustomerDisplayName = (customer: CustomerResponse) => {
    if (customer.customer_type === 'BUSINESS') {
      return customer.business_name || 'Business Customer';
    }
    return `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Individual Customer';
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'PLATINUM': return 'bg-purple-100 text-purple-800';
      case 'GOLD': return 'bg-yellow-100 text-yellow-800';
      case 'SILVER': return 'bg-gray-100 text-gray-800';
      default: return 'bg-orange-100 text-orange-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/customers')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
        </div>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading customer details...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/customers')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-600">Customer not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/customers')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {getCustomerDisplayName(customer)}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <span>{customer.customer_code}</span>
              <Badge variant="outline">
                {customer.customer_type === 'BUSINESS' ? (
                  <><Building className="h-3 w-3 mr-1" /> Business</>
                ) : (
                  <><Users className="h-3 w-3 mr-1" /> Individual</>
                )}
              </Badge>
              <Badge className={getTierBadgeColor(customer.customer_tier)}>
                {customer.customer_tier}
              </Badge>
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant={customer.blacklist_status === 'BLACKLISTED' ? 'default' : 'destructive'}
            onClick={handleBlacklistToggle}
          >
            {customer.blacklist_status === 'BLACKLISTED' ? (
              <>
                <UserCheck className="mr-2 h-4 w-4" />
                Remove from Blacklist
              </>
            ) : (
              <>
                <UserX className="mr-2 h-4 w-4" />
                Add to Blacklist
              </>
            )}
          </Button>
          <Button onClick={() => router.push(`/customers/${customerId}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Customer
          </Button>
        </div>
      </div>

      {/* Status Alerts */}
      {customer.blacklist_status === 'BLACKLISTED' && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">This customer is blacklisted</span>
            </div>
          </CardContent>
        </Card>
      )}

      {!customer.is_active && (
        <Card className="border-gray-200 bg-gray-50 dark:bg-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Ban className="h-5 w-5" />
              <span className="font-medium">This customer account is inactive</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer Info Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {customer.customer_type === 'BUSINESS' ? (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Business Name</label>
                    <p className="font-medium">{customer.business_name || 'Not provided'}</p>
                  </div>
                  {customer.tax_id && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Tax ID</label>
                      <p className="font-medium">{customer.tax_id}</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-500">First Name</label>
                    <p className="font-medium">{customer.first_name || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Last Name</label>
                    <p className="font-medium">{customer.last_name || 'Not provided'}</p>
                  </div>
                </>
              )}
              
              <div>
                <label className="text-sm font-medium text-gray-500">Customer Code</label>
                <p className="font-medium">{customer.customer_code}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="flex gap-2">
                  <Badge variant={customer.is_active ? 'default' : 'secondary'}>
                    {customer.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  {customer.blacklist_status === 'BLACKLISTED' && (
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Blacklisted
                    </Badge>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Member Since</label>
                <p className="font-medium">{formatDate(customer.created_at)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CreditCard className="h-5 w-5 mr-2" />
              Financial Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Customer Tier</label>
                <Badge className={getTierBadgeColor(customer.customer_tier)}>
                  {customer.customer_tier}
                </Badge>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Credit Limit</label>
                <p className="font-medium text-lg">{formatCurrency(customer.credit_limit)}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Lifetime Value</label>
                <p className="font-medium text-lg text-green-600">{formatCurrency(customer.lifetime_value)}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Last Transaction</label>
                <p className="font-medium">{formatDate(customer.last_transaction_date)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactionLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">Loading transaction history...</p>
            </div>
          ) : transactionHistory && transactionHistory.transactions && transactionHistory.transactions.length > 0 ? (
            <div className="space-y-6">
              {/* Transaction Summary */}
              <div className="grid gap-4 md:grid-cols-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-600">{transactionHistory.summary?.total_transactions || 0}</div>
                  <p className="text-sm text-gray-600">Total Transactions</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(transactionHistory.summary?.total_spent || 0)}</div>
                  <p className="text-sm text-gray-600">Total Spent</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{formatCurrency(transactionHistory.summary?.average_transaction || 0)}</div>
                  <p className="text-sm text-gray-600">Average Transaction</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{transactionHistory.summary?.favorite_items?.length || 0}</div>
                  <p className="text-sm text-gray-600">Favorite Items</p>
                </div>
              </div>

              <hr className="my-4" />

              {/* Transaction List */}
              <div className="space-y-3">
                {transactionHistory.transactions?.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0">
                        {transaction.transaction_type === 'SALE' ? (
                          <ShoppingCart className="h-8 w-8 text-green-600 bg-green-100 dark:bg-green-900 p-2 rounded-full" />
                        ) : (
                          <Package className="h-8 w-8 text-slate-600 bg-slate-100 dark:bg-slate-900 p-2 rounded-full" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">
                          {transaction.transaction_type === 'SALE' ? 'Sale' : 'Rental'} Transaction
                        </p>
                        <p className="text-sm text-gray-600">
                          {formatDateTime(transaction.transaction_date)} • {transaction.items_count} items
                        </p>
                        {transaction.location_name && (
                          <p className="text-xs text-gray-500">📍 {transaction.location_name}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{formatCurrency(transaction.total_amount)}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant={transaction.payment_status === 'PAID' ? 'default' : 'secondary'}>
                          {transaction.payment_status}
                        </Badge>
                        <Badge variant="outline">
                          {transaction.transaction_status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-gray-600">No transaction history available</p>
              <p className="text-sm text-gray-500 mt-1">
                Transaction history will appear here once the customer makes their first purchase or rental
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CustomerDetailPage() {
  return (
    <ProtectedRoute requiredPermissions={['CUSTOMER_VIEW']}>
      <CustomerDetailContent />
    </ProtectedRoute>
  );
}