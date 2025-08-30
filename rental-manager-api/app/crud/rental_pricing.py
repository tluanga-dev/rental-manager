"""
CRUD operations for Rental Pricing model.

Provides database operations for rental pricing tiers with optimized queries
for pricing calculations and bulk operations.
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc, asc, update, delete
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.exc import IntegrityError

from app.models.rental_pricing import RentalPricing, PricingStrategy, PeriodType
from app.schemas.rental_pricing import (
    RentalPricingCreate, RentalPricingUpdate, RentalPricingFilter,
    RentalPricingSort, StandardPricingTemplate
)
from app.core.errors import NotFoundError, ValidationError, ConflictError


class RentalPricingCRUD:
    """CRUD operations for rental pricing."""
    
    def __init__(self, model=RentalPricing):
        """Initialize CRUD with model."""
        self.model = model
    
    async def get(self, db: AsyncSession, id: UUID) -> Optional[RentalPricing]:
        """Get a single rental pricing by ID."""
        query = select(self.model).where(self.model.id == id)
        result = await db.execute(query)
        return result.scalars().first()
    
    async def update(
        self,
        db: AsyncSession,
        *,
        db_obj: RentalPricing,
        obj_in: RentalPricingUpdate
    ) -> RentalPricing:
        """Update a rental pricing tier."""
        update_data = obj_in.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    
    async def remove(self, db: AsyncSession, *, id: UUID) -> RentalPricing:
        """Delete a rental pricing tier."""
        obj = await self.get(db, id)
        if obj:
            await db.delete(obj)
            await db.commit()
        return obj
    
    async def create(
        self, 
        db: AsyncSession, 
        *, 
        obj_in: RentalPricingCreate,
        created_by: Optional[str] = None
    ) -> RentalPricing:
        """
        Create a new rental pricing tier.
        
        Args:
            db: Database session
            obj_in: Pricing data
            created_by: User creating the pricing
            
        Returns:
            Created pricing tier
            
        Raises:
            ConflictError: If conflicting pricing exists
            ValidationError: If validation fails
        """
        try:
            # Check if this would create a duplicate default pricing
            if obj_in.is_default:
                existing_default = await self.get_default_pricing(db, obj_in.item_id)
                if existing_default:
                    raise ConflictError(f"Item already has a default pricing tier: {existing_default.tier_name}")
            
            # Create pricing tier
            # Ensure correct period values based on unit
            pricing_data = obj_in.dict()
            if pricing_data.get('period_unit') == 'HOUR':
                pricing_data['period_days'] = None  # Explicitly set to None for HOUR unit
            elif pricing_data.get('period_unit') == 'DAY':
                pricing_data['period_hours'] = None  # Explicitly set to None for DAY unit
            
            db_obj = RentalPricing(
                **pricing_data,
                created_by=created_by
            )
            db.add(db_obj)
            await db.commit()
            await db.refresh(db_obj)
            
            return db_obj
            
        except IntegrityError as e:
            await db.rollback()
            if "uq_rental_pricing_item_tier_effective" in str(e):
                raise ConflictError(f"Pricing tier '{obj_in.tier_name}' already exists for this item with the same effective date")
            raise ConflictError(f"Failed to create pricing tier: {str(e)}")
    
    async def get_by_item(
        self, 
        db: AsyncSession, 
        item_id: UUID,
        include_inactive: bool = False
    ) -> List[RentalPricing]:
        """
        Get all pricing tiers for an item.
        
        Args:
            db: Database session
            item_id: Item ID
            include_inactive: Whether to include inactive pricing
            
        Returns:
            List of pricing tiers sorted by priority
        """
        query = select(RentalPricing).where(RentalPricing.item_id == item_id)
        
        if not include_inactive:
            query = query.where(RentalPricing.is_active == True)
        
        query = query.order_by(RentalPricing.priority.asc(), RentalPricing.created_at.asc())
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_default_pricing(
        self, 
        db: AsyncSession, 
        item_id: UUID
    ) -> Optional[RentalPricing]:
        """
        Get default pricing tier for an item.
        
        Args:
            db: Database session
            item_id: Item ID
            
        Returns:
            Default pricing tier or None
        """
        query = select(RentalPricing).where(
            and_(
                RentalPricing.item_id == item_id,
                RentalPricing.is_default == True,
                RentalPricing.is_active == True
            )
        )
        
        result = await db.execute(query)
        return result.scalars().first()
    
    async def get_applicable_pricing(
        self, 
        db: AsyncSession, 
        item_id: UUID,
        rental_days: int,
        calculation_date: Optional[date] = None
    ) -> List[RentalPricing]:
        """
        Get pricing tiers applicable for a specific rental duration.
        
        Args:
            db: Database session
            item_id: Item ID
            rental_days: Rental duration in days
            calculation_date: Date for calculation (default: today)
            
        Returns:
            List of applicable pricing tiers sorted by priority
        """
        if calculation_date is None:
            calculation_date = date.today()
        
        query = select(RentalPricing).where(
            and_(
                RentalPricing.item_id == item_id,
                RentalPricing.is_active == True,
                RentalPricing.effective_date <= calculation_date,
                or_(
                    RentalPricing.expiry_date.is_(None),
                    RentalPricing.expiry_date >= calculation_date
                ),
                or_(
                    RentalPricing.min_rental_days.is_(None),
                    RentalPricing.min_rental_days <= rental_days
                ),
                or_(
                    RentalPricing.max_rental_days.is_(None),
                    RentalPricing.max_rental_days >= rental_days
                )
            )
        ).order_by(RentalPricing.priority.asc())
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_best_pricing(
        self, 
        db: AsyncSession, 
        item_id: UUID,
        rental_days: int,
        calculation_date: Optional[date] = None
    ) -> Optional[RentalPricing]:
        """
        Get the best pricing tier for a rental duration.
        
        Args:
            db: Database session
            item_id: Item ID
            rental_days: Rental duration in days
            calculation_date: Date for calculation
            
        Returns:
            Best pricing tier (lowest total cost) or None
        """
        applicable_tiers = await self.get_applicable_pricing(
            db, item_id, rental_days, calculation_date
        )
        
        if not applicable_tiers:
            return None
        
        # Find tier with lowest total cost
        best_tier = None
        lowest_cost = None
        
        for tier in applicable_tiers:
            try:
                cost = tier.calculate_total_cost(rental_days)
                if lowest_cost is None or cost < lowest_cost:
                    lowest_cost = cost
                    best_tier = tier
            except ValueError:
                # Skip tiers that don't apply (shouldn't happen with our query)
                continue
        
        return best_tier
    
    async def bulk_create(
        self, 
        db: AsyncSession, 
        item_id: UUID,
        pricing_data: List[RentalPricingCreate],
        created_by: Optional[str] = None
    ) -> List[RentalPricing]:
        """
        Create multiple pricing tiers for an item.
        
        Args:
            db: Database session
            item_id: Item ID
            pricing_data: List of pricing tier data
            created_by: User creating the pricing
            
        Returns:
            List of created pricing tiers
        """
        try:
            # Validate only one default tier
            default_count = sum(1 for data in pricing_data if data.is_default)
            if default_count > 1:
                raise ValidationError("Only one pricing tier can be marked as default")
            
            # If a default is being created, check for existing defaults
            if default_count == 1:
                existing_default = await self.get_default_pricing(db, item_id)
                if existing_default:
                    raise ConflictError(f"Item already has a default pricing tier: {existing_default.tier_name}")
            
            # Create all pricing tiers
            created_tiers = []
            for data in pricing_data:
                db_obj = RentalPricing(
                    **data.dict(),
                    created_by=created_by
                )
                db.add(db_obj)
                created_tiers.append(db_obj)
            
            await db.commit()
            
            # Refresh all objects
            for tier in created_tiers:
                await db.refresh(tier)
            
            return created_tiers
            
        except IntegrityError as e:
            await db.rollback()
            raise ConflictError(f"Failed to create pricing tiers: {str(e)}")
    
    async def create_standard_pricing(
        self,
        db: AsyncSession,
        item_id: UUID,
        template: StandardPricingTemplate,
        created_by: Optional[str] = None
    ) -> List[RentalPricing]:
        """
        Create standard daily/weekly/monthly pricing for an item.
        
        Args:
            db: Database session
            item_id: Item ID
            template: Standard pricing template
            created_by: User creating the pricing
            
        Returns:
            List of created pricing tiers
        """
        pricing_data = []
        
        # Daily pricing (always created)
        pricing_data.append(RentalPricingCreate(
            item_id=item_id,
            tier_name="Daily Rate",
            period_type=PeriodType.DAILY,
            period_days=1,
            rate_per_period=template.daily_rate,
            min_rental_days=1,
            max_rental_days=6,
            is_default=True,
            priority=10
        ))
        
        # Weekly pricing
        if template.weekly_rate:
            pricing_data.append(RentalPricingCreate(
                item_id=item_id,
                tier_name="Weekly Rate",
                period_type=PeriodType.WEEKLY,
                period_days=7,
                rate_per_period=template.weekly_rate,
                min_rental_days=7,
                max_rental_days=29,
                priority=20
            ))
        
        # Monthly pricing
        if template.monthly_rate:
            pricing_data.append(RentalPricingCreate(
                item_id=item_id,
                tier_name="Monthly Rate",
                period_type=PeriodType.MONTHLY,
                period_days=30,
                rate_per_period=template.monthly_rate,
                min_rental_days=30,
                priority=30
            ))
        
        return await self.bulk_create(db, item_id, pricing_data, created_by)
    
    async def update_default_pricing(
        self,
        db: AsyncSession,
        item_id: UUID,
        new_default_id: UUID
    ) -> List[RentalPricing]:
        """
        Update which pricing tier is the default for an item.
        
        Args:
            db: Database session
            item_id: Item ID
            new_default_id: ID of new default pricing tier
            
        Returns:
            List of updated pricing tiers
        """
        # First, remove default from all existing tiers
        await db.execute(
            update(RentalPricing)
            .where(RentalPricing.item_id == item_id)
            .values(is_default=False)
        )
        
        # Then set the new default
        await db.execute(
            update(RentalPricing)
            .where(
                and_(
                    RentalPricing.id == new_default_id,
                    RentalPricing.item_id == item_id
                )
            )
            .values(is_default=True)
        )
        
        await db.commit()
        
        return await self.get_by_item(db, item_id)
    
    async def get_with_filters(
        self,
        db: AsyncSession,
        filters: Optional[RentalPricingFilter] = None,
        sort: RentalPricingSort = RentalPricingSort.PRIORITY_ASC,
        skip: int = 0,
        limit: int = 100
    ) -> tuple[List[RentalPricing], int]:
        """
        Get pricing tiers with filters, sorting, and pagination.
        
        Args:
            db: Database session
            filters: Filter criteria
            sort: Sort order
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            Tuple of (pricing tiers, total count)
        """
        query = select(RentalPricing)
        count_query = select(func.count(RentalPricing.id))
        
        # Apply filters
        if filters:
            conditions = []
            
            if filters.item_ids:
                conditions.append(RentalPricing.item_id.in_(filters.item_ids))
            
            if filters.period_type:
                conditions.append(RentalPricing.period_type == filters.period_type.value)
            
            if filters.pricing_strategy:
                conditions.append(RentalPricing.pricing_strategy == filters.pricing_strategy.value)
            
            if filters.is_active is not None:
                conditions.append(RentalPricing.is_active == filters.is_active)
            
            if filters.is_default is not None:
                conditions.append(RentalPricing.is_default == filters.is_default)
            
            if filters.effective_after:
                conditions.append(RentalPricing.effective_date >= filters.effective_after)
            
            if filters.effective_before:
                conditions.append(RentalPricing.effective_date <= filters.effective_before)
            
            if filters.min_rate is not None:
                conditions.append(RentalPricing.rate_per_period >= filters.min_rate)
            
            if filters.max_rate is not None:
                conditions.append(RentalPricing.rate_per_period <= filters.max_rate)
            
            if conditions:
                filter_condition = and_(*conditions)
                query = query.where(filter_condition)
                count_query = count_query.where(filter_condition)
        
        # Apply sorting
        if sort == RentalPricingSort.PRIORITY_ASC:
            query = query.order_by(asc(RentalPricing.priority))
        elif sort == RentalPricingSort.PRIORITY_DESC:
            query = query.order_by(desc(RentalPricing.priority))
        elif sort == RentalPricingSort.RATE_ASC:
            query = query.order_by(asc(RentalPricing.rate_per_period))
        elif sort == RentalPricingSort.RATE_DESC:
            query = query.order_by(desc(RentalPricing.rate_per_period))
        elif sort == RentalPricingSort.PERIOD_ASC:
            query = query.order_by(asc(RentalPricing.period_days))
        elif sort == RentalPricingSort.PERIOD_DESC:
            query = query.order_by(desc(RentalPricing.period_days))
        elif sort == RentalPricingSort.CREATED_ASC:
            query = query.order_by(asc(RentalPricing.created_at))
        elif sort == RentalPricingSort.CREATED_DESC:
            query = query.order_by(desc(RentalPricing.created_at))
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        
        # Execute queries
        result = await db.execute(query)
        count_result = await db.execute(count_query)
        
        items = result.scalars().all()
        total = count_result.scalar_one()
        
        return items, total
    
    async def get_pricing_summary_by_items(
        self,
        db: AsyncSession,
        item_ids: List[UUID]
    ) -> Dict[UUID, Dict[str, Any]]:
        """
        Get pricing summary for multiple items.
        
        Args:
            db: Database session
            item_ids: List of item IDs
            
        Returns:
            Dictionary mapping item_id to pricing summary
        """
        query = select(RentalPricing).where(
            and_(
                RentalPricing.item_id.in_(item_ids),
                RentalPricing.is_active == True
            )
        ).order_by(RentalPricing.item_id, RentalPricing.priority)
        
        result = await db.execute(query)
        all_pricing = result.scalars().all()
        
        # Group by item_id
        summary = {}
        for pricing in all_pricing:
            item_id = pricing.item_id
            if item_id not in summary:
                summary[item_id] = {
                    'default_tier': None,
                    'available_tiers': [],
                    'daily_rate_range': [None, None],
                    'has_tiered_pricing': False
                }
            
            summary[item_id]['available_tiers'].append(pricing)
            
            # Track default tier
            if pricing.is_default:
                summary[item_id]['default_tier'] = pricing
            
            # Update daily rate range
            daily_rate = pricing.get_daily_equivalent_rate()
            if summary[item_id]['daily_rate_range'][0] is None or daily_rate < summary[item_id]['daily_rate_range'][0]:
                summary[item_id]['daily_rate_range'][0] = daily_rate
            if summary[item_id]['daily_rate_range'][1] is None or daily_rate > summary[item_id]['daily_rate_range'][1]:
                summary[item_id]['daily_rate_range'][1] = daily_rate
        
        # Determine if items have tiered pricing
        for item_id, data in summary.items():
            data['has_tiered_pricing'] = len(data['available_tiers']) > 1
        
        return summary
    
    async def delete_by_item(
        self,
        db: AsyncSession,
        item_id: UUID
    ) -> int:
        """
        Delete all pricing tiers for an item.
        
        Args:
            db: Database session
            item_id: Item ID
            
        Returns:
            Number of deleted pricing tiers
        """
        result = await db.execute(
            delete(RentalPricing).where(RentalPricing.item_id == item_id)
        )
        await db.commit()
        return result.rowcount


# Create singleton instance
rental_pricing_crud = RentalPricingCRUD(RentalPricing)