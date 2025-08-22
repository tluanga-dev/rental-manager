"""API endpoints for Unit of Measurement."""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_active_user
from app.models.user import User
from app.services.unit_of_measurement import unit_of_measurement_service
from app.schemas.unit_of_measurement import (
    UnitOfMeasurementCreate, UnitOfMeasurementUpdate, UnitOfMeasurementResponse,
    UnitOfMeasurementSummary, UnitOfMeasurementList, UnitOfMeasurementFilter,
    UnitOfMeasurementSort, UnitOfMeasurementStats, UnitOfMeasurementBulkOperation,
    UnitOfMeasurementBulkResult, UnitOfMeasurementExport, UnitOfMeasurementImport,
    UnitOfMeasurementImportResult
)
from app.core.errors import (
    NotFoundError, ConflictError, ValidationError, BusinessRuleError
)

router = APIRouter(prefix="/unit-of-measurement", tags=["Unit of Measurement"])


@router.post("/", response_model=UnitOfMeasurementResponse, status_code=status.HTTP_201_CREATED)
async def create_unit_of_measurement(
    unit_data: UnitOfMeasurementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new unit of measurement."""
    try:
        return await unit_of_measurement_service.create_unit(
            db,
            unit_data=unit_data,
            created_by=str(current_user.id)
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{unit_id}", response_model=UnitOfMeasurementResponse)
async def get_unit_of_measurement(
    unit_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a unit of measurement by ID."""
    try:
        return await unit_of_measurement_service.get_unit(db, unit_id=unit_id)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/", response_model=UnitOfMeasurementList)
async def list_units_of_measurement(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    name: Optional[str] = Query(None, description="Filter by name (partial match)"),
    code: Optional[str] = Query(None, description="Filter by code (partial match)"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    search: Optional[str] = Query(None, description="Search in name, code and description"),
    sort_field: str = Query("name", description="Field to sort by"),
    sort_direction: str = Query("asc", description="Sort direction (asc/desc)"),
    include_inactive: bool = Query(False, description="Include inactive units"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List units of measurement with pagination, filtering, and sorting."""
    # Create filter object
    filters = UnitOfMeasurementFilter(
        name=name,
        code=code,
        is_active=is_active,
        search=search
    )
    
    # Create sort object
    sort_options = UnitOfMeasurementSort(
        field=sort_field,
        direction=sort_direction
    )
    
    try:
        return await unit_of_measurement_service.list_units(
            db,
            page=page,
            page_size=page_size,
            filters=filters,
            sort=sort_options,
            include_inactive=include_inactive
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{unit_id}", response_model=UnitOfMeasurementResponse)
async def update_unit_of_measurement(
    unit_id: UUID,
    unit_data: UnitOfMeasurementUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update an existing unit of measurement."""
    try:
        return await unit_of_measurement_service.update_unit(
            db,
            unit_id=unit_id,
            unit_data=unit_data,
            updated_by=str(current_user.id)
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{unit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_unit_of_measurement(
    unit_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete (deactivate) a unit of measurement."""
    try:
        await unit_of_measurement_service.delete_unit(db, unit_id=unit_id)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except BusinessRuleError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/search/", response_model=List[UnitOfMeasurementSummary])
async def search_units_of_measurement(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(10, ge=1, le=50, description="Maximum results"),
    include_inactive: bool = Query(False, description="Include inactive units"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Search units of measurement by name, code, or description."""
    return await unit_of_measurement_service.search_units(
        db,
        search_term=q,
        limit=limit,
        include_inactive=include_inactive
    )


@router.get("/active/", response_model=List[UnitOfMeasurementSummary])
async def get_active_units_of_measurement(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all active units of measurement."""
    return await unit_of_measurement_service.get_active_units(db)


@router.get("/stats/", response_model=UnitOfMeasurementStats)
async def get_unit_of_measurement_statistics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get unit of measurement statistics."""
    return await unit_of_measurement_service.get_unit_statistics(db)


@router.post("/{unit_id}/activate", response_model=UnitOfMeasurementResponse)
async def activate_unit_of_measurement(
    unit_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Activate a unit of measurement."""
    try:
        return await unit_of_measurement_service.activate_unit(db, unit_id=unit_id)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{unit_id}/deactivate", response_model=UnitOfMeasurementResponse)
async def deactivate_unit_of_measurement(
    unit_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Deactivate a unit of measurement."""
    try:
        return await unit_of_measurement_service.deactivate_unit(db, unit_id=unit_id)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/bulk-operation", response_model=UnitOfMeasurementBulkResult)
async def bulk_unit_of_measurement_operation(
    operation: UnitOfMeasurementBulkOperation,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Perform bulk operations on units of measurement."""
    try:
        return await unit_of_measurement_service.bulk_operation(
            db,
            operation=operation,
            updated_by=str(current_user.id)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/export/", response_model=List[UnitOfMeasurementExport])
async def export_units_of_measurement(
    include_inactive: bool = Query(False, description="Include inactive units"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Export units of measurement data."""
    return await unit_of_measurement_service.export_units(
        db,
        include_inactive=include_inactive
    )


@router.post("/import/", response_model=UnitOfMeasurementImportResult)
async def import_units_of_measurement(
    units_data: List[UnitOfMeasurementImport],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Import units of measurement data."""
    try:
        return await unit_of_measurement_service.import_units(
            db,
            import_data=units_data,
            created_by=str(current_user.id)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )