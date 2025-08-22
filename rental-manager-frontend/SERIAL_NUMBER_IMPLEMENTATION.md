# Serial Number Implementation in Purchase Transactions

## Overview

This document describes the implementation of serial number input fields in the purchase transaction module. The feature adds conditional serial number input fields that appear only when the selected item has `serial_number_required: true` in the item master.

## Features Implemented

### 1. Conditional Serial Number Input
- Serial number input fields appear only for items that require them
- Visual indicator shows when an item requires serial numbers
- Auto-adjusts the number of input fields based on quantity

### 2. SerialNumberInput Component
- **Location**: `src/components/purchases/SerialNumberInput.tsx`
- **Features**:
  - Dynamic input fields based on quantity
  - Auto-generation of serial numbers
  - Clear all functionality
  - Real-time validation feedback
  - Visual progress indicator

### 3. Enhanced Form Validation
- Validates that serial numbers are provided when required
- Ensures quantity matches serial number count
- Prevents duplicate serial numbers within an item
- Prevents duplicate serial numbers across items in the same purchase
- Real-time validation with error messages

### 4. Backend Integration
- Utilizes existing backend schema support for serial numbers
- Sends `serial_numbers` array in purchase item data
- Backend validates serial number uniqueness across the system

## Usage

### For Items Requiring Serial Numbers
1. Select an item that has `serial_number_required: true`
2. Serial number input section appears automatically
3. Enter serial numbers manually or use "Auto Generate"
4. Form validates that all required serial numbers are provided

### For Items Not Requiring Serial Numbers
- No serial number input fields are shown
- Form behaves as before

## Technical Implementation

### Type Updates
```typescript
// Updated PurchaseItemFormData to include serial numbers
export interface PurchaseItemFormData {
  // ... existing fields
  serial_numbers?: string[];
}
```

### Form Schema Updates
```typescript
const purchaseItemSchema = z.object({
  // ... existing fields
  serial_numbers: z.array(z.string().min(1, 'Serial number cannot be empty')).optional(),
});
```

### State Management
- `selectedItems` state tracks full item data for each line item
- Used to determine if serial numbers are required
- Cleaned up when items are removed

### Validation Logic
- Real-time validation checks serial number requirements
- Validates quantity vs serial number count
- Checks for duplicates within and across items
- Integrates with existing form validation

## Component Structure

```
SerialNumberInput
├── Props
│   ├── value: string[]
│   ├── onChange: (serialNumbers: string[]) => void
│   ├── quantity: number
│   ├── itemName: string
│   ├── required: boolean
│   └── error?: string
├── Features
│   ├── Auto-generation
│   ├── Clear all
│   ├── Dynamic quantity adjustment
│   └── Visual feedback
└── Validation
    ├── Required field validation
    ├── Duplicate detection
    └── Empty value handling
```

## Testing

### Manual Testing Steps
1. **Test with serialized items**:
   - Select an item with `serial_number_required: true`
   - Verify serial number input appears
   - Test auto-generation functionality
   - Test manual entry
   - Verify validation works

2. **Test with non-serialized items**:
   - Select an item with `serial_number_required: false`
   - Verify no serial number input appears
   - Form should work normally

3. **Test mixed purchases**:
   - Add both serialized and non-serialized items
   - Verify correct behavior for each item type

4. **Test validation**:
   - Try submitting with missing serial numbers
   - Try duplicate serial numbers
   - Try mismatched quantity vs serial count

### Test Component
Use `PurchaseFormTest` component for testing:
```typescript
import { PurchaseFormTest } from '@/components/purchases/PurchaseFormTest';
```

## Error Handling

### Validation Errors
- Missing serial numbers for required items
- Quantity mismatch with serial number count
- Duplicate serial numbers within item
- Duplicate serial numbers across items

### User Feedback
- Real-time validation messages
- Visual indicators for completion status
- Clear error descriptions
- Progress indicators

## Future Enhancements

### Potential Improvements
1. **Barcode Scanner Integration**
   - Add barcode scanning for serial numbers
   - Mobile camera integration

2. **Serial Number Templates**
   - Configurable auto-generation patterns
   - Company-specific formats

3. **Bulk Import**
   - CSV import for large quantities
   - Excel integration

4. **History Tracking**
   - Track serial number changes
   - Audit trail for modifications

## Troubleshooting

### Common Issues
1. **Serial number input not appearing**
   - Check if item has `serial_number_required: true`
   - Verify item selection is working correctly

2. **Validation not working**
   - Check form state management
   - Verify selectedItems state is updated

3. **Auto-generation not working**
   - Check timestamp generation
   - Verify onChange callback

### Debug Information
- Check browser console for validation errors
- Verify selectedItems state in React DevTools
- Check form values in form state

## API Integration

### Request Format
```json
{
  "items": [
    {
      "item_id": "uuid",
      "quantity": 2,
      "unit_cost": 100.00,
      "serial_numbers": ["SN001", "SN002"],
      // ... other fields
    }
  ]
}
```

### Backend Validation
- Validates serial number requirements
- Checks system-wide uniqueness
- Creates inventory units with serial numbers

## Conclusion

The serial number implementation provides a seamless user experience for managing serialized inventory in purchase transactions. The conditional display ensures the interface remains clean for non-serialized items while providing robust functionality for items that require serial number tracking.