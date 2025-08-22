'use client';

import React from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import '@/styles/pastel-calendar.css';
import { cn } from '@/lib/utils';

interface PastelCalendarProps {
  value?: Date | null;
  onChange?: (date: Date | null) => void;
  disabled?: (date: Date) => boolean;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
}

export function PastelCalendar({
  value,
  onChange,
  disabled,
  className,
  minDate,
  maxDate,
  ...props
}: PastelCalendarProps) {
  // Get weekday for a given date (0 = Sunday, 6 = Saturday)
  const getWeekday = (date: Date): number => {
    return date.getDay();
  };

  // Custom tile class name function
  const getTileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view !== 'month') return '';
    
    const weekday = getWeekday(date);
    
    // Check if this date is selected
    const isSelected = value && 
      date.getDate() === value.getDate() && 
      date.getMonth() === value.getMonth() && 
      date.getFullYear() === value.getFullYear();
    
    const classes = [`weekday-${weekday}`];
    
    if (isSelected) {
      classes.push('react-calendar__tile--active');
    }
    
    return classes.join(' ');
  };

  return (
    <div className={cn('pastel-calendar-wrapper', className)}>
      <Calendar
        value={value}
        onChange={onChange}
        tileClassName={getTileClassName}
        tileDisabled={disabled ? ({ date }) => disabled(date) : undefined}
        minDate={minDate}
        maxDate={maxDate}
        prev2Label={null}
        next2Label={null}
        showNeighboringMonth={false}
        {...props}
      />
    </div>
  );
}
