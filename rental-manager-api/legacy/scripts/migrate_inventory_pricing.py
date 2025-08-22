#!/usr/bin/env python3
"""
Script to migrate pricing and specification fields from Item model to existing InventoryUnit records.

This script:
1. Copies pricing fields (sale_price, rental_rate_per_period, etc.) from items to their inventory units
2. Sets default values for new batch tracking fields
3. Ensures backward compatibility
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, update, and_
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal

from app.core.database import AsyncSessionLocal
from app.modules.inventory.models import InventoryUnit
from app.modules.master_data.item_master.models import Item


async def migrate_inventory_pricing():
    """
    Migrate pricing and specification data from Item to InventoryUnit.
    """
    async with AsyncSessionLocal() as session:
        try:
            print("Starting inventory pricing migration...")
            print("-" * 50)
            
            # Get all items with their inventory units
            items_query = select(Item).where(Item.is_active == True)
            items_result = await session.execute(items_query)
            items = items_result.scalars().all()
            
            total_items = len(items)
            total_units_updated = 0
            
            print(f"Found {total_items} active items to process")
            print("-" * 50)
            
            for idx, item in enumerate(items, 1):
                # Get all inventory units for this item
                units_query = select(InventoryUnit).where(
                    and_(
                        InventoryUnit.item_id == str(item.id),
                        InventoryUnit.is_active == True
                    )
                )
                units_result = await session.execute(units_query)
                units = units_result.scalars().all()
                
                if not units:
                    print(f"[{idx}/{total_items}] Item '{item.item_name}' has no inventory units - skipping")
                    continue
                
                # Update each unit with item's pricing data
                for unit in units:
                    # Only update if the fields are not already set
                    needs_update = False
                    
                    if unit.sale_price is None and item.sale_price is not None:
                        unit.sale_price = item.sale_price
                        needs_update = True
                    
                    if unit.rental_rate_per_period is None and item.rental_rate_per_period is not None:
                        unit.rental_rate_per_period = item.rental_rate_per_period
                        needs_update = True
                    
                    if unit.rental_period == 1 and item.rental_period != 1:  # Default is 1
                        unit.rental_period = item.rental_period
                        needs_update = True
                    
                    if unit.security_deposit == Decimal("0.00") and item.security_deposit != Decimal("0.00"):
                        unit.security_deposit = item.security_deposit
                        needs_update = True
                    
                    if unit.model_number is None and item.model_number is not None:
                        unit.model_number = item.model_number
                        needs_update = True
                    
                    if unit.warranty_period_days == 0 and item.warranty_period_days != 0:
                        unit.warranty_period_days = item.warranty_period_days
                        needs_update = True
                        
                        # Calculate warranty expiry if purchase date exists
                        if unit.purchase_date and unit.warranty_period_days > 0:
                            from datetime import timedelta
                            unit.warranty_expiry = unit.purchase_date + timedelta(days=unit.warranty_period_days)
                    
                    # Set default batch tracking fields if not set
                    if unit.quantity == Decimal("1.00"):  # Default value
                        unit.quantity = Decimal("1.00")  # Each unit represents quantity of 1
                    
                    if needs_update:
                        unit.updated_at = datetime.utcnow()
                        total_units_updated += 1
                
                print(f"[{idx}/{total_items}] Updated {len(units)} units for item '{item.item_name}'")
            
            # Commit all changes
            await session.commit()
            
            print("-" * 50)
            print(f"✅ Migration completed successfully!")
            print(f"   - Processed {total_items} items")
            print(f"   - Updated {total_units_updated} inventory units")
            print("-" * 50)
            
        except Exception as e:
            print(f"❌ Migration failed: {str(e)}")
            await session.rollback()
            raise


async def verify_migration():
    """
    Verify that the migration was successful by checking a sample of inventory units.
    """
    async with AsyncSessionLocal() as session:
        try:
            print("\nVerifying migration...")
            print("-" * 50)
            
            # Check units with pricing data
            units_with_pricing = select(InventoryUnit).where(
                and_(
                    InventoryUnit.is_active == True,
                    InventoryUnit.sale_price.isnot(None)
                )
            ).limit(5)
            
            result = await session.execute(units_with_pricing)
            sample_units = result.scalars().all()
            
            if sample_units:
                print(f"Sample of migrated units (showing {len(sample_units)} units):")
                for unit in sample_units:
                    print(f"  - SKU: {unit.sku}")
                    print(f"    Sale Price: {unit.sale_price}")
                    print(f"    Rental Rate: {unit.rental_rate_per_period}")
                    print(f"    Security Deposit: {unit.security_deposit}")
                    print(f"    Model: {unit.model_number}")
                    print(f"    Warranty: {unit.warranty_period_days} days")
                    print()
            else:
                print("No units found with pricing data")
            
            # Count totals
            total_query = select(InventoryUnit).where(InventoryUnit.is_active == True)
            total_result = await session.execute(total_query)
            total_units = len(total_result.scalars().all())
            
            with_pricing_query = select(InventoryUnit).where(
                and_(
                    InventoryUnit.is_active == True,
                    InventoryUnit.sale_price.isnot(None)
                )
            )
            with_pricing_result = await session.execute(with_pricing_query)
            units_with_pricing_count = len(with_pricing_result.scalars().all())
            
            print("-" * 50)
            print(f"Migration Statistics:")
            print(f"  Total active inventory units: {total_units}")
            print(f"  Units with pricing data: {units_with_pricing_count}")
            print(f"  Coverage: {(units_with_pricing_count/total_units*100):.1f}%" if total_units > 0 else "N/A")
            print("-" * 50)
            
        except Exception as e:
            print(f"❌ Verification failed: {str(e)}")
            raise


async def main():
    """
    Main function to run the migration and verification.
    """
    print("=" * 50)
    print("INVENTORY PRICING MIGRATION SCRIPT")
    print("=" * 50)
    print()
    
    # Run migration
    await migrate_inventory_pricing()
    
    # Verify results
    await verify_migration()
    
    print("\n✅ All operations completed successfully!")


if __name__ == "__main__":
    asyncio.run(main())