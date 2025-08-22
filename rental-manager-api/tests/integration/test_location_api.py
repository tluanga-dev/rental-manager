"""
Integration tests for Location API endpoints.
Tests complete API functionality including authentication, validation, and business logic.
"""

import pytest
from decimal import Decimal
from uuid import uuid4
import json
from fastapi import status
from httpx import AsyncClient

from app.models.location import Location, LocationType
from app.models.user import User
from tests.conftest import create_test_user


@pytest.mark.integration
@pytest.mark.asyncio
class TestLocationAPICreate:
    """Test Location creation API endpoints."""
    
    async def test_create_location_success(self, client: AsyncClient, db_session):
        """Test successful location creation."""
        location_data = {
            "location_code": "API-001",
            "location_name": "API Test Store",
            "location_type": "STORE",
            "address": "123 API Street",
            "city": "API City",
            "state": "AS",
            "country": "API Country",
            "postal_code": "12345",
            "contact_number": "+1-555-0123",
            "email": "test@api.com",
            "website": "https://api.test.com",
            "latitude": "40.7128",
            "longitude": "-74.0060",
            "timezone": "America/New_York",
            "operating_hours": {
                "monday": {"open": "09:00", "close": "17:00"},
                "tuesday": {"open": "09:00", "close": "17:00"}
            },
            "capacity": 500,
            "is_default": False,
            "metadata": {"zone": "A", "section": "electronics"}
        }
        
        response = await client.post("/api/v1/locations/", json=location_data)
        
        assert response.status_code == status.HTTP_201_CREATED
        
        response_data = response.json()
        assert response_data["location_code"] == "API-001"
        assert response_data["location_name"] == "API Test Store"
        assert response_data["location_type"] == "STORE"
        assert response_data["address"] == "123 API Street"
        assert response_data["city"] == "API City"
        assert response_data["state"] == "AS"
        assert response_data["country"] == "API Country"
        assert response_data["postal_code"] == "12345"
        assert response_data["contact_number"] == "+1-555-0123"
        assert response_data["email"] == "test@api.com"
        assert response_data["website"] == "https://api.test.com"
        assert response_data["latitude"] == "40.7128"
        assert response_data["longitude"] == "-74.0060"
        assert response_data["timezone"] == "America/New_York"
        assert response_data["capacity"] == 500
        assert response_data["is_default"] is False
        assert response_data["is_active"] is True
        assert response_data["metadata"] == {"zone": "A", "section": "electronics"}
        assert response_data["id"] is not None
        assert response_data["created_at"] is not None
    
    async def test_create_location_minimal_data(self, client: AsyncClient):
        """Test creating location with minimal required data."""
        location_data = {
            "location_code": "MIN-001",
            "location_name": "Minimal Location",
            "location_type": "OFFICE"
        }
        
        response = await client.post("/api/v1/locations/", json=location_data)
        
        assert response.status_code == status.HTTP_201_CREATED
        
        response_data = response.json()
        assert response_data["location_code"] == "MIN-001"
        assert response_data["location_name"] == "Minimal Location"
        assert response_data["location_type"] == "OFFICE"
        assert response_data["timezone"] == "UTC"  # Default value
        assert response_data["is_default"] is False
        assert response_data["is_active"] is True
    
    async def test_create_location_duplicate_code(self, client: AsyncClient):
        """Test creating location with duplicate code returns conflict error."""
        location_data = {
            "location_code": "DUP-001",
            "location_name": "First Location",
            "location_type": "STORE"
        }
        
        # Create first location
        response1 = await client.post("/api/v1/locations/", json=location_data)
        assert response1.status_code == status.HTTP_201_CREATED
        
        # Try to create second location with same code
        location_data["location_name"] = "Second Location"
        response2 = await client.post("/api/v1/locations/", json=location_data)
        
        assert response2.status_code == status.HTTP_409_CONFLICT
        
        error_data = response2.json()
        assert "already exists" in error_data["detail"]["message"].lower()
        assert error_data["detail"]["error_code"] == "CONFLICT_ERROR"
    
    async def test_create_location_invalid_data(self, client: AsyncClient):
        """Test creating location with invalid data returns validation error."""
        # Test invalid email
        location_data = {
            "location_code": "INV-001",
            "location_name": "Invalid Location",
            "location_type": "STORE",
            "email": "invalid-email"
        }
        
        response = await client.post("/api/v1/locations/", json=location_data)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    async def test_create_location_coordinates_validation(self, client: AsyncClient):
        """Test coordinate validation in location creation."""
        # Test valid coordinates
        valid_data = {
            "location_code": "COORD-001",
            "location_name": "Valid Coordinates",
            "location_type": "STORE",
            "latitude": "40.7128",
            "longitude": "-74.0060"
        }
        
        response = await client.post("/api/v1/locations/", json=valid_data)
        assert response.status_code == status.HTTP_201_CREATED
        
        # Test invalid latitude
        invalid_data = {
            "location_code": "COORD-002",
            "location_name": "Invalid Coordinates",
            "location_type": "STORE",
            "latitude": "91.0",  # Invalid latitude
            "longitude": "-74.0060"
        }
        
        response = await client.post("/api/v1/locations/", json=invalid_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.integration
@pytest.mark.asyncio
class TestLocationAPIRetrieve:
    """Test Location retrieval API endpoints."""
    
    @pytest.fixture
    async def sample_location(self, client: AsyncClient):
        """Create a sample location for testing."""
        location_data = {
            "location_code": "RETRIEVE-001",
            "location_name": "Retrieve Test Store",
            "location_type": "STORE",
            "city": "Retrieve City",
            "latitude": "40.7128",
            "longitude": "-74.0060"
        }
        
        response = await client.post("/api/v1/locations/", json=location_data)
        assert response.status_code == status.HTTP_201_CREATED
        return response.json()
    
    async def test_get_location_by_id(self, client: AsyncClient, sample_location):
        """Test getting location by ID."""
        location_id = sample_location["id"]
        
        response = await client.get(f"/api/v1/locations/{location_id}")
        
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        assert response_data["id"] == location_id
        assert response_data["location_code"] == "RETRIEVE-001"
        assert response_data["location_name"] == "Retrieve Test Store"
    
    async def test_get_location_by_id_not_found(self, client: AsyncClient):
        """Test getting non-existent location returns 404."""
        non_existent_id = str(uuid4())
        
        response = await client.get(f"/api/v1/locations/{non_existent_id}")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        
        error_data = response.json()
        assert "not found" in error_data["detail"]["message"].lower()
        assert error_data["detail"]["error_code"] == "NOT_FOUND_ERROR"
    
    async def test_get_location_by_code(self, client: AsyncClient, sample_location):
        """Test getting location by code."""
        response = await client.get("/api/v1/locations/code/RETRIEVE-001")
        
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        assert response_data["location_code"] == "RETRIEVE-001"
        assert response_data["location_name"] == "Retrieve Test Store"
    
    async def test_get_location_by_code_case_insensitive(self, client: AsyncClient, sample_location):
        """Test getting location by code is case insensitive."""
        response = await client.get("/api/v1/locations/code/retrieve-001")
        
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        assert response_data["location_code"] == "RETRIEVE-001"
    
    async def test_get_location_by_code_not_found(self, client: AsyncClient):
        """Test getting location by non-existent code returns 404."""
        response = await client.get("/api/v1/locations/code/NON-EXISTENT")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.integration
@pytest.mark.asyncio
class TestLocationAPIUpdate:
    """Test Location update API endpoints."""
    
    @pytest.fixture
    async def sample_location(self, client: AsyncClient):
        """Create a sample location for testing."""
        location_data = {
            "location_code": "UPDATE-001",
            "location_name": "Update Test Store",
            "location_type": "STORE",
            "capacity": 100
        }
        
        response = await client.post("/api/v1/locations/", json=location_data)
        assert response.status_code == status.HTTP_201_CREATED
        return response.json()
    
    async def test_update_location_success(self, client: AsyncClient, sample_location):
        """Test successful location update."""
        location_id = sample_location["id"]
        
        update_data = {
            "location_name": "Updated Store Name",
            "capacity": 200,
            "city": "Updated City"
        }
        
        response = await client.put(f"/api/v1/locations/{location_id}", json=update_data)
        
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        assert response_data["location_name"] == "Updated Store Name"
        assert response_data["capacity"] == 200
        assert response_data["city"] == "Updated City"
        assert response_data["location_code"] == "UPDATE-001"  # Should remain unchanged
    
    async def test_update_location_partial_update(self, client: AsyncClient, sample_location):
        """Test partial location update."""
        location_id = sample_location["id"]
        
        update_data = {
            "capacity": 150
        }
        
        response = await client.put(f"/api/v1/locations/{location_id}", json=update_data)
        
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        assert response_data["capacity"] == 150
        assert response_data["location_name"] == "Update Test Store"  # Should remain unchanged
    
    async def test_update_location_not_found(self, client: AsyncClient):
        """Test updating non-existent location returns 404."""
        non_existent_id = str(uuid4())
        update_data = {"location_name": "Updated Name"}
        
        response = await client.put(f"/api/v1/locations/{non_existent_id}", json=update_data)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    async def test_update_location_coordinates(self, client: AsyncClient, sample_location):
        """Test updating location coordinates."""
        location_id = sample_location["id"]
        
        update_data = {
            "latitude": "42.3601",
            "longitude": "-71.0589"
        }
        
        response = await client.put(f"/api/v1/locations/{location_id}", json=update_data)
        
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        assert response_data["latitude"] == "42.3601"
        assert response_data["longitude"] == "-71.0589"
    
    async def test_update_location_invalid_coordinates(self, client: AsyncClient, sample_location):
        """Test updating location with invalid coordinates."""
        location_id = sample_location["id"]
        
        update_data = {
            "latitude": "91.0"  # Only latitude, should require longitude too
        }
        
        response = await client.put(f"/api/v1/locations/{location_id}", json=update_data)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.integration
@pytest.mark.asyncio
class TestLocationAPIDelete:
    """Test Location deletion API endpoints."""
    
    @pytest.fixture
    async def sample_location(self, client: AsyncClient):
        """Create a sample location for testing."""
        location_data = {
            "location_code": "DELETE-001",
            "location_name": "Delete Test Store",
            "location_type": "STORE"
        }
        
        response = await client.post("/api/v1/locations/", json=location_data)
        assert response.status_code == status.HTTP_201_CREATED
        return response.json()
    
    async def test_delete_location_success(self, client: AsyncClient, sample_location):
        """Test successful location deletion."""
        location_id = sample_location["id"]
        
        response = await client.delete(f"/api/v1/locations/{location_id}")
        
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        assert "deleted successfully" in response_data["message"]
        assert response_data["location_id"] == location_id
        
        # Verify location is no longer retrievable
        get_response = await client.get(f"/api/v1/locations/{location_id}")
        assert get_response.status_code == status.HTTP_404_NOT_FOUND
    
    async def test_delete_location_not_found(self, client: AsyncClient):
        """Test deleting non-existent location returns 404."""
        non_existent_id = str(uuid4())
        
        response = await client.delete(f"/api/v1/locations/{non_existent_id}")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    async def test_delete_location_with_children_without_force(self, client: AsyncClient):
        """Test deleting location with children without force flag fails."""
        # Create parent location
        parent_data = {
            "location_code": "PARENT-DELETE",
            "location_name": "Parent to Delete",
            "location_type": "WAREHOUSE"
        }
        parent_response = await client.post("/api/v1/locations/", json=parent_data)
        assert parent_response.status_code == status.HTTP_201_CREATED
        parent_location = parent_response.json()
        
        # Create child location
        child_data = {
            "location_code": "CHILD-DELETE",
            "location_name": "Child Location",
            "location_type": "STORE",
            "parent_location_id": parent_location["id"]
        }
        child_response = await client.post("/api/v1/locations/", json=child_data)
        assert child_response.status_code == status.HTTP_201_CREATED
        
        # Try to delete parent without force
        response = await client.delete(f"/api/v1/locations/{parent_location['id']}")
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        error_data = response.json()
        assert "child locations" in error_data["detail"]["message"].lower()
    
    async def test_delete_location_with_children_with_force(self, client: AsyncClient):
        """Test deleting location with children using force flag succeeds."""
        # Create parent location
        parent_data = {
            "location_code": "PARENT-FORCE",
            "location_name": "Parent Force Delete",
            "location_type": "WAREHOUSE"
        }
        parent_response = await client.post("/api/v1/locations/", json=parent_data)
        assert parent_response.status_code == status.HTTP_201_CREATED
        parent_location = parent_response.json()
        
        # Create child location
        child_data = {
            "location_code": "CHILD-FORCE",
            "location_name": "Child Force Delete",
            "location_type": "STORE",
            "parent_location_id": parent_location["id"]
        }
        child_response = await client.post("/api/v1/locations/", json=child_data)
        assert child_response.status_code == status.HTTP_201_CREATED
        child_location = child_response.json()
        
        # Delete parent with force
        response = await client.delete(f"/api/v1/locations/{parent_location['id']}?force=true")
        
        assert response.status_code == status.HTTP_200_OK
        
        # Verify both parent and child are deleted
        parent_get = await client.get(f"/api/v1/locations/{parent_location['id']}")
        child_get = await client.get(f"/api/v1/locations/{child_location['id']}")
        
        assert parent_get.status_code == status.HTTP_404_NOT_FOUND
        assert child_get.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.integration
@pytest.mark.asyncio
class TestLocationAPISearch:
    """Test Location search API endpoints."""
    
    @pytest.fixture
    async def search_test_locations(self, client: AsyncClient):
        """Create test locations for search operations."""
        locations_data = [
            {
                "location_code": "SEARCH-NYC",
                "location_name": "New York Store",
                "location_type": "STORE",
                "city": "New York",
                "state": "NY",
                "country": "USA"
            },
            {
                "location_code": "SEARCH-LA",
                "location_name": "Los Angeles Warehouse",
                "location_type": "WAREHOUSE",
                "city": "Los Angeles",
                "state": "CA",
                "country": "USA"
            },
            {
                "location_code": "SEARCH-UK",
                "location_name": "London Office",
                "location_type": "OFFICE",
                "city": "London",
                "state": "England",
                "country": "UK"
            }
        ]
        
        created_locations = []
        for data in locations_data:
            response = await client.post("/api/v1/locations/", json=data)
            assert response.status_code == status.HTTP_201_CREATED
            created_locations.append(response.json())
        
        return created_locations
    
    async def test_list_locations_basic(self, client: AsyncClient, search_test_locations):
        """Test basic location listing."""
        response = await client.get("/api/v1/locations/")
        
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        assert "locations" in response_data
        assert "pagination" in response_data
        
        locations = response_data["locations"]
        assert len(locations) >= 3
        
        # Verify pagination metadata
        pagination = response_data["pagination"]
        assert "page" in pagination
        assert "page_size" in pagination
        assert "total_items" in pagination
        assert "total_pages" in pagination
        assert "has_next" in pagination
        assert "has_previous" in pagination
    
    async def test_list_locations_with_filters(self, client: AsyncClient, search_test_locations):
        """Test location listing with query filters."""
        # Filter by location type
        response = await client.get("/api/v1/locations/?location_type=STORE")
        
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        locations = response_data["locations"]
        
        # All returned locations should be stores
        store_locations = [loc for loc in locations if loc["location_type"] == "STORE"]
        assert len(store_locations) >= 1
        
        location_names = [loc["location_name"] for loc in store_locations]
        assert "New York Store" in location_names
    
    async def test_list_locations_with_city_filter(self, client: AsyncClient, search_test_locations):
        """Test location listing filtered by city."""
        response = await client.get("/api/v1/locations/?city=London")
        
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        locations = response_data["locations"]
        
        london_locations = [loc for loc in locations if loc["city"] == "London"]
        assert len(london_locations) >= 1
        assert "London Office" in [loc["location_name"] for loc in london_locations]
    
    async def test_list_locations_with_pagination(self, client: AsyncClient, search_test_locations):
        """Test location listing with pagination."""
        # Get first page
        response_page1 = await client.get("/api/v1/locations/?page=1&page_size=2")
        assert response_page1.status_code == status.HTTP_200_OK
        
        page1_data = response_page1.json()
        assert len(page1_data["locations"]) <= 2
        
        # Get second page
        response_page2 = await client.get("/api/v1/locations/?page=2&page_size=2")
        assert response_page2.status_code == status.HTTP_200_OK
        
        page2_data = response_page2.json()
        
        # Verify different locations in each page
        page1_ids = [loc["id"] for loc in page1_data["locations"]]
        page2_ids = [loc["id"] for loc in page2_data["locations"]]
        assert len(set(page1_ids) & set(page2_ids)) == 0  # No overlap
    
    async def test_search_locations_advanced(self, client: AsyncClient, search_test_locations):
        """Test advanced search functionality."""
        search_data = {
            "search_term": "New York",
            "location_type": "STORE",
            "country": "USA",
            "is_active": True,
            "skip": 0,
            "limit": 10,
            "sort_by": "location_name",
            "sort_order": "asc"
        }
        
        response = await client.post("/api/v1/locations/search", json=search_data)
        
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        locations = response_data["locations"]
        
        # Should find the New York store
        location_names = [loc["location_name"] for loc in locations]
        assert "New York Store" in location_names
        
        # Verify all results match criteria
        for location in locations:
            if location["location_name"] == "New York Store":
                assert location["location_type"] == "STORE"
                assert location["country"] == "USA"
                assert location["is_active"] is True
    
    async def test_search_locations_no_results(self, client: AsyncClient):
        """Test search with no matching results."""
        search_data = {
            "search_term": "NonExistentLocation",
            "limit": 10
        }
        
        response = await client.post("/api/v1/locations/search", json=search_data)
        
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        assert len(response_data["locations"]) == 0
        assert response_data["pagination"]["total_items"] == 0


@pytest.mark.integration
@pytest.mark.asyncio
class TestLocationAPIGeospatial:
    """Test Location geospatial API endpoints."""
    
    @pytest.fixture
    async def geospatial_test_locations(self, client: AsyncClient):
        """Create test locations with coordinates."""
        locations_data = [
            {
                "location_code": "GEO-NYC",
                "location_name": "New York Store",
                "location_type": "STORE",
                "latitude": "40.7128",
                "longitude": "-74.0060"
            },
            {
                "location_code": "GEO-BOS",
                "location_name": "Boston Store",
                "location_type": "STORE",
                "latitude": "42.3601",
                "longitude": "-71.0589"
            },
            {
                "location_code": "GEO-LA",
                "location_name": "Los Angeles Store",
                "location_type": "STORE",
                "latitude": "34.0522",
                "longitude": "-118.2437"
            }
        ]
        
        created_locations = []
        for data in locations_data:
            response = await client.post("/api/v1/locations/", json=data)
            assert response.status_code == status.HTTP_201_CREATED
            created_locations.append(response.json())
        
        return created_locations
    
    async def test_find_nearby_locations(self, client: AsyncClient, geospatial_test_locations):
        """Test finding nearby locations."""
        nearby_params = {
            "latitude": "40.7128",  # NYC coordinates
            "longitude": "-74.0060",
            "radius_km": 500.0,
            "limit": 10
        }
        
        response = await client.post("/api/v1/locations/nearby", json=nearby_params)
        
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        assert isinstance(response_data, list)
        assert len(response_data) >= 2  # Should find NYC and Boston
        
        # Verify response structure
        for result in response_data:
            assert "location" in result
            assert "distance_km" in result
            assert isinstance(result["distance_km"], (int, float))
        
        # Check that NYC is found with very small distance
        location_results = [(r["location"]["location_name"], r["distance_km"]) for r in response_data]
        nyc_results = [r for r in location_results if "New York" in r[0]]
        assert len(nyc_results) >= 1
        
        # NYC should be very close to itself
        nyc_distance = nyc_results[0][1]
        assert nyc_distance < 1.0  # Less than 1km
    
    async def test_find_nearby_locations_small_radius(self, client: AsyncClient, geospatial_test_locations):
        """Test finding nearby locations with small radius."""
        nearby_params = {
            "latitude": "40.7128",
            "longitude": "-74.0060", 
            "radius_km": 1.0,  # Very small radius
            "limit": 10
        }
        
        response = await client.post("/api/v1/locations/nearby", json=nearby_params)
        
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        
        # Should only find NYC store
        location_names = [r["location"]["location_name"] for r in response_data]
        assert "New York Store" in location_names
        assert "Boston Store" not in location_names  # Too far
        assert "Los Angeles Store" not in location_names  # Too far
    
    async def test_find_nearby_locations_with_type_filter(self, client: AsyncClient, geospatial_test_locations):
        """Test finding nearby locations filtered by type."""
        nearby_params = {
            "latitude": "40.7128",
            "longitude": "-74.0060",
            "radius_km": 500.0,
            "location_type": "STORE",
            "limit": 10
        }
        
        response = await client.post("/api/v1/locations/nearby", json=nearby_params)
        
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        
        # All results should be stores
        for result in response_data:
            assert result["location"]["location_type"] == "STORE"
    
    async def test_find_nearby_locations_invalid_coordinates(self, client: AsyncClient):
        """Test finding nearby locations with invalid coordinates."""
        nearby_params = {
            "latitude": "91.0",  # Invalid latitude
            "longitude": "-74.0060",
            "radius_km": 10.0
        }
        
        response = await client.post("/api/v1/locations/nearby", json=nearby_params)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    async def test_validate_coordinates_endpoint(self, client: AsyncClient):
        """Test coordinate validation utility endpoint."""
        # Valid coordinates
        response = await client.post("/api/v1/locations/validate/coordinates?latitude=40.7128&longitude=-74.0060")
        
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        assert response_data["valid"] is True
        assert response_data["latitude"] == 40.7128
        assert response_data["longitude"] == -74.0060
        
        # Invalid coordinates should be caught by FastAPI validation
        invalid_response = await client.post("/api/v1/locations/validate/coordinates?latitude=91.0&longitude=-74.0060")
        assert invalid_response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.integration
@pytest.mark.asyncio
class TestLocationAPIBulkOperations:
    """Test Location bulk operations API endpoints."""
    
    async def test_bulk_create_locations(self, client: AsyncClient):
        """Test bulk creating multiple locations."""
        bulk_data = {
            "locations": [
                {
                    "location_code": f"BULK-{i:03d}",
                    "location_name": f"Bulk Location {i}",
                    "location_type": "STORE"
                } for i in range(1, 6)  # 5 locations
            ],
            "skip_duplicates": True
        }
        
        response = await client.post("/api/v1/locations/bulk", json=bulk_data)
        
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        assert len(response_data) == 5
        
        # Verify all locations were created correctly
        for i, location in enumerate(response_data):
            expected_code = f"BULK-{i+1:03d}"
            expected_name = f"Bulk Location {i+1}"
            
            assert location["location_code"] == expected_code
            assert location["location_name"] == expected_name
            assert location["location_type"] == "STORE"
    
    async def test_bulk_create_locations_with_duplicates(self, client: AsyncClient):
        """Test bulk create with duplicate handling."""
        # Create one location first
        existing_data = {
            "location_code": "BULK-EXIST",
            "location_name": "Existing Location",
            "location_type": "STORE"
        }
        response = await client.post("/api/v1/locations/", json=existing_data)
        assert response.status_code == status.HTTP_201_CREATED
        
        # Try to bulk create including the duplicate
        bulk_data = {
            "locations": [
                {
                    "location_code": "BULK-EXIST",  # Duplicate
                    "location_name": "Should Be Skipped",
                    "location_type": "WAREHOUSE"
                },
                {
                    "location_code": "BULK-NEW",  # New
                    "location_name": "Should Be Created",
                    "location_type": "STORE"
                }
            ],
            "skip_duplicates": True
        }
        
        response = await client.post("/api/v1/locations/bulk", json=bulk_data)
        
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        # Should only create the non-duplicate location
        assert len(response_data) == 1
        assert response_data[0]["location_code"] == "BULK-NEW"
    
    async def test_bulk_create_locations_validation_error(self, client: AsyncClient):
        """Test bulk create with validation errors."""
        bulk_data = {
            "locations": [
                {
                    "location_code": "BULK-VALID",
                    "location_name": "Valid Location",
                    "location_type": "STORE"
                },
                {
                    # Missing required fields
                    "location_name": "Invalid Location"
                    # Missing location_code and location_type
                }
            ]
        }
        
        response = await client.post("/api/v1/locations/bulk", json=bulk_data)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    async def test_bulk_create_empty_list(self, client: AsyncClient):
        """Test bulk create with empty location list."""
        bulk_data = {
            "locations": []
        }
        
        response = await client.post("/api/v1/locations/bulk", json=bulk_data)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.integration
@pytest.mark.asyncio
class TestLocationAPIStatistics:
    """Test Location statistics API endpoints."""
    
    @pytest.fixture
    async def statistics_test_locations(self, client: AsyncClient):
        """Create test locations for statistics."""
        locations_data = [
            {
                "location_code": "STATS-STORE-001",
                "location_name": "Store 1",
                "location_type": "STORE",
                "country": "USA",
                "capacity": 100,
                "latitude": "40.7128",
                "longitude": "-74.0060",
                "is_default": True
            },
            {
                "location_code": "STATS-STORE-002",
                "location_name": "Store 2",
                "location_type": "STORE",
                "country": "USA",
                "capacity": 150
            },
            {
                "location_code": "STATS-WAREHOUSE-001",
                "location_name": "Warehouse 1",
                "location_type": "WAREHOUSE",
                "country": "Canada",
                "capacity": 500,
                "latitude": "43.6532",
                "longitude": "-79.3832"
            }
        ]
        
        created_locations = []
        for data in locations_data:
            response = await client.post("/api/v1/locations/", json=data)
            assert response.status_code == status.HTTP_201_CREATED
            created_locations.append(response.json())
        
        return created_locations
    
    async def test_get_location_statistics(self, client: AsyncClient, statistics_test_locations):
        """Test getting location statistics."""
        response = await client.get("/api/v1/locations/analytics/statistics")
        
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        
        # Verify required fields are present
        assert "total_locations" in response_data
        assert "active_locations" in response_data
        assert "locations_by_type" in response_data
        assert "locations_by_country" in response_data
        assert "locations_by_state" in response_data
        assert "default_location_id" in response_data
        assert "total_capacity" in response_data
        assert "average_capacity" in response_data
        assert "locations_with_coordinates" in response_data
        
        # Verify statistics make sense
        assert response_data["total_locations"] >= 3
        assert response_data["active_locations"] >= 3
        
        # Check type breakdown
        locations_by_type = response_data["locations_by_type"]
        assert locations_by_type.get("STORE", 0) >= 2
        assert locations_by_type.get("WAREHOUSE", 0) >= 1
        
        # Check country breakdown
        locations_by_country = response_data["locations_by_country"]
        assert locations_by_country.get("USA", 0) >= 2
        assert locations_by_country.get("Canada", 0) >= 1
        
        # Check default location is set
        assert response_data["default_location_id"] is not None
        
        # Check capacity stats
        assert response_data["total_capacity"] >= 750  # 100 + 150 + 500
        assert response_data["average_capacity"] > 0
        
        # Check locations with coordinates
        assert response_data["locations_with_coordinates"] >= 2
    
    async def test_get_location_types(self, client: AsyncClient):
        """Test getting available location types."""
        response = await client.get("/api/v1/locations/types")
        
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        assert isinstance(response_data, list)
        
        expected_types = ["STORE", "WAREHOUSE", "SERVICE_CENTER", "DISTRIBUTION_CENTER", "OFFICE"]
        for expected_type in expected_types:
            assert expected_type in response_data


@pytest.mark.integration
@pytest.mark.asyncio
class TestLocationAPIHierarchical:
    """Test Location hierarchical API endpoints."""
    
    @pytest.fixture
    async def hierarchical_test_locations(self, client: AsyncClient):
        """Create hierarchical test locations."""
        # Create parent location
        parent_data = {
            "location_code": "HIER-PARENT",
            "location_name": "Parent Location",
            "location_type": "WAREHOUSE"
        }
        parent_response = await client.post("/api/v1/locations/", json=parent_data)
        assert parent_response.status_code == status.HTTP_201_CREATED
        parent = parent_response.json()
        
        # Create child locations
        child_data = [
            {
                "location_code": "HIER-CHILD-001",
                "location_name": "Child Location 1",
                "location_type": "STORE",
                "parent_location_id": parent["id"]
            },
            {
                "location_code": "HIER-CHILD-002",
                "location_name": "Child Location 2",
                "location_type": "STORE",
                "parent_location_id": parent["id"]
            }
        ]
        
        children = []
        for data in child_data:
            response = await client.post("/api/v1/locations/", json=data)
            assert response.status_code == status.HTTP_201_CREATED
            children.append(response.json())
        
        return {"parent": parent, "children": children}
    
    async def test_get_location_hierarchy(self, client: AsyncClient, hierarchical_test_locations):
        """Test getting location with hierarchy."""
        parent_id = hierarchical_test_locations["parent"]["id"]
        
        response = await client.get(f"/api/v1/locations/{parent_id}/hierarchy")
        
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        
        # Should include parent location details
        assert response_data["location_code"] == "HIER-PARENT"
        assert response_data["location_name"] == "Parent Location"
        
        # Should include child locations
        assert "child_locations" in response_data
        child_locations = response_data["child_locations"]
        assert len(child_locations) == 2
        
        child_codes = [child["location_code"] for child in child_locations]
        assert "HIER-CHILD-001" in child_codes
        assert "HIER-CHILD-002" in child_codes
    
    async def test_get_location_hierarchy_without_children(self, client: AsyncClient, hierarchical_test_locations):
        """Test getting location hierarchy without children."""
        parent_id = hierarchical_test_locations["parent"]["id"]
        
        response = await client.get(f"/api/v1/locations/{parent_id}/hierarchy?include_children=false")
        
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        
        # Should include parent location details
        assert response_data["location_code"] == "HIER-PARENT"
        
        # Should have empty child_locations list
        assert response_data.get("child_locations", []) == []
    
    async def test_get_location_path(self, client: AsyncClient, hierarchical_test_locations):
        """Test getting location path from root to location."""
        child_id = hierarchical_test_locations["children"][0]["id"]
        
        response = await client.get(f"/api/v1/locations/{child_id}/path")
        
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        assert isinstance(response_data, list)
        
        # Should contain path from root to child
        # In this case: [parent, child]
        assert len(response_data) == 2
        
        # First should be parent, last should be child
        assert response_data[0]["location_code"] == "HIER-PARENT"
        assert response_data[1]["location_code"] == "HIER-CHILD-001"
    
    async def test_get_location_hierarchy_not_found(self, client: AsyncClient):
        """Test getting hierarchy for non-existent location."""
        non_existent_id = str(uuid4())
        
        response = await client.get(f"/api/v1/locations/{non_existent_id}/hierarchy")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.integration
@pytest.mark.asyncio
class TestLocationAPICapacity:
    """Test Location capacity update API endpoints."""
    
    @pytest.fixture
    async def capacity_test_location(self, client: AsyncClient):
        """Create a location for capacity testing."""
        location_data = {
            "location_code": "CAPACITY-001",
            "location_name": "Capacity Test Location",
            "location_type": "WAREHOUSE",
            "capacity": 100
        }
        
        response = await client.post("/api/v1/locations/", json=location_data)
        assert response.status_code == status.HTTP_201_CREATED
        return response.json()
    
    async def test_update_location_capacity(self, client: AsyncClient, capacity_test_location):
        """Test updating location capacity."""
        location_id = capacity_test_location["id"]
        
        capacity_update = {
            "capacity": 250,
            "notes": "Expanded warehouse capacity"
        }
        
        response = await client.patch(f"/api/v1/locations/{location_id}/capacity", json=capacity_update)
        
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        assert response_data["capacity"] == 250
        
        # Verify notes were added to metadata
        if "metadata" in response_data and response_data["metadata"]:
            assert response_data["metadata"].get("capacity_notes") == "Expanded warehouse capacity"
    
    async def test_update_location_capacity_not_found(self, client: AsyncClient):
        """Test updating capacity for non-existent location."""
        non_existent_id = str(uuid4())
        
        capacity_update = {
            "capacity": 200
        }
        
        response = await client.patch(f"/api/v1/locations/{non_existent_id}/capacity", json=capacity_update)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    async def test_update_location_capacity_invalid_value(self, client: AsyncClient, capacity_test_location):
        """Test updating location capacity with invalid value."""
        location_id = capacity_test_location["id"]
        
        capacity_update = {
            "capacity": -50  # Negative capacity
        }
        
        response = await client.patch(f"/api/v1/locations/{location_id}/capacity", json=capacity_update)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY