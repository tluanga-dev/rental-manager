"""
Integration tests for Location CRUD operations.
Tests the complete database interaction layer including complex queries and transactions.
"""

import pytest
from decimal import Decimal
from uuid import uuid4
from typing import List

from app.models.location import Location, LocationType
from app.crud.location import LocationCRUD
from app.schemas.location import (
    LocationCreate, LocationUpdate, LocationSearch, LocationNearby,
    LocationCapacityUpdate, LocationBulkCreate
)


@pytest.mark.integration
@pytest.mark.asyncio
class TestLocationCRUD:
    """Test Location CRUD operations with database integration."""
    
    @pytest.fixture
    async def location_crud(self, db_session):
        """Create LocationCRUD instance."""
        return LocationCRUD(db_session)
    
    @pytest.fixture
    async def sample_location_data(self):
        """Sample location data for testing."""
        return LocationCreate(
            location_code="INTEG-001",
            location_name="Integration Test Store",
            location_type="STORE",
            address="123 Integration St",
            city="Test City",
            state="Test State",
            country="Test Country",
            postal_code="12345",
            contact_number="+1-555-0123",
            email="test@integration.com",
            website="https://integration.test.com",
            latitude=Decimal("40.7128"),
            longitude=Decimal("-74.0060"),
            timezone="America/New_York",
            operating_hours={
                "monday": {"open": "09:00", "close": "17:00"},
                "tuesday": {"open": "09:00", "close": "17:00"}
            },
            capacity=500,
            is_default=False,
            metadata={"zone": "A", "section": "electronics"}
        )
    
    async def test_create_location_success(self, location_crud, sample_location_data):
        """Test successful location creation."""
        created_by = uuid4()
        location = await location_crud.create(sample_location_data, created_by)
        
        assert location.id is not None
        assert location.location_code == "INTEG-001"
        assert location.location_name == "Integration Test Store"
        assert location.location_type == LocationType.STORE
        assert location.address == "123 Integration St"
        assert location.city == "Test City"
        assert location.state == "Test State"
        assert location.country == "Test Country"
        assert location.postal_code == "12345"
        assert location.contact_number == "+1-555-0123"
        assert location.email == "test@integration.com"
        assert location.website == "https://integration.test.com"
        assert location.latitude == Decimal("40.7128")
        assert location.longitude == Decimal("-74.0060")
        assert location.timezone == "America/New_York"
        assert location.capacity == 500
        assert location.is_default is False
        assert location.is_active is True
        assert location.created_by == created_by
        assert location.created_at is not None
        assert location.updated_at is not None
    
    async def test_create_location_duplicate_code(self, location_crud, sample_location_data):
        """Test creating location with duplicate code raises error."""
        await location_crud.create(sample_location_data)
        
        # Try to create another location with the same code
        with pytest.raises(ValueError, match="Location with code 'INTEG-001' already exists"):
            await location_crud.create(sample_location_data)
    
    async def test_create_location_as_default_unsets_others(self, location_crud):
        """Test creating default location unsets other defaults."""
        # Create first default location
        first_data = LocationCreate(
            location_code="DEFAULT-001",
            location_name="First Default",
            location_type="STORE",
            is_default=True
        )
        first_location = await location_crud.create(first_data)
        assert first_location.is_default is True
        
        # Create second default location
        second_data = LocationCreate(
            location_code="DEFAULT-002", 
            location_name="Second Default",
            location_type="WAREHOUSE",
            is_default=True
        )
        second_location = await location_crud.create(second_data)
        assert second_location.is_default is True
        
        # Refresh first location and check it's no longer default
        refreshed_first = await location_crud.get(first_location.id)
        assert refreshed_first.is_default is False
    
    async def test_get_location_by_id(self, location_crud, sample_location_data):
        """Test getting location by ID."""
        created_location = await location_crud.create(sample_location_data)
        
        retrieved_location = await location_crud.get(created_location.id)
        
        assert retrieved_location is not None
        assert retrieved_location.id == created_location.id
        assert retrieved_location.location_code == "INTEG-001"
        assert retrieved_location.location_name == "Integration Test Store"
    
    async def test_get_location_by_id_not_found(self, location_crud):
        """Test getting non-existent location returns None."""
        non_existent_id = uuid4()
        location = await location_crud.get(non_existent_id)
        assert location is None
    
    async def test_get_location_by_code(self, location_crud, sample_location_data):
        """Test getting location by code."""
        await location_crud.create(sample_location_data)
        
        retrieved_location = await location_crud.get_by_code("INTEG-001")
        
        assert retrieved_location is not None
        assert retrieved_location.location_code == "INTEG-001"
        assert retrieved_location.location_name == "Integration Test Store"
    
    async def test_get_location_by_code_case_insensitive(self, location_crud, sample_location_data):
        """Test getting location by code is case insensitive."""
        await location_crud.create(sample_location_data)
        
        retrieved_location = await location_crud.get_by_code("integ-001")
        
        assert retrieved_location is not None
        assert retrieved_location.location_code == "INTEG-001"
    
    async def test_get_location_with_relations(self, location_crud):
        """Test getting location with relationships loaded."""
        # Create parent location
        parent_data = LocationCreate(
            location_code="PARENT-001",
            location_name="Parent Location",
            location_type="WAREHOUSE"
        )
        parent = await location_crud.create(parent_data)
        
        # Create child location with parent
        child_data = LocationCreate(
            location_code="CHILD-001",
            location_name="Child Location",
            location_type="STORE",
            parent_location_id=parent.id
        )
        child = await location_crud.create(child_data)
        
        # Get child with relations
        child_with_relations = await location_crud.get_with_relations(child.id)
        
        assert child_with_relations is not None
        assert child_with_relations.parent_location is not None
        assert child_with_relations.parent_location.id == parent.id
    
    async def test_update_location(self, location_crud, sample_location_data):
        """Test updating location."""
        location = await location_crud.create(sample_location_data)
        updated_by = uuid4()
        
        update_data = LocationUpdate(
            location_name="Updated Store Name",
            capacity=750,
            is_default=True
        )
        
        updated_location = await location_crud.update(location.id, update_data, updated_by)
        
        assert updated_location is not None
        assert updated_location.location_name == "Updated Store Name"
        assert updated_location.capacity == 750
        assert updated_location.is_default is True
        assert updated_location.updated_by == updated_by
        assert updated_location.location_code == "INTEG-001"  # Should remain unchanged
    
    async def test_update_location_not_found(self, location_crud):
        """Test updating non-existent location returns None."""
        non_existent_id = uuid4()
        update_data = LocationUpdate(location_name="Updated Name")
        
        result = await location_crud.update(non_existent_id, update_data)
        assert result is None
    
    async def test_update_location_as_default_unsets_others(self, location_crud):
        """Test updating location as default unsets other defaults."""
        # Create two locations
        first_data = LocationCreate(
            location_code="FIRST-001",
            location_name="First Location",
            location_type="STORE",
            is_default=True
        )
        first_location = await location_crud.create(first_data)
        
        second_data = LocationCreate(
            location_code="SECOND-001",
            location_name="Second Location", 
            location_type="WAREHOUSE"
        )
        second_location = await location_crud.create(second_data)
        
        # Update second location to be default
        update_data = LocationUpdate(is_default=True)
        await location_crud.update(second_location.id, update_data)
        
        # Check that first location is no longer default
        refreshed_first = await location_crud.get(first_location.id)
        assert refreshed_first.is_default is False
    
    async def test_delete_location_soft_delete(self, location_crud, sample_location_data):
        """Test soft deleting location."""
        location = await location_crud.create(sample_location_data)
        deleted_by = uuid4()
        
        success = await location_crud.delete(location.id, deleted_by)
        
        assert success is True
        
        # Location should not be retrievable by normal get (only active)
        retrieved = await location_crud.get(location.id)
        assert retrieved is None
        
        # But should still exist in database as inactive
        # (We'd need a method to get inactive locations to test this fully)
    
    async def test_delete_location_not_found(self, location_crud):
        """Test deleting non-existent location returns False."""
        non_existent_id = uuid4()
        success = await location_crud.delete(non_existent_id)
        assert success is False
    
    async def test_delete_location_with_children_fails(self, location_crud):
        """Test deleting location with children raises error."""
        # Create parent and child
        parent_data = LocationCreate(
            location_code="PARENT-DEL",
            location_name="Parent To Delete",
            location_type="WAREHOUSE"
        )
        parent = await location_crud.create(parent_data)
        
        child_data = LocationCreate(
            location_code="CHILD-DEL",
            location_name="Child Location",
            location_type="STORE",
            parent_location_id=parent.id
        )
        await location_crud.create(child_data)
        
        # Try to delete parent
        with pytest.raises(ValueError, match="Cannot delete location with child locations"):
            await location_crud.delete(parent.id)
    
    async def test_get_default_location(self, location_crud):
        """Test getting default location."""
        # Create non-default location
        non_default_data = LocationCreate(
            location_code="NON-DEF",
            location_name="Non Default",
            location_type="STORE",
            is_default=False
        )
        await location_crud.create(non_default_data)
        
        # Create default location
        default_data = LocationCreate(
            location_code="DEFAULT",
            location_name="Default Location",
            location_type="WAREHOUSE",
            is_default=True
        )
        default_location = await location_crud.create(default_data)
        
        # Get default
        retrieved_default = await location_crud.get_default()
        
        assert retrieved_default is not None
        assert retrieved_default.id == default_location.id
        assert retrieved_default.is_default is True
    
    async def test_get_default_location_none_exists(self, location_crud):
        """Test getting default location when none exists."""
        # Create only non-default locations
        data = LocationCreate(
            location_code="NON-DEF",
            location_name="Non Default",
            location_type="STORE",
            is_default=False
        )
        await location_crud.create(data)
        
        default = await location_crud.get_default()
        assert default is None
    
    async def test_list_locations_basic(self, location_crud):
        """Test basic location listing."""
        # Create multiple locations
        locations_data = [
            LocationCreate(location_code="LIST-001", location_name="Store A", location_type="STORE"),
            LocationCreate(location_code="LIST-002", location_name="Warehouse B", location_type="WAREHOUSE"),
            LocationCreate(location_code="LIST-003", location_name="Office C", location_type="OFFICE")
        ]
        
        for data in locations_data:
            await location_crud.create(data)
        
        # List all locations
        locations = await location_crud.list()
        
        assert len(locations) >= 3
        location_codes = [loc.location_code for loc in locations]
        assert "LIST-001" in location_codes
        assert "LIST-002" in location_codes
        assert "LIST-003" in location_codes
    
    async def test_list_locations_with_filters(self, location_crud):
        """Test location listing with filters."""
        # Create locations of different types
        store_data = LocationCreate(
            location_code="FILTER-STORE",
            location_name="Filter Store",
            location_type="STORE"
        )
        await location_crud.create(store_data)
        
        warehouse_data = LocationCreate(
            location_code="FILTER-WAREHOUSE", 
            location_name="Filter Warehouse",
            location_type="WAREHOUSE"
        )
        await location_crud.create(warehouse_data)
        
        # Filter by type
        stores = await location_crud.list(location_type=LocationType.STORE)
        warehouses = await location_crud.list(location_type=LocationType.WAREHOUSE)
        
        store_codes = [loc.location_code for loc in stores]
        warehouse_codes = [loc.location_code for loc in warehouses]
        
        assert "FILTER-STORE" in store_codes
        assert "FILTER-STORE" not in warehouse_codes
        assert "FILTER-WAREHOUSE" in warehouse_codes
        assert "FILTER-WAREHOUSE" not in store_codes
    
    async def test_list_locations_pagination(self, location_crud):
        """Test location listing with pagination."""
        # Create multiple locations
        for i in range(5):
            data = LocationCreate(
                location_code=f"PAGE-{i:03d}",
                location_name=f"Location {i}",
                location_type="STORE"
            )
            await location_crud.create(data)
        
        # Test pagination
        page1 = await location_crud.list(skip=0, limit=2)
        page2 = await location_crud.list(skip=2, limit=2)
        
        assert len(page1) == 2
        assert len(page2) == 2
        
        # Ensure different locations in each page
        page1_codes = [loc.location_code for loc in page1]
        page2_codes = [loc.location_code for loc in page2]
        assert len(set(page1_codes) & set(page2_codes)) == 0  # No overlap
    
    async def test_list_locations_sorting(self, location_crud):
        """Test location listing with sorting."""
        # Create locations with different names
        locations_data = [
            LocationCreate(location_code="SORT-C", location_name="Charlie Store", location_type="STORE"),
            LocationCreate(location_code="SORT-A", location_name="Alpha Store", location_type="STORE"),
            LocationCreate(location_code="SORT-B", location_name="Beta Store", location_type="STORE")
        ]
        
        for data in locations_data:
            await location_crud.create(data)
        
        # Test ascending sort by name
        locations_asc = await location_crud.list(
            sort_by="location_name",
            sort_order="asc",
            limit=10
        )
        names_asc = [loc.location_name for loc in locations_asc if loc.location_code.startswith("SORT-")]
        expected_asc_order = ["Alpha Store", "Beta Store", "Charlie Store"]
        
        # Check if our test locations are in the correct order
        filtered_names = [name for name in names_asc if name in expected_asc_order]
        assert filtered_names == expected_asc_order
        
        # Test descending sort by name
        locations_desc = await location_crud.list(
            sort_by="location_name",
            sort_order="desc",
            limit=10
        )
        names_desc = [loc.location_name for loc in locations_desc if loc.location_code.startswith("SORT-")]
        filtered_names_desc = [name for name in names_desc if name in expected_asc_order]
        assert filtered_names_desc == expected_asc_order[::-1]  # Reversed


@pytest.mark.integration
@pytest.mark.asyncio
class TestLocationSearchOperations:
    """Test Location search and query operations."""
    
    @pytest.fixture
    async def location_crud(self, db_session):
        """Create LocationCRUD instance."""
        return LocationCRUD(db_session)
    
    @pytest.fixture
    async def search_test_locations(self, location_crud):
        """Create test locations for search operations."""
        locations_data = [
            LocationCreate(
                location_code="SEARCH-NYC",
                location_name="New York Store",
                location_type="STORE",
                address="123 Broadway",
                city="New York",
                state="NY",
                country="USA"
            ),
            LocationCreate(
                location_code="SEARCH-LA",
                location_name="Los Angeles Warehouse",
                location_type="WAREHOUSE",
                address="456 Hollywood Blvd",
                city="Los Angeles", 
                state="CA",
                country="USA"
            ),
            LocationCreate(
                location_code="SEARCH-UK",
                location_name="London Office",
                location_type="OFFICE",
                address="789 Oxford St",
                city="London",
                state="England",
                country="UK"
            ),
            LocationCreate(
                location_code="SEARCH-INACTIVE",
                location_name="Inactive Store",
                location_type="STORE",
                city="Inactive City",
                is_active=False
            )
        ]
        
        created_locations = []
        for data in locations_data:
            location = await location_crud.create(data)
            created_locations.append(location)
        
        return created_locations
    
    async def test_search_by_text_term(self, location_crud, search_test_locations):
        """Test searching locations by text term."""
        search_params = LocationSearch(search_term="New York")
        locations, total = await location_crud.search(search_params)
        
        assert total >= 1
        location_names = [loc.location_name for loc in locations]
        assert "New York Store" in location_names
    
    async def test_search_by_location_type(self, location_crud, search_test_locations):
        """Test searching locations by type."""
        search_params = LocationSearch(location_type=LocationType.WAREHOUSE)
        locations, total = await location_crud.search(search_params)
        
        warehouse_locations = [loc for loc in locations if loc.location_type == LocationType.WAREHOUSE]
        assert len(warehouse_locations) >= 1
        
        warehouse_names = [loc.location_name for loc in warehouse_locations]
        assert "Los Angeles Warehouse" in warehouse_names
    
    async def test_search_by_city(self, location_crud, search_test_locations):
        """Test searching locations by city."""
        search_params = LocationSearch(city="London")
        locations, total = await location_crud.search(search_params)
        
        assert total >= 1
        london_locations = [loc for loc in locations if "London" in (loc.city or "")]
        assert len(london_locations) >= 1
    
    async def test_search_by_state(self, location_crud, search_test_locations):
        """Test searching locations by state."""
        search_params = LocationSearch(state="CA")
        locations, total = await location_crud.search(search_params)
        
        ca_locations = [loc for loc in locations if loc.state == "CA"]
        assert len(ca_locations) >= 1
        assert "Los Angeles Warehouse" in [loc.location_name for loc in ca_locations]
    
    async def test_search_by_country(self, location_crud, search_test_locations):
        """Test searching locations by country."""
        search_params = LocationSearch(country="USA")
        locations, total = await location_crud.search(search_params)
        
        usa_locations = [loc for loc in locations if loc.country == "USA"]
        assert len(usa_locations) >= 2  # NYC and LA
        
        usa_names = [loc.location_name for loc in usa_locations]
        assert "New York Store" in usa_names
        assert "Los Angeles Warehouse" in usa_names
    
    async def test_search_active_only(self, location_crud, search_test_locations):
        """Test searching active locations only."""
        # Search for active locations (default)
        search_params = LocationSearch(is_active=True)
        active_locations, active_total = await location_crud.search(search_params)
        
        # Search for inactive locations
        search_params_inactive = LocationSearch(is_active=False) 
        inactive_locations, inactive_total = await location_crud.search(search_params_inactive)
        
        # Verify active locations don't contain inactive ones
        active_names = [loc.location_name for loc in active_locations]
        inactive_names = [loc.location_name for loc in inactive_locations]
        
        assert "Inactive Store" not in active_names
        assert "Inactive Store" in inactive_names
    
    async def test_search_with_pagination(self, location_crud, search_test_locations):
        """Test search with pagination parameters."""
        search_params = LocationSearch(
            country="USA",
            skip=0,
            limit=1
        )
        locations, total = await location_crud.search(search_params)
        
        assert len(locations) == 1
        assert total >= 2  # We created at least 2 USA locations
    
    async def test_search_with_sorting(self, location_crud, search_test_locations):
        """Test search with sorting."""
        # Sort by location name ascending
        search_params = LocationSearch(
            sort_by="location_name",
            sort_order="asc",
            limit=10
        )
        locations, _ = await location_crud.search(search_params)
        
        # Extract our test locations and verify order
        test_names = []
        for loc in locations:
            if loc.location_code.startswith("SEARCH-"):
                test_names.append(loc.location_name)
        
        # Should be in alphabetical order
        assert test_names == sorted(test_names)
    
    async def test_search_multiple_criteria(self, location_crud, search_test_locations):
        """Test search with multiple criteria."""
        search_params = LocationSearch(
            location_type=LocationType.STORE,
            country="USA",
            is_active=True
        )
        locations, total = await location_crud.search(search_params)
        
        # Should find only active stores in USA
        for location in locations:
            if location.location_code.startswith("SEARCH-"):
                assert location.location_type == LocationType.STORE
                assert location.country == "USA"
                assert location.is_active is True


@pytest.mark.integration
@pytest.mark.asyncio
class TestLocationGeospatialOperations:
    """Test Location geospatial operations."""
    
    @pytest.fixture
    async def location_crud(self, db_session):
        """Create LocationCRUD instance."""
        return LocationCRUD(db_session)
    
    @pytest.fixture
    async def geospatial_test_locations(self, location_crud):
        """Create test locations with coordinates for geospatial operations."""
        locations_data = [
            LocationCreate(
                location_code="GEO-NYC",
                location_name="New York Store",
                location_type="STORE",
                latitude=Decimal("40.7128"),
                longitude=Decimal("-74.0060"),
                city="New York"
            ),
            LocationCreate(
                location_code="GEO-BOS",
                location_name="Boston Store",
                location_type="STORE",
                latitude=Decimal("42.3601"),
                longitude=Decimal("-71.0589"),
                city="Boston"
            ),
            LocationCreate(
                location_code="GEO-LA", 
                location_name="Los Angeles Store",
                location_type="STORE",
                latitude=Decimal("34.0522"),
                longitude=Decimal("-118.2437"),
                city="Los Angeles"
            ),
            LocationCreate(
                location_code="GEO-NO-COORDS",
                location_name="No Coordinates Store",
                location_type="STORE",
                city="Unknown"
            )
        ]
        
        created_locations = []
        for data in locations_data:
            location = await location_crud.create(data)
            created_locations.append(location)
        
        return created_locations
    
    async def test_find_nearby_locations(self, location_crud, geospatial_test_locations):
        """Test finding nearby locations using coordinates."""
        # Search near New York (should find NYC and Boston, but not LA)
        nearby_params = LocationNearby(
            latitude=Decimal("40.7128"),  # NYC coordinates
            longitude=Decimal("-74.0060"),
            radius_km=500.0,  # 500km radius
            limit=10
        )
        
        nearby_results = await location_crud.find_nearby(nearby_params)
        
        assert len(nearby_results) >= 2  # Should find at least NYC and Boston
        
        # Extract location names and distances
        results_info = [(row.location_name, row.distance) for row in nearby_results]
        location_names = [info[0] for info in results_info]
        
        # Should find NYC (distance ~0) and Boston (distance ~300km)
        assert "New York Store" in location_names
        assert "Boston Store" in location_names
        # LA should not be in results (too far)
        assert "Los Angeles Store" not in location_names
        
        # Verify distances are reasonable
        for name, distance in results_info:
            if name == "New York Store":
                assert distance < 1  # Should be very close to itself
            elif name == "Boston Store":
                assert 200 < distance < 400  # ~300km between NYC and Boston
    
    async def test_find_nearby_locations_small_radius(self, location_crud, geospatial_test_locations):
        """Test finding nearby locations with small radius."""
        # Search with very small radius near NYC
        nearby_params = LocationNearby(
            latitude=Decimal("40.7128"),
            longitude=Decimal("-74.0060"),
            radius_km=1.0,  # 1km radius
            limit=10
        )
        
        nearby_results = await location_crud.find_nearby(nearby_params)
        
        # Should only find NYC store
        location_names = [row.location_name for row in nearby_results]
        assert "New York Store" in location_names
        assert "Boston Store" not in location_names
        assert len(nearby_results) >= 1
    
    async def test_find_nearby_locations_with_type_filter(self, location_crud, geospatial_test_locations):
        """Test finding nearby locations filtered by type."""
        nearby_params = LocationNearby(
            latitude=Decimal("40.7128"),
            longitude=Decimal("-74.0060"),
            radius_km=500.0,
            location_type=LocationType.STORE,  # Filter by store type
            limit=10
        )
        
        nearby_results = await location_crud.find_nearby(nearby_params)
        
        # All results should be stores
        for row in nearby_results:
            assert row.location_type == LocationType.STORE
    
    async def test_find_nearby_locations_limit(self, location_crud, geospatial_test_locations):
        """Test finding nearby locations with result limit."""
        nearby_params = LocationNearby(
            latitude=Decimal("40.7128"),
            longitude=Decimal("-74.0060"),
            radius_km=1000.0,  # Large radius
            limit=1  # Limit to 1 result
        )
        
        nearby_results = await location_crud.find_nearby(nearby_params)
        
        assert len(nearby_results) == 1
        # Should be the closest one (NYC itself)
        assert nearby_results[0].location_name == "New York Store"
    
    async def test_calculate_distance_between_locations(self, location_crud, geospatial_test_locations):
        """Test calculating distance between two locations."""
        # Find NYC and Boston locations
        nyc_location = None
        boston_location = None
        
        for location in geospatial_test_locations:
            if location.location_code == "GEO-NYC":
                nyc_location = location
            elif location.location_code == "GEO-BOS":
                boston_location = location
        
        assert nyc_location is not None
        assert boston_location is not None
        
        # Calculate distance
        distance = await location_crud.calculate_distance(nyc_location.id, boston_location.id)
        
        assert distance is not None
        # Distance between NYC and Boston is approximately 300km
        assert 250 < distance < 350
    
    async def test_calculate_distance_missing_coordinates(self, location_crud, geospatial_test_locations):
        """Test calculating distance when one location has no coordinates."""
        # Find locations
        nyc_location = None
        no_coords_location = None
        
        for location in geospatial_test_locations:
            if location.location_code == "GEO-NYC":
                nyc_location = location
            elif location.location_code == "GEO-NO-COORDS":
                no_coords_location = location
        
        assert nyc_location is not None
        assert no_coords_location is not None
        
        # Calculate distance should return None
        distance = await location_crud.calculate_distance(nyc_location.id, no_coords_location.id)
        assert distance is None
    
    async def test_calculate_distance_nonexistent_location(self, location_crud):
        """Test calculating distance with non-existent location."""
        non_existent_id = uuid4()
        another_non_existent_id = uuid4()
        
        distance = await location_crud.calculate_distance(non_existent_id, another_non_existent_id)
        assert distance is None


@pytest.mark.integration
@pytest.mark.asyncio
class TestLocationHierarchicalOperations:
    """Test Location hierarchical operations."""
    
    @pytest.fixture
    async def location_crud(self, db_session):
        """Create LocationCRUD instance."""
        return LocationCRUD(db_session)
    
    @pytest.fixture
    async def hierarchical_test_locations(self, location_crud):
        """Create test locations with hierarchical structure."""
        # Create root location (HQ)
        hq_data = LocationCreate(
            location_code="HQ-ROOT",
            location_name="Corporate Headquarters",
            location_type="OFFICE"
        )
        hq = await location_crud.create(hq_data)
        
        # Create regional locations
        east_region_data = LocationCreate(
            location_code="REGION-EAST",
            location_name="East Region",
            location_type="OFFICE",
            parent_location_id=hq.id
        )
        east_region = await location_crud.create(east_region_data)
        
        west_region_data = LocationCreate(
            location_code="REGION-WEST",
            location_name="West Region",
            location_type="OFFICE",
            parent_location_id=hq.id
        )
        west_region = await location_crud.create(west_region_data)
        
        # Create local stores under regions
        nyc_store_data = LocationCreate(
            location_code="STORE-NYC",
            location_name="NYC Store",
            location_type="STORE",
            parent_location_id=east_region.id
        )
        nyc_store = await location_crud.create(nyc_store_data)
        
        boston_store_data = LocationCreate(
            location_code="STORE-BOS",
            location_name="Boston Store",
            location_type="STORE",
            parent_location_id=east_region.id
        )
        boston_store = await location_crud.create(boston_store_data)
        
        la_store_data = LocationCreate(
            location_code="STORE-LA",
            location_name="LA Store", 
            location_type="STORE",
            parent_location_id=west_region.id
        )
        la_store = await location_crud.create(la_store_data)
        
        return {
            "hq": hq,
            "east_region": east_region,
            "west_region": west_region,
            "nyc_store": nyc_store,
            "boston_store": boston_store,
            "la_store": la_store
        }
    
    async def test_get_children_locations(self, location_crud, hierarchical_test_locations):
        """Test getting direct child locations."""
        hq = hierarchical_test_locations["hq"]
        east_region = hierarchical_test_locations["east_region"]
        
        # Get children of HQ (should be regions)
        hq_children = await location_crud.get_children(hq.id)
        assert len(hq_children) == 2
        
        child_names = [child.location_name for child in hq_children]
        assert "East Region" in child_names
        assert "West Region" in child_names
        
        # Get children of East Region (should be stores)
        east_children = await location_crud.get_children(east_region.id)
        assert len(east_children) == 2
        
        east_child_names = [child.location_name for child in east_children]
        assert "NYC Store" in east_child_names
        assert "Boston Store" in east_child_names
    
    async def test_get_all_descendants(self, location_crud, hierarchical_test_locations):
        """Test getting all descendants recursively."""
        hq = hierarchical_test_locations["hq"]
        
        # Get all descendants of HQ
        all_descendants = await location_crud.get_all_descendants(hq.id)
        
        # Should include 2 regions + 3 stores = 5 descendants
        assert len(all_descendants) >= 5
        
        descendant_names = [desc.location_name for desc in all_descendants]
        expected_names = ["East Region", "West Region", "NYC Store", "Boston Store", "LA Store"]
        
        for expected_name in expected_names:
            assert expected_name in descendant_names
    
    async def test_get_ancestors(self, location_crud, hierarchical_test_locations):
        """Test getting ancestors of a location."""
        nyc_store = hierarchical_test_locations["nyc_store"]
        
        # Get ancestors of NYC Store
        ancestors = await location_crud.get_ancestors(nyc_store.id)
        
        # Should have 2 ancestors: East Region and HQ
        assert len(ancestors) == 2
        
        ancestor_names = [anc.location_name for anc in ancestors]
        assert "East Region" in ancestor_names
        assert "Corporate Headquarters" in ancestor_names
    
    async def test_has_children_true(self, location_crud, hierarchical_test_locations):
        """Test has_children returns True when children exist."""
        hq = hierarchical_test_locations["hq"]
        east_region = hierarchical_test_locations["east_region"]
        
        assert await location_crud.has_children(hq.id) is True
        assert await location_crud.has_children(east_region.id) is True
    
    async def test_has_children_false(self, location_crud, hierarchical_test_locations):
        """Test has_children returns False when no children exist."""
        nyc_store = hierarchical_test_locations["nyc_store"]
        
        assert await location_crud.has_children(nyc_store.id) is False


@pytest.mark.integration
@pytest.mark.asyncio  
class TestLocationBulkOperations:
    """Test Location bulk operations."""
    
    @pytest.fixture
    async def location_crud(self, db_session):
        """Create LocationCRUD instance.""" 
        return LocationCRUD(db_session)
    
    async def test_bulk_create_locations(self, location_crud):
        """Test bulk creating multiple locations."""
        locations_data = [
            LocationCreate(
                location_code=f"BULK-{i:03d}",
                location_name=f"Bulk Location {i}",
                location_type="STORE"
            ) for i in range(5)
        ]
        
        created_by = uuid4()
        created_locations = await location_crud.bulk_create(locations_data, created_by)
        
        assert len(created_locations) == 5
        
        # Verify all locations were created correctly
        for i, location in enumerate(created_locations):
            assert location.location_code == f"BULK-{i:03d}"
            assert location.location_name == f"Bulk Location {i}"
            assert location.location_type == LocationType.STORE
            assert location.created_by == created_by
    
    async def test_bulk_create_with_duplicates_skip(self, location_crud):
        """Test bulk create with skip_duplicates=True."""
        # Create one location first
        existing_data = LocationCreate(
            location_code="BULK-DUP-001",
            location_name="Existing Location",
            location_type="STORE"
        )
        await location_crud.create(existing_data)
        
        # Try to bulk create including the duplicate
        locations_data = [
            LocationCreate(
                location_code="BULK-DUP-001",  # Duplicate
                location_name="Should Be Skipped",
                location_type="WAREHOUSE"
            ),
            LocationCreate(
                location_code="BULK-DUP-002",  # New
                location_name="Should Be Created",
                location_type="STORE"
            )
        ]
        
        created_locations = await location_crud.bulk_create(
            locations_data,
            skip_duplicates=True
        )
        
        # Should only create the non-duplicate location
        assert len(created_locations) == 1
        assert created_locations[0].location_code == "BULK-DUP-002"
    
    async def test_bulk_update_locations(self, location_crud):
        """Test bulk updating multiple locations."""
        # Create locations to update
        locations_data = [
            LocationCreate(
                location_code=f"BULK-UPD-{i:03d}",
                location_name=f"Original Name {i}",
                location_type="STORE",
                capacity=100
            ) for i in range(3)
        ]
        
        created_locations = []
        for data in locations_data:
            location = await location_crud.create(data)
            created_locations.append(location)
        
        # Bulk update
        location_ids = [loc.id for loc in created_locations]
        update_data = {"capacity": 200, "location_type": LocationType.WAREHOUSE}
        updated_by = uuid4()
        
        rows_updated = await location_crud.bulk_update(location_ids, update_data, updated_by)
        
        assert rows_updated == 3
        
        # Verify updates
        for location_id in location_ids:
            updated_location = await location_crud.get(location_id)
            assert updated_location.capacity == 200
            assert updated_location.location_type == LocationType.WAREHOUSE
            assert updated_location.updated_by == updated_by
    
    async def test_bulk_delete_soft(self, location_crud):
        """Test bulk soft delete of locations."""
        # Create locations to delete
        locations_data = [
            LocationCreate(
                location_code=f"BULK-DEL-{i:03d}",
                location_name=f"To Delete {i}",
                location_type="STORE"
            ) for i in range(3)
        ]
        
        created_locations = []
        for data in locations_data:
            location = await location_crud.create(data)
            created_locations.append(location)
        
        # Bulk soft delete
        location_ids = [loc.id for loc in created_locations]
        deleted_by = uuid4()
        
        rows_deleted = await location_crud.bulk_delete(
            location_ids,
            deleted_by,
            hard_delete=False
        )
        
        assert rows_deleted == 3
        
        # Verify locations are no longer retrievable (soft deleted)
        for location_id in location_ids:
            deleted_location = await location_crud.get(location_id)
            assert deleted_location is None  # Should not be found (inactive)


@pytest.mark.integration
@pytest.mark.asyncio
class TestLocationStatistics:
    """Test Location statistics operations."""
    
    @pytest.fixture
    async def location_crud(self, db_session):
        """Create LocationCRUD instance."""
        return LocationCRUD(db_session)
    
    @pytest.fixture
    async def statistics_test_locations(self, location_crud):
        """Create test locations for statistics."""
        locations_data = [
            LocationCreate(
                location_code="STATS-STORE-001",
                location_name="Store 1",
                location_type="STORE",
                city="New York",
                state="NY", 
                country="USA",
                capacity=100,
                latitude=Decimal("40.7128"),
                longitude=Decimal("-74.0060"),
                is_default=True
            ),
            LocationCreate(
                location_code="STATS-STORE-002",
                location_name="Store 2",
                location_type="STORE",
                city="Los Angeles",
                state="CA",
                country="USA",
                capacity=150
            ),
            LocationCreate(
                location_code="STATS-WAREHOUSE-001",
                location_name="Warehouse 1",
                location_type="WAREHOUSE",
                city="Toronto",
                state="ON",
                country="Canada",
                capacity=500,
                latitude=Decimal("43.6532"),
                longitude=Decimal("-79.3832")
            ),
            LocationCreate(
                location_code="STATS-OFFICE-001",
                location_name="Office 1",
                location_type="OFFICE",
                city="London",
                state="England",
                country="UK",
                is_active=False  # Inactive location
            )
        ]
        
        created_locations = []
        for data in locations_data:
            location = await location_crud.create(data)
            created_locations.append(location)
        
        return created_locations
    
    async def test_get_statistics(self, location_crud, statistics_test_locations):
        """Test getting comprehensive location statistics."""
        stats = await location_crud.get_statistics()
        
        # Test basic counts
        assert stats["total_locations"] >= 4
        assert stats["active_locations"] >= 3  # 3 active locations created
        assert stats["inactive_locations"] >= 1  # 1 inactive location created
        
        # Test count by type
        type_counts = stats["locations_by_type"]
        assert type_counts.get(LocationType.STORE, 0) >= 2
        assert type_counts.get(LocationType.WAREHOUSE, 0) >= 1
        assert type_counts.get(LocationType.OFFICE, 0) >= 0  # Office is inactive, may not appear
        
        # Test count by country
        country_counts = stats["locations_by_country"]
        assert country_counts.get("USA", 0) >= 2
        assert country_counts.get("Canada", 0) >= 1
        
        # Test count by state
        state_counts = stats["locations_by_state"]
        assert state_counts.get("NY", 0) >= 1
        assert state_counts.get("CA", 0) >= 1
        assert state_counts.get("ON", 0) >= 1
        
        # Test default location
        assert stats["default_location_id"] is not None
        
        # Test capacity stats
        capacity_stats = stats["capacity_stats"]
        assert capacity_stats["total"] >= 750  # 100 + 150 + 500
        assert capacity_stats["average"] > 0
        assert capacity_stats["min"] >= 100
        assert capacity_stats["max"] >= 500
        
        # Test locations with coordinates
        assert stats["locations_with_coordinates"] >= 2  # Store 1 and Warehouse 1
    
    async def test_get_total_capacity_all_types(self, location_crud, statistics_test_locations):
        """Test getting total capacity across all location types."""
        total_capacity = await location_crud.get_total_capacity()
        
        # Should include Store 1 (100) + Store 2 (150) + Warehouse 1 (500) = 750
        # Office 1 has no capacity, so it shouldn't be counted
        assert total_capacity >= 750
    
    async def test_get_total_capacity_by_type(self, location_crud, statistics_test_locations):
        """Test getting total capacity filtered by location type."""
        # Get total capacity for stores only
        store_capacity = await location_crud.get_total_capacity(LocationType.STORE)
        assert store_capacity >= 250  # Store 1 (100) + Store 2 (150)
        
        # Get total capacity for warehouses only
        warehouse_capacity = await location_crud.get_total_capacity(LocationType.WAREHOUSE)
        assert warehouse_capacity >= 500  # Warehouse 1 (500)
        
        # Get total capacity for offices (should be 0 since office has no capacity)
        office_capacity = await location_crud.get_total_capacity(LocationType.OFFICE)
        assert office_capacity == 0