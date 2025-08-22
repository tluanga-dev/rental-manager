# Transaction Module API Documentation

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Sales Transactions](#sales-transactions)
4. [Rental Transactions](#rental-transactions)
5. [Purchase Returns](#purchase-returns)
6. [Reporting & Analytics](#reporting--analytics)
7. [Error Handling](#error-handling)
8. [Webhooks & Events](#webhooks--events)

## Overview

The Transaction Module provides comprehensive APIs for managing sales, rentals, and purchase returns with enterprise-grade features including:

- **Multi-transaction type support**: Sales, Rentals, Purchase Returns
- **Complete lifecycle management**: From creation to completion
- **Real-time inventory synchronization**
- **Financial control and credit management**
- **Event-driven architecture**
- **Comprehensive audit trails**

### Base URL
```
https://api.rentalmanager.com/api/v1/transactions
```

### API Version
Current Version: `v1`

### Rate Limiting
- **Standard tier**: 1000 requests per minute
- **Premium tier**: 5000 requests per minute
- **Enterprise tier**: Unlimited

## Authentication

All API endpoints require JWT authentication.

### Headers
```http
Authorization: Bearer <jwt_token>
X-Request-ID: <unique_request_id>
Content-Type: application/json
```

### Getting a Token
```http
POST /api/v1/auth/login
```

Request:
```json
{
  "username": "user@example.com",
  "password": "secure_password"
}
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

## Sales Transactions

### Create Sales Order
Creates a new sales transaction with items, discounts, and tax calculations.

```http
POST /api/v1/transactions/sales
```

Request Body:
```json
{
  "customer_id": "550e8400-e29b-41d4-a716-446655440000",
  "location_id": "660e8400-e29b-41d4-a716-446655440001",
  "reference_number": "SO-2024-001",
  "sales_date": "2024-01-15T10:00:00Z",
  "due_date": "2024-02-15T10:00:00Z",
  "payment_terms": "Net 30",
  "salesperson_id": "770e8400-e29b-41d4-a716-446655440002",
  "items": [
    {
      "item_id": "880e8400-e29b-41d4-a716-446655440003",
      "quantity": 5,
      "unit_price": "100.00",
      "discount_amount": "10.00",
      "tax_amount": "44.50"
    }
  ],
  "discounts": [
    {
      "discount_type": "PERCENTAGE",
      "value": "10.00",
      "reason": "Loyalty discount"
    }
  ],
  "shipping_address": "123 Main St, City, State 12345",
  "billing_address": "456 Oak Ave, City, State 12345",
  "notes": "Rush order - expedite shipping"
}
```

Response (201 Created):
```json
{
  "id": "990e8400-e29b-41d4-a716-446655440004",
  "transaction_number": "SO-2024-001",
  "customer_id": "550e8400-e29b-41d4-a716-446655440000",
  "customer_name": "John Doe",
  "status": "PENDING",
  "payment_status": "PENDING",
  "subtotal_amount": "500.00",
  "discount_amount": "50.00",
  "tax_amount": "44.50",
  "total_amount": "494.50",
  "items": [...],
  "created_at": "2024-01-15T10:00:00Z"
}
```

### Process Payment
Process payment for a sales order.

```http
POST /api/v1/transactions/sales/{sales_id}/payment
```

Request Body:
```json
{
  "amount": "494.50",
  "payment_method": "CREDIT_CARD",
  "payment_date": "2024-01-15T11:00:00Z",
  "reference_number": "CC-123456",
  "processor_response": {
    "transaction_id": "txn_1234567890",
    "approval_code": "ABC123"
  }
}
```

Response (200 OK):
```json
{
  "id": "aa0e8400-e29b-41d4-a716-446655440005",
  "payment_status": "PAID",
  "paid_amount": "494.50",
  "balance_amount": "0.00",
  "payment_method": "CREDIT_CARD",
  "reference_number": "CC-123456"
}
```

### Update Sales Status
Update the status of a sales order.

```http
PATCH /api/v1/transactions/sales/{sales_id}/status
```

Request Body:
```json
{
  "status": "SHIPPED",
  "notes": "Shipped via FedEx - Tracking: 1234567890"
}
```

## Rental Transactions

### Create Rental
Create a new rental reservation.

```http
POST /api/v1/transactions/rentals
```

Request Body:
```json
{
  "customer_id": "550e8400-e29b-41d4-a716-446655440000",
  "location_id": "660e8400-e29b-41d4-a716-446655440001",
  "reference_number": "RNT-2024-001",
  "rental_start_date": "2024-01-20T09:00:00Z",
  "rental_end_date": "2024-01-27T17:00:00Z",
  "items": [
    {
      "item_id": "bb0e8400-e29b-41d4-a716-446655440006",
      "quantity": 2,
      "daily_rate": "50.00",
      "weekly_rate": "300.00",
      "deposit_amount": "200.00",
      "insurance_amount": "25.00"
    }
  ],
  "delivery_required": true,
  "delivery_address": "789 Event Plaza, City, State 12345",
  "delivery_fee": "75.00",
  "insurance_required": true,
  "insurance_provider": "SafeRent Insurance",
  "insurance_policy_number": "POL-123456"
}
```

Response (201 Created):
```json
{
  "id": "cc0e8400-e29b-41d4-a716-446655440007",
  "transaction_number": "RNT-2024-001",
  "status": "RESERVED",
  "rental_start_date": "2024-01-20T09:00:00Z",
  "rental_end_date": "2024-01-27T17:00:00Z",
  "subtotal_amount": "300.00",
  "deposit_amount": "200.00",
  "insurance_amount": "25.00",
  "delivery_fee": "75.00",
  "total_amount": "600.00",
  "items": [...]
}
```

### Process Pickup
Confirm rental pickup and activate the rental.

```http
POST /api/v1/transactions/rentals/{rental_id}/pickup
```

Request Body:
```json
{
  "pickup_person_name": "John Doe",
  "pickup_person_id_type": "Driver License",
  "pickup_person_id_number": "DL123456789",
  "pickup_notes": "All items checked and in good condition",
  "items_condition_confirmed": true,
  "deposit_collected": true,
  "payment_collected": true
}
```

Response (200 OK):
```json
{
  "id": "cc0e8400-e29b-41d4-a716-446655440007",
  "status": "ACTIVE",
  "pickup_confirmed": true,
  "pickup_timestamp": "2024-01-20T09:15:00Z"
}
```

### Process Return
Process rental return with damage assessment.

```http
POST /api/v1/transactions/rentals/{rental_id}/return
```

Request Body:
```json
{
  "return_date": "2024-01-27T16:30:00Z",
  "return_person_name": "Jane Smith",
  "odometer_reading": 1250,
  "fuel_level": 75,
  "damages": [
    {
      "item_id": "bb0e8400-e29b-41d4-a716-446655440006",
      "damage_type": "PHYSICAL",
      "damage_severity": "MINOR",
      "damage_description": "Small scratch on surface",
      "repair_cost_estimate": "50.00",
      "photos": ["https://storage.example.com/damage1.jpg"]
    }
  ],
  "late_return": false,
  "items_returned": ["bb0e8400-e29b-41d4-a716-446655440006"]
}
```

Response (200 OK):
```json
{
  "rental_id": "cc0e8400-e29b-41d4-a716-446655440007",
  "return_date": "2024-01-27T16:30:00Z",
  "base_rental_charge": "300.00",
  "late_fees": "0.00",
  "damage_charges": "50.00",
  "total_charges": "350.00",
  "deposit_applied": "200.00",
  "deposit_refund": "150.00",
  "amount_due": "0.00",
  "return_status": "COMPLETED"
}
```

### Extend Rental
Extend an active rental period.

```http
POST /api/v1/transactions/rentals/{rental_id}/extend
```

Request Body:
```json
{
  "new_end_date": "2024-01-30T17:00:00Z",
  "reason": "Event extended for 3 more days",
  "maintain_current_rate": true
}
```

Response (200 OK):
```json
{
  "rental_id": "cc0e8400-e29b-41d4-a716-446655440007",
  "original_end_date": "2024-01-27T17:00:00Z",
  "new_end_date": "2024-01-30T17:00:00Z",
  "extension_days": 3,
  "rate_applied": "50.00",
  "additional_charge": "150.00",
  "new_total": "750.00",
  "approval_status": "APPROVED"
}
```

### Check Availability
Check item availability for rental period.

```http
POST /api/v1/transactions/rentals/check-availability
```

Request Body:
```json
{
  "item_id": "bb0e8400-e29b-41d4-a716-446655440006",
  "location_id": "660e8400-e29b-41d4-a716-446655440001",
  "start_date": "2024-02-01T09:00:00Z",
  "end_date": "2024-02-07T17:00:00Z",
  "quantity_needed": 2
}
```

Response (200 OK):
```json
{
  "item_id": "bb0e8400-e29b-41d4-a716-446655440006",
  "item_name": "Professional Camera Kit",
  "requested_quantity": 2,
  "available_quantity": 5,
  "is_available": true,
  "conflicts": null,
  "suggested_alternatives": null
}
```

## Purchase Returns

### Create Return
Create a purchase return for defective or wrong items.

```http
POST /api/v1/transactions/purchase-returns
```

Request Body:
```json
{
  "purchase_id": "dd0e8400-e29b-41d4-a716-446655440008",
  "supplier_id": "ee0e8400-e29b-41d4-a716-446655440009",
  "location_id": "660e8400-e29b-41d4-a716-446655440001",
  "reference_number": "PR-2024-001",
  "return_type": "DEFECTIVE",
  "rma_number": "RMA-123456",
  "items": [
    {
      "purchase_line_id": "ff0e8400-e29b-41d4-a716-446655440010",
      "item_id": "880e8400-e29b-41d4-a716-446655440003",
      "quantity": 5,
      "unit_cost": "100.00",
      "return_reason": "DEFECTIVE",
      "condition_rating": "POOR",
      "defect_description": "Units not powering on",
      "serial_numbers": ["SN001", "SN002", "SN003", "SN004", "SN005"]
    }
  ],
  "shipping_method": "FedEx Ground",
  "tracking_number": "TRACK123456",
  "return_shipping_cost": "25.00",
  "require_inspection": true
}
```

Response (201 Created):
```json
{
  "id": "111e8400-e29b-41d4-a716-446655440011",
  "return_number": "PR-2024-001",
  "status": "PENDING_INSPECTION",
  "return_type": "DEFECTIVE",
  "total_return_amount": "500.00",
  "inspection_required": true,
  "items": [...]
}
```

### Process Inspection
Submit inspection results for returned items.

```http
POST /api/v1/transactions/purchase-returns/{return_id}/inspection
```

Request Body:
```json
[
  {
    "return_line_id": "222e8400-e29b-41d4-a716-446655440012",
    "condition_verified": true,
    "condition_rating": "POOR",
    "damage_severity": "SEVERE",
    "disposition": "RETURN_TO_VENDOR",
    "inspection_notes": "Confirmed manufacturing defect",
    "inspector_id": "333e8400-e29b-41d4-a716-446655440013"
  }
]
```

Response (200 OK):
```json
{
  "id": "111e8400-e29b-41d4-a716-446655440011",
  "status": "INSPECTED",
  "inspection_completed": true,
  "inspection_date": "2024-01-16T14:30:00Z"
}
```

### Approve Return
Approve or reject a purchase return.

```http
POST /api/v1/transactions/purchase-returns/{return_id}/approve
```

Request Body:
```json
{
  "approved": true,
  "approval_notes": "Defective items confirmed, vendor credit approved",
  "approved_credit_amount": "500.00",
  "require_vendor_approval": false
}
```

Response (200 OK):
```json
{
  "id": "111e8400-e29b-41d4-a716-446655440011",
  "status": "APPROVED",
  "approved_credit_amount": "500.00",
  "approval_date": "2024-01-16T15:00:00Z",
  "approved_by": "333e8400-e29b-41d4-a716-446655440013"
}
```

## Reporting & Analytics

### Transaction Summary Report
Get summary of all transaction types for a period.

```http
GET /api/v1/transactions/reports/summary
```

Query Parameters:
- `start_date` (required): ISO 8601 date
- `end_date` (required): ISO 8601 date
- `location_id` (optional): Filter by location
- `group_by` (optional): day|week|month

Response (200 OK):
```json
{
  "period_start": "2024-01-01T00:00:00Z",
  "period_end": "2024-01-31T23:59:59Z",
  "total_sales": "125000.00",
  "total_rentals": "45000.00",
  "total_purchases": "85000.00",
  "total_returns": "5000.00",
  "transaction_count": {
    "sales": 250,
    "rentals": 150,
    "purchases": 75,
    "returns": 12
  },
  "daily_breakdown": [...]
}
```

### Sales Report
Detailed sales analytics.

```http
GET /api/v1/transactions/reports/sales
```

Query Parameters:
- `start_date` (required)
- `end_date` (required)
- `customer_id` (optional)
- `salesperson_id` (optional)
- `group_by` (optional): customer|item|salesperson

Response (200 OK):
```json
{
  "total_sales": "125000.00",
  "transaction_count": 250,
  "average_order_value": "500.00",
  "top_customers": [
    {
      "customer_id": "550e8400-e29b-41d4-a716-446655440000",
      "customer_name": "ABC Corporation",
      "total_purchases": "25000.00",
      "order_count": 15
    }
  ],
  "top_items": [...],
  "payment_methods": {
    "CREDIT_CARD": "75000.00",
    "BANK_TRANSFER": "35000.00",
    "CASH": "15000.00"
  }
}
```

### Rental Utilization Report
Track rental equipment utilization.

```http
GET /api/v1/transactions/reports/rentals/utilization
```

Query Parameters:
- `start_date` (required)
- `end_date` (required)
- `item_id` (optional)
- `category_id` (optional)

Response (200 OK):
```json
{
  "period": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-31T23:59:59Z"
  },
  "overall_utilization": 0.75,
  "items": [
    {
      "item_id": "bb0e8400-e29b-41d4-a716-446655440006",
      "item_name": "Professional Camera Kit",
      "total_available_days": 155,
      "total_rented_days": 120,
      "utilization_rate": 0.77,
      "revenue_generated": "6000.00"
    }
  ],
  "peak_periods": [...],
  "low_utilization_items": [...]
}
```

### Overdue Rentals
Get list of overdue rentals.

```http
GET /api/v1/transactions/reports/rentals/overdue
```

Response (200 OK):
```json
[
  {
    "rental_id": "444e8400-e29b-41d4-a716-446655440014",
    "transaction_number": "RNT-2024-015",
    "customer_name": "John Smith",
    "customer_phone": "+1234567890",
    "rental_end_date": "2024-01-25T17:00:00Z",
    "days_overdue": 3,
    "estimated_late_fees": "150.00",
    "items": [...]
  }
]
```

## Error Handling

### Error Response Format
All errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      {
        "field": "customer_id",
        "message": "Customer not found"
      }
    ],
    "request_id": "req_123456789",
    "timestamp": "2024-01-15T10:00:00Z"
  }
}
```

### Common Error Codes
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `AUTHENTICATION_REQUIRED` | 401 | Missing or invalid token |
| `INSUFFICIENT_PERMISSIONS` | 403 | User lacks required permissions |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource doesn't exist |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate) |
| `CREDIT_CHECK_FAILED` | 422 | Customer credit check failed |
| `STOCK_UNAVAILABLE` | 422 | Insufficient stock for order |
| `RENTAL_CONFLICT` | 422 | Item not available for rental period |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## Webhooks & Events

### Event Types
The system publishes the following events:

| Event | Description |
|-------|-------------|
| `transaction.created` | New transaction created |
| `transaction.updated` | Transaction updated |
| `transaction.cancelled` | Transaction cancelled |
| `payment.processed` | Payment processed |
| `rental.pickup` | Rental picked up |
| `rental.returned` | Rental returned |
| `rental.overdue` | Rental became overdue |
| `return.approved` | Purchase return approved |
| `return.credit_issued` | Vendor credit issued |

### Webhook Configuration
Configure webhooks to receive real-time notifications:

```http
POST /api/v1/webhooks
```

Request Body:
```json
{
  "url": "https://your-domain.com/webhooks/transactions",
  "events": [
    "transaction.created",
    "payment.processed",
    "rental.overdue"
  ],
  "secret": "webhook_secret_key",
  "active": true
}
```

### Event Payload Format
```json
{
  "event_id": "evt_123456789",
  "event_type": "transaction.created",
  "timestamp": "2024-01-15T10:00:00Z",
  "data": {
    "transaction_id": "990e8400-e29b-41d4-a716-446655440004",
    "transaction_type": "SALES",
    "transaction_number": "SO-2024-001",
    "customer_id": "550e8400-e29b-41d4-a716-446655440000",
    "total_amount": "494.50"
  }
}
```

### Webhook Security
All webhook requests include:
- `X-Webhook-Signature`: HMAC-SHA256 signature of the payload
- `X-Webhook-Timestamp`: Unix timestamp of the event
- `X-Webhook-Event-Id`: Unique event identifier

Verify webhook signatures:
```python
import hmac
import hashlib

def verify_webhook(payload, signature, secret):
    expected = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
```

## Pagination

List endpoints support pagination:

```http
GET /api/v1/transactions/sales?page=1&limit=20&sort=-created_at
```

Query Parameters:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `sort`: Sort field with `-` prefix for descending

Response includes pagination metadata:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 250,
    "pages": 13,
    "has_next": true,
    "has_prev": false
  }
}
```

## Testing

### Test Environment
Base URL: `https://api-test.rentalmanager.com/api/v1`

### Test Credentials
```
Username: test@rentalmanager.com
Password: test123456
```

### Sample Test Data
Test data is reset daily at 00:00 UTC.

Available test IDs:
- Customer: `test-customer-001`
- Location: `test-location-001`
- Items: `test-item-001` through `test-item-010`

### Postman Collection
Download the complete Postman collection:
[Transaction API Collection](https://api.rentalmanager.com/docs/postman/transactions.json)

## Support

For API support and questions:
- Email: api-support@rentalmanager.com
- Documentation: https://docs.rentalmanager.com/api
- Status Page: https://status.rentalmanager.com
- Developer Portal: https://developers.rentalmanager.com