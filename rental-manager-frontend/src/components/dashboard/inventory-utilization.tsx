'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { Package, TrendingUp, AlertTriangle } from 'lucide-react';

interface InventoryData {
  stock_summary: {
    total_items: number;
    available_items: number;
    rented_items: number;
    maintenance_items: number;
    utilization_rate: number;
  };
  category_utilization: Array<{
    category: string;
    total: number;
    rented: number;
    utilization_rate: number;
  }>;
  location_breakdown: Array<{
    location: string;
    total_items: number;
    available: number;
    rented: number;
  }>;
  top_items: Array<{
    name: string;
    sku: string;
    rentals: number;
    revenue: number;
  }>;
  bottom_items: Array<{
    name: string;
    sku: string;
    rentals: number;
  }>;
  low_stock_alerts: Array<{
    item: string;
    sku: string;
    location: string;
    available: number;
    minimum_required: number;
  }>;
}

interface InventoryUtilizationProps {
  data: InventoryData;
}

const COLORS = ['#22C55E', '#EF4444', '#F59E0B', '#6B7280'];

export function InventoryUtilization({ data }: InventoryUtilizationProps) {
  if (!data) {
    return (
      <div className="grid gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center h-32 text-gray-500">
              No inventory data available
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { stock_summary, category_utilization, location_breakdown } = data;

  // Prepare pie chart data
  const pieData = [
    { name: 'Rented', value: stock_summary.rented_items, color: '#22C55E' },
    { name: 'Available', value: stock_summary.available_items, color: '#3B82F6' },
    { name: 'Maintenance', value: stock_summary.maintenance_items, color: '#F59E0B' },
  ].filter(item => item.value > 0);

  // Prepare category chart data
  const categoryData = category_utilization.slice(0, 8).map(cat => ({
    category: cat.category.length > 15 ? cat.category.substring(0, 15) + '...' : cat.category,
    utilization: cat.utilization_rate,
    rented: cat.rented,
    total: cat.total
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-1">{label}</p>
          <p className="text-sm text-blue-600">
            Utilization: <span className="font-semibold">{data.utilization}%</span>
          </p>
          <p className="text-sm text-gray-600">
            Rented: <span className="font-semibold">{data.rented}</span> / <span className="font-semibold">{data.total}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid gap-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Items</p>
                <p className="text-2xl font-bold text-gray-900">{stock_summary.total_items}</p>
              </div>
              <Package className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Available</p>
                <p className="text-2xl font-bold text-green-600">{stock_summary.available_items}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Currently Rented</p>
                <p className="text-2xl font-bold text-blue-600">{stock_summary.rented_items}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Utilization Rate</p>
                <p className="text-2xl font-bold text-purple-600">{stock_summary.utilization_rate}%</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                <div className="text-purple-600 font-bold text-sm">{Math.round(stock_summary.utilization_rate)}</div>
              </div>
            </div>
            <div className="mt-3">
              <Progress value={stock_summary.utilization_rate} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Stock Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, name: string) => [value, name]}
                    labelStyle={{ display: 'none' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-4">
              {pieData.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: entry.color }}
                  ></div>
                  <span className="text-sm text-gray-600">{entry.name}: {entry.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Category Utilization Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Category Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="category" 
                    stroke="#6B7280"
                    fontSize={11}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    stroke="#6B7280"
                    fontSize={12}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="utilization" 
                    fill="#3B82F6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Location Breakdown */}
      {location_breakdown && location_breakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Inventory by Location</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {location_breakdown.slice(0, 6).map((location, index) => {
                const utilization = location.total_items > 0 
                  ? Math.round((location.rented / location.total_items) * 100)
                  : 0;
                
                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{location.location}</h4>
                        <Badge variant="outline" className="text-xs">
                          {utilization}% utilized
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
                        <div>Total: <span className="font-semibold">{location.total_items}</span></div>
                        <div>Available: <span className="font-semibold text-green-600">{location.available}</span></div>
                        <div>Rented: <span className="font-semibold text-blue-600">{location.rented}</span></div>
                      </div>
                      <Progress value={utilization} className="h-2 mt-2" />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}