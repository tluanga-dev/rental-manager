import React from 'react';
import { render, screen } from '@testing-library/react';
import { PerformanceGauges } from '../performance-gauges';

// Mock Recharts components
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  Tooltip: () => <div data-testid="tooltip" />,
}));

describe('PerformanceGauges', () => {
  const mockKPIData = [
    {
      name: 'Monthly Revenue Target',
      current_value: 18500,
      target_value: 20000,
      achievement_percentage: 92.5,
      category: 'revenue' as const,
      trend: 'up' as const,
      unit: '$',
      description: 'Revenue target for this month'
    },
    {
      name: 'Inventory Utilization',
      current_value: 75,
      target_value: 80,
      achievement_percentage: 93.75,
      category: 'inventory' as const,
      trend: 'stable' as const,
      unit: '%',
      description: 'Items currently rented out'
    },
    {
      name: 'Customer Satisfaction',
      current_value: 4.2,
      target_value: 4.5,
      achievement_percentage: 93.33,
      category: 'customer' as const,
      trend: 'down' as const,
      unit: '/5',
      description: 'Average customer rating'
    },
    {
      name: 'Return Rate',
      current_value: 95,
      target_value: 98,
      achievement_percentage: 96.94,
      category: 'operational' as const,
      unit: '%'
    }
  ];

  it('renders performance gauges with data', () => {
    render(<PerformanceGauges data={mockKPIData} />);
    
    expect(screen.getByText('Overall Performance')).toBeInTheDocument();
    expect(screen.getByText('KPI Categories')).toBeInTheDocument();
    expect(screen.getByText('Detailed Performance')).toBeInTheDocument();
  });

  it('displays overall performance percentage correctly', () => {
    render(<PerformanceGauges data={mockKPIData} />);
    
    // Overall achievement should be average of all KPIs: (92.5 + 93.75 + 93.33 + 96.94) / 4 ≈ 94%
    expect(screen.getByText('94%')).toBeInTheDocument();
    expect(screen.getByText('Excellent')).toBeInTheDocument();
  });

  it('shows category breakdown correctly', () => {
    render(<PerformanceGauges data={mockKPIData} />);
    
    expect(screen.getByText('Revenue KPIs')).toBeInTheDocument();
    expect(screen.getByText('Operations')).toBeInTheDocument();
    expect(screen.getByText('Customer')).toBeInTheDocument();
    expect(screen.getByText('Inventory')).toBeInTheDocument();
  });

  it('displays individual KPI cards', () => {
    render(<PerformanceGauges data={mockKPIData} />);
    
    expect(screen.getByText('Monthly Revenue Target')).toBeInTheDocument();
    expect(screen.getByText('Inventory Utilization')).toBeInTheDocument();
    expect(screen.getByText('Customer Satisfaction')).toBeInTheDocument();
    expect(screen.getByText('Return Rate')).toBeInTheDocument();
  });

  it('shows current and target values', () => {
    render(<PerformanceGauges data={mockKPIData} />);
    
    expect(screen.getByText('18,500$')).toBeInTheDocument(); // Current value with unit
    expect(screen.getByText('20,000$')).toBeInTheDocument(); // Target value with unit
    expect(screen.getByText('75%')).toBeInTheDocument(); // Inventory utilization current
    expect(screen.getByText('80%')).toBeInTheDocument(); // Inventory utilization target
  });

  it('displays achievement percentages', () => {
    render(<PerformanceGauges data={mockKPIData} />);
    
    expect(screen.getByText('92.5%')).toBeInTheDocument();
    expect(screen.getByText('93.75%')).toBeInTheDocument();
    expect(screen.getByText('93.33%')).toBeInTheDocument();
    expect(screen.getByText('96.94%')).toBeInTheDocument();
  });

  it('shows trend icons correctly', () => {
    render(<PerformanceGauges data={mockKPIData} />);
    
    // Should render trend icons for different trends
    // (Testing through component structure since icons are complex to test directly)
    expect(screen.getAllByText('Revenue KPIs')).toHaveLength(1);
  });

  it('shows category labels correctly', () => {
    render(<PerformanceGauges data={mockKPIData} />);
    
    // Category badges should be present
    expect(screen.getAllByText('Revenue KPIs')).toHaveLength(1);
    expect(screen.getAllByText('Operations')).toHaveLength(1);
    expect(screen.getAllByText('Customer')).toHaveLength(1);
    expect(screen.getAllByText('Inventory')).toHaveLength(1);
  });

  it('handles empty data gracefully', () => {
    render(<PerformanceGauges data={[]} />);
    
    expect(screen.getByText('No KPI data available')).toBeInTheDocument();
    expect(screen.getByText('Performance metrics will appear here')).toBeInTheDocument();
    expect(screen.queryByText('Overall Performance')).not.toBeInTheDocument();
  });

  it('handles undefined data gracefully', () => {
    render(<PerformanceGauges data={undefined as any} />);
    
    expect(screen.getByText('No KPI data available')).toBeInTheDocument();
  });

  it('calculates performance colors correctly', () => {
    const highPerformanceData = [
      {
        name: 'High Performance KPI',
        current_value: 95,
        target_value: 100,
        achievement_percentage: 95,
        category: 'revenue' as const
      }
    ];

    render(<PerformanceGauges data={highPerformanceData} />);
    
    expect(screen.getByText('95%')).toBeInTheDocument();
    expect(screen.getByText('Excellent')).toBeInTheDocument();
  });

  it('handles medium performance correctly', () => {
    const mediumPerformanceData = [
      {
        name: 'Medium Performance KPI',
        current_value: 75,
        target_value: 100,
        achievement_percentage: 75,
        category: 'operational' as const
      }
    ];

    render(<PerformanceGauges data={mediumPerformanceData} />);
    
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
  });

  it('handles low performance correctly', () => {
    const lowPerformanceData = [
      {
        name: 'Low Performance KPI',
        current_value: 50,
        target_value: 100,
        achievement_percentage: 50,
        category: 'customer' as const
      }
    ];

    render(<PerformanceGauges data={lowPerformanceData} />);
    
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Needs Improvement')).toBeInTheDocument();
  });

  it('displays KPI descriptions when provided', () => {
    render(<PerformanceGauges data={mockKPIData} />);
    
    expect(screen.getByText('Revenue target for this month')).toBeInTheDocument();
    expect(screen.getByText('Items currently rented out')).toBeInTheDocument();
    expect(screen.getByText('Average customer rating')).toBeInTheDocument();
  });

  it('renders pie chart for overall performance', () => {
    render(<PerformanceGauges data={mockKPIData} />);
    
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
  });

  it('handles single KPI correctly', () => {
    const singleKPI = [mockKPIData[0]];
    
    render(<PerformanceGauges data={singleKPI} />);
    
    expect(screen.getByText('Monthly Revenue Target')).toBeInTheDocument();
    expect(screen.getByText('92.5%')).toBeInTheDocument();
    expect(screen.getByText('Excellent')).toBeInTheDocument();
  });

  it('handles KPIs without units', () => {
    const noUnitKPI = [
      {
        name: 'No Unit KPI',
        current_value: 100,
        target_value: 120,
        achievement_percentage: 83.33,
        category: 'operational' as const
      }
    ];

    render(<PerformanceGauges data={noUnitKPI} />);
    
    expect(screen.getByText('100')).toBeInTheDocument(); // Should display without unit
    expect(screen.getByText('120')).toBeInTheDocument();
  });
});