"""
Comprehensive unit tests for Location model.
Target: 100% coverage for Location model functionality.
"""

import pytest
from decimal import Decimal
from datetime import datetime
from uuid import uuid4
import json

from app.models.location import Location, LocationType
from tests.conftest import assert_model_fields


@pytest.mark.unit
@pytest.mark.asyncio
class TestLocationModel:
    """Test Location model functionality with proper database session."""
    
    async def test_location_creation_with_all_fields(self, db_session):
        """Test creating a location with all fields."""
        parent_location = Location(
            location_code="PARENT-001",
            location_name="Parent Location",
            location_type=LocationType.WAREHOUSE
        )
        db_session.add(parent_location)
        await db_session.commit()
        await db_session.refresh(parent_location)
        
        operating_hours = {
            "monday": {"open": "09:00", "close": "17:00"},
            "tuesday": {"open": "09:00", "close": "17:00"},
            "wednesday": {"open": "09:00", "close": "17:00"},
            "thursday": {"open": "09:00", "close": "17:00"},
            "friday": {"open": "09:00", "close": "17:00"},
            "saturday": {"closed": True},
            "sunday": {"closed": True}
        }
        
        metadata = {"zone": "A", "floor": 1, "section": "electronics"}
        
        location_data = {
            "location_code": "TST-001",
            "location_name": "Test Store Location",
            "location_type": LocationType.STORE,
            "address": "123 Test Street",
            "city": "Test City",
            "state": "Test State",
            "country": "Test Country",
            "postal_code": "12345",
            "contact_number": "+1-555-0123",
            "email": "test@teststore.com",
            "website": "https://teststore.com",
            "latitude": Decimal("40.7128"),
            "longitude": Decimal("-74.0060"),
            "timezone": "America/New_York",
            "operating_hours": operating_hours,
            "capacity": 1000,
            "is_default": False,
            "is_active": True,
            "parent_location_id": parent_location.id,
            "metadata": metadata,
            "created_by": uuid4(),
            "updated_by": uuid4()
        }
        
        location = Location(**location_data)
        db_session.add(location)
        await db_session.commit()
        await db_session.refresh(location)
        
        # Test all fields
        assert location.location_code == "TST-001"
        assert location.location_name == "Test Store Location"
        assert location.location_type == LocationType.STORE
        assert location.address == "123 Test Street"
        assert location.city == "Test City"
        assert location.state == "Test State"
        assert location.country == "Test Country"
        assert location.postal_code == "12345"
        assert location.contact_number == "+1-555-0123"
        assert location.email == "test@teststore.com"
        assert location.website == "https://teststore.com"
        assert location.latitude == Decimal("40.7128")
        assert location.longitude == Decimal("-74.0060")
        assert location.timezone == "America/New_York"
        assert location.operating_hours == operating_hours
        assert location.capacity == 1000
        assert location.is_default is False
        assert location.is_active is True
        assert location.parent_location_id == parent_location.id
        assert location.metadata == metadata
        assert location.id is not None
        assert location.created_at is not None
        assert location.updated_at is not None
    
    async def test_location_creation_minimal_required_fields(self, db_session):
        """Test creating a location with only required fields."""
        location = Location(
            location_code="MIN-001",
            location_name="Minimal Location",
            location_type=LocationType.OFFICE
        )
        
        db_session.add(location)
        await db_session.commit()
        await db_session.refresh(location)
        
        assert location.location_code == "MIN-001"
        assert location.location_name == "Minimal Location"
        assert location.location_type == LocationType.OFFICE
        assert location.timezone == "UTC"  # Default value
        assert location.is_default is False  # Default value
        assert location.is_active is True  # Default value
        assert location.address is None
        assert location.city is None
        assert location.state is None
        assert location.country is None
        assert location.postal_code is None
        assert location.contact_number is None
        assert location.email is None
        assert location.website is None
        assert location.latitude is None
        assert location.longitude is None
        assert location.operating_hours is None
        assert location.capacity is None
        assert location.parent_location_id is None
        assert location.manager_user_id is None
        assert location.metadata is None
        assert location.id is not None

    def test_location_code_validation_uppercase_conversion(self):
        """Test that location codes are converted to uppercase."""
        location = Location(
            location_code="lowercase-code",
            location_name="Test Location",
            location_type=LocationType.STORE
        )
        
        assert location.location_code == "LOWERCASE-CODE"

    def test_location_code_validation_empty(self):
        """Test that empty location code raises validation error."""
        with pytest.raises(ValueError, match="Location code cannot be empty"):
            Location(
                location_code="",
                location_name="Test Location",
                location_type=LocationType.STORE
            )

    def test_location_code_validation_whitespace(self):
        """Test that whitespace-only location code raises validation error."""
        with pytest.raises(ValueError, match="Location code cannot be empty"):
            Location(
                location_code="   ",
                location_name="Test Location",
                location_type=LocationType.STORE
            )

    def test_location_code_validation_too_long(self):
        """Test that location code exceeding 20 chars raises validation error."""
        long_code = "A" * 21
        with pytest.raises(ValueError, match="Location code cannot exceed 20 characters"):
            Location(
                location_code=long_code,
                location_name="Test Location",
                location_type=LocationType.STORE
            )

    def test_location_name_validation_empty(self):
        """Test that empty location name raises validation error."""
        with pytest.raises(ValueError, match="Location name cannot be empty"):
            Location(
                location_code="TST-001",
                location_name="",
                location_type=LocationType.STORE
            )

    def test_location_name_validation_whitespace(self):
        """Test that whitespace-only location name raises validation error."""
        with pytest.raises(ValueError, match="Location name cannot be empty"):
            Location(
                location_code="TST-001",
                location_name="   ",
                location_type=LocationType.STORE
            )

    def test_location_name_validation_too_long(self):
        """Test that location name exceeding 100 chars raises validation error."""
        long_name = "A" * 101
        with pytest.raises(ValueError, match="Location name cannot exceed 100 characters"):
            Location(
                location_code="TST-001",
                location_name=long_name,
                location_type=LocationType.STORE
            )

    def test_location_name_validation_strips_whitespace(self):
        """Test that location name strips leading/trailing whitespace."""
        location = Location(
            location_code="TST-001",
            location_name="  Test Location  ",
            location_type=LocationType.STORE
        )
        
        assert location.location_name == "Test Location"

    def test_email_validation_valid_email(self):
        """Test that valid email is accepted and normalized."""
        location = Location(
            location_code="TST-001",
            location_name="Test Location",
            location_type=LocationType.STORE,
            email="Test@Example.COM"
        )
        
        assert location.email == "test@example.com"

    def test_email_validation_invalid_email(self):
        """Test that invalid email raises validation error."""
        with pytest.raises(ValueError, match="Invalid email format"):
            Location(
                location_code="TST-001",
                location_name="Test Location",
                location_type=LocationType.STORE,
                email="invalid-email"
            )

    def test_email_validation_too_long(self):
        """Test that email exceeding 255 chars raises validation error."""
        long_email = "a" * 250 + "@b.com"
        with pytest.raises(ValueError, match="Email cannot exceed 255 characters"):
            Location(
                location_code="TST-001",
                location_name="Test Location",
                location_type=LocationType.STORE,
                email=long_email
            )

    def test_contact_number_validation_valid_formats(self):
        """Test that valid contact number formats are accepted."""
        valid_numbers = [
            "+1-555-0123",
            "(555) 123-4567",
            "555.123.4567",
            "+44 20 7946 0958",
            "1234567890",
            "+1 555 123 4567 ext 123"
        ]
        
        for number in valid_numbers:
            location = Location(
                location_code=f"TST-{len(number):03d}",
                location_name="Test Location",
                location_type=LocationType.STORE,
                contact_number=number
            )
            assert location.contact_number == number.strip()

    def test_contact_number_validation_invalid_format(self):
        """Test that invalid contact number format raises validation error."""
        with pytest.raises(ValueError, match="Invalid contact number format"):
            Location(
                location_code="TST-001",
                location_name="Test Location",
                location_type=LocationType.STORE,
                contact_number="invalid@number"
            )

    def test_contact_number_validation_too_long(self):
        """Test that contact number exceeding 30 chars raises validation error."""
        long_number = "1" * 31
        with pytest.raises(ValueError, match="Contact number cannot exceed 30 characters"):
            Location(
                location_code="TST-001",
                location_name="Test Location",
                location_type=LocationType.STORE,
                contact_number=long_number
            )

    def test_website_validation_valid_urls(self):
        """Test that valid website URLs are accepted and normalized."""
        test_cases = [
            ("https://example.com", "https://example.com"),
            ("http://example.com", "http://example.com"),
            ("example.com", "https://example.com"),
            ("www.example.com", "https://www.example.com"),
            ("EXAMPLE.COM", "https://example.com")
        ]
        
        for input_url, expected_url in test_cases:
            location = Location(
                location_code=f"TST-{hash(input_url) % 1000:03d}",
                location_name="Test Location",
                location_type=LocationType.STORE,
                website=input_url
            )
            assert location.website == expected_url

    def test_website_validation_invalid_url(self):
        """Test that invalid website URL raises validation error."""
        with pytest.raises(ValueError, match="Invalid website URL format"):
            Location(
                location_code="TST-001",
                location_name="Test Location",
                location_type=LocationType.STORE,
                website="not-a-valid-url"
            )

    def test_website_validation_too_long(self):
        """Test that website URL exceeding 255 chars raises validation error."""
        long_url = "https://" + "a" * 250 + ".com"
        with pytest.raises(ValueError, match="Website URL cannot exceed 255 characters"):
            Location(
                location_code="TST-001",
                location_name="Test Location",
                location_type=LocationType.STORE,
                website=long_url
            )

    def test_latitude_validation_valid_range(self):
        """Test that valid latitude values are accepted."""
        valid_latitudes = [
            Decimal("-90.0"),
            Decimal("0.0"),
            Decimal("90.0"),
            Decimal("40.7128"),
            Decimal("-34.6037")
        ]
        
        for lat in valid_latitudes:
            location = Location(
                location_code=f"LAT-{int(float(lat)) + 90:03d}",
                location_name="Test Location",
                location_type=LocationType.STORE,
                latitude=lat,
                longitude=Decimal("0.0")
            )
            assert location.latitude == lat

    def test_latitude_validation_out_of_range(self):
        """Test that latitude outside valid range raises validation error."""
        invalid_latitudes = [Decimal("-90.1"), Decimal("90.1"), Decimal("-180.0"), Decimal("180.0")]
        
        for lat in invalid_latitudes:
            with pytest.raises(ValueError, match="Latitude must be between -90 and 90"):
                Location(
                    location_code="TST-001",
                    location_name="Test Location",
                    location_type=LocationType.STORE,
                    latitude=lat,
                    longitude=Decimal("0.0")
                )

    def test_longitude_validation_valid_range(self):
        """Test that valid longitude values are accepted."""
        valid_longitudes = [
            Decimal("-180.0"),
            Decimal("0.0"),
            Decimal("180.0"),
            Decimal("-74.0060"),
            Decimal("151.2093")
        ]
        
        for lon in valid_longitudes:
            location = Location(
                location_code=f"LON-{int(float(lon)) + 180:03d}",
                location_name="Test Location",
                location_type=LocationType.STORE,
                latitude=Decimal("0.0"),
                longitude=lon
            )
            assert location.longitude == lon

    def test_longitude_validation_out_of_range(self):
        """Test that longitude outside valid range raises validation error."""
        invalid_longitudes = [Decimal("-180.1"), Decimal("180.1"), Decimal("-360.0"), Decimal("360.0")]
        
        for lon in invalid_longitudes:
            with pytest.raises(ValueError, match="Longitude must be between -180 and 180"):
                Location(
                    location_code="TST-001",
                    location_name="Test Location",
                    location_type=LocationType.STORE,
                    latitude=Decimal("0.0"),
                    longitude=lon
                )

    def test_capacity_validation_valid_values(self):
        """Test that valid capacity values are accepted."""
        valid_capacities = [0, 1, 1000, 999999]
        
        for capacity in valid_capacities:
            location = Location(
                location_code=f"CAP-{capacity:06d}",
                location_name="Test Location",
                location_type=LocationType.WAREHOUSE,
                capacity=capacity
            )
            assert location.capacity == capacity

    def test_capacity_validation_negative_value(self):
        """Test that negative capacity raises validation error."""
        with pytest.raises(ValueError, match="Capacity cannot be negative"):
            Location(
                location_code="TST-001",
                location_name="Test Location",
                location_type=LocationType.WAREHOUSE,
                capacity=-1
            )

    def test_postal_code_validation_normalization(self):
        """Test that postal code is normalized to uppercase."""
        location = Location(
            location_code="TST-001",
            location_name="Test Location",
            location_type=LocationType.STORE,
            postal_code="abc-123"
        )
        
        assert location.postal_code == "ABC-123"

    def test_postal_code_validation_too_long(self):
        """Test that postal code exceeding 20 chars raises validation error."""
        long_postal_code = "A" * 21
        with pytest.raises(ValueError, match="Postal code cannot exceed 20 characters"):
            Location(
                location_code="TST-001",
                location_name="Test Location",
                location_type=LocationType.STORE,
                postal_code=long_postal_code
            )


@pytest.mark.unit
class TestLocationUtilityMethods:
    """Test Location utility methods."""

    def test_get_full_address_all_fields(self):
        """Test full address generation with all address fields."""
        location = Location(
            location_code="TST-001",
            location_name="Test Location",
            location_type=LocationType.STORE,
            address="123 Main St",
            city="New York",
            state="NY",
            postal_code="10001",
            country="USA"
        )
        
        expected = "123 Main St, New York, NY, 10001, USA"
        assert location.get_full_address() == expected

    def test_get_full_address_partial_fields(self):
        """Test full address generation with some address fields."""
        location = Location(
            location_code="TST-001",
            location_name="Test Location",
            location_type=LocationType.STORE,
            city="New York",
            state="NY"
        )
        
        expected = "New York, NY"
        assert location.get_full_address() == expected

    def test_get_full_address_no_fields(self):
        """Test full address generation with no address fields."""
        location = Location(
            location_code="TST-001",
            location_name="Test Location",
            location_type=LocationType.STORE
        )
        
        assert location.get_full_address() == "No address provided"

    def test_get_short_address(self):
        """Test short address generation."""
        location = Location(
            location_code="TST-001",
            location_name="Test Location",
            location_type=LocationType.STORE,
            address="123 Main St",  # Should be excluded from short address
            city="New York",
            state="NY",
            country="USA"
        )
        
        expected = "New York, NY, USA"
        assert location.get_short_address() == expected

    def test_get_coordinates_with_values(self):
        """Test getting coordinates when both latitude and longitude are set."""
        location = Location(
            location_code="TST-001",
            location_name="Test Location",
            location_type=LocationType.STORE,
            latitude=Decimal("40.7128"),
            longitude=Decimal("-74.0060")
        )
        
        coords = location.get_coordinates()
        assert coords == (40.7128, -74.0060)

    def test_get_coordinates_missing_values(self):
        """Test getting coordinates when values are missing."""
        location = Location(
            location_code="TST-001",
            location_name="Test Location",
            location_type=LocationType.STORE,
            latitude=Decimal("40.7128")
            # longitude missing
        )
        
        assert location.get_coordinates() is None

    def test_has_coordinates_true(self):
        """Test has_coordinates when both coordinates are present."""
        location = Location(
            location_code="TST-001",
            location_name="Test Location",
            location_type=LocationType.STORE,
            latitude=Decimal("40.7128"),
            longitude=Decimal("-74.0060")
        )
        
        assert location.has_coordinates() is True

    def test_has_coordinates_false(self):
        """Test has_coordinates when coordinates are missing."""
        location = Location(
            location_code="TST-001",
            location_name="Test Location",
            location_type=LocationType.STORE
        )
        
        assert location.has_coordinates() is False

    def test_location_type_helpers(self):
        """Test location type helper methods."""
        location_types = [
            (LocationType.STORE, "is_store"),
            (LocationType.WAREHOUSE, "is_warehouse"),
            (LocationType.SERVICE_CENTER, "is_service_center"),
            (LocationType.DISTRIBUTION_CENTER, "is_distribution_center"),
            (LocationType.OFFICE, "is_office")
        ]
        
        for location_type, method_name in location_types:
            location = Location(
                location_code=f"TST-{location_type.value}",
                location_name="Test Location",
                location_type=location_type
            )
            
            # Test that the correct method returns True
            assert getattr(location, method_name)() is True
            
            # Test that other methods return False
            for other_type, other_method in location_types:
                if other_method != method_name:
                    assert getattr(location, other_method)() is False

    def test_display_name(self):
        """Test display name property."""
        location = Location(
            location_code="TST-001",
            location_name="Test Store",
            location_type=LocationType.STORE
        )
        
        assert location.display_name == "Test Store (TST-001)"

    def test_location_type_display(self):
        """Test location type display property."""
        display_mapping = {
            LocationType.STORE: "Store",
            LocationType.WAREHOUSE: "Warehouse",
            LocationType.SERVICE_CENTER: "Service Center",
            LocationType.DISTRIBUTION_CENTER: "Distribution Center",
            LocationType.OFFICE: "Office"
        }
        
        for location_type, expected_display in display_mapping.items():
            location = Location(
                location_code=f"TST-{location_type.value}",
                location_name="Test Location",
                location_type=location_type
            )
            
            assert location.location_type_display == expected_display

    def test_update_operating_hours_valid(self):
        """Test updating operating hours with valid data."""
        location = Location(
            location_code="TST-001",
            location_name="Test Location",
            location_type=LocationType.STORE
        )
        
        valid_hours = {
            "monday": {"open": "09:00", "close": "17:00"},
            "tuesday": {"open": "09:00", "close": "17:00"},
            "wednesday": {"closed": True}
        }
        
        location.update_operating_hours(valid_hours)
        assert location.operating_hours == valid_hours

    def test_update_operating_hours_invalid_day(self):
        """Test updating operating hours with invalid day name."""
        location = Location(
            location_code="TST-001",
            location_name="Test Location",
            location_type=LocationType.STORE
        )
        
        invalid_hours = {
            "invalid_day": {"open": "09:00", "close": "17:00"}
        }
        
        with pytest.raises(ValueError, match="Invalid day: invalid_day"):
            location.update_operating_hours(invalid_hours)

    def test_set_as_default(self):
        """Test setting location as default."""
        location = Location(
            location_code="TST-001",
            location_name="Test Location",
            location_type=LocationType.STORE,
            is_default=False
        )
        
        location.set_as_default()
        assert location.is_default is True

    def test_activate_location(self):
        """Test activating a location."""
        location = Location(
            location_code="TST-001",
            location_name="Test Location",
            location_type=LocationType.STORE,
            is_active=False
        )
        
        location.activate()
        assert location.is_active is True

    def test_deactivate_location(self):
        """Test deactivating a location."""
        location = Location(
            location_code="TST-001",
            location_name="Test Location",
            location_type=LocationType.STORE,
            is_active=True,
            is_default=True
        )
        
        location.deactivate()
        assert location.is_active is False
        assert location.is_default is False  # Should also unset default

    def test_string_representations(self):
        """Test string representations of location."""
        location = Location(
            location_code="TST-001",
            location_name="Test Store",
            location_type=LocationType.STORE,
            city="New York",
            is_active=True
        )
        
        # Test __str__
        assert str(location) == "Test Store (TST-001)"
        
        # Test __repr__
        repr_str = repr(location)
        assert "Location(" in repr_str
        assert "TST-001" in repr_str
        assert "Test Store" in repr_str
        assert "STORE" in repr_str
        assert "New York" in repr_str
        assert "True" in repr_str


@pytest.mark.unit 
class TestLocationHierarchy:
    """Test Location hierarchical functionality."""

    def test_get_hierarchy_level_root(self):
        """Test hierarchy level for root location."""
        root_location = Location(
            location_code="ROOT-001",
            location_name="Root Location",
            location_type=LocationType.WAREHOUSE
        )
        
        assert root_location.get_hierarchy_level() == 0

    def test_has_children_false(self):
        """Test has_children when no children exist."""
        location = Location(
            location_code="TST-001",
            location_name="Test Location",
            location_type=LocationType.STORE
        )
        
        # Mock empty child_locations
        location.child_locations = []
        assert location.has_children() is False

    def test_has_children_true(self):
        """Test has_children when children exist."""
        parent = Location(
            location_code="PARENT-001",
            location_name="Parent Location",
            location_type=LocationType.WAREHOUSE
        )
        
        child = Location(
            location_code="CHILD-001",
            location_name="Child Location",
            location_type=LocationType.STORE,
            parent_location_id=parent.id
        )
        
        # Mock child_locations
        parent.child_locations = [child]
        assert parent.has_children() is True

    def test_get_all_children_empty(self):
        """Test getting all children when none exist."""
        location = Location(
            location_code="TST-001",
            location_name="Test Location",
            location_type=LocationType.STORE
        )
        
        # Mock empty child_locations
        location.child_locations = []
        children = location.get_all_children()
        assert children == []

    def test_get_all_children_recursive(self):
        """Test getting all children recursively."""
        # Create hierarchy: parent -> child1, child2 -> grandchild
        parent = Location(
            location_code="PARENT-001",
            location_name="Parent",
            location_type=LocationType.WAREHOUSE
        )
        
        child1 = Location(
            location_code="CHILD1-001",
            location_name="Child 1",
            location_type=LocationType.STORE,
            parent_location_id=parent.id,
            is_active=True
        )
        
        child2 = Location(
            location_code="CHILD2-001", 
            location_name="Child 2",
            location_type=LocationType.STORE,
            parent_location_id=parent.id,
            is_active=True
        )
        
        grandchild = Location(
            location_code="GRAND-001",
            location_name="Grandchild",
            location_type=LocationType.OFFICE,
            parent_location_id=child1.id,
            is_active=True
        )
        
        # Mock relationships
        child1.child_locations = [grandchild]
        child2.child_locations = []
        grandchild.child_locations = []
        parent.child_locations = [child1, child2]
        
        # Test getting all children
        all_children = parent.get_all_children()
        assert len(all_children) == 3  # child1, child2, grandchild
        assert child1 in all_children
        assert child2 in all_children
        assert grandchild in all_children

    def test_get_all_children_include_inactive(self):
        """Test getting all children including inactive ones."""
        parent = Location(
            location_code="PARENT-001",
            location_name="Parent",
            location_type=LocationType.WAREHOUSE
        )
        
        active_child = Location(
            location_code="ACTIVE-001",
            location_name="Active Child",
            location_type=LocationType.STORE,
            is_active=True
        )
        
        inactive_child = Location(
            location_code="INACTIVE-001",
            location_name="Inactive Child", 
            location_type=LocationType.STORE,
            is_active=False
        )
        
        # Mock relationships
        active_child.child_locations = []
        inactive_child.child_locations = []
        parent.child_locations = [active_child, inactive_child]
        
        # Test excluding inactive (default)
        active_only = parent.get_all_children(include_inactive=False)
        assert len(active_only) == 1
        assert active_child in active_only
        assert inactive_child not in active_only
        
        # Test including inactive
        all_children = parent.get_all_children(include_inactive=True)
        assert len(all_children) == 2
        assert active_child in all_children
        assert inactive_child in all_children