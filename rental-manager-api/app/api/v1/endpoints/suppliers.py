from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationError, ConflictError
from app.api.deps import get_db, get_current_user
from app.services.supplier import SupplierService
from app.models.supplier import SupplierType, SupplierStatus
from app.schemas.supplier import (
    SupplierCreate, SupplierUpdate, SupplierResponse, SupplierStatusUpdate
)
from app.models.user import User


router = APIRouter(tags=["Supplier Management"])


# Dependency to get supplier service
async def get_supplier_service(session: AsyncSession = Depends(get_db)) -> SupplierService:
    return SupplierService(session)


# Supplier CRUD endpoints
@router.post("/", 
    response_model=SupplierResponse, 
    status_code=status.HTTP_201_CREATED)
async def create_supplier(
    supplier_data: SupplierCreate,
    service: SupplierService = Depends(get_supplier_service),
    current_user: User = Depends(get_current_user)
):
    """Create a new supplier."""
    try:
        return await service.create_supplier(supplier_data)
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/", 
    response_model=List[SupplierResponse])
async def list_suppliers(
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    supplier_type: Optional[SupplierType] = Query(None, description="Filter by supplier type"),
    supplier_status: Optional[SupplierStatus] = Query(None, description="Filter by status"),
    active_only: bool = Query(True, description="Show only active suppliers"),
    service: SupplierService = Depends(get_supplier_service),
    current_user: User = Depends(get_current_user)
):
    """List suppliers with optional filtering."""
    return await service.list_suppliers(
        skip=skip,
        limit=limit,
        supplier_type=supplier_type,
        status=supplier_status,
        active_only=active_only
    )


@router.get("/search", 
    response_model=List[SupplierResponse])
async def search_suppliers(
    search_term: str = Query(..., min_length=2, description="Search term"),
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    active_only: bool = Query(True, description="Show only active suppliers"),
    service: SupplierService = Depends(get_supplier_service),
    current_user: User = Depends(get_current_user)
):
    """Search suppliers by name, code, or email."""
    return await service.search_suppliers(
        search_term=search_term,
        skip=skip,
        limit=limit,
        active_only=active_only
    )


@router.get("/statistics")
async def get_supplier_statistics(
    service: SupplierService = Depends(get_supplier_service),
    current_user: User = Depends(get_current_user)
):
    """Get supplier statistics."""
    return await service.get_supplier_statistics()


@router.get("/{supplier_id}", 
    response_model=SupplierResponse)
async def get_supplier(
    supplier_id: UUID,
    service: SupplierService = Depends(get_supplier_service),
    current_user: User = Depends(get_current_user)
):
    """Get supplier by ID."""
    supplier = await service.get_supplier(supplier_id)
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    
    return supplier


@router.put("/{supplier_id}", 
    response_model=SupplierResponse)
async def update_supplier(
    supplier_id: UUID,
    update_data: SupplierUpdate,
    service: SupplierService = Depends(get_supplier_service),
    current_user: User = Depends(get_current_user)
):
    """Update supplier information."""
    try:
        return await service.update_supplier(supplier_id, update_data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{supplier_id}", 
    status_code=status.HTTP_204_NO_CONTENT)
async def delete_supplier(
    supplier_id: UUID,
    service: SupplierService = Depends(get_supplier_service),
    current_user: User = Depends(get_current_user)
):
    """Delete supplier."""
    success = await service.delete_supplier(supplier_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")


# Supplier status management endpoints
@router.put("/{supplier_id}/status", 
    response_model=SupplierResponse)
async def update_supplier_status(
    supplier_id: UUID,
    status_update: SupplierStatusUpdate,
    service: SupplierService = Depends(get_supplier_service),
    current_user: User = Depends(get_current_user)
):
    """Update supplier status."""
    try:
        return await service.update_supplier_status(supplier_id, status_update)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))