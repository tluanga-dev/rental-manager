# StockMovement Field Removal Migration Guide

**Document Version**: 1.0  
**Date**: August 1, 2025  
**Migration ID**: `9a8b7c6d5e4f_remove_notes_reference_id_reason_from_stock_movements`

---

## Overview

This document outlines the removal of three fields from the `StockMovement` model as part of database schema simplification:

- `notes` (Text, nullable) - Additional notes about stock movements
- `reference_id` (String(100), nullable) - External reference identifier
- `reason` (String(500), required) - Human-readable reason for movement

## Migration Summary

### Database Changes

**Migration File**: `alembic/versions/9a8b7c6d5e4f_remove_notes_reference_id_reason_from_stock_movements.py`

**Upgrade Operations**:
```sql
-- Remove columns from stock_movements table
ALTER TABLE stock_movements DROP COLUMN notes;
ALTER TABLE stock_movements DROP COLUMN reference_id;
ALTER TABLE stock_movements DROP COLUMN reason;
```

**Downgrade Operations**:
```sql
-- Add columns back with proper constraints
ALTER TABLE stock_movements ADD COLUMN reason VARCHAR(500) NOT NULL DEFAULT '';
ALTER TABLE stock_movements ADD COLUMN reference_id VARCHAR(100);
ALTER TABLE stock_movements ADD COLUMN notes TEXT;
```

### Code Changes

#### 1. Model Updates

**File**: `/app/modules/inventory/models.py`

**Removed Fields**:
```python
# REMOVED - No longer part of StockMovement model
reason = Column(String(500), nullable=False)
reference_id = Column(String(100), nullable=True)
notes = Column(Text, nullable=True)
```

**Updated Constructor**:
```python
# OLD - Constructor with removed parameters
def __init__(
    self,
    *,
    stock_level_id: str | UUID,
    item_id: str | UUID,
    location_id: str | UUID,
    movement_type: StockMovementType,
    reference_type: ReferenceType,
    quantity_change: Decimal,
    quantity_before: Decimal,
    quantity_after: Decimal,
    reason: str,                    # REMOVED
    reference_id: Optional[str] = None,  # REMOVED
    notes: Optional[str] = None,    # REMOVED
    transaction_header_id: Optional[str | UUID] = None,
    transaction_line_id: Optional[str | UUID] = None,
    **kwargs,
):

# NEW - Simplified constructor
def __init__(
    self,
    *,
    stock_level_id: str | UUID,
    item_id: str | UUID,
    location_id: str | UUID,
    movement_type: StockMovementType,
    reference_type: ReferenceType,
    quantity_change: Decimal,
    quantity_before: Decimal,
    quantity_after: Decimal,
    transaction_header_id: Optional[str | UUID] = None,
    transaction_line_id: Optional[str | UUID] = None,
    **kwargs,
):
```

**Updated Class Methods**:
```python
# OLD - Class methods with removed parameters
@classmethod
def create_rental_out_movement(
    cls,
    *,
    stock_level_id: str | UUID,
    item_id: str | UUID,
    location_id: str | UUID,
    quantity: Decimal,
    quantity_before: Decimal,
    transaction_header_id: Optional[str | UUID] = None,
    transaction_line_id: Optional[str | UUID] = None,
    reference_id: Optional[str] = None,  # REMOVED
    notes: Optional[str] = None,         # REMOVED
    **kwargs
) -> "StockMovement":
    return cls(
        # ... other fields ...
        reason=f"Rental out: {quantity} units",  # REMOVED
        reference_id=reference_id,                # REMOVED
        notes=notes,                              # REMOVED
        **kwargs
    )

# NEW - Simplified class methods
@classmethod
def create_rental_out_movement(
    cls,
    *,
    stock_level_id: str | UUID,
    item_id: str | UUID,
    location_id: str | UUID,
    quantity: Decimal,
    quantity_before: Decimal,
    transaction_header_id: Optional[str | UUID] = None,
    transaction_line_id: Optional[str | UUID] = None,
    **kwargs
) -> "StockMovement":
    return cls(
        # ... other fields ...
        **kwargs
    )
```

#### 2. Service Updates

**File**: `/app/modules/transactions/rentals/rental_service_enhanced.py`

**Updated Stock Movement Creation**:
```python
# OLD - Creation with removed fields
stock_movement = StockMovement(
    stock_level_id=stock_level_id,
    item_id=str(item_id),
    location_id=str(location_id),
    movement_type="RENTAL_OUT",
    reference_type="TRANSACTION",
    reference_id=str(transaction_line.transaction_header_id),  # REMOVED
    quantity_change=quantity,
    quantity_before=quantity_before,
    quantity_after=quantity_after,
    reason="rental",                                          # REMOVED
    transaction_line_id=str(transaction_line.id)
)

# NEW - Simplified creation
stock_movement = StockMovement(
    stock_level_id=stock_level_id,
    item_id=str(item_id),
    location_id=str(location_id),
    movement_type="RENTAL_OUT",
    reference_type="TRANSACTION",
    quantity_change=quantity,
    quantity_before=quantity_before,
    quantity_after=quantity_after,
    transaction_line_id=str(transaction_line.id)
)
```

#### 3. Query Updates

**Files**: Various cleanup scripts and tests

**Updated Queries**:
```python
# OLD - Queries using reference_id
movements_stmt = select(func.count()).select_from(StockMovement).where(
    StockMovement.reference_id.in_([str(tx_id) for tx_id in rental_tx_ids])
)

# NEW - Queries using transaction_header_id
movements_stmt = select(func.count()).select_from(StockMovement).where(
    StockMovement.transaction_header_id.in_([str(tx_id) for tx_id in rental_tx_ids])
)
```

#### 4. Test Updates

**Updated Test Assertions**:
```python
# OLD - Tests checking removed fields
assert movement.reference_id == str(result.transaction_id)
assert movement.reason == "purchase"

# NEW - Tests without removed fields
# Reference information available through transaction_header_id relationship
assert str(movement.transaction_header_id) == str(result.transaction_id)
# Movement context available through movement_type and reference_type
assert movement.movement_type == MovementType.PURCHASE.value
```

#### 5. Frontend Updates

**File**: `/src/services/api/inventory.ts`

**Updated TypeScript Interface**:
```typescript
// OLD - Interface with removed fields
recent_movements: Array<{
  id: string;
  movement_type: string;
  quantity_change: number;
  reason: string;              // REMOVED
  reference_type?: string;
  reference_id?: string;       // REMOVED
  location_name: string;
  created_at: string;
  created_by_name?: string;
}>;

// NEW - Simplified interface
recent_movements: Array<{
  id: string;
  movement_type: string;
  quantity_change: number;
  reference_type?: string;
  location_name: string;
  created_at: string;
  created_by_name?: string;
}>;
```

## Migration Process

### 1. Backup Database

Before running the migration, create a backup:

```bash
# PostgreSQL backup
pg_dump -h localhost -U postgres -d your_database > stock_movements_backup_$(date +%Y%m%d_%H%M%S).sql

# Docker environment backup
docker-compose exec -T db pg_dump -U postgres your_database > stock_movements_backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Run Migration

```bash
cd rental-manager-backend
alembic upgrade head
```

### 3. Verify Migration

Check that columns were removed:
```sql
-- Connect to your database
\d stock_movements

-- Should NOT see: reason, reference_id, notes columns
```

### 4. Update Application Code

Ensure all application code is updated to not reference the removed fields:

```bash
# Search for potential references
grep -r "\.reason\|\.reference_id\|\.notes" app/modules/inventory/
grep -r "reason=" app/modules/
grep -r "reference_id=" app/modules/
```

## Alternative Data Access

### Context Information

The removed fields served different purposes. Here's how to access equivalent information:

#### 1. Movement Reason (Removed: `reason` field)

**OLD**: Direct access via `movement.reason`

**NEW**: Context available through structured fields:
```python
# Movement context from type information
movement_context = f"{movement.movement_type.value} via {movement.reference_type.value}"

# For rentals: "RENTAL_OUT via TRANSACTION"
# For purchases: "PURCHASE via TRANSACTION"
# For adjustments: "ADJUSTMENT_POSITIVE via MANUAL"
```

#### 2. Reference Information (Removed: `reference_id` field)

**OLD**: Generic string reference via `movement.reference_id`

**NEW**: Structured relationship fields:
```python
# Transaction reference
transaction_id = movement.transaction_header_id
transaction_line_id = movement.transaction_line_id

# Access full transaction details via relationships
transaction = movement.transaction_header
transaction_line = movement.transaction_line
```

#### 3. Additional Notes (Removed: `notes` field)

**OLD**: Free-form notes via `movement.notes`

**NEW**: Notes available in related entities:
```python
# Transaction-level notes
transaction_notes = movement.transaction_header.notes

# Line-level notes  
line_notes = movement.transaction_line.notes

# Audit information from base mixins
audit_info = {
    'created_at': movement.created_at,
    'updated_at': movement.updated_at,
    'created_by': movement.created_by,
    'updated_by': movement.updated_by
}
```

## Documentation Updates

The following documentation files have been updated to reflect the changes:

### Backend Documentation

1. **Purchase Transaction Flow** (`docs/purchase/PURCHASE_TRANSACTION_FLOW.md`)
   - Updated StockMovement model definition
   - Updated SQL examples
   - Updated stock movement tracking section

2. **Item Inventory API** (`docs/item_inventory_endpoints_api_documentation_07-15-25.md`)
   - Updated RecentMovement model definition
   - Updated JSON response examples

3. **Frontend Integration Guide** (`api-docs/FRONTEND_IMPLEMENTATION_GUIDE_200725.md`)
   - Updated stock adjustment API examples
   - Added migration notes

## Breaking Changes

### For Backend Developers

1. **StockMovement Constructor**: Remove `reason`, `reference_id`, and `notes` parameters
2. **Database Queries**: Update queries using `reference_id` to use `transaction_header_id`
3. **Test Assertions**: Remove assertions checking removed fields

### For Frontend Developers

1. **TypeScript Interfaces**: Update interfaces to remove `reason` and `reference_id` fields
2. **API Responses**: Remove handling of removed fields from stock movement data
3. **UI Components**: Update components that displayed reason or reference information

### For API Consumers

1. **Response Format**: `recent_movements` arrays no longer include `reason` and `reference_id`
2. **Context Access**: Use `movement_type` and `reference_type` for movement context
3. **Reference Data**: Use transaction relationship fields for reference information

## Rollback Procedure

If rollback is needed:

### 1. Database Rollback

```bash
# Rollback to previous migration
cd rental-manager-backend
alembic downgrade -1
```

### 2. Code Rollback

Revert all code changes:
```bash
git revert <migration-commit-hash>
```

### 3. Verify Rollback

```sql
-- Check that columns are restored
\d stock_movements

-- Should see: reason, reference_id, notes columns
```

## Performance Impact

### Positive Impacts

1. **Reduced Storage**: Smaller table size due to removed columns
2. **Faster Queries**: Less data to transfer and process
3. **Simpler Indexes**: Fewer columns to maintain in indexes

### Neutral Impacts

1. **Query Performance**: Existing queries using movement_type and reference_type are unchanged
2. **Insert Performance**: Similar performance with fewer fields to populate

## Support

For questions or issues related to this migration:

1. **Database Issues**: Check migration logs and database error messages
2. **Code Issues**: Search for references to removed fields in codebase
3. **API Issues**: Verify frontend interfaces match backend responses
4. **Testing Issues**: Update test expectations to match new model structure

## Validation Checklist

After migration, verify:

- [ ] Database migration completed successfully
- [ ] `stock_movements` table no longer has `reason`, `reference_id`, `notes` columns
- [ ] Application starts without errors
- [ ] Stock movement creation works correctly
- [ ] Tests pass with updated assertions
- [ ] Frontend displays stock movements without removed fields
- [ ] No references to removed fields in codebase
- [ ] Documentation reflects current model structure

---

**End of Migration Guide**

This migration simplifies the StockMovement model while maintaining all essential functionality through structured relationships and type information.