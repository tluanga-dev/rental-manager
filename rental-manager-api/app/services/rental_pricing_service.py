"""
Rental Pricing Service - Business logic for rental pricing calculations and management.

This service handles complex pricing strategies, calculations, and optimization
for rental transactions while maintaining performance and flexibility.
"""

from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from datetime import date, datetime, timedelta
from decimal import Decimal
import logging
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload

from app.models.rental_pricing import RentalPricing, PricingStrategy, PeriodType
from app.models.item import Item
from app.crud.rental_pricing import rental_pricing_crud
from app.schemas.rental_pricing import (
    RentalPricingCreate, RentalPricingUpdate, RentalPricingCalculationResponse,
    RentalPricingResponse, StandardPricingTemplate, ItemRentalPricingSummary
)
from app.core.errors import NotFoundError, ValidationError, ConflictError

logger = logging.getLogger(__name__)


class PricingOptimizationStrategy(Enum):
    """Strategies for selecting optimal pricing."""
    LOWEST_COST = "LOWEST_COST"          # Select pricing with lowest total cost
    HIGHEST_MARGIN = "HIGHEST_MARGIN"    # Select pricing with highest profit margin
    BALANCED = "BALANCED"                # Balance between cost and margin
    CUSTOMER_FRIENDLY = "CUSTOMER_FRIENDLY"  # Prioritize customer savings


class RentalPricingService:
    """Service for rental pricing operations and calculations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.crud = rental_pricing_crud
    
    async def create_pricing_tier(
        self,
        item_id: UUID,
        pricing_data: RentalPricingCreate,
        created_by: Optional[str] = None
    ) -> RentalPricingResponse:
        """
        Create a new pricing tier for an item.
        
        Args:
            item_id: Item ID
            pricing_data: Pricing tier data
            created_by: User creating the pricing
            
        Returns:
            Created pricing tier
        """
        # Verify item exists and is rentable
        query = select(Item).where(Item.id == item_id)
        result = await self.session.execute(query)
        item = result.scalars().first()
        if not item:
            raise NotFoundError(f"Item not found: {item_id}")
        
        if not item.is_rentable:
            raise ValidationError(f"Item '{item.item_name}' is not configured for rental")
        
        # Set item_id in pricing data
        pricing_data.item_id = item_id
        
        # Create pricing tier
        db_pricing = await self.crud.create(self.session, obj_in=pricing_data, created_by=created_by)
        
        return RentalPricingResponse.model_validate(db_pricing)
    
    async def bulk_create_pricing(
        self,
        item_id: UUID,
        pricing_tiers: List[RentalPricingCreate],
        created_by: Optional[str] = None
    ) -> List[RentalPricingResponse]:
        """
        Create multiple pricing tiers for an item.
        
        Args:
            item_id: Item ID
            pricing_tiers: List of pricing tier data
            created_by: User creating the pricing
            
        Returns:
            List of created pricing tiers
        """
        # Verify item exists and is rentable
        query = select(Item).where(Item.id == item_id)
        result = await self.session.execute(query)
        item = result.scalars().first()
        if not item:
            raise NotFoundError(f"Item not found: {item_id}")
        
        if not item.is_rentable:
            raise ValidationError(f"Item '{item.item_name}' is not configured for rental")
        
        # Set item_id for all pricing tiers
        for pricing in pricing_tiers:
            pricing.item_id = item_id
        
        # Create pricing tiers
        db_pricing_list = await self.crud.bulk_create(
            self.session, item_id, pricing_tiers, created_by
        )
        
        return [RentalPricingResponse.model_validate(pricing) for pricing in db_pricing_list]
    
    async def create_standard_pricing(
        self,
        item_id: UUID,
        template: StandardPricingTemplate,
        created_by: Optional[str] = None
    ) -> List[RentalPricingResponse]:
        """
        Create standard daily/weekly/monthly pricing for an item.
        
        Args:
            item_id: Item ID
            template: Standard pricing template
            created_by: User creating the pricing
            
        Returns:
            List of created pricing tiers
        """
        # Verify item exists and is rentable
        query = select(Item).where(Item.id == item_id)
        result = await self.session.execute(query)
        item = result.scalars().first()
        if not item:
            raise NotFoundError(f"Item not found: {item_id}")
        
        if not item.is_rentable:
            raise ValidationError(f"Item '{item.item_name}' is not configured for rental")
        
        # Create standard pricing structure
        db_pricing_list = await self.crud.create_standard_pricing(
            self.session, item_id, template, created_by
        )
        
        logger.info(
            f"Created standard pricing for item {item_id}: "
            f"{len(db_pricing_list)} tiers created"
        )
        
        return [RentalPricingResponse.model_validate(pricing) for pricing in db_pricing_list]
    
    async def calculate_rental_pricing(
        self,
        item_id: UUID,
        rental_days: int,
        calculation_date: Optional[date] = None,
        optimization_strategy: PricingOptimizationStrategy = PricingOptimizationStrategy.LOWEST_COST
    ) -> RentalPricingCalculationResponse:
        """
        Calculate optimal rental pricing for given duration.
        
        Args:
            item_id: Item ID
            rental_days: Rental duration in days
            calculation_date: Date for calculation
            optimization_strategy: Strategy for selecting optimal pricing
            
        Returns:
            Pricing calculation results
        """
        if calculation_date is None:
            calculation_date = date.today()
        
        # Get applicable pricing tiers
        applicable_tiers = await self.crud.get_applicable_pricing(
            self.session, item_id, rental_days, calculation_date
        )
        
        if not applicable_tiers:
            # Fallback to item's default daily rate if available
            query = select(Item).where(Item.id == item_id)
            result = await self.session.execute(query)
            item = result.scalars().first()
            if item and item.rental_rate_per_day:
                total_cost = item.rental_rate_per_day * rental_days
                return RentalPricingCalculationResponse(
                    item_id=item_id,
                    rental_days=rental_days,
                    applicable_tiers=[],
                    recommended_tier=None,
                    total_cost=total_cost,
                    daily_equivalent_rate=item.rental_rate_per_day,
                    savings_compared_to_daily=None
                )
            else:
                raise NotFoundError(f"No applicable pricing found for item {item_id} with {rental_days} days rental")
        
        # Convert to response objects
        tier_responses = [RentalPricingResponse.model_validate(tier) for tier in applicable_tiers]
        
        # Calculate costs and select recommended tier
        recommended_tier = None
        lowest_cost = None
        daily_baseline = None
        
        # Find daily rate for comparison
        daily_tier = next((t for t in applicable_tiers if t.period_days == 1), None)
        if daily_tier:
            daily_baseline = daily_tier.calculate_total_cost(rental_days)
        
        for tier in applicable_tiers:
            try:
                cost = tier.calculate_total_cost(rental_days)
                
                if optimization_strategy == PricingOptimizationStrategy.LOWEST_COST:
                    if lowest_cost is None or cost < lowest_cost:
                        lowest_cost = cost
                        recommended_tier = RentalPricingResponse.model_validate(tier)
                
            except ValueError as e:
                logger.warning(f"Could not calculate cost for tier {tier.id}: {e}")
                continue
        
        # If no recommended tier found, use first applicable tier
        if not recommended_tier and tier_responses:
            recommended_tier = tier_responses[0]
            lowest_cost = applicable_tiers[0].calculate_total_cost(rental_days)
        
        # Calculate savings compared to daily rate
        savings = None
        if daily_baseline and lowest_cost and daily_baseline > lowest_cost:
            savings = daily_baseline - lowest_cost
        
        return RentalPricingCalculationResponse(
            item_id=item_id,
            rental_days=rental_days,
            applicable_tiers=tier_responses,
            recommended_tier=recommended_tier,
            total_cost=lowest_cost or Decimal("0"),
            daily_equivalent_rate=lowest_cost / rental_days if lowest_cost else Decimal("0"),
            savings_compared_to_daily=savings
        )
    
    async def get_item_pricing_summary(
        self,
        item_id: UUID
    ) -> ItemRentalPricingSummary:
        """
        Get pricing summary for an item.
        
        Args:
            item_id: Item ID
            
        Returns:
            Item pricing summary
        """
        # Get all active pricing tiers
        pricing_tiers = await self.crud.get_by_item(self.session, item_id, include_inactive=False)
        
        if not pricing_tiers:
            raise NotFoundError(f"No pricing tiers found for item {item_id}")
        
        tier_responses = [RentalPricingResponse.model_validate(tier) for tier in pricing_tiers]
        
        # Find default tier
        default_tier = next((tier for tier in tier_responses if tier.is_default), None)
        
        # Calculate daily rate range
        daily_rates = [tier.daily_equivalent_rate for tier in tier_responses]
        daily_rate_range = (min(daily_rates), max(daily_rates))
        
        return ItemRentalPricingSummary(
            item_id=item_id,
            default_tier=default_tier,
            available_tiers=tier_responses,
            daily_rate_range=daily_rate_range,
            has_tiered_pricing=len(tier_responses) > 1
        )
    
    async def update_pricing_tier(
        self,
        pricing_id: UUID,
        update_data: RentalPricingUpdate,
        updated_by: Optional[str] = None
    ) -> RentalPricingResponse:
        """
        Update a pricing tier.
        
        Args:
            pricing_id: Pricing tier ID
            update_data: Update data
            updated_by: User updating the pricing
            
        Returns:
            Updated pricing tier
        """
        # Get existing pricing tier
        existing_pricing = await self.crud.get(self.session, pricing_id)
        if not existing_pricing:
            raise NotFoundError(f"Pricing tier not found: {pricing_id}")
        
        # Handle default tier changes
        if update_data.is_default is True and not existing_pricing.is_default:
            # Remove default from other tiers for this item
            await self.crud.update_default_pricing(
                self.session, existing_pricing.item_id, pricing_id
            )
            # Refresh to get updated data
            existing_pricing = await self.crud.get(self.session, pricing_id)
        
        # Update pricing tier
        updated_pricing = await self.crud.update(
            self.session, db_obj=existing_pricing, obj_in=update_data
        )
        
        return RentalPricingResponse.model_validate(updated_pricing)
    
    async def delete_pricing_tier(
        self,
        pricing_id: UUID
    ) -> bool:
        """
        Delete a pricing tier.
        
        Args:
            pricing_id: Pricing tier ID
            
        Returns:
            True if deleted successfully
        """
        # Get existing pricing tier
        existing_pricing = await self.crud.get(self.session, pricing_id)
        if not existing_pricing:
            raise NotFoundError(f"Pricing tier not found: {pricing_id}")
        
        # Check if this is the only tier for the item
        all_tiers = await self.crud.get_by_item(
            self.session, existing_pricing.item_id, include_inactive=False
        )
        
        if len(all_tiers) <= 1:
            raise ValidationError(
                "Cannot delete the last pricing tier for an item. "
                "Items must have at least one active pricing tier."
            )
        
        # If deleting the default tier, set another tier as default
        if existing_pricing.is_default:
            remaining_tiers = [t for t in all_tiers if t.id != pricing_id]
            if remaining_tiers:
                await self.crud.update_default_pricing(
                    self.session, existing_pricing.item_id, remaining_tiers[0].id
                )
        
        # Delete the pricing tier
        await self.crud.remove(self.session, id=pricing_id)
        
        logger.info(f"Deleted pricing tier {pricing_id}")
        return True
    
    async def optimize_pricing_for_duration(
        self,
        item_ids: List[UUID],
        rental_days: int,
        optimization_strategy: PricingOptimizationStrategy = PricingOptimizationStrategy.LOWEST_COST
    ) -> Dict[UUID, RentalPricingCalculationResponse]:
        """
        Optimize pricing for multiple items and a specific rental duration.
        
        Args:
            item_ids: List of item IDs
            rental_days: Rental duration
            optimization_strategy: Optimization strategy
            
        Returns:
            Dictionary mapping item_id to optimal pricing
        """
        results = {}
        
        for item_id in item_ids:
            try:
                pricing_result = await self.calculate_rental_pricing(
                    item_id, rental_days, optimization_strategy=optimization_strategy
                )
                results[item_id] = pricing_result
            except (NotFoundError, ValidationError) as e:
                logger.warning(f"Could not calculate pricing for item {item_id}: {e}")
                continue
        
        return results
    
    async def analyze_pricing_performance(
        self,
        item_id: UUID,
        start_date: date,
        end_date: date
    ) -> Dict[str, Any]:
        """
        Analyze pricing tier performance for an item.
        
        Args:
            item_id: Item ID
            start_date: Analysis start date
            end_date: Analysis end date
            
        Returns:
            Pricing performance analysis
        """
        # Get pricing tiers
        pricing_tiers = await self.crud.get_by_item(self.session, item_id)
        
        if not pricing_tiers:
            raise NotFoundError(f"No pricing tiers found for item {item_id}")
        
        # TODO: Implement analysis logic with transaction data
        # This would require integration with transaction/rental data
        
        analysis = {
            "item_id": item_id,
            "analysis_period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "total_tiers": len(pricing_tiers),
            "active_tiers": len([t for t in pricing_tiers if t.is_active]),
            "tier_details": [
                {
                    "tier_id": str(tier.id),
                    "tier_name": tier.tier_name,
                    "period_days": tier.period_days,
                    "rate_per_period": float(tier.rate_per_period),
                    "daily_equivalent": float(tier.get_daily_equivalent_rate()),
                    "is_default": tier.is_default,
                    "priority": tier.priority
                }
                for tier in pricing_tiers
            ]
        }
        
        return analysis
    
    async def migrate_item_pricing(
        self,
        item_id: UUID,
        daily_rate: Optional[Decimal] = None,
        created_by: Optional[str] = None
    ) -> List[RentalPricingResponse]:
        """
        Migrate an item from simple daily rate to structured pricing.
        
        Args:
            item_id: Item ID
            daily_rate: Daily rate to use (uses item's existing rate if not provided)
            created_by: User performing migration
            
        Returns:
            Created pricing tiers
        """
        # Get item
        query = select(Item).where(Item.id == item_id)
        result = await self.session.execute(query)
        item = result.scalars().first()
        if not item:
            raise NotFoundError(f"Item not found: {item_id}")
        
        # Check if pricing already exists
        existing_pricing = await self.crud.get_by_item(self.session, item_id)
        if existing_pricing:
            raise ConflictError(f"Item {item_id} already has structured pricing")
        
        # Use provided rate or item's existing rate
        if daily_rate is None:
            if not item.rental_rate_per_day:
                raise ValidationError(f"Item {item_id} has no daily rate to migrate")
            daily_rate = item.rental_rate_per_day
        
        # Create standard pricing structure
        template = StandardPricingTemplate(
            daily_rate=daily_rate,
            weekly_discount_percentage=Decimal("10"),    # 10% discount for weekly
            monthly_discount_percentage=Decimal("20")    # 20% discount for monthly
        )
        
        pricing_tiers = await self.create_standard_pricing(item_id, template, created_by)
        
        logger.info(f"Migrated item {item_id} from daily rate ${daily_rate} to structured pricing")
        
        return pricing_tiers


# Create service factory function
def get_rental_pricing_service(session: AsyncSession) -> RentalPricingService:
    """Factory function to create RentalPricingService instance."""
    return RentalPricingService(session)