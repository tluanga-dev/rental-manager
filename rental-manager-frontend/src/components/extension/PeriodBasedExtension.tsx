'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Calculator, Clock, IndianRupee } from 'lucide-react';
import { format, addDays, addWeeks, addMonths } from 'date-fns';

export type PeriodType = 'DAY' | 'WEEK' | 'MONTH';

interface PeriodBasedExtensionProps {
  currentEndDate: string;
  originalDailyRate: number;
  periodDays: number; // Number of days in one rental period
  periodRate: number; // Rate for one rental period
  itemCount: number;
  onPeriodChange: (periods: number, type: PeriodType, calculatedEndDate: string) => void;
  className?: string;
}

export const PeriodBasedExtension: React.FC<PeriodBasedExtensionProps> = ({
  currentEndDate,
  originalDailyRate,
  periodDays,
  periodRate,
  itemCount,
  onPeriodChange,
  className = ''
}) => {
  const [periodCount, setPeriodCount] = useState<number>(1);
  const [periodType, setPeriodType] = useState<PeriodType>('DAY');
  const [extensionStartDate, setExtensionStartDate] = useState<string>('');
  const [calculatedEndDate, setCalculatedEndDate] = useState<string>('');
  const [totalDays, setTotalDays] = useState<number>(0);
  const [calculatedRate, setCalculatedRate] = useState<number>(0);

  // Calculate dates whenever period changes
  useEffect(() => {
    if (currentEndDate && periodCount > 0) {
      const currentEnd = new Date(currentEndDate);
      const extensionStart = addDays(currentEnd, 1);
      setExtensionStartDate(format(extensionStart, 'yyyy-MM-dd'));

      // Always calculate based on rental period days from item master
      const days = periodCount * periodDays;
      // End date should be inclusive, so subtract 1 day
      // E.g., 1 day extension starting Aug 9 ends on Aug 9, not Aug 10
      const newEnd = addDays(extensionStart, days - 1);

      const formattedEndDate = format(newEnd, 'yyyy-MM-dd');
      setCalculatedEndDate(formattedEndDate);
      setTotalDays(days);

      // Calculate rate based on period rate
      const rate = periodRate * periodCount;
      setCalculatedRate(rate);

      // Notify parent component
      onPeriodChange(periodCount, periodType, formattedEndDate);
    }
  }, [periodCount, periodType, currentEndDate, periodDays, periodRate, onPeriodChange]);

  const handlePeriodCountChange = useCallback((value: string) => {
    const count = parseInt(value, 10);
    if (!isNaN(count) && count > 0 && count <= 52) {
      setPeriodCount(count);
    }
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatDateDisplay = (dateString: string) => {
    if (!dateString) return '';
    return format(new Date(dateString), 'MMM dd, yyyy');
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Extension Period
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Period Input Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Number of Rental Periods
            </label>
            <div className="flex gap-2">
              <Input
                type="number"
                min="1"
                max={52}
                value={periodCount}
                onChange={(e) => handlePeriodCountChange(e.target.value)}
                className="flex-1"
                placeholder="Enter period count"
              />
              <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md w-32">
                <span className="text-gray-700">Periods</span>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Each period = {periodDays} days
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Total Extension Days
            </label>
            <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
              <span className="text-lg font-semibold text-blue-900">
                {totalDays} days
              </span>
            </div>
          </div>
        </div>

        {/* Date Display Section */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Calendar className="w-4 h-4" />
            Extension Dates
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Current End Date</p>
              <p className="font-medium text-gray-900">
                {formatDateDisplay(currentEndDate)}
              </p>
            </div>
            
            <div>
              <p className="text-xs text-gray-500 mb-1">Extension Starts</p>
              <p className="font-medium text-green-700">
                {formatDateDisplay(extensionStartDate)}
              </p>
            </div>
            
            <div>
              <p className="text-xs text-gray-500 mb-1">New Return Date</p>
              <p className="font-medium text-blue-700">
                {formatDateDisplay(calculatedEndDate)}
              </p>
            </div>
          </div>
        </div>

        {/* Rate Calculation Section */}
        <div className="bg-indigo-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-indigo-900">
            <Calculator className="w-4 h-4" />
            Rate Calculation
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Rate per Period ({periodDays} days):</span>
              <span className="font-medium">{formatCurrency(periodRate)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Items:</span>
              <span className="font-medium">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Extension Periods:</span>
              <span className="font-medium">{periodCount} × {periodDays} days = {totalDays} days</span>
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between">
                <span className="font-medium text-indigo-900">Total Extension Cost:</span>
                <span className="text-lg font-bold text-indigo-900">
                  {formatCurrency(calculatedRate)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Helper Text */}
        <div className="text-xs text-gray-500 italic">
          <p>• Extension will be calculated from the day after your current rental ends</p>
          <p>• Each rental period is {periodDays} days as defined in the item master data</p>
          <p>• Total extension = Number of periods × {periodDays} days</p>
        </div>
      </CardContent>
    </Card>
  );
};