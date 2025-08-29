'use client';

import React from 'react';
import { MovementSummary } from '@/services/api/stock-movements';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  DollarSign,
  Package,
  RotateCcw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MovementsSummaryProps {
  summary: MovementSummary;
  isLoading: boolean;
  onToggle: () => void;
}

interface SummaryCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
}

function SummaryCard({ title, value, icon, color, bgColor, borderColor, description, trend }: SummaryCardProps) {
  const trendIcon = trend === 'up' ? 
    <TrendingUp className="h-3 w-3 text-green-500" /> : 
    trend === 'down' ? 
    <TrendingDown className="h-3 w-3 text-red-500" /> : null;

  return (
    <div className={`${bgColor} ${borderColor} rounded-lg border p-4`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 ${bgColor === 'bg-white' ? 'bg-gray-100' : 'bg-white bg-opacity-80'} rounded-lg`}>
          <div className={color}>
            {icon}
          </div>
        </div>
        {trendIcon}
      </div>
      <div>
        <p className={`text-2xl font-bold ${color.replace('text-', 'text-').replace('-500', '-700')}`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className={`text-sm font-medium ${color.replace('text-', 'text-').replace('-500', '-600')} mb-1`}>
          {title}
        </p>
        {description && (
          <p className={`text-xs ${color.replace('text-', 'text-').replace('-500', '-600')}`}>
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

export function MovementsSummary({ summary, isLoading, onToggle }: MovementsSummaryProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const netQuantityTrend = summary.net_quantity > 0 ? 'up' : summary.net_quantity < 0 ? 'down' : 'neutral';
  const netValueTrend = summary.net_value > 0 ? 'up' : summary.net_value < 0 ? 'down' : 'neutral';

  return (
    <div className="bg-white rounded-lg border">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Movement Summary</h3>
          <div className="flex gap-2">
            <Button
              onClick={() => setIsExpanded(!isExpanded)}
              variant="ghost"
              size="sm"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {isExpanded ? 'Less' : 'More'} Details
            </Button>
            <Button onClick={onToggle} variant="ghost" size="sm">
              Hide Summary
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* High-Level Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <SummaryCard
            title="Total Movements"
            value={summary.total_movements}
            icon={<Activity className="h-5 w-5" />}
            color="text-blue-500"
            bgColor="bg-blue-50"
            borderColor="border-blue-200"
            description={`${summary.date_range.start_date} to ${summary.date_range.end_date}`}
          />

          <SummaryCard
            title="Items In"
            value={summary.total_quantity_in}
            icon={<TrendingUp className="h-5 w-5" />}
            color="text-green-500"
            bgColor="bg-green-50"
            borderColor="border-green-200"
            description={`$${summary.total_value_in.toLocaleString()} value`}
            trend="up"
          />

          <SummaryCard
            title="Items Out"
            value={summary.total_quantity_out}
            icon={<TrendingDown className="h-5 w-5" />}
            color="text-red-500"
            bgColor="bg-red-50"
            borderColor="border-red-200"
            description={`$${summary.total_value_out.toLocaleString()} value`}
            trend="down"
          />

          <SummaryCard
            title="Net Change"
            value={summary.net_quantity}
            icon={<RotateCcw className="h-5 w-5" />}
            color="text-purple-500"
            bgColor="bg-purple-50"
            borderColor="border-purple-200"
            description={`$${summary.net_value.toLocaleString()} net value`}
            trend={netQuantityTrend}
          />
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="space-y-6">
            {/* Movement Types Breakdown */}
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-4">Movement Types</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {summary.movement_types.map((type) => (
                  <div key={type.movement_type} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-medium text-gray-900">
                        {type.movement_type.replace(/_/g, ' ')}
                      </h5>
                      <div className="flex items-center gap-1">
                        <Package className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium">{type.count}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Quantity:</span>
                        <span className="font-medium">{type.total_quantity.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Value:</span>
                        <span className="font-medium">${type.total_value.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Avg Value:</span>
                        <span className="font-medium">
                          ${type.count > 0 ? (type.total_value / type.count).toFixed(2) : '0.00'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Value Analysis */}
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-4">Value Analysis</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    <h5 className="font-medium text-green-800">Total Value In</h5>
                  </div>
                  <p className="text-2xl font-bold text-green-700">
                    ${summary.total_value_in.toLocaleString()}
                  </p>
                  <p className="text-sm text-green-600">
                    Avg: ${summary.total_quantity_in > 0 ? (summary.total_value_in / summary.total_quantity_in).toFixed(2) : '0.00'} per unit
                  </p>
                </div>

                <div className="bg-gradient-to-r from-red-50 to-rose-50 rounded-lg p-4 border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-5 w-5 text-red-600" />
                    <h5 className="font-medium text-red-800">Total Value Out</h5>
                  </div>
                  <p className="text-2xl font-bold text-red-700">
                    ${summary.total_value_out.toLocaleString()}
                  </p>
                  <p className="text-sm text-red-600">
                    Avg: ${summary.total_quantity_out > 0 ? (summary.total_value_out / summary.total_quantity_out).toFixed(2) : '0.00'} per unit
                  </p>
                </div>

                <div className={`bg-gradient-to-r ${
                  summary.net_value >= 0 ? 'from-blue-50 to-cyan-50 border-blue-200' : 'from-orange-50 to-red-50 border-orange-200'
                } rounded-lg p-4 border`}>
                  <div className="flex items-center gap-2 mb-2">
                    <RotateCcw className={`h-5 w-5 ${summary.net_value >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
                    <h5 className={`font-medium ${summary.net_value >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
                      Net Value Change
                    </h5>
                  </div>
                  <p className={`text-2xl font-bold ${summary.net_value >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                    {summary.net_value >= 0 ? '+' : ''}${summary.net_value.toLocaleString()}
                  </p>
                  <p className={`text-sm ${summary.net_value >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                    {summary.net_value >= 0 ? 'Inventory value increased' : 'Inventory value decreased'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}