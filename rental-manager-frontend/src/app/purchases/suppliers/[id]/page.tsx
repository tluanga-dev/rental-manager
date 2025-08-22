'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft,
  Edit,
  Building2,
  MapPin,
  Phone,
  Mail,
  Package,
  Clock,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { suppliersApi, SupplierResponse, SupplierPerformanceHistory } from '@/services/api/suppliers';

function SupplierDetailContent() {
  const params = useParams();
  const router = useRouter();
  const supplierId = params.id as string;
  
  const [supplier, setSupplier] = useState<SupplierResponse | null>(null);
  const [performanceHistory, setPerformanceHistory] = useState<SupplierPerformanceHistory | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSupplierData = async () => {
      try {
        setLoading(true);
        
        // Load supplier data first - this is the critical call
        const supplierData = await suppliersApi.getById(supplierId);
        setSupplier(supplierData);
        
        // Load optional analytics data with individual error handling
        try {
          const performanceData = await suppliersApi.getPerformanceHistory(supplierId);
          setPerformanceHistory(performanceData);
        } catch (perfError) {
          console.warn('Performance history not available:', perfError);
          setPerformanceHistory(null);
        }
        
        try {
          const purchaseData = await suppliersApi.getPurchaseHistory(supplierId, 0, 10);
          setPurchaseHistory(purchaseData);
        } catch (purchaseError) {
          console.warn('Purchase history not available:', purchaseError);
          setPurchaseHistory(null);
        }
        
      } catch (error) {
        console.error('Failed to load supplier data:', error);
        setSupplier(null); // Only set to null if main supplier call fails
      } finally {
        setLoading(false);
      }
    };

    if (supplierId) {
      loadSupplierData();
    }
  }, [supplierId]);

  const formatCurrency = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(numAmount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  const getSupplierTypeColor = (type: string) => {
    const colors = {
      'MANUFACTURER': 'bg-slate-100 text-slate-800',
      'DISTRIBUTOR': 'bg-green-100 text-green-800',
      'WHOLESALER': 'bg-yellow-100 text-yellow-800',
      'RETAILER': 'bg-purple-100 text-purple-800',
      'SERVICE_PROVIDER': 'bg-indigo-100 text-indigo-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getSupplierTierColor = (tier: string) => {
    const colors = {
      'PREFERRED': 'bg-green-100 text-green-800',
      'STANDARD': 'bg-slate-100 text-slate-800',
      'RESTRICTED': 'bg-red-100 text-red-800'
    };
    return colors[tier as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving':
        return 'text-green-600';
      case 'declining':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Supplier not found</h3>
          <p className="mt-1 text-sm text-gray-500">The supplier you're looking for doesn't exist.</p>
          <div className="mt-6">
            <Button onClick={() => router.push('/purchases/suppliers')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Suppliers
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {supplier.company_name}
              </h1>
              {!supplier.is_active && (
                <Badge variant="destructive">Inactive</Badge>
              )}
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              {supplier.supplier_code}
            </p>
          </div>
        </div>
        <Button onClick={() => router.push(`/purchases/suppliers/${supplier.id}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Supplier
        </Button>
      </div>

      {/* Supplier Information */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Supplier Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Badge className={getSupplierTypeColor(supplier.supplier_type)}>
                {supplier.supplier_type.replace('_', ' ')}
              </Badge>
              <Badge className={getSupplierTierColor(supplier.supplier_tier)}>
                {supplier.supplier_tier}
              </Badge>
            </div>

            {supplier.contact_person && (
              <div className="flex items-center space-x-2">
                <Building2 className="h-4 w-4 text-gray-500" />
                <span className="text-sm">{supplier.contact_person}</span>
              </div>
            )}

            {supplier.email && (
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-gray-500" />
                <span className="text-sm">{supplier.email}</span>
              </div>
            )}

            {supplier.phone && (
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-gray-500" />
                <span className="text-sm">{supplier.phone}</span>
              </div>
            )}

            {supplier.address && (
              <div className="flex items-start space-x-2">
                <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
                <span className="text-sm">{supplier.address}</span>
              </div>
            )}

            {supplier.tax_id && (
              <div className="text-sm">
                <span className="text-gray-600">Tax ID:</span> {supplier.tax_id}
              </div>
            )}

            <div className="text-sm">
              <span className="text-gray-600">Payment Terms:</span> {supplier.payment_terms}
            </div>

            <div className="text-sm">
              <span className="text-gray-600">Credit Limit:</span> {formatCurrency(supplier.credit_limit)}
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-2xl font-bold text-slate-600">{supplier.total_orders}</div>
                <div className="text-sm text-gray-600">Total Orders</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(supplier.total_spend)}
                </div>
                <div className="text-sm text-gray-600">Total Spend</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-center space-x-1">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span className="text-2xl font-bold text-yellow-600">
                    {parseFloat(supplier.quality_rating?.toString() || '0').toFixed(1)}
                  </span>
                </div>
                <div className="text-sm text-gray-600">Quality Rating</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {parseFloat(supplier.performance_score?.toString() || '0').toFixed(0)}%
                </div>
                <div className="text-sm text-gray-600">Performance</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-2xl font-bold text-indigo-600">
                  {supplier.average_delivery_days}
                </div>
                <div className="text-sm text-gray-600">Avg Delivery (days)</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-sm font-medium text-gray-600">Last Order</div>
                <div className="text-sm text-gray-900 dark:text-gray-100">
                  {formatDate(supplier.last_order_date)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance History and Trends */}
      {performanceHistory && performanceHistory.trends && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Performance Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">Delivery Performance</span>
                </div>
                <div className={`flex items-center space-x-1 ${getTrendColor(performanceHistory.trends.delivery_trend)}`}>
                  {getTrendIcon(performanceHistory.trends.delivery_trend)}
                  <span className="text-sm capitalize">
                    {performanceHistory.trends.delivery_trend}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-2">
                  <Star className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">Quality Trend</span>
                </div>
                <div className={`flex items-center space-x-1 ${getTrendColor(performanceHistory.trends.quality_trend)}`}>
                  {getTrendIcon(performanceHistory.trends.quality_trend)}
                  <span className="text-sm capitalize">
                    {performanceHistory.trends.quality_trend}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-2">
                  <Package className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">Spending Trend</span>
                </div>
                <div className={`flex items-center space-x-1 ${getTrendColor(performanceHistory.trends.spend_trend)}`}>
                  {getTrendIcon(performanceHistory.trends.spend_trend)}
                  <span className="text-sm capitalize">
                    {performanceHistory.trends.spend_trend}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle>Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              {performanceHistory.recommendations.length > 0 ? (
                <div className="space-y-3">
                  {performanceHistory.recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start space-x-2 p-3 bg-slate-50 dark:bg-slate-900/20 rounded-lg">
                      <CheckCircle2 className="h-4 w-4 text-slate-600 mt-0.5" />
                      <span className="text-sm text-slate-800 dark:text-slate-200">
                        {recommendation}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-green-500 mb-2" />
                  <p className="text-sm text-gray-600">No specific recommendations</p>
                  <p className="text-xs text-gray-500">This supplier is performing well</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Purchase Transaction History */}
      {purchaseHistory && purchaseHistory.transactions && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <Package className="h-5 w-5 mr-2" />
                Purchase History
              </span>
              <Badge variant="outline">
                {purchaseHistory.summary.total_transactions} transactions
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {purchaseHistory.transactions.length > 0 ? (
              <div className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(purchaseHistory.summary.total_spend)}
                    </div>
                    <div className="text-sm text-gray-600">Total Spend</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-600">
                      {formatCurrency(purchaseHistory.summary.average_order_value)}
                    </div>
                    <div className="text-sm text-gray-600">Avg Order Value</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {purchaseHistory.summary.total_transactions}
                    </div>
                    <div className="text-sm text-gray-600">Total Orders</div>
                  </div>
                </div>

                {/* Transaction List */}
                <div className="space-y-3">
                  {purchaseHistory.transactions.map((transaction: any) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                      onClick={() => router.push(`/purchases/history/${transaction.id}`)}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-600">
                          <Package className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {transaction.transaction_number}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {new Date(transaction.transaction_date).toLocaleDateString()} • {transaction.status}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 dark:text-gray-100">
                          {formatCurrency(transaction.total_amount)}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {transaction.payment_status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Show More Button */}
                {purchaseHistory.pagination.has_next && (
                  <div className="text-center pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        // TODO: Implement pagination
                        console.log('Load more transactions');
                      }}
                    >
                      Load More Transactions
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-sm font-medium text-gray-900">No purchase transactions</h3>
                <p className="text-sm text-gray-500">No purchases have been made from this supplier yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Timeline/History */}
      <Card>
        <CardHeader>
          <CardTitle>Supplier History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-3 border-l-4 border-slate-500 bg-slate-50 dark:bg-slate-900/20">
              <div className="flex-shrink-0">
                <CheckCircle2 className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Supplier Created</p>
                <p className="text-xs text-gray-600">
                  Created on {formatDate(supplier.created_at)}
                  {supplier.created_by && ` by ${supplier.created_by}`}
                </p>
              </div>
            </div>

            {supplier.updated_at !== supplier.created_at && (
              <div className="flex items-center space-x-3 p-3 border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
                <div className="flex-shrink-0">
                  <Edit className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Last Updated</p>
                  <p className="text-xs text-gray-600">
                    Updated on {formatDate(supplier.updated_at)}
                    {supplier.updated_by && ` by ${supplier.updated_by}`}
                  </p>
                </div>
              </div>
            )}

            {supplier.last_order_date && (
              <div className="flex items-center space-x-3 p-3 border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20">
                <div className="flex-shrink-0">
                  <Package className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Last Order</p>
                  <p className="text-xs text-gray-600">
                    Order placed on {formatDate(supplier.last_order_date)}
                  </p>
                </div>
              </div>
            )}

            {!supplier.is_active && (
              <div className="flex items-center space-x-3 p-3 border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20">
                <div className="flex-shrink-0">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Supplier Inactive</p>
                  <p className="text-xs text-gray-600">
                    This supplier has been deactivated
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SupplierDetailPage() {
  return (
    <ProtectedRoute requiredPermissions={['INVENTORY_VIEW']}>
      <SupplierDetailContent />
    </ProtectedRoute>
  );
}