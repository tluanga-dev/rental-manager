# Serial Number Testing Guide

## Overview
This guide helps you test the serial number input functionality in the purchase transaction module to ensure users can properly enter serial numbers.

## Test Pages Available

### 1. Serial Number Demo (`/purchases/serial-demo`)
**Purpose**: Test the SerialNumberInput component in isolation
**Features**:
- Adjust quantity and see inputs auto-adjust
- Test manual serial number entry
- Test auto-generation functionality
- Test clear all functionality
- Real-time state display

### 2. Serial Number Integration Test (`/purchases/serial-test`)
**Purpose**: Test serial number functionality integrated with form validation
**Features**:
- Mock items with different serial number requirements
- Form validation testing
- Integration with react-hook-form
- Real purchase form simulation

### 3. Full Purchase Form Test (`/purchases/test-serial`)
**Purpose**: Test the complete purchase recording form with serial numbers
**Features**:
- Full purchase form with all fields
- Real item selection (if backend is connected)
- Complete form submission testing

## Testing Scenarios

### Scenario 1: Basic Serial Number Entry
1. Go to `/purchases/serial-demo`
2. Set quantity to 3
3. Manually enter serial numbers in each field
4. Verify all inputs accept text
5. Click "Test Submit" to see entered values

**Expected Result**: Users can type serial numbers and they are captured correctly

### Scenario 2: Auto-Generation
1. Go to `/purchases/serial-demo`
2. Set quantity to 5
3. Click "Auto Generate"
4. Verify unique serial numbers are generated
5. Test submit to confirm values

**Expected Result**: Auto-generated serial numbers follow pattern `SN-{timestamp}-{number}`

### Scenario 3: Quantity Changes
1. Go to `/purchases/serial-demo`
2. Enter serial numbers for quantity 2
3. Change quantity to 4
4. Verify 2 new empty fields appear
5. Change quantity back to 2
6. Verify original serial numbers are preserved

**Expected Result**: Serial number fields adjust to quantity while preserving existing data

### Scenario 4: Form Integration
1. Go to `/purchases/serial-test`
2. Select "Laptop Dell XPS 13" (requires serial numbers)
3. Set quantity to 2
4. Enter only 1 serial number
5. Try to submit
6. Verify validation error appears

**Expected Result**: Form validation prevents submission with incomplete serial numbers

### Scenario 5: Mixed Items
1. Go to `/purchases/serial-test`
2. Add multiple items
3. Select "Laptop Dell XPS 13" for first item (requires serial numbers)
4. Select "Office Chair" for second item (no serial numbers required)
5. Verify serial number inputs only appear for laptop
6. Submit form with proper data

**Expected Result**: Serial number inputs appear conditionally based on item requirements

### Scenario 6: Real Purchase Form
1. Go to `/purchases/test-serial`
2. Fill out supplier and location
3. Select an item that requires serial numbers
4. Enter quantity and serial numbers
5. Submit the form

**Expected Result**: Complete purchase creation with serial numbers

## Validation Testing

### Test Cases to Verify

#### ✅ Required Field Validation
- [ ] Serial numbers required when item has `serial_number_required: true`
- [ ] No serial numbers required when item has `serial_number_required: false`
- [ ] Error message appears when serial numbers are missing

#### ✅ Quantity Matching
- [ ] Number of serial numbers must match quantity
- [ ] Error when fewer serial numbers than quantity
- [ ] Error when more serial numbers than quantity

#### ✅ Duplicate Detection
- [ ] No duplicate serial numbers within same item
- [ ] No duplicate serial numbers across different items
- [ ] Clear error messages for duplicates

#### ✅ User Input
- [ ] Users can type serial numbers manually
- [ ] Input fields accept alphanumeric characters
- [ ] Special characters are allowed (hyphens, underscores, etc.)
- [ ] Whitespace is trimmed automatically

#### ✅ Auto-Generation
- [ ] Auto-generate creates unique serial numbers
- [ ] Generated serial numbers follow consistent pattern
- [ ] Generated numbers don't conflict with existing ones

#### ✅ Form Integration
- [ ] Serial numbers are included in form submission
- [ ] Form validation prevents submission with invalid serial numbers
- [ ] Serial numbers are cleared when item changes

## Troubleshooting

### Issue: Serial number inputs not appearing
**Check**:
1. Item has `serial_number_required: true`
2. Item is properly selected
3. Component is receiving correct props

### Issue: Cannot type in serial number fields
**Check**:
1. Input fields are not disabled
2. onChange handler is working
3. No JavaScript errors in console

### Issue: Validation not working
**Check**:
1. Form validation function is called
2. selectedItems state is updated correctly
3. Error messages are displayed

### Issue: Auto-generation not working
**Check**:
1. Button click handler is working
2. Generated values are unique
3. onChange is called with new values

## Console Debugging

Enable console logging to debug issues:

```javascript
// In SerialNumberInput component
console.log('SerialNumberInput props:', { value, quantity, itemName, required });
console.log('Serial numbers changed:', newSerialNumbers);

// In purchase form
console.log('Selected items:', selectedItems);
console.log('Form values:', form.getValues());
console.log('Validation errors:', formValidation.errors);
```

## Expected Behavior Summary

1. **Conditional Display**: Serial number inputs only appear for items requiring them
2. **User Input**: Users can freely type serial numbers in input fields
3. **Auto-Generation**: Users can generate serial numbers automatically
4. **Validation**: Form prevents submission with invalid serial number data
5. **Quantity Sync**: Serial number fields adjust when quantity changes
6. **Data Persistence**: Serial numbers are preserved during form interactions
7. **Form Submission**: Serial numbers are included in purchase data

## Success Criteria

- ✅ Users can enter serial numbers manually
- ✅ Auto-generation works correctly
- ✅ Validation prevents invalid submissions
- ✅ Serial numbers are included in form data
- ✅ UI is intuitive and responsive
- ✅ No JavaScript errors in console
- ✅ Works with different quantities
- ✅ Integrates properly with purchase form

If all test scenarios pass, the serial number functionality is working correctly and users can successfully enter serial numbers in the purchase transaction module.