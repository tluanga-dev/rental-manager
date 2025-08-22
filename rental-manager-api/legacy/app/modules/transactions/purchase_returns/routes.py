"""
Purchase Returns Routes

API endpoints for purchase return operations.
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.errors import NotFoundError, ValidationError, ConflictError
from app.modules.auth.dependencies import get_current_user
from app.modules.users.models import User
from .service import PurchaseReturnService
from .schemas import (
    PurchaseReturnCreate,
    PurchaseReturnUpdate,
    PurchaseReturnResponse,
    PurchaseReturnListResponse,
    PurchaseReturnFilters,
    PurchaseReturnValidation,
    PurchaseReturnAnalytics,
    ReturnStatus,
    ReturnReason,
    PaymentStatus
)

router = APIRouter(tags=["Purchase Returns"])

def get_purchase_return_service(session: AsyncSession = Depends(get_db)) -> PurchaseReturnService:
    """Get purchase return service instance."""
    return PurchaseReturnService(session)

@router.get(
    "/",
    response_model=PurchaseReturnListResponse,
    status_code=status.HTTP_200_OK,
    summary="Get all purchase returns",
    description="Retrieve all purchase returns with optional filtering and pagination"
)
async def get_purchase_returns(
    supplier_id: Optional[UUID] = Query(None, description="Filter by supplier"),
    original_purchase_id: Optional[UUID] = Query(None, description="Filter by original purchase"),
    status: Optional[ReturnStatus] = Query(None, description="Filter by return status"),
    payment_status: Optional[PaymentStatus] = Query(None, description="Filter by payment status"),
    return_reason: Optional[ReturnReason] = Query(None, description="Filter by return reason"),
    start_date: Optional[date] = Query(None, description="Filter by start date"),
    end_date: Optional[date] = Query(None, description="Filter by end date"),
    search: Optional[str] = Query(None, description="Search in transaction number, notes, or RMA"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of records to return"),
    sort_by: str = Query("return_date", description="Field to sort by"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$", description="Sort order"),
    service: PurchaseReturnService = Depends(get_purchase_return_service),
    current_user: User = Depends(get_current_user)
):
    """
    Get all purchase returns with optional filtering and pagination.
    
    - **supplier_id**: Filter by supplier ID
    - **original_purchase_id**: Filter by original purchase ID
    - **status**: Filter by return status (PENDING, PROCESSING, COMPLETED, CANCELLED)
    - **payment_status**: Filter by payment status
    - **return_reason**: Filter by return reason
    - **start_date**: Filter returns from this date
    - **end_date**: Filter returns until this date
    - **search**: Search in transaction number, notes, or RMA
    - **skip**: Number of records to skip (pagination)
    - **limit**: Maximum number of records to return
    - **sort_by**: Field to sort by
    - **sort_order**: Sort order (asc or desc)
    """
    try:
        filters = PurchaseReturnFilters(
            supplier_id=supplier_id,
            original_purchase_id=original_purchase_id,
            status=status,
            payment_status=payment_status,
            return_reason=return_reason,
            start_date=start_date,
            end_date=end_date,
            search=search,
            skip=skip,
            limit=limit,
            sort_by=sort_by,
            sort_order=sort_order
        )
        return await service.get_purchase_returns(filters)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving purchase returns: {str(e)}"
        )

@router.get(
    "/{return_id}",
    response_model=PurchaseReturnResponse,
    status_code=status.HTTP_200_OK,
    summary="Get purchase return by ID",
    description="Retrieve a single purchase return by its ID"
)
async def get_purchase_return_by_id(
    return_id: UUID,
    service: PurchaseReturnService = Depends(get_purchase_return_service),
    current_user: User = Depends(get_current_user)
):
    """
    Get a single purchase return by ID.
    
    - **return_id**: The ID of the purchase return to retrieve
    """
    try:
        return await service.get_purchase_return_by_id(return_id)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving purchase return: {str(e)}"
        )

@router.post(
    "/",
    response_model=PurchaseReturnResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new purchase return",
    description="Create a new purchase return transaction"
)
async def create_purchase_return(
    data: PurchaseReturnCreate,
    service: PurchaseReturnService = Depends(get_purchase_return_service),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new purchase return.
    
    The request body should include:
    - **supplier_id**: ID of the supplier
    - **original_purchase_id**: ID of the original purchase transaction
    - **return_date**: Date of the return
    - **items**: List of items being returned with quantities and reasons
    - **return_authorization**: Optional RMA number
    - **notes**: Optional return notes
    """
    try:
        return await service.create_purchase_return(data, current_user.id)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating purchase return: {str(e)}"
        )

@router.put(
    "/{return_id}",
    response_model=PurchaseReturnResponse,
    status_code=status.HTTP_200_OK,
    summary="Update a purchase return",
    description="Update an existing purchase return"
)
async def update_purchase_return(
    return_id: UUID,
    data: PurchaseReturnUpdate,
    service: PurchaseReturnService = Depends(get_purchase_return_service),
    current_user: User = Depends(get_current_user)
):
    """
    Update an existing purchase return.
    
    - **return_id**: The ID of the purchase return to update
    - **status**: Update the return status
    - **payment_status**: Update the payment status
    - **return_authorization**: Update the RMA number
    - **notes**: Update the notes
    """
    try:
        return await service.update_purchase_return(return_id, data, current_user.id)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating purchase return: {str(e)}"
        )

@router.delete(
    "/{return_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cancel a purchase return",
    description="Cancel/delete a purchase return"
)
async def delete_purchase_return(
    return_id: UUID,
    service: PurchaseReturnService = Depends(get_purchase_return_service),
    current_user: User = Depends(get_current_user)
):
    """
    Cancel/delete a purchase return.
    
    - **return_id**: The ID of the purchase return to cancel
    
    Note: Only pending or processing returns can be cancelled.
    """
    try:
        await service.delete_purchase_return(return_id)
        return None
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting purchase return: {str(e)}"
        )

@router.post(
    "/validate",
    response_model=PurchaseReturnValidation,
    status_code=status.HTTP_200_OK,
    summary="Validate a purchase return",
    description="Validate that items can be returned from a purchase"
)
async def validate_purchase_return(
    purchase_id: UUID = Query(..., description="Original purchase ID"),
    items: List[Dict[str, Any]] = Body(..., description="Items to return"),
    service: PurchaseReturnService = Depends(get_purchase_return_service),
    current_user: User = Depends(get_current_user)
):
    """
    Validate a purchase return before creating it.
    
    - **purchase_id**: The original purchase ID
    - **items**: List of items to validate for return
    
    Returns validation result with available quantities and any errors.
    """
    try:
        return await service.validate_purchase_return(purchase_id, items)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error validating purchase return: {str(e)}"
        )

@router.get(
    "/analytics/summary",
    response_model=PurchaseReturnAnalytics,
    status_code=status.HTTP_200_OK,
    summary="Get purchase return analytics",
    description="Get analytics and statistics for purchase returns"
)
async def get_purchase_return_analytics(
    start_date: Optional[date] = Query(None, description="Start date for analytics"),
    end_date: Optional[date] = Query(None, description="End date for analytics"),
    supplier_id: Optional[UUID] = Query(None, description="Filter by supplier"),
    service: PurchaseReturnService = Depends(get_purchase_return_service),
    current_user: User = Depends(get_current_user)
):
    """
    Get purchase return analytics.
    
    - **start_date**: Start date for analytics period
    - **end_date**: End date for analytics period
    - **supplier_id**: Filter analytics by supplier
    
    Returns analytics including total returns, refund amounts, returns by status/reason, and top returned items.
    """
    try:
        return await service.get_purchase_return_analytics(start_date, end_date, supplier_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting purchase return analytics: {str(e)}"
        )

@router.get(
    "/purchase/{purchase_id}",
    response_model=List[PurchaseReturnResponse],
    status_code=status.HTTP_200_OK,
    summary="Get returns for a purchase",
    description="Get all return transactions for a specific purchase"
)
async def get_returns_by_purchase(
    purchase_id: UUID,
    service: PurchaseReturnService = Depends(get_purchase_return_service),
    current_user: User = Depends(get_current_user)
):
    """
    Get all return transactions for a specific purchase.
    
    - **purchase_id**: The original purchase ID
    
    Returns a list of all returns associated with the purchase.
    """
    try:
        returns = await service.repository.get_returns_by_purchase(purchase_id)
        formatted_returns = []
        for return_txn in returns:
            formatted_returns.append(await service._format_return_response(return_txn))
        return formatted_returns
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting returns for purchase: {str(e)}"
        )