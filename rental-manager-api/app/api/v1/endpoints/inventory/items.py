"""
Inventory Items API endpoints.

Provides endpoints for viewing detailed inventory item information including all associated inventory units.
"""

from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.services.inventory.inventory_service import inventory_service


router = APIRouter()


@router.get(
    "/{item_id}",
    summary="Get inventory item detail",
    description="Get detailed inventory information for a specific item including all inventory units"
)
async def get_inventory_item_detail(
    item_id: str = Path(..., description="Item ID or SKU"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed inventory information for a specific item.
    
    **Accepts either UUID or SKU as item_id**
    
    **Returns comprehensive information including:**
    
    **Item Information:**
    - Basic item details (name, SKU, description, pricing)
    - Category and brand information
    - Rental and sales configuration
    
    **Inventory Units:**
    - All individual units/batches for this item
    - Serial numbers, batch codes, conditions
    - Location, supplier, and purchase information
    - Rental rates and availability status
    - Maintenance and warranty information
    
    **Stock Levels:**
    - Current stock quantities by location
    - Available, reserved, rented, and damaged quantities
    - Reorder points and maximum stock levels
    - Utilization and availability rates
    
    **Recent Movements:**
    - Last 20 stock movements for this item
    - Movement types, quantities, and timestamps
    - User who performed each movement
    - Associated costs and reasons
    
    **Stock Summary:**
    - Aggregated totals across all locations
    - Overall utilization and availability rates
    - Number of units and locations
    """
    try:
        item_detail = None
        
        # Try to parse as UUID first
        try:
            item_uuid = UUID(item_id)
            # Get detailed inventory item information by UUID
            item_detail = await inventory_service.get_inventory_item_detail(
                db,
                item_id=item_uuid
            )
        except ValueError:
            # Not a UUID, treat as SKU
            item_detail = await inventory_service.get_inventory_item_detail_by_sku(
                db,
                sku=item_id
            )
        
        if not item_detail:
            raise HTTPException(
                status_code=404,
                detail=f"Inventory item with ID/SKU {item_id} not found or has no inventory units"
            )
        
        return {
            "success": True,
            "data": item_detail
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve inventory item detail: {str(e)}")


@router.get(
    "/{item_id}/units",
    summary="Get inventory units for item",
    description="Get all inventory units for a specific item"
)
async def get_inventory_units_for_item(
    item_id: str = Path(..., description="Item ID or SKU"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all inventory units for a specific item.
    
    **Accepts either UUID or SKU as item_id**
    
    Returns just the inventory units portion of the item detail,
    useful for unit-specific operations like rentals or maintenance.
    """
    try:
        item_detail = None
        
        # Try to parse as UUID first
        try:
            item_uuid = UUID(item_id)
            # Get detailed inventory item information by UUID
            item_detail = await inventory_service.get_inventory_item_detail(
                db,
                item_id=item_uuid
            )
        except ValueError:
            # Not a UUID, treat as SKU
            item_detail = await inventory_service.get_inventory_item_detail_by_sku(
                db,
                sku=item_id
            )
        
        if not item_detail:
            raise HTTPException(
                status_code=404,
                detail=f"Inventory item with ID/SKU {item_id} not found or has no inventory units"
            )
        
        return {
            "success": True,
            "data": {
                "item_id": item_detail["item"]["id"],
                "item_name": item_detail["item"]["item_name"],
                "sku": item_detail["item"]["sku"],
                "inventory_units": item_detail["inventory_units"],
                "total_units": len(item_detail["inventory_units"])
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve inventory units: {str(e)}")


@router.get(
    "/{item_id}/stock-levels",
    summary="Get stock levels for item",
    description="Get stock level information for a specific item across all locations"
)
async def get_stock_levels_for_item(
    item_id: str = Path(..., description="Item ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get stock level information for a specific item across all locations.
    
    Returns just the stock levels and summary portion of the item detail,
    useful for availability checking and stock management.
    """
    try:
        # Convert string to UUID
        item_uuid = UUID(item_id)
        
        # Get detailed inventory item information
        item_detail = await inventory_service.get_inventory_item_detail(
            db,
            item_id=item_uuid
        )
        
        if not item_detail:
            raise HTTPException(
                status_code=404,
                detail=f"Inventory item with ID {item_id} not found or has no inventory units"
            )
        
        return {
            "success": True,
            "data": {
                "item_id": item_id,
                "item_name": item_detail["item"]["item_name"],
                "sku": item_detail["item"]["sku"],
                "stock_levels": item_detail["stock_levels"],
                "stock_summary": item_detail["stock_summary"]
            }
        }
        
    except ValueError as e:
        if "badly formed hexadecimal UUID" in str(e):
            raise HTTPException(status_code=400, detail="Invalid UUID format")
        raise HTTPException(status_code=400, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve stock levels: {str(e)}")


@router.get(
    "/{item_id}/movements",
    summary="Get stock movements for item",
    description="Get recent stock movements for a specific item"
)
async def get_stock_movements_for_item(
    item_id: str = Path(..., description="Item ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get recent stock movements for a specific item.
    
    Returns the movement history portion of the item detail,
    useful for auditing and tracking inventory changes.
    """
    try:
        # Convert string to UUID
        item_uuid = UUID(item_id)
        
        # Get detailed inventory item information
        item_detail = await inventory_service.get_inventory_item_detail(
            db,
            item_id=item_uuid
        )
        
        if not item_detail:
            raise HTTPException(
                status_code=404,
                detail=f"Inventory item with ID {item_id} not found or has no inventory units"
            )
        
        return {
            "success": True,
            "data": {
                "item_id": item_id,
                "item_name": item_detail["item"]["item_name"],
                "sku": item_detail["item"]["sku"],
                "recent_movements": item_detail["recent_movements"],
                "total_movements": len(item_detail["recent_movements"])
            }
        }
        
    except ValueError as e:
        if "badly formed hexadecimal UUID" in str(e):
            raise HTTPException(status_code=400, detail="Invalid UUID format")
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve stock movements: {str(e)}")


@router.get(
    "/{item_id}/units/{unit_id}",
    summary="Get specific inventory unit for item",
    description="Get detailed information for a specific inventory unit of an item"
)
async def get_inventory_unit_detail(
    item_id: str = Path(..., description="Item ID or SKU"),
    unit_id: str = Path(..., description="Unit ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed information for a specific inventory unit.
    
    **Accepts either UUID or SKU as item_id**
    
    Returns detailed unit information including:
    - Unit identifiers (SKU, serial number, batch code)
    - Current status and condition
    - Location and supplier information
    - Purchase and financial details
    - Rental availability and history
    - Maintenance records
    """
    try:
        # Get the unit detail
        unit_uuid = UUID(unit_id)
        unit = await inventory_service.get_inventory_unit_detail(
            db,
            unit_id=unit_uuid
        )
        
        if not unit:
            raise HTTPException(
                status_code=404,
                detail=f"Inventory unit with ID {unit_id} not found"
            )
        
        # Verify the unit belongs to the specified item
        item_detail = None
        try:
            item_uuid = UUID(item_id)
            item_detail = await inventory_service.get_inventory_item_detail(
                db,
                item_id=item_uuid
            )
        except ValueError:
            # Not a UUID, treat as SKU
            item_detail = await inventory_service.get_inventory_item_detail_by_sku(
                db,
                sku=item_id
            )
        
        if not item_detail:
            raise HTTPException(
                status_code=404,
                detail=f"Inventory item with ID/SKU {item_id} not found"
            )
        
        # Check if unit belongs to this item
        if str(unit.get("item_id")) != str(item_detail["item"]["id"]):
            raise HTTPException(
                status_code=400,
                detail=f"Unit {unit_id} does not belong to item {item_id}"
            )
        
        return {
            "success": True,
            "data": unit
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve inventory unit detail: {str(e)}")