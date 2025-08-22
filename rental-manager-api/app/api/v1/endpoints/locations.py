"""
Location API endpoints with comprehensive validation and error handling.

This module provides RESTful endpoints for location management with:
- Full CRUD operations
- Advanced search and filtering
- Geospatial queries
- Hierarchical operations
- Bulk operations
- Statistics and analytics
- Rate limiting and caching
"""

from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import get_redis, RedisManager
from app.services.location import LocationService
from app.schemas.location import (
    LocationCreate, LocationUpdate, LocationResponse, LocationSearch,
    LocationNearby, LocationCapacityUpdate, LocationStatistics,
    LocationBulkCreate, LocationBulkUpdate, LocationWithChildren,
    LocationTypeEnum
)
from app.core.errors import (
    NotFoundError, ConflictError, ValidationError,
    BusinessRuleError, DatabaseError
)
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(tags=["locations"])


# Dependency to get location service
async def get_location_service(
    db: AsyncSession = Depends(get_db),
    redis: RedisManager = Depends(get_redis)
) -> LocationService:
    """Get location service with database and Redis dependencies."""
    return LocationService(db, redis)


# ==================== Core CRUD Operations ====================

@router.post("/", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
async def create_location(
    location_data: LocationCreate,
    service: LocationService = Depends(get_location_service),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Create a new location.
    
    - **location_code**: Unique location code (uppercase alphanumeric with hyphens/underscores)
    - **location_name**: Location name
    - **location_type**: Type of location (STORE, WAREHOUSE, SERVICE_CENTER, DISTRIBUTION_CENTER, OFFICE)
    - **address**: Street address (optional)
    - **city**: City (optional)
    - **state**: State/Province (optional)
    - **country**: Country (optional)
    - **postal_code**: Postal/ZIP code (optional)
    - **contact_number**: Phone number (optional)
    - **email**: Email address (optional)
    - **website**: Website URL (optional)
    - **latitude**: Latitude coordinate (optional, must be provided with longitude)
    - **longitude**: Longitude coordinate (optional, must be provided with latitude)
    - **timezone**: Timezone identifier (default: UTC)
    - **operating_hours**: Operating hours in JSON format (optional)
    - **capacity**: Storage/operational capacity (optional)
    - **is_default**: Set as default location (default: false)
    - **parent_location_id**: Parent location ID for hierarchy (optional)
    - **manager_user_id**: Manager user ID (optional)
    - **metadata**: Additional metadata in JSON format (optional)
    """
    try:
        user_id = current_user.id if current_user else None
        return await service.create_location(location_data, created_by=user_id)
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": str(e), "error_code": e.error_code, "details": e.details}
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": str(e), "error_code": e.error_code, "field": e.field}
        )
    except BusinessRuleError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": str(e), "error_code": e.error_code, "context": e.context}
        )
    except DatabaseError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": "Database error occurred", "error_code": e.error_code}
        )


@router.get("/{location_id}", response_model=LocationResponse)
async def get_location(
    location_id: UUID,
    use_cache: bool = Query(True, description="Whether to use cache"),
    service: LocationService = Depends(get_location_service)
):
    """
    Get a location by ID.
    
    - **location_id**: UUID of the location to retrieve
    - **use_cache**: Whether to use Redis cache for faster response
    """
    try:
        return await service.get_location(location_id, use_cache=use_cache)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": str(e), "error_code": e.error_code, "details": e.details}
        )


@router.get("/code/{location_code}", response_model=LocationResponse)
async def get_location_by_code(
    location_code: str,
    use_cache: bool = Query(True, description="Whether to use cache"),
    service: LocationService = Depends(get_location_service)
):
    """
    Get a location by its unique code.
    
    - **location_code**: Unique location code
    - **use_cache**: Whether to use Redis cache for faster response
    """
    try:
        return await service.get_location_by_code(location_code, use_cache=use_cache)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": str(e), "error_code": e.error_code}
        )


@router.put("/{location_id}", response_model=LocationResponse)
async def update_location(
    location_id: UUID,
    location_data: LocationUpdate,
    service: LocationService = Depends(get_location_service),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Update a location.
    
    - **location_id**: UUID of the location to update
    - Only provided fields will be updated (partial update)
    - Coordinates must be provided together (latitude and longitude)
    """
    try:
        user_id = current_user.id if current_user else None
        return await service.update_location(location_id, location_data, updated_by=user_id)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": str(e), "error_code": e.error_code, "details": e.details}
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": str(e), "error_code": e.error_code, "field": e.field}
        )
    except BusinessRuleError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": str(e), "error_code": e.error_code, "context": e.context}
        )
    except DatabaseError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": "Database error occurred", "error_code": e.error_code}
        )


@router.delete("/{location_id}")
async def delete_location(
    location_id: UUID,
    force: bool = Query(False, description="Force delete even with children (cascade)"),
    service: LocationService = Depends(get_location_service),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Soft delete a location.
    
    - **location_id**: UUID of the location to delete
    - **force**: If true, will cascade delete child locations
    - Default location cannot be deleted
    - Locations with children cannot be deleted unless force=true
    """
    try:
        user_id = current_user.id if current_user else None
        success = await service.delete_location(location_id, deleted_by=user_id, force=force)
        
        if success:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={"message": "Location deleted successfully", "location_id": str(location_id)}
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"message": "Failed to delete location"}
            )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": str(e), "error_code": e.error_code, "details": e.details}
        )
    except BusinessRuleError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": str(e), "error_code": e.error_code, "context": e.context}
        )


# ==================== Search and Query Operations ====================

@router.post("/search", response_model=Dict[str, Any])
async def search_locations(
    search_params: LocationSearch,
    use_cache: bool = Query(True, description="Whether to use cache"),
    service: LocationService = Depends(get_location_service)
):
    """
    Search locations with advanced filtering and pagination.
    
    Returns paginated results with metadata:
    ```json
    {
        "locations": [...],
        "pagination": {
            "page": 1,
            "page_size": 20,
            "total_items": 100,
            "total_pages": 5,
            "has_next": true,
            "has_previous": false
        }
    }
    ```
    
    **Search Parameters:**
    - **search_term**: Search in name, code, address, city, state, country (min 2 chars)
    - **location_type**: Filter by location type
    - **city**: Filter by city (partial match)
    - **state**: Filter by state (partial match)
    - **country**: Filter by country (partial match)
    - **is_active**: Filter by active status (default: true)
    - **is_default**: Filter by default status
    - **has_coordinates**: Filter by coordinate availability
    - **parent_location_id**: Filter by parent location
    - **skip**: Number of records to skip (pagination)
    - **limit**: Maximum records to return (1-1000)
    - **sort_by**: Field to sort by
    - **sort_order**: Sort order (asc/desc)
    """
    try:
        locations, total = await service.search_locations(search_params, use_cache=use_cache)
        
        # Calculate pagination metadata
        page = (search_params.skip // search_params.limit) + 1
        total_pages = (total + search_params.limit - 1) // search_params.limit
        
        return {
            "locations": [loc.model_dump() for loc in locations],
            "pagination": {
                "page": page,
                "page_size": search_params.limit,
                "total_items": total,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_previous": page > 1
            }
        }
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": str(e), "error_code": e.error_code, "field": e.field}
        )


@router.get("/", response_model=Dict[str, Any])
async def list_locations(
    # Pagination
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    
    # Filters
    search_term: Optional[str] = Query(None, min_length=2, description="Search term"),
    location_type: Optional[LocationTypeEnum] = Query(None, description="Filter by location type"),
    city: Optional[str] = Query(None, description="Filter by city"),
    state: Optional[str] = Query(None, description="Filter by state"),
    country: Optional[str] = Query(None, description="Filter by country"),
    is_active: Optional[bool] = Query(True, description="Filter by active status"),
    is_default: Optional[bool] = Query(None, description="Filter by default status"),
    has_coordinates: Optional[bool] = Query(None, description="Filter by coordinate availability"),
    parent_location_id: Optional[UUID] = Query(None, description="Filter by parent location"),
    
    # Sorting
    sort_by: str = Query("location_name", description="Field to sort by"),
    sort_order: str = Query("asc", regex="^(asc|desc)$", description="Sort order"),
    
    # Caching
    use_cache: bool = Query(True, description="Whether to use cache"),
    
    service: LocationService = Depends(get_location_service)
):
    """
    List locations with filtering, pagination, and sorting.
    
    This is a simplified endpoint for common list operations.
    For advanced search, use the /search endpoint.
    """
    # Convert to search params
    search_params = LocationSearch(
        search_term=search_term,
        location_type=location_type,
        city=city,
        state=state,
        country=country,
        is_active=is_active,
        is_default=is_default,
        has_coordinates=has_coordinates,
        parent_location_id=parent_location_id,
        skip=(page - 1) * page_size,
        limit=page_size,
        sort_by=sort_by,
        sort_order=sort_order
    )
    
    return await search_locations(search_params, use_cache, service)


# ==================== Geospatial Operations ====================

@router.post("/nearby", response_model=List[Dict[str, Any]])
async def find_nearby_locations(
    nearby_params: LocationNearby,
    request: Request,
    service: LocationService = Depends(get_location_service),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Find locations within a specified radius using geospatial queries.
    
    **Parameters:**
    - **latitude**: Reference latitude (-90 to 90)
    - **longitude**: Reference longitude (-180 to 180)
    - **radius_km**: Search radius in kilometers (max 1000km)
    - **location_type**: Filter by location type (optional)
    - **limit**: Maximum results to return (1-100, default: 10)
    
    **Returns:**
    Array of locations with distance information:
    ```json
    [
        {
            "location": {...},
            "distance_km": 2.5
        }
    ]
    ```
    
    **Rate Limiting:**
    - 100 requests per minute per user
    - Uses IP address if user not authenticated
    """
    try:
        # Use user ID for rate limiting, fallback to IP
        requester_id = None
        if current_user:
            requester_id = current_user.id
        elif hasattr(request, 'client') and request.client:
            requester_id = request.client.host
        
        nearby_results = await service.find_nearby_locations(nearby_params, requester_id)
        
        return [
            {
                "location": location.model_dump(),
                "distance_km": round(distance, 2)
            }
            for location, distance in nearby_results
        ]
        
    except BusinessRuleError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"message": str(e), "error_code": e.error_code, "context": e.context}
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": str(e), "error_code": e.error_code, "field": e.field}
        )
    except DatabaseError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": "Geospatial query failed", "error_code": e.error_code}
        )


# ==================== Hierarchical Operations ====================

@router.get("/{location_id}/hierarchy", response_model=LocationWithChildren)
async def get_location_hierarchy(
    location_id: UUID,
    include_children: bool = Query(True, description="Include child locations"),
    service: LocationService = Depends(get_location_service)
):
    """
    Get location with its hierarchical structure (parent and children).
    
    - **location_id**: UUID of the location
    - **include_children**: Whether to include child locations in response
    """
    try:
        return await service.get_location_hierarchy(location_id, include_children)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": str(e), "error_code": e.error_code, "details": e.details}
        )


@router.get("/{location_id}/path", response_model=List[LocationResponse])
async def get_location_path(
    location_id: UUID,
    service: LocationService = Depends(get_location_service)
):
    """
    Get the full hierarchy path from root to the specified location.
    
    Returns an ordered list from root to the specified location.
    """
    try:
        return await service.get_location_path(location_id)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": str(e), "error_code": e.error_code, "details": e.details}
        )


# ==================== Bulk Operations ====================

@router.post("/bulk", response_model=List[LocationResponse])
async def bulk_create_locations(
    bulk_data: LocationBulkCreate,
    request: Request,
    service: LocationService = Depends(get_location_service),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Bulk create multiple locations.
    
    **Parameters:**
    - **locations**: Array of location creation data (1-1000 items)
    - **skip_duplicates**: Skip locations with duplicate codes (default: true)
    
    **Rate Limiting:**
    - 10 bulk operations per minute per user
    
    **Validation:**
    - All location codes must be unique within the batch
    - Each location follows the same validation rules as single creation
    """
    try:
        # Use user ID for rate limiting, fallback to IP
        requester_id = None
        if current_user:
            requester_id = current_user.id
        elif hasattr(request, 'client') and request.client:
            requester_id = request.client.host
        
        user_id = current_user.id if current_user else None
        
        return await service.bulk_create_locations(
            bulk_data,
            created_by=user_id,
            requester_id=requester_id
        )
        
    except BusinessRuleError as e:
        if e.rule_name == "bulk_operation_rate_limit":
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"message": str(e), "error_code": e.error_code, "context": e.context}
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"message": str(e), "error_code": e.error_code, "context": e.context}
            )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": str(e), "error_code": e.error_code, "field": e.field}
        )
    except DatabaseError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": "Bulk operation failed", "error_code": e.error_code}
        )


# ==================== Capacity Operations ====================

@router.patch("/{location_id}/capacity", response_model=LocationResponse)
async def update_location_capacity(
    location_id: UUID,
    capacity_data: LocationCapacityUpdate,
    service: LocationService = Depends(get_location_service),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Update location capacity with notes.
    
    - **location_id**: UUID of the location
    - **capacity**: New capacity value (must be >= 0)
    - **notes**: Optional notes about the capacity update
    """
    try:
        user_id = current_user.id if current_user else None
        # Use the CRUD method directly since service doesn't have this specific method
        location = await service.crud.update_capacity(location_id, capacity_data, user_id)
        
        if not location:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"message": f"Location with id {location_id} not found"}
            )
        
        # Invalidate cache
        await service._invalidate_location_cache(location_id)
        
        return LocationResponse.model_validate(location)
        
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": str(e), "error_code": e.error_code, "field": e.field}
        )


# ==================== Statistics and Analytics ====================

@router.get("/analytics/statistics", response_model=LocationStatistics)
async def get_location_statistics(
    use_cache: bool = Query(True, description="Whether to use cache"),
    service: LocationService = Depends(get_location_service)
):
    """
    Get comprehensive location statistics.
    
    **Returns:**
    - Total and active location counts
    - Breakdown by location type
    - Breakdown by country and state
    - Default location information
    - Capacity statistics
    - Locations with coordinates count
    """
    try:
        return await service.get_location_statistics(use_cache=use_cache)
    except DatabaseError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": "Failed to retrieve statistics", "error_code": e.error_code}
        )


# ==================== Utility Endpoints ====================

@router.get("/types", response_model=List[str])
async def get_location_types():
    """Get all available location types."""
    return [type_enum.value for type_enum in LocationTypeEnum]


@router.post("/validate/coordinates")
async def validate_coordinates(
    latitude: Decimal = Query(..., ge=-90, le=90, description="Latitude coordinate"),
    longitude: Decimal = Query(..., ge=-180, le=180, description="Longitude coordinate")
):
    """
    Validate if coordinates are within reasonable bounds.
    
    - **latitude**: Latitude coordinate (-90 to 90)
    - **longitude**: Longitude coordinate (-180 to 180)
    """
    return {
        "valid": True,
        "latitude": float(latitude),
        "longitude": float(longitude),
        "message": "Coordinates are valid"
    }