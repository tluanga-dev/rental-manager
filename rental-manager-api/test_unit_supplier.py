#!/usr/bin/env python3
"""
Supplier Unit Tests
==================

Comprehensive unit tests for the supplier management system covering:
- Supplier model validation and business logic
- Supplier schema validation (Pydantic v2)
- Enum values and constraints
- Model methods and properties
- Edge cases and error conditions

Usage:
    pytest test_unit_supplier.py -v
"""

import pytest
from decimal import Decimal
from datetime import datetime, timezone
from uuid import UUID, uuid4

from app.models.supplier import (
    Supplier, SupplierType, SupplierTier, SupplierStatus, PaymentTerms
)
from app.schemas.supplier import (
    SupplierCreate, SupplierUpdate, SupplierResponse, SupplierStatusUpdate,
    SupplierContactUpdate, SupplierAddressUpdate, SupplierContractUpdate,
    SupplierPerformanceUpdate, SupplierSearchRequest
)


class TestSupplierEnums:
    """Test supplier enumeration values."""

    def test_supplier_type_enum(self):
        """Test SupplierType enum values."""
        expected_types = {
            "MANUFACTURER", "DISTRIBUTOR", "WHOLESALER", 
            "RETAILER", "INVENTORY", "SERVICE", "DIRECT"
        }
        actual_types = {t.value for t in SupplierType}
        assert actual_types == expected_types

    def test_supplier_tier_enum(self):
        """Test SupplierTier enum values."""
        expected_tiers = {"PREMIUM", "STANDARD", "BASIC", "TRIAL"}
        actual_tiers = {t.value for t in SupplierTier}
        assert actual_tiers == expected_tiers

    def test_supplier_status_enum(self):
        """Test SupplierStatus enum values."""
        expected_statuses = {
            "ACTIVE", "INACTIVE", "PENDING", 
            "APPROVED", "SUSPENDED", "BLACKLISTED"
        }
        actual_statuses = {s.value for s in SupplierStatus}
        assert actual_statuses == expected_statuses

    def test_payment_terms_enum(self):
        """Test PaymentTerms enum values."""
        expected_terms = {
            "IMMEDIATE", "NET15", "NET30", 
            "NET45", "NET60", "NET90", "COD"
        }
        actual_terms = {p.value for p in PaymentTerms}
        assert actual_terms == expected_terms


class TestSupplierModel:
    """Test Supplier model functionality."""

    @pytest.fixture
    def valid_supplier_data(self):
        """Provide valid supplier data for testing."""
        return {
            "supplier_code": "SUPP001",
            "company_name": "Test Supplier Inc",
            "supplier_type": SupplierType.MANUFACTURER,
            "contact_person": "John Doe",
            "email": "contact@testsupplier.com",
            "phone": "+1-555-0123",
            "mobile": "+1-555-0124",
            "address_line1": "123 Business Ave",
            "city": "New York",
            "state": "NY",
            "postal_code": "10001",
            "country": "USA",
            "tax_id": "TAX123456",
            "payment_terms": PaymentTerms.NET30,
            "credit_limit": Decimal("50000.00"),
            "supplier_tier": SupplierTier.STANDARD,
            "status": SupplierStatus.ACTIVE,
            "website": "https://testsupplier.com",
            "account_manager": "Jane Smith"
        }

    def test_create_supplier_with_valid_data(self, valid_supplier_data):
        """Test creating a supplier with valid data."""
        supplier = Supplier(**valid_supplier_data)
        
        assert supplier.supplier_code == "SUPP001"
        assert supplier.company_name == "Test Supplier Inc"
        assert supplier.supplier_type == SupplierType.MANUFACTURER.value
        assert supplier.email == "contact@testsupplier.com"
        assert supplier.payment_terms == PaymentTerms.NET30.value
        assert supplier.credit_limit == 50000.00
        assert supplier.supplier_tier == SupplierTier.STANDARD.value
        assert supplier.status == SupplierStatus.ACTIVE.value

    def test_supplier_validation_empty_code(self, valid_supplier_data):
        """Test validation for empty supplier code."""
        valid_supplier_data["supplier_code"] = ""
        
        with pytest.raises(ValueError, match="Supplier code cannot be empty"):
            Supplier(**valid_supplier_data)

    def test_supplier_validation_long_code(self, valid_supplier_data):
        """Test validation for overly long supplier code."""
        valid_supplier_data["supplier_code"] = "A" * 51
        
        with pytest.raises(ValueError, match="Supplier code cannot exceed 50 characters"):
            Supplier(**valid_supplier_data)

    def test_supplier_validation_empty_company_name(self, valid_supplier_data):
        """Test validation for empty company name."""
        valid_supplier_data["company_name"] = ""
        
        with pytest.raises(ValueError, match="Company name cannot be empty"):
            Supplier(**valid_supplier_data)

    def test_supplier_validation_invalid_email(self, valid_supplier_data):
        """Test validation for invalid email format."""
        valid_supplier_data["email"] = "invalid-email"
        
        with pytest.raises(ValueError, match="Invalid email format"):
            Supplier(**valid_supplier_data)

    def test_supplier_validation_negative_credit_limit(self, valid_supplier_data):
        """Test validation for negative credit limit."""
        valid_supplier_data["credit_limit"] = Decimal("-1000.00")
        
        with pytest.raises(ValueError, match="Credit limit cannot be negative"):
            Supplier(**valid_supplier_data)

    def test_update_performance_metrics(self, valid_supplier_data):
        """Test updating supplier performance metrics."""
        supplier = Supplier(**valid_supplier_data)
        
        supplier.update_performance_metrics(
            quality_rating=4.5,
            delivery_rating=4.2,
            average_delivery_days=7,
            total_orders=100,
            total_spend=250000.50,
            last_order_date=datetime.now(timezone.utc)
        )
        
        assert supplier.quality_rating == 4.5
        assert supplier.delivery_rating == 4.2
        assert supplier.average_delivery_days == 7
        assert supplier.total_orders == 100
        assert supplier.total_spend == 250000.50
        assert supplier.last_order_date is not None

    def test_update_performance_metrics_invalid_rating(self, valid_supplier_data):
        """Test validation for invalid performance ratings."""
        supplier = Supplier(**valid_supplier_data)
        
        with pytest.raises(ValueError, match="Quality rating must be between 0 and 5"):
            supplier.update_performance_metrics(quality_rating=6.0)
            
        with pytest.raises(ValueError, match="Delivery rating must be between 0 and 5"):
            supplier.update_performance_metrics(delivery_rating=-1.0)

    def test_supplier_status_methods(self, valid_supplier_data):
        """Test supplier status management methods."""
        supplier = Supplier(**valid_supplier_data)
        
        # Test activation
        supplier.activate("admin")
        assert supplier.status == SupplierStatus.ACTIVE.value
        assert supplier.updated_by == "admin"
        
        # Test deactivation
        supplier.deactivate("admin")
        assert supplier.status == SupplierStatus.INACTIVE.value
        
        # Test suspension
        supplier.suspend("admin")
        assert supplier.status == SupplierStatus.SUSPENDED.value
        
        # Test blacklisting
        supplier.blacklist("admin")
        assert supplier.status == SupplierStatus.BLACKLISTED.value
        
        # Test approval
        supplier.approve("admin")
        assert supplier.status == SupplierStatus.APPROVED.value

    def test_supplier_status_check_methods(self, valid_supplier_data):
        """Test supplier status checking methods."""
        supplier = Supplier(**valid_supplier_data)
        
        # Test when active
        supplier.status = SupplierStatus.ACTIVE.value
        assert supplier.is_approved() is False
        assert supplier.is_suspended() is False
        assert supplier.is_blacklisted() is False
        
        # Test when approved
        supplier.status = SupplierStatus.APPROVED.value
        assert supplier.is_approved() is True
        
        # Test when suspended
        supplier.status = SupplierStatus.SUSPENDED.value
        assert supplier.is_suspended() is True
        
        # Test when blacklisted
        supplier.status = SupplierStatus.BLACKLISTED.value
        assert supplier.is_blacklisted() is True

    def test_can_place_order(self, valid_supplier_data):
        """Test can_place_order business logic."""
        supplier = Supplier(**valid_supplier_data)
        
        # Active supplier can place orders
        supplier.status = SupplierStatus.ACTIVE.value
        supplier.is_active = True
        assert supplier.can_place_order() is True
        
        # Approved supplier can place orders
        supplier.status = SupplierStatus.APPROVED.value
        assert supplier.can_place_order() is True
        
        # Suspended supplier cannot place orders
        supplier.status = SupplierStatus.SUSPENDED.value
        assert supplier.can_place_order() is False
        
        # Inactive supplier cannot place orders
        supplier.status = SupplierStatus.ACTIVE.value
        supplier.is_active = False
        assert supplier.can_place_order() is False

    def test_supplier_properties(self, valid_supplier_data):
        """Test supplier computed properties."""
        supplier = Supplier(**valid_supplier_data)
        
        # Test full_address property
        expected_address = "123 Business Ave, New York, NY, 10001, USA"
        assert supplier.full_address == expected_address
        
        # Test display_name property
        expected_display = "Test Supplier Inc (SUPP001)"
        assert supplier.display_name == expected_display
        
        # Test overall_rating property
        supplier.quality_rating = 4.0
        supplier.delivery_rating = 4.5
        assert supplier.overall_rating == 4.25
        
        # Test overall_rating with zero ratings
        supplier.quality_rating = 0.0
        supplier.delivery_rating = 0.0
        assert supplier.overall_rating == 0.0

    def test_supplier_string_representations(self, valid_supplier_data):
        """Test supplier string representation methods."""
        supplier = Supplier(**valid_supplier_data)
        supplier.id = uuid4()
        
        # Test __str__ method
        str_repr = str(supplier)
        assert str_repr == "Test Supplier Inc (SUPP001)"
        
        # Test __repr__ method
        repr_str = repr(supplier)
        assert "Supplier(id=" in repr_str
        assert "code='SUPP001'" in repr_str
        assert "company='Test Supplier Inc'" in repr_str
        assert "type='MANUFACTURER'" in repr_str
        assert "status='ACTIVE'" in repr_str


class TestSupplierSchemas:
    """Test Supplier Pydantic schemas."""

    def test_supplier_create_schema(self):
        """Test SupplierCreate schema validation."""
        data = {
            "supplier_code": "SUPP001",
            "company_name": "Test Supplier Inc",
            "supplier_type": SupplierType.MANUFACTURER,
            "email": "contact@testsupplier.com",
            "website": "testsupplier.com",  # Should auto-add https://
            "credit_limit": "50000.00",
            "payment_terms": PaymentTerms.NET30,
            "supplier_tier": SupplierTier.STANDARD,
            "status": SupplierStatus.ACTIVE
        }
        
        schema = SupplierCreate(**data)
        assert schema.supplier_code == "SUPP001"
        assert schema.company_name == "Test Supplier Inc"
        assert schema.supplier_type == SupplierType.MANUFACTURER
        assert schema.email == "contact@testsupplier.com"
        assert schema.website == "https://testsupplier.com"  # Auto-prefixed
        assert schema.credit_limit == Decimal("50000.00")

    def test_supplier_create_schema_email_validation(self):
        """Test email validation in SupplierCreate schema."""
        data = {
            "supplier_code": "SUPP001",
            "company_name": "Test Supplier Inc",
            "supplier_type": SupplierType.MANUFACTURER,
            "email": "invalid-email"
        }
        
        with pytest.raises(ValueError, match="Invalid email format"):
            SupplierCreate(**data)

    def test_supplier_update_schema(self):
        """Test SupplierUpdate schema validation."""
        data = {
            "company_name": "Updated Supplier Inc",
            "contact_person": "Jane Doe",
            "email": "updated@testsupplier.com",
            "notes": "Updated supplier information"
        }
        
        schema = SupplierUpdate(**data)
        assert schema.company_name == "Updated Supplier Inc"
        assert schema.contact_person == "Jane Doe"
        assert schema.email == "updated@testsupplier.com"
        assert schema.notes == "Updated supplier information"

    def test_supplier_status_update_schema(self):
        """Test SupplierStatusUpdate schema."""
        data = {
            "status": SupplierStatus.SUSPENDED,
            "notes": "Temporarily suspended for review"
        }
        
        schema = SupplierStatusUpdate(**data)
        assert schema.status == SupplierStatus.SUSPENDED
        assert schema.notes == "Temporarily suspended for review"

    def test_supplier_contact_update_schema(self):
        """Test SupplierContactUpdate schema."""
        data = {
            "contact_person": "New Contact Person",
            "email": "newcontact@testsupplier.com",
            "phone": "+1-555-9999",
            "website": "newsupplier.com"
        }
        
        schema = SupplierContactUpdate(**data)
        assert schema.contact_person == "New Contact Person"
        assert schema.email == "newcontact@testsupplier.com"
        assert schema.phone == "+1-555-9999"
        assert schema.website == "https://newsupplier.com"  # Auto-prefixed

    def test_supplier_address_update_schema(self):
        """Test SupplierAddressUpdate schema."""
        data = {
            "address_line1": "456 New Street",
            "address_line2": "Building B",
            "city": "Los Angeles",
            "state": "CA",
            "postal_code": "90210",
            "country": "USA"
        }
        
        schema = SupplierAddressUpdate(**data)
        assert schema.address_line1 == "456 New Street"
        assert schema.city == "Los Angeles"
        assert schema.state == "CA"
        assert schema.postal_code == "90210"
        assert schema.country == "USA"

    def test_supplier_contract_update_schema(self):
        """Test SupplierContractUpdate schema."""
        start_date = datetime(2024, 1, 1)
        end_date = datetime(2024, 12, 31)
        
        data = {
            "contract_start_date": start_date,
            "contract_end_date": end_date,
            "payment_terms": PaymentTerms.NET45,
            "credit_limit": "75000.00",
            "supplier_tier": SupplierTier.PREMIUM
        }
        
        schema = SupplierContractUpdate(**data)
        assert schema.contract_start_date == start_date
        assert schema.contract_end_date == end_date
        assert schema.payment_terms == PaymentTerms.NET45
        assert schema.credit_limit == Decimal("75000.00")
        assert schema.supplier_tier == SupplierTier.PREMIUM

    def test_supplier_contract_update_date_validation(self):
        """Test contract date validation."""
        start_date = datetime(2024, 12, 31)
        end_date = datetime(2024, 1, 1)  # Before start date
        
        data = {
            "contract_start_date": start_date,
            "contract_end_date": end_date
        }
        
        with pytest.raises(ValueError, match="Contract end date must be after start date"):
            SupplierContractUpdate(**data)

    def test_supplier_performance_update_schema(self):
        """Test SupplierPerformanceUpdate schema."""
        data = {
            "quality_rating": 4.5,
            "delivery_rating": 4.2,
            "average_delivery_days": 7,
            "total_orders": 150,
            "total_spend": "500000.75",
            "last_order_date": datetime.now(),
            "notes": "Excellent performance this quarter"
        }
        
        schema = SupplierPerformanceUpdate(**data)
        assert schema.quality_rating == 4.5
        assert schema.delivery_rating == 4.2
        assert schema.average_delivery_days == 7
        assert schema.total_orders == 150
        assert schema.total_spend == Decimal("500000.75")
        assert schema.notes == "Excellent performance this quarter"

    def test_supplier_search_request_schema(self):
        """Test SupplierSearchRequest schema."""
        data = {
            "search_term": "test supplier",
            "supplier_type": SupplierType.MANUFACTURER,
            "status": SupplierStatus.ACTIVE,
            "supplier_tier": SupplierTier.PREMIUM,
            "payment_terms": PaymentTerms.NET30,
            "country": "USA",
            "min_quality_rating": 4.0,
            "max_quality_rating": 5.0,
            "min_delivery_rating": 3.5,
            "max_delivery_rating": 5.0,
            "contract_expiring_days": 30,
            "active_only": True,
            "page": 1,
            "page_size": 20,
            "sort_by": "company_name",
            "sort_order": "asc"
        }
        
        schema = SupplierSearchRequest(**data)
        assert schema.search_term == "test supplier"
        assert schema.supplier_type == SupplierType.MANUFACTURER
        assert schema.status == SupplierStatus.ACTIVE
        assert schema.min_quality_rating == 4.0
        assert schema.max_quality_rating == 5.0
        assert schema.contract_expiring_days == 30
        assert schema.page == 1
        assert schema.page_size == 20
        assert schema.sort_order == "asc"

    def test_supplier_response_schema_model_validation(self):
        """Test SupplierResponse schema can be created from model."""
        # This test would typically use a real Supplier model instance
        # For now, we test the schema structure
        
        sample_data = {
            "id": uuid4(),
            "supplier_code": "SUPP001",
            "company_name": "Test Supplier Inc",
            "supplier_type": "MANUFACTURER",
            "contact_person": "John Doe",
            "email": "contact@testsupplier.com",
            "phone": "+1-555-0123",
            "mobile": "+1-555-0124",
            "address_line1": "123 Business Ave",
            "address_line2": None,
            "city": "New York",
            "state": "NY",
            "postal_code": "10001",
            "country": "USA",
            "tax_id": "TAX123456",
            "payment_terms": "NET30",
            "credit_limit": Decimal("50000.00"),
            "supplier_tier": "STANDARD",
            "status": "ACTIVE",
            "quality_rating": Decimal("4.5"),
            "delivery_rating": Decimal("4.2"),
            "average_delivery_days": 7,
            "total_orders": 100,
            "total_spend": Decimal("250000.50"),
            "last_order_date": None,
            "notes": "Test supplier",
            "website": "https://testsupplier.com",
            "account_manager": "Jane Smith",
            "preferred_payment_method": "Bank Transfer",
            "insurance_expiry": None,
            "certifications": None,
            "contract_start_date": None,
            "contract_end_date": None,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "is_active": True
        }
        
        schema = SupplierResponse(**sample_data)
        assert schema.supplier_code == "SUPP001"
        assert schema.company_name == "Test Supplier Inc"
        assert schema.supplier_type == "MANUFACTURER"
        assert schema.payment_terms == "NET30"
        assert schema.credit_limit == Decimal("50000.00")
        assert schema.quality_rating == Decimal("4.5")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])