/**
 * Integration tests for Rental Pricing components
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PricingInfoCard } from '@/components/inventory/inventory-item-detail/PricingInfoCard';
import { RentalCalculator } from '@/components/rental-pricing/RentalCalculator';
import { PricingManagementModal } from '@/components/rental-pricing/PricingManagementModal';
import { rentalPricingApi } from '@/services/api/rental-pricing';
import { formatCurrencySync } from '@/lib/currency-utils';

// Mock the API service
jest.mock('@/services/api/rental-pricing');
jest.mock('@/services/api/inventory-items');

const mockItem = {
  item_id: 'test-123',
  item_name: 'Test Item',
  sku: 'TEST001',
  is_rentable: true,
  rental_rate: 50,
  stock_summary: {
    total: 10,
    available: 8,
    reserved: 2,
    rented: 0,
    in_maintenance: 0,
    damaged: 0,
    stock_status: 'IN_STOCK'
  }
};

const mockPricingSummary = {
  item_id: 'test-123',
  daily_rate_range: [35, 50],
  has_tiered_pricing: true,
  default_tier: {
    id: 'tier-1',
    tier_name: 'Daily Rate',
    period_days: 1,
    rate_per_period: 50,
    is_default: true,
    is_active: true
  },
  available_tiers: [
    {
      id: 'tier-1',
      tier_name: 'Daily Rate',
      period_days: 1,
      rate_per_period: 50,
      is_default: true,
      is_active: true
    },
    {
      id: 'tier-2',
      tier_name: 'Weekly Rate',
      period_days: 7,
      rate_per_period: 315,
      is_default: false,
      is_active: true
    },
    {
      id: 'tier-3',
      tier_name: 'Monthly Rate',
      period_days: 30,
      rate_per_period: 1050,
      is_default: false,
      is_active: true
    }
  ]
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('PricingInfoCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays pricing summary when available', async () => {
    (rentalPricingApi.getItemPricingSummary as jest.Mock).mockResolvedValue(mockPricingSummary);

    render(
      <PricingInfoCard item={mockItem} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Daily Rate Range:')).toBeInTheDocument();
      expect(screen.getByText(/\$35\.00 - \$50\.00\/day/)).toBeInTheDocument();
    });

    // Check if tiers are displayed
    expect(screen.getByText('Daily Rate')).toBeInTheDocument();
    expect(screen.getByText('Weekly Rate')).toBeInTheDocument();
    expect(screen.getByText('Monthly Rate')).toBeInTheDocument();
  });

  it('shows no pricing message when item has no pricing', async () => {
    (rentalPricingApi.getItemPricingSummary as jest.Mock).mockResolvedValue(null);

    const itemWithoutRate = { ...mockItem, rental_rate: undefined };
    
    render(
      <PricingInfoCard item={itemWithoutRate} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('No rental pricing configured for this item.')).toBeInTheDocument();
    });
  });

  it('calculates rental cost when calculator is used', async () => {
    (rentalPricingApi.getItemPricingSummary as jest.Mock).mockResolvedValue(mockPricingSummary);
    (rentalPricingApi.calculatePricing as jest.Mock).mockResolvedValue({
      item_id: 'test-123',
      rental_days: 10,
      total_cost: 450,
      daily_equivalent_rate: 45,
      recommended_tier: mockPricingSummary.available_tiers[1],
      savings_compared_to_daily: 50
    });

    render(
      <PricingInfoCard item={mockItem} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Quick Calculator')).toBeInTheDocument();
    });

    // Enter rental days
    const input = screen.getByPlaceholderText('Enter rental days');
    fireEvent.change(input, { target: { value: '10' } });

    // Click calculate
    const calculateButton = screen.getByText('Calculate');
    fireEvent.click(calculateButton);

    await waitFor(() => {
      expect(screen.getByText('Total Cost:')).toBeInTheDocument();
      expect(screen.getByText('$450.00')).toBeInTheDocument();
      expect(screen.getByText(/Save \$50\.00 vs daily rate/)).toBeInTheDocument();
    });
  });
});

describe('RentalCalculator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows item selection and calculation', async () => {
    const mockRentableItems = [
      mockItem,
      { ...mockItem, item_id: 'test-456', item_name: 'Another Item', sku: 'TEST002' }
    ];

    const { inventoryItemsApi } = require('@/services/api/inventory-items');
    inventoryItemsApi.getItems.mockResolvedValue(mockRentableItems);
    
    (rentalPricingApi.calculatePricing as jest.Mock).mockResolvedValue({
      item_id: 'test-123',
      rental_days: 7,
      total_cost: 315,
      daily_equivalent_rate: 45,
      recommended_tier: { tier_name: 'Weekly Rate' }
    });

    render(
      <RentalCalculator />,
      { wrapper: createWrapper() }
    );

    // Search for items
    const searchInput = screen.getByPlaceholderText('Search for items...');
    fireEvent.change(searchInput, { target: { value: 'Test' } });

    await waitFor(() => {
      expect(screen.getByText('Test Item')).toBeInTheDocument();
    });

    // Select an item
    fireEvent.click(screen.getByText('Test Item'));

    // Enter rental days
    const daysInput = screen.getByLabelText('Rental Duration (days)');
    fireEvent.change(daysInput, { target: { value: '7' } });

    // Calculate
    const calculateButton = screen.getByText(/Calculate Cost/);
    fireEvent.click(calculateButton);

    await waitFor(() => {
      expect(screen.getByText('Pricing Breakdown')).toBeInTheDocument();
      expect(screen.getByText('$315.00')).toBeInTheDocument();
      expect(screen.getByText('Weekly Rate')).toBeInTheDocument();
    });
  });

  it('calculates duration from date range', async () => {
    render(
      <RentalCalculator />,
      { wrapper: createWrapper() }
    );

    const startDate = screen.getByLabelText('Start Date');
    const endDate = screen.getByLabelText('End Date');

    // Set dates (7 days apart)
    fireEvent.change(startDate, { target: { value: '2024-01-01' } });
    fireEvent.change(endDate, { target: { value: '2024-01-07' } });

    // Check if duration was calculated
    const durationInput = screen.getByLabelText('Rental Duration (days)') as HTMLInputElement;
    expect(durationInput.value).toBe('7');
  });

  it('handles quantity multiplication', async () => {
    const { inventoryItemsApi } = require('@/services/api/inventory-items');
    inventoryItemsApi.getItems.mockResolvedValue([mockItem]);
    
    (rentalPricingApi.calculatePricing as jest.Mock).mockResolvedValue({
      item_id: 'test-123',
      rental_days: 3,
      total_cost: 150,
      daily_equivalent_rate: 50
    });

    render(
      <RentalCalculator />,
      { wrapper: createWrapper() }
    );

    // Select item
    const searchInput = screen.getByPlaceholderText('Search for items...');
    fireEvent.change(searchInput, { target: { value: 'Test' } });
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('Test Item'));
    });

    // Set quantity
    const quantityInput = screen.getByLabelText('Quantity');
    fireEvent.change(quantityInput, { target: { value: '3' } });

    // Set days
    const daysInput = screen.getByLabelText('Rental Duration (days)');
    fireEvent.change(daysInput, { target: { value: '3' } });

    // Calculate
    fireEvent.click(screen.getByText(/Calculate Cost/));

    await waitFor(() => {
      expect(screen.getByText('×3')).toBeInTheDocument();
      expect(screen.getByText('$450.00')).toBeInTheDocument(); // 150 * 3
    });
  });
});

describe('PricingManagementModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays existing pricing tiers', async () => {
    (rentalPricingApi.getItemPricingTiers as jest.Mock).mockResolvedValue(
      mockPricingSummary.available_tiers
    );

    render(
      <PricingManagementModal
        isOpen={true}
        onClose={() => {}}
        itemId="test-123"
        itemName="Test Item"
      />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Manage Rental Pricing')).toBeInTheDocument();
      expect(screen.getByText('Daily Rate')).toBeInTheDocument();
      expect(screen.getByText('Weekly Rate')).toBeInTheDocument();
      expect(screen.getByText('Monthly Rate')).toBeInTheDocument();
    });
  });

  it('creates standard pricing template', async () => {
    (rentalPricingApi.getItemPricingTiers as jest.Mock).mockResolvedValue([]);
    (rentalPricingApi.createStandardPricing as jest.Mock).mockResolvedValue({
      success: true,
      created_tiers: mockPricingSummary.available_tiers
    });

    render(
      <PricingManagementModal
        isOpen={true}
        onClose={() => {}}
        itemId="test-123"
        itemName="Test Item"
        currentDailyRate={50}
      />,
      { wrapper: createWrapper() }
    );

    // Switch to standard template tab
    fireEvent.click(screen.getByText('Standard Template'));

    // Fill in form
    const dailyRateInput = screen.getByLabelText('Daily Rate');
    expect((dailyRateInput as HTMLInputElement).value).toBe('50');

    const weeklyDiscountInput = screen.getByLabelText('Weekly Discount (%)');
    fireEvent.change(weeklyDiscountInput, { target: { value: '15' } });

    const monthlyDiscountInput = screen.getByLabelText('Monthly Discount (%)');
    fireEvent.change(monthlyDiscountInput, { target: { value: '30' } });

    // Submit
    fireEvent.click(screen.getByText('Create Standard Pricing'));

    await waitFor(() => {
      expect(rentalPricingApi.createStandardPricing).toHaveBeenCalledWith(
        'test-123',
        {
          daily_rate: 50,
          weekly_discount_percentage: 15,
          monthly_discount_percentage: 30
        }
      );
    });
  });

  it('creates custom pricing tier', async () => {
    (rentalPricingApi.getItemPricingTiers as jest.Mock).mockResolvedValue([]);
    (rentalPricingApi.createPricingTier as jest.Mock).mockResolvedValue({
      id: 'new-tier',
      tier_name: 'Weekend Special',
      period_days: 1,
      rate_per_period: 40
    });

    render(
      <PricingManagementModal
        isOpen={true}
        onClose={() => {}}
        itemId="test-123"
        itemName="Test Item"
      />,
      { wrapper: createWrapper() }
    );

    // Switch to custom tier tab
    fireEvent.click(screen.getByText('Custom Tier'));

    // Fill in form
    fireEvent.change(screen.getByLabelText('Tier Name'), {
      target: { value: 'Weekend Special' }
    });
    
    fireEvent.change(screen.getByLabelText('Rate per Period'), {
      target: { value: '40' }
    });
    
    fireEvent.change(screen.getByLabelText('Min Rental Days (optional)'), {
      target: { value: '2' }
    });
    
    fireEvent.change(screen.getByLabelText('Max Rental Days (optional)'), {
      target: { value: '3' }
    });

    // Submit
    fireEvent.click(screen.getByText('Create Custom Tier'));

    await waitFor(() => {
      expect(rentalPricingApi.createPricingTier).toHaveBeenCalledWith(
        expect.objectContaining({
          item_id: 'test-123',
          tier_name: 'Weekend Special',
          rate_per_period: 40,
          min_rental_days: 2,
          max_rental_days: 3
        })
      );
    });
  });

  it('allows editing existing pricing tier', async () => {
    (rentalPricingApi.getItemPricingTiers as jest.Mock).mockResolvedValue(
      mockPricingSummary.available_tiers
    );
    (rentalPricingApi.updatePricingTier as jest.Mock).mockResolvedValue({
      ...mockPricingSummary.available_tiers[0],
      rate_per_period: 55
    });

    render(
      <PricingManagementModal
        isOpen={true}
        onClose={() => {}}
        itemId="test-123"
        itemName="Test Item"
      />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Daily Rate')).toBeInTheDocument();
    });

    // Click edit button
    const editButtons = screen.getAllByRole('button', { name: '' });
    const editButton = editButtons.find(btn => btn.querySelector('.lucide-edit2'));
    if (editButton) fireEvent.click(editButton);

    // Modify rate
    const rateInput = screen.getByDisplayValue('50');
    fireEvent.change(rateInput, { target: { value: '55' } });

    // Save
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(rentalPricingApi.updatePricingTier).toHaveBeenCalledWith(
        'tier-1',
        expect.objectContaining({
          rate_per_period: 55
        })
      );
    });
  });
});