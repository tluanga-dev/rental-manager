// Unit tests for MixedConditionReturnForm component
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import MixedConditionReturnForm from '../MixedConditionReturnForm';
import { ReturnItemStateEnhanced, DamageDetail } from '../../../types/rental-return-enhanced';

// Mock data
const mockItem: ReturnItemStateEnhanced = {
  item: {
    id: '123',
    line_number: 1,
    item_id: 'item-1',
    item_name: 'Test Laptop',
    sku: 'LAP-001',
    description: 'High-end laptop',
    quantity: 5,
    unit_price: 50,
    line_total: 250,
    discount_amount: 0,
    rental_period: 7,
    rental_period_unit: 'days',
    rental_start_date: '2024-01-01',
    rental_end_date: '2024-01-08',
    current_rental_status: 'RENTAL_INPROGRESS',
    notes: ''
  },
  selected: true,
  total_return_quantity: 5,
  quantity_good: 5,
  quantity_damaged: 0,
  quantity_beyond_repair: 0,
  quantity_lost: 0,
  damage_details: [],
  return_action: 'COMPLETE_RETURN',
  condition_notes: '',
  damage_notes: '',
  damage_penalty: 0,
  showDamageDetails: false
};

describe('MixedConditionReturnForm', () => {
  let mockOnUpdate: jest.Mock;

  beforeEach(() => {
    mockOnUpdate = jest.fn();
  });

  it('renders item information correctly', () => {
    render(
      <MixedConditionReturnForm
        item={mockItem}
        onUpdate={mockOnUpdate}
        isProcessing={false}
      />
    );

    expect(screen.getByText('Test Laptop')).toBeInTheDocument();
    expect(screen.getByText('SKU: LAP-001')).toBeInTheDocument();
    expect(screen.getByText('Rented: 5 | Returning: 5')).toBeInTheDocument();
  });

  it('expands and shows condition breakdown when clicked', async () => {
    render(
      <MixedConditionReturnForm
        item={mockItem}
        onUpdate={mockOnUpdate}
        isProcessing={false}
      />
    );

    // Initially condition breakdown should not be visible
    expect(screen.queryByLabelText('Good Condition')).not.toBeInTheDocument();

    // Click expand button
    const expandButton = screen.getByRole('button', { name: /chevron/i });
    fireEvent.click(expandButton);

    // Now condition breakdown should be visible
    await waitFor(() => {
      expect(screen.getByLabelText('Good Condition')).toBeInTheDocument();
      expect(screen.getByLabelText('Damaged (Repairable)')).toBeInTheDocument();
      expect(screen.getByLabelText('Beyond Repair')).toBeInTheDocument();
      expect(screen.getByLabelText('Lost/Missing')).toBeInTheDocument();
    });
  });

  it('handles Return All button click', () => {
    render(
      <MixedConditionReturnForm
        item={{ ...mockItem, total_return_quantity: 3 }}
        onUpdate={mockOnUpdate}
        isProcessing={false}
      />
    );

    const returnAllButton = screen.getByText('Return All');
    fireEvent.click(returnAllButton);

    expect(mockOnUpdate).toHaveBeenCalledWith({
      total_return_quantity: 5
    });
  });

  it('validates quantity breakdown matches total', async () => {
    const itemWithMismatch = {
      ...mockItem,
      total_return_quantity: 5,
      quantity_good: 2,
      quantity_damaged: 1,
      quantity_beyond_repair: 0,
      quantity_lost: 0  // Total = 3, not 5
    };

    render(
      <MixedConditionReturnForm
        item={itemWithMismatch}
        onUpdate={mockOnUpdate}
        isProcessing={false}
      />
    );

    // Expand to see validation error
    const expandButton = screen.getByRole('button', { name: /chevron/i });
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText(/Total breakdown.*doesn't match return quantity/)).toBeInTheDocument();
    });
  });

  it('shows damage form when Report Damage is clicked', async () => {
    render(
      <MixedConditionReturnForm
        item={mockItem}
        onUpdate={mockOnUpdate}
        isProcessing={false}
      />
    );

    // Click Report Damage button
    const reportDamageButton = screen.getByText('Report Damage');
    fireEvent.click(reportDamageButton);

    // Expand form to see damage details
    const expandButton = screen.getByRole('button', { name: /chevron/i });
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText('Damage Details')).toBeInTheDocument();
      expect(screen.getByText('Add Detail')).toBeInTheDocument();
    });
  });

  it('adds and removes damage details', async () => {
    render(
      <MixedConditionReturnForm
        item={mockItem}
        onUpdate={mockOnUpdate}
        isProcessing={false}
      />
    );

    // Expand and show damage form
    const expandButton = screen.getByRole('button', { name: /chevron/i });
    fireEvent.click(expandButton);
    
    const reportDamageButton = screen.getByText('Report Damage');
    fireEvent.click(reportDamageButton);

    // Add damage detail
    const addDetailButton = screen.getByText('Add Detail');
    fireEvent.click(addDetailButton);

    expect(mockOnUpdate).toHaveBeenCalledWith({
      damage_details: expect.arrayContaining([
        expect.objectContaining({
          quantity: 1,
          damage_type: 'PHYSICAL',
          damage_severity: 'MODERATE'
        })
      ])
    });
  });

  it('updates quantity fields correctly', async () => {
    render(
      <MixedConditionReturnForm
        item={mockItem}
        onUpdate={mockOnUpdate}
        isProcessing={false}
      />
    );

    // Expand form
    const expandButton = screen.getByRole('button', { name: /chevron/i });
    fireEvent.click(expandButton);

    // Find and update damaged quantity input
    const damagedInput = screen.getByLabelText('Damaged (Repairable)');
    await userEvent.clear(damagedInput);
    await userEvent.type(damagedInput, '2');

    // Check that update was called with correct values
    expect(mockOnUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity_damaged: 2,
        total_return_quantity: expect.any(Number)
      })
    );
  });

  it('displays mixed condition summary correctly', () => {
    const mixedItem = {
      ...mockItem,
      quantity_good: 2,
      quantity_damaged: 1,
      quantity_beyond_repair: 1,
      quantity_lost: 1
    };

    render(
      <MixedConditionReturnForm
        item={mixedItem}
        onUpdate={mockOnUpdate}
        isProcessing={false}
      />
    );

    expect(screen.getByText('✓ 2 Good')).toBeInTheDocument();
    expect(screen.getByText('⚠ 1 Damaged')).toBeInTheDocument();
    expect(screen.getByText('✗ 1 Beyond Repair')).toBeInTheDocument();
    expect(screen.getByText('? 1 Lost')).toBeInTheDocument();
  });

  it('disables inputs when processing', () => {
    render(
      <MixedConditionReturnForm
        item={mockItem}
        onUpdate={mockOnUpdate}
        isProcessing={true}
      />
    );

    const returnAllButton = screen.getByText('Return All');
    expect(returnAllButton).toBeDisabled();

    const reportDamageButton = screen.getByText('Report Damage');
    expect(reportDamageButton).toBeDisabled();
  });

  it('handles damage severity selection', async () => {
    const itemWithDamage: ReturnItemStateEnhanced = {
      ...mockItem,
      damage_details: [{
        quantity: 1,
        damage_type: 'PHYSICAL',
        damage_severity: 'MINOR',
        description: 'Small scratch',
        estimated_repair_cost: 50
      }]
    };

    render(
      <MixedConditionReturnForm
        item={itemWithDamage}
        onUpdate={mockOnUpdate}
        isProcessing={false}
      />
    );

    // Expand form
    const expandButton = screen.getByRole('button', { name: /chevron/i });
    fireEvent.click(expandButton);

    // Should show damage details section
    await waitFor(() => {
      expect(screen.getByText('Damage Details')).toBeInTheDocument();
      expect(screen.getByDisplayValue('PHYSICAL')).toBeInTheDocument();
      expect(screen.getByDisplayValue('MINOR')).toBeInTheDocument();
    });

    // Change severity
    const severitySelect = screen.getByDisplayValue('MINOR');
    fireEvent.change(severitySelect, { target: { value: 'SEVERE' } });

    expect(mockOnUpdate).toHaveBeenCalledWith({
      damage_details: expect.arrayContaining([
        expect.objectContaining({
          damage_severity: 'SEVERE'
        })
      ])
    });
  });

  it('calculates and displays damage penalty', async () => {
    const itemWithPenalty = {
      ...mockItem,
      quantity_damaged: 1,
      damage_penalty: 150.50
    };

    render(
      <MixedConditionReturnForm
        item={itemWithPenalty}
        onUpdate={mockOnUpdate}
        isProcessing={false}
      />
    );

    // Expand form
    const expandButton = screen.getByRole('button', { name: /chevron/i });
    fireEvent.click(expandButton);

    // Check penalty input shows correct value
    const penaltyInput = screen.getByLabelText('Total Damage Penalty');
    expect(penaltyInput).toHaveValue(150.5);
  });
});