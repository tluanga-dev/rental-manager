from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationError, ConflictError
from app.shared.dependencies import get_session
from app.modules.customers.service import CustomerService
from app.modules.auth.dependencies import get_current_user
from app.modules.users.models import User
from app.modules.customers.models import CustomerType, CustomerStatus, BlacklistStatus, CreditRating
from app.modules.customers.schemas import (
    CustomerCreate, CustomerUpdate, CustomerResponse, CustomerStatusUpdate,
    CustomerBlacklistUpdate, CustomerCreditUpdate, CustomerSearchRequest,
    CustomerStatsResponse, CustomerAddressCreate, CustomerAddressResponse,
    CustomerContactCreate, CustomerContactResponse, CustomerDetailResponse
)
from app.core.permissions_enhanced import CustomerPermissions


router = APIRouter(tags=["Customer Management"])


# Dependency to get customer service
async def get_customer_service(session: AsyncSession = Depends(get_session)) -> CustomerService:
    return CustomerService(session)


# Customer CRUD endpoints
@router.post("/", 
    response_model=CustomerResponse, 
    status_code=status.HTTP_201_CREATED,
    dependencies=[CustomerPermissions.CREATE])
async def create_customer(
    customer_data: CustomerCreate,
    service: CustomerService = Depends(get_customer_service),
    current_user: User = Depends(get_current_user)
):
    """Create a new customer. Requires CUSTOMER_CREATE permission."""
    try:
        return await service.create_customer(customer_data)
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/", 
    response_model=List[CustomerResponse],
    dependencies=[CustomerPermissions.VIEW])
async def list_customers(
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    customer_type: Optional[CustomerType] = Query(None, description="Filter by customer type"),
    customer_status: Optional[CustomerStatus] = Query(None, description="Filter by status"),
    blacklist_status: Optional[BlacklistStatus] = Query(None, description="Filter by blacklist status"),
    active_only: bool = Query(True, description="Show only active customers"),
    service: CustomerService = Depends(get_customer_service),
    current_user: User = Depends(get_current_user)
):
    """List customers with optional filtering. Requires CUSTOMER_VIEW permission."""
    return await service.list_customers(
        skip=skip,
        limit=limit,
        customer_type=customer_type,
        status=customer_status,
        blacklist_status=blacklist_status,
        active_only=active_only
    )


@router.get("/search", 
    response_model=List[CustomerResponse],
    dependencies=[CustomerPermissions.VIEW])
async def search_customers(
    search_term: str = Query(..., min_length=2, description="Search term"),
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    active_only: bool = Query(True, description="Show only active customers"),
    service: CustomerService = Depends(get_customer_service),
    current_user: User = Depends(get_current_user)
):
    """Search customers by name, code, or email. Requires CUSTOMER_VIEW permission."""
    return await service.search_customers(
        search_term=search_term,
        skip=skip,
        limit=limit,
        active_only=active_only
    )


# UNUSED BY FRONTEND - Commented out for security
# @router.get("/count")
# async def count_customers(
#     customer_type: Optional[CustomerType] = Query(None, description="Filter by customer type"),
#     customer_status: Optional[CustomerStatus] = Query(None, description="Filter by status"),
#     blacklist_status: Optional[BlacklistStatus] = Query(None, description="Filter by blacklist status"),
#     active_only: bool = Query(True, description="Show only active customers"),
#     service: CustomerService = Depends(get_customer_service)
# ):
#     """Count customers with optional filtering."""
#     count = await service.count_customers(
#         customer_type=customer_type,
#         status=customer_status,
#         blacklist_status=blacklist_status,
#         active_only=active_only
#     )
#     return {"count": count}


# UNUSED BY FRONTEND - Commented out for security
# @router.get("/statistics")
# async def get_customer_statistics(
#     service: CustomerService = Depends(get_customer_service)
# ):
#     """Get customer statistics."""
#     return await service.get_customer_statistics()


@router.get("/{customer_id}", 
    response_model=CustomerResponse,
    dependencies=[CustomerPermissions.VIEW])
async def get_customer(
    customer_id: UUID,
    service: CustomerService = Depends(get_customer_service),
    current_user: User = Depends(get_current_user)
):
    """Get customer by ID. Requires CUSTOMER_VIEW permission."""
    customer = await service.get_customer(customer_id)
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    
    return customer


# UNUSED BY FRONTEND - Commented out for security
# @router.get("/code/{customer_code}", response_model=CustomerResponse)
# async def get_customer_by_code(
#     customer_code: str,
#     service: CustomerService = Depends(get_customer_service)
# ):
#     """Get customer by code."""
#     customer = await service.get_customer_by_code(customer_code)
#     if not customer:
#         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
#     
#     return customer


@router.put("/{customer_id}", 
    response_model=CustomerResponse,
    dependencies=[CustomerPermissions.UPDATE])
async def update_customer(
    customer_id: UUID,
    update_data: CustomerUpdate,
    service: CustomerService = Depends(get_customer_service),
    current_user: User = Depends(get_current_user)
):
    """Update customer information. Requires CUSTOMER_UPDATE permission."""
    try:
        return await service.update_customer(customer_id, update_data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{customer_id}", 
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[CustomerPermissions.DELETE])
async def delete_customer(
    customer_id: UUID,
    service: CustomerService = Depends(get_customer_service),
    current_user: User = Depends(get_current_user)
):
    """Delete customer. Requires CUSTOMER_DELETE permission."""
    success = await service.delete_customer(customer_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")


# Customer status management endpoints
@router.put("/{customer_id}/status", 
    response_model=CustomerResponse,
    dependencies=[CustomerPermissions.UPDATE])
async def update_customer_status(
    customer_id: UUID,
    status_update: CustomerStatusUpdate,
    service: CustomerService = Depends(get_customer_service),
    current_user: User = Depends(get_current_user)
):
    """Update customer status. Requires CUSTOMER_UPDATE permission."""
    try:
        return await service.update_customer_status(customer_id, status_update)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{customer_id}/blacklist", 
    response_model=CustomerResponse,
    dependencies=[CustomerPermissions.BLACKLIST])
async def update_blacklist_status(
    customer_id: UUID,
    blacklist_update: CustomerBlacklistUpdate,
    service: CustomerService = Depends(get_customer_service),
    current_user: User = Depends(get_current_user)
):
    """Update customer blacklist status. Requires CUSTOMER_BLACKLIST permission."""
    try:
        return await service.update_blacklist_status(customer_id, blacklist_update)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# UNUSED BY FRONTEND - Commented out for security
# @router.put("/{customer_id}/credit", response_model=CustomerResponse)
# async def update_credit_info(
#     customer_id: UUID,
#     credit_update: CustomerCreditUpdate,
#     service: CustomerService = Depends(get_customer_service)
# ):
#     """Update customer credit information."""
#     try:
#         return await service.update_credit_info(customer_id, credit_update)
#     except NotFoundError as e:
#         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
#     except ValidationError as e:
#         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# Customer type specific endpoints
# UNUSED BY FRONTEND - Commented out for security
# @router.get("/type/{customer_type}", response_model=List[CustomerResponse])
# async def get_customers_by_type(
#     customer_type: CustomerType,
#     skip: int = Query(0, ge=0, description="Records to skip"),
#     limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
#     active_only: bool = Query(True, description="Show only active customers"),
#     service: CustomerService = Depends(get_customer_service)
# ):
#     """Get customers by type."""
#     return await service.list_customers(
#         skip=skip,
#         limit=limit,
#         customer_type=customer_type,
#         active_only=active_only
#     )


# UNUSED BY FRONTEND - Commented out for security
# @router.get("/blacklist/{blacklist_status}", response_model=List[CustomerResponse])
# async def get_customers_by_blacklist_status(
#     blacklist_status: BlacklistStatus,
#     skip: int = Query(0, ge=0, description="Records to skip"),
#     limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
#     active_only: bool = Query(True, description="Show only active customers"),
#     service: CustomerService = Depends(get_customer_service)
# ):
#     """Get customers by blacklist status."""
#     return await service.list_customers(
#         skip=skip,
#         limit=limit,
#         blacklist_status=blacklist_status,
#         active_only=active_only
#     )


# Bulk operations endpoints
# UNUSED BY FRONTEND - Commented out for security
# @router.post("/bulk/activate", status_code=status.HTTP_204_NO_CONTENT)
# async def bulk_activate_customers(
#     customer_ids: List[UUID],
#     service: CustomerService = Depends(get_customer_service)
# ):
#     """Bulk activate customers."""
#     # TODO: Implement bulk activation
#     pass


# UNUSED BY FRONTEND - Commented out for security
# @router.post("/bulk/deactivate", status_code=status.HTTP_204_NO_CONTENT)
# async def bulk_deactivate_customers(
#     customer_ids: List[UUID],
#     service: CustomerService = Depends(get_customer_service)
# ):
#     """Bulk deactivate customers."""
#     # TODO: Implement bulk deactivation
#     pass


# Export endpoints
# UNUSED BY FRONTEND - Commented out for security
# @router.get("/export/csv")
# async def export_customers_csv(
#     customer_type: Optional[CustomerType] = Query(None, description="Filter by customer type"),
#     customer_status: Optional[CustomerStatus] = Query(None, description="Filter by status"),
#     blacklist_status: Optional[BlacklistStatus] = Query(None, description="Filter by blacklist status"),
#     active_only: bool = Query(True, description="Show only active customers"),
#     service: CustomerService = Depends(get_customer_service)
# ):
#     """Export customers to CSV."""
#     # TODO: Implement CSV export
#     return {"message": "CSV export not yet implemented"}


# UNUSED BY FRONTEND - Commented out for security
# @router.get("/export/xlsx")
# async def export_customers_xlsx(
#     customer_type: Optional[CustomerType] = Query(None, description="Filter by customer type"),
#     customer_status: Optional[CustomerStatus] = Query(None, description="Filter by status"),
#     blacklist_status: Optional[BlacklistStatus] = Query(None, description="Filter by blacklist status"),
#     active_only: bool = Query(True, description="Show only active customers"),
#     service: CustomerService = Depends(get_customer_service)
# ):
#     """Export customers to Excel."""
#     # TODO: Implement Excel export
#     return {"message": "Excel export not yet implemented"}
