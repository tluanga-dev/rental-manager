'use client';

import { useState, useEffect, useCallback } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Plus, 
  Search,
  Building2,
  MapPin,
  Phone,
  Mail,
  Package,
  TrendingUp,
  Star,
  AlertCircle
} from 'lucide-react';
import { suppliersApi, SupplierResponse } from '@/services/api/suppliers';

interface SupplierFilters {
  search: string;
  supplier_type: string;
  supplier_tier: string;
  is_active: boolean | null;
}

function SuppliersContent() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<SupplierFilters>({
    search: '',
    supplier_type: '',
    supplier_tier: '',
    is_active: null
  });

  const loadSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      
      if (filters.search) params.search = filters.search;
      if (filters.supplier_type) params.supplier_type = filters.supplier_type;
      if (filters.supplier_tier) params.supplier_tier = filters.supplier_tier;
      if (filters.is_active !== null) params.is_active = filters.is_active;
      
      console.log('Loading suppliers with params:', params);
      const response = await suppliersApi.list(params);
      console.log('Suppliers loaded:', response);
      setSuppliers(response.items);
    } catch (error) {
      console.error('Failed to load suppliers:', error);
      setSuppliers([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadSuppliers();
  }, [filters, loadSuppliers]); // Add filters dependency to reload when filters change

  const handleSearch = (searchTerm: string) => {
    setFilters(prev => ({ ...prev, search: searchTerm }));
  };

  const handleFilter = () => {
    // Trigger reload by updating a timestamp to force useEffect
    loadSuppliers();
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const activeSuppliers = suppliers.filter(s => s.is_active).length;
  const totalSpend = suppliers.reduce((sum, s) => sum + s.total_spend, 0);
  const avgQualityRating = suppliers.length > 0 
    ? suppliers.reduce((sum, s) => sum + s.quality_rating, 0) / suppliers.length 
    : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Supplier Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage supplier relationships and performance
          </p>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline"
            onClick={() => router.push('/purchases/suppliers/analytics')}
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            Analytics
          </Button>
          <Button onClick={() => router.push('/purchases/suppliers/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Add Supplier
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Suppliers</CardTitle>
            <Users className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suppliers.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeSuppliers} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
            <Package className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalSpend)}</div>
            <p className="text-xs text-muted-foreground">
              All time spend
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Quality Rating</CardTitle>
            <Star className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgQualityRating.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">
              Out of 5.0
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {suppliers.length > 0 
                ? (suppliers.reduce((sum, s) => sum + s.performance_score, 0) / suppliers.length).toFixed(1)
                : '0'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Average score
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Suppliers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search suppliers..."
                value={filters.search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={filters.supplier_type}
              onChange={(e) => setFilters(prev => ({ ...prev, supplier_type: e.target.value }))}
            >
              <option value="">All Types</option>
              <option value="MANUFACTURER">Manufacturer</option>
              <option value="DISTRIBUTOR">Distributor</option>
              <option value="WHOLESALER">Wholesaler</option>
              <option value="RETAILER">Retailer</option>
              <option value="SERVICE_PROVIDER">Service Provider</option>
            </select>

            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={filters.supplier_tier}
              onChange={(e) => setFilters(prev => ({ ...prev, supplier_tier: e.target.value }))}
            >
              <option value="">All Tiers</option>
              <option value="PREFERRED">Preferred</option>
              <option value="STANDARD">Standard</option>
              <option value="RESTRICTED">Restricted</option>
            </select>

            <Button onClick={handleFilter}>
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Suppliers List */}
      <Card>
        <CardHeader>
          <CardTitle>Suppliers ({suppliers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No suppliers found</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by adding a new supplier.</p>
              <div className="mt-6">
                <Button onClick={() => router.push('/purchases/suppliers/new')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Supplier
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {suppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => router.push(`/purchases/suppliers/${supplier.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-start space-x-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                              {supplier.company_name}
                            </h3>
                            {!supplier.is_active && (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {supplier.supplier_code}
                          </p>
                          
                          <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                            {supplier.contact_person && (
                              <div className="flex items-center">
                                <Users className="h-4 w-4 mr-1" />
                                {supplier.contact_person}
                              </div>
                            )}
                            {supplier.email && (
                              <div className="flex items-center">
                                <Mail className="h-4 w-4 mr-1" />
                                {supplier.email}
                              </div>
                            )}
                            {supplier.phone && (
                              <div className="flex items-center">
                                <Phone className="h-4 w-4 mr-1" />
                                {supplier.phone}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-2 mt-2">
                            <Badge className={getSupplierTypeColor(supplier.supplier_type)}>
                              {supplier.supplier_type.replace('_', ' ')}
                            </Badge>
                            <Badge className={getSupplierTierColor(supplier.supplier_tier)}>
                              {supplier.supplier_tier}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="text-right space-y-1">
                          <div className="text-sm">
                            <span className="text-gray-600">Total Spend:</span>
                            <div className="font-medium">{formatCurrency(supplier.total_spend)}</div>
                          </div>
                          <div className="text-sm">
                            <span className="text-gray-600">Orders:</span>
                            <div className="font-medium">{supplier.total_orders}</div>
                          </div>
                          <div className="text-sm">
                            <span className="text-gray-600">Quality:</span>
                            <div className="flex items-center">
                              <Star className="h-3 w-3 text-yellow-500 mr-1" />
                              <span className="font-medium">{Number(supplier.quality_rating || 0).toFixed(1)}</span>
                            </div>
                          </div>
                          <div className="text-sm">
                            <span className="text-gray-600">Performance:</span>
                            <div className="font-medium text-slate-600">
                              {Number(supplier.performance_score || 0).toFixed(0)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SuppliersPage() {
  return (
    <ProtectedRoute requiredPermissions={['INVENTORY_VIEW']}>
      <SuppliersContent />
    </ProtectedRoute>
  );
}