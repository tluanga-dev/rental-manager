'use client';

import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { formatCurrencySync } from '@/lib/currency-utils';
import { Trophy, TrendingUp } from 'lucide-react';

interface TopItem {
  name: string;
  sku: string;
  rentals: number;
  revenue: number;
}

interface TopItemsChartProps {
  data: TopItem[];
  height?: number;
  showRevenue?: boolean;
  limit?: number;
}

export function TopItemsChart({ 
  data = [], 
  height = 300,
  showRevenue = true,
  limit = 8
}: TopItemsChartProps) {
  // Process and format data
  const chartData = data
    .slice(0, limit)
    .map((item, index) => ({
      ...item,
      shortName: item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name,
      rank: index + 1,
      formattedRevenue: formatCurrencySync(item.revenue)
    }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg max-w-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <span className="font-medium text-gray-900">#{data.rank} Best Performer</span>
            </div>
            <p className="font-semibold text-gray-800">{data.name}</p>
            <p className="text-sm text-gray-600">SKU: {data.sku}</p>
            <div className="grid grid-cols-2 gap-2 pt-2 text-sm">
              <div>
                <span className="text-blue-600 font-medium">Rentals:</span>
                <br />
                <span className="text-lg font-bold">{data.rentals}</span>
              </div>
              {showRevenue && (
                <div>
                  <span className="text-green-600 font-medium">Revenue:</span>
                  <br />
                  <span className="text-lg font-bold">{data.formattedRevenue}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-gray-500">
        <div className="text-center">
          <Trophy className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium mb-1">No top items data</p>
          <p className="text-sm">Start renting items to see performance</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top 3 Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {chartData.slice(0, 3).map((item, index) => {
          const medals = ['🥇', '🥈', '🥉'];
          const colors = ['bg-yellow-50 border-yellow-200', 'bg-gray-50 border-gray-200', 'bg-orange-50 border-orange-200'];
          
          return (
            <div key={item.sku} className={`p-3 rounded-lg border ${colors[index]}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-lg">{medals[index]}</span>
                <Badge variant="outline" className="text-xs">
                  {item.rentals} rentals
                </Badge>
              </div>
              <p className="font-medium text-sm text-gray-900 truncate" title={item.name}>
                {item.name}
              </p>
              <p className="text-xs text-gray-500">{item.sku}</p>
              {showRevenue && (
                <p className="text-sm font-semibold text-green-600 mt-1">
                  {item.formattedRevenue}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Bar Chart */}
      <div className="w-full">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart 
            data={chartData} 
            margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
            layout="horizontal"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              type="number"
              stroke="#6B7280"
              fontSize={12}
              tickLine={false}
            />
            <YAxis 
              type="category"
              dataKey="shortName"
              stroke="#6B7280"
              fontSize={11}
              tickLine={false}
              width={120}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="rentals" 
              fill="#3B82F6"
              radius={[0, 4, 4, 0]}
              name="Rentals"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Performance Summary */}
      {data.length > 3 && (
        <div className="flex items-center justify-between text-sm text-gray-600 pt-2 border-t">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span>Showing top {Math.min(limit, data.length)} performing items</span>
          </div>
          <div>
            Total tracked: <span className="font-medium">{data.length} items</span>
          </div>
        </div>
      )}
    </div>
  );
}