from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.inventory.repository import InventoryReadRepository
from app.modules.inventory.schemas import ItemInventorySchema, UpdateInventoryUnitRentalRateRequest, BatchUpdateInventoryUnitRentalRateRequest
from app.modules.inventory.service import InventoryService
# from app.modules.inventory.unit_rental_blocking_routes import router as unit_rental_blocking_router
from app.shared.dependencies import get_session
from app.modules.auth.dependencies import get_current_user
from app.modules.users.models import User
from app.core.permissions_enhanced import InventoryPermissions

router = APIRouter(tags=["Inventory"])

service = InventoryService(InventoryReadRepository())


from fastapi import Query

@router.get(
    "/stocks_info_all_items_brief",
    response_model=list[ItemInventorySchema],
    summary="Return aggregated inventory information for all items (search, sort, filter)",
    dependencies=[InventoryPermissions.VIEW]
)
async def get_items_inventory(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    search: Optional[str] = Query(None, description="Free-text search"),
    sku: Optional[str] = Query(None, description="SKU (partial match)"),
    item_name: Optional[str] = Query(None, description="Item name (partial match)"),
    brand: Optional[str] = Query(None, description="Brand name (partial match)"),
    category: Optional[str] = Query(None, description="Category name (partial match)"),
    item_status: Optional[str] = Query(None, description="Item status"),
    stock_status: Optional[str] = Query(None, description="IN_STOCK | LOW_STOCK | OUT_OF_STOCK"),
    min_total: Optional[int] = Query(None, ge=0),
    max_total: Optional[int] = Query(None, ge=0),
    min_available: Optional[int] = Query(None, ge=0),
    max_available: Optional[int] = Query(None, ge=0),
    sort_by: str = Query("item_name", description="Field to sort by"),
    sort_order: str = Query("asc", pattern="^(asc|desc)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
):
    return await service.list_all_items_inventory(
        db,
        search=search,
        sku=sku,
        item_name=item_name,
        brand=brand,
        category=category,
        item_status=item_status,
        stock_status=stock_status,
        min_total=min_total,
        max_total=max_total,
        min_available=min_available,
        max_available=max_available,
        sort_by=sort_by,
        sort_order=sort_order,
        skip=skip,
        limit=limit,
    )


@router.put(
    "/units/{unit_id}/rental-rate",
    summary="Update rental rate for a specific inventory unit",
    dependencies=[InventoryPermissions.UPDATE]
)
async def update_inventory_unit_rental_rate(
    unit_id: UUID,
    request: UpdateInventoryUnitRentalRateRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Update the rental rate for a specific inventory unit.
    This allows for unit-specific pricing that overrides the item master pricing.
    """
    try:
        result = await service.update_inventory_unit_rental_rate(
            db, unit_id, request.rental_rate_per_period, current_user.id
        )
        if not result:
            raise HTTPException(status_code=404, detail="Inventory unit not found")
        return {"success": True, "message": "Rental rate updated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update rental rate: {str(e)}")


@router.put(
    "/units/batch/rental-rate",
    summary="Update rental rate for multiple inventory units by item and location",
    dependencies=[InventoryPermissions.UPDATE]
)
async def batch_update_inventory_unit_rental_rate(
    request: BatchUpdateInventoryUnitRentalRateRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Update the rental rate for all inventory units of a specific item at a specific location.
    This is useful when configuring rates during rental creation.
    """
    try:
        updated_count = await service.batch_update_inventory_unit_rental_rate(
            db, request.item_id, request.location_id, request.rental_rate_per_period, current_user.id
        )
        return {
            "success": True, 
            "message": f"Updated rental rate for {updated_count} inventory units",
            "updated_count": updated_count
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update rental rates: {str(e)}")

# UNUSED BY FRONTEND - Commented out for security
# Additional inventory endpoints that would be unused:
# - POST /adjustments (inventory adjustments)
# - GET /movements (inventory movements)
# - POST /transfers (inventory transfers)
# - GET /low-stock (low stock alerts)
# These endpoints are not implemented in the current routes file

# Include batch tracking routes - REMOVED DURING CLEANUP
# from app.modules.inventory.batch_routes import router as batch_router
# router.include_router(batch_router)

# Include inventory items routes - Using original routes
from app.modules.inventory.inventory_items_routes import router as items_router
router.include_router(items_router)

# Include unit rental blocking routes
# router.include_router(unit_rental_blocking_router)

# UNUSED BY FRONTEND - Commented out for security
# Include damage tracking routes
# from app.modules.inventory.damage_routes import router as damage_router
# from app.modules.auth.dependencies import get_current_user
# from app.modules.users.models import User
# router.include_router(damage_router)
