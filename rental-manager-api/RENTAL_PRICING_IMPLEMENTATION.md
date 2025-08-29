# Rental Pricing System Implementation

## Overview
A comprehensive rental pricing system has been implemented that supports flexible, tiered pricing strategies for rental items. This system allows for complex pricing rules based on rental duration, with support for daily, weekly, monthly, and custom pricing periods.

## Key Features

### 1. Flexible Pricing Tiers
- **Multiple Pricing Periods**: Support for HOURLY, DAILY, WEEKLY, MONTHLY, and CUSTOM periods
- **Duration-Based Pricing**: Different rates for different rental durations (e.g., cheaper weekly rates for 7+ day rentals)
- **Priority System**: Automatic selection of best pricing tier based on priority and cost optimization
- **Seasonal Adjustments**: Built-in seasonal multiplier for peak/off-peak pricing

### 2. Pricing Strategies
- **FIXED**: Standard fixed rate regardless of duration
- **TIERED**: Different rates for different duration ranges
- **SEASONAL**: Season-based price adjustments
- **DYNAMIC**: Demand-based pricing (future enhancement)

### 3. Business Rules
- Minimum and maximum rental duration constraints per tier
- Effective and expiry dates for time-limited promotions
- Default pricing tier designation for quick calculations
- Automatic fallback to item's base daily rate if no structured pricing exists

## Architecture Components

### Models
- **`app/models/rental_pricing.py`**: Core RentalPricing model with comprehensive constraints and validations
- **Item Model Updates**: Added relationship to rental_pricing with helper methods for pricing calculations

### Services
- **`app/services/rental_pricing_service.py`**: Business logic for pricing calculations and management
- **Pricing Optimization**: Multiple strategies (LOWEST_COST, HIGHEST_MARGIN, BALANCED, CUSTOMER_FRIENDLY)

### API Endpoints
- **`app/api/v1/endpoints/rental_pricing.py`**: RESTful endpoints for CRUD and calculations

### Database
- **Migration**: `alembic/versions/20250829_1650-bf1521b86fd0_add_rental_pricing_table.py`
- **Indexes**: Optimized for common queries (item lookup, duration matching, priority sorting)

## API Endpoints

### Core CRUD Operations
- `POST /api/v1/rental-pricing/` - Create a pricing tier
- `GET /api/v1/rental-pricing/{pricing_id}` - Get specific pricing tier
- `PUT /api/v1/rental-pricing/{pricing_id}` - Update pricing tier
- `DELETE /api/v1/rental-pricing/{pricing_id}` - Delete pricing tier
- `GET /api/v1/rental-pricing/` - List pricing with filters

### Item-Specific Operations
- `GET /api/v1/rental-pricing/item/{item_id}` - Get all pricing for an item
- `GET /api/v1/rental-pricing/item/{item_id}/summary` - Get pricing summary
- `POST /api/v1/rental-pricing/standard-template/{item_id}` - Create standard pricing structure

### Bulk Operations
- `POST /api/v1/rental-pricing/bulk` - Create multiple pricing tiers
- `POST /api/v1/rental-pricing/calculate/bulk` - Calculate pricing for multiple items

### Pricing Calculations
- `POST /api/v1/rental-pricing/calculate` - Calculate optimal pricing for rental duration
- `GET /api/v1/rental-pricing/analysis/{item_id}` - Analyze pricing performance

### Migration Tools
- `POST /api/v1/rental-pricing/migrate/{item_id}` - Migrate item from simple to structured pricing

## Usage Examples

### 1. Create Standard Pricing Structure
```python
# Create daily/weekly/monthly pricing for an item
POST /api/v1/rental-pricing/standard-template/{item_id}
{
    "daily_rate": 50.00,
    "weekly_rate": 300.00,  # Or use weekly_discount_percentage: 15
    "monthly_rate": 1000.00  # Or use monthly_discount_percentage: 25
}
```

### 2. Create Custom Pricing Tier
```python
POST /api/v1/rental-pricing/
{
    "item_id": "uuid-here",
    "tier_name": "Weekend Special",
    "period_type": "DAILY",
    "period_days": 1,
    "rate_per_period": 40.00,
    "min_rental_days": 2,
    "max_rental_days": 3,
    "effective_date": "2024-01-01",
    "expiry_date": "2024-12-31",
    "priority": 5
}
```

### 3. Calculate Rental Pricing
```python
POST /api/v1/rental-pricing/calculate
{
    "item_id": "uuid-here",
    "rental_days": 10,
    "calculation_date": "2024-03-15"
}

# Response includes:
# - Applicable pricing tiers
# - Recommended tier (lowest cost)
# - Total cost
# - Daily equivalent rate
# - Savings compared to daily rate
```

## Database Schema

```sql
CREATE TABLE rental_pricing (
    id UUID PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES items(id),
    tier_name VARCHAR(100) NOT NULL,
    period_type VARCHAR(20) NOT NULL DEFAULT 'DAILY',
    period_days INTEGER NOT NULL DEFAULT 1,
    rate_per_period NUMERIC(15,2) NOT NULL,
    min_rental_days INTEGER,
    max_rental_days INTEGER,
    effective_date DATE NOT NULL,
    expiry_date DATE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    pricing_strategy VARCHAR(20) NOT NULL DEFAULT 'FIXED',
    seasonal_multiplier NUMERIC(5,2) NOT NULL DEFAULT 1.00,
    priority INTEGER NOT NULL DEFAULT 100,
    description VARCHAR(500),
    notes VARCHAR(1000),
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    -- Constraints
    UNIQUE(item_id, tier_name, effective_date),
    CHECK(period_days > 0),
    CHECK(rate_per_period >= 0),
    CHECK(min_rental_days IS NULL OR min_rental_days > 0),
    CHECK(max_rental_days IS NULL OR max_rental_days > 0),
    CHECK(min_rental_days IS NULL OR max_rental_days IS NULL OR min_rental_days <= max_rental_days)
);
```

## Performance Optimizations

### Indexes
- `idx_rental_pricing_item_active` - Fast lookup by item
- `idx_rental_pricing_duration_match` - Efficient duration-based queries
- `idx_rental_pricing_lookup` - Composite index for pricing calculations
- `idx_rental_pricing_priority` - Quick priority-based sorting

### Query Optimization
- Minimal joins for pricing calculations
- Efficient filtering with composite indexes
- Cached calculations for frequently accessed items

## Integration Points

### With Item Model
```python
# Item model has helper methods:
item.get_best_rental_rate(rental_days=7)  # Returns total cost
item.get_daily_equivalent_rate(rental_days=7)  # Returns daily rate
item.has_structured_pricing()  # Check if pricing tiers exist
```

### With Rental Service
The rental service can use the new pricing system:
```python
from app.services.rental_pricing_service import RentalPricingService

# In rental creation:
pricing_service = RentalPricingService(db)
pricing_result = await pricing_service.calculate_rental_pricing(
    item_id=item.id,
    rental_days=rental_days
)
rental_cost = pricing_result.total_cost
```

## Migration Path

For existing items with simple `rental_rate_per_day`:

1. **Keep existing field**: The `rental_rate_per_day` field remains as a fallback
2. **Gradual migration**: Use the migrate endpoint to create structured pricing
3. **Backward compatible**: System checks structured pricing first, falls back to daily rate
4. **Batch migration**: Script available for bulk migration of all items

## Benefits

1. **Flexibility**: Support for any pricing model (daily, weekly, monthly, custom)
2. **Customer Savings**: Automatic selection of best price for rental duration
3. **Business Intelligence**: Track which pricing tiers are most effective
4. **Promotional Support**: Time-limited pricing with effective/expiry dates
5. **Scalability**: Efficient queries with proper indexing
6. **Maintainability**: Clean separation of pricing logic from item model

## Future Enhancements

1. **Dynamic Pricing**: Integrate with demand forecasting
2. **Bundle Pricing**: Special rates for item bundles
3. **Customer-Specific Pricing**: Tier-based or negotiated rates
4. **Currency Support**: Multi-currency pricing
5. **Pricing Rules Engine**: Complex conditional pricing rules
6. **A/B Testing**: Test different pricing strategies
7. **Analytics Dashboard**: Visual pricing performance metrics

## Testing

The implementation includes:
- Unit tests for model validations
- Integration tests for service layer
- API endpoint tests
- Performance tests for large datasets

## Notes

- The system is designed to handle 10,000+ pricing tiers efficiently
- All monetary values use NUMERIC(15,2) for precision
- UTC timestamps used throughout for consistency
- Soft delete pattern available but not enforced