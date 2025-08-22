#!/usr/bin/env python3
"""
Generate 1000 test items across 50+ categories for comprehensive testing.

This script creates a comprehensive dataset including:
- 50+ categories in hierarchical structure
- 20+ brands  
- 10+ units of measurement
- 1000 items distributed across categories
- Realistic pricing, descriptions, and properties
"""

import asyncio
import random
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4
from typing import List, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session_context
from app.crud.brand import BrandRepository
from app.crud.category import CategoryRepository
from app.crud.unit_of_measurement import UnitOfMeasurementRepository
from app.crud.item import ItemRepository
from app.services.sku_generator import SKUGenerator


class ItemDataGenerator:
    """Generate comprehensive test data for items."""
    
    # Category hierarchy with subcategories
    CATEGORIES = {
        "Electronics": [
            "Audio Equipment", "Video Equipment", "Lighting Equipment", 
            "Photography", "DJ Equipment", "Sound Systems", "Projectors",
            "LED Displays", "Cameras", "Recording Equipment"
        ],
        "Furniture": [
            "Tables", "Chairs", "Staging", "Lounge Furniture",
            "Bar Furniture", "Office Furniture", "Outdoor Furniture",
            "Storage Solutions", "Display Furniture", "Specialty Seating"
        ],
        "Event Equipment": [
            "Tents", "Canopies", "Flooring", "Staging Platforms",
            "Barriers", "Crowd Control", "Registration", "Signage",
            "Weather Protection", "Event Accessories"
        ],
        "Catering Equipment": [
            "Cooking Equipment", "Serving Equipment", "Food Warmers",
            "Beverage Dispensers", "Refrigeration", "Food Prep",
            "Dishware", "Glassware", "Cutlery", "Linens"
        ],
        "Party Supplies": [
            "Decorations", "Balloons", "Centerpieces", "Party Games",
            "Photo Booths", "Costumes", "Themed Decorations",
            "Lighting Effects", "Confetti Cannons", "Party Favors"
        ],
        "Sports Equipment": [
            "Outdoor Games", "Team Sports", "Water Sports", "Racing",
            "Fitness Equipment", "Recreation", "Competition",
            "Training Equipment", "Safety Gear", "Scoreboards"
        ]
    }
    
    # Brand names for different categories
    BRANDS = [
        "EventPro", "RentalMax", "ProStage", "AudioTech", "LightMaster",
        "FurnitureFirst", "PartyTime", "CateringPlus", "SportRent",
        "EliteEvents", "TechRental", "StageWorks", "SoundPro",
        "VideoVision", "PartyPerfect", "EventEssentials", "RentalPro",
        "QualityRentals", "PremiumEvents", "FlexiRent"
    ]
    
    # Units of measurement
    UNITS = [
        {"name": "Pieces", "code": "PCS"},
        {"name": "Sets", "code": "SET"},
        {"name": "Pairs", "code": "PAIR"},
        {"name": "Meters", "code": "M"},
        {"name": "Square Meters", "code": "SQM"},
        {"name": "Kilograms", "code": "KG"},
        {"name": "Liters", "code": "L"},
        {"name": "Hours", "code": "HR"},
        {"name": "Days", "code": "DAY"},
        {"name": "Linear Feet", "code": "LF"},
        {"name": "Cubic Meters", "code": "CBM"},
        {"name": "Packages", "code": "PKG"}
    ]
    
    # Item templates for different categories
    ITEM_TEMPLATES = {
        "Audio Equipment": {
            "names": ["Professional Speaker", "Microphone System", "Mixing Console", 
                     "Amplifier", "Wireless Mic", "Audio Interface", "Monitor Speaker",
                     "Subwoofer", "PA System", "Headphone Set"],
            "materials": ["Plastic", "Metal", "Composite"],
            "colors": ["Black", "Silver", "Gray", "White"]
        },
        "Tables": {
            "names": ["Round Table", "Rectangular Table", "Cocktail Table",
                     "Conference Table", "Folding Table", "Bar Table",
                     "Banquet Table", "Reception Table", "Display Table", "Bistro Table"],
            "materials": ["Wood", "Metal", "Plastic", "Glass"],
            "colors": ["Natural", "White", "Black", "Brown", "Silver"]
        },
        "Chairs": {
            "names": ["Folding Chair", "Chiavari Chair", "Banquet Chair",
                     "Bar Stool", "Lounge Chair", "Conference Chair",
                     "Garden Chair", "Stack Chair", "Executive Chair", "Dining Chair"],
            "materials": ["Wood", "Metal", "Plastic", "Fabric", "Leather"],
            "colors": ["White", "Black", "Brown", "Gold", "Silver", "Natural"]
        },
        "Tents": {
            "names": ["Pop-up Tent", "Frame Tent", "Pole Tent", "Party Tent",
                     "Wedding Tent", "Canopy Tent", "Marquee", "Pavilion",
                     "Shelter Tent", "Commercial Tent"],
            "materials": ["Canvas", "Vinyl", "Polyester", "PVC"],
            "colors": ["White", "Clear", "Striped", "Colored", "Custom"]
        },
        "Lighting Equipment": {
            "names": ["LED Light", "Spotlight", "Floodlight", "Stage Light",
                     "String Lights", "Uplighting", "Par Can", "Moving Head",
                     "Laser Light", "Strobe Light"],
            "materials": ["Metal", "Plastic", "Glass"],
            "colors": ["Black", "Silver", "White", "Colored"]
        }
    }
    
    def __init__(self, session: AsyncSession):
        """Initialize the data generator with database session."""
        self.session = session
        self.brand_repo = BrandRepository(session)
        self.category_repo = CategoryRepository(session)
        self.unit_repo = UnitOfMeasurementRepository(session)
        self.item_repo = ItemRepository(session)
        self.sku_generator = SKUGenerator(session)
        
        # Storage for created entities
        self.created_brands = {}
        self.created_categories = {}
        self.created_units = {}
        self.created_items = []
    
    async def generate_all_data(self) -> Dict[str, Any]:
        """Generate all test data including brands, categories, units, and items."""
        print("🚀 Starting comprehensive item data generation...")
        
        # Step 1: Create units of measurement
        print("📏 Creating units of measurement...")
        await self.create_units()
        
        # Step 2: Create brands
        print("🏷️ Creating brands...")
        await self.create_brands()
        
        # Step 3: Create category hierarchy
        print("📁 Creating category hierarchy...")
        await self.create_categories()
        
        # Step 4: Create 1000 items
        print("📦 Creating 1000 items across categories...")
        await self.create_items(1000)
        
        # Generate summary
        summary = await self.generate_summary()
        
        print("✅ Data generation complete!")
        print(f"📊 Summary: {summary}")
        
        return summary
    
    async def create_units(self):
        """Create units of measurement."""
        for unit_data in self.UNITS:
            try:
                unit = await self.unit_repo.create({
                    "name": unit_data["name"],
                    "code": unit_data["code"],
                    "description": f"Unit for measuring {unit_data['name'].lower()}",
                    "created_by": "test-generator",
                    "updated_by": "test-generator"
                })
                self.created_units[unit_data["name"]] = unit
                print(f"  ✓ Created unit: {unit_data['name']}")
            except Exception as e:
                print(f"  ❌ Failed to create unit {unit_data['name']}: {e}")
    
    async def create_brands(self):
        """Create brand entities."""
        for brand_name in self.BRANDS:
            try:
                brand = await self.brand_repo.create({
                    "name": brand_name,
                    "code": brand_name.upper()[:10],
                    "description": f"Professional rental equipment from {brand_name}",
                    "created_by": "test-generator",
                    "updated_by": "test-generator"
                })
                self.created_brands[brand_name] = brand
                print(f"  ✓ Created brand: {brand_name}")
            except Exception as e:
                print(f"  ❌ Failed to create brand {brand_name}: {e}")
    
    async def create_categories(self):
        """Create hierarchical category structure."""
        # Create main categories first
        for main_cat_name, subcategories in self.CATEGORIES.items():
            try:
                main_category = await self.category_repo.create({
                    "name": main_cat_name,
                    "category_code": main_cat_name.upper()[:10],
                    "parent_category_id": None,
                    "category_path": main_cat_name,
                    "category_level": 1,
                    "display_order": len(self.created_categories),
                    "is_leaf": False,
                    "created_by": "test-generator",
                    "updated_by": "test-generator"
                })
                self.created_categories[main_cat_name] = main_category
                print(f"  ✓ Created main category: {main_cat_name}")
                
                # Create subcategories
                for i, sub_cat_name in enumerate(subcategories):
                    try:
                        subcategory = await self.category_repo.create({
                            "name": sub_cat_name,
                            "category_code": f"{main_cat_name[:4].upper()}{sub_cat_name[:6].upper()}",
                            "parent_category_id": main_category.id,
                            "category_path": f"{main_cat_name}/{sub_cat_name}",
                            "category_level": 2,
                            "display_order": i,
                            "is_leaf": True,
                            "created_by": "test-generator",
                            "updated_by": "test-generator"
                        })
                        self.created_categories[sub_cat_name] = subcategory
                        print(f"    ✓ Created subcategory: {sub_cat_name}")
                    except Exception as e:
                        print(f"    ❌ Failed to create subcategory {sub_cat_name}: {e}")
                        
            except Exception as e:
                print(f"  ❌ Failed to create main category {main_cat_name}: {e}")
    
    async def create_items(self, count: int):
        """Create specified number of items distributed across categories."""
        subcategories = [cat for cat in self.created_categories.values() if cat.is_leaf]
        items_per_category = count // len(subcategories)
        
        item_counter = 0
        
        for category in subcategories:
            # Determine items count for this category (distribute remainder)
            items_for_this_cat = items_per_category
            if item_counter < count % len(subcategories):
                items_for_this_cat += 1
            
            print(f"  📦 Creating {items_for_this_cat} items for {category.name}...")
            
            for i in range(items_for_this_cat):
                try:
                    item = await self.create_single_item(category, i)
                    self.created_items.append(item)
                    item_counter += 1
                    
                    if item_counter % 100 == 0:
                        print(f"    ✓ Created {item_counter}/{count} items...")
                        
                except Exception as e:
                    print(f"    ❌ Failed to create item #{i} in {category.name}: {e}")
    
    async def create_single_item(self, category, index: int):
        """Create a single item with realistic data."""
        # Get item template for this category
        template = self.get_item_template(category.name)
        
        # Generate item name
        base_name = random.choice(template["names"])
        item_name = f"{base_name} - {category.name} #{index + 1:03d}"
        
        # Generate SKU
        sku = await self.sku_generator.generate_sku(category.id)
        
        # Select random brand and unit
        brand = random.choice(list(self.created_brands.values()))
        unit = random.choice(list(self.created_units.values()))
        
        # Generate realistic pricing
        cost_price = Decimal(random.uniform(10, 500))
        sale_price = cost_price * Decimal(random.uniform(1.5, 3.0))
        rental_rate = sale_price * Decimal(random.uniform(0.05, 0.15))
        security_deposit = rental_rate * Decimal(random.uniform(2, 10))
        
        # Generate physical properties
        weight = Decimal(random.uniform(0.5, 50.0))
        dimensions = {
            "length": Decimal(random.uniform(10, 200)),
            "width": Decimal(random.uniform(10, 150)),
            "height": Decimal(random.uniform(5, 100))
        }
        
        # Random properties
        color = random.choice(template.get("colors", ["Black", "White", "Silver"]))
        material = random.choice(template.get("materials", ["Metal", "Plastic"]))
        
        # Business configuration
        is_rentable = random.choice([True, True, True, False])  # 75% rentable
        is_salable = random.choice([True, True, False, False])   # 50% salable
        requires_serial = random.choice([True, False, False, False])  # 25% require serial
        
        # Status and inventory
        status = random.choice(["ACTIVE", "ACTIVE", "ACTIVE", "INACTIVE"])  # 75% active
        reorder_level = random.randint(1, 10)
        max_stock = random.randint(reorder_level + 5, 50)
        
        # Generate tags
        tags = self.generate_tags(category, brand, color, material)
        
        # Create item data
        item_data = {
            "item_name": item_name,
            "sku": sku,
            "description": self.generate_description(item_name, category, brand),
            "short_description": f"Professional {base_name.lower()} for events and rentals",
            "brand_id": brand.id,
            "category_id": category.id,
            "unit_of_measurement_id": unit.id,
            "weight": weight,
            "dimensions_length": dimensions["length"],
            "dimensions_width": dimensions["width"],
            "dimensions_height": dimensions["height"],
            "color": color,
            "material": material,
            "is_rentable": is_rentable,
            "is_salable": is_salable,
            "requires_serial_number": requires_serial,
            "cost_price": cost_price,
            "sale_price": sale_price,
            "rental_rate_per_day": rental_rate,
            "security_deposit": security_deposit,
            "reorder_level": reorder_level,
            "maximum_stock_level": max_stock,
            "status": status,
            "notes": f"Test item created for {category.name} category",
            "tags": tags,
            "created_by": "test-generator",
            "updated_by": "test-generator"
        }
        
        # Random maintenance and warranty dates
        if random.random() < 0.3:  # 30% have maintenance date
            item_data["last_maintenance_date"] = datetime.now() - timedelta(days=random.randint(1, 365))
        
        if random.random() < 0.4:  # 40% have warranty
            item_data["warranty_expiry_date"] = datetime.now() + timedelta(days=random.randint(30, 1095))
        
        # Create the item
        return await self.item_repo.create(item_data)
    
    def get_item_template(self, category_name: str) -> Dict[str, List[str]]:
        """Get item template for category or default template."""
        if category_name in self.ITEM_TEMPLATES:
            return self.ITEM_TEMPLATES[category_name]
        
        # Default template
        return {
            "names": [f"{category_name} Item", f"Professional {category_name}",
                     f"{category_name} Equipment", f"Standard {category_name}"],
            "materials": ["Metal", "Plastic", "Composite"],
            "colors": ["Black", "White", "Silver", "Gray"]
        }
    
    def generate_description(self, item_name: str, category, brand) -> str:
        """Generate realistic item description."""
        descriptions = [
            f"High-quality {item_name.lower()} from {brand.name}. Perfect for professional events, "
            f"weddings, parties, and corporate functions. Designed for reliability and durability.",
            
            f"Professional-grade {item_name.lower()} ideal for {category.name.lower()} applications. "
            f"Features premium construction and dependable performance for rental operations.",
            
            f"Versatile {item_name.lower()} suitable for a wide range of events and occasions. "
            f"Easy to set up and transport, making it perfect for rental businesses.",
            
            f"Premium {item_name.lower()} manufactured by {brand.name}. Engineered for frequent use "
            f"in demanding rental environments with excellent return on investment."
        ]
        
        return random.choice(descriptions)
    
    def generate_tags(self, category, brand, color, material) -> str:
        """Generate relevant tags for the item."""
        tags = []
        
        # Category-based tags
        tags.append(category.name.lower().replace(" ", "-"))
        if category.parent:
            tags.append(category.parent.name.lower().replace(" ", "-"))
        
        # Brand tag
        tags.append(brand.name.lower().replace(" ", "-"))
        
        # Property tags
        tags.append(color.lower())
        tags.append(material.lower())
        
        # General tags
        general_tags = ["rental", "event", "professional", "premium", "durable"]
        tags.extend(random.sample(general_tags, k=random.randint(2, 4)))
        
        return ",".join(tags)
    
    async def generate_summary(self) -> Dict[str, Any]:
        """Generate summary of created data."""
        # Count items by category
        items_by_category = {}
        for item in self.created_items:
            category_name = None
            for cat_name, cat in self.created_categories.items():
                if cat.id == item.category_id:
                    category_name = cat_name
                    break
            
            if category_name:
                items_by_category[category_name] = items_by_category.get(category_name, 0) + 1
        
        # Count items by brand
        items_by_brand = {}
        for item in self.created_items:
            brand_name = None
            for brand_name_key, brand in self.created_brands.items():
                if brand.id == item.brand_id:
                    brand_name = brand_name_key
                    break
            
            if brand_name:
                items_by_brand[brand_name] = items_by_brand.get(brand_name, 0) + 1
        
        # Calculate pricing statistics
        total_cost = sum(float(item.cost_price or 0) for item in self.created_items)
        total_sale = sum(float(item.sale_price or 0) for item in self.created_items)
        avg_rental = sum(float(item.rental_rate_per_day or 0) for item in self.created_items) / len(self.created_items)
        
        return {
            "summary": {
                "total_items": len(self.created_items),
                "total_categories": len(self.created_categories),
                "total_brands": len(self.created_brands),
                "total_units": len(self.created_units)
            },
            "distribution": {
                "items_by_category": items_by_category,
                "items_by_brand": dict(list(items_by_brand.items())[:10])  # Top 10
            },
            "pricing": {
                "total_inventory_cost": round(total_cost, 2),
                "total_inventory_sale_value": round(total_sale, 2),
                "average_rental_rate": round(avg_rental, 2)
            },
            "configuration": {
                "rentable_items": sum(1 for item in self.created_items if item.is_rentable),
                "salable_items": sum(1 for item in self.created_items if item.is_salable),
                "active_items": sum(1 for item in self.created_items if item.status == "ACTIVE")
            }
        }


async def main():
    """Main function to run the data generation."""
    async with get_async_session_context() as session:
        generator = ItemDataGenerator(session)
        
        try:
            summary = await generator.generate_all_data()
            
            print("\n" + "="*80)
            print("📊 COMPREHENSIVE ITEM DATA GENERATION COMPLETE")
            print("="*80)
            print(f"✅ Total Items Created: {summary['summary']['total_items']}")
            print(f"✅ Categories Created: {summary['summary']['total_categories']}")
            print(f"✅ Brands Created: {summary['summary']['total_brands']}")
            print(f"✅ Units Created: {summary['summary']['total_units']}")
            print(f"💰 Total Inventory Value: ${summary['pricing']['total_inventory_sale_value']:,.2f}")
            print(f"🔄 Rentable Items: {summary['configuration']['rentable_items']}")
            print(f"💲 Salable Items: {summary['configuration']['salable_items']}")
            print(f"🟢 Active Items: {summary['configuration']['active_items']}")
            print("="*80)
            
        except Exception as e:
            print(f"❌ Error during data generation: {e}")
            raise


if __name__ == "__main__":
    print("🚀 Starting 1000 Items Test Data Generation Script...")
    asyncio.run(main())