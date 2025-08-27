'use client';

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ItemForm } from './ItemForm';
import { itemsApi } from '@/services/api/items';
import { AxiosError } from 'axios';

// Mock the API
jest.mock('@/services/api/items');
const mockedItemsApi = itemsApi as jest.Mocked<typeof itemsApi>;

// Mock the hooks and stores
jest.mock('@/stores/app-store', () => ({
  useAppStore: () => ({
    addNotification: jest.fn(),
  }),
}));

jest.mock('@/hooks/useItemValidation', () => ({
  useItemValidation: () => ({
    isValidating: false,
    lastValidation: null,
    hasValidated: false,
    validateItemName: jest.fn(),
    validateItem: jest.fn(),
    clearValidation: jest.fn(),
    isItemNameValid: true,
    validationErrors: [],
    validationSuggestions: [],
    conflictData: null,
  }),
}));

// Mock the dropdown components
jest.mock('@/components/categories/CategoryDropdown', () => ({
  CategoryDropdown: ({ onChange, value }: any) => (
    <select 
      data-testid="category-dropdown"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select Category</option>
      <option value="cat1">Category 1</option>
    </select>
  ),
}));

jest.mock('@/components/brands/BrandDropdown', () => ({
  BrandDropdown: ({ onChange, value }: any) => (
    <select 
      data-testid="brand-dropdown"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select Brand</option>
      <option value="brand1">Brand 1</option>
    </select>
  ),
}));

jest.mock('@/components/units-of-measurement/UnitOfMeasurementDropdown', () => ({
  UnitOfMeasurementDropdown: ({ onChange, value }: any) => (
    <select 
      data-testid="unit-dropdown"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select Unit</option>
      <option value="unit1">Unit 1</option>
    </select>
  ),
}));

const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
};

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('ItemForm Error Handling', () => {
  const mockOnSubmit = jest.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Form Submission', () => {
    it('should handle successful item creation', async () => {
      mockOnSubmit.mockResolvedValueOnce({ success: true });
      
      renderWithQueryClient(
        <ItemForm
          onSubmit={mockOnSubmit}
          mode="create"
        />
      );

      // Fill in required fields
      await user.type(screen.getByTestId('item-name-input'), 'Test Item');
      await user.click(screen.getByTestId('is-rentable-checkbox'));
      
      // Submit form
      await user.click(screen.getByText('Save Item'));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });

    it('should handle 409 conflict error with proper dialog', async () => {
      const conflictError = new AxiosError(
        'Request failed with status code 409',
        'ERR_BAD_REQUEST',
        {},
        {},
        {
          status: 409,
          statusText: 'Conflict',
          data: {
            success: false,
            message: "Item with name 'Test Item' already exists",
            detail: "Item with name 'Test Item' already exists"
          },
          headers: {},
          config: {}
        }
      );
      
      mockOnSubmit.mockRejectedValueOnce(conflictError);
      
      renderWithQueryClient(
        <ItemForm
          onSubmit={mockOnSubmit}
          mode="create"
        />
      );

      // Fill in required fields
      await user.type(screen.getByTestId('item-name-input'), 'Test Item');
      await user.click(screen.getByTestId('is-rentable-checkbox'));
      
      // Submit form
      await user.click(screen.getByText('Save Item'));

      // Wait for error dialog to appear
      await waitFor(() => {
        expect(screen.getByText('Item Already Exists')).toBeInTheDocument();
      });
      
      // Check if suggested alternatives are shown
      expect(screen.getByText('Suggested Alternative Names:')).toBeInTheDocument();
      expect(screen.getByText('Try Different Name')).toBeInTheDocument();
      expect(screen.getByText('View Existing Item')).toBeInTheDocument();
    });

    it('should handle validation errors properly', async () => {
      renderWithQueryClient(
        <ItemForm
          onSubmit={mockOnSubmit}
          mode="create"
        />
      );

      // Try to submit without filling required fields
      await user.click(screen.getByText('Save Item'));

      // Form should show validation errors
      await waitFor(() => {
        expect(screen.getByText('Required fields missing:')).toBeInTheDocument();
        expect(screen.getByText('Item name')).toBeInTheDocument();
      });
    });

    it('should show loading state during submission', async () => {
      mockOnSubmit.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));
      
      renderWithQueryClient(
        <ItemForm
          onSubmit={mockOnSubmit}
          mode="create"
        />
      );

      // Fill in required fields
      await user.type(screen.getByTestId('item-name-input'), 'Test Item');
      await user.click(screen.getByTestId('is-rentable-checkbox'));
      
      // Submit form
      await user.click(screen.getByText('Save Item'));

      // Should show loading state
      expect(screen.getByText('Saving...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    });
  });

  describe('Name Validation', () => {
    it('should validate item name for duplicates', async () => {
      const mockUseItemValidation = require('@/hooks/useItemValidation').useItemValidation;
      const mockValidateItemName = jest.fn();
      
      mockUseItemValidation.mockReturnValue({
        isValidating: true,
        validateItemName: mockValidateItemName,
        clearValidation: jest.fn(),
        isItemNameValid: true,
        validationErrors: [],
        validationSuggestions: [],
        hasValidated: false,
      });
      
      renderWithQueryClient(
        <ItemForm
          onSubmit={mockOnSubmit}
          mode="create"
        />
      );

      const nameInput = screen.getByTestId('item-name-input');
      
      // Type item name
      await user.type(nameInput, 'Test Item');
      
      // Should show validating state
      await waitFor(() => {
        expect(screen.getByText('Validating...')).toBeInTheDocument();
      });
    });

    it('should show validation suggestions when available', async () => {
      const mockUseItemValidation = require('@/hooks/useItemValidation').useItemValidation;
      
      mockUseItemValidation.mockReturnValue({
        isValidating: false,
        validateItemName: jest.fn(),
        clearValidation: jest.fn(),
        isItemNameValid: true,
        validationErrors: [],
        validationSuggestions: ['Found 2 similar items. Make sure this isn\'t a duplicate.'],
        hasValidated: true,
      });
      
      renderWithQueryClient(
        <ItemForm
          onSubmit={mockOnSubmit}
          mode="create"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Found 2 similar items/)).toBeInTheDocument();
      });
    });
  });

  describe('Error Dialog Interactions', () => {
    it('should handle alternative name selection', async () => {
      const conflictError = new AxiosError(
        'Request failed with status code 409',
        'ERR_BAD_REQUEST',
        {},
        {},
        {
          status: 409,
          statusText: 'Conflict',
          data: {
            success: false,
            message: "Item with name 'Test Item' already exists",
            detail: "Item with name 'Test Item' already exists"
          },
          headers: {},
          config: {}
        }
      );
      
      mockOnSubmit.mockRejectedValueOnce(conflictError);
      
      renderWithQueryClient(
        <ItemForm
          onSubmit={mockOnSubmit}
          mode="create"
        />
      );

      // Fill and submit form
      await user.type(screen.getByTestId('item-name-input'), 'Test Item');
      await user.click(screen.getByTestId('is-rentable-checkbox'));
      await user.click(screen.getByText('Save Item'));

      // Wait for error dialog
      await waitFor(() => {
        expect(screen.getByText('Item Already Exists')).toBeInTheDocument();
      });
      
      // Select an alternative name
      const firstAlternative = screen.getByDisplayValue(/Test Item/);
      await user.click(firstAlternative);
      
      // Click try different name
      await user.click(screen.getByText('Try Different Name'));
      
      // Dialog should close and form should be updated
      await waitFor(() => {
        expect(screen.queryByText('Item Already Exists')).not.toBeInTheDocument();
      });
    });

    it('should handle retry functionality', async () => {
      const networkError = new AxiosError(
        'Network Error',
        'NETWORK_ERROR'
      );
      
      mockOnSubmit
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({ success: true });
      
      renderWithQueryClient(
        <ItemForm
          onSubmit={mockOnSubmit}
          mode="create"
        />
      );

      // Fill and submit form
      await user.type(screen.getByTestId('item-name-input'), 'Test Item');
      await user.click(screen.getByTestId('is-rentable-checkbox'));
      await user.click(screen.getByText('Save Item'));

      // Wait for error dialog
      await waitFor(() => {
        expect(screen.getByText('Network Error')).toBeInTheDocument();
      });
      
      // Click retry
      await user.click(screen.getByText('Try Again'));
      
      // Should retry the submission
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Form Field Interactions', () => {
    it('should disable submit button when validation is in progress', async () => {
      const mockUseItemValidation = require('@/hooks/useItemValidation').useItemValidation;
      
      mockUseItemValidation.mockReturnValue({
        isValidating: true,
        validateItemName: jest.fn(),
        clearValidation: jest.fn(),
        isItemNameValid: true,
        validationErrors: [],
        validationSuggestions: [],
        hasValidated: false,
      });
      
      renderWithQueryClient(
        <ItemForm
          onSubmit={mockOnSubmit}
          mode="create"
        />
      );

      await user.type(screen.getByTestId('item-name-input'), 'Test Item');
      await user.click(screen.getByTestId('is-rentable-checkbox'));
      
      // Submit button should be disabled during validation
      const submitButton = screen.getByText('Validating...');
      expect(submitButton).toBeDisabled();
    });

    it('should disable submit button when validation fails', async () => {
      const mockUseItemValidation = require('@/hooks/useItemValidation').useItemValidation;
      
      mockUseItemValidation.mockReturnValue({
        isValidating: false,
        validateItemName: jest.fn(),
        clearValidation: jest.fn(),
        isItemNameValid: false,
        validationErrors: ['Item name already exists'],
        validationSuggestions: [],
        hasValidated: true,
      });
      
      renderWithQueryClient(
        <ItemForm
          onSubmit={mockOnSubmit}
          mode="create"
        />
      );

      await user.type(screen.getByTestId('item-name-input'), 'Test Item');
      await user.click(screen.getByTestId('is-rentable-checkbox'));
      
      // Submit button should be disabled when validation fails
      const submitButton = screen.getByText('Save Item');
      expect(submitButton).toBeDisabled();
    });
  });
});