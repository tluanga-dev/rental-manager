import { formatCurrencySync } from '@/lib/currency-utils';
import type { Item } from '@/types/item';

export interface FieldChange {
  field: string;
  label: string;
  oldValue: any;
  newValue: any;
  oldDisplay: string;
  newDisplay: string;
}

// Map field names to user-friendly labels
const fieldLabelMap: Record<string, string> = {
  item_name: 'Item Name',
  item_status: 'Status',
  brand_id: 'Brand',
  category_id: 'Category',
  unit_of_measurement_id: 'Unit of Measurement',
  description: 'Description',
  specifications: 'Specifications',
  model_number: 'Model Number',
  rental_rate_per_period: 'Rental Rate',
  rental_period: 'Rental Period',
  sale_price: 'Sale Price',
  purchase_price: 'Purchase Price',
  security_deposit: 'Security Deposit',
  serial_number_required: 'Serial Number Required',
  warranty_period_days: 'Warranty Period',
  reorder_point: 'Reorder Point',
  is_rentable: 'Available for Rental',
  is_saleable: 'Available for Sale',
};

// Format field names to user-friendly labels
export function formatFieldName(field: string): string {
  return fieldLabelMap[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Format field values based on type
export function formatFieldValue(field: string, value: any, item?: Item): string {
  if (value === null || value === undefined || value === '') {
    return 'Not set';
  }

  // Handle boolean fields
  if (field === 'is_rentable' || field === 'is_saleable' || field === 'serial_number_required') {
    return value ? 'Yes' : 'No';
  }

  // Handle status field
  if (field === 'item_status') {
    switch (value) {
      case 'ACTIVE': return 'Active';
      case 'INACTIVE': return 'Inactive';
      case 'DISCONTINUED': return 'Discontinued';
      default: return value;
    }
  }

  // Handle price fields
  if (field.includes('price') || field === 'rental_rate_per_period' || field === 'security_deposit') {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return 'Not set';
    return formatCurrencySync(numValue);
  }

  // Handle rental period
  if (field === 'rental_period') {
    const days = parseInt(value);
    if (isNaN(days)) return 'Not set';
    return days === 1 ? '1 day' : `${days} days`;
  }

  // Handle warranty period
  if (field === 'warranty_period_days') {
    const days = parseInt(value);
    if (isNaN(days)) return 'Not set';
    if (days === 0) return 'No warranty';
    if (days === 365) return '1 year';
    if (days === 730) return '2 years';
    if (days === 1095) return '3 years';
    return days === 1 ? '1 day' : `${days} days`;
  }

  // Handle reorder point
  if (field === 'reorder_point') {
    const point = parseInt(value);
    if (isNaN(point)) return 'Not set';
    return point === 0 ? 'Disabled' : `${point} units`;
  }

  // Handle reference fields (brand, category, unit)
  if (field === 'brand_id' && item?.brand) {
    return item.brand.name || value;
  }
  if (field === 'category_id' && item?.category) {
    return item.category.name || value;
  }
  if (field === 'unit_of_measurement_id' && item?.unit_of_measurement) {
    return item.unit_of_measurement.name || value;
  }

  // Default: return as string
  return String(value);
}

// Detect changes between original and updated item
export function detectChanges(original: Item, updated: Partial<Item>): FieldChange[] {
  const changes: FieldChange[] = [];
  
  // Fields to check for changes
  const fieldsToCheck = [
    'item_name',
    'item_status',
    'brand_id',
    'category_id',
    'unit_of_measurement_id',
    'description',
    'specifications',
    'model_number',
    'rental_rate_per_period',
    'rental_period',
    'sale_price',
    'purchase_price',
    'security_deposit',
    'serial_number_required',
    'warranty_period_days',
    'reorder_point',
    'is_rentable',
    'is_saleable',
  ];

  fieldsToCheck.forEach(field => {
    const originalValue = (original as any)[field];
    const updatedValue = (updated as any)[field];

    // Skip if field not in updated object
    if (updatedValue === undefined) return;

    // Normalize values for comparison
    let normalizedOriginal = originalValue;
    let normalizedUpdated = updatedValue;

    // Handle numeric fields
    if (field.includes('price') || field === 'rental_rate_per_period' || field === 'security_deposit' || 
        field === 'reorder_point') {
      normalizedOriginal = parseFloat(originalValue) || 0;
      normalizedUpdated = parseFloat(updatedValue) || 0;
    }

    // Handle rental_period and warranty_period_days
    if (field === 'rental_period' || field === 'warranty_period_days') {
      normalizedOriginal = parseInt(originalValue) || 0;
      normalizedUpdated = parseInt(updatedValue) || 0;
    }

    // Check if values are different
    if (normalizedOriginal !== normalizedUpdated) {
      // Special handling for empty to value transitions
      const wasEmpty = normalizedOriginal === null || normalizedOriginal === '' || 
                       normalizedOriginal === 0 || normalizedOriginal === false;
      const isEmpty = normalizedUpdated === null || normalizedUpdated === '' || 
                      normalizedUpdated === 0 || normalizedUpdated === false;

      // Skip if both are effectively empty
      if (wasEmpty && isEmpty) return;

      changes.push({
        field,
        label: formatFieldName(field),
        oldValue: originalValue,
        newValue: updatedValue,
        oldDisplay: formatFieldValue(field, originalValue, original),
        newDisplay: formatFieldValue(field, updatedValue, { ...original, ...updated } as Item),
      });
    }
  });

  return changes;
}

// Get change summary text
export function getChangeSummary(changes: FieldChange[]): string {
  if (changes.length === 0) {
    return 'No changes detected';
  }
  
  if (changes.length === 1) {
    return `1 field updated`;
  }
  
  return `${changes.length} fields updated`;
}

// Group changes by category for better organization
export function groupChangesByCategory(changes: FieldChange[]): Record<string, FieldChange[]> {
  const groups: Record<string, FieldChange[]> = {
    'Basic Information': [],
    'Pricing': [],
    'Inventory': [],
    'Availability': [],
  };

  changes.forEach(change => {
    if (['item_name', 'item_status', 'brand_id', 'category_id', 'unit_of_measurement_id', 
         'description', 'specifications', 'model_number'].includes(change.field)) {
      groups['Basic Information'].push(change);
    } else if (['rental_rate_per_period', 'rental_period', 'sale_price', 'purchase_price', 
                'security_deposit'].includes(change.field)) {
      groups['Pricing'].push(change);
    } else if (['serial_number_required', 'warranty_period_days', 'reorder_point'].includes(change.field)) {
      groups['Inventory'].push(change);
    } else if (['is_rentable', 'is_saleable'].includes(change.field)) {
      groups['Availability'].push(change);
    }
  });

  // Remove empty groups
  Object.keys(groups).forEach(key => {
    if (groups[key].length === 0) {
      delete groups[key];
    }
  });

  return groups;
}