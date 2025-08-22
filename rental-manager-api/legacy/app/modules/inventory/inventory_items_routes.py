"""
Inventory Items API routes for detailed inventory management.
Provides endpoints for viewing items with stock summary and detailed unit information.
"""
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload, joinedload

from app.modules.inventory.models import StockLevel, StockMovement, InventoryUnit
from app.modules.inventory.schemas import ItemInventorySchema
from app.modules.inventory.service import InventoryService
from app.modules.inventory.repository import InventoryReadRepository
from app.modules.master_data.item_master.models import Item
from app.modules.master_data.categories.models import Category
from app.modules.master_data.brands.models import Brand
from app.modules.master_data.locations.models import Location
from app.shared.dependencies import get_session
from app.modules.auth.dependencies import get_current_user
from app.modules.users.models import User
from app.core.permissions_enhanced import InventoryPermissions
from app.modules.inventory.enums import InventoryUnitStatus, InventoryUnitCondition, StockMovementType
from pydantic import BaseModel, Field
from datetime import datetime
from decimal import Decimal
from typing import Any

router = APIRouter(prefix="/items", tags=["Inventory Items"])

# Pydantic schemas for response
class CategorySummary(BaseModel):
    id: str
    name: str
    code: str

class BrandSummary(BaseModel):
    id: str
    name: str

class LocationStock(BaseModel):
    location_id: str
    location_name: str
    total_units: int
    available_units: int
    reserved_units: int
    rented_units: int

class StockSummary(BaseModel):
    total: int
    available: int
    reserved: int
    rented: int
    in_maintenance: int
    damaged: int
    stock_status: str  # IN_STOCK, LOW_STOCK, OUT_OF_STOCK

class InventoryItemSummary(BaseModel):
    id: str
    sku: str
    item_name: str
    category: CategorySummary
    brand: BrandSummary
    stock_summary: StockSummary
    total_value: Decimal
    item_status: str
    purchase_price: Optional[Decimal]
    sale_price: Optional[Decimal]
    rental_rate: Optional[Decimal]
    is_rentable: bool
    is_saleable: bool

class InventoryItemDetail(InventoryItemSummary):
    description: Optional[str]
    image_url: Optional[str]
    location_breakdown: List[LocationStock]
    min_stock_level: Optional[int]
    max_stock_level: Optional[int]
    created_at: datetime
    updated_at: datetime

class InventoryUnitDetail(BaseModel):
    id: str
    unit_identifier: str
    serial_number: Optional[str]
    location_id: str
    location_name: str
    status: str
    condition: str
    last_movement: Optional[datetime]
    acquisition_date: datetime
    acquisition_cost: Optional[Decimal]
    notes: Optional[str]

class StockMovementDetail(BaseModel):
    id: str
    movement_type: str
    quantity_change: Decimal
    quantity_before: Decimal
    quantity_after: Decimal
    from_status: Optional[str]
    to_status: Optional[str]
    location_id: str
    location_name: str
    created_at: datetime
    created_by: Optional[str]
    notes: Optional[str]

class InventoryAnalytics(BaseModel):
    total_movements: int
    average_daily_movement: float
    turnover_rate: float
    stock_health_score: float
    days_of_stock: Optional[int]
    last_restock_date: Optional[datetime]
    last_sale_date: Optional[datetime]
    trend: str  # INCREASING, DECREASING, STABLE

# Schema for comprehensive inventory display (both serialized units and bulk stock)
class BulkStockInfo(BaseModel):
    total_quantity: int
    available: int
    rented: int
    damaged: int
    in_maintenance: int
    reserved: int = 0

class AllInventoryLocation(BaseModel):
    location_id: str
    location_name: str
    serialized_units: List[InventoryUnitDetail]
    bulk_stock: BulkStockInfo

@router.get(
    "",
    response_model=List[InventoryItemSummary],
    summary="Get all inventory items with stock summary",
    dependencies=[InventoryPermissions.VIEW]
)
async def get_inventory_items(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    search: Optional[str] = Query(None, description="Search by name, SKU, or description"),
    category_id: Optional[str] = Query(None, description="Filter by category ID"),
    brand_id: Optional[str] = Query(None, description="Filter by brand ID"),
    item_status: Optional[str] = Query(None, description="Filter by item status"),
    stock_status: Optional[str] = Query(None, description="Filter by stock status"),
    is_rentable: Optional[bool] = Query(None, description="Filter by rentable items"),
    is_saleable: Optional[bool] = Query(None, description="Filter by saleable items"),
    sort_by: str = Query("item_name", description="Sort field"),
    sort_order: str = Query("asc", regex="^(asc|desc)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """
    Get all inventory items with aggregated stock information.
    Returns a summary view suitable for the inventory items list page.
    """
    try:
        # Build the base query
        query = select(Item).options(
            selectinload(Item.category),
            selectinload(Item.brand),
            selectinload(Item.stock_levels)
        )
        
        # Apply filters
        filters = []
        if search:
            search_term = f"%{search}%"
            filters.append(
                or_(
                    Item.item_name.ilike(search_term),
                    Item.sku.ilike(search_term),
                    Item.description.ilike(search_term)
                )
            )
        
        if category_id:
            filters.append(Item.category_id == category_id)
        
        if brand_id:
            filters.append(Item.brand_id == brand_id)
        
        if item_status:
            filters.append(Item.item_status == item_status)
        
        if is_rentable is not None:
            filters.append(Item.is_rentable == is_rentable)
        
        if is_saleable is not None:
            filters.append(Item.is_saleable == is_saleable)
        
        if filters:
            query = query.where(and_(*filters))
        
        # Apply sorting
        sort_column = getattr(Item, sort_by, Item.item_name)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column)
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        
        # Execute query
        result = await db.execute(query)
        items = result.scalars().all()
        
        # Transform to response model
        response_items = []
        for item in items:
            # Calculate stock summary from stock_levels
            total = sum(sl.quantity_on_hand for sl in item.stock_levels)
            available = sum(sl.quantity_available for sl in item.stock_levels)
            rented = sum(sl.quantity_on_rent for sl in item.stock_levels)
            in_maintenance = sum(sl.quantity_under_repair for sl in item.stock_levels)
            damaged = sum(sl.quantity_damaged for sl in item.stock_levels)
            
            # Determine stock status
            if total == 0:
                calculated_stock_status = "OUT_OF_STOCK"
            elif total < (item.reorder_point or 10):
                calculated_stock_status = "LOW_STOCK"
            else:
                calculated_stock_status = "IN_STOCK"
            
            # Apply stock status filter if provided
            if stock_status and stock_status != calculated_stock_status:
                continue
            
            # Calculate total value using purchase price as primary, sale price as fallback, 
            # and rental rate as tertiary fallback for rentable items
            purchase_price = Decimal(str(item.purchase_price or 0))
            sale_price = Decimal(str(item.sale_price or 0))
            rental_rate = Decimal(str(item.rental_rate_per_period or 0))
            
            # Determine valuation price with enhanced fallback logic
            if purchase_price > 0:
                valuation_price = purchase_price
            elif sale_price > 0:
                valuation_price = sale_price
            elif rental_rate > 0 and item.is_rentable:
                # Use rental rate as estimate (multiply by 10 as rough purchase price approximation)
                valuation_price = rental_rate * 10
            else:
                valuation_price = Decimal(0)
            
            total_value = float(Decimal(str(total)) * valuation_price)
            
            response_items.append(InventoryItemSummary(
                id=str(item.id),
                sku=item.sku,
                item_name=item.item_name,
                category=CategorySummary(
                    id=str(item.category.id),
                    name=item.category.name,
                    code=item.category.category_code
                ),
                brand=BrandSummary(
                    id=str(item.brand.id),
                    name=item.brand.name
                ),
                stock_summary=StockSummary(
                    total=total,
                    available=available,
                    reserved=0,  # Reserved field doesn't exist in StockLevel model
                    rented=rented,
                    in_maintenance=in_maintenance,
                    damaged=damaged,
                    stock_status=calculated_stock_status
                ),
                total_value=total_value,
                item_status=item.item_status,
                purchase_price=item.purchase_price,
                sale_price=item.sale_price,
                rental_rate=item.rental_rate_per_period,
                is_rentable=item.is_rentable,
                is_saleable=item.is_saleable
            ))
    
        return response_items
    except Exception as e:
        # Log error with more detail for debugging
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error in get_inventory_items: {e}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        # Return proper error response instead of empty array
        raise HTTPException(status_code=500, detail=f"Failed to fetch inventory items: {str(e)}")

@router.get(
    "/{item_id}",
    response_model=InventoryItemDetail,
    summary="Get detailed information for a specific inventory item",
    dependencies=[InventoryPermissions.VIEW]
)
async def get_inventory_item_detail(
    item_id: UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed information for a specific inventory item including
    location breakdown and additional metadata.
    """
    try:
        # Get item with all related data
        query = select(Item).options(
            selectinload(Item.category),
            selectinload(Item.brand),
            selectinload(Item.stock_levels).selectinload(StockLevel.location)
        ).where(Item.id == item_id)
        
        result = await db.execute(query)
        item = result.scalar_one_or_none()
        
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        
        # Calculate stock summary
        total = sum(sl.quantity_on_hand for sl in item.stock_levels)
        available = sum(sl.quantity_available for sl in item.stock_levels)
        rented = sum(sl.quantity_on_rent for sl in item.stock_levels)
        in_maintenance = sum(sl.quantity_under_repair for sl in item.stock_levels)
        damaged = sum(sl.quantity_damaged for sl in item.stock_levels)
        
        # Determine stock status
        if total == 0:
            calculated_stock_status = "OUT_OF_STOCK"
        elif total < (item.reorder_point or 10):  # Use reorder_point instead of min_stock_level
            calculated_stock_status = "LOW_STOCK"
        else:
            calculated_stock_status = "IN_STOCK"
        
        # Calculate location breakdown
        location_breakdown = []
        for sl in item.stock_levels:
            if sl.quantity_on_hand > 0:
                location_breakdown.append(LocationStock(
                    location_id=str(sl.location_id),
                    location_name=sl.location.location_name,
                    total_units=sl.quantity_on_hand,
                    available_units=sl.quantity_available,
                    reserved_units=0,  # Reserved field doesn't exist in StockLevel model
                    rented_units=sl.quantity_on_rent
                ))
        
        # Calculate total value using purchase price as primary, sale price as fallback, 
        # and rental rate as tertiary fallback for rentable items
        purchase_price = Decimal(str(item.purchase_price or 0))
        sale_price = Decimal(str(item.sale_price or 0))
        rental_rate = Decimal(str(item.rental_rate_per_period or 0))
        
        # Determine valuation price with enhanced fallback logic
        if purchase_price > 0:
            valuation_price = purchase_price
        elif sale_price > 0:
            valuation_price = sale_price
        elif rental_rate > 0 and item.is_rentable:
            # Use rental rate as estimate (multiply by 10 as rough purchase price approximation)
            valuation_price = rental_rate * 10
        else:
            valuation_price = Decimal(0)
        
        total_value = float(Decimal(str(total)) * valuation_price)
        
        return InventoryItemDetail(
            id=str(item.id),
            sku=item.sku,
            item_name=item.item_name,
            category=CategorySummary(
                id=str(item.category.id),
                name=item.category.name,
                code=item.category.category_code
            ),
            brand=BrandSummary(
                id=str(item.brand.id),
                name=item.brand.name
            ),
            stock_summary=StockSummary(
                total=total,
                available=available,
                reserved=0,  # Reserved field doesn't exist in StockLevel model
                rented=rented,
                in_maintenance=in_maintenance,
                damaged=damaged,
                stock_status=calculated_stock_status
            ),
            total_value=total_value,
            item_status=item.item_status,
            purchase_price=item.purchase_price,
            sale_price=item.sale_price,
            rental_rate=item.rental_rate_per_period,
            is_rentable=item.is_rentable,
            is_saleable=item.is_saleable,
            description=item.description,
            image_url=getattr(item, 'image_url', None),
            location_breakdown=location_breakdown,
            min_stock_level=item.reorder_point,
            max_stock_level=None,
            created_at=item.created_at,
            updated_at=item.updated_at
        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error in get_inventory_item_detail: {e}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get(
    "/{item_id}/units",
    response_model=List[InventoryUnitDetail],
    summary="Get all inventory units for a specific item",
    dependencies=[InventoryPermissions.VIEW]
)
async def get_inventory_item_units(
    item_id: UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    location_id: Optional[str] = Query(None, description="Filter by location"),
    status: Optional[str] = Query(None, description="Filter by unit status"),
    condition: Optional[str] = Query(None, description="Filter by condition"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """
    Get all inventory units for a specific item with filtering options.
    Note: Returns empty list if item doesn't have serialized units (non-serialized items).
    """
    try:
        # Build query for inventory units
        query = select(InventoryUnit).options(
            selectinload(InventoryUnit.location)
        ).where(InventoryUnit.item_id == item_id)
        
        # Apply filters
        if location_id:
            query = query.where(InventoryUnit.location_id == location_id)
        
        if status:
            query = query.where(InventoryUnit.status == status)
        
        if condition:
            query = query.where(InventoryUnit.condition == condition)
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        
        # Execute query
        result = await db.execute(query)
        units = result.scalars().all()
        
        # If no units found, return empty list (item might not be serialized)
        if not units:
            return []
        
        # Transform to response model
        response_units = []
        for unit in units:
            # Get last movement
            movement_query = select(StockMovement).where(
                StockMovement.item_id == item_id
            ).order_by(StockMovement.created_at.desc()).limit(1)
            
            movement_result = await db.execute(movement_query)
            last_movement = movement_result.scalar_one_or_none()
            
            response_units.append(InventoryUnitDetail(
                id=str(unit.id),
                unit_identifier=unit.unit_identifier,
                serial_number=unit.serial_number,
                location_id=str(unit.location_id),
                location_name=unit.location.location_name,
                status=unit.status.value,
                condition=unit.condition.value,
                last_movement=last_movement.created_at if last_movement else None,
                acquisition_date=unit.created_at,
                acquisition_cost=getattr(unit, 'acquisition_cost', None),
                notes=getattr(unit, 'notes', None)
            ))
        
        return response_units
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error in get_inventory_item_units: {e}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        # Return empty list for units as many items don't have serialized units
        return []

@router.get(
    "/{item_id}/movements",
    response_model=List[StockMovementDetail],
    summary="Get stock movement history for a specific item",
    dependencies=[InventoryPermissions.VIEW]
)
async def get_inventory_item_movements(
    item_id: UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    movement_type: Optional[str] = Query(None, description="Filter by movement type"),
    location_id: Optional[str] = Query(None, description="Filter by location"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200)
):
    """
    Get stock movement history for a specific item.
    """
    # Build query for stock movements
    query = select(StockMovement).options(
        selectinload(StockMovement.location)
    ).where(StockMovement.item_id == item_id)
    
    # Apply filters
    if movement_type:
        query = query.where(StockMovement.movement_type == movement_type)
    
    if location_id:
        query = query.where(StockMovement.location_id == location_id)
    
    # Order by most recent first
    query = query.order_by(StockMovement.created_at.desc())
    
    # Apply pagination
    query = query.offset(skip).limit(limit)
    
    # Execute query
    result = await db.execute(query)
    movements = result.scalars().all()
    
    # Transform to response model
    response_movements = []
    for movement in movements:
        response_movements.append(StockMovementDetail(
            id=str(movement.id),
            movement_type=movement.movement_type.value,
            quantity_change=movement.quantity_change,
            quantity_before=movement.quantity_before,
            quantity_after=movement.quantity_after,
            from_status=None,  # Would need additional logic to determine
            to_status=None,    # Would need additional logic to determine
            location_id=str(movement.location_id),
            location_name=movement.location.location_name,
            created_at=movement.created_at,
            created_by=movement.created_by if hasattr(movement, 'created_by') else None,
            notes=movement.notes if hasattr(movement, 'notes') else None
        ))
    
    return response_movements

@router.get(
    "/{item_id}/analytics",
    response_model=InventoryAnalytics,
    summary="Get analytics data for a specific inventory item",
    dependencies=[InventoryPermissions.VIEW]
)
async def get_inventory_item_analytics(
    item_id: UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get analytics and insights for a specific inventory item.
    """
    # Get total movements count
    movements_count_query = select(func.count(StockMovement.id)).where(
        StockMovement.item_id == item_id
    )
    movements_count_result = await db.execute(movements_count_query)
    total_movements = movements_count_result.scalar() or 0
    
    # Get item for calculations
    item_query = select(Item).options(
        selectinload(Item.stock_levels)
    ).where(Item.id == item_id)
    item_result = await db.execute(item_query)
    item = item_result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Calculate current stock
    current_stock = sum(sl.quantity_on_hand for sl in item.stock_levels)
    
    # Get last restock date (last positive movement)
    last_restock_query = select(StockMovement).where(
        and_(
            StockMovement.item_id == item_id,
            StockMovement.quantity_change > 0
        )
    ).order_by(StockMovement.created_at.desc()).limit(1)
    
    last_restock_result = await db.execute(last_restock_query)
    last_restock = last_restock_result.scalar_one_or_none()
    
    # Get last sale date (last negative movement)
    last_sale_query = select(StockMovement).where(
        and_(
            StockMovement.item_id == item_id,
            StockMovement.quantity_change < 0
        )
    ).order_by(StockMovement.created_at.desc()).limit(1)
    
    last_sale_result = await db.execute(last_sale_query)
    last_sale = last_sale_result.scalar_one_or_none()
    
    # Calculate metrics
    average_daily_movement = total_movements / 30 if total_movements > 0 else 0
    turnover_rate = (total_movements / current_stock) if current_stock > 0 else 0
    stock_health_score = min(100, float((Decimal(str(current_stock)) / Decimal(str(item.reorder_point or 10))) * 100)) if current_stock > 0 else 0
    days_of_stock = int(current_stock / average_daily_movement) if average_daily_movement > 0 else None
    
    # Determine trend (simplified)
    trend = "STABLE"
    if total_movements > 10:
        trend = "INCREASING" if average_daily_movement > 1 else "DECREASING"
    
    return InventoryAnalytics(
        total_movements=total_movements,
        average_daily_movement=round(average_daily_movement, 2),
        turnover_rate=round(turnover_rate, 2),
        stock_health_score=round(stock_health_score, 2),
        days_of_stock=days_of_stock,
        last_restock_date=last_restock.created_at if last_restock else None,
        last_sale_date=last_sale.created_at if last_sale else None,
        trend=trend
    )

@router.get(
    "/{item_id}/all-inventory",
    response_model=List[AllInventoryLocation],
    summary="Get comprehensive inventory view for a specific item",
    dependencies=[InventoryPermissions.VIEW]
)
async def get_inventory_item_all_inventory(
    item_id: UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    location_id: Optional[str] = Query(None, description="Filter by location"),
    status: Optional[str] = Query(None, description="Filter by unit status"),
    condition: Optional[str] = Query(None, description="Filter by condition"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """
    Get comprehensive inventory view for a specific item.
    Returns both serialized units (individual InventoryUnit records) 
    and bulk stock levels (StockLevel aggregations) grouped by location.
    
    This provides a complete view of all inventory items that belong to the specified item.
    """
    try:
        # First, get all locations that have this item (either as units or stock levels)
        locations_query = select(Location).distinct()
        
        # Get locations with inventory units
        units_locations_query = select(Location.id).join(InventoryUnit).where(
            InventoryUnit.item_id == item_id
        )
        
        # Get locations with stock levels
        stock_locations_query = select(Location.id).join(StockLevel).where(
            StockLevel.item_id == item_id
        )
        
        # Combine both queries to get all relevant locations
        all_location_ids_query = units_locations_query.union(stock_locations_query)
        
        locations_query = select(Location).where(
            Location.id.in_(all_location_ids_query)
        )
        
        if location_id:
            locations_query = locations_query.where(Location.id == location_id)
            
        locations_result = await db.execute(locations_query)
        locations = locations_result.scalars().all()
        
        response_locations = []
        
        for location in locations:
            # Get serialized units for this location
            units_query = select(InventoryUnit).options(
                selectinload(InventoryUnit.location)
            ).where(
                and_(
                    InventoryUnit.item_id == item_id,
                    InventoryUnit.location_id == location.id
                )
            )
            
            # Apply filters
            if status:
                units_query = units_query.where(InventoryUnit.status == status)
            if condition:
                units_query = units_query.where(InventoryUnit.condition == condition)
                
            # Apply pagination (though this might need adjustment for grouped data)
            units_query = units_query.offset(skip).limit(limit)
            
            units_result = await db.execute(units_query)
            units = units_result.scalars().all()
            
            # Transform units to response model
            serialized_units = []
            for unit in units:
                # Get last movement for this unit
                movement_query = select(StockMovement).where(
                    StockMovement.item_id == item_id
                ).order_by(StockMovement.created_at.desc()).limit(1)
                
                movement_result = await db.execute(movement_query)
                last_movement = movement_result.scalar_one_or_none()
                
                serialized_units.append(InventoryUnitDetail(
                    id=str(unit.id),
                    unit_identifier=unit.unit_identifier,
                    serial_number=unit.serial_number,
                    location_id=str(unit.location_id),
                    location_name=unit.location.location_name,
                    status=unit.status.value,
                    condition=unit.condition.value,
                    last_movement=last_movement.created_at if last_movement else None,
                    acquisition_date=unit.created_at,
                    acquisition_cost=getattr(unit, 'acquisition_cost', None),
                    notes=getattr(unit, 'notes', None)
                ))
            
            # Get bulk stock levels for this location
            stock_query = select(StockLevel).where(
                and_(
                    StockLevel.item_id == item_id,
                    StockLevel.location_id == location.id
                )
            )
            
            stock_result = await db.execute(stock_query)
            stock_level = stock_result.scalar_one_or_none()
            
            # Create bulk stock info
            if stock_level:
                bulk_stock = BulkStockInfo(
                    total_quantity=stock_level.quantity_on_hand,
                    available=stock_level.quantity_available,
                    rented=stock_level.quantity_on_rent,
                    damaged=stock_level.quantity_damaged,
                    in_maintenance=stock_level.quantity_under_repair,
                    reserved=0  # Reserved field doesn't exist in StockLevel model
                )
            else:
                # If no stock level exists, create empty bulk stock
                bulk_stock = BulkStockInfo(
                    total_quantity=0,
                    available=0,
                    rented=0,
                    damaged=0,
                    in_maintenance=0,
                    reserved=0
                )
            
            # Only include locations that have either units or stock
            if serialized_units or bulk_stock.total_quantity > 0:
                response_locations.append(AllInventoryLocation(
                    location_id=str(location.id),
                    location_name=location.location_name,
                    serialized_units=serialized_units,
                    bulk_stock=bulk_stock
                ))
        
        return response_locations
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error in get_inventory_item_all_inventory: {e}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Internal server error")