# Rental Extension Feature Documentation

## Overview

The Rental Extension feature allows customers to extend their active rentals with maximum flexibility. The system supports unlimited extensions (restricted only by booking conflicts), optional payment at extension time, and partial operations where some items can be extended while others are returned.

## Key Features

### 1. Unlimited Extensions
- **No artificial limits**: Rentals can be extended as many times as needed
- **Only restriction**: Future bookings by other customers
- **Automatic conflict detection**: System checks for booking conflicts before allowing extensions

### 2. Flexible Payment Model
- **Payment Optional**: Customers are not required to pay at extension time
- **Three Payment Options**:
  - Pay Later (default): Payment collected at final return
  - Pay Now: Optional immediate payment
  - Partial Payment: Pay any amount toward the balance
- **Balance Tracking**: System maintains accurate balance throughout rental lifecycle

### 3. Partial Operations
- **Mixed Actions**: Different items in a rental can have different actions:
  - Extend: Continue rental for specified items
  - Partial Return: Return some quantity while extending others
  - Full Return: Return all of specific items
- **Condition Assessment**: Returned items can be marked as:
  - Good: Returns to available inventory
  - Damaged: Requires assessment and possible repair
  - Beyond Repair: Removed from rentable inventory

## Database Schema

### New Tables

#### `rental_bookings`
Tracks future rental reservations to prevent double-booking:
- `item_id`: Item being reserved
- `quantity_reserved`: Amount reserved
- `start_date`, `end_date`: Booking period
- `customer_id`: Customer making the booking
- `booking_status`: PENDING, CONFIRMED, CANCELLED, CONVERTED

#### `rental_extensions`
Records all extension transactions:
- `parent_rental_id`: Original rental transaction
- `extension_date`: When extension was processed
- `original_end_date`: Previous end date
- `new_end_date`: Extended end date
- `extension_charges`: Calculated charges
- `payment_received`: Amount paid at extension
- `payment_status`: PENDING, PARTIAL, PAID

#### `rental_extension_lines`
Item-level extension details:
- `extension_id`: Parent extension record
- `transaction_line_id`: Original rental line
- `extended_quantity`: Quantity being extended
- `returned_quantity`: Quantity being returned
- `return_condition`: Condition of returned items

### Updated Tables

#### `transaction_headers`
Added fields:
- `extension_count`: Number of times rental has been extended
- `total_extension_charges`: Accumulated extension charges

## API Endpoints

### Check Extension Availability
```
GET /api/transactions/rentals/{rental_id}/extension-availability?new_end_date=2024-02-15
```

**Response:**
```json
{
  "can_extend": true,
  "conflicts": {},
  "extension_charges": 500.00,
  "current_balance": 1500.00,
  "total_with_extension": 2000.00,
  "payment_required": false,
  "items": [
    {
      "line_id": "uuid",
      "item_name": "Generator 5kW",
      "can_extend_to": "2024-02-15",
      "has_conflict": false
    }
  ]
}
```

### Process Extension
```
POST /api/transactions/rentals/{rental_id}/extend
```

**Request Body:**
```json
{
  "new_end_date": "2024-02-15",
  "items": [
    {
      "line_id": "uuid",
      "action": "EXTEND",
      "extend_quantity": 5,
      "return_quantity": 0
    },
    {
      "line_id": "uuid",
      "action": "PARTIAL_RETURN",
      "extend_quantity": 3,
      "return_quantity": 2,
      "return_condition": "GOOD"
    }
  ],
  "payment_option": "PAY_LATER",
  "payment_amount": 0,
  "notes": "Customer requested extension"
}
```

### Get Rental Balance
```
GET /api/transactions/rentals/{rental_id}/balance
```

**Response:**
```json
{
  "rental_id": "uuid",
  "transaction_number": "RENT-2024-001",
  "original_rental": 1000.00,
  "extension_charges": 500.00,
  "late_fees": 0,
  "damage_fees": 0,
  "total_charges": 1500.00,
  "payments_received": 200.00,
  "balance_due": 1300.00,
  "payment_status": "PARTIAL",
  "extension_count": 2
}
```

### Get Extension History
```
GET /api/transactions/rentals/{rental_id}/extension-history
```

## Frontend Implementation

### Active Rentals Table
- **Extend Button**: Added to each rental row
- **Visual Indicators**: 
  - Green button: Extension available
  - Gray/disabled: Has booking conflicts
  - Loading state: Processing extension

### Extension Page (`/rentals/{id}/extend`)
The extension page provides a comprehensive interface for processing extensions:

1. **Date Selection**: Choose new end date with automatic calculation of extension period
2. **Availability Check**: Real-time conflict detection
3. **Item Management**: 
   - Select items to extend
   - Choose action per item (extend/return)
   - Specify return quantities and conditions
4. **Financial Summary**: 
   - Current balance
   - Extension charges
   - Total amount due
5. **Payment Options**: 
   - Pay Later (default)
   - Pay Now with flexible amount

## Business Logic

### Extension Eligibility
Rentals can be extended if:
- Status is active (RENTAL_INPROGRESS, RENTAL_EXTENDED, RENTAL_LATE, etc.)
- Not completed or returned
- No booking conflicts for requested period

### Pricing Model
- **Same Rate**: Extensions use the same daily/weekly/monthly rate as original rental
- **Pro-rated Charges**: Calculated based on actual extension days
- **No Penalties**: No additional fees for multiple extensions

### Inventory Impact
- **Extended Items**: Reservation period updated
- **Returned Items**: 
  - Good condition: Returns to available stock
  - Damaged: Marked for assessment
  - Beyond repair: Removed from inventory
- **Stock Movements**: All changes tracked for audit

## Usage Examples

### Scenario 1: Simple Extension
Customer extends entire rental by one week:
1. Click "Extend" button in active rentals
2. Select new end date (7 days later)
3. Check availability (no conflicts)
4. Choose "Pay Later"
5. Confirm extension

### Scenario 2: Partial Extension with Return
Customer has 5 generators, wants to extend 3 and return 2:
1. Navigate to extension page
2. Set new end date
3. For first item: Action = "EXTEND", quantity = 3
4. For second item: Action = "PARTIAL_RETURN", return quantity = 2
5. Mark returned items as "GOOD" condition
6. Process extension

### Scenario 3: Extension with Booking Conflict
Customer tries to extend but another booking exists:
1. System detects conflict
2. Shows maximum extension date before conflict
3. Customer can either:
   - Choose earlier end date
   - Return conflicting items
   - Cancel extension

## Testing

### Unit Tests
Located in `tests/test_rental_extension.py`:
- Extension availability checking
- Conflict detection
- Payment processing
- Partial returns

### Integration Tests
- End-to-end extension workflow
- Inventory synchronization
- Financial calculations

### Manual Testing Checklist
- [ ] Extend active rental without conflicts
- [ ] Attempt extension with booking conflict
- [ ] Process partial extension with returns
- [ ] Test all payment options
- [ ] Verify inventory updates
- [ ] Check balance calculations
- [ ] Review extension history

## Migration Guide

To enable the rental extension feature:

1. **Run Database Migrations**:
```bash
cd rental-manager-backend
alembic upgrade head
```

2. **Verify New Tables**:
- rental_bookings
- rental_extensions
- rental_extension_lines

3. **Update Frontend**:
- Deploy new extension page
- Update ActiveRentalsTable component

4. **Configure Permissions** (if using RBAC):
- Add "rental.extend" permission
- Assign to appropriate roles

## Troubleshooting

### Common Issues

1. **"Cannot extend - has booking conflicts"**
   - Check for existing bookings in the requested period
   - Use extension-availability endpoint to find available dates

2. **Extension button disabled**
   - Rental may be completed/returned
   - Check rental status

3. **Payment not reflecting**
   - Verify payment_option in request
   - Check payment_amount value
   - Review balance endpoint response

### Debug Endpoints

For troubleshooting, use these endpoints:
- Check rental status: `GET /api/transactions/rentals/{id}`
- View bookings: `GET /api/bookings?item_id={item_id}`
- Check inventory: `GET /api/inventory/items/{item_id}/availability`

## Future Enhancements

Potential improvements for future versions:

1. **Automated Notifications**: Email/SMS for successful extensions
2. **Bulk Extensions**: Extend multiple rentals at once
3. **Extension Templates**: Save common extension patterns
4. **Predictive Conflicts**: Warn about upcoming booking conflicts
5. **Mobile App Support**: Native mobile extension interface
6. **Extension Analytics**: Reports on extension patterns and revenue