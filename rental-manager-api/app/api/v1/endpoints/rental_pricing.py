"""
API endpoints for Rental Pricing management.

This module provides RESTful endpoints for managing rental pricing tiers,
including CRUD operations, bulk operations, and pricing calculations.
"""

from typing import List, Optional, Any
from uuid import UUID
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.models.user import User
from app.schemas.rental_pricing import (
    RentalPricingCreate,
    RentalPricingUpdate,
    RentalPricingResponse,
    RentalPricingListRequest,
    RentalPricingListResponse,
    RentalPricingFilter,
    RentalPricingSort,
    RentalPricingBulkCreate,
    RentalPricingCalculationRequest,
    RentalPricingCalculationResponse,
    StandardPricingTemplate,
    StandardPricingTemplateResponse,
    ItemRentalPricingSummary,
)
from app.services.rental_pricing_service import (
    RentalPricingService,
    PricingOptimizationStrategy,
)
from app.core.errors import NotFoundError, ValidationError, ConflictError

router = APIRouter()


@router.post("/", response_model=RentalPricingResponse, status_code=status.HTTP_201_CREATED)
async def create_rental_pricing(
    *,
    db: AsyncSession = Depends(deps.get_db),
    pricing_data: RentalPricingCreate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Create a new rental pricing tier.
    
    Required fields:
    - item_id: UUID of the item
    - tier_name: Name for this pricing tier
    - rate_per_period: Rate charged per period
    
    Optional fields:
    - period_type: HOURLY, DAILY, WEEKLY, MONTHLY, CUSTOM (default: DAILY)
    - period_days: Number of days this period represents (default: 1)
    - min_rental_days: Minimum rental duration to qualify
    - max_rental_days: Maximum rental duration for this rate
    - effective_date: When this pricing becomes effective
    - expiry_date: When this pricing expires
    - is_default: Whether this is the default tier
    - pricing_strategy: FIXED, TIERED, SEASONAL, DYNAMIC
    - seasonal_multiplier: Seasonal adjustment (1.0 = no adjustment)
    - priority: Priority for pricing selection (lower = higher priority)
    """
    service = RentalPricingService(db)
    try:
        return await service.create_pricing_tier(
            pricing_data.item_id,
            pricing_data,
            created_by=current_user.email
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/bulk", response_model=List[RentalPricingResponse], status_code=status.HTTP_201_CREATED)
async def bulk_create_rental_pricing(
    *,
    db: AsyncSession = Depends(deps.get_db),
    bulk_data: RentalPricingBulkCreate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Create multiple pricing tiers for an item.
    
    This endpoint allows you to create multiple pricing tiers at once,
    ensuring consistency and validation across all tiers.
    """
    service = RentalPricingService(db)
    try:
        return await service.bulk_create_pricing(
            bulk_data.item_id,
            bulk_data.pricing_tiers,
            created_by=current_user.email
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/standard-template/{item_id}", response_model=StandardPricingTemplateResponse)
async def create_standard_pricing(
    *,
    db: AsyncSession = Depends(deps.get_db),
    item_id: UUID,
    template: StandardPricingTemplate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Create standard daily/weekly/monthly pricing for an item.
    
    This endpoint creates a standard pricing structure with:
    - Daily rate (always created)
    - Weekly rate (optional, or calculated from discount)
    - Monthly rate (optional, or calculated from discount)
    
    Provide either explicit rates or discount percentages for weekly/monthly.
    """
    service = RentalPricingService(db)
    try:
        created_tiers = await service.create_standard_pricing(
            item_id,
            template,
            created_by=current_user.email
        )
        
        summary = f"Created {len(created_tiers)} pricing tiers: "
        tier_names = [tier.tier_name for tier in created_tiers]
        summary += ", ".join(tier_names)
        
        return StandardPricingTemplateResponse(
            created_tiers=created_tiers,
            item_id=item_id,
            summary=summary
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.get("/{pricing_id}", response_model=RentalPricingResponse)
async def get_rental_pricing(
    *,
    db: AsyncSession = Depends(deps.get_db),
    pricing_id: UUID,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get a specific rental pricing tier by ID.
    """
    service = RentalPricingService(db)
    pricing = await service.crud.get(db, pricing_id)
    if not pricing:
        raise HTTPException(status_code=404, detail="Pricing tier not found")
    return RentalPricingResponse.model_validate(pricing)


@router.get("/item/{item_id}", response_model=List[RentalPricingResponse])
async def get_item_pricing(
    *,
    db: AsyncSession = Depends(deps.get_db),
    item_id: UUID,
    include_inactive: bool = Query(False, description="Include inactive pricing tiers"),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get all pricing tiers for a specific item.
    
    Returns pricing tiers sorted by priority (lower number = higher priority).
    """
    service = RentalPricingService(db)
    pricing_tiers = await service.crud.get_by_item(db, item_id, include_inactive)
    return [RentalPricingResponse.model_validate(tier) for tier in pricing_tiers]


@router.get("/item/{item_id}/summary", response_model=ItemRentalPricingSummary)
async def get_item_pricing_summary(
    *,
    db: AsyncSession = Depends(deps.get_db),
    item_id: UUID,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get a summary of pricing for an item.
    
    Returns:
    - Default pricing tier (if set)
    - All available pricing tiers
    - Daily rate range (min to max)
    - Whether item has tiered pricing
    """
    service = RentalPricingService(db)
    try:
        return await service.get_item_pricing_summary(item_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/calculate", response_model=RentalPricingCalculationResponse)
async def calculate_rental_pricing(
    *,
    db: AsyncSession = Depends(deps.get_db),
    request: RentalPricingCalculationRequest,
    optimization_strategy: PricingOptimizationStrategy = Query(
        PricingOptimizationStrategy.LOWEST_COST,
        description="Strategy for selecting optimal pricing"
    ),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Calculate optimal rental pricing for a given duration.
    
    This endpoint:
    1. Finds all applicable pricing tiers for the rental duration
    2. Calculates total cost for each tier
    3. Recommends the optimal tier based on the optimization strategy
    4. Shows potential savings compared to daily rate
    
    Optimization strategies:
    - LOWEST_COST: Select the cheapest option for the customer
    - HIGHEST_MARGIN: Select highest profit margin (if cost data available)
    - BALANCED: Balance between cost and margin
    - CUSTOMER_FRIENDLY: Prioritize customer savings
    """
    service = RentalPricingService(db)
    try:
        return await service.calculate_rental_pricing(
            request.item_id,
            request.rental_days,
            request.calculation_date,
            optimization_strategy
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/calculate/bulk", response_model=dict)
async def calculate_bulk_rental_pricing(
    *,
    db: AsyncSession = Depends(deps.get_db),
    item_ids: List[UUID] = Query(..., description="List of item IDs"),
    rental_days: int = Query(..., ge=1, description="Rental duration in days"),
    calculation_date: Optional[date] = Query(None, description="Date for calculation"),
    optimization_strategy: PricingOptimizationStrategy = Query(
        PricingOptimizationStrategy.LOWEST_COST,
        description="Strategy for selecting optimal pricing"
    ),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Calculate optimal rental pricing for multiple items.
    
    Returns a dictionary mapping item_id to pricing calculation results.
    Items without applicable pricing will be omitted from the results.
    """
    service = RentalPricingService(db)
    results = await service.optimize_pricing_for_duration(
        item_ids,
        rental_days,
        optimization_strategy
    )
    
    # Convert UUIDs to strings for JSON serialization
    return {
        str(item_id): result.dict() 
        for item_id, result in results.items()
    }


@router.put("/{pricing_id}", response_model=RentalPricingResponse)
async def update_rental_pricing(
    *,
    db: AsyncSession = Depends(deps.get_db),
    pricing_id: UUID,
    pricing_update: RentalPricingUpdate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update a rental pricing tier.
    
    All fields are optional. Only provided fields will be updated.
    
    Note: If setting is_default=true, this will automatically remove
    the default flag from other pricing tiers for the same item.
    """
    service = RentalPricingService(db)
    try:
        return await service.update_pricing_tier(
            pricing_id,
            pricing_update,
            updated_by=current_user.email
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{pricing_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rental_pricing(
    *,
    db: AsyncSession = Depends(deps.get_db),
    pricing_id: UUID,
    current_user: User = Depends(deps.get_current_active_user),
) -> None:
    """
    Delete a rental pricing tier.
    
    Note: You cannot delete the last pricing tier for an item.
    If deleting the default tier, another tier will be automatically
    set as default.
    """
    service = RentalPricingService(db)
    try:
        await service.delete_pricing_tier(pricing_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=RentalPricingListResponse)
async def list_rental_pricing(
    *,
    db: AsyncSession = Depends(deps.get_db),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    sort: RentalPricingSort = Query(RentalPricingSort.PRIORITY_ASC, description="Sort order"),
    # Filter parameters
    item_ids: Optional[List[UUID]] = Query(None, description="Filter by item IDs"),
    period_type: Optional[str] = Query(None, description="Filter by period type"),
    pricing_strategy: Optional[str] = Query(None, description="Filter by pricing strategy"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    is_default: Optional[bool] = Query(None, description="Filter by default status"),
    min_rate: Optional[float] = Query(None, ge=0, description="Minimum rate filter"),
    max_rate: Optional[float] = Query(None, ge=0, description="Maximum rate filter"),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    List rental pricing tiers with filters and pagination.
    
    Supports filtering by:
    - Item IDs
    - Period type (DAILY, WEEKLY, MONTHLY, etc.)
    - Pricing strategy (FIXED, TIERED, SEASONAL, DYNAMIC)
    - Active/inactive status
    - Default status
    - Rate range
    
    Results can be sorted by priority, rate, period, or creation date.
    """
    service = RentalPricingService(db)
    
    # Build filter object
    filters = None
    if any([item_ids, period_type, pricing_strategy, is_active is not None, 
            is_default is not None, min_rate, max_rate]):
        filters = RentalPricingFilter(
            item_ids=item_ids,
            period_type=period_type,
            pricing_strategy=pricing_strategy,
            is_active=is_active,
            is_default=is_default,
            min_rate=min_rate,
            max_rate=max_rate
        )
    
    items, total = await service.crud.get_with_filters(
        db, filters, sort, skip, limit
    )
    
    return RentalPricingListResponse(
        items=[RentalPricingResponse.model_validate(item) for item in items],
        total=total,
        skip=skip,
        limit=limit
    )


@router.post("/migrate/{item_id}", response_model=List[RentalPricingResponse])
async def migrate_item_to_structured_pricing(
    *,
    db: AsyncSession = Depends(deps.get_db),
    item_id: UUID,
    use_existing_rate: bool = Query(True, description="Use item's existing daily rate"),
    daily_rate: Optional[float] = Query(None, ge=0, description="Override daily rate"),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Migrate an item from simple daily rate to structured pricing.
    
    This creates a standard pricing structure with:
    - Daily rate (from item or provided)
    - Weekly rate (10% discount)
    - Monthly rate (20% discount)
    
    Use this for migrating existing items to the new pricing system.
    """
    service = RentalPricingService(db)
    try:
        return await service.migrate_item_pricing(
            item_id,
            daily_rate=daily_rate if not use_existing_rate else None,
            created_by=current_user.email
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.get("/analysis/{item_id}", response_model=dict)
async def analyze_pricing_performance(
    *,
    db: AsyncSession = Depends(deps.get_db),
    item_id: UUID,
    start_date: date = Query(..., description="Analysis start date"),
    end_date: date = Query(..., description="Analysis end date"),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Analyze pricing tier performance for an item.
    
    Returns analysis of:
    - Tier utilization
    - Revenue by tier
    - Customer preference patterns
    - Optimization recommendations
    
    Note: This requires transaction history data to be meaningful.
    """
    service = RentalPricingService(db)
    try:
        return await service.analyze_pricing_performance(
            item_id,
            start_date,
            end_date
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))