'use client';

import React, { useState, useMemo } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import {
  Search,
  Package,
  Hash,
  Calendar,
  DollarSign,
  TrendingUp,
  Download,
  Filter,
  Eye,
  Clock,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Zap
} from 'lucide-react';
import { formatCurrencySync } from '@/lib/currency-utils';
import { cn } from '@/lib/utils';

interface IndividualItemData {
  id: string;
  sku: string;
  serial_number?: string;
  batch_code?: string;
  item_name: string;
  category: string;
  purchase_price: number;
  purchase_date: string;
  current_status: 'AVAILABLE' | 'RENTED' | 'MAINTENANCE' | 'DAMAGED' | 'SOLD';
  condition: 'NEW' | 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  location: string;
  tracking_type: 'INDIVIDUAL' | 'BATCH';
  quantity: number;
  rental_count: number;
  total_rental_revenue: number;
  utilization_rate: number;
  days_since_purchase: number;
  warranty_status: 'ACTIVE' | 'EXPIRED' | 'NONE';
  maintenance_cost: number;
  depreciated_value: number;
}

interface IndividualItemTrackingReportProps {
  data?: IndividualItemData[];
  isLoading?: boolean;
}

const STATUS_COLORS = {
  AVAILABLE: '#22c55e',
  RENTED: '#3b82f6', 
  MAINTENANCE: '#f59e0b',
  DAMAGED: '#ef4444',
  SOLD: '#8b5cf6',
};

const CONDITION_COLORS = {
  NEW: '#22c55e',
  EXCELLENT: '#3b82f6',
  GOOD: '#f59e0b', 
  FAIR: '#f97316',
  POOR: '#ef4444',
};

// Mock data for demonstration
const generateMockData = (): IndividualItemData[] => {
  const items = [];
  const categories = ['Cameras', 'Lighting', 'Audio', 'Computers', 'Furniture'];
  const locations = ['Warehouse A', 'Warehouse B', 'Store Front', 'Service Center'];
  
  for (let i = 1; i <= 150; i++) {
    const purchaseDate = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000);
    const daysSincePurchase = Math.floor((Date.now() - purchaseDate.getTime()) / (24 * 60 * 60 * 1000));
    const purchasePrice = Math.floor(Math.random() * 2000) + 100;
    const rentalCount = Math.floor(Math.random() * 20);
    const totalRevenue = rentalCount * (purchasePrice * 0.1); // 10% of purchase price per rental
    
    items.push({
      id: `unit-${i}`,
      sku: `SKU-${String(i).padStart(4, '0')}`,
      serial_number: Math.random() > 0.3 ? `SN${String(i).padStart(6, '0')}` : undefined,
      batch_code: Math.random() > 0.7 ? `BATCH-${String(Math.floor(i/10)).padStart(3, '0')}` : undefined,
      item_name: `${categories[Math.floor(Math.random() * categories.length)]} Item ${i}`,
      category: categories[Math.floor(Math.random() * categories.length)],
      purchase_price: purchasePrice,
      purchase_date: purchaseDate.toISOString(),
      current_status: ['AVAILABLE', 'RENTED', 'MAINTENANCE', 'DAMAGED', 'SOLD'][Math.floor(Math.random() * 5)] as any,
      condition: ['NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR'][Math.floor(Math.random() * 5)] as any,
      location: locations[Math.floor(Math.random() * locations.length)],
      tracking_type: Math.random() > 0.3 ? 'INDIVIDUAL' : 'BATCH',
      quantity: Math.random() > 0.3 ? 1 : Math.floor(Math.random() * 10) + 1,
      rental_count: rentalCount,
      total_rental_revenue: totalRevenue,
      utilization_rate: Math.min(100, (rentalCount / Math.max(1, daysSincePurchase / 30)) * 100),
      days_since_purchase: daysSincePurchase,
      warranty_status: daysSincePurchase > 365 ? 'EXPIRED' : daysSincePurchase > 300 ? 'ACTIVE' : 'ACTIVE',
      maintenance_cost: Math.floor(Math.random() * 500),
      depreciated_value: Math.max(purchasePrice * 0.1, purchasePrice - (daysSincePurchase * purchasePrice * 0.001)),
    });
  }
  
  return items;
};

export function IndividualItemTrackingReport({ 
  data, 
  isLoading = false 
}: IndividualItemTrackingReportProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [trackingFilter, setTrackingFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('purchase_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const mockData = useMemo(() => generateMockData(), []);
  const items = data || mockData;

  // Filter and sort data
  const filteredAndSortedItems = useMemo(() => {
    let filtered = items.filter(item => {
      const matchesSearch = !searchTerm || 
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.serial_number && item.serial_number.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === 'all' || item.current_status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesTracking = trackingFilter === 'all' || item.tracking_type === trackingFilter;
      
      return matchesSearch && matchesStatus && matchesCategory && matchesTracking;
    });

    // Sort
    filtered.sort((a, b) => {
      let aVal = a[sortBy as keyof IndividualItemData];
      let bVal = b[sortBy as keyof IndividualItemData];
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    return filtered;
  }, [items, searchTerm, statusFilter, categoryFilter, trackingFilter, sortBy, sortOrder]);

  // Calculate analytics
  const analytics = useMemo(() => {
    const totalItems = filteredAndSortedItems.length;
    const totalValue = filteredAndSortedItems.reduce((sum, item) => sum + item.purchase_price * item.quantity, 0);
    const totalRevenue = filteredAndSortedItems.reduce((sum, item) => sum + item.total_rental_revenue, 0);
    const avgUtilization = filteredAndSortedItems.reduce((sum, item) => sum + item.utilization_rate, 0) / totalItems;
    const totalDepreciatedValue = filteredAndSortedItems.reduce((sum, item) => sum + item.depreciated_value, 0);
    
    // Status distribution
    const statusDistribution = filteredAndSortedItems.reduce((acc, item) => {
      acc[item.current_status] = (acc[item.current_status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Category performance
    const categoryData = filteredAndSortedItems.reduce((acc, item) => {
      const existing = acc.find(c => c.category === item.category);
      if (existing) {
        existing.count += 1;
        existing.totalValue += item.purchase_price * item.quantity;
        existing.totalRevenue += item.total_rental_revenue;
      } else {
        acc.push({
          category: item.category,
          count: 1,
          totalValue: item.purchase_price * item.quantity,
          totalRevenue: item.total_rental_revenue,
        });
      }
      return acc;
    }, [] as Array<{category: string; count: number; totalValue: number; totalRevenue: number}>);

    // Monthly purchase trend
    const monthlyData = filteredAndSortedItems.reduce((acc, item) => {
      const month = new Date(item.purchase_date).toISOString().slice(0, 7);
      const existing = acc.find(m => m.month === month);
      if (existing) {
        existing.count += 1;
        existing.value += item.purchase_price * item.quantity;
      } else {
        acc.push({
          month,
          count: 1,
          value: item.purchase_price * item.quantity,
        });
      }
      return acc;
    }, [] as Array<{month: string; count: number; value: number}>);

    return {
      totalItems,
      totalValue,
      totalRevenue,
      avgUtilization,
      totalDepreciatedValue,
      roi: totalValue > 0 ? (totalRevenue / totalValue) * 100 : 0,
      statusDistribution,
      categoryData,
      monthlyData: monthlyData.sort((a, b) => a.month.localeCompare(b.month)),
    };
  }, [filteredAndSortedItems]);

  const categories = Array.from(new Set(items.map(item => item.category)));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Individual Item Tracking Report</h2>
          <p className="text-muted-foreground">
            Comprehensive analytics for all individually tracked inventory items
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button variant="outline" size="sm">
            <Eye className="h-4 w-4 mr-2" />
            Print View
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Items</p>
                <p className="text-2xl font-bold">{analytics.totalItems.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  Individual & batch units
                </p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">{formatCurrencySync(analytics.totalValue)}</p>
                <p className="text-xs text-muted-foreground">
                  Current: {formatCurrencySync(analytics.totalDepreciatedValue)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrencySync(analytics.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">
                  ROI: {analytics.roi.toFixed(1)}%
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Utilization</p>
                <p className="text-2xl font-bold">{analytics.avgUtilization.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">
                  Rental efficiency rate
                </p>
              </div>
              <Zap className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Item Status Distribution</CardTitle>
            <CardDescription>Current status of all tracked items</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={Object.entries(analytics.statusDistribution).map(([status, count]) => ({
                      name: status,
                      value: count,
                      fill: STATUS_COLORS[status as keyof typeof STATUS_COLORS] || '#94a3b8'
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {Object.entries(analytics.statusDistribution).map(([status], index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={STATUS_COLORS[status as keyof typeof STATUS_COLORS] || '#94a3b8'} 
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Category Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Category Performance</CardTitle>
            <CardDescription>Revenue and value by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.categoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'totalRevenue' || name === 'totalValue' 
                        ? formatCurrencySync(value as number)
                        : value,
                      name === 'totalRevenue' ? 'Revenue' : 
                      name === 'totalValue' ? 'Value' : 'Count'
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="totalRevenue" fill="#3b82f6" name="Revenue" />
                  <Bar dataKey="totalValue" fill="#10b981" name="Value" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Purchase Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Purchase Trend</CardTitle>
          <CardDescription>Items purchased and their value over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'value' ? formatCurrencySync(value as number) : value,
                    name === 'value' ? 'Value' : 'Count'
                  ]}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="count" fill="#8884d8" name="Items Count" />
                <Line yAxisId="right" type="monotone" dataKey="value" stroke="#82ca9d" name="Total Value" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Item Details & Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by SKU, name, serial..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="AVAILABLE">Available</SelectItem>
                <SelectItem value="RENTED">Rented</SelectItem>
                <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                <SelectItem value="DAMAGED">Damaged</SelectItem>
                <SelectItem value="SOLD">Sold</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={trackingFilter} onValueChange={setTrackingFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by tracking" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                <SelectItem value="BATCH">Batch</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Summary of filtered results */}
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
            <span>
              Showing {filteredAndSortedItems.length} of {items.length} items
            </span>
            <div className="flex gap-4">
              <span>Available: {filteredAndSortedItems.filter(i => i.current_status === 'AVAILABLE').length}</span>
              <span>Rented: {filteredAndSortedItems.filter(i => i.current_status === 'RENTED').length}</span>
              <span>Other: {filteredAndSortedItems.filter(i => !['AVAILABLE', 'RENTED'].includes(i.current_status)).length}</span>
            </div>
          </div>

          {/* Items Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Details</TableHead>
                  <TableHead>Tracking Info</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Financial</TableHead>
                  <TableHead>Performance</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedItems.slice(0, 50).map((item) => ( // Limit to 50 for performance
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{item.item_name}</div>
                        <div className="text-xs text-muted-foreground">{item.category}</div>
                        <code className="text-xs bg-muted px-1 rounded">{item.sku}</code>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant={item.tracking_type === 'INDIVIDUAL' ? 'default' : 'secondary'} className="text-xs">
                          {item.tracking_type === 'INDIVIDUAL' ? (
                            <>
                              <Hash className="h-3 w-3 mr-1" />
                              Individual
                            </>
                          ) : (
                            <>
                              <Package className="h-3 w-3 mr-1" />
                              Batch
                            </>
                          )}
                        </Badge>
                        {item.serial_number && (
                          <div className="text-xs font-mono">{item.serial_number}</div>
                        )}
                        {item.batch_code && (
                          <div className="text-xs font-mono text-orange-600">{item.batch_code}</div>
                        )}
                        {item.quantity > 1 && (
                          <div className="text-xs">Qty: {item.quantity}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            'text-xs',
                            item.current_status === 'AVAILABLE' && 'bg-green-100 text-green-800',
                            item.current_status === 'RENTED' && 'bg-blue-100 text-blue-800',
                            item.current_status === 'MAINTENANCE' && 'bg-yellow-100 text-yellow-800',
                            item.current_status === 'DAMAGED' && 'bg-red-100 text-red-800',
                            item.current_status === 'SOLD' && 'bg-purple-100 text-purple-800'
                          )}
                        >
                          {item.current_status}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {item.condition}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div>Cost: {formatCurrencySync(item.purchase_price)}</div>
                        <div className="text-xs text-muted-foreground">
                          Current: {formatCurrencySync(item.depreciated_value)}
                        </div>
                        <div className="text-xs text-green-600">
                          Revenue: {formatCurrencySync(item.total_rental_revenue)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div>Rentals: {item.rental_count}</div>
                        <div className="text-xs">
                          Utilization: {item.utilization_rate.toFixed(1)}%
                        </div>
                        <div className="w-16 bg-muted rounded-full h-1.5">
                          <div 
                            className="bg-primary h-1.5 rounded-full transition-all"
                            style={{ width: `${Math.min(100, item.utilization_rate)}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {item.location}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div>{item.days_since_purchase} days</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(item.purchase_date).toLocaleDateString()}
                        </div>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            'text-xs',
                            item.warranty_status === 'ACTIVE' && 'bg-green-100 text-green-800',
                            item.warranty_status === 'EXPIRED' && 'bg-red-100 text-red-800'
                          )}
                        >
                          {item.warranty_status === 'NONE' ? 'No Warranty' : item.warranty_status}
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {filteredAndSortedItems.length > 50 && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">
                Showing first 50 of {filteredAndSortedItems.length} items. Use filters to narrow results.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}