'use client';

import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  ResponsiveContainer, 
  RadialBarChart, 
  RadialBar, 
  Cell, 
  PieChart, 
  Pie,
  Tooltip
} from 'recharts';
import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle, 
  AlertTriangle,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPIMetric {
  name: string;
  current_value: number;
  target_value: number;
  achievement_percentage: number;
  category: 'revenue' | 'operational' | 'customer' | 'inventory';
  trend?: 'up' | 'down' | 'stable';
  unit?: string;
  description?: string;
}

interface PerformanceGaugesProps {
  data: KPIMetric[];
}

const CATEGORY_COLORS = {
  revenue: '#10B981',
  operational: '#3B82F6',
  customer: '#8B5CF6',
  inventory: '#F59E0B'
};

const CATEGORY_LABELS = {
  revenue: 'Revenue KPIs',
  operational: 'Operations',
  customer: 'Customer',
  inventory: 'Inventory'
};

export function PerformanceGauges({ data = [] }: PerformanceGaugesProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <Target className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium mb-1">No KPI data available</p>
          <p className="text-sm">Performance metrics will appear here</p>
        </div>
      </div>
    );
  }

  // Ensure data is an array before processing
  const kpiArray = Array.isArray(data) ? data : [];
  
  // Group KPIs by category
  const groupedKPIs = kpiArray.reduce((acc, kpi) => {
    if (!acc[kpi.category]) {
      acc[kpi.category] = [];
    }
    acc[kpi.category].push(kpi);
    return acc;
  }, {} as Record<string, KPIMetric[]>);

  const getPerformanceColor = (achievement: number) => {
    if (achievement >= 90) return 'text-green-600';
    if (achievement >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceBadgeColor = (achievement: number) => {
    if (achievement >= 90) return 'bg-green-100 text-green-800 border-green-200';
    if (achievement >= 70) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusIcon = (achievement: number) => {
    if (achievement >= 90) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
  };

  // Overall performance summary
  const overallAchievement = kpiArray.length > 0 
    ? Math.round(kpiArray.reduce((sum, kpi) => sum + kpi.achievement_percentage, 0) / kpiArray.length)
    : 0;

  const achievementData = [
    { name: 'Achieved', value: overallAchievement, fill: '#10B981' },
    { name: 'Remaining', value: 100 - overallAchievement, fill: '#E5E7EB' }
  ];

  return (
    <div className="space-y-6">
      {/* Overall Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Performance</h3>
            <div className="relative w-32 h-32 mx-auto">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={achievementData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={60}
                    startAngle={90}
                    endAngle={450}
                    dataKey="value"
                  >
                    {achievementData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className={cn("text-2xl font-bold", getPerformanceColor(overallAchievement))}>
                    {overallAchievement}%
                  </div>
                  <div className="text-xs text-gray-500">Achievement</div>
                </div>
              </div>
            </div>
            <Badge 
              className={cn("mt-3", getPerformanceBadgeColor(overallAchievement))}
              variant="outline"
            >
              {overallAchievement >= 90 ? 'Excellent' : 
               overallAchievement >= 70 ? 'Good' : 'Needs Improvement'}
            </Badge>
          </div>
        </div>

        {/* Category Summary */}
        <div className="lg:col-span-3">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">KPI Categories</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(groupedKPIs).map(([category, kpis]) => {
              const kpisArray = Array.isArray(kpis) ? kpis : [];
              const categoryAchievement = kpisArray.length > 0 ? Math.round(
                kpisArray.reduce((sum, kpi) => sum + kpi.achievement_percentage, 0) / kpisArray.length
              ) : 0;
              
              return (
                <div key={category} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900">
                      {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
                    </h4>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(categoryAchievement)}
                      <span className={cn("font-semibold", getPerformanceColor(categoryAchievement))}>
                        {categoryAchievement}%
                      </span>
                    </div>
                  </div>
                  <Progress 
                    value={categoryAchievement} 
                    className="h-3"
                    style={{
                      '--progress-background': CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS]
                    } as React.CSSProperties}
                  />
                  <p className="text-sm text-gray-600 mt-2">
                    {kpis.length} KPI{kpis.length !== 1 ? 's' : ''} tracked
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detailed KPI Cards */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kpiArray.map((kpi, index) => (
            <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 text-sm">{kpi.name}</h4>
                  {kpi.description && (
                    <p className="text-xs text-gray-500 mt-1">{kpi.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {getTrendIcon(kpi.trend)}
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs", getPerformanceBadgeColor(kpi.achievement_percentage))}
                  >
                    {CATEGORY_LABELS[kpi.category]}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-sm text-gray-600">Current</p>
                    <p className="text-lg font-bold text-gray-900">
                      {kpi.current_value.toLocaleString()}{kpi.unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Target</p>
                    <p className="text-sm font-medium text-gray-700">
                      {kpi.target_value.toLocaleString()}{kpi.unit}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-600">Achievement</span>
                    <span className={cn("text-sm font-medium", getPerformanceColor(kpi.achievement_percentage))}>
                      {kpi.achievement_percentage}%
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(kpi.achievement_percentage, 100)} 
                    className="h-2"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}