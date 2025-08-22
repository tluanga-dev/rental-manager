import logging
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.dependencies import get_session
from app.modules.master_data.item_master.service import ItemMasterService
from app.modules.master_data.item_master.models import ItemStatus
from app.modules.master_data.item_master.schemas import (
    ItemCreate, ItemUpdate, ItemResponse, ItemListResponse, ItemWithInventoryResponse,
    ItemWithRelationsResponse, ItemListWithRelationsResponse, ItemNestedResponse,
    SKUGenerationRequest, SKUGenerationResponse, SKUBulkGenerationResponse
)
from app.modules.master_data.item_master.rental_blocking_routes import router as rental_blocking_router
from app.core.errors import NotFoundError, ValidationError, ConflictError
from app.modules.auth.dependencies import get_current_user
from app.modules.users.models import User


router = APIRouter(tags=["Items"])
logger = logging.getLogger(__name__)


def get_item_master_service(session: AsyncSession = Depends(get_session)) -> ItemMasterService:
    """Get item master service instance."""
    return ItemMasterService(session)


# Item endpoints
@router.post("/", response_model=ItemResponse, status_code=status.HTTP_201_CREATED, 
             summary="Create Item", description="Create a new item with automatic SKU generation")
async def create_item(
    item_data: ItemCreate,
    service: ItemMasterService = Depends(get_item_master_service)
):
    """Create a new item with automatic SKU generation based on category and item details."""
    # Log the incoming payload
    logger.info(f"🚀 Creating new item - Payload received: {item_data.dict()}")
    
    try:
        result = await service.create_item(item_data)
        logger.info(f"✅ Item created successfully with ID: {result.id}")
        return result
    except ConflictError as e:
        logger.error(f"❌ ConflictError creating item: {str(e)}")
        logger.error(f"📋 Failed payload: {item_data.dict()}")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValidationError as e:
        logger.error(f"❌ ValidationError creating item: {str(e)}")
        logger.error(f"📋 Failed payload: {item_data.dict()}")
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except ValueError as e:
        logger.error(f"❌ ValueError creating item: {str(e)}")
        logger.error(f"📋 Failed payload: {item_data.dict()}")
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"❌ Unexpected error creating item: {str(e)}")
        logger.error(f"📋 Failed payload: {item_data.dict()}")
        logger.exception("Full exception details:")
        
        # Return more detailed error information to frontend
        error_detail = {
            "message": str(e),
            "type": type(e).__name__,
            "item_name": getattr(item_data, 'item_name', 'Unknown'),
        }
        
        # Handle specific database/validation errors with more context
        if "duplicate key" in str(e).lower() or "unique constraint" in str(e).lower():
            error_detail["message"] = "An item with this SKU or name already exists"
            error_detail["type"] = "DuplicateError"
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error_detail["message"])
        elif "foreign key" in str(e).lower():
            error_detail["message"] = "Invalid reference to category, brand, or unit of measurement"
            error_detail["type"] = "ForeignKeyError"
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=error_detail["message"])
        elif "not null" in str(e).lower():
            error_detail["message"] = "Required field is missing or empty"
            error_detail["type"] = "RequiredFieldError"
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=error_detail["message"])
        else:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create item: {str(e)}")


@router.get("/enhanced", response_model=List[ItemListWithRelationsResponse],
           summary="Get Items with Enhanced Details", 
           description="Get paginated list of items with complete relationship data and enhanced filtering")
async def get_items_with_details(
    # Pagination
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of items to return"),
    
    # Enhanced filters
    brand_ids: Optional[str] = Query(None, description="Comma-separated list of brand IDs"),
    category_ids: Optional[str] = Query(None, description="Comma-separated list of category IDs"),
    item_statuses: Optional[str] = Query(None, description="Comma-separated list of item statuses"),
    active_only: bool = Query(True, description="Show only active items"),
    
    # Type filters
    is_rentable: Optional[bool] = Query(None, description="Filter by rentable status"),
    is_saleable: Optional[bool] = Query(None, description="Filter by saleable status"),
    
    # Price range filters
    min_rental_rate: Optional[float] = Query(None, ge=0, description="Minimum rental rate"),
    max_rental_rate: Optional[float] = Query(None, ge=0, description="Maximum rental rate"),
    min_sale_price: Optional[float] = Query(None, ge=0, description="Minimum sale price"),
    max_sale_price: Optional[float] = Query(None, ge=0, description="Maximum sale price"),
    
    # Inventory filters
    has_stock: Optional[bool] = Query(None, description="Filter items with/without inventory"),
    
    # Search
    search: Optional[str] = Query(None, description="Search in item name, SKU, description, model, brand, category"),
    
    # Date range filters
    created_after: Optional[str] = Query(None, description="Items created after this date (ISO format)"),
    created_before: Optional[str] = Query(None, description="Items created before this date (ISO format)"),
    updated_after: Optional[str] = Query(None, description="Items updated after this date (ISO format)"),
    updated_before: Optional[str] = Query(None, description="Items updated before this date (ISO format)"),
    
    service: ItemMasterService = Depends(get_item_master_service)
):
    """
    Get items with complete relationship data including brand, category, and unit information.
    
    This endpoint provides enhanced filtering capabilities including:
    - Multiple brand/category filtering
    - Price range filtering
    - Inventory status filtering
    - Enhanced search across multiple fields
    - Date range filtering
    
    Returns complete item data with relationship information and inventory summaries.
    """
    # Parse comma-separated IDs
    brand_id_list = None
    if brand_ids:
        try:
            brand_id_list = [UUID(id.strip()) for id in brand_ids.split(',') if id.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid brand ID format")
    
    category_id_list = None
    if category_ids:
        try:
            category_id_list = [UUID(id.strip()) for id in category_ids.split(',') if id.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid category ID format")
    
    # Parse item statuses
    item_status = None
    if item_statuses:
        try:
            # For now, just take the first status (can be enhanced later for multiple)
            status_list = [status.strip() for status in item_statuses.split(',') if status.strip()]
            if status_list:
                item_status = ItemStatus(status_list[0])
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid item status")
    
    return await service.get_items_with_relations(
        skip=skip,
        limit=limit,
        item_status=item_status,
        brand_ids=brand_id_list,
        category_ids=category_id_list,
        active_only=active_only,
        is_rentable=is_rentable,
        is_saleable=is_saleable,
        min_rental_rate=min_rental_rate,
        max_rental_rate=max_rental_rate,
        min_sale_price=min_sale_price,
        max_sale_price=max_sale_price,
        has_stock=has_stock,
        search_term=search,
        created_after=created_after,
        created_before=created_before,
        updated_after=updated_after,
        updated_before=updated_before
    )


@router.get("/sku/{sku}", response_model=ItemResponse)
async def get_item_by_sku(
    sku: str,
    service: ItemMasterService = Depends(get_item_master_service)
):
    """Get item by SKU."""
    try:
        return await service.get_item_by_sku(sku)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


# Stock alert endpoints - must come before parameterized routes
@router.get("/low-stock", response_model=List[ItemWithInventoryResponse],
           summary="Get Low Stock Items",
           description="Get items with stock levels at or below their reorder point")
async def get_low_stock_items_new(
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of items to return"),
    location_id: Optional[UUID] = Query(None, description="Filter by location"),
    service: ItemMasterService = Depends(get_item_master_service)
):
    """
    Get items that need reordering based on their reorder point configuration.
    Uses efficient JOIN pattern for optimal performance.
    """
    try:
        return await service.get_low_stock_items(
            location_id=location_id,
            skip=skip,
            limit=limit
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Error retrieving low stock items: {str(e)}"
        )


@router.get("/stock-alerts/summary", 
           summary="Get Stock Alerts Summary",
           description="Get summary statistics for stock alerts across all items")
async def get_stock_alerts_summary_new(
    service: ItemMasterService = Depends(get_item_master_service)
):
    """
    Get comprehensive summary of stock alert statistics including:
    - Out of stock count
    - Low stock count
    - Total items
    - Average reorder point
    - Items needing attention
    """
    try:
        return await service.get_stock_alerts_summary()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving stock alerts summary: {str(e)}"
        )


@router.get("/{item_id}", response_model=ItemWithRelationsResponse,
           summary="Get Item by ID", description="Retrieve a single item by its UUID with relationships")
async def get_item(
    item_id: UUID,
    service: ItemMasterService = Depends(get_item_master_service)
):
    """Get item by ID."""
    try:
        return await service.get_item(item_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        # Log the actual error for debugging
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error fetching item {item_id}: {str(e)}")
        logger.exception("Full error details:")
        # Return a more informative error in development/debugging
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Failed to fetch item: {str(e)}"
        )


@router.get("/", response_model=List[ItemNestedResponse],
           summary="Get Items", 
           description="Get paginated list of items with nested relationship objects")
async def get_items(
    response: Response,
    # Pagination
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of items to return"),
    
    # Enhanced filters
    category_id: Optional[UUID] = Query(None, description="Filter by category ID"),
    brand_id: Optional[UUID] = Query(None, description="Filter by brand ID"),
    item_status: Optional[ItemStatus] = Query(None, description="Filter by item status"),
    active_only: bool = Query(True, description="Show only active items"),
    
    # Type filters
    is_rentable: Optional[bool] = Query(None, description="Filter by rentable status"),
    is_saleable: Optional[bool] = Query(None, description="Filter by saleable status"),
    
    # Price range filters
    min_rental_rate: Optional[float] = Query(None, ge=0, description="Minimum rental rate"),
    max_rental_rate: Optional[float] = Query(None, ge=0, description="Maximum rental rate"),
    min_sale_price: Optional[float] = Query(None, ge=0, description="Minimum sale price"),
    max_sale_price: Optional[float] = Query(None, ge=0, description="Maximum sale price"),
    
    # Inventory filters
    has_stock: Optional[bool] = Query(None, description="Filter items with/without inventory"),
    
    # Search
    search: Optional[str] = Query(None, description="Search in item name, SKU, description, model, brand, category"),
    
    # Date range filters
    created_after: Optional[str] = Query(None, description="Items created after this date (ISO format)"),
    created_before: Optional[str] = Query(None, description="Items created before this date (ISO format)"),
    updated_after: Optional[str] = Query(None, description="Items updated after this date (ISO format)"),
    updated_before: Optional[str] = Query(None, description="Items updated before this date (ISO format)"),
    
    service: ItemMasterService = Depends(get_item_master_service)
):
    """Get all items with nested relationship format. Returns brand, category, and unit information as nested objects."""
    logger.info(f"🔍 Route: get_items called with search='{search}', active_only={active_only}")
    # Convert single IDs to lists for the service method
    brand_ids = [brand_id] if brand_id else None
    category_ids = [category_id] if category_id else None
    
    # Get the items
    items = await service.get_items_nested_format(
        skip=skip,
        limit=limit,
        item_status=item_status,
        brand_ids=brand_ids,
        category_ids=category_ids,
        active_only=active_only,
        is_rentable=is_rentable,
        is_saleable=is_saleable,
        min_rental_rate=min_rental_rate,
        max_rental_rate=max_rental_rate,
        min_sale_price=min_sale_price,
        max_sale_price=max_sale_price,
        has_stock=has_stock,
        search_term=search,
        created_after=created_after,
        created_before=created_before,
        updated_after=updated_after,
        updated_before=updated_before
    )
    
    # Get total count for pagination
    total_count = await service.count_items(
        search=search,
        item_status=item_status,
        brand_id=brand_id,
        category_id=category_id,
        is_rentable=is_rentable,
        is_saleable=is_saleable,
        active_only=active_only
    )
    
    # Add pagination headers
    response.headers["X-Total-Count"] = str(total_count)
    response.headers["X-Page-Size"] = str(limit)
    response.headers["X-Page-Offset"] = str(skip)
    
    logger.info(f"🔍 Returning {len(items)} items out of {total_count} total")
    
    return items


@router.get("/search/{search_term}", response_model=List[ItemListResponse])
async def search_items(
    search_term: str,
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of items to return"),
    active_only: bool = Query(True, description="Show only active items"),
    service: ItemMasterService = Depends(get_item_master_service)
):
    """Search items by name or code."""
    return await service.search_items(
        search_term=search_term,
        skip=skip,
        limit=limit,
        active_only=active_only
    )


@router.put("/{item_id}", response_model=ItemResponse,
           summary="Update Item", description="Update an existing item (partial update supported)")
async def update_item(
    item_id: UUID,
    item_data: ItemUpdate,
    service: ItemMasterService = Depends(get_item_master_service)
):
    """Update an item. All fields are optional - only provided fields will be updated."""
    try:
        return await service.update_item(item_id, item_data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT,
              summary="Delete Item", description="Soft delete an item (sets is_active to false)")
async def delete_item(
    item_id: UUID,
    service: ItemMasterService = Depends(get_item_master_service)
):
    """Delete (soft delete) an item."""
    try:
        await service.delete_item(item_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))




@router.get("/types/sale", response_model=List[ItemListResponse])
async def get_sale_items(
    active_only: bool = Query(True, description="Show only active items"),
    service: ItemMasterService = Depends(get_item_master_service)
):
    """Get all sale items."""
    return await service.get_sale_items(active_only=active_only)


@router.get("/category/{category_id}", response_model=List[ItemListResponse])
async def get_items_by_category(
    category_id: UUID,
    active_only: bool = Query(True, description="Show only active items"),
    service: ItemMasterService = Depends(get_item_master_service)
):
    """Get all items in a specific category."""
    return await service.get_items_by_category(category_id, active_only=active_only)


@router.get("/brand/{brand_id}", response_model=List[ItemListResponse])
async def get_items_by_brand(
    brand_id: UUID,
    active_only: bool = Query(True, description="Show only active items"),
    service: ItemMasterService = Depends(get_item_master_service)
):
    """Get all items for a specific brand."""
    return await service.get_items_by_brand(brand_id, active_only=active_only)


@router.get("/low-stock/", response_model=List[ItemListResponse])
async def get_low_stock_items(
    active_only: bool = Query(True, description="Show only active items"),
    service: ItemMasterService = Depends(get_item_master_service)
):
    """Get items that need reordering based on reorder level."""
    return await service.get_low_stock_items(active_only=active_only)


# SKU-specific endpoints
@router.post("/skus/generate", response_model=SKUGenerationResponse)
async def generate_sku_preview(
    request: SKUGenerationRequest,
    service: ItemMasterService = Depends(get_item_master_service)
):
    """Generate a preview of what SKU would be created for the given category and item details."""
    return await service.generate_sku_preview(request)


@router.post("/skus/bulk-generate", response_model=SKUBulkGenerationResponse)
async def bulk_generate_skus(
    service: ItemMasterService = Depends(get_item_master_service)
):
    """Generate SKUs for all existing items that don't have them."""
    return await service.bulk_generate_skus()


# Count endpoint
@router.get("/count/total")
async def count_items(
    search: Optional[str] = Query(None, description="Search term for item name, code, or SKU"),
    item_status: Optional[ItemStatus] = Query(None, description="Filter by item status"),
    brand_id: Optional[UUID] = Query(None, description="Filter by brand ID"),
    category_id: Optional[UUID] = Query(None, description="Filter by category ID"),
    is_rentable: Optional[bool] = Query(None, description="Filter by rentable status"),
    is_saleable: Optional[bool] = Query(None, description="Filter by saleable status"),
    active_only: bool = Query(True, description="Count only active items"),
    service: ItemMasterService = Depends(get_item_master_service)
):
    """Count items with optional search and filtering."""
    count = await service.count_items(
        search=search,
        item_status=item_status,
        brand_id=brand_id,
        category_id=category_id,
        is_rentable=is_rentable,
        is_saleable=is_saleable,
        active_only=active_only
    )
    return {"count": count}


# Include rental blocking sub-router
router.include_router(rental_blocking_router)

