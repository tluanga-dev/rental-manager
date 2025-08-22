#!/usr/bin/env python3
"""
Integration Tests for Customer Management System
Tests that actually exercise the internal code paths
"""

import pytest
import asyncio
from uuid import uuid4
from decimal import Decimal
from datetime import datetime
import sys
import os

# Add the app directory to the path so we can import modules
sys.path.insert(0, '/code')

# Test only the core customer functionality without requiring database
def test_customer_model_methods():
    """Test customer model methods directly"""
    from app.models.customer import Customer, CustomerType, CustomerStatus, BlacklistStatus, CreditRating, CustomerTier
    
    # Create a mock customer
    customer = Customer()
    customer.first_name = "John"
    customer.last_name = "Doe"
    customer.customer_type = CustomerType.INDIVIDUAL.value
    customer.business_name = None
    customer.address_line1 = "123 Main St"
    customer.address_line2 = None
    customer.city = "Test City"
    customer.state = "TS"
    customer.postal_code = "12345"
    customer.country = "USA"
    customer.blacklist_status = BlacklistStatus.CLEAR.value
    customer.status = CustomerStatus.ACTIVE.value
    customer.is_active = True
    customer.total_rentals = 5
    customer.total_spent = Decimal("1000.00")
    customer.lifetime_value = Decimal("1000.00")
    customer.customer_tier = CustomerTier.BRONZE.value
    
    # Test hybrid properties
    assert customer.full_name == "John Doe"
    assert customer.display_name == "John Doe"
    assert not customer.is_blacklisted
    assert customer.can_transact
    
    # Test blacklist functionality
    customer.blacklist("Test reason")
    assert customer.blacklist_status == BlacklistStatus.BLACKLISTED.value
    assert customer.status == CustomerStatus.SUSPENDED.value
    assert customer.is_blacklisted
    assert not customer.can_transact
    
    # Test clear blacklist
    customer.clear_blacklist()
    assert customer.blacklist_status == BlacklistStatus.CLEAR.value
    assert customer.status == CustomerStatus.ACTIVE.value
    
    # Test tier update
    customer.lifetime_value = Decimal("150000")
    customer.update_tier()
    assert customer.customer_tier == CustomerTier.PLATINUM.value
    
    # Test statistics update
    initial_rentals = customer.total_rentals
    initial_spent = customer.total_spent
    customer.update_statistics(Decimal("500.00"))
    assert customer.total_rentals == initial_rentals + 1
    assert customer.total_spent == initial_spent + Decimal("500.00")

def test_customer_validation_methods():
    """Test customer validation methods"""
    from app.models.customer import Customer
    
    customer = Customer()
    
    # Test email validation
    try:
        customer.validate_email("email", "test@example.com")
        email_valid = True
    except ValueError:
        email_valid = False
    assert email_valid
    
    try:
        customer.validate_email("email", "invalid-email")
        email_invalid = False
    except ValueError:
        email_invalid = True
    assert email_invalid
    
    # Test phone validation
    try:
        customer.validate_phone("phone", "+1234567890")
        phone_valid = True
    except ValueError:
        phone_valid = False
    assert phone_valid
    
    # Test customer code validation
    try:
        customer.validate_customer_code("customer_code", "CUST_001")
        code_valid = True
    except ValueError:
        code_valid = False
    assert code_valid

def test_schemas_comprehensive():
    """Test all customer schemas"""
    from app.schemas.customer import (
        CustomerCreate, CustomerUpdate, CustomerResponse,
        CustomerBlacklistUpdate, CustomerCreditUpdate,
        CustomerStatusUpdate, CustomerStatsResponse
    )
    from app.models.customer import CustomerType, CustomerStatus, BlacklistStatus, CreditRating
    
    # Test CustomerCreate
    create_data = {
        "customer_code": "TEST_001",
        "customer_type": CustomerType.INDIVIDUAL,
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@test.com",
        "phone": "+1234567890",
        "address_line1": "123 Main St",
        "city": "Test City",
        "state": "TS",
        "postal_code": "12345",
        "country": "USA"
    }
    
    create_schema = CustomerCreate(**create_data)
    assert create_schema.customer_code == "TEST_001"
    
    # Test CustomerUpdate
    update_data = {
        "phone": "+1555123456",
        "credit_limit": 25000.0
    }
    
    update_schema = CustomerUpdate(**update_data)
    assert update_schema.phone == "+1555123456"
    
    # Test CustomerBlacklistUpdate
    blacklist_data = {
        "blacklist_status": BlacklistStatus.BLACKLISTED,
        "blacklist_reason": "Test reason"
    }
    
    blacklist_schema = CustomerBlacklistUpdate(**blacklist_data)
    assert blacklist_schema.blacklist_status == BlacklistStatus.BLACKLISTED
    
    # Test CustomerCreditUpdate
    credit_data = {
        "credit_limit": 50000.0,
        "credit_rating": CreditRating.EXCELLENT
    }
    
    credit_schema = CustomerCreditUpdate(**credit_data)
    assert credit_schema.credit_rating == CreditRating.EXCELLENT
    
    # Test CustomerStatusUpdate
    status_data = {
        "status": CustomerStatus.INACTIVE,
        "notes": "Test notes"
    }
    
    status_schema = CustomerStatusUpdate(**status_data)
    assert status_schema.status == CustomerStatus.INACTIVE

def test_all_enums():
    """Test all customer enum values comprehensively"""
    from app.models.customer import (
        CustomerType, CustomerStatus, BlacklistStatus, 
        CreditRating, CustomerTier
    )
    
    # Test CustomerType
    assert len(CustomerType) == 2
    assert CustomerType.INDIVIDUAL.value == "INDIVIDUAL"
    assert CustomerType.BUSINESS.value == "BUSINESS"
    
    # Test CustomerStatus
    assert len(CustomerStatus) == 4
    assert CustomerStatus.ACTIVE.value == "ACTIVE"
    assert CustomerStatus.INACTIVE.value == "INACTIVE"
    assert CustomerStatus.SUSPENDED.value == "SUSPENDED"
    assert CustomerStatus.PENDING.value == "PENDING"
    
    # Test BlacklistStatus
    assert len(BlacklistStatus) == 3
    assert BlacklistStatus.CLEAR.value == "CLEAR"
    assert BlacklistStatus.WARNING.value == "WARNING"
    assert BlacklistStatus.BLACKLISTED.value == "BLACKLISTED"
    
    # Test CreditRating
    assert len(CreditRating) == 5
    assert CreditRating.EXCELLENT.value == "EXCELLENT"
    assert CreditRating.GOOD.value == "GOOD"
    assert CreditRating.FAIR.value == "FAIR"
    assert CreditRating.POOR.value == "POOR"
    assert CreditRating.NO_RATING.value == "NO_RATING"
    
    # Test CustomerTier
    assert len(CustomerTier) == 4
    assert CustomerTier.BRONZE.value == "BRONZE"
    assert CustomerTier.SILVER.value == "SILVER"
    assert CustomerTier.GOLD.value == "GOLD"
    assert CustomerTier.PLATINUM.value == "PLATINUM"

def test_business_logic_scenarios():
    """Test complex business logic scenarios"""
    from app.models.customer import Customer, CustomerType, CustomerStatus, BlacklistStatus, CustomerTier
    from decimal import Decimal
    
    # Scenario 1: Individual customer lifecycle
    customer = Customer()
    customer.first_name = "Jane"
    customer.last_name = "Smith"
    customer.customer_type = CustomerType.INDIVIDUAL.value
    customer.status = CustomerStatus.ACTIVE.value
    customer.blacklist_status = BlacklistStatus.CLEAR.value
    customer.is_active = True
    customer.lifetime_value = Decimal("0")
    customer.customer_tier = CustomerTier.BRONZE.value
    customer.total_rentals = 0
    customer.total_spent = Decimal("0")
    
    # Start as bronze customer
    assert customer.customer_tier == CustomerTier.BRONZE.value
    
    # Process multiple transactions
    customer.update_statistics(Decimal("15000"))
    customer.update_statistics(Decimal("15000"))
    # Should now be silver tier (30000 total)
    assert customer.customer_tier == CustomerTier.SILVER.value
    
    # Process more transactions  
    customer.update_statistics(Decimal("25000"))
    # Should now be gold tier (55000 total)
    assert customer.customer_tier == CustomerTier.GOLD.value
    
    # Process large transaction
    customer.update_statistics(Decimal("50000"))
    # Should now be platinum tier (105000 total)
    assert customer.customer_tier == CustomerTier.PLATINUM.value
    
    # Scenario 2: Business customer
    business = Customer()
    business.first_name = "John"
    business.last_name = "Doe"
    business.customer_type = CustomerType.BUSINESS.value
    business.business_name = "Acme Corp"
    
    # Business should display business name
    assert business.display_name == "Acme Corp"
    
    # Test blacklisting business customer
    business.status = CustomerStatus.ACTIVE.value
    business.blacklist_status = BlacklistStatus.CLEAR.value
    business.is_active = True
    
    assert business.can_transact
    
    business.blacklist("Payment issues")
    assert not business.can_transact
    assert business.status == CustomerStatus.SUSPENDED.value

def test_edge_cases():
    """Test edge cases and error conditions"""
    from app.models.customer import Customer
    from decimal import Decimal
    
    customer = Customer()
    
    # Test credit limit validation
    try:
        customer.validate_credit_limit("credit_limit", Decimal("-100"))
        negative_credit_valid = True
    except ValueError:
        negative_credit_valid = False
    assert not negative_credit_valid
    
    try:
        customer.validate_credit_limit("credit_limit", Decimal("100"))
        positive_credit_valid = True
    except ValueError:
        positive_credit_valid = False
    assert positive_credit_valid
    
    # Test postal code validation
    try:
        customer.validate_postal_code("postal_code", "12345")
        postal_valid = True
    except ValueError:
        postal_valid = False
    assert postal_valid

if __name__ == "__main__":
    # Run all tests
    test_customer_model_methods()
    test_customer_validation_methods() 
    test_schemas_comprehensive()
    test_all_enums()
    test_business_logic_scenarios()
    test_edge_cases()
    
    print("✅ All integration tests passed!")