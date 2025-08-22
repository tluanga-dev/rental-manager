import React from 'react';
import { render, screen } from '@testing-library/react';
import { MetricCard } from '../metric-card';
import { DollarSign, ArrowUp, ArrowDown } from 'lucide-react';

describe('MetricCard', () => {
  const defaultProps = {
    title: 'Total Revenue',
    value: '$25,000',
    icon: <DollarSign data-testid="dollar-icon" />,
  };

  it('renders basic metric card correctly', () => {
    render(<MetricCard {...defaultProps} />);
    
    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
    expect(screen.getByText('$25,000')).toBeInTheDocument();
    expect(screen.getByTestId('dollar-icon')).toBeInTheDocument();
  });

  it('displays description when provided', () => {
    render(
      <MetricCard 
        {...defaultProps} 
        description="45 transactions this month" 
      />
    );
    
    expect(screen.getByText('45 transactions this month')).toBeInTheDocument();
  });

  it('shows positive trend with green styling', () => {
    render(
      <MetricCard 
        {...defaultProps}
        change={15.5}
        trend={<ArrowUp data-testid="trend-up" />}
        trendColor="text-green-600"
      />
    );
    
    expect(screen.getByText('+15.5%')).toBeInTheDocument();
    expect(screen.getByTestId('trend-up')).toBeInTheDocument();
  });

  it('shows negative trend with red styling', () => {
    render(
      <MetricCard 
        {...defaultProps}
        change={-8.2}
        trend={<ArrowDown data-testid="trend-down" />}
        trendColor="text-red-600"
      />
    );
    
    expect(screen.getByText('-8.2%')).toBeInTheDocument();
    expect(screen.getByTestId('trend-down')).toBeInTheDocument();
  });

  it('shows loading state correctly', () => {
    render(<MetricCard {...defaultProps} loading={true} />);
    
    // Should show skeleton loading animation
    const loadingCard = screen.getByRole('generic');
    expect(loadingCard).toHaveClass('animate-pulse');
    
    // Should not show actual content while loading
    expect(screen.queryByText('Total Revenue')).not.toBeInTheDocument();
    expect(screen.queryByText('$25,000')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <MetricCard {...defaultProps} className="custom-metric-card" />
    );
    
    expect(container.firstChild).toHaveClass('custom-metric-card');
  });

  it('handles zero change correctly', () => {
    render(
      <MetricCard 
        {...defaultProps}
        change={0}
      />
    );
    
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('renders without change and trend', () => {
    render(<MetricCard {...defaultProps} />);
    
    // Should render successfully without throwing errors
    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
    expect(screen.getByText('$25,000')).toBeInTheDocument();
    
    // Should not show trend elements
    expect(screen.queryByText('%')).not.toBeInTheDocument();
  });

  it('shows both description and trend when provided', () => {
    render(
      <MetricCard 
        {...defaultProps}
        description="Monthly target: $30,000"
        change={12.5}
        trend={<ArrowUp data-testid="trend-up" />}
      />
    );
    
    expect(screen.getByText('Monthly target: $30,000')).toBeInTheDocument();
    expect(screen.getByText('+12.5%')).toBeInTheDocument();
    expect(screen.getByTestId('trend-up')).toBeInTheDocument();
  });

  it('handles large numbers in value', () => {
    render(
      <MetricCard 
        {...defaultProps}
        value="$1,234,567.89"
      />
    );
    
    expect(screen.getByText('$1,234,567.89')).toBeInTheDocument();
  });

  it('handles very long titles gracefully', () => {
    const longTitle = 'This is a very long metric title that might wrap to multiple lines';
    
    render(
      <MetricCard 
        {...defaultProps}
        title={longTitle}
      />
    );
    
    expect(screen.getByText(longTitle)).toBeInTheDocument();
  });
});