"""
API routes for item rental blocking functionality.
"""

from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require_permission
from app.modules.auth.dependencies import get_current_user
from app.modules.users.models import User
from app.modules.master_data.item_master.rental_blocking_service import ItemRentalBlockingService
from app.modules.master_data.item_master.rental_blocking_schemas import (
    RentalStatusRequest,
    RentalStatusResponse,
    RentalBlockHistoryListResponse,
    BlockedItemsListResponse,
    RentalAvailabilityResponse,
    BulkRentalStatusRequest,
    BulkRentalStatusResponse
)
from app.shared.exceptions import NotFoundError, ValidationError
from app.shared.dependencies import PaginationParams


router = APIRouter(prefix="/rental-blocking", tags=["Item Rental Blocking"])


@router.put("/{item_id}/status", response_model=RentalStatusResponse)
async def toggle_item_rental_status(
    item_id: UUID,
    request: RentalStatusRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_permission("item:block_rental"))
):
    """
    Toggle rental blocking status for an item.
    
    This endpoint allows administrators to block or unblock items from being rented.
    When an item is blocked, all inventory units of that item become unavailable for rental.
    """
    try:
        service = ItemRentalBlockingService(db)
        return await service.toggle_item_rental_status(
            item_id=item_id,
            request=request,
            changed_by=current_user.id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{item_id}/history", response_model=RentalBlockHistoryListResponse)
async def get_item_rental_history(
    item_id: UUID,
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get rental blocking history for an item.
    
    Returns a paginated list of all rental status changes for the specified item.
    """
    try:
        service = ItemRentalBlockingService(db)
        entries, total = await service.get_item_rental_history(
            item_id=item_id,
            skip=pagination.skip,
            limit=pagination.limit
        )
        
        return RentalBlockHistoryListResponse(
            entries=entries,
            total=total,
            skip=pagination.skip,
            limit=pagination.limit
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/blocked-items", response_model=BlockedItemsListResponse)
async def get_blocked_items(
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get list of all items currently blocked from rental.
    
    Returns a paginated list of items that are currently blocked from being rented.
    """
    try:
        service = ItemRentalBlockingService(db)
        items, total = await service.get_blocked_items(
            skip=pagination.skip,
            limit=pagination.limit
        )
        
        return BlockedItemsListResponse(
            items=items,
            total=total,
            skip=pagination.skip,
            limit=pagination.limit
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{item_id}/availability", response_model=RentalAvailabilityResponse)
async def check_item_rental_availability(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Check rental availability for an item.
    
    Returns detailed information about whether an item can be rented,
    including blocking status and unit availability.
    """
    try:
        service = ItemRentalBlockingService(db)
        return await service.check_item_rental_availability(item_id=item_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.put("/bulk-status", response_model=BulkRentalStatusResponse)
async def bulk_toggle_rental_status(
    request: BulkRentalStatusRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_permission("item:block_rental"))
):
    """
    Toggle rental status for multiple items at once.
    
    This endpoint allows administrators to block or unblock multiple items
    from rental with a single request.
    """
    try:
        service = ItemRentalBlockingService(db)
        return await service.bulk_toggle_rental_status(
            request=request,
            changed_by=current_user.id
        )
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")