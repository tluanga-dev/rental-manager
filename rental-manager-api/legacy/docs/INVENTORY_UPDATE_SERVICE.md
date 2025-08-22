# Inventory Update Service Documentation

## Overview

The Inventory Update Service is an internal service designed to handle all inventory stock movements and stock level updates. It's meant to be used by other modules (purchase, sale, rental transactions, etc.) and is not directly exposed as an API endpoint.

## Features

- ✅ Stock level management (quantity on hand, quantity on rent, quantity available)
- ✅ Stock movement tracking with full audit trail
- ✅ Support for all movement types (purchase, sale, rental out/return, adjustments, etc.)
- ✅ Business rule validation (insufficient stock, invalid returns, etc.)
- ✅ Automatic stock level creation if none exists (with calculated quantities)
- ✅ Transaction safety with rollback on errors
- ✅ Industry-standard Pydantic validation
- ✅ Comprehensive logging and error handling

## Architecture

The service follows these design principles:

1. **Single Responsibility**: Only handles inventory updates and stock movements
2. **Synchronous**: Uses standard SQLAlchemy for simple integration
3. **Validation First**: Validates all business rules before making changes
4. **Audit Trail**: Creates detailed stock movement records for every change
5. **Error Safety**: Proper exception handling with database rollback

## Core Components

### 1. InventoryUpdateService

Main service class located at: `app/modules/inventory/services/inventory_update_service.py`

### 2. Pydantic Schemas

Request and response schemas in: `app/modules/inventory/schemas.py`
- `InventoryUpdateRequest`
- `InventoryUpdateResponse`

### 3. Movement Types

All supported movement types from: `app/modules/inventory/enums.py`
- `PURCHASE` - Stock purchase
- `SALE` - Item sold
- `RENTAL_OUT` - Item rented out
- `RENTAL_RETURN` - Item returned from rental
- `ADJUSTMENT_POSITIVE` - Positive stock adjustment
- `ADJUSTMENT_NEGATIVE` - Negative stock adjustment
- `TRANSFER_IN` - Stock transfer in
- `TRANSFER_OUT` - Stock transfer out
- `DAMAGE_LOSS` - Item damaged/lost
- `THEFT_LOSS` - Item stolen/lost
- `SYSTEM_CORRECTION` - System correction

## Usage Examples

### Basic Usage

```python
from app.modules.inventory.services import InventoryUpdateService
from app.modules.inventory.enums import MovementType

# Initialize service
inventory_service = InventoryUpdateService(db)

# Process purchase
response = inventory_service.update_inventory(
    transaction_line_item_id=line_item.id,
    item_id=item.id,
    location_id=warehouse.id,
    quantity=10,
    stock_movement_type=MovementType.PURCHASE,
    remarks="Stock purchased from Supplier ABC"
)
```

### Using Integration Helper

For transaction services, use the integration helper:

```python
from app.modules.inventory.integrations import process_purchase_line_items

# Process multiple line items at once
transaction_line_items = [
    {'id': line1.id, 'item_id': item1.id, 'quantity': 5},
    {'id': line2.id, 'item_id': item2.id, 'quantity': 3}
]

responses = process_purchase_line_items(
    db=db,
    transaction_line_items=transaction_line_items,
    location_id=warehouse.id,
    remarks="Purchase Order #PO-2025-001",
    created_by=current_user.id
)
```

### Checking Stock Availability

```python
from app.modules.inventory.integrations import check_transaction_stock_availability

# Check if all items are available for a transaction
availability = check_transaction_stock_availability(
    db=db,
    transaction_line_items=rental_items,
    location_id=rental_location.id
)

if not availability['all_available']:
    # Handle insufficient stock
    for item in availability['unavailable_items']:
        print(f"Item {item['item_id']} needs {item['required_quantity']} but only {item['available_quantity']} available")
```

## Movement Type Behavior

### Stock Increasing Movements
- `PURCHASE`: Increases stock, adds to available quantity
- `RENTAL_RETURN`: Increases stock, decreases quantity on rent
- `ADJUSTMENT_POSITIVE`: Increases stock and available quantity
- `TRANSFER_IN`: Increases stock and available quantity
- `SYSTEM_CORRECTION`: Increases stock and available quantity

### Stock Decreasing Movements
- `SALE`: Decreases stock and available quantity
- `RENTAL_OUT`: Decreases stock, increases quantity on rent
- `ADJUSTMENT_NEGATIVE`: Decreases stock and available quantity
- `TRANSFER_OUT`: Decreases stock and available quantity
- `DAMAGE_LOSS`: Decreases stock and available quantity
- `THEFT_LOSS`: Decreases stock and available quantity

## Stock Level Calculations

The service maintains three key quantities:

1. **Quantity On Hand**: Total physical stock
2. **Quantity On Rent**: Items currently rented out
3. **Quantity Available**: Items available for rent/sale

Formula: `quantity_available = quantity_on_hand - quantity_on_rent`

### New Stock Level Creation

When a StockLevel record doesn't exist for an item at a location, the service creates a new one with the **calculated quantities** (not starting from zero). This means:

- For a PURCHASE movement of 10 items: Creates StockLevel with `quantity_on_hand=10, quantity_on_rent=0, quantity_available=10`
- For a RENTAL_OUT movement of 5 items: Creates StockLevel with `quantity_on_hand=-5, quantity_on_rent=5, quantity_available=-10` (would fail validation)
- For a RENTAL_RETURN movement of 3 items: Creates StockLevel with `quantity_on_hand=3, quantity_on_rent=-3, quantity_available=6` (would fail validation)

**Important**: The service validates that final quantities are logical, so movements that would result in negative stock will raise BusinessLogicError.

## Error Handling

The service raises specific exceptions:

### BusinessLogicError
- Insufficient stock for sale/rental
- Invalid return quantities (more than rented)
- Negative final quantities

### NotFoundError
- Item not found or inactive
- Invalid item ID

### SQLAlchemyError
- Database connection issues
- Transaction failures

## Integration with Transaction Services

### Purchase Service Integration

```python
class PurchaseService:
    def __init__(self, db: Session):
        self.db = db
        self.inventory_service = InventoryUpdateService(db)
    
    def complete_purchase(self, purchase_order):
        # ... purchase logic ...
        
        # Update inventory for each line item
        for line_item in purchase_order.line_items:
            self.inventory_service.update_inventory(
                transaction_line_item_id=line_item.id,
                item_id=line_item.item_id,
                location_id=purchase_order.delivery_location_id,
                quantity=line_item.quantity,
                stock_movement_type=MovementType.PURCHASE,
                remarks=f"Purchase Order {purchase_order.po_number}",
                created_by=purchase_order.created_by
            )
```

### Rental Service Integration

```python
class RentalService:
    def __init__(self, db: Session):
        self.db = db
        self.inventory_service = InventoryUpdateService(db)
    
    def process_rental_out(self, rental_contract):
        # Check availability first
        for line_item in rental_contract.line_items:
            available = self.inventory_service.check_stock_availability(
                item_id=line_item.item_id,
                location_id=rental_contract.pickup_location_id,
                required_quantity=line_item.quantity
            )
            if not available:
                raise BusinessLogicError(f"Insufficient stock for item {line_item.item_id}")
        
        # Process rental out
        for line_item in rental_contract.line_items:
            self.inventory_service.update_inventory(
                transaction_line_item_id=line_item.id,
                item_id=line_item.item_id,
                location_id=rental_contract.pickup_location_id,
                quantity=line_item.quantity,
                stock_movement_type=MovementType.RENTAL_OUT,
                remarks=f"Rented to {rental_contract.customer.name}",
                created_by=rental_contract.created_by
            )
    
    def process_rental_return(self, return_transaction):
        for line_item in return_transaction.line_items:
            self.inventory_service.update_inventory(
                transaction_line_item_id=line_item.id,
                item_id=line_item.item_id,
                location_id=return_transaction.return_location_id,
                quantity=line_item.quantity,
                stock_movement_type=MovementType.RENTAL_RETURN,
                remarks=f"Returned by {return_transaction.customer.name}",
                created_by=return_transaction.processed_by
            )
```

## Testing

Unit tests are available at: `tests/unit/test_inventory_update_service.py`

Run tests with:
```bash
pytest tests/unit/test_inventory_update_service.py -v
```

## Best Practices

1. **Always Check Availability**: For sales/rentals, check stock availability before processing
2. **Use Descriptive Remarks**: Include meaningful information in movement remarks
3. **Handle Exceptions**: Wrap calls in try-catch blocks for proper error handling
4. **Use Integration Helpers**: For transaction services, use the provided helper functions
5. **Validate Inputs**: Ensure all required parameters are provided and valid
6. **Log Important Events**: The service logs automatically, but add context in your service

## Performance Considerations

- The service creates database transactions, so use judiciously
- For bulk operations, consider batching within a single database transaction
- Stock level queries are indexed on item_id and location_id
- Consider caching stock levels for read-heavy scenarios

## Migration Notes

If migrating from the old async version:
1. Remove `await` keywords
2. Pass `Session` instead of `AsyncSession`
3. Update import paths to use the new service
4. Use the integration helpers for common patterns

## Support

For questions or issues with the inventory update service:
1. Check the unit tests for usage examples
2. Review this documentation
3. Check the service logs for error details
4. Consult the schemas for valid input formats
