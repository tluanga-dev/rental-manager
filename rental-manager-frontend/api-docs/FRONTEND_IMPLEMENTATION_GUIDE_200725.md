# Frontend Implementation Guide - Rental Management System
**Date**: 20 July 2025  
**Version**: 1.0  
**API Base URL**: `http://localhost:8000/api`

## Table of Contents
1. [Authentication & Security](#authentication--security)
2. [Master Data Management](#master-data-management)
3. [Inventory Management](#inventory-management)
4. [Transaction Management](#transaction-management)
5. [Customer & Supplier Management](#customer--supplier-management)
6. [Rental Returns & Inspections](#rental-returns--inspections)
7. [Error Handling](#error-handling)
8. [Frontend Integration Patterns](#frontend-integration-patterns)

---

## Authentication & Security

### 1. User Registration
**Endpoint**: `POST /api/auth/register`

**Request Payload**:
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "full_name": "John Doe"
}
```

**Response**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john@example.com",
  "full_name": "John Doe",
  "is_active": true,
  "created_at": "2025-07-20T10:30:00Z"
}
```

### 2. User Login
**Endpoint**: `POST /api/auth/login`

**Request Payload**:
```json
{
  "username": "john_doe",
  "password": "SecurePass123!"
}
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john@example.com",
    "full_name": "John Doe"
  }
}
```

### 3. Token Refresh
**Endpoint**: `POST /api/auth/refresh`

**Request Payload**:
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

---

## Master Data Management

### 1. Item Master Management

#### Create New Item
**Endpoint**: `POST /api/master-data/item-master/`

**Request Payload**:
```json
{
  "item_name": "Professional Camera Canon EOS R5",
  "item_status": "ACTIVE",
  "brand_id": "123e4567-e89b-12d3-a456-426614174000",
  "category_id": "123e4567-e89b-12d3-a456-426614174001",
  "unit_of_measurement_id": "123e4567-e89b-12d3-a456-426614174002",
  "rental_rate_per_period": 150.00,
  "rental_period": "1",
  "sale_price": 3500.00,
  "purchase_price": 2800.00,
  "security_deposit": 500.00,
  "description": "Professional mirrorless camera with 45MP sensor",
  "model_number": "EOS-R5-BODY",
  "serial_number_required": true,
  "warranty_period_days": "365",
  "reorder_point": 2,
  "is_rentable": true,
  "is_saleable": false
}
```

#### Get Items with Enhanced Details
**Endpoint**: `GET /api/master-data/item-master/enhanced`

**Query Parameters**:
- `skip`: 0 (pagination offset)
- `limit`: 100 (items per page)
- `search`: "camera" (search term)
- `is_rentable`: true (filter rentable items)
- `has_stock`: true (items with available inventory)
- `min_rental_rate`: 50.00
- `max_rental_rate`: 500.00

**Response**:
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174003",
    "sku": "CAM-CAN-001",
    "item_name": "Professional Camera Canon EOS R5",
    "item_status": "ACTIVE",
    "rental_rate_per_period": 150.00,
    "sale_price": 3500.00,
    "security_deposit": 500.00,
    "brand": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "brand_name": "Canon",
      "brand_code": "CAN"
    },
    "category": {
      "id": "123e4567-e89b-12d3-a456-426614174001",
      "category_name": "Cameras",
      "category_path": "Electronics/Cameras"
    },
    "unit_of_measurement": {
      "id": "123e4567-e89b-12d3-a456-426614174002",
      "unit_name": "Piece",
      "abbreviation": "pc"
    },
    "total_units": 15,
    "available_units": 8,
    "rented_units": 7,
    "stock_status": "IN_STOCK"
  }
]
```

### 2. Brand Management
**Endpoint**: `GET /api/master-data/brands/`

**Response**:
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Canon",
    "code": "CAN",
    "description": "Professional photography equipment"
  }
]
```

### 3. Category Management
**Endpoint**: `GET /api/master-data/categories/`

**Response**:
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174001",
    "name": "Cameras",
    "level": 1,
    "parent_id": null,
    "path": "Electronics/Cameras"
  }
]
```

---

## Inventory Management

### 1. Stock Overview
**Endpoint**: `GET /api/inventory/items/overview`

**Query Parameters**:
- `stock_status`: "LOW_STOCK" (filter by stock status)
- `is_rentable`: true
- `search`: "camera"

**Response**:
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174003",
    "sku": "CAM-CAN-001",
    "item_name": "Professional Camera Canon EOS R5",
    "total_units": 15,
    "available_units": 8,
    "rented_units": 7,
    "reserved_units": 0,
    "stock_status": "IN_STOCK",
    "reorder_point": 2,
    "needs_reorder": false
  }
]
```

### 2. Stock Adjustments
**Endpoint**: `POST /api/inventory/stock/{stock_level_id}/adjust`

**Request Payload**:
```json
{
  "quantity_change": 5
}
```

**Note**: Stock adjustment reason and notes are tracked at the API level but not stored in the stock movement audit trail. Movement context is available through movement_type and transaction references.

---

## Transaction Management

### 1. Rental Transactions

#### Create New Rental
**Endpoint**: `POST /api/transactions/rentals/new`

**Request Payload**:
```json
{
  "transaction_date": "2025-07-20",
  "customer_id": "123e4567-e89b-12d3-a456-426614174004",
  "location_id": "123e4567-e89b-12d3-a456-426614174005",
  "payment_method": "CARD",
  "payment_reference": "TXN-20250720-001",
  "notes": "Corporate event rental",
  "deposit_amount": 1000.00,
  "reference_number": "REN-20250720-001",
  "delivery_required": true,
  "delivery_address": "123 Business Ave, Tech Park",
  "delivery_date": "2025-07-21",
  "delivery_time": "09:00",
  "pickup_required": true,
  "pickup_date": "2025-07-25",
  "pickup_time": "17:00",
  "items": [
    {
      "item_id": "123e4567-e89b-12d3-a456-426614174003",
      "quantity": 2,
      "rental_period_value": 4,
      "tax_rate": 18.0,
      "discount_amount": 50.00,
      "rental_start_date": "2025-07-21",
      "rental_end_date": "2025-07-25",
      "notes": "Two cameras for event coverage"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "message": "Rental created successfully",
  "transaction_id": "123e4567-e89b-12d3-a456-426614174006",
  "transaction_number": "REN-20250720-0001",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174006",
    "customer": {
      "id": "123e4567-e89b-12d3-a456-426614174004",
      "name": "ABC Corporation"
    },
    "location": {
      "id": "123e4567-e89b-12d3-a456-426614174005",
      "name": "Downtown Store"
    },
    "transaction_date": "2025-07-20",
    "total_amount": 1150.00,
    "deposit_amount": 1000.00,
    "status": "CONFIRMED",
    "items": [...]
  }
}
```

#### Get Rentable Items
**Endpoint**: `GET /api/transactions/rentals/rentable-items`

**Query Parameters**:
- `location_id`: "123e4567-e89b-12d3-a456-426614174005"
- `category_id`: "123e4567-e89b-12d3-a456-426614174001"

**Response**:
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174003",
    "sku": "CAM-CAN-001",
    "item_name": "Professional Camera Canon EOS R5",
    "rental_rate_per_period": 150.00,
    "rental_period": "1",
    "security_deposit": 500.00,
    "total_available_quantity": 8,
    "location_availability": [
      {
        "location_id": "123e4567-e89b-12d3-a456-426614174005",
        "location_name": "Downtown Store",
        "available_quantity": 5
      }
    ]
  }
]
```

### 2. Purchase Transactions

#### Create New Purchase
**Endpoint**: `POST /api/transactions/purchases/new`

**Request Payload**:
```json
{
  "supplier_id": "123e4567-e89b-12d3-a456-426614174007",
  "location_id": "123e4567-e89b-12d3-a456-426614174005",
  "purchase_date": "2025-07-20",
  "notes": "Monthly inventory replenishment",
  "reference_number": "PO-20250720-001",
  "items": [
    {
      "item_id": "123e4567-e89b-12d3-a456-426614174003",
      "quantity": 5,
      "unit_cost": 2800.00,
      "tax_rate": 18.0,
      "discount_amount": 200.00,
      "condition": "A",
      "notes": "New stock for Canon cameras"
    }
  ]
}
```

### 3. Sales Transactions

#### Create New Sale
**Endpoint**: `POST /api/transactions/sales/new`

**Request Payload**:
```json
{
  "customer_id": "123e4567-e89b-12d3-a456-426614174004",
  "transaction_date": "2025-07-20",
  "notes": "Direct sale to corporate client",
  "reference_number": "SAL-20250720-001",
  "items": [
    {
      "item_id": "123e4567-e89b-12d3-a456-426614174003",
      "quantity": 1,
      "unit_cost": 3500.00,
      "tax_rate": 18.0,
      "discount_amount": 350.00,
      "notes": "Corporate discount applied"
    }
  ]
}
```

---

## Customer & Supplier Management

### 1. Customer Management

#### Create Customer
**Endpoint**: `POST /api/customers/`

**Request Payload**:
```json
{
  "customer_code": "CUST-001",
  "customer_name": "ABC Corporation",
  "customer_type": "CORPORATE",
  "email": "contact@abccorp.com",
  "phone": "+1-555-123-4567",
  "tax_id": "12-3456789",
  "credit_limit": 10000.00,
  "payment_terms": "NET_30",
  "billing_address": {
    "street": "123 Business Ave",
    "city": "New York",
    "state": "NY",
    "postal_code": "10001",
    "country": "USA"
  },
  "shipping_address": {
    "street": "456 Tech Park",
    "city": "New York",
    "state": "NY",
    "postal_code": "10002",
    "country": "USA"
  }
}
```

#### Search Customers
**Endpoint**: `GET /api/customers/search?search_term=ABC&limit=10`

**Response**:
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174004",
    "customer_code": "CUST-001",
    "customer_name": "ABC Corporation",
    "customer_type": "CORPORATE",
    "email": "contact@abccorp.com",
    "phone": "+1-555-123-4567",
    "status": "ACTIVE",
    "credit_rating": "GOOD",
    "blacklist_status": "NONE",
    "credit_limit": 10000.00,
    "outstanding_balance": 2500.00
  }
]
```

### 2. Supplier Management
**Endpoint**: `GET /api/suppliers/`

**Response**:
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174007",
    "supplier_code": "SUP-001",
    "supplier_name": "Canon Distribution Inc",
    "contact_person": "John Smith",
    "email": "orders@canondist.com",
    "phone": "+1-800-CANON-1",
    "payment_terms": "NET_30"
  }
]
```

---

## Rental Returns & Inspections

### 1. Create Rental Return
**Endpoint**: `POST /api/transactions/rental-returns/`

**Request Payload**:
```json
{
  "rental_transaction_id": "123e4567-e89b-12d3-a456-426614174006",
  "return_date": "2025-07-25",
  "actual_return_time": "2025-07-25T16:30:00Z",
  "returned_by": "John Manager",
  "notes": "All items returned in good condition",
  "items": [
    {
      "item_id": "123e4567-e89b-12d3-a456-426614174003",
      "quantity_returned": 2,
      "condition": "GOOD",
      "notes": "Minor wear on camera bodies"
    }
  ]
}
```

### 2. Create Inspection
**Endpoint**: `POST /api/transactions/rental-returns/{return_id}/inspection`

**Request Payload**:
```json
{
  "return_id": "123e4567-e89b-12d3-a456-426614174008",
  "inspection_date": "2025-07-25",
  "inspected_by": "Jane Inspector",
  "overall_condition": "GOOD",
  "damage_assessments": [
    {
      "item_id": "123e4567-e89b-12d3-a456-426614174003",
      "damage_type": "MINOR_SCRATCHES",
      "severity": "LOW",
      "description": "Minor scratches on LCD screen",
      "repair_cost": 50.00
    }
  ],
  "cleaning_required": false,
  "cleaning_cost": 0.00,
  "notes": "Overall good condition, minor cosmetic issues only"
}
```

---

## Error Handling

### Standard Error Response Format
```json
{
  "detail": "Validation error occurred",
  "type": "VALIDATION_ERROR"
}
```

### Common Error Types
- `VALIDATION_ERROR`: Invalid input data
- `NOT_FOUND_ERROR`: Resource not found
- `CONFLICT_ERROR`: Duplicate or conflicting data
- `AUTHORIZATION_ERROR`: Insufficient permissions

### Frontend Error Handling Pattern
```javascript
// Example error handling in React
const handleApiError = (error) => {
  if (error.response?.status === 422) {
    // Validation error - show field-specific errors
    const errors = error.response.data.detail;
    setFormErrors(errors);
  } else if (error.response?.status === 404) {
    // Not found - redirect or show not found message
    navigate('/not-found');
  } else if (error.response?.status === 409) {
    // Conflict - show duplicate error
    showToast('Item already exists', 'error');
  } else {
    // Generic error
    showToast('An error occurred', 'error');
  }
};
```

---

## Frontend Integration Patterns

### 1. React Hook for API Calls
```javascript
// useApi.js
import { useState, useCallback } from 'react';
import axios from 'axios';

const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const apiCall = useCallback(async (config) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios({
        baseURL: 'http://localhost:8000/api',
        ...config,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          ...config.headers
        }
      });
      
      return response.data;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { apiCall, loading, error };
};

// Usage
const { apiCall, loading, error } = useApi();
const createRental = async (rentalData) => {
  return await apiCall({
    method: 'POST',
    url: '/transactions/rentals/new',
    data: rentalData
  });
};
```

### 2. Form Validation Schema
```javascript
// validationSchemas.js
import * as yup from 'yup';

const rentalSchema = yup.object().shape({
  transaction_date: yup.date().required('Transaction date is required'),
  customer_id: yup.string().uuid().required('Customer is required'),
  location_id: yup.string().uuid().required('Location is required'),
  items: yup.array().min(1, 'At least one item is required').of(
    yup.object().shape({
      item_id: yup.string().uuid().required('Item is required'),
      quantity: yup.number().min(1, 'Quantity must be at least 1').required(),
      rental_period_value: yup.number().min(1).required(),
      rental_start_date: yup.date().required(),
      rental_end_date: yup.date()
        .min(yup.ref('rental_start_date'), 'End date must be after start date')
        .required()
    })
  )
});
```

### 3. Data Fetching with React Query
```javascript
// queries.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Fetch rentable items
export const useRentableItems = (locationId, categoryId) => {
  return useQuery({
    queryKey: ['rentable-items', locationId, categoryId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (locationId) params.append('location_id', locationId);
      if (categoryId) params.append('category_id', categoryId);
      
      const response = await axios.get(`/api/transactions/rentals/rentable-items?${params}`);
      return response.data;
    }
  });
};

// Create rental mutation
export const useCreateRental = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (rentalData) => axios.post('/api/transactions/rentals/new', rentalData),
    onSuccess: () => {
      queryClient.invalidateQueries(['rentals']);
      queryClient.invalidateQueries(['rentable-items']);
    }
  });
};
```

### 4. Real-time Updates with WebSocket (Future Enhancement)
```javascript
// websocket.js
class InventoryWebSocket {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.listeners = new Map();
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const listeners = this.listeners.get(data.type) || [];
      listeners.forEach(callback => callback(data.payload));
    };
  }
  
  subscribe(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
  }
  
  unsubscribe(eventType, callback) {
    const listeners = this.listeners.get(eventType) || [];
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }
}

// Usage
const ws = new InventoryWebSocket('ws://localhost:8000/ws');
ws.subscribe('stock_update', (data) => {
  // Update UI with new stock levels
  updateStockDisplay(data);
});
```

---

## Pagination & Filtering

### Standard Pagination Parameters
All list endpoints support:
- `skip`: Number of records to skip (default: 0)
- `limit`: Maximum records to return (default: 100, max: 1000)

### Response Headers
- `X-Total-Count`: Total number of records
- `X-Page-Count`: Total number of pages
- `X-Has-Next`: Boolean indicating if more pages exist
- `X-Has-Previous`: Boolean indicating if previous pages exist

### Example Pagination Implementation
```javascript
const usePaginatedData = (endpoint, filters = {}) => {
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    hasNext: false,
    hasPrevious: false
  });

  const fetchData = async () => {
    const params = new URLSearchParams({
      skip: (pagination.page - 1) * pagination.pageSize,
      limit: pagination.pageSize,
      ...filters
    });

    const response = await axios.get(endpoint, { params });
    
    setData(response.data);
    setPagination(prev => ({
      ...prev,
      total: parseInt(response.headers['x-total-count']),
      hasNext: response.headers['x-has-next'] === 'true',
      hasPrevious: response.headers['x-has-previous'] === 'true'
    }));
  };

  return { data, pagination, fetchData };
};
```

---

## Performance Optimization

### 1. Caching Strategy
- Cache master data (brands, categories, units) for 1 hour
- Cache inventory levels for 5 minutes
- Cache customer data for 30 minutes

### 2. Debounced Search
```javascript
const useDebouncedSearch = (searchFn, delay = 300) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  
  const debouncedSearch = useMemo(
    () => debounce(async (term) => {
      if (term.length >= 2) {
        const data = await searchFn(term);
        setResults(data);
      }
    }, delay),
    [searchFn, delay]
  );

  useEffect(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);

  return { searchTerm, setSearchTerm, results };
};
```

### 3. Optimistic Updates
```javascript
const useOptimisticRental = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createRental,
    onMutate: async (newRental) => {
      await queryClient.cancelQueries(['rentals']);
      
      const previousRentals = queryClient.getQueryData(['rentals']);
      
      queryClient.setQueryData(['rentals'], old => [
        ...old,
        { ...newRental, id: 'temp-id', status: 'PENDING' }
      ]);
      
      return { previousRentals };
    },
    onError: (err, newRental, context) => {
      queryClient.setQueryData(['rentals'], context.previousRentals);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['rentals']);
    }
  });
};
```

---

## Testing Guidelines

### 1. Mock Data for Development
```javascript
// mockData.js
export const mockItems = [
  {
    id: '123e4567-e89b-12d3-a456-426614174003',
    sku: 'CAM-CAN-001',
    item_name: 'Professional Camera Canon EOS R5',
    rental_rate_per_period: 150.00,
    available_quantity: 8
  }
];

export const mockCustomers = [
  {
    id: '123e4567-e89b-12d3-a456-426614174004',
    customer_name: 'ABC Corporation',
    email: 'contact@abccorp.com',
    credit_limit: 10000.00
  }
];
```

### 2. Test Scenarios
1. **Rental Flow**: Create rental → Check availability → Process return
2. **Purchase Flow**: Create purchase → Update stock → Verify inventory
3. **Sales Flow**: Create sale → Update stock → Process payment
4. **Return Flow**: Create return → Inspect items → Calculate fees

---

## Security Best Practices

### 1. Token Management
```javascript
// tokenManager.js
class TokenManager {
  setTokens(accessToken, refreshToken) {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
  }

  getAccessToken() {
    return localStorage.getItem('access_token');
  }

  clearTokens() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  async refreshAccessToken() {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) throw new Error('No refresh token');

    const response = await axios.post('/api/auth/refresh', { refresh_token: refreshToken });
    this.setTokens(response.data.access_token, response.data.refresh_token);
    return response.data.access_token;
  }
}
```

### 2. Request Interceptor for Token Refresh
```javascript
axios.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const newToken = await tokenManager.refreshAccessToken();
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        return axios(originalRequest);
      } catch (refreshError) {
        tokenManager.clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);
```

---

## Deployment Considerations

### Environment Variables
```bash
# .env
REACT_APP_API_BASE_URL=http://localhost:8000/api
REACT_APP_WS_URL=ws://localhost:8000/ws
REACT_APP_ENVIRONMENT=development
```

### Build Optimization
```javascript
// webpack.config.js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
  },
};
```

---

## Support & Troubleshooting

### Common Issues
1. **CORS Errors**: Ensure backend has proper CORS configuration
2. **Token Expiry**: Implement automatic token refresh
3. **Large Payloads**: Use pagination for large datasets
4. **Network Issues**: Implement retry logic with exponential backoff

### Debug Mode
```javascript
// Enable debug logging
if (process.env.NODE_ENV === 'development') {
  axios.interceptors.request.use(config => {
    console.log('API Request:', config);
    return config;
  });
  
  axios.interceptors.response.use(response => {
    console.log('API Response:', response);
    return response;
  });
}
```

---

**For additional support, refer to the API documentation at `http://localhost:8000/docs`**
