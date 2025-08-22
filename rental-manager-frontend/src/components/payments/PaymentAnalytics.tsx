'use client';

import React, { useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  CreditCard,
  PieChart,
  BarChart3,
  Calendar,
  Users,
  Target,
  AlertTriangle
} from 'lucide-react';
import { PaymentHistoryItem, PaymentMethod, PaymentMethodInfo } from '@/types/payment';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

interface PaymentAnalyticsData {
  total_revenue: number;
  total_transactions: number;
  average_transaction_value: number;
  payment_method_breakdown: Record<PaymentMethod, { amount: number; count: number }>;
  daily_trends: { date: string; amount: number; count: number }[];
  monthly_comparison: { current_month: number; previous_month: number };
  top_payment_types: Array<{ type: string; amount: number; percentage: number }>;
}

interface PaymentAnalyticsProps {
  paymentHistory: PaymentHistoryItem[];
  dateRange?: {
    from: string;
    to: string;
  };
  showComparison?: boolean;
}

export const PaymentAnalytics: React.FC<PaymentAnalyticsProps> = ({
  paymentHistory,
  dateRange,
  showComparison = true
}) => {
  const analyticsData: PaymentAnalyticsData = useMemo(() => {
    if (!paymentHistory.length) {
      return {
        total_revenue: 0,
        total_transactions: 0,
        average_transaction_value: 0,
        payment_method_breakdown: {} as Record<PaymentMethod, { amount: number; count: number }>,
        daily_trends: [],
        monthly_comparison: { current_month: 0, previous_month: 0 },
        top_payment_types: []
      };
    }

    // Filter data by date range if provided
    const filteredPayments = dateRange
      ? paymentHistory.filter(payment => {
          const paymentDate = new Date(payment.date);
          return paymentDate >= new Date(dateRange.from) && paymentDate <= new Date(dateRange.to);
        })
      : paymentHistory;

    // Calculate basic metrics
    const total_revenue = filteredPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const total_transactions = filteredPayments.length;
    const average_transaction_value = total_transactions > 0 ? total_revenue / total_transactions : 0;

    // Payment method breakdown
    const payment_method_breakdown: Record<PaymentMethod, { amount: number; count: number }> = 
      {} as Record<PaymentMethod, { amount: number; count: number }>;
    
    Object.values(PaymentMethod).forEach(method => {
      payment_method_breakdown[method] = { amount: 0, count: 0 };
    });

    filteredPayments.forEach(payment => {
      if (payment_method_breakdown[payment.method]) {
        payment_method_breakdown[payment.method].amount += payment.amount;
        payment_method_breakdown[payment.method].count += 1;
      }
    });

    // Daily trends (last 30 days)
    const dailyMap = new Map<string, { amount: number; count: number }>();
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = format(subDays(new Date(), 29 - i), 'yyyy-MM-dd');
      dailyMap.set(date, { amount: 0, count: 0 });
      return date;
    });

    filteredPayments.forEach(payment => {
      const dateKey = format(new Date(payment.date), 'yyyy-MM-dd');
      if (dailyMap.has(dateKey)) {
        const existing = dailyMap.get(dateKey)!;
        existing.amount += payment.amount;
        existing.count += 1;
      }
    });

    const daily_trends = last30Days.map(date => ({
      date,
      amount: dailyMap.get(date)?.amount || 0,
      count: dailyMap.get(date)?.count || 0
    }));

    // Monthly comparison
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const previousMonthStart = startOfMonth(subDays(currentMonthStart, 1));
    const previousMonthEnd = endOfMonth(subDays(currentMonthStart, 1));

    const currentMonthPayments = paymentHistory.filter(payment => {
      const paymentDate = new Date(payment.date);
      return paymentDate >= currentMonthStart && paymentDate <= currentMonthEnd;
    });

    const previousMonthPayments = paymentHistory.filter(payment => {
      const paymentDate = new Date(payment.date);
      return paymentDate >= previousMonthStart && paymentDate <= previousMonthEnd;
    });

    const monthly_comparison = {
      current_month: currentMonthPayments.reduce((sum, p) => sum + p.amount, 0),
      previous_month: previousMonthPayments.reduce((sum, p) => sum + p.amount, 0)
    };

    // Top payment types
    const paymentTypeMap = new Map<string, number>();
    filteredPayments.forEach(payment => {
      const current = paymentTypeMap.get(payment.payment_type) || 0;
      paymentTypeMap.set(payment.payment_type, current + payment.amount);
    });

    const top_payment_types = Array.from(paymentTypeMap.entries())
      .map(([type, amount]) => ({
        type,
        amount,
        percentage: total_revenue > 0 ? (amount / total_revenue) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      total_revenue,
      total_transactions,
      average_transaction_value,
      payment_method_breakdown,
      daily_trends,
      monthly_comparison,
      top_payment_types
    };
  }, [paymentHistory, dateRange]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getGrowthPercentage = () => {
    if (analyticsData.monthly_comparison.previous_month === 0) return 0;
    return ((analyticsData.monthly_comparison.current_month - analyticsData.monthly_comparison.previous_month) / 
      analyticsData.monthly_comparison.previous_month) * 100;
  };

  const growthPercentage = getGrowthPercentage();
  const isPositiveGrowth = growthPercentage >= 0;

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Revenue</p>
              <p className="text-2xl font-bold">{formatCurrency(analyticsData.total_revenue)}</p>
            </div>
            <IndianRupee className="w-8 h-8 text-blue-200" />
          </div>
          {showComparison && (
            <div className="flex items-center mt-2">
              {isPositiveGrowth ? (
                <TrendingUp className="w-4 h-4 text-green-300" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-300" />
              )}
              <span className={`text-sm ml-1 ${isPositiveGrowth ? 'text-green-300' : 'text-red-300'}`}>
                {formatPercentage(Math.abs(growthPercentage))} vs last month
              </span>
            </div>
          )}
        </div>

        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Total Transactions</p>
              <p className="text-2xl font-bold">{analyticsData.total_transactions.toLocaleString()}</p>
            </div>
            <CreditCard className="w-8 h-8 text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Average Transaction</p>
              <p className="text-2xl font-bold">{formatCurrency(analyticsData.average_transaction_value)}</p>
            </div>
            <Target className="w-8 h-8 text-purple-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">This Month</p>
              <p className="text-2xl font-bold">{formatCurrency(analyticsData.monthly_comparison.current_month)}</p>
            </div>
            <Calendar className="w-8 h-8 text-orange-200" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Method Breakdown */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Payment Method Breakdown</h3>
          </div>
          
          <div className="space-y-3">
            {Object.entries(analyticsData.payment_method_breakdown)
              .filter(([_, data]) => data.amount > 0)
              .sort(([,a], [,b]) => b.amount - a.amount)
              .map(([method, data]) => {
                const percentage = analyticsData.total_revenue > 0 
                  ? (data.amount / analyticsData.total_revenue) * 100 
                  : 0;
                
                return (
                  <div key={method} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{PaymentMethodInfo[method as PaymentMethod].icon}</span>
                      <span className="text-sm font-medium text-gray-700">
                        {PaymentMethodInfo[method as PaymentMethod].label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-900">
                          {formatCurrency(data.amount)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {data.count} transactions
                        </div>
                      </div>
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-600 w-8">
                        {formatPercentage(percentage)}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Payment Type Distribution */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Payment Type Distribution</h3>
          </div>
          
          <div className="space-y-3">
            {analyticsData.top_payment_types.map((typeData, index) => (
              <div key={typeData.type} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${
                    index === 0 ? 'bg-green-500' : 
                    index === 1 ? 'bg-blue-500' : 
                    index === 2 ? 'bg-purple-500' : 'bg-gray-400'
                  }`}></span>
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {typeData.type.toLowerCase().replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">
                      {formatCurrency(typeData.amount)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatPercentage(typeData.percentage)}
                    </div>
                  </div>
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        index === 0 ? 'bg-green-500' : 
                        index === 1 ? 'bg-blue-500' : 
                        index === 2 ? 'bg-purple-500' : 'bg-gray-400'
                      }`}
                      style={{ width: `${typeData.percentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Daily Trend Chart */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Daily Payment Trends (Last 30 Days)</h3>
        </div>
        
        <div className="h-64 flex items-end justify-between gap-1 mt-4">
          {analyticsData.daily_trends.map((day, index) => {
            const maxAmount = Math.max(...analyticsData.daily_trends.map(d => d.amount));
            const height = maxAmount > 0 ? (day.amount / maxAmount) * 100 : 0;
            
            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center group cursor-pointer"
              >
                <div className="relative w-full max-w-8">
                  <div
                    className={`w-full rounded-t transition-all duration-300 ${
                      day.amount > 0 
                        ? 'bg-gradient-to-t from-blue-500 to-blue-400 hover:from-blue-600 hover:to-blue-500' 
                        : 'bg-gray-200'
                    }`}
                    style={{ height: `${height}%`, minHeight: day.amount > 0 ? '2px' : '1px' }}
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      <div>{format(new Date(day.date), 'MMM dd')}</div>
                      <div>{formatCurrency(day.amount)}</div>
                      <div>{day.count} transactions</div>
                    </div>
                  </div>
                </div>
                {index % 7 === 0 && (
                  <span className="text-xs text-gray-500 mt-1">
                    {format(new Date(day.date), 'MMM dd')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Insights */}
      {analyticsData.total_transactions > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="text-lg font-semibold text-gray-900">Key Insights</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Most Popular Payment Method</h4>
              <p className="text-sm text-blue-800">
                {(() => {
                  const topMethod = Object.entries(analyticsData.payment_method_breakdown)
                    .reduce((a, b) => a[1].amount > b[1].amount ? a : b);
                  const percentage = analyticsData.total_revenue > 0 
                    ? (topMethod[1].amount / analyticsData.total_revenue) * 100 
                    : 0;
                  return `${PaymentMethodInfo[topMethod[0] as PaymentMethod].label} accounts for ${formatPercentage(percentage)} of total revenue`;
                })()}
              </p>
            </div>
            
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">Average Daily Revenue</h4>
              <p className="text-sm text-green-800">
                {(() => {
                  const totalDays = analyticsData.daily_trends.filter(d => d.amount > 0).length;
                  const avgDaily = totalDays > 0 ? analyticsData.total_revenue / 30 : 0;
                  return `${formatCurrency(avgDaily)} per day over the last 30 days`;
                })()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};