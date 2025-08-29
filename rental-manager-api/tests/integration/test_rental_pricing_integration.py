"""
Integration tests for Rental Pricing system.

Tests the complete flow from API endpoints through service layer to database.
"""

import pytest
from decimal import Decimal
from datetime import date, timedelta
from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item import Item
from app.models.rental_pricing import RentalPricing
from app.services.rental_pricing_service import RentalPricingService
from app.schemas.rental_pricing import (
    RentalPricingCreate,
    StandardPricingTemplate,
    RentalPricingUpdate
)


@pytest.mark.asyncio
class TestRentalPricingIntegration:
    """Integration tests for rental pricing functionality."""
    
    async def test_complete_pricing_workflow(self, db_session: AsyncSession, test_item: Item):
        """Test complete workflow: create, calculate, update, delete pricing."""
        service = RentalPricingService(db_session)
        
        # 1. Create standard pricing template
        template = StandardPricingTemplate(
            daily_rate=Decimal("50.00"),
            weekly_discount_percentage=Decimal("15"),
            monthly_discount_percentage=Decimal("30")
        )
        
        pricing_tiers = await service.create_standard_pricing(
            test_item.id,
            template,
            created_by="test_user"
        )
        
        assert len(pricing_tiers) == 3  # Daily, Weekly, Monthly
        assert pricing_tiers[0].tier_name == "Daily Rate"
        assert pricing_tiers[1].tier_name == "Weekly Rate"
        assert pricing_tiers[2].tier_name == "Monthly Rate"
        
        # 2. Calculate pricing for different durations
        # Test daily rate (3 days)
        calc_3_days = await service.calculate_rental_pricing(
            test_item.id,
            rental_days=3
        )
        assert calc_3_days.total_cost == Decimal("150.00")  # 3 * 50
        assert calc_3_days.recommended_tier.tier_name == "Daily Rate"
        
        # Test weekly rate (7 days)
        calc_7_days = await service.calculate_rental_pricing(
            test_item.id,
            rental_days=7
        )
        expected_weekly = Decimal("50.00") * 7 * Decimal("0.85")  # 15% discount
        assert calc_7_days.total_cost == expected_weekly
        assert calc_7_days.recommended_tier.tier_name == "Weekly Rate"
        assert calc_7_days.savings_compared_to_daily > 0
        
        # Test monthly rate (30 days)
        calc_30_days = await service.calculate_rental_pricing(
            test_item.id,
            rental_days=30
        )
        expected_monthly = Decimal("50.00") * 30 * Decimal("0.70")  # 30% discount
        assert calc_30_days.total_cost == expected_monthly
        assert calc_30_days.recommended_tier.tier_name == "Monthly Rate"
        
        # 3. Update a pricing tier
        daily_tier = pricing_tiers[0]
        updated_tier = await service.update_pricing_tier(
            daily_tier.id,
            RentalPricingUpdate(rate_per_period=Decimal("55.00")),
            updated_by="test_user"
        )
        assert updated_tier.rate_per_period == Decimal("55.00")
        
        # 4. Verify updated calculation
        calc_updated = await service.calculate_rental_pricing(
            test_item.id,
            rental_days=3
        )
        assert calc_updated.total_cost == Decimal("165.00")  # 3 * 55
        
        # 5. Delete a tier (not the last one)
        success = await service.delete_pricing_tier(pricing_tiers[2].id)  # Delete monthly
        assert success is True
        
        # 6. Verify tier was deleted
        remaining_tiers = await service.crud.get_by_item(db_session, test_item.id)
        assert len(remaining_tiers) == 2
        
    async def test_custom_pricing_tier_with_constraints(self, db_session: AsyncSession, test_item: Item):
        """Test custom pricing tier with min/max rental days constraints."""
        service = RentalPricingService(db_session)
        
        # Create weekend special pricing (2-3 days only)
        weekend_pricing = RentalPricingCreate(
            item_id=test_item.id,
            tier_name="Weekend Special",
            period_type="DAILY",
            period_days=1,
            rate_per_period=Decimal("40.00"),
            min_rental_days=2,
            max_rental_days=3,
            priority=50  # Higher priority
        )
        
        created_tier = await service.create_pricing_tier(
            test_item.id,
            weekend_pricing,
            created_by="test_user"
        )
        
        assert created_tier.min_rental_days == 2
        assert created_tier.max_rental_days == 3
        
        # Also create standard daily pricing
        standard_daily = RentalPricingCreate(
            item_id=test_item.id,
            tier_name="Standard Daily",
            period_type="DAILY",
            period_days=1,
            rate_per_period=Decimal("50.00"),
            priority=100
        )
        
        await service.create_pricing_tier(
            test_item.id,
            standard_daily,
            created_by="test_user"
        )
        
        # Test that weekend special is selected for 2-3 days
        calc_2_days = await service.calculate_rental_pricing(test_item.id, 2)
        assert calc_2_days.recommended_tier.tier_name == "Weekend Special"
        assert calc_2_days.total_cost == Decimal("80.00")  # 2 * 40
        
        # Test that standard daily is selected for 4 days
        calc_4_days = await service.calculate_rental_pricing(test_item.id, 4)
        assert calc_4_days.recommended_tier.tier_name == "Standard Daily"
        assert calc_4_days.total_cost == Decimal("200.00")  # 4 * 50
        
    async def test_pricing_priority_selection(self, db_session: AsyncSession, test_item: Item):
        """Test that pricing tiers are selected based on priority when multiple apply."""
        service = RentalPricingService(db_session)
        
        # Create two overlapping weekly rates with different priorities
        premium_weekly = RentalPricingCreate(
            item_id=test_item.id,
            tier_name="Premium Weekly",
            period_type="WEEKLY",
            period_days=7,
            rate_per_period=Decimal("280.00"),
            priority=10  # Higher priority (lower number)
        )
        
        standard_weekly = RentalPricingCreate(
            item_id=test_item.id,
            tier_name="Standard Weekly",
            period_type="WEEKLY",
            period_days=7,
            rate_per_period=Decimal("300.00"),
            priority=100  # Lower priority
        )
        
        await service.create_pricing_tier(test_item.id, premium_weekly, "test_user")
        await service.create_pricing_tier(test_item.id, standard_weekly, "test_user")
        
        # Calculate for 7 days - should select premium (better priority and price)
        calc = await service.calculate_rental_pricing(test_item.id, 7)
        assert calc.recommended_tier.tier_name == "Premium Weekly"
        assert calc.total_cost == Decimal("280.00")
        
    async def test_seasonal_pricing(self, db_session: AsyncSession, test_item: Item):
        """Test pricing with effective and expiry dates."""
        service = RentalPricingService(db_session)
        
        today = date.today()
        
        # Create summer special (active)
        summer_pricing = RentalPricingCreate(
            item_id=test_item.id,
            tier_name="Summer Special",
            period_type="DAILY",
            period_days=1,
            rate_per_period=Decimal("35.00"),
            effective_date=today - timedelta(days=10),
            expiry_date=today + timedelta(days=20),
            priority=50
        )
        
        # Create expired winter pricing
        winter_pricing = RentalPricingCreate(
            item_id=test_item.id,
            tier_name="Winter Rate",
            period_type="DAILY",
            period_days=1,
            rate_per_period=Decimal("25.00"),
            effective_date=today - timedelta(days=100),
            expiry_date=today - timedelta(days=1),  # Expired yesterday
            priority=50
        )
        
        await service.create_pricing_tier(test_item.id, summer_pricing, "test_user")
        await service.create_pricing_tier(test_item.id, winter_pricing, "test_user")
        
        # Calculate pricing - should only use summer special
        calc = await service.calculate_rental_pricing(
            test_item.id,
            rental_days=5,
            calculation_date=today
        )
        
        assert calc.recommended_tier.tier_name == "Summer Special"
        assert calc.total_cost == Decimal("175.00")  # 5 * 35
        
    async def test_bulk_pricing_optimization(self, db_session: AsyncSession, test_item: Item):
        """Test optimizing pricing for multiple items."""
        service = RentalPricingService(db_session)
        
        # Create another test item
        item2 = Item(
            id=uuid4(),
            item_name="Test Item 2",
            sku="TEST002",
            is_rentable=True,
            rental_rate_per_day=Decimal("30.00")
        )
        db_session.add(item2)
        await db_session.commit()
        
        # Create pricing for both items
        for item_id, daily_rate in [(test_item.id, 50), (item2.id, 30)]:
            template = StandardPricingTemplate(
                daily_rate=Decimal(str(daily_rate)),
                weekly_discount_percentage=Decimal("10"),
                monthly_discount_percentage=Decimal("25")
            )
            await service.create_standard_pricing(item_id, template, "test_user")
        
        # Optimize pricing for both items for 10 days
        results = await service.optimize_pricing_for_duration(
            [test_item.id, item2.id],
            rental_days=10
        )
        
        assert len(results) == 2
        assert test_item.id in results
        assert item2.id in results
        
        # Verify calculations
        assert results[test_item.id].rental_days == 10
        assert results[item2.id].rental_days == 10
        
    async def test_pricing_summary_aggregation(self, db_session: AsyncSession, test_item: Item):
        """Test getting pricing summary for an item."""
        service = RentalPricingService(db_session)
        
        # Create multiple pricing tiers
        template = StandardPricingTemplate(
            daily_rate=Decimal("50.00"),
            weekly_discount_percentage=Decimal("15"),
            monthly_discount_percentage=Decimal("30")
        )
        await service.create_standard_pricing(test_item.id, template, "test_user")
        
        # Get pricing summary
        summary = await service.get_item_pricing_summary(test_item.id)
        
        assert summary.item_id == test_item.id
        assert summary.has_tiered_pricing is True
        assert len(summary.available_tiers) == 3
        
        # Check daily rate range
        min_rate, max_rate = summary.daily_rate_range
        assert min_rate == Decimal("35.00")  # Monthly tier daily equivalent
        assert max_rate == Decimal("50.00")  # Daily tier rate
        
        # Verify default tier
        assert summary.default_tier is not None
        assert summary.default_tier.is_default is True
        
    async def test_migration_from_simple_pricing(self, db_session: AsyncSession):
        """Test migrating an item from simple daily rate to structured pricing."""
        service = RentalPricingService(db_session)
        
        # Create item with only daily rate
        item = Item(
            id=uuid4(),
            item_name="Legacy Item",
            sku="LEGACY001",
            is_rentable=True,
            rental_rate_per_day=Decimal("75.00")
        )
        db_session.add(item)
        await db_session.commit()
        
        # Migrate to structured pricing
        pricing_tiers = await service.migrate_item_pricing(
            item.id,
            created_by="migration_user"
        )
        
        assert len(pricing_tiers) == 3
        
        # Verify daily tier matches original rate
        daily_tier = next(t for t in pricing_tiers if t.tier_name == "Daily Rate")
        assert daily_tier.rate_per_period == Decimal("75.00")
        
        # Verify discounts were applied
        weekly_tier = next(t for t in pricing_tiers if t.tier_name == "Weekly Rate")
        expected_weekly = Decimal("75.00") * 7 * Decimal("0.90")  # 10% discount
        assert weekly_tier.rate_per_period == expected_weekly
        
    async def test_error_handling_no_pricing(self, db_session: AsyncSession, test_item: Item):
        """Test error handling when no pricing is configured."""
        service = RentalPricingService(db_session)
        
        # Ensure item has no rental_rate_per_day
        test_item.rental_rate_per_day = None
        await db_session.commit()
        
        # Try to calculate pricing - should raise NotFoundError
        with pytest.raises(Exception) as exc_info:
            await service.calculate_rental_pricing(test_item.id, 5)
        
        assert "No applicable pricing found" in str(exc_info.value)
        
    async def test_concurrent_pricing_updates(self, db_session: AsyncSession, test_item: Item):
        """Test handling concurrent updates to pricing tiers."""
        service = RentalPricingService(db_session)
        
        # Create initial pricing
        template = StandardPricingTemplate(
            daily_rate=Decimal("50.00"),
            weekly_discount_percentage=Decimal("10"),
            monthly_discount_percentage=Decimal("20")
        )
        tiers = await service.create_standard_pricing(test_item.id, template, "user1")
        
        # Simulate concurrent updates
        tier_id = tiers[0].id
        
        # Update 1: Change rate
        await service.update_pricing_tier(
            tier_id,
            RentalPricingUpdate(rate_per_period=Decimal("55.00")),
            "user1"
        )
        
        # Update 2: Set as default
        await service.update_pricing_tier(
            tier_id,
            RentalPricingUpdate(is_default=True),
            "user2"
        )
        
        # Verify final state
        updated_tier = await service.crud.get(db_session, tier_id)
        assert updated_tier.rate_per_period == Decimal("55.00")
        assert updated_tier.is_default is True


@pytest.fixture
async def test_item(db_session: AsyncSession) -> Item:
    """Create a test item for pricing tests."""
    item = Item(
        id=uuid4(),
        item_name="Test Rental Item",
        sku="TEST001",
        is_rentable=True,
        rental_rate_per_day=Decimal("50.00"),
        is_active=True
    )
    db_session.add(item)
    await db_session.commit()
    return item