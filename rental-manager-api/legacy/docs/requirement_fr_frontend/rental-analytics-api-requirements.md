# Rental Analytics API - Product Requirements Document

## Overview

This document outlines the comprehensive API requirements for the Rental Analytics service that will power the frontend analytics dashboard. The API should provide detailed insights into rental performance, item popularity, revenue trends, and business intelligence metrics.

## Business Context

The rental analytics API will serve the frontend analytics dashboard located at `/rentals/analytics` and provide data-driven insights to help business users:

- Identify most popular rental items
- Track revenue trends over time
- Analyze rental patterns and seasonality
- Monitor business performance metrics
- Make informed inventory and pricing decisions

## API Endpoints Required

### 1. Rental Analytics Summary

**Endpoint:** `GET /api/v1/rentals/analytics/summary`

**Purpose:** Provides high-level summary metrics for the analytics dashboard

**Query Parameters:**
- `time_range` (required): `month` | `year` | `custom`
- `start_date` (optional): ISO date string (required if time_range=custom)
- `end_date` (optional): ISO date string (required if time_range=custom)
- `location_id` (optional): Filter by specific location

**Response Schema:**
```json
{
  "data": {
    "total_rentals": 1250,
    "total_revenue": 2500000,
    "average_rental_value": 2000,
    "unique_customers": 450,
    "top_performer": {
      "item_id": "item_123",
      "item_name": "Wedding Tent (20x30)",
      "rental_count": 85,
      "revenue": 425000
    },
    "growth_metrics": {
      "rental_growth_percentage": 12.5,
      "revenue_growth_percentage": 15.2,
      "customer_growth_percentage": 8.7
    },
    "time_range": {
      "start_date": "2024-06-26",
      "end_date": "2024-07-26",
      "label": "Past Month"
    }
  },
  "success": true,
  "timestamp": "2024-07-26T10:30:00Z"
}
```

### 2. Most Rented Items

**Endpoint:** `GET /api/v1/rentals/analytics/top-items`

**Purpose:** Returns the most frequently rented items with detailed metrics

**Query Parameters:**
- `time_range` (required): `month` | `year` | `custom`
- `start_date` (optional): ISO date string
- `end_date` (optional): ISO date string
- `limit` (optional): Number of items to return (default: 20, max: 100)
- `category_id` (optional): Filter by item category
- `location_id` (optional): Filter by location

**Response Schema:**
```json
{
  "data": {
    "items": [
      {
        "rank": 1,
        "item_id": "item_123",
        "item_name": "Wedding Tent (20x30)",
        "category": {
          "id": "cat_001",
          "name": "Structures"
        },
        "metrics": {
          "total_rentals": 85,
          "total_revenue": 425000,
          "average_rental_duration": 2.5,
          "average_rental_value": 5000,
          "utilization_rate": 68.5,
          "customer_satisfaction_score": 4.8
        },
        "trend": {
          "previous_period_rentals": 72,
          "growth_percentage": 18.1,
          "trend_direction": "up"
        }
      }
    ],
    "total_items": 150,
    "pagination": {
      "page": 1,
      "limit": 20,
      "total_pages": 8
    }
  },
  "success": true
}
```

### 3. Revenue Trends

**Endpoint:** `GET /api/v1/rentals/analytics/revenue-trends`

**Purpose:** Provides time-series data for revenue and rental count trends

**Query Parameters:**
- `time_range` (required): `month` | `year` | `custom`
- `start_date` (optional): ISO date string
- `end_date` (optional): ISO date string
- `granularity` (optional): `daily` | `weekly` | `monthly` (auto-determined based on time_range if not specified)
- `location_id` (optional): Filter by location

**Response Schema:**
```json
{
  "data": {
    "trends": [
      {
        "period": "2024-07-01",
        "period_label": "Jul 01",
        "metrics": {
          "rental_count": 45,
          "total_revenue": 225000,
          "average_rental_value": 5000,
          "unique_customers": 32
        }
      },
      {
        "period": "2024-07-02",
        "period_label": "Jul 02",
        "metrics": {
          "rental_count": 52,
          "total_revenue": 260000,
          "average_rental_value": 5000,
          "unique_customers": 38
        }
      }
    ],
    "summary": {
      "total_periods": 30,
      "peak_period": {
        "period": "2024-07-15",
        "rental_count": 78,
        "revenue": 390000
      },
      "lowest_period": {
        "period": "2024-07-03",
        "rental_count": 12,
        "revenue": 60000
      }
    }
  },
  "success": true
}
```

### 4. Category Analytics

**Endpoint:** `GET /api/v1/rentals/analytics/categories`

**Purpose:** Provides rental distribution and performance by item categories

**Query Parameters:**
- `time_range` (required): `month` | `year` | `custom`
- `start_date` (optional): ISO date string
- `end_date` (optional): ISO date string
- `location_id` (optional): Filter by location

**Response Schema:**
```json
{
  "data": {
    "categories": [
      {
        "category_id": "cat_001",
        "category_name": "Furniture",
        "metrics": {
          "rental_count": 450,
          "revenue": 900000,
          "percentage_of_total_rentals": 35.2,
          "percentage_of_total_revenue": 38.5,
          "average_rental_value": 2000,
          "average_duration": 2.8
        },
        "top_items": [
          {
            "item_id": "item_456",
            "item_name": "Round Table (8-seater)",
            "rental_count": 120
          }
        ],
        "trend": {
          "growth_percentage": 15.3,
          "trend_direction": "up"
        }
      }
    ],
    "total_categories": 5
  },
  "success": true
}
```

### 5. Customer Analytics

**Endpoint:** `GET /api/v1/rentals/analytics/customers`

**Purpose:** Provides insights into customer rental patterns and top customers

**Query Parameters:**
- `time_range` (required): `month` | `year` | `custom`
- `start_date` (optional): ISO date string
- `end_date` (optional): ISO date string
- `limit` (optional): Number of customers to return (default: 10, max: 50)
- `location_id` (optional): Filter by location

**Response Schema:**
```json
{
  "data": {
    "top_customers": [
      {
        "customer_id": "cust_123",
        "customer_name": "ABC Events Ltd",
        "metrics": {
          "total_rentals": 25,
          "total_revenue": 125000,
          "average_rental_value": 5000,
          "total_rental_days": 75,
          "customer_lifetime_value": 500000
        },
        "recent_activity": {
          "last_rental_date": "2024-07-20",
          "rental_frequency": "weekly"
        }
      }
    ],
    "customer_segments": {
      "high_value": {
        "count": 45,
        "revenue_contribution": 60.5
      },
      "medium_value": {
        "count": 120,
        "revenue_contribution": 30.2
      },
      "low_value": {
        "count": 285,
        "revenue_contribution": 9.3
      }
    }
  },
  "success": true
}
```

### 6. Performance Insights

**Endpoint:** `GET /api/v1/rentals/analytics/insights`

**Purpose:** Provides AI-generated or rule-based business insights and recommendations

**Query Parameters:**
- `time_range` (required): `month` | `year` | `custom`
- `start_date` (optional): ISO date string
- `end_date` (optional): ISO date string
- `location_id` (optional): Filter by location

**Response Schema:**
```json
{
  "data": {
    "insights": [
      {
        "type": "trend",
        "priority": "high",
        "title": "Peak Category Performance",
        "description": "Furniture items dominate rentals with 35% market share",
        "metric": {
          "value": 35,
          "unit": "percentage",
          "trend": "stable"
        },
        "recommendation": "Consider expanding furniture inventory for peak seasons"
      },
      {
        "type": "growth",
        "priority": "medium",
        "title": "Revenue Growth Trend",
        "description": "Revenue increasing steadily month-over-month",
        "metric": {
          "value": 12,
          "unit": "percentage",
          "trend": "up"
        },
        "recommendation": "Maintain current pricing strategy and marketing efforts"
      }
    ],
    "key_metrics": {
      "peak_rental_day": "Saturday",
      "average_rental_duration": 2.5,
      "seasonal_trend": "summer_peak",
      "inventory_utilization": 72.3
    }
  },
  "success": true
}
```

## Technical Requirements

### Authentication & Authorization
- All endpoints require valid JWT authentication
- Users must have `RENTAL_VIEW` permission to access analytics data
- Admin users can access all location data, regular users only their assigned locations

### Performance Requirements
- Response time: < 2 seconds for all endpoints
- Support for concurrent requests: minimum 100 requests/minute
- Data caching: Implement Redis caching for frequently accessed data (TTL: 15 minutes)
- Database optimization: Use appropriate indexes and query optimization

### Data Requirements
- **Data Freshness**: Analytics data should be updated every 15 minutes
- **Historical Data**: Support for at least 2 years of historical data
- **Data Accuracy**: All financial calculations must be precise to 2 decimal places
- **Time Zones**: All timestamps should be in UTC, with timezone conversion handled by frontend

### Error Handling
- Consistent error response format across all endpoints
- Proper HTTP status codes (200, 400, 401, 403, 404, 500)
- Detailed error messages for debugging
- Rate limiting: 1000 requests per hour per user

### Validation Rules
- Date ranges cannot exceed 2 years
- Start date must be before end date
- Time range parameter is mandatory
- Limit parameters must be within specified bounds

## Database Considerations

### Required Tables/Collections
1. **rentals** - Core rental transaction data
2. **rental_items** - Individual items in each rental
3. **items** - Item master data with categories
4. **customers** - Customer information
5. **categories** - Item categories
6. **locations** - Business locations

### Recommended Indexes
```sql
-- For rental analytics queries
CREATE INDEX idx_rentals_created_date ON rentals(created_at);
CREATE INDEX idx_rentals_status_date ON rentals(status, created_at);
CREATE INDEX idx_rental_items_item_date ON rental_items(item_id, created_at);
CREATE INDEX idx_rentals_customer_date ON rentals(customer_id, created_at);
CREATE INDEX idx_rentals_location_date ON rentals(location_id, created_at);
```

### Data Aggregation Strategy
- Consider implementing materialized views or summary tables for frequently accessed metrics
- Use background jobs to pre-calculate daily/monthly aggregations
- Implement incremental updates for real-time data

## API Response Standards

### Success Response Format
```json
{
  "data": { /* response data */ },
  "success": true,
  "timestamp": "2024-07-26T10:30:00Z",
  "meta": {
    "request_id": "req_123456",
    "execution_time_ms": 245
  }
}
```

### Error Response Format
```json
{
  "error": {
    "code": "INVALID_DATE_RANGE",
    "message": "Start date must be before end date",
    "details": {
      "start_date": "2024-07-26",
      "end_date": "2024-07-20"
    }
  },
  "success": false,
  "timestamp": "2024-07-26T10:30:00Z"
}
```

## Testing Requirements

### Unit Tests
- Test all calculation logic for metrics
- Validate date range handling
- Test permission and authorization logic

### Integration Tests
- Test complete API workflows
- Validate database query performance
- Test caching mechanisms

### Performance Tests
- Load testing with realistic data volumes
- Stress testing for concurrent users
- Memory and CPU usage monitoring

## Monitoring & Logging

### Required Metrics
- API response times per endpoint
- Error rates and types
- Database query performance
- Cache hit/miss rates
- User access patterns

### Logging Requirements
- Log all API requests with user context
- Log slow queries (>1 second)
- Log authentication failures
- Log data inconsistencies

## Deployment Considerations

### Environment Variables
```
ANALYTICS_CACHE_TTL=900  # 15 minutes
ANALYTICS_MAX_DATE_RANGE_DAYS=730  # 2 years
ANALYTICS_DEFAULT_LIMIT=20
ANALYTICS_MAX_LIMIT=100
```

### Dependencies
- Redis for caching
- Database connection pooling
- Background job processor (for data aggregation)

## Future Enhancements

1. **Real-time Analytics**: WebSocket support for live updates
2. **Export Functionality**: PDF/Excel export of analytics data
3. **Custom Dashboards**: User-configurable analytics views
4. **Predictive Analytics**: ML-based demand forecasting
5. **Comparative Analytics**: Year-over-year, location comparisons

## Success Criteria

1. All endpoints respond within 2 seconds under normal load
2. 99.9% uptime for analytics services
3. Data accuracy verified against source transactions
4. Successful integration with frontend analytics dashboard
5. Positive user feedback on analytics insights quality

---

**Document Version:** 1.0  
**Last Updated:** July 26, 2024  
**Next Review:** August 26, 2024