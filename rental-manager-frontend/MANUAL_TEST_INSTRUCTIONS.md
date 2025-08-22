# Manual Testing Instructions for Customer Creation Fix

## Overview
This document provides step-by-step instructions to manually test the customer creation functionality after the UUID validation error fix.

## Prerequisites
1. **Backend Server Running**: Ensure the backend server is running at `http://localhost:8000`
2. **Frontend Server Running**: Ensure the frontend server is running at `http://localhost:3000`

## Test Scenarios

### Test 1: Individual Customer Creation

1. **Navigate to Customer Creation Page**
   - Open browser to `http://localhost:3000/customers/new`
   - Verify the page loads without errors

2. **Fill Individual Customer Form**
   - Ensure "Individual Customer" is selected (default)
   - Click "Generate" button for customer code
   - Fill in the following fields:
     ```
     First Name: John
     Last Name: Doe
     Email: john.doe@example.com
     Phone: +1-555-123-4567
     Mobile: +1-555-987-6543
     Address Line 1: 123 Main Street
     Address Line 2: Apt 4B
     City: New York
     State: NY
     Postal Code: 10001
     Country: USA
     Credit Limit: 5000
     Payment Terms: Net 30
     Notes: Test individual customer
     ```

3. **Submit Form**
   - Click "Create Customer" button
   - Watch for success message
   - Should redirect to customer detail page

4. **Expected Outcome**
   - ✅ No UUID validation errors
   - ✅ Customer created successfully
   - ✅ Redirects to customer profile page

### Test 2: Business Customer Creation

1. **Navigate to Customer Creation Page**
   - Open browser to `http://localhost:3000/customers/new`

2. **Select Business Customer Type**
   - Click "Business Customer" button
   - Verify form fields change appropriately

3. **Fill Business Customer Form**
   - Click "Generate" button for customer code
   - Fill in the following fields:
     ```
     Business Name: Acme Corporation
     Tax Number: TAX123456789
     Email: contact@acme.com
     Phone: +1-555-100-2000
     Mobile: +1-555-200-3000
     Address Line 1: 456 Business Ave
     Address Line 2: Suite 100
     City: Los Angeles
     State: CA
     Postal Code: 90210
     Country: USA
     Credit Limit: 25000
     Payment Terms: Net 45
     Notes: Test business customer
     ```

4. **Submit Form**
   - Click "Create Customer" button
   - Watch for success message
   - Should redirect to customer detail page

5. **Expected Outcome**
   - ✅ No UUID validation errors
   - ✅ Business customer created successfully
   - ✅ Redirects to customer profile page

### Test 3: Customer Selection in Sales Form

1. **Navigate to Sales Creation Page**
   - Open browser to `http://localhost:3000/sales/new`

2. **Test Customer Dropdown**
   - Click on the customer selection dropdown
   - Verify customers appear in the list
   - Select a customer
   - Verify no "customers" string is passed as customer_id

3. **Expected Outcome**
   - ✅ Customer dropdown works correctly
   - ✅ No UUID validation errors when selecting customers
   - ✅ Customer selection shows proper customer names

## API Testing (Alternative Method)

If manual testing is not possible, you can test the API directly:

### Using curl (if available):
```bash
curl -X POST http://localhost:8000/api/customers/ \
  -H "Content-Type: application/json" \
  -d '{
    "customer_code": "TEST-001",
    "customer_type": "INDIVIDUAL",
    "first_name": "Test",
    "last_name": "Customer",
    "email": "test@example.com",
    "phone": "+1-555-123-4567",
    "mobile": "+1-555-987-6543",
    "address_line1": "123 Test Street",
    "city": "Test City",
    "state": "TS",
    "postal_code": "12345",
    "country": "USA",
    "credit_limit": 1000,
    "payment_terms": "Net 30",
    "notes": "Test customer"
  }'
```

### Using Postman or Similar Tool:
- **URL**: `POST http://localhost:8000/api/customers/`
- **Headers**: `Content-Type: application/json`
- **Body**: Use the JSON payload from the curl example above

## Debugging Console Logs

When testing, monitor the browser's Developer Tools Console for:
- Network requests to `/api/customers/`
- Request payloads being sent
- Response data received
- Any error messages

## Expected Changes Fixed

The following issues have been resolved:

1. **Interface Mismatch**: ✅ CustomerCreate interface now matches server payload
2. **API Endpoint**: ✅ Changed from `/customers/customers/` to `/customers/`
3. **Missing Fields**: ✅ Added all required fields (mobile, address fields, payment_terms, notes)
4. **Field Name Corrections**: ✅ Changed `tax_id` to `tax_number`
5. **Customer Type**: ✅ Limited to 'INDIVIDUAL' | 'BUSINESS' (removed 'CORPORATE')

## Troubleshooting

If errors still occur:

1. **Check Backend Logs**: Look for error messages in the backend console
2. **Verify API Endpoint**: Ensure backend accepts POST `/api/customers/`
3. **Check Payload Structure**: Verify the request payload matches expected format
4. **Network Tab**: Check if requests are being sent with correct data

## Success Indicators

- ✅ Customer creation form submits without UUID validation errors
- ✅ Customers can be created and saved to database
- ✅ Customer dropdown in sales form works correctly
- ✅ No "customers" string being passed as customer_id anywhere

## Running Automated Tests

If the shell environment issues are resolved, run:
```bash
node debug-customer-error.js
node simple-customer-test.js
```

These scripts will automatically test the customer creation flow and provide detailed output about any issues encountered.