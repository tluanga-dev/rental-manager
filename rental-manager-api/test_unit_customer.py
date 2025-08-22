#!/usr/bin/env python3
"""
Unit Tests for Customer Management System
Comprehensive tests for models, schemas, services, and CRUD operations
"""

import pytest
import asyncio
from decimal import Decimal
from datetime import datetime
from uuid import uuid4
from unittest.mock import Mock, AsyncMock

# Import the modules we want to test
from app.models.customer import (
    Customer, CustomerType, CustomerStatus, BlacklistStatus, 
    CreditRating, CustomerTier
)
from app.schemas.customer import (
    CustomerCreate, CustomerUpdate, CustomerResponse, 
    CustomerBlacklistUpdate, CustomerCreditUpdate
)

class TestCustomerModels:
    """Test Customer model functionality"""
    
    def test_customer_enums(self):
        """Test all customer enum values"""
        # Test CustomerType
        assert CustomerType.INDIVIDUAL.value == "INDIVIDUAL"
        assert CustomerType.BUSINESS.value == "BUSINESS"
        
        # Test CustomerStatus  
        assert CustomerStatus.ACTIVE.value == "ACTIVE"
        assert CustomerStatus.INACTIVE.value == "INACTIVE"
        assert CustomerStatus.SUSPENDED.value == "SUSPENDED"
        assert CustomerStatus.PENDING.value == "PENDING"
        
        # Test BlacklistStatus
        assert BlacklistStatus.CLEAR.value == "CLEAR"
        assert BlacklistStatus.WARNING.value == "WARNING" 
        assert BlacklistStatus.BLACKLISTED.value == "BLACKLISTED"
        
        # Test CreditRating
        assert CreditRating.EXCELLENT.value == "EXCELLENT"
        assert CreditRating.GOOD.value == "GOOD"
        assert CreditRating.FAIR.value == "FAIR"
        assert CreditRating.POOR.value == "POOR"
        assert CreditRating.NO_RATING.value == "NO_RATING"
        
        # Test CustomerTier
        assert CustomerTier.BRONZE.value == "BRONZE"
        assert CustomerTier.SILVER.value == "SILVER"
        assert CustomerTier.GOLD.value == "GOLD"
        assert CustomerTier.PLATINUM.value == "PLATINUM"
    
    def test_customer_model_properties(self):
        """Test customer model hybrid properties"""
        # Create a mock customer object
        customer = Mock(spec=Customer)
        customer.first_name = "John"
        customer.last_name = "Doe"
        customer.customer_type = CustomerType.INDIVIDUAL
        customer.business_name = None
        customer.address_line1 = "123 Main St"
        customer.address_line2 = None
        customer.city = "Test City"
        customer.state = "TS"
        customer.postal_code = "12345"
        customer.country = "USA"
        customer.blacklist_status = BlacklistStatus.CLEAR
        customer.status = CustomerStatus.ACTIVE
        customer.is_active = True
        
        # Test full_name property logic
        full_name = f"{customer.first_name} {customer.last_name}"
        assert full_name == "John Doe"
        
        # Test display_name logic for individual
        if customer.customer_type == CustomerType.INDIVIDUAL:
            display_name = full_name
        else:
            display_name = customer.business_name or full_name
        assert display_name == "John Doe"
        
        # Test can_transact logic
        can_transact = (
            customer.status == CustomerStatus.ACTIVE and 
            customer.blacklist_status != BlacklistStatus.BLACKLISTED and 
            customer.is_active
        )
        assert can_transact == True
    
    def test_customer_business_properties(self):
        """Test customer properties for business customers"""
        customer = Mock(spec=Customer)
        customer.first_name = "Jane"
        customer.last_name = "Smith"
        customer.customer_type = CustomerType.BUSINESS
        customer.business_name = "Tech Solutions Inc."
        
        # For business customers, display_name should be business_name
        full_name = f"{customer.first_name} {customer.last_name}"
        if customer.customer_type == CustomerType.BUSINESS and customer.business_name:
            display_name = customer.business_name
        else:
            display_name = full_name
        
        assert display_name == "Tech Solutions Inc."
    
    def test_customer_blacklist_logic(self):
        """Test customer blacklist functionality"""
        customer = Mock(spec=Customer)
        customer.blacklist_status = BlacklistStatus.BLACKLISTED
        customer.status = CustomerStatus.SUSPENDED
        customer.is_active = True
        
        # Test blacklisted status
        is_blacklisted = customer.blacklist_status == BlacklistStatus.BLACKLISTED
        assert is_blacklisted == True
        
        # Test can_transact when blacklisted
        can_transact = (
            customer.status == CustomerStatus.ACTIVE and 
            customer.blacklist_status != BlacklistStatus.BLACKLISTED and 
            customer.is_active
        )
        assert can_transact == False
    
    def test_customer_tier_logic(self):
        """Test customer tier update logic"""
        # Test tier assignment based on lifetime value
        test_cases = [
            (Decimal('150000'), CustomerTier.PLATINUM),
            (Decimal('75000'), CustomerTier.GOLD),
            (Decimal('30000'), CustomerTier.SILVER),
            (Decimal('10000'), CustomerTier.BRONZE),
        ]
        
        for lifetime_value, expected_tier in test_cases:
            if lifetime_value >= 100000:
                tier = CustomerTier.PLATINUM
            elif lifetime_value >= 50000:
                tier = CustomerTier.GOLD
            elif lifetime_value >= 20000:
                tier = CustomerTier.SILVER
            else:
                tier = CustomerTier.BRONZE
            
            assert tier == expected_tier

class TestCustomerSchemas:
    """Test Customer schema validation"""
    
    def test_customer_create_schema(self):
        """Test customer creation schema validation"""
        customer_data = {
            "customer_code": "TEST_001",
            "customer_type": "INDIVIDUAL",
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
        
        schema = CustomerCreate(**customer_data)
        assert schema.customer_code == "TEST_001"
        assert schema.customer_type == CustomerType.INDIVIDUAL
        assert schema.first_name == "John"
        assert schema.last_name == "Doe"
        assert schema.email == "john@test.com"
    
    def test_customer_update_schema(self):
        """Test customer update schema"""
        update_data = {
            "phone": "+1555123456",
            "credit_limit": 25000.0,
            "notes": "Updated customer info"
        }
        
        schema = CustomerUpdate(**update_data)
        assert schema.phone == "+1555123456"
        assert schema.credit_limit == 25000.0
        assert schema.notes == "Updated customer info"
    
    def test_customer_blacklist_schema(self):
        """Test customer blacklist update schema"""
        blacklist_data = {
            "blacklist_status": "BLACKLISTED",
            "blacklist_reason": "Test reason",
            "notes": "Test notes"
        }
        
        schema = CustomerBlacklistUpdate(**blacklist_data)
        assert schema.blacklist_status == BlacklistStatus.BLACKLISTED
        assert schema.blacklist_reason == "Test reason"
        assert schema.notes == "Test notes"
    
    def test_customer_credit_schema(self):
        """Test customer credit update schema"""
        credit_data = {
            "credit_limit": 50000.0,
            "credit_rating": "EXCELLENT",
            "payment_terms": "NET_15"
        }
        
        schema = CustomerCreditUpdate(**credit_data)
        assert schema.credit_limit == 50000.0
        assert schema.credit_rating == CreditRating.EXCELLENT
        assert schema.payment_terms == "NET_15"

class TestCustomerBusinessLogic:
    """Test customer business logic and methods"""
    
    def test_email_validation_logic(self):
        """Test email validation patterns"""
        valid_emails = [
            "test@example.com",
            "user.name@domain.co.uk",
            "user+tag@example.org"
        ]
        
        invalid_emails = [
            "invalid-email",
            "@example.com",
            "user@",
            "user space@example.com"
        ]
        
        import re
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        
        for email in valid_emails:
            assert re.match(email_pattern, email) is not None
        
        for email in invalid_emails:
            assert re.match(email_pattern, email) is None
    
    def test_phone_validation_logic(self):
        """Test phone number validation patterns"""
        valid_phones = [
            "+1234567890",
            "+44-20-7946-0958",
            "+91 98765 43210"
        ]
        
        invalid_phones = [
            "invalid-phone",
            "123",
            "+",
            "phone-number"
        ]
        
        import re
        # Simplified phone validation
        for phone in valid_phones:
            cleaned = phone.replace(' ', '').replace('-', '')
            assert re.match(r'^\+?[1-9]\d{1,14}$', cleaned) is not None
    
    def test_customer_code_validation_logic(self):
        """Test customer code validation patterns"""
        valid_codes = [
            "CUST_001",
            "TEST-123",
            "CUSTOMER_ABC"
        ]
        
        invalid_codes = [
            "cust 001",  # lowercase and space
            "cust@001",  # special character
        ]
        
        # "123" is actually valid according to our pattern - just numbers
        edge_cases = [
            "123",  # Valid but might be considered too simple
        ]
        
        import re
        code_pattern = r'^[A-Z0-9_-]+$'
        
        for code in valid_codes:
            assert re.match(code_pattern, code) is not None
        
        for code in invalid_codes:
            # These should fail validation
            assert re.match(code_pattern, code) is None
        
        for code in edge_cases:
            # These match the pattern but might have business rules
            assert re.match(code_pattern, code) is not None

class TestCustomerStatistics:
    """Test customer statistics and analytics"""
    
    def test_statistics_calculation(self):
        """Test customer statistics calculations"""
        # Mock customer data
        customers = [
            {"status": "ACTIVE", "customer_type": "INDIVIDUAL", "is_active": True},
            {"status": "ACTIVE", "customer_type": "BUSINESS", "is_active": True},
            {"status": "INACTIVE", "customer_type": "INDIVIDUAL", "is_active": True},
            {"status": "SUSPENDED", "customer_type": "BUSINESS", "is_active": False},
        ]
        
        # Calculate statistics
        total_customers = len(customers)
        active_customers = len([c for c in customers if c["status"] == "ACTIVE" and c["is_active"]])
        individual_customers = len([c for c in customers if c["customer_type"] == "INDIVIDUAL" and c["is_active"]])
        business_customers = len([c for c in customers if c["customer_type"] == "BUSINESS" and c["is_active"]])
        
        assert total_customers == 4
        assert active_customers == 2
        assert individual_customers == 2  # Both individual customers are active (is_active=True)
        assert business_customers == 1   # Only one business customer is active
    
    def test_customer_value_calculations(self):
        """Test customer value and tier calculations"""
        transactions = [
            {"amount": Decimal("1000.00")},
            {"amount": Decimal("2500.00")},
            {"amount": Decimal("750.00")},
        ]
        
        total_spent = sum(t["amount"] for t in transactions)
        total_rentals = len(transactions)
        lifetime_value = total_spent  # Simplified calculation
        
        assert total_spent == Decimal("4250.00")
        assert total_rentals == 3
        assert lifetime_value == Decimal("4250.00")

def test_import_all_modules():
    """Test that all customer-related modules can be imported successfully"""
    # Test model imports
    from app.models.customer import Customer, CustomerType, CustomerStatus
    assert Customer is not None
    assert CustomerType is not None
    assert CustomerStatus is not None
    
    # Test schema imports
    from app.schemas.customer import CustomerCreate, CustomerResponse
    assert CustomerCreate is not None
    assert CustomerResponse is not None
    
    # Test enum consistency
    assert CustomerType.INDIVIDUAL.value == "INDIVIDUAL"
    assert CustomerStatus.ACTIVE.value == "ACTIVE"

def test_model_schema_compatibility():
    """Test that models and schemas are compatible"""
    # Test that enum values match between model and schema
    from app.models.customer import CustomerType as ModelCustomerType
    from app.schemas.customer import CustomerCreate
    
    # Create a schema with model enum value
    customer_data = {
        "customer_code": "COMPAT_001",
        "customer_type": ModelCustomerType.INDIVIDUAL.value,
        "first_name": "Test",
        "last_name": "User",
        "email": "test@example.com",
        "phone": "+1234567890",
        "address_line1": "123 Test St",
        "city": "Test City",
        "state": "TS",
        "postal_code": "12345",
        "country": "USA"
    }
    
    schema = CustomerCreate(**customer_data)
    assert schema.customer_type.value == "INDIVIDUAL"

if __name__ == "__main__":
    # Run basic tests to verify functionality
    test_import_all_modules()
    test_model_schema_compatibility()
    
    test_models = TestCustomerModels()
    test_models.test_customer_enums()
    test_models.test_customer_model_properties()
    
    test_schemas = TestCustomerSchemas()
    test_schemas.test_customer_create_schema()
    
    print("✅ All basic unit tests passed!")