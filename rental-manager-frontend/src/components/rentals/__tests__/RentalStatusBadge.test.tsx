import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import RentalStatusBadge from '../RentalStatusBadge';
import type { RentalStatus } from '@/types/rentals';

// Mock the utils
jest.mock('@/lib/utils', () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
}));

describe('RentalStatusBadge', () => {
  it('renders active status correctly', () => {
    render(<RentalStatusBadge status="ACTIVE" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders late status correctly', () => {
    render(<RentalStatusBadge status="LATE" />);
    expect(screen.getByText('Late')).toBeInTheDocument();
  });

  it('renders partial return status correctly', () => {
    render(<RentalStatusBadge status="PARTIAL_RETURN" />);
    expect(screen.getByText('Partial Return')).toBeInTheDocument();
  });

  it('renders late partial return status correctly', () => {
    render(<RentalStatusBadge status="LATE_PARTIAL_RETURN" />);
    expect(screen.getByText('Late Partial')).toBeInTheDocument();
  });

  it('renders completed status correctly', () => {
    render(<RentalStatusBadge status="COMPLETED" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('applies correct size classes', () => {
    const { rerender } = render(<RentalStatusBadge status="ACTIVE" size="sm" />);
    expect(screen.getByText('Active')).toHaveClass('px-2', 'py-1', 'text-xs');

    rerender(<RentalStatusBadge status="ACTIVE" size="lg" />);
    expect(screen.getByText('Active')).toHaveClass('px-4', 'py-2', 'text-base');
  });

  it('shows icon by default', () => {
    render(<RentalStatusBadge status="ACTIVE" />);
    const badge = screen.getByText('Active').closest('span');
    expect(badge?.querySelector('svg')).toBeInTheDocument();
  });

  it('hides icon when showIcon is false', () => {
    render(<RentalStatusBadge status="ACTIVE" showIcon={false} />);
    const badge = screen.getByText('Active').closest('span');
    expect(badge?.querySelector('svg')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<RentalStatusBadge status="ACTIVE" className="custom-class" />);
    expect(screen.getByText('Active')).toHaveClass('custom-class');
  });

  it('shows tooltip when showTooltip is true', () => {
    render(<RentalStatusBadge status="ACTIVE" showTooltip={true} />);
    const badge = screen.getByText('Active');
    expect(badge).toHaveAttribute('title', 'Items currently on rent, within timeframe');
  });
});

describe('Status helper functions', () => {
  it('should handle all rental status types', () => {
    const statuses: RentalStatus[] = [
      'RESERVED',
      'CONFIRMED', 
      'PICKED_UP',
      'ACTIVE',
      'EXTENDED',
      'PARTIAL_RETURN',
      'OVERDUE',
      'LATE',
      'LATE_PARTIAL_RETURN',
      'RETURNED',
      'COMPLETED'
    ];

    statuses.forEach(status => {
      expect(() => render(<RentalStatusBadge status={status} />)).not.toThrow();
    });
  });
});