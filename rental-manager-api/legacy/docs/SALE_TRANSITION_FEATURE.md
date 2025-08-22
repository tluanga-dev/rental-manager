# Sale Transition Feature Documentation

## Overview

The Sale Transition feature enables safe conversion of rental items to sale status while managing conflicts with active rentals and future bookings. This feature ensures business continuity by preventing items from being sold while they are rented or booked.

## Key Features

### 1. Conflict Detection
- **Active Rentals**: Detects items currently on rent
- **Future Bookings**: Identifies confirmed and pending bookings
- **Late Rentals**: Flags overdue rentals as critical conflicts
- **Inventory Issues**: Checks for units in maintenance or damaged state
- **Multi-location Support**: Handles cross-location conflicts

### 2. Approval Workflows
- **Automatic Approval Requirements**: Based on configurable thresholds
- **Manager/Admin Approval**: Required for high-value items or critical conflicts
- **Revenue Impact Analysis**: Calculates potential revenue loss
- **Customer Impact Assessment**: Counts affected customers

### 3. Failsafe Mechanisms
- **Checkpoints**: Creates restore points before transitions
- **Rollback Capability**: Can undo transitions within 24-hour window
- **Audit Logging**: Complete trail of all actions
- **Business Rule Validation**: Ensures compliance with policies

### 4. Resolution Strategies
- `WAIT_FOR_RETURN`: Default - wait for rentals to complete
- `CANCEL_BOOKING`: Cancel future bookings with notification
- `TRANSFER_TO_ALTERNATIVE`: Offer alternative items to customers
- `OFFER_COMPENSATION`: Provide compensation for cancellations
- `POSTPONE_SALE`: Delay the sale transition
- `FORCE_SALE`: Override conflicts (requires special permission)

## API Endpoints

### Check Sale Eligibility
```http
GET /api/sales/items/{item_id}/sale-eligibility
Authorization: Bearer {token}
```

**Response:**
```json
{
  "eligible": true,
  "item_id": "uuid",
  "item_name": "Professional Camera",
  "conflicts": {
    "total_conflicts": 2,
    "by_type": {
      "ACTIVE_RENTAL": 1,
      "FUTURE_BOOKING": 1
    },
    "total_revenue_impact": 1500.00,
    "affected_customers": 2
  },
  "requires_approval": false,
  "recommendation": "Review conflicts before proceeding"
}
```

### Initiate Sale Transition
```http
POST /api/sales/items/{item_id}/initiate-sale
Authorization: Bearer {token}
Content-Type: application/json

{
  "sale_price": 5000.00,
  "effective_date": "2024-12-01",
  "resolution_strategy": "WAIT_FOR_RETURN",
  "notes": "Customer requested immediate sale"
}
```

### Confirm Transition
```http
POST /api/sales/transitions/{transition_id}/confirm
Authorization: Bearer {token}
Content-Type: application/json

{
  "confirmed": true,
  "resolution_overrides": {
    "{conflict_id}": "CANCEL_BOOKING"
  }
}
```

### Get Transition Status
```http
GET /api/sales/transitions/{transition_id}/status
Authorization: Bearer {token}
```

### Rollback Transition
```http
POST /api/sales/transitions/{transition_id}/rollback
Authorization: Bearer {token}
Content-Type: application/json

{
  "reason": "Customer changed their mind",
  "restore_bookings": true
}
```

### Manager Approval
```http
POST /api/sales/transitions/{transition_id}/approve
Authorization: Bearer {manager_token}
?approval_notes=Approved for immediate sale
```

### Manager Rejection
```http
POST /api/sales/transitions/{transition_id}/reject
Authorization: Bearer {manager_token}
?rejection_reason=Price too low for this item
```

## Workflow Examples

### Simple Transition (No Conflicts)
1. Check eligibility → No conflicts found
2. Initiate transition → Automatically completes
3. Item marked for sale

### Transition with Active Rental
1. Check eligibility → Active rental detected
2. Initiate transition → Status: PENDING
3. Review conflicts and choose resolution
4. Confirm transition with resolution strategy
5. System processes conflicts
6. Item marked for sale when rental returns

### High-Value Item Requiring Approval
1. Regular user initiates transition
2. System detects item value > $5000
3. Status: AWAITING_APPROVAL
4. Manager reviews and approves
5. Transition completes

### Emergency Rollback
1. Transition completed
2. Issue discovered
3. Rollback initiated within 24 hours
4. Item restored to rental status
5. Cancelled bookings reinstated

## Configuration

### Failsafe Thresholds (configurable)
```python
FailsafeConfiguration(
    revenue_threshold=1000.00,          # Require approval if revenue impact > $1000
    customer_threshold=5,                # Require approval if > 5 customers affected
    item_value_threshold=5000.00,       # Require approval for items > $5000
    future_booking_days_threshold=30,   # Consider bookings within 30 days
    rollback_window_hours=24,           # Allow rollback within 24 hours
    notification_grace_period_hours=48,  # Give customers 48 hours notice
    require_approval_for_critical=True  # Always require approval for critical conflicts
)
```

## Database Schema

### Main Tables
- `sale_transition_requests`: Main transition records
- `sale_conflicts`: Detected conflicts
- `sale_resolutions`: Conflict resolution actions
- `sale_notifications`: Customer notifications
- `transition_checkpoints`: Rollback restore points
- `sale_transition_audit`: Complete audit trail

## Testing

Run the comprehensive test suite:
```bash
# Run all sale transition tests
pytest tests/test_sales/ -v

# Run specific test categories
pytest tests/test_sales/test_conflict_detection.py -v
pytest tests/test_sales/test_failsafe_manager.py -v
pytest tests/test_sales/test_sales_api.py -v
pytest tests/test_sales/test_integration.py -v

# Run with coverage
pytest tests/test_sales/ --cov=app.modules.sales --cov-report=html
```

## Business Rules

### Eligibility Rules
1. Item must not already be marked for sale
2. Item must be rentable (non-rentable items have no conflicts)
3. User must have appropriate permissions

### Approval Requirements
Approval is required when:
- Revenue impact exceeds threshold ($1000 default)
- More than 5 customers affected
- Item value exceeds threshold ($5000 default)
- Critical conflicts detected (late rentals)
- User lacks sufficient authority

### Conflict Severity Levels
- **LOW**: Future bookings > 30 days away
- **MEDIUM**: Bookings 7-30 days away, active rentals
- **HIGH**: Bookings 3-7 days away, rentals ending soon
- **CRITICAL**: Late rentals, bookings < 3 days away

## Security Considerations

### Role-Based Access
- **USER**: Can initiate transitions for low-value items
- **MANAGER**: Can approve transitions, override conflicts
- **ADMIN**: Full access to all features

### Audit Trail
All actions are logged with:
- User ID and role
- Timestamp
- Action details
- IP address
- Before/after states

## Error Handling

### Common Errors
- `404 Not Found`: Item or transition not found
- `400 Bad Request`: Invalid request data
- `403 Forbidden`: Insufficient permissions
- `409 Conflict`: Business rule violation

### Recovery Procedures
1. **Failed Transition**: Use rollback within 24 hours
2. **Stuck in Processing**: Check audit logs, manually update status
3. **Conflict Resolution Failed**: Review individual conflicts, apply manual resolution

## Future Enhancements

### Planned Features
1. **Notification Engine**: Email/SMS notifications to affected customers
2. **Alternative Item Suggestions**: AI-powered recommendations
3. **Bulk Transitions**: Process multiple items simultaneously
4. **Custom Approval Workflows**: Department-specific approval chains
5. **Financial Forecasting**: Revenue impact predictions

### Integration Points
- **CRM System**: Customer communication tracking
- **Accounting**: Revenue recognition adjustments
- **Inventory Management**: Real-time stock updates
- **Analytics**: Transition success metrics

## Support

For issues or questions:
1. Check audit logs for detailed error information
2. Review conflict details in the database
3. Contact system administrator for rollback requests
4. Submit bug reports with transition IDs

## Appendix

### Status Flow Diagram
```
PENDING → PROCESSING → COMPLETED
   ↓         ↓           ↓
   ↓    AWAITING_APPROVAL   → REJECTED
   ↓         ↓
   ↓      APPROVED → PROCESSING → COMPLETED
   ↓
FAILED ← (any state) → ROLLED_BACK
```

### Conflict Resolution Matrix
| Conflict Type | Default Resolution | Alternative Options |
|--------------|-------------------|-------------------|
| Active Rental | Wait for Return | Postpone Sale |
| Future Booking | Cancel Booking | Transfer to Alternative, Offer Compensation |
| Late Rental | Wait for Return | Force Sale (requires approval) |
| Maintenance | Wait for Completion | Force Sale |
| Cross-Location | Consolidate Inventory | Transfer Units |