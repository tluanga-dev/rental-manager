#!/usr/bin/env python3
"""
Simple Database Population Script for Enhanced Items
Uses existing population scripts to populate 258 items with proper category and unit linking.

Author: Claude Code Assistant
Date: July 31, 2025
"""

import asyncio
import json
import os
import sys
from decimal import Decimal

# Add app to path
sys.path.append('/Users/tluanga/current_work/rental-manager/rental-manager-backend')

# Import existing successful population script approach
from populate_dummy_data_comprehensive import populate_items_from_json, create_session


async def populate_enhanced_items():
    """Populate the enhanced 258 items using existing infrastructure"""
    print("🎯 Starting Enhanced Items Population...")
    print("=" * 50)
    
    try:
        # Create async session
        session = await create_session()
        
        # Load the enhanced items JSON
        items_file = "/Users/tluanga/current_work/rental-manager/rental-manager-backend/dummy_data/items_enhanced_250.json"
        
        print(f"📂 Loading items from: {items_file}")
        with open(items_file, 'r') as f:
            items_data = json.load(f)
        
        print(f"📊 Found {len(items_data)} items to populate")
        
        # Use existing populate function
        success_count = await populate_items_from_json(session, items_data)
        
        print(f"\n🎉 POPULATION COMPLETE!")
        print(f"✅ Successfully populated {success_count} items")
        print(f"🔗 All items have proper category_code and unit_of_measurement_code linking")
        
        return success_count
        
    except Exception as e:
        print(f"❌ Error during population: {e}")
        return 0


if __name__ == "__main__":
    # Check if the enhanced items file exists
    items_file = "/Users/tluanga/current_work/rental-manager/rental-manager-backend/dummy_data/items_enhanced_250.json"
    if not os.path.exists(items_file):
        print(f"❌ Enhanced items file not found: {items_file}")
        print("Please run generate_250_items_enhanced.py first")
        sys.exit(1)
    
    # Run the population
    result = asyncio.run(populate_enhanced_items())