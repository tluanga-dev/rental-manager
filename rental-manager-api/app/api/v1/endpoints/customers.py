from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationError, ConflictError
from app.shared.dependencies import get_db
from app.services.customer import CustomerService
from app.api.deps import get_current_user
from app.models.user import User
from app.models.customer import CustomerType, CustomerStatus, BlacklistStatus, CreditRating
from app.schemas.customer import (
    CustomerCreate, CustomerUpdate, CustomerResponse, CustomerStatusUpdate,
    CustomerBlacklistUpdate, CustomerCreditUpdate, CustomerSearchRequest,
    CustomerStatsResponse, CustomerAddressCreate, CustomerAddressResponse,
    CustomerContactCreate, CustomerContactResponse, CustomerDetailResponse
)
from app.core.permissions_enhanced import CustomerPermissions


router = APIRouter(tags=["Customer Management"])


# Dependency to get customer service
async def get_customer_service(session: AsyncSession = Depends(get_db)) -> CustomerService:
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
    try:
        return await service.search_customers(
            search_term=search_term,
            skip=skip,
            limit=limit,
            active_only=active_only
        )
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/count",
    response_model=Dict[str, int],
    dependencies=[CustomerPermissions.VIEW])
async def count_customers(
    customer_type: Optional[CustomerType] = Query(None, description="Filter by customer type"),
    customer_status: Optional[CustomerStatus] = Query(None, description="Filter by status"),
    blacklist_status: Optional[BlacklistStatus] = Query(None, description="Filter by blacklist status"),
    active_only: bool = Query(True, description="Show only active customers"),
    service: CustomerService = Depends(get_customer_service),
    current_user: User = Depends(get_current_user)
):
    """Count customers with optional filtering. Requires CUSTOMER_VIEW permission."""
    count = await service.count_customers(
        customer_type=customer_type,
        status=customer_status,
        blacklist_status=blacklist_status,
        active_only=active_only
    )
    return {"count": count}


@router.get("/statistics",
    response_model=Dict[str, Any],
    dependencies=[CustomerPermissions.VIEW])
async def get_customer_statistics(
    service: CustomerService = Depends(get_customer_service),
    current_user: User = Depends(get_current_user)
):
    """Get customer statistics. Requires CUSTOMER_VIEW permission."""
    return await service.get_customer_statistics()


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


@router.get("/code/{customer_code}", 
    response_model=CustomerResponse,
    dependencies=[CustomerPermissions.VIEW])
async def get_customer_by_code(
    customer_code: str,
    service: CustomerService = Depends(get_customer_service),
    current_user: User = Depends(get_current_user)
):
    """Get customer by code. Requires CUSTOMER_VIEW permission."""
    customer = await service.get_customer_by_code(customer_code)
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    
    return customer


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


@router.put("/{customer_id}/credit", 
    response_model=CustomerResponse,
    dependencies=[CustomerPermissions.UPDATE_CREDIT])
async def update_credit_info(
    customer_id: UUID,
    credit_update: CustomerCreditUpdate,
    service: CustomerService = Depends(get_customer_service),
    current_user: User = Depends(get_current_user)
):
    """Update customer credit information. Requires CUSTOMER_UPDATE_CREDIT permission."""
    try:
        return await service.update_credit_info(customer_id, credit_update)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# Customer type specific endpoints
@router.get("/type/{customer_type}", 
    response_model=List[CustomerResponse],
    dependencies=[CustomerPermissions.VIEW])
async def get_customers_by_type(
    customer_type: CustomerType,
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    active_only: bool = Query(True, description="Show only active customers"),
    service: CustomerService = Depends(get_customer_service),
    current_user: User = Depends(get_current_user)
):
    """Get customers by type. Requires CUSTOMER_VIEW permission."""
    return await service.list_customers(
        skip=skip,
        limit=limit,
        customer_type=customer_type,
        active_only=active_only
    )


@router.get("/blacklist/{blacklist_status}", 
    response_model=List[CustomerResponse],
    dependencies=[CustomerPermissions.VIEW])
async def get_customers_by_blacklist_status(
    blacklist_status: BlacklistStatus,
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    active_only: bool = Query(True, description="Show only active customers"),
    service: CustomerService = Depends(get_customer_service),
    current_user: User = Depends(get_current_user)
):
    """Get customers by blacklist status. Requires CUSTOMER_VIEW permission."""
    return await service.list_customers(
        skip=skip,
        limit=limit,
        blacklist_status=blacklist_status,
        active_only=active_only
    )


# Location-based endpoints
@router.get("/location/city/{city}", 
    response_model=List[CustomerResponse],
    dependencies=[CustomerPermissions.VIEW])
async def get_customers_by_city(
    city: str,
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    service: CustomerService = Depends(get_customer_service),
    current_user: User = Depends(get_current_user)
):
    """Get customers by city. Requires CUSTOMER_VIEW permission."""
    return await service.get_customers_by_location(
        city=city,
        skip=skip,
        limit=limit
    )


@router.get("/location/state/{state}", 
    response_model=List[CustomerResponse],
    dependencies=[CustomerPermissions.VIEW])
async def get_customers_by_state(
    state: str,
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    service: CustomerService = Depends(get_customer_service),
    current_user: User = Depends(get_current_user)
):
    """Get customers by state. Requires CUSTOMER_VIEW permission."""
    return await service.get_customers_by_location(
        state=state,
        skip=skip,
        limit=limit
    )


# Validation endpoints
@router.get("/validate/customer-code/{customer_code}", 
    response_model=Dict[str, bool],
    dependencies=[CustomerPermissions.VIEW])
async def validate_customer_code(
    customer_code: str,
    exclude_id: Optional[UUID] = Query(None, description="Customer ID to exclude from validation"),
    service: CustomerService = Depends(get_customer_service),
    current_user: User = Depends(get_current_user)
):
    """Validate if customer code is available. Requires CUSTOMER_VIEW permission."""
    is_available = await service.validate_customer_code(customer_code, exclude_id)
    return {"is_available": is_available}


@router.get("/validate/email/{email}", 
    response_model=Dict[str, bool],
    dependencies=[CustomerPermissions.VIEW])
async def validate_email(
    email: str,
    exclude_id: Optional[UUID] = Query(None, description="Customer ID to exclude from validation"),
    service: CustomerService = Depends(get_customer_service),
    current_user: User = Depends(get_current_user)
):
    """Validate if email is available. Requires CUSTOMER_VIEW permission."""
    is_available = await service.validate_email(email, exclude_id)
    return {"is_available": is_available}