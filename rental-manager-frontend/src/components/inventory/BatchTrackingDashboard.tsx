"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  Calendar,
  Search,
  Filter,
  Download,
  BarChart3,
  Clock,
  DollarSign,
  Box,
  ChevronRight,
  Info,
  FileText,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { ItemDropdown } from '@/components/items/ItemDropdown';
import { LocationDropdown } from '@/components/locations/LocationDropdown';
import { format, differenceInDays, addDays } from 'date-fns';

// Types
interface BatchSummary {
  batch_code: string;
  item_id: string;
  item_name: string;
  location_id: string;
  location_name: string;
  total_units: number;
  total_quantity: number;
  available_quantity: number;
  purchase_price: number;
  sale_price?: number;
  rental_rate?: number;
  warranty_expiry?: string;
  created_at: string;
}

interface BatchReport {
  batch_code: string;
  summary: BatchSummary;
  units: any[];
  financial_summary: {
    total_purchase_value: number;
    total_sale_value?: number;
    potential_profit?: number;
    average_purchase_price: number;
    rental_value_per_period?: number;
  };
  status_breakdown: Record<string, number>;
}

interface WarrantyExpiryItem {
  unit_id: string;
  sku: string;
  item_name: string;
  batch_code?: string;
  serial_number?: string;
  warranty_expiry: string;
  days_remaining: number;
  location_name: string;
  purchase_date?: string;
  purchase_price: number;
}

interface PricingComparison {
  item_id: string;
  item_name: string;
  batches: Array<{
    batch_code: string;
    location: string;
    unit_count: number;
    total_quantity: number;
    purchase_price: {
      average: number;
      min: number;
      max: number;
    };
    sale_price?: number;
    rental_rate?: number;
    batch_date?: string;
    margin?: number;
    margin_percentage?: number;
  }>;
}

export const BatchTrackingDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [warrantyDays, setWarrantyDays] = useState(30);
  
  // Data states
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<BatchReport | null>(null);
  const [warrantyExpiring, setWarrantyExpiring] = useState<WarrantyExpiryItem[]>([]);
  const [pricingComparison, setPricingComparison] = useState<PricingComparison | null>(null);

  // Fetch batch data
  const fetchBatches = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('batch_code', searchTerm);
      if (selectedItem) params.append('item_id', selectedItem);
      if (selectedLocation) params.append('location_id', selectedLocation);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/inventory/batch/search?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch batches');
      const data = await response.json();
      // Ensure data is an array before setting
      setBatches(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching batches:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch batch data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch batch report
  const fetchBatchReport = async (batchCode: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/inventory/batch/report/${batchCode}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch batch report');
      const data = await response.json();
      setSelectedBatch(data);
    } catch (error) {
      console.error('Error fetching batch report:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch batch report',
        variant: 'destructive',
      });
    }
  };

  // Fetch warranty expiry data
  const fetchWarrantyExpiry = async () => {
    try {
      const params = new URLSearchParams();
      params.append('days_ahead', warrantyDays.toString());
      if (selectedLocation) params.append('location_id', selectedLocation);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/inventory/batch/warranty-expiry?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch warranty data');
      const data = await response.json();
      // Ensure data is an array before setting
      setWarrantyExpiring(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching warranty data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch warranty expiry data',
        variant: 'destructive',
      });
    }
  };

  // Fetch pricing comparison
  const fetchPricingComparison = async (itemId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/inventory/batch/pricing-comparison?item_id=${itemId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch pricing comparison');
      const data = await response.json();
      setPricingComparison(data);
    } catch (error) {
      console.error('Error fetching pricing comparison:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch pricing comparison',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [searchTerm, selectedItem, selectedLocation]);

  useEffect(() => {
    if (activeTab === 'warranty') {
      fetchWarrantyExpiry();
    }
  }, [activeTab, warrantyDays, selectedLocation]);

  useEffect(() => {
    if (activeTab === 'pricing' && selectedItem) {
      fetchPricingComparison(selectedItem);
    }
  }, [activeTab, selectedItem]);

  // Calculate statistics
  const statistics = useMemo(() => {
    // Ensure batches is an array before using reduce
    const batchArray = Array.isArray(batches) ? batches : [];
    const totalBatches = batchArray.length;
    const totalUnits = batchArray.reduce((sum, b) => sum + (b.total_units || 0), 0);
    const totalValue = batchArray.reduce((sum, b) => sum + ((b.purchase_price || 0) * (b.total_quantity || 0)), 0);
    const avgBatchSize = totalBatches > 0 ? totalUnits / totalBatches : 0;

    return {
      totalBatches,
      totalUnits,
      totalValue,
      avgBatchSize,
    };
  }, [batches]);

  // Export batch data
  const exportBatchData = () => {
    // Ensure batches is an array
    const batchArray = Array.isArray(batches) ? batches : [];
    
    const csvContent = [
      ['Batch Code', 'Item Name', 'Location', 'Units', 'Quantity', 'Available', 'Purchase Price', 'Sale Price', 'Created'],
      ...batchArray.map(b => [
        b.batch_code || '',
        b.item_name || '',
        b.location_name || '',
        b.total_units || 0,
        b.total_quantity || 0,
        b.available_quantity || 0,
        b.purchase_price || 0,
        b.sale_price || '',
        b.created_at ? format(new Date(b.created_at), 'yyyy-MM-dd') : '',
      ]),
    ]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-inventory-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Batch Tracking Dashboard</h1>
          <p className="text-gray-500 mt-1">Monitor and manage inventory batches</p>
        </div>
        <Button onClick={exportBatchData} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export Data
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search batch code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <ItemDropdown
              value={selectedItem}
              onChange={setSelectedItem}
              placeholder="Filter by item"
            />
            <LocationDropdown
              value={selectedLocation}
              onChange={setSelectedLocation}
              placeholder="Filter by location"
            />
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setSelectedItem(null);
                setSelectedLocation(null);
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Batches</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalBatches}</div>
            <p className="text-xs text-muted-foreground">Active batch codes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Units</CardTitle>
            <Box className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalUnits.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all batches</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${statistics.totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Purchase value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Batch Size</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.avgBatchSize.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Units per batch</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Batch Details</TabsTrigger>
          <TabsTrigger value="warranty">Warranty Tracking</TabsTrigger>
          <TabsTrigger value="pricing">Pricing Analysis</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Batch Inventory Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {!Array.isArray(batches) || batches.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No batches found</p>
                    </div>
                  ) : (
                    batches.map((batch) => (
                      <div
                        key={batch.batch_code}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => {
                          fetchBatchReport(batch.batch_code);
                          setActiveTab('details');
                        }}
                      >
                        <div className="flex items-center space-x-4">
                          <Package className="w-8 h-8 text-blue-500" />
                          <div>
                            <p className="font-semibold">{batch.batch_code}</p>
                            <p className="text-sm text-gray-500">
                              {batch.item_name} • {batch.location_name}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-6">
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Units</p>
                            <p className="font-semibold">{batch.total_units}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Available</p>
                            <p className="font-semibold">{batch.available_quantity}/{batch.total_quantity}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Price</p>
                            <p className="font-semibold">${batch.purchase_price}</p>
                          </div>
                          {batch.warranty_expiry && (
                            <Badge
                              variant={
                                differenceInDays(new Date(batch.warranty_expiry), new Date()) < 30
                                  ? 'destructive'
                                  : 'default'
                              }
                            >
                              <Clock className="w-3 h-3 mr-1" />
                              {format(new Date(batch.warranty_expiry), 'MMM dd')}
                            </Badge>
                          )}
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Batch Details Tab */}
        <TabsContent value="details" className="space-y-4">
          {selectedBatch ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Batch Report: {selectedBatch.batch_code}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Summary Section */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm text-gray-500">Item Details</p>
                      <p className="font-semibold">{selectedBatch.summary.item_name}</p>
                      <p className="text-sm">{selectedBatch.summary.location_name}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-500">Inventory Status</p>
                      <p className="font-semibold">{selectedBatch.summary.total_units} units</p>
                      <p className="text-sm">
                        {selectedBatch.summary.available_quantity} available of {selectedBatch.summary.total_quantity}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-500">Created</p>
                      <p className="font-semibold">
                        {format(new Date(selectedBatch.summary.created_at), 'MMM dd, yyyy')}
                      </p>
                      {selectedBatch.summary.warranty_expiry && (
                        <p className="text-sm">
                          Warranty: {format(new Date(selectedBatch.summary.warranty_expiry), 'MMM dd, yyyy')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-3">Financial Summary</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Total Purchase Value</p>
                        <p className="font-semibold text-lg">
                          ${selectedBatch.financial_summary.total_purchase_value.toLocaleString()}
                        </p>
                      </div>
                      {selectedBatch.financial_summary.total_sale_value && (
                        <div>
                          <p className="text-sm text-gray-500">Total Sale Value</p>
                          <p className="font-semibold text-lg">
                            ${selectedBatch.financial_summary.total_sale_value.toLocaleString()}
                          </p>
                        </div>
                      )}
                      {selectedBatch.financial_summary.potential_profit && (
                        <div>
                          <p className="text-sm text-gray-500">Potential Profit</p>
                          <p className="font-semibold text-lg text-green-600">
                            ${selectedBatch.financial_summary.potential_profit.toLocaleString()}
                          </p>
                        </div>
                      )}
                      {selectedBatch.financial_summary.rental_value_per_period && (
                        <div>
                          <p className="text-sm text-gray-500">Rental Value/Period</p>
                          <p className="font-semibold text-lg">
                            ${selectedBatch.financial_summary.rental_value_per_period.toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status Breakdown */}
                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-3">Status Breakdown</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {selectedBatch.status_breakdown && typeof selectedBatch.status_breakdown === 'object' && 
                       Object.entries(selectedBatch.status_breakdown).map(([status, quantity]) => (
                        <div key={status} className="flex justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm">{status}</span>
                          <span className="font-semibold">{quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Units List */}
              <Card>
                <CardHeader>
                  <CardTitle>Inventory Units</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">SKU</th>
                          <th className="text-left p-2">Serial Number</th>
                          <th className="text-left p-2">Status</th>
                          <th className="text-right p-2">Quantity</th>
                          <th className="text-right p-2">Purchase Price</th>
                          <th className="text-right p-2">Sale Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(selectedBatch.units) && selectedBatch.units.map((unit: any) => (
                          <tr key={unit.id} className="border-b hover:bg-gray-50">
                            <td className="p-2">{unit.sku}</td>
                            <td className="p-2">{unit.serial_number || '-'}</td>
                            <td className="p-2">
                              <Badge variant={unit.status === 'AVAILABLE' ? 'default' : 'secondary'}>
                                {unit.status}
                              </Badge>
                            </td>
                            <td className="text-right p-2">{unit.quantity}</td>
                            <td className="text-right p-2">${unit.purchase_price}</td>
                            <td className="text-right p-2">{unit.sale_price ? `$${unit.sale_price}` : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Info className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">Select a batch from the Overview tab to view details</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Warranty Tracking Tab */}
        <TabsContent value="warranty" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Warranty Expiry Tracking</CardTitle>
                <Select value={warrantyDays.toString()} onValueChange={(v) => setWarrantyDays(parseInt(v))}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Next 7 days</SelectItem>
                    <SelectItem value="30">Next 30 days</SelectItem>
                    <SelectItem value="60">Next 60 days</SelectItem>
                    <SelectItem value="90">Next 90 days</SelectItem>
                    <SelectItem value="180">Next 6 months</SelectItem>
                    <SelectItem value="365">Next year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {!Array.isArray(warrantyExpiring) || warrantyExpiring.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No warranties expiring in the selected period</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {warrantyExpiring.map((item) => (
                    <div
                      key={item.unit_id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center space-x-4">
                        {item.days_remaining <= 7 ? (
                          <AlertTriangle className="w-8 h-8 text-red-500" />
                        ) : item.days_remaining <= 30 ? (
                          <AlertTriangle className="w-8 h-8 text-yellow-500" />
                        ) : (
                          <Clock className="w-8 h-8 text-blue-500" />
                        )}
                        <div>
                          <p className="font-semibold">{item.item_name}</p>
                          <p className="text-sm text-gray-500">
                            SKU: {item.sku} {item.serial_number && `• S/N: ${item.serial_number}`}
                          </p>
                          <p className="text-sm text-gray-500">
                            Batch: {item.batch_code || 'N/A'} • {item.location_name}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant={
                            item.days_remaining <= 7
                              ? 'destructive'
                              : item.days_remaining <= 30
                              ? 'warning'
                              : 'default'
                          }
                        >
                          {item.days_remaining} days left
                        </Badge>
                        <p className="text-sm text-gray-500 mt-1">
                          Expires: {format(new Date(item.warranty_expiry), 'MMM dd, yyyy')}
                        </p>
                        {item.purchase_date && (
                          <p className="text-xs text-gray-400">
                            Purchased: {format(new Date(item.purchase_date), 'MMM dd, yyyy')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pricing Analysis Tab */}
        <TabsContent value="pricing" className="space-y-4">
          {pricingComparison ? (
            <Card>
              <CardHeader>
                <CardTitle>Pricing Comparison: {pricingComparison.item_name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.isArray(pricingComparison.batches) && pricingComparison.batches.map((batch) => (
                    <div key={batch.batch_code} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-semibold">{batch.batch_code}</p>
                          <p className="text-sm text-gray-500">{batch.location}</p>
                          {batch.batch_date && (
                            <p className="text-xs text-gray-400">
                              Created: {format(new Date(batch.batch_date), 'MMM dd, yyyy')}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">{batch.unit_count} units</p>
                          <p className="text-sm text-gray-500">Qty: {batch.total_quantity}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Purchase Price</p>
                          <p className="font-semibold">${batch.purchase_price.average.toFixed(2)}</p>
                          <p className="text-xs text-gray-400">
                            ${batch.purchase_price.min} - ${batch.purchase_price.max}
                          </p>
                        </div>
                        {batch.sale_price && (
                          <div>
                            <p className="text-xs text-gray-500">Sale Price</p>
                            <p className="font-semibold">${batch.sale_price.toFixed(2)}</p>
                          </div>
                        )}
                        {batch.margin !== undefined && (
                          <div>
                            <p className="text-xs text-gray-500">Margin</p>
                            <p className="font-semibold text-green-600">${batch.margin.toFixed(2)}</p>
                            {batch.margin_percentage !== undefined && (
                              <p className="text-xs text-gray-400">{batch.margin_percentage.toFixed(1)}%</p>
                            )}
                          </div>
                        )}
                        {batch.rental_rate && (
                          <div>
                            <p className="text-xs text-gray-500">Rental Rate</p>
                            <p className="font-semibold">${batch.rental_rate.toFixed(2)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : selectedItem ? (
            <Card>
              <CardContent className="text-center py-12">
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">Select an item to view pricing comparison</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BatchTrackingDashboard;