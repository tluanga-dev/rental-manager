from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationError, ConflictError
from app.shared.dependencies import get_session
from app.modules.master_data.locations.service import LocationService
from app.modules.master_data.locations.schemas import (
    LocationCreate, LocationUpdate, LocationResponse
)
from app.modules.auth.dependencies import get_current_user
from app.modules.users.models import User


router = APIRouter(tags=["Master Data - Locations"])


# Dependency to get location service
async def get_location_service(session: AsyncSession = Depends(get_session)) -> LocationService:
    return LocationService(session)


# Location CRUD endpoints
@router.post("/", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
async def create_location(
    location_data: LocationCreate,
    service: LocationService = Depends(get_location_service)
    # Removed authentication requirement to match other master data endpoints
):
    """Create a new location (public endpoint for consistency with other master data)."""
    try:
        return await service.create_location(location_data)
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/", response_model=List[LocationResponse])
async def list_locations(
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    location_type: Optional[str] = Query(None, description="Filter by location type"),
    active_only: bool = Query(True, description="Show only active locations"),
    service: LocationService = Depends(get_location_service)
    # Removed authentication requirement to match other master data endpoints
):
    """List locations with optional filtering (public endpoint for consistency with other master data)."""
    return await service.list_locations(
        skip=skip,
        limit=limit,
        location_type=location_type,
        active_only=active_only
    )


@router.get("/search", response_model=List[LocationResponse])
async def search_locations(
    search_term: str = Query(..., min_length=2, description="Search term"),
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    active_only: bool = Query(True, description="Show only active locations"),
    service: LocationService = Depends(get_location_service)
    # Removed authentication requirement for search endpoint
):
    """Search locations by name, code, or address (public endpoint)."""
    return await service.search_locations(
        search_term=search_term,
        skip=skip,
        limit=limit,
        active_only=active_only
    )


# UNUSED BY FRONTEND - Commented out for security
# @router.get("/count")
# async def count_locations(
#     location_type: Optional[str] = Query(None, description="Filter by location type"),
#     active_only: bool = Query(True, description="Show only active locations"),
#     service: LocationService = Depends(get_location_service)
#     # Removed authentication requirement for count endpoint
# ):
#     """Count locations with optional filtering (public endpoint)."""
#     count = await service.count_locations(
#         location_type=location_type,
#         active_only=active_only
#     )
#     return {"count": count}


@router.get("/{location_id}", response_model=LocationResponse)
async def get_location(
    location_id: UUID,
    service: LocationService = Depends(get_location_service),
    current_user: User = Depends(get_current_user)
):
    """Get location by ID."""
    location = await service.get_location(location_id)
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")
    
    return location


# UNUSED BY FRONTEND - Commented out for security
# @router.get("/code/{location_code}", response_model=LocationResponse)
# async def get_location_by_code(
#     location_code: str,
#     service: LocationService = Depends(get_location_service),
#     current_user: User = Depends(get_current_user)
# ):
#     """Get location by code."""
#     location = await service.get_location_by_code(location_code)
#     if not location:
#         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")
#     
#     return location


@router.put("/{location_id}", response_model=LocationResponse)
async def update_location(
    location_id: UUID,
    update_data: LocationUpdate,
    service: LocationService = Depends(get_location_service),
    current_user: User = Depends(get_current_user)
):
    """Update location information."""
    try:
        return await service.update_location(location_id, update_data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(
    location_id: UUID,
    service: LocationService = Depends(get_location_service),
    current_user: User = Depends(get_current_user)
):
    """Delete location."""
    success = await service.delete_location(location_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")


# Location type specific endpoints
# UNUSED BY FRONTEND - Commented out for security
# @router.get("/type/{location_type}", response_model=List[LocationResponse])
# async def get_locations_by_type(
#     location_type: str,
#     skip: int = Query(0, ge=0, description="Records to skip"),
#     limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
#     active_only: bool = Query(True, description="Show only active locations"),
#     service: LocationService = Depends(get_location_service),
#     current_user: User = Depends(get_current_user)
# ):
#     """Get locations by type."""
#     return await service.list_locations(
#         skip=skip,
#         limit=limit,
#         location_type=location_type,
#         active_only=active_only
#     )


# Bulk operations endpoints
# UNUSED BY FRONTEND - Commented out for security
# @router.post("/bulk/activate", status_code=status.HTTP_204_NO_CONTENT)
# async def bulk_activate_locations(
#     location_ids: List[UUID],
#     service: LocationService = Depends(get_location_service),
#     current_user: User = Depends(get_current_user)
# ):
#     """Bulk activate locations."""
#     # TODO: Implement bulk activation
#     pass


# UNUSED BY FRONTEND - Commented out for security
# @router.post("/bulk/deactivate", status_code=status.HTTP_204_NO_CONTENT)
# async def bulk_deactivate_locations(
#     location_ids: List[UUID],
#     service: LocationService = Depends(get_location_service),
#     current_user: User = Depends(get_current_user)
# ):
#     """Bulk deactivate locations."""
#     # TODO: Implement bulk deactivation
#     pass


# Export endpoints
# UNUSED BY FRONTEND - Commented out for security
# @router.get("/export/csv")
# async def export_locations_csv(
#     location_type: Optional[str] = Query(None, description="Filter by location type"),
#     active_only: bool = Query(True, description="Show only active locations"),
#     service: LocationService = Depends(get_location_service),
#     current_user: User = Depends(get_current_user)
# ):
#     """Export locations to CSV."""
#     # TODO: Implement CSV export
#     return {"message": "CSV export not yet implemented"}


# UNUSED BY FRONTEND - Commented out for security
# @router.get("/export/xlsx")
# async def export_locations_xlsx(
#     location_type: Optional[str] = Query(None, description="Filter by location type"),
#     active_only: bool = Query(True, description="Show only active locations"),
#     service: LocationService = Depends(get_location_service),
#     current_user: User = Depends(get_current_user)
# ):
#     """Export locations to Excel."""
#     # TODO: Implement Excel export
#     return {"message": "Excel export not yet implemented"}
