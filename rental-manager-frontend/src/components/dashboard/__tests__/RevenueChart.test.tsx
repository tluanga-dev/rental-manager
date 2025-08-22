import React from 'react';
import { render, screen } from '@testing-library/react';
import { RevenueChart } from '../revenue-chart';

// Mock Recharts components
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  Area: () => <div data-testid="area" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
}));

// Mock currency utils
jest.mock('@/lib/currency-utils', () => ({
  formatCurrencySync: (value: number) => `$${value.toFixed(2)}`,
}));

describe('RevenueChart', () => {
  const mockData = [
    {
      date: '2024-01-01',
      revenue: 1200.50,
      transactions: 5,
    },
    {
      date: '2024-01-02',
      revenue: 1800.75,
      transactions: 8,
    },
    {
      date: '2024-01-03',
      revenue: 950.25,
      transactions: 3,
    },
  ];

  it('renders area chart by default', () => {
    render(<RevenueChart data={mockData} />);
    
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    expect(screen.getByTestId('area')).toBeInTheDocument();
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
  });

  it('renders line chart when showArea is false', () => {
    render(<RevenueChart data={mockData} showArea={false} />);
    
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('line')).toBeInTheDocument();
    expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument();
  });

  it('renders chart axes and grid', () => {
    render(<RevenueChart data={mockData} />);
    
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
  });

  it('shows no data message when data is empty', () => {
    render(<RevenueChart data={[]} />);
    
    expect(screen.getByText('No revenue data available')).toBeInTheDocument();
    expect(screen.getByText('📊')).toBeInTheDocument();
    expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
  });

  it('shows no data message when data is undefined', () => {
    render(<RevenueChart data={undefined as any} />);
    
    expect(screen.getByText('No revenue data available')).toBeInTheDocument();
  });

  it('applies custom height', () => {
    const { container } = render(<RevenueChart data={mockData} height={400} />);
    
    // ResponsiveContainer should receive the height prop
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('applies custom color', () => {
    render(<RevenueChart data={mockData} color="#FF5733" />);
    
    // Chart should render with custom color (tested through presence of chart elements)
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
  });

  it('handles single data point', () => {
    const singleDataPoint = [
      {
        date: '2024-01-01',
        revenue: 1000.00,
        transactions: 5,
      },
    ];

    render(<RevenueChart data={singleDataPoint} />);
    
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    expect(screen.queryByText('No revenue data available')).not.toBeInTheDocument();
  });

  it('handles zero revenue values', () => {
    const zeroRevenueData = [
      {
        date: '2024-01-01',
        revenue: 0,
        transactions: 0,
      },
      {
        date: '2024-01-02',
        revenue: 0,
        transactions: 0,
      },
    ];

    render(<RevenueChart data={zeroRevenueData} />);
    
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    expect(screen.queryByText('No revenue data available')).not.toBeInTheDocument();
  });

  it('handles large revenue numbers', () => {
    const largeNumberData = [
      {
        date: '2024-01-01',
        revenue: 1234567.89,
        transactions: 100,
      },
    ];

    render(<RevenueChart data={largeNumberData} />);
    
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
  });

  it('formats dates correctly in data processing', () => {
    // Test that the component processes dates without crashing
    const dateVariationData = [
      {
        date: '2024-01-01T00:00:00Z',
        revenue: 1000,
        transactions: 5,
      },
      {
        date: '2024-12-31',
        revenue: 2000,
        transactions: 10,
      },
    ];

    render(<RevenueChart data={dateVariationData} />);
    
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
  });

  it('renders with default props when minimal props provided', () => {
    render(<RevenueChart data={mockData} />);
    
    // Should use default height of 300
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    
    // Should use default showArea of true
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    
    // Should use default color
    expect(screen.getByTestId('area')).toBeInTheDocument();
  });
});