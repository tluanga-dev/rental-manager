#!/usr/bin/env python3
"""
Hierarchical Brand Data Generator for 4-Tier Category System

Generates 1000 main categories with subcategories, equipment types, and brand items.
Total: ~100,000 brand items across 4 hierarchical tiers.
"""

import asyncio
import random
import string
import time
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple
from uuid import uuid4
import hashlib

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

from app.core.config import settings
from app.models.brand import Brand


class HierarchicalBrandGenerator:
    """Generates hierarchical brand data with 4 tiers."""
    
    def __init__(self):
        self.generated_names = set()
        self.generated_codes = set()
        self.hierarchy_data = []
        self.brands_flat = []
        self.statistics = {}
        
        # Main categories (Tier 1) - 1000 categories
        self.main_categories = [
            # Construction & Heavy Equipment (200 categories)
            "Excavation Equipment", "Earthmoving Machinery", "Cranes & Lifting", 
            "Concrete Equipment", "Compaction Equipment", "Demolition Tools",
            "Road Construction", "Mining Equipment", "Tunneling Equipment",
            "Foundation Equipment", "Pile Driving", "Drilling Equipment",
            "Material Handling", "Conveyor Systems", "Hoisting Equipment",
            "Scaffolding Systems", "Formwork Equipment", "Rebar Equipment",
            "Surveying Equipment", "Grade Control", "Site Preparation",
            
            # Power Tools & Hand Tools (150 categories)
            "Drilling Tools", "Cutting Tools", "Grinding Equipment",
            "Sanding Tools", "Welding Equipment", "Soldering Tools",
            "Measuring Tools", "Precision Instruments", "Hand Tools",
            "Pneumatic Tools", "Hydraulic Tools", "Battery Tools",
            "Corded Tools", "Specialty Tools", "Workshop Equipment",
            "Tool Storage", "Tool Accessories", "Safety Tools",
            
            # Audio Visual Equipment (150 categories)
            "Sound Systems", "PA Equipment", "Recording Equipment",
            "Mixing Consoles", "Microphones", "Speakers & Monitors",
            "Amplifiers", "Signal Processors", "DJ Equipment",
            "Lighting Controllers", "Stage Lighting", "LED Systems",
            "Video Equipment", "Projection Systems", "Display Screens",
            "Camera Equipment", "Broadcasting Equipment", "Studio Equipment",
            
            # Kitchen & Restaurant Equipment (150 categories)
            "Cooking Equipment", "Refrigeration Units", "Food Prep Equipment",
            "Dishwashing Systems", "Storage Solutions", "Serving Equipment",
            "Beverage Equipment", "Coffee Machines", "Bar Equipment",
            "Bakery Equipment", "Pizza Equipment", "Grill Equipment",
            "Fryers", "Steamers", "Warming Equipment", "Ice Machines",
            "Ventilation Systems", "Kitchen Safety", "Sanitation Equipment",
            
            # Event & Entertainment (100 categories)
            "Tents & Canopies", "Staging Equipment", "Seating Systems",
            "Crowd Control", "Event Lighting", "Event Audio", "Event Video",
            "Decoration Equipment", "Climate Control", "Power Distribution",
            "Cable Management", "Rigging Equipment", "Special Effects",
            "Interactive Displays", "Registration Systems", "Communication Equipment",
            
            # Transportation & Vehicles (100 categories)
            "Trucks & Vans", "Trailers", "Forklifts", "Aerial Lifts",
            "Scissor Lifts", "Boom Lifts", "Telehandlers", "Skid Steers",
            "Utility Vehicles", "Golf Carts", "ATVs", "Material Carts",
            "Dollies & Handtrucks", "Pallet Jacks", "Order Pickers",
            
            # Safety & Protection (75 categories)
            "Personal Protection", "Fall Protection", "Head Protection",
            "Eye Protection", "Hearing Protection", "Respiratory Protection",
            "Hand Protection", "Foot Protection", "High Visibility",
            "Fire Safety", "Emergency Equipment", "First Aid", "Safety Signs",
            "Barriers & Fencing", "Traffic Control", "Spill Control",
            
            # Cleaning & Maintenance (75 categories)
            "Pressure Washers", "Floor Cleaners", "Carpet Cleaners",
            "Window Cleaning", "Vacuum Systems", "Sweepers", "Scrubbers",
            "Cleaning Chemicals", "Maintenance Tools", "Lubricants",
            "Parts Washers", "Steam Cleaners", "Sanitizing Equipment",
        ]
        
        # Extend to 1000 categories by adding variations
        self._extend_categories()
        
    def _extend_categories(self):
        """Extend categories to reach 1000 unique categories."""
        prefixes = ["Professional", "Industrial", "Commercial", "Heavy Duty", 
                   "Specialty", "Advanced", "Premium", "Standard", "Compact", "Portable"]
        suffixes = ["Systems", "Solutions", "Equipment", "Tools", "Machinery", 
                   "Devices", "Units", "Appliances", "Instruments", "Apparatus"]
        
        base_count = len(self.main_categories)
        while len(self.main_categories) < 1000:
            base_category = self.main_categories[random.randint(0, base_count - 1)]
            
            # Create variations
            if random.random() < 0.5:
                new_category = f"{random.choice(prefixes)} {base_category}"
            else:
                # Replace last word with suffix
                words = base_category.split()
                if len(words) > 1:
                    words[-1] = random.choice(suffixes)
                    new_category = " ".join(words)
                else:
                    new_category = f"{base_category} {random.choice(suffixes)}"
            
            if new_category not in self.main_categories:
                self.main_categories.append(new_category)
    
    def generate_subcategories(self, category: str) -> List[str]:
        """Generate 3-7 subcategories for a main category (Tier 2)."""
        count = random.randint(3, 7)
        subcategories = []
        
        # Category-specific subcategories
        sub_prefixes = ["Light", "Medium", "Heavy", "Compact", "Full-Size", 
                       "Portable", "Stationary", "Mobile", "Fixed", "Modular"]
        sub_types = ["Duty", "Grade", "Performance", "Capacity", "Range",
                    "Series", "Class", "Type", "Model", "Version"]
        
        for i in range(count):
            if random.random() < 0.7:
                # Use structured naming
                subcat = f"{random.choice(sub_prefixes)} {random.choice(sub_types)} {category}"
            else:
                # Use specific naming based on category
                words = category.split()
                if len(words) > 1:
                    subcat = f"{words[0]} {random.choice(sub_types)} {i+1}"
                else:
                    subcat = f"{category} {random.choice(sub_types)} {i+1}"
            
            subcategories.append(subcat[:100])  # Limit length
        
        return subcategories
    
    def generate_equipment_types(self, subcategory: str) -> List[str]:
        """Generate 2-8 equipment types for a subcategory (Tier 3)."""
        count = random.randint(2, 8)
        equipment_types = []
        
        # Equipment-specific terms
        equipment_terms = ["Unit", "System", "Machine", "Device", "Tool",
                          "Apparatus", "Station", "Module", "Kit", "Set"]
        
        size_terms = ["10", "20", "50", "100", "200", "500", "1000",
                     "XS", "S", "M", "L", "XL", "XXL", "Compact", "Standard", "Large"]
        
        for i in range(count):
            # Generate unique equipment type
            size = random.choice(size_terms)
            term = random.choice(equipment_terms)
            
            if random.random() < 0.6:
                equip_type = f"{subcategory} {size} {term}"
            else:
                # Simplified version
                equip_type = f"{size} {term} #{i+1}"
            
            equipment_types.append(equip_type[:100])
        
        return equipment_types
    
    def generate_brand_items(self, equipment_type: str, tier_path: List[str]) -> List[Dict[str, Any]]:
        """Generate 3-10 brand items for an equipment type (Tier 4)."""
        count = random.randint(3, 10)
        items = []
        
        # Popular brand names for equipment
        brand_names = [
            "TechPro", "PowerMax", "EliteForce", "ProGrade", "MegaTool",
            "UltraEquip", "PrimeTech", "MaxPower", "SuperDuty", "HeavyLift",
            "QuickWork", "EasyUse", "SmartTool", "EcoGreen", "SafeGuard",
            "TurboCharge", "RapidAction", "PrecisionPro", "DuraLast", "FlexiGrip"
        ]
        
        # Model patterns
        model_patterns = ["X", "Z", "Q", "P", "T", "R", "S", "M", "N", "K"]
        
        for i in range(count):
            # Generate unique brand name
            brand_base = random.choice(brand_names)
            model_letter = random.choice(model_patterns)
            model_number = random.randint(100, 9999)
            
            # Create hierarchical name showing the path
            name = f"{brand_base} {model_letter}{model_number}"
            
            # Generate unique code based on hierarchy
            code_parts = []
            for j, tier in enumerate(tier_path):
                # Take first 2-3 chars of each tier
                clean_tier = ''.join(c for c in tier[:3] if c.isalnum()).upper()
                code_parts.append(clean_tier)
            code_parts.append(f"{model_letter}{model_number}")
            code = "-".join(code_parts)[:20]  # Limit code length
            
            # Ensure uniqueness
            while name in self.generated_names:
                model_number += 1
                name = f"{brand_base} {model_letter}{model_number}"
            
            while code in self.generated_codes:
                code = f"{code}-{random.randint(10, 99)}"[:20]
            
            self.generated_names.add(name)
            self.generated_codes.add(code)
            
            # Generate description with hierarchy context
            description = self._generate_hierarchical_description(name, tier_path, equipment_type)
            
            # Create brand item
            item = {
                "name": name,
                "code": code,
                "description": description,
                "is_active": random.random() > 0.2,  # 80% active
                "hierarchy": {
                    "tier1": tier_path[0] if len(tier_path) > 0 else None,
                    "tier2": tier_path[1] if len(tier_path) > 1 else None,
                    "tier3": tier_path[2] if len(tier_path) > 2 else None,
                    "tier4": name
                },
                "metadata": {
                    "category_path": " > ".join(tier_path),
                    "equipment_type": equipment_type,
                    "tier_level": 4,
                    "generation_timestamp": datetime.now().isoformat()
                }
            }
            
            items.append(item)
        
        return items
    
    def _generate_hierarchical_description(self, name: str, tier_path: List[str], equipment_type: str) -> str:
        """Generate description that reflects the hierarchical position."""
        templates = [
            f"{name} is a professional-grade {equipment_type} in the {tier_path[0]} category",
            f"Part of our {tier_path[1] if len(tier_path) > 1 else 'premium'} line, {name} delivers exceptional performance",
            f"Designed for {tier_path[0]} applications, {name} offers reliability and durability",
            f"{name}: Industry-leading {equipment_type} for demanding {tier_path[0]} projects",
            f"The {name} represents the pinnacle of {tier_path[2] if len(tier_path) > 2 else 'modern'} technology"
        ]
        
        description = random.choice(templates)
        
        # Add features
        features = [
            "heavy-duty construction", "ergonomic design", "energy efficient",
            "low maintenance", "high performance", "safety certified",
            "weather resistant", "compact design", "easy operation",
            "extended warranty", "professional grade", "commercial quality"
        ]
        
        if random.random() < 0.7:
            selected_features = random.sample(features, random.randint(2, 4))
            description += f". Features: {', '.join(selected_features)}"
        
        # Add specifications for some items
        if random.random() < 0.5:
            specs = []
            if "Power" in equipment_type or "Electric" in equipment_type:
                specs.append(f"Power: {random.randint(500, 5000)}W")
            if "Weight" not in description:
                specs.append(f"Weight: {random.randint(5, 500)}kg")
            if "Capacity" not in description:
                specs.append(f"Capacity: {random.randint(10, 1000)}L")
            
            if specs:
                description += f". Specifications: {', '.join(specs[:2])}"
        
        return description[:1000]  # Limit to database constraint
    
    def generate_hierarchical_data(self) -> Tuple[List[Dict], Dict[str, Any]]:
        """Generate complete hierarchical dataset."""
        print("🏗️ Generating Hierarchical Brand Data Structure")
        print(f"Target: 1000 categories, 4 tiers, ~100,000 items")
        print("=" * 60)
        
        start_time = time.time()
        
        # Statistics tracking
        total_subcategories = 0
        total_equipment_types = 0
        total_brand_items = 0
        tier_distribution = {1: 0, 2: 0, 3: 0, 4: 0}
        
        # Generate hierarchical structure
        for cat_idx, main_category in enumerate(self.main_categories):
            if cat_idx % 100 == 0:
                print(f"Processing category {cat_idx + 1}/1000...")
            
            tier_distribution[1] += 1
            tier1_path = [main_category]
            
            # Generate subcategories (Tier 2)
            subcategories = self.generate_subcategories(main_category)
            total_subcategories += len(subcategories)
            
            for subcategory in subcategories:
                tier_distribution[2] += 1
                tier2_path = tier1_path + [subcategory]
                
                # Generate equipment types (Tier 3)
                equipment_types = self.generate_equipment_types(subcategory)
                total_equipment_types += len(equipment_types)
                
                for equipment_type in equipment_types:
                    tier_distribution[3] += 1
                    tier3_path = tier2_path + [equipment_type]
                    
                    # Generate brand items (Tier 4)
                    brand_items = self.generate_brand_items(equipment_type, tier3_path)
                    total_brand_items += len(brand_items)
                    tier_distribution[4] += len(brand_items)
                    
                    # Store items
                    for item in brand_items:
                        self.brands_flat.append(item)
                    
                    # Store hierarchy
                    self.hierarchy_data.append({
                        "path": tier3_path,
                        "equipment_type": equipment_type,
                        "items": brand_items
                    })
        
        generation_time = time.time() - start_time
        
        # Compile statistics
        self.statistics = {
            "generation_time": generation_time,
            "total_categories": len(self.main_categories),
            "total_subcategories": total_subcategories,
            "total_equipment_types": total_equipment_types,
            "total_brand_items": total_brand_items,
            "tier_distribution": tier_distribution,
            "avg_subcategories_per_category": total_subcategories / len(self.main_categories),
            "avg_types_per_subcategory": total_equipment_types / total_subcategories if total_subcategories > 0 else 0,
            "avg_items_per_type": total_brand_items / total_equipment_types if total_equipment_types > 0 else 0,
            "unique_names": len(self.generated_names),
            "unique_codes": len(self.generated_codes),
            "active_items": sum(1 for item in self.brands_flat if item["is_active"]),
            "inactive_items": sum(1 for item in self.brands_flat if not item["is_active"])
        }
        
        return self.brands_flat, self.statistics
    
    def print_statistics(self):
        """Print generation statistics."""
        if not self.statistics:
            print("No statistics available. Run generate_hierarchical_data() first.")
            return
        
        print("\n" + "=" * 60)
        print("📊 GENERATION STATISTICS")
        print("=" * 60)
        
        stats = self.statistics
        print(f"⏱️  Generation Time: {stats['generation_time']:.2f} seconds")
        print(f"\n🏗️ Hierarchy Structure:")
        print(f"  Tier 1 (Categories):     {stats['tier_distribution'][1]:,}")
        print(f"  Tier 2 (Subcategories):  {stats['tier_distribution'][2]:,}")
        print(f"  Tier 3 (Equipment Types): {stats['tier_distribution'][3]:,}")
        print(f"  Tier 4 (Brand Items):    {stats['tier_distribution'][4]:,}")
        
        print(f"\n📈 Averages:")
        print(f"  Subcategories per Category: {stats['avg_subcategories_per_category']:.1f}")
        print(f"  Types per Subcategory:      {stats['avg_types_per_subcategory']:.1f}")
        print(f"  Items per Type:              {stats['avg_items_per_type']:.1f}")
        
        print(f"\n✅ Data Quality:")
        print(f"  Unique Names:  {stats['unique_names']:,}")
        print(f"  Unique Codes:  {stats['unique_codes']:,}")
        print(f"  Active Items:  {stats['active_items']:,} ({stats['active_items']/stats['total_brand_items']*100:.1f}%)")
        print(f"  Inactive Items: {stats['inactive_items']:,} ({stats['inactive_items']/stats['total_brand_items']*100:.1f}%)")
        
        print(f"\n🎯 Total Brand Items Generated: {stats['total_brand_items']:,}")
    
    def save_to_json(self, filename: str = "hierarchical_brand_data.json"):
        """Save generated data to JSON file."""
        output = {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "statistics": self.statistics
            },
            "brands": self.brands_flat,
            "hierarchy": self.hierarchy_data
        }
        
        with open(filename, 'w') as f:
            json.dump(output, f, indent=2, default=str)
        
        print(f"\n💾 Data saved to {filename}")
        print(f"  File size: {os.path.getsize(filename) / (1024*1024):.2f} MB")


async def insert_hierarchical_brands(brands_data: List[Dict[str, Any]], batch_size: int = 500):
    """Insert hierarchical brand data into database."""
    print(f"\n💾 Inserting {len(brands_data)} hierarchical brands into database...")
    
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        pool_size=30,
        max_overflow=40
    )
    
    AsyncSessionLocal = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    start_time = time.time()
    total_inserted = 0
    failed_inserts = []
    
    try:
        async with AsyncSessionLocal() as session:
            for i in range(0, len(brands_data), batch_size):
                batch = brands_data[i:i + batch_size]
                batch_start = time.time()
                
                try:
                    # Create Brand objects
                    brand_objects = []
                    for brand_data in batch:
                        # Extract base brand data (without hierarchy metadata)
                        brand_obj_data = {
                            "name": brand_data["name"],
                            "code": brand_data["code"],
                            "description": brand_data["description"],
                            "is_active": brand_data["is_active"],
                            "created_by": "hierarchical_generator",
                            "updated_by": "hierarchical_generator"
                        }
                        
                        brand = Brand(**brand_obj_data)
                        brand_objects.append(brand)
                    
                    session.add_all(brand_objects)
                    await session.commit()
                    
                    batch_time = time.time() - batch_start
                    total_inserted += len(batch)
                    
                    print(f"  ✅ Batch {i//batch_size + 1}: {len(batch)} brands in {batch_time:.2f}s")
                    
                except Exception as e:
                    print(f"  ❌ Batch {i//batch_size + 1} failed: {str(e)}")
                    failed_inserts.extend(batch)
                    await session.rollback()
        
        total_time = time.time() - start_time
        
        print("\n" + "=" * 60)
        print("📊 INSERTION SUMMARY")
        print("=" * 60)
        print(f"✅ Successfully inserted: {total_inserted:,} brands")
        if failed_inserts:
            print(f"❌ Failed insertions: {len(failed_inserts):,} brands")
        print(f"⏱️  Total time: {total_time:.2f} seconds")
        print(f"⚡ Throughput: {total_inserted/total_time:.1f} brands/second")
        
    except Exception as e:
        print(f"❌ Critical error during insertion: {e}")
        raise
    finally:
        await engine.dispose()
    
    return total_inserted, failed_inserts


async def verify_hierarchical_data(expected_count: int):
    """Verify the hierarchical data insertion."""
    print(f"\n🔍 Verifying hierarchical data insertion...")
    
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession)
    
    try:
        async with AsyncSessionLocal() as session:
            # Basic counts
            result = await session.execute(text("SELECT COUNT(*) FROM brands"))
            total_count = result.scalar()
            
            result = await session.execute(text("SELECT COUNT(*) FROM brands WHERE is_active = true"))
            active_count = result.scalar()
            
            # Sample queries to verify data structure
            result = await session.execute(text("""
                SELECT name, code, LENGTH(description) as desc_length
                FROM brands
                ORDER BY RANDOM()
                LIMIT 10
            """))
            samples = result.fetchall()
            
            # Check for code patterns
            result = await session.execute(text("""
                SELECT COUNT(*) FROM brands
                WHERE code LIKE '%-%'
            """))
            hyphenated_codes = result.scalar()
            
            print("\n✅ Verification Results:")
            print(f"  Total brands: {total_count:,}")
            print(f"  Active brands: {active_count:,}")
            print(f"  Inactive brands: {total_count - active_count:,}")
            print(f"  Brands with hyphenated codes: {hyphenated_codes:,}")
            
            print("\n📝 Sample entries:")
            for name, code, desc_len in samples[:5]:
                print(f"  • {name} [{code}] - Description: {desc_len} chars")
            
            success = total_count >= expected_count * 0.95  # Allow 5% tolerance
            
            if success:
                print(f"\n✅ Verification PASSED: {total_count:,} brands in database")
            else:
                print(f"\n❌ Verification FAILED: Expected ~{expected_count:,}, found {total_count:,}")
            
            return success
            
    except Exception as e:
        print(f"❌ Error during verification: {e}")
        return False
    finally:
        await engine.dispose()


async def cleanup_test_data():
    """Clean up test data from previous runs."""
    print("\n🧹 Cleaning up previous test data...")
    
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession)
    
    try:
        async with AsyncSessionLocal() as session:
            # Delete brands created by this generator
            result = await session.execute(text("""
                DELETE FROM brands 
                WHERE created_by = 'hierarchical_generator'
            """))
            await session.commit()
            
            deleted_count = result.rowcount
            print(f"  ✅ Deleted {deleted_count:,} test brands")
            
    except Exception as e:
        print(f"  ❌ Error during cleanup: {e}")
    finally:
        await engine.dispose()


async def main():
    """Main execution function."""
    print("\n" + "=" * 60)
    print("🚀 HIERARCHICAL BRAND DATA GENERATOR")
    print("=" * 60)
    print("Generating 4-tier hierarchical structure with 1000 categories")
    print("Target: ~100,000 brand items\n")
    
    # Optional: Clean up previous test data
    # await cleanup_test_data()
    
    # Generate hierarchical data
    generator = HierarchicalBrandGenerator()
    brands_data, statistics = generator.generate_hierarchical_data()
    
    # Print statistics
    generator.print_statistics()
    
    # Save to JSON for analysis
    generator.save_to_json("hierarchical_brand_data.json")
    
    # Insert into database
    inserted_count, failed = await insert_hierarchical_brands(brands_data)
    
    # Verify insertion
    await verify_hierarchical_data(len(brands_data))
    
    print("\n" + "=" * 60)
    print("🎯 GENERATION COMPLETE")
    print("=" * 60)
    print(f"✅ Generated: {len(brands_data):,} brand items")
    print(f"✅ Inserted: {inserted_count:,} brand items")
    if failed:
        print(f"❌ Failed: {len(failed):,} brand items")
    
    print("\n📋 Next Steps:")
    print("  1. Run unit tests: pytest tests/unit/test_brand_*.py")
    print("  2. Run integration tests: pytest tests/integration/")
    print("  3. Run performance tests: pytest tests/performance/")
    print("  4. Run load tests: docker-compose -f docker-compose.test.yml up")
    print("  5. View test reports: open test_results/report.html")


if __name__ == "__main__":
    import os
    import sys
    
    # Add project root to path
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    asyncio.run(main())