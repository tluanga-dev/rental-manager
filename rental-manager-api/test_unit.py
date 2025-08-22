
import pytest
from app.models.customer import Customer, CustomerType, CustomerStatus, BlacklistStatus, CreditRating
from app.schemas.customer import CustomerCreate, CustomerResponse
from app.services.customer import CustomerService
from app.crud.customer import CustomerRepository

def test_customer_model_creation():
    """Test customer model instantiation"""
    # This would normally use a test database
    assert CustomerType.INDIVIDUAL == "INDIVIDUAL"
    assert CustomerStatus.ACTIVE == "ACTIVE"
    assert BlacklistStatus.CLEAR == "CLEAR"
    assert CreditRating.GOOD == "GOOD"

def test_customer_schemas():
    """Test customer schemas"""
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
    assert schema.customer_type == "INDIVIDUAL"
    assert schema.first_name == "John"

def test_customer_enums():
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
