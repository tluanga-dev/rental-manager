#!/bin/bash

echo "🔍 Customer Creation Test Suite"
echo "================================"
echo ""

echo "📋 Step 1: Validating code changes..."
node validate-changes.js
echo ""

echo "📋 Step 2: Testing API connectivity..."
echo "Note: This requires the backend server to be running at http://localhost:8000"
echo ""

if command -v curl &> /dev/null; then
    echo "🧪 Testing GET /api/customers/ endpoint..."
    curl -s -w "Status: %{http_code}\n" http://localhost:8000/api/customers/ || echo "❌ Backend server not accessible"
    echo ""
    
    echo "🧪 Testing POST /api/customers/ endpoint..."
    curl -X POST http://localhost:8000/api/customers/ \
        -H "Content-Type: application/json" \
        -d '{
            "customer_code": "TEST-SCRIPT-'$(date +%s)'",
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
            "notes": "Test customer created by script"
        }' \
        -w "\nStatus: %{http_code}\n" || echo "❌ Customer creation API test failed"
else
    echo "⚠️ curl not available - run simple-customer-test.js manually"
    echo "Command: node simple-customer-test.js"
fi

echo ""
echo "📋 Step 3: UI Testing (manual)..."
echo "1. Start frontend: npm run dev"
echo "2. Navigate to: http://localhost:3000/customers/new"
echo "3. Test individual customer creation"
echo "4. Test business customer creation"
echo "5. Test customer selection in sales form"
echo ""

echo "📋 Step 4: Automated UI Testing (if environment supports it)..."
if command -v node &> /dev/null && [ -f "debug-customer-error.js" ]; then
    echo "🎭 Running Puppeteer tests..."
    node debug-customer-error.js || echo "⚠️ Puppeteer tests failed - may need frontend server running"
else
    echo "⚠️ Automated UI testing not available"
fi

echo ""
echo "🎉 Test suite complete!"
echo ""
echo "📖 For detailed testing instructions, see: MANUAL_TEST_INSTRUCTIONS.md"