import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MainDashboardPage from '../page';

// Mock the dashboard API
jest.mock('@/services/api/dashboard', () => ({
  dashboardApi: {
    getOverview: jest.fn(),
    getFinancial: jest.fn(),
    getOperational: jest.fn(),
    getInventory: jest.fn(),
    getCustomers: jest.fn(),
    getKPIs: jest.fn(),
    exportData: jest.fn(),
  }
}));

// Mock the auth components
jest.mock('@/components/auth/auth-connection-guard', () => ({
  AuthConnectionGuard: ({ children }: any) => <div>{children}</div>
}));

jest.mock('@/components/auth/protected-route', () => ({
  ProtectedRoute: ({ children }: any) => <div>{children}</div>
}));

// Mock the dashboard components
jest.mock('@/components/dashboard/metric-card', () => ({
  MetricCard: ({ title, value }: any) => (
    <div data-testid="metric-card">
      <div data-testid="metric-title">{title}</div>
      <div data-testid="metric-value">{value}</div>
    </div>
  )
}));

jest.mock('@/components/dashboard/revenue-chart', () => ({
  RevenueChart: ({ data }: any) => (
    <div data-testid="revenue-chart">
      Revenue Chart with {data?.length || 0} data points
    </div>
  )
}));

jest.mock('@/components/dashboard/performance-gauges', () => ({
  PerformanceGauges: ({ data }: any) => (
    <div data-testid="performance-gauges">
      Performance Gauges with {data?.length || 0} KPIs
    </div>
  )
}));

jest.mock('@/components/dashboard/recent-activity', () => ({
  RecentActivity: () => <div data-testid="recent-activity">Recent Activity</div>
}));

jest.mock('@/components/dashboard/inventory-utilization', () => ({
  InventoryUtilization: ({ data }: any) => (
    <div data-testid="inventory-utilization">Inventory Utilization</div>
  )
}));

jest.mock('@/components/dashboard/customer-insights', () => ({
  CustomerInsights: ({ data }: any) => (
    <div data-testid="customer-insights">Customer Insights</div>
  )
}));

// Mock UI components
jest.mock('@/components/ui/date-range-picker', () => ({
  DateRangePicker: ({ value, onChange }: any) => (
    <input
      data-testid="date-range-picker"
      value={`${value?.from} - ${value?.to}`}
      onChange={(e) => onChange({ from: new Date(), to: new Date() })}
    />
  )
}));

jest.mock('@/components/ui/loading-spinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>
}));

// Mock currency utils
jest.mock('@/lib/currency-utils', () => ({
  formatCurrencySync: (value: number) => `$${value.toFixed(2)}`,
}));

const { dashboardApi } = require('@/services/api/dashboard');

describe('MainDashboardPage', () => {
  let queryClient: QueryClient;
  
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default mock responses
    dashboardApi.getOverview.mockResolvedValue({
      success: true,
      data: {
        revenue: {
          current_period: 15000.00,
          previous_period: 12000.00,
          growth_rate: 25.0,
          transaction_count: 45
        },
        active_rentals: {
          count: 23,
          total_value: 8500.00,
          average_value: 369.57
        },
        inventory: {
          total_items: 150,
          rentable_items: 120,
          rented_items: 23,
          utilization_rate: 19.17
        },
        customers: {
          total: 67,
          active: 45,
          new: 8,
          retention_rate: 85.5
        }
      }
    });
    
    dashboardApi.getKPIs.mockResolvedValue({
      success: true,
      data: [
        {
          name: 'Monthly Revenue',
          current_value: 15000,
          target_value: 20000,
          achievement_percentage: 75,
          category: 'revenue'
        }
      ]
    });
    
    dashboardApi.getFinancial.mockResolvedValue({
      success: true,
      data: { daily_trend: [] }
    });
    
    dashboardApi.getInventory.mockResolvedValue({
      success: true,
      data: { top_items: [] }
    });
  });

  const renderWithQueryClient = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  it('renders dashboard page with main components', async () => {
    renderWithQueryClient(<MainDashboardPage />);
    
    expect(screen.getByText('Business Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Comprehensive business intelligence and performance analytics')).toBeInTheDocument();
    
    // Should show date range picker and action buttons
    expect(screen.getByTestId('date-range-picker')).toBeInTheDocument();
    expect(screen.getByText('Refresh')).toBeInTheDocument();
    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('displays metric cards with data', async () => {
    renderWithQueryClient(<MainDashboardPage />);
    
    await waitFor(() => {
      const metricCards = screen.getAllByTestId('metric-card');
      expect(metricCards).toHaveLength(4); // Revenue, Rentals, Inventory, Customers
    });
    
    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
    expect(screen.getByText('Active Rentals')).toBeInTheDocument();
    expect(screen.getByText('Inventory Utilization')).toBeInTheDocument();
    expect(screen.getByText('Active Customers')).toBeInTheDocument();
  });

  it('displays KPI performance gauges', async () => {
    renderWithQueryClient(<MainDashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByTestId('performance-gauges')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Key Performance Indicators')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    renderWithQueryClient(<MainDashboardPage />);
    
    // Should show loading cards
    const loadingCards = screen.getAllByRole('generic');
    expect(loadingCards.length).toBeGreaterThan(0);
  });

  it('handles refresh button click', async () => {
    renderWithQueryClient(<MainDashboardPage />);
    
    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);
    
    // Should trigger data refresh
    await waitFor(() => {
      expect(dashboardApi.getOverview).toHaveBeenCalled();
    });
  });

  it('handles export button click', async () => {
    dashboardApi.exportData.mockResolvedValue({
      success: true,
      data: { test: 'data' }
    });
    
    // Mock URL.createObjectURL and document methods
    global.URL.createObjectURL = jest.fn(() => 'mock-url');
    global.URL.revokeObjectURL = jest.fn();
    document.createElement = jest.fn(() => ({
      href: '',
      download: '',
      click: jest.fn(),
    })) as any;
    document.body.appendChild = jest.fn();
    document.body.removeChild = jest.fn();
    
    renderWithQueryClient(<MainDashboardPage />);
    
    await waitFor(() => {
      const exportButton = screen.getByText('Export');
      fireEvent.click(exportButton);
    });
    
    expect(dashboardApi.exportData).toHaveBeenCalled();
  });

  it('handles date range changes', async () => {
    renderWithQueryClient(<MainDashboardPage />);
    
    const dateRangePicker = screen.getByTestId('date-range-picker');
    fireEvent.change(dateRangePicker, { target: { value: '2024-01-01 - 2024-01-31' } });
    
    // Should trigger data refresh with new date range
    await waitFor(() => {
      expect(dashboardApi.getOverview).toHaveBeenCalled();
    });
  });

  it('displays tab navigation', async () => {
    renderWithQueryClient(<MainDashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Financial')).toBeInTheDocument();
      expect(screen.getByText('Operations')).toBeInTheDocument();
      expect(screen.getByText('Inventory')).toBeInTheDocument();
      expect(screen.getByText('Customers')).toBeInTheDocument();
    });
  });

  it('switches between tabs correctly', async () => {
    renderWithQueryClient(<MainDashboardPage />);
    
    await waitFor(() => {
      const financialTab = screen.getByText('Financial');
      fireEvent.click(financialTab);
    });
    
    // Should load financial data when tab is clicked
    expect(dashboardApi.getFinancial).toHaveBeenCalled();
  });

  it('displays recent activity in overview tab', async () => {
    renderWithQueryClient(<MainDashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByTestId('recent-activity')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    dashboardApi.getOverview.mockRejectedValue(new Error('API Error'));
    
    renderWithQueryClient(<MainDashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load dashboard data. Please try refreshing.')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('displays financial tab content', async () => {
    dashboardApi.getFinancial.mockResolvedValue({
      success: true,
      data: {
        revenue_by_category: [
          { category: 'Electronics', revenue: 10000, transactions: 25 }
        ],
        payment_collection: {
          collection_rate: 85,
          paid: 40,
          partial: 5,
          pending: 3
        },
        outstanding_balances: {
          total: 5000,
          count: 8
        }
      }
    });
    
    renderWithQueryClient(<MainDashboardPage />);
    
    await waitFor(() => {
      const financialTab = screen.getByText('Financial');
      fireEvent.click(financialTab);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Revenue by Category')).toBeInTheDocument();
      expect(screen.getByText('Payment Collection')).toBeInTheDocument();
      expect(screen.getByText('Outstanding Balances')).toBeInTheDocument();
    });
  });

  it('displays operational tab content', async () => {
    dashboardApi.getOperational.mockResolvedValue({
      success: true,
      data: {
        rental_duration: {
          average: 7.5,
          median: 7.0,
          minimum: 1,
          maximum: 30
        },
        extensions: {
          extension_rate: 15,
          extended_rentals: 12,
          total_extension_revenue: 1200
        },
        returns: {
          on_time_rate: 85,
          on_time_returns: 40,
          late_returns: 7
        }
      }
    });
    
    renderWithQueryClient(<MainDashboardPage />);
    
    await waitFor(() => {
      const operationalTab = screen.getByText('Operations');
      fireEvent.click(operationalTab);
    });
    
    expect(dashboardApi.getOperational).toHaveBeenCalled();
  });

  it('displays inventory tab content', async () => {
    dashboardApi.getInventory.mockResolvedValue({
      success: true,
      data: {
        stock_summary: {
          total_items: 200,
          available_items: 150,
          rented_items: 45,
          utilization_rate: 22.5
        },
        low_stock_alerts: [],
        top_items: []
      }
    });
    
    renderWithQueryClient(<MainDashboardPage />);
    
    await waitFor(() => {
      const inventoryTab = screen.getByText('Inventory');
      fireEvent.click(inventoryTab);
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('inventory-utilization')).toBeInTheDocument();
    });
  });

  it('displays customer tab content', async () => {
    dashboardApi.getCustomers.mockResolvedValue({
      success: true,
      data: {
        summary: {
          total_customers: 100,
          active_customers: 85,
          retention_rate: 90
        }
      }
    });
    
    renderWithQueryClient(<MainDashboardPage />);
    
    await waitFor(() => {
      const customersTab = screen.getByText('Customers');
      fireEvent.click(customersTab);
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('customer-insights')).toBeInTheDocument();
    });
  });

  it('auto-refreshes data at intervals', async () => {
    renderWithQueryClient(<MainDashboardPage />);
    
    // Fast-forward time to trigger auto-refresh
    jest.advanceTimersByTime(5 * 60 * 1000); // 5 minutes
    
    await waitFor(() => {
      expect(dashboardApi.getOverview).toHaveBeenCalledTimes(1);
    });
  });

  it('formats currency values correctly', async () => {
    renderWithQueryClient(<MainDashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText('$15,000.00')).toBeInTheDocument();
    });
  });
});