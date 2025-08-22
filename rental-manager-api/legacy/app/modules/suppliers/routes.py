from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationError, ConflictError
from app.shared.dependencies import get_session
from app.modules.suppliers.service import SupplierService
from app.modules.suppliers.models import SupplierType, SupplierStatus
from app.modules.suppliers.schemas import (
    SupplierCreate, SupplierUpdate, SupplierResponse, SupplierStatusUpdate
)
from app.modules.auth.dependencies import get_current_user
from app.modules.users.models import User
from app.core.permissions_enhanced import SupplierPermissions


router = APIRouter(tags=["Supplier Management"])


# Dependency to get supplier service
async def get_supplier_service(session: AsyncSession = Depends(get_session)) -> SupplierService:
    return SupplierService(session)


# Supplier CRUD endpoints
@router.post("/", 
    response_model=SupplierResponse, 
    status_code=status.HTTP_201_CREATED,
    dependencies=[SupplierPermissions.CREATE])
async def create_supplier(
    supplier_data: SupplierCreate,
    service: SupplierService = Depends(get_supplier_service),
    current_user: User = Depends(get_current_user)
):
    """Create a new supplier. Requires SUPPLIER_CREATE permission."""
    try:
        return await service.create_supplier(supplier_data)
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/", 
    response_model=List[SupplierResponse],
    dependencies=[SupplierPermissions.VIEW])
async def list_suppliers(
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    supplier_type: Optional[SupplierType] = Query(None, description="Filter by supplier type"),
    supplier_status: Optional[SupplierStatus] = Query(None, description="Filter by status"),
    active_only: bool = Query(True, description="Show only active suppliers"),
    service: SupplierService = Depends(get_supplier_service),
    current_user: User = Depends(get_current_user)
):
    """List suppliers with optional filtering. Requires SUPPLIER_VIEW permission."""
    return await service.list_suppliers(
        skip=skip,
        limit=limit,
        supplier_type=supplier_type,
        status=supplier_status,
        active_only=active_only
    )


@router.get("/search", 
    response_model=List[SupplierResponse],
    dependencies=[SupplierPermissions.VIEW])
async def search_suppliers(
    search_term: str = Query(..., min_length=2, description="Search term"),
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    active_only: bool = Query(True, description="Show only active suppliers"),
    service: SupplierService = Depends(get_supplier_service),
    current_user: User = Depends(get_current_user)
):
    """Search suppliers by name, code, or email. Requires SUPPLIER_VIEW permission."""
    return await service.search_suppliers(
        search_term=search_term,
        skip=skip,
        limit=limit,
        active_only=active_only
    )


# UNUSED BY FRONTEND - Commented out for security
# @router.get("/count")
# async def count_suppliers(
#     supplier_type: Optional[SupplierType] = Query(None, description="Filter by supplier type"),
#     supplier_status: Optional[SupplierStatus] = Query(None, description="Filter by status"),
#     active_only: bool = Query(True, description="Show only active suppliers"),
#     service: SupplierService = Depends(get_supplier_service)
# ):
#     """Count suppliers with optional filtering."""
#     count = await service.count_suppliers(
#         supplier_type=supplier_type,
#         status=supplier_status,
#         active_only=active_only
#     )
#     return {"count": count}


# UNUSED BY FRONTEND - Commented out for security
# @router.get("/statistics")
# async def get_supplier_statistics(
#     service: SupplierService = Depends(get_supplier_service)
# ):
#     """Get supplier statistics."""
#     return await service.get_supplier_statistics()


@router.get("/{supplier_id}", 
    response_model=SupplierResponse,
    dependencies=[SupplierPermissions.VIEW])
async def get_supplier(
    supplier_id: UUID,
    service: SupplierService = Depends(get_supplier_service),
    current_user: User = Depends(get_current_user)
):
    """Get supplier by ID. Requires SUPPLIER_VIEW permission."""
    supplier = await service.get_supplier(supplier_id)
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    
    return supplier


# UNUSED BY FRONTEND - Commented out for security
# @router.get("/code/{supplier_code}", response_model=SupplierResponse)
# async def get_supplier_by_code(
#     supplier_code: str,
#     service: SupplierService = Depends(get_supplier_service)
# ):
#     """Get supplier by code."""
#     supplier = await service.get_supplier_by_code(supplier_code)
#     if not supplier:
#         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
#     
#     return supplier


@router.put("/{supplier_id}", 
    response_model=SupplierResponse,
    dependencies=[SupplierPermissions.UPDATE])
async def update_supplier(
    supplier_id: UUID,
    update_data: SupplierUpdate,
    service: SupplierService = Depends(get_supplier_service),
    current_user: User = Depends(get_current_user)
):
    """Update supplier information. Requires SUPPLIER_UPDATE permission."""
    try:
        return await service.update_supplier(supplier_id, update_data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{supplier_id}", 
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[SupplierPermissions.DELETE])
async def delete_supplier(
    supplier_id: UUID,
    service: SupplierService = Depends(get_supplier_service),
    current_user: User = Depends(get_current_user)
):
    """Delete supplier. Requires SUPPLIER_DELETE permission."""
    success = await service.delete_supplier(supplier_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")


# Supplier status management endpoints
@router.put("/{supplier_id}/status", 
    response_model=SupplierResponse,
    dependencies=[SupplierPermissions.UPDATE_STATUS])
async def update_supplier_status(
    supplier_id: UUID,
    status_update: SupplierStatusUpdate,
    service: SupplierService = Depends(get_supplier_service),
    current_user: User = Depends(get_current_user)
):
    """Update supplier status. Requires SUPPLIER_UPDATE_STATUS permission."""
    try:
        return await service.update_supplier_status(supplier_id, status_update)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# Supplier type specific endpoints
# UNUSED BY FRONTEND - Commented out for security
# @router.get("/type/{supplier_type}", response_model=List[SupplierResponse])
# async def get_suppliers_by_type(
#     supplier_type: SupplierType,
#     skip: int = Query(0, ge=0, description="Records to skip"),
#     limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
#     active_only: bool = Query(True, description="Show only active suppliers"),
#     service: SupplierService = Depends(get_supplier_service)
# ):
#     """Get suppliers by type."""
#     return await service.list_suppliers(
#         skip=skip,
#         limit=limit,
#         supplier_type=supplier_type,
#         active_only=active_only
#     )


# UNUSED BY FRONTEND - Commented out for security
# @router.get("/status/{status}", response_model=List[SupplierResponse])
# async def get_suppliers_by_status(
#     status: SupplierStatus,
#     skip: int = Query(0, ge=0, description="Records to skip"),
#     limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
#     active_only: bool = Query(True, description="Show only active suppliers"),
#     service: SupplierService = Depends(get_supplier_service)
# ):
#     """Get suppliers by status."""
#     return await service.list_suppliers(
#         skip=skip,
#         limit=limit,
#         status=supplier_status,
#         active_only=active_only
#     )


# Bulk operations endpoints
# UNUSED BY FRONTEND - Commented out for security
# @router.post("/bulk/activate", status_code=status.HTTP_204_NO_CONTENT)
# async def bulk_activate_suppliers(
#     supplier_ids: List[UUID],
#     service: SupplierService = Depends(get_supplier_service)
# ):
#     """Bulk activate suppliers."""
#     # TODO: Implement bulk activation
#     pass


# UNUSED BY FRONTEND - Commented out for security
# @router.post("/bulk/deactivate", status_code=status.HTTP_204_NO_CONTENT)
# async def bulk_deactivate_suppliers(
#     supplier_ids: List[UUID],
#     service: SupplierService = Depends(get_supplier_service)
# ):
#     """Bulk deactivate suppliers."""
#     # TODO: Implement bulk deactivation
#     pass


# Export endpoints
# UNUSED BY FRONTEND - Commented out for security
# @router.get("/export/csv")
# async def export_suppliers_csv(
#     supplier_type: Optional[SupplierType] = Query(None, description="Filter by supplier type"),
#     supplier_status: Optional[SupplierStatus] = Query(None, description="Filter by status"),
#     active_only: bool = Query(True, description="Show only active suppliers"),
#     service: SupplierService = Depends(get_supplier_service)
# ):
#     """Export suppliers to CSV."""
#     # TODO: Implement CSV export
#     return {"message": "CSV export not yet implemented"}


# UNUSED BY FRONTEND - Commented out for security
# @router.get("/export/xlsx")
# async def export_suppliers_xlsx(
#     supplier_type: Optional[SupplierType] = Query(None, description="Filter by supplier type"),
#     supplier_status: Optional[SupplierStatus] = Query(None, description="Filter by status"),
#     active_only: bool = Query(True, description="Show only active suppliers"),
#     service: SupplierService = Depends(get_supplier_service)
# ):
#     """Export suppliers to Excel."""
#     # TODO: Implement Excel export
#     return {"message": "Excel export not yet implemented"}
