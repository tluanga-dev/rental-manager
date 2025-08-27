#!/bin/bash

# Test script for authentication bypass functionality
# Run this script to verify that authentication bypass is working correctly

echo "🔍 Testing Authentication Bypass Setup"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Backend URL
BACKEND_URL="http://localhost:8000/api/v1"

echo -e "${BLUE}1. Testing Backend Development Status${NC}"
echo "GET $BACKEND_URL/auth/dev-status"
echo "-----------------------------------"

DEV_STATUS=$(curl -s -w "HTTP_STATUS:%{http_code}" "$BACKEND_URL/auth/dev-status" 2>/dev/null)
HTTP_STATUS=$(echo "$DEV_STATUS" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$DEV_STATUS" | sed 's/HTTP_STATUS:[0-9]*$//')

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Backend dev status endpoint accessible${NC}"
    echo "Response: $RESPONSE_BODY"
else
    echo -e "${RED}❌ Backend dev status endpoint failed (HTTP $HTTP_STATUS)${NC}"
    echo "Response: $RESPONSE_BODY"
fi
echo ""

echo -e "${BLUE}2. Testing Backend Development Login${NC}"
echo "POST $BACKEND_URL/auth/dev-login"
echo "-----------------------------------"

DEV_LOGIN=$(curl -s -w "HTTP_STATUS:%{http_code}" -X POST "$BACKEND_URL/auth/dev-login" -H "Content-Type: application/json" 2>/dev/null)
HTTP_STATUS=$(echo "$DEV_LOGIN" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$DEV_LOGIN" | sed 's/HTTP_STATUS:[0-9]*$//')

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Backend dev login endpoint working${NC}"
    echo "Response: $RESPONSE_BODY"
else
    echo -e "${RED}❌ Backend dev login endpoint failed (HTTP $HTTP_STATUS)${NC}"
    echo "Response: $RESPONSE_BODY"
fi
echo ""

echo -e "${BLUE}3. Testing Backend Protected Endpoint (without auth)${NC}"
echo "GET $BACKEND_URL/customers"
echo "-----------------------------------"

PROTECTED_ENDPOINT=$(curl -s -w "HTTP_STATUS:%{http_code}" "$BACKEND_URL/customers" -H "Authorization: Bearer dev-access-token" 2>/dev/null)
HTTP_STATUS=$(echo "$PROTECTED_ENDPOINT" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$PROTECTED_ENDPOINT" | sed 's/HTTP_STATUS:[0-9]*$//')

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Protected endpoint accessible without real auth${NC}"
    echo "Response: $RESPONSE_BODY"
elif [ "$HTTP_STATUS" = "401" ]; then
    echo -e "${YELLOW}⚠️  Authentication still required - bypass may not be enabled${NC}"
    echo "Response: $RESPONSE_BODY"
else
    echo -e "${RED}❌ Protected endpoint failed (HTTP $HTTP_STATUS)${NC}"
    echo "Response: $RESPONSE_BODY"
fi
echo ""

echo -e "${BLUE}4. Testing Frontend (if running on localhost:3000)${NC}"
echo "GET http://localhost:3000"
echo "-----------------------------------"

FRONTEND_STATUS=$(curl -s -w "HTTP_STATUS:%{http_code}" "http://localhost:3000" 2>/dev/null)
HTTP_STATUS=$(echo "$FRONTEND_STATUS" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Frontend is accessible${NC}"
    echo "Note: Check browser console for development mode messages"
else
    echo -e "${YELLOW}⚠️  Frontend not accessible (HTTP $HTTP_STATUS)${NC}"
    echo "Note: Make sure frontend is running on localhost:3000"
fi
echo ""

echo -e "${BLUE}5. Environment Check${NC}"
echo "-----------------------------------"

if [ -f "rental-manager-api/.env" ]; then
    echo "Backend .env file found"
    if grep -q "ENVIRONMENT=development" rental-manager-api/.env; then
        echo -e "${GREEN}✅ ENVIRONMENT=development${NC}"
    else
        echo -e "${YELLOW}⚠️  ENVIRONMENT not set to development${NC}"
    fi
    
    if grep -q "DEBUG=true" rental-manager-api/.env; then
        echo -e "${GREEN}✅ DEBUG=true${NC}"
    else
        echo -e "${YELLOW}⚠️  DEBUG not set to true${NC}"
    fi
    
    if grep -q "DISABLE_AUTH_IN_DEV=true" rental-manager-api/.env; then
        echo -e "${GREEN}✅ DISABLE_AUTH_IN_DEV=true${NC}"
    else
        echo -e "${YELLOW}⚠️  DISABLE_AUTH_IN_DEV not set to true${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Backend .env file not found${NC}"
fi

if [ -f "rental-manager-frontend/.env.development" ]; then
    echo "Frontend .env.development file found"
    if grep -q "NEXT_PUBLIC_DISABLE_AUTH=true" rental-manager-frontend/.env.development; then
        echo -e "${GREEN}✅ NEXT_PUBLIC_DISABLE_AUTH=true${NC}"
    else
        echo -e "${YELLOW}⚠️  NEXT_PUBLIC_DISABLE_AUTH not set to true${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Frontend .env.development file not found${NC}"
fi
echo ""

echo -e "${BLUE}Summary${NC}"
echo "-----------------------------------"
echo "If all tests pass, authentication bypass is working correctly."
echo "If tests fail, check:"
echo "1. Both backend and frontend services are running"
echo "2. Environment variables are set correctly"
echo "3. Services have been restarted after changing environment variables"
echo ""
echo "For more details, see: DEVELOPMENT_AUTHENTICATION_SETUP.md"