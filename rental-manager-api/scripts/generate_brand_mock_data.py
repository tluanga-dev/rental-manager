#!/usr/bin/env python3
"""
Mock Data Generator for Brand Load Testing

Generates 10,000 unique brand variations for comprehensive testing.
Includes realistic brand names, codes, descriptions, and edge cases.
"""

import asyncio
import random
import string
import time
from datetime import datetime, timedelta
from typing import List, Dict, Any
from uuid import uuid4

import asyncpg
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

from app.core.config import settings
from app.models.brand import Brand


# Brand data templates for realistic variation
BRAND_PREFIXES = [
    "Pro", "Elite", "Ultra", "Max", "Super", "Premium", "Advanced", "Industrial",
    "Commercial", "Professional", "Heavy", "Power", "Mega", "Titan", "Force",
    "Precision", "Dynamic", "Robust", "Supreme", "Master", "Expert", "Prime",
    "Superior", "Optimal", "Peak", "Alpha", "Delta", "Omega", "Apex", "Core"
]

BRAND_BASES = [
    # Construction & Heavy Equipment
    "Build", "Construct", "Excavate", "Lift", "Drill", "Haul", "Grade", "Compact",
    "Demo", "Crane", "Loader", "Dozer", "Digger", "Scraper", "Roller",
    
    # Power Tools
    "Cut", "Drill", "Saw", "Grind", "Sand", "Polish", "Fasten", "Measure",
    "Weld", "Heat", "Cool", "Pump", "Press", "Impact", "Torque",
    
    # Audio & Lighting
    "Sound", "Audio", "Light", "Beam", "Flash", "Glow", "Bright", "Loud",
    "Clear", "Sharp", "Deep", "High", "Bass", "Treble", "Echo",
    
    # Kitchen & Restaurant
    "Cook", "Bake", "Fry", "Grill", "Steam", "Chill", "Freeze", "Heat",
    "Mix", "Blend", "Slice", "Chop", "Store", "Serve", "Clean",
    
    # Event & Staging
    "Stage", "Event", "Show", "Display", "Present", "Perform", "Setup",
    "Tent", "Cover", "Frame", "Support", "Secure", "Connect", "Mount"
]

BRAND_SUFFIXES = [
    "Tech", "Pro", "Max", "Plus", "Elite", "Force", "Power", "Works", "Systems",
    "Solutions", "Tools", "Equipment", "Machinery", "Industries", "Corporation",
    "Group", "Company", "Enterprises", "Manufacturing", "Technologies",
    "International", "Global", "Worldwide", "Universal", "Advanced"
]

INDUSTRY_KEYWORDS = [
    "Construction", "Industrial", "Commercial", "Professional", "Heavy Duty",
    "Precision", "Reliable", "Durable", "Efficient", "Advanced", "Innovative",
    "Quality", "Premium", "Superior", "Excellence", "Performance", "Robust",
    "Versatile", "Powerful", "Compact", "Portable", "Ergonomic", "User-friendly"
]

DESCRIPTION_TEMPLATES = [
    "Leading manufacturer of {category} equipment for {industry} applications",
    "Professional grade {category} solutions for {industry} professionals",
    "Innovative {category} technology designed for {industry} operations",
    "Premium {category} equipment trusted by {industry} experts worldwide",
    "Advanced {category} systems for modern {industry} requirements",
    "Heavy-duty {category} machinery built for demanding {industry} environments",
    "Precision {category} tools engineered for {industry} accuracy",
    "Reliable {category} equipment serving the {industry} industry since 1950",
    "High-performance {category} solutions for {industry} productivity",
    "Professional {category} equipment designed for {industry} excellence"
]

CATEGORIES = [
    "construction machinery", "power tools", "audio equipment", "lighting systems",
    "kitchen appliances", "restaurant equipment", "staging equipment", "lifting equipment",
    "cutting tools", "measuring instruments", "safety equipment", "material handling"
]

INDUSTRIES = [
    "construction", "manufacturing", "entertainment", "foodservice", "events",
    "automotive", "aerospace", "marine", "telecommunications", "broadcasting",
    "hospitality", "healthcare", "education", "industrial", "commercial"
]


class BrandMockDataGenerator:
    """Generates realistic mock brand data for load testing."""
    
    def __init__(self):
        self.generated_names = set()
        self.generated_codes = set()
        self.brands_data = []
        
    def generate_unique_name(self) -> str:
        """Generate a unique brand name."""
        while True:
            pattern = random.randint(1, 4)
            
            if pattern == 1:
                # Prefix + Base + Suffix
                name = f"{random.choice(BRAND_PREFIXES)} {random.choice(BRAND_BASES)} {random.choice(BRAND_SUFFIXES)}"
            elif pattern == 2:
                # Base + Suffix
                name = f"{random.choice(BRAND_BASES)}{random.choice(BRAND_SUFFIXES)}"
            elif pattern == 3:
                # Prefix + Base
                name = f"{random.choice(BRAND_PREFIXES)}{random.choice(BRAND_BASES)}"
            else:
                # Base only (modified)
                base = random.choice(BRAND_BASES)
                suffix = random.choice(["Corp", "Inc", "LLC", "Ltd", "Co", "Group"])
                name = f"{base} {suffix}"
            
            # Add edge cases for testing
            if len(self.generated_names) % 1000 == 0:
                # Very long names
                name = f"Very Long Brand Name With Multiple Words For Testing Maximum Length Limits In Database"
            elif len(self.generated_names) % 1001 == 0:
                # Short names
                name = random.choice(string.ascii_uppercase)
            elif len(self.generated_names) % 1002 == 0:
                # Names with numbers
                name = f"{random.choice(BRAND_BASES)}{random.randint(100, 9999)}"
            elif len(self.generated_names) % 1003 == 0:
                # Names with special characters
                name = f"{random.choice(BRAND_BASES)}-{random.choice(BRAND_SUFFIXES)}"
            
            if name not in self.generated_names:
                self.generated_names.add(name)
                return name[:100]  # Ensure within database limits
    
    def generate_unique_code(self) -> str:
        """Generate a unique brand code."""
        while True:
            length = random.choice([3, 4, 5, 6])
            
            # Different code patterns
            pattern = random.randint(1, 5)
            
            if pattern == 1:
                # All letters
                code = ''.join(random.choices(string.ascii_uppercase, k=length))
            elif pattern == 2:
                # Letters and numbers
                code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))
            elif pattern == 3:
                # Letters with hyphens
                base = ''.join(random.choices(string.ascii_uppercase, k=3))
                suffix = ''.join(random.choices(string.ascii_uppercase, k=2))
                code = f"{base}-{suffix}"
            elif pattern == 4:
                # Letters with underscores
                base = ''.join(random.choices(string.ascii_uppercase, k=3))
                suffix = ''.join(random.choices(string.ascii_uppercase, k=2))
                code = f"{base}_{suffix}"
            else:
                # Sequential codes for testing
                code = f"TST{len(self.generated_codes):05d}"
            
            if code not in self.generated_codes:
                self.generated_codes.add(code)
                return code[:20]  # Ensure within database limits
    
    def generate_description(self) -> str:
        """Generate a realistic brand description."""
        template = random.choice(DESCRIPTION_TEMPLATES)
        category = random.choice(CATEGORIES)
        industry = random.choice(INDUSTRIES)
        
        description = template.format(category=category, industry=industry)
        
        # Add some variation
        if random.random() < 0.3:
            keyword = random.choice(INDUSTRY_KEYWORDS)
            description += f" Known for {keyword.lower()} and reliability."
        
        if random.random() < 0.2:
            description += f" Established in {random.randint(1920, 2020)}."
        
        # Edge cases
        if len(self.brands_data) % 500 == 0:
            # Very long descriptions
            description = " ".join([description] * 3)
        elif len(self.brands_data) % 501 == 0:
            # Empty descriptions
            description = ""
        elif len(self.brands_data) % 502 == 0:
            # Short descriptions
            description = random.choice(INDUSTRY_KEYWORDS)
        
        return description[:1000]  # Ensure within database limits
    
    def generate_brand_data(self, count: int = 10000) -> List[Dict[str, Any]]:
        """Generate specified number of brand data entries."""
        print(f"Generating {count} brand variations...")
        
        start_time = time.time()
        base_date = datetime.now() - timedelta(days=365)
        
        for i in range(count):
            if i % 1000 == 0:
                print(f"Generated {i} brands...")
            
            # Create realistic timestamps
            created_at = base_date + timedelta(
                days=random.randint(0, 365),
                hours=random.randint(0, 23),
                minutes=random.randint(0, 59)
            )
            
            # Some brands updated later
            updated_at = None
            if random.random() < 0.4:
                updated_at = created_at + timedelta(
                    days=random.randint(1, 30),
                    hours=random.randint(0, 23)
                )
            
            brand_data = {
                "name": self.generate_unique_name(),
                "code": self.generate_unique_code(),
                "description": self.generate_description(),
                "is_active": random.choice([True] * 8 + [False] * 2),  # 80% active
                "created_at": created_at,
                "updated_at": updated_at,
                "created_by": random.choice([
                    "test_user", "admin", "system", "import_script", "data_loader"
                ]),
                "updated_by": random.choice([
                    "test_user", "admin", "system", None
                ]) if updated_at else None
            }
            
            self.brands_data.append(brand_data)
        
        generation_time = time.time() - start_time
        print(f"Generated {count} brands in {generation_time:.2f} seconds")
        print(f"Average: {generation_time/count*1000:.2f}ms per brand")
        
        return self.brands_data
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get statistics about generated data."""
        if not self.brands_data:
            return {}
        
        active_count = sum(1 for b in self.brands_data if b["is_active"])
        with_description = sum(1 for b in self.brands_data if b["description"])
        with_code = sum(1 for b in self.brands_data if b["code"])
        updated_count = sum(1 for b in self.brands_data if b["updated_at"])
        
        name_lengths = [len(b["name"]) for b in self.brands_data]
        code_lengths = [len(b["code"]) for b in self.brands_data if b["code"]]
        desc_lengths = [len(b["description"]) for b in self.brands_data if b["description"]]
        
        return {
            "total_brands": len(self.brands_data),
            "active_brands": active_count,
            "inactive_brands": len(self.brands_data) - active_count,
            "brands_with_code": with_code,
            "brands_with_description": with_description,
            "brands_updated": updated_count,
            "name_length_stats": {
                "min": min(name_lengths) if name_lengths else 0,
                "max": max(name_lengths) if name_lengths else 0,
                "avg": sum(name_lengths) / len(name_lengths) if name_lengths else 0
            },
            "code_length_stats": {
                "min": min(code_lengths) if code_lengths else 0,
                "max": max(code_lengths) if code_lengths else 0,
                "avg": sum(code_lengths) / len(code_lengths) if code_lengths else 0
            },
            "description_length_stats": {
                "min": min(desc_lengths) if desc_lengths else 0,
                "max": max(desc_lengths) if desc_lengths else 0,
                "avg": sum(desc_lengths) / len(desc_lengths) if desc_lengths else 0
            }
        }


async def insert_brands_to_database(brands_data: List[Dict[str, Any]], batch_size: int = 1000):
    """Insert generated brands into database using batch processing."""
    print(f"Inserting {len(brands_data)} brands into database...")
    
    # Create async engine
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        pool_size=20,
        max_overflow=30
    )
    
    AsyncSessionLocal = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    start_time = time.time()
    total_inserted = 0
    
    try:
        async with AsyncSessionLocal() as session:
            # Process in batches for better performance
            for i in range(0, len(brands_data), batch_size):
                batch = brands_data[i:i + batch_size]
                batch_start = time.time()
                
                # Create Brand objects
                brand_objects = []
                for brand_data in batch:
                    brand = Brand(**brand_data)
                    brand_objects.append(brand)
                
                # Add to session
                session.add_all(brand_objects)
                await session.commit()
                
                batch_time = time.time() - batch_start
                total_inserted += len(batch)
                
                print(f"Inserted batch {i//batch_size + 1}: {len(batch)} brands in {batch_time:.2f}s")
        
        total_time = time.time() - start_time
        print(f"\n✅ Successfully inserted {total_inserted} brands")
        print(f"Total time: {total_time:.2f} seconds")
        print(f"Average: {total_time/total_inserted*1000:.2f}ms per brand")
        print(f"Throughput: {total_inserted/total_time:.2f} brands/second")
        
    except Exception as e:
        print(f"❌ Error inserting brands: {e}")
        raise
    finally:
        await engine.dispose()


async def verify_insertion(expected_count: int):
    """Verify that brands were inserted correctly."""
    print(f"\nVerifying insertion of {expected_count} brands...")
    
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession)
    
    try:
        async with AsyncSessionLocal() as session:
            # Count total brands
            result = await session.execute(text("SELECT COUNT(*) FROM brands"))
            total_count = result.scalar()
            
            # Count active brands
            result = await session.execute(text("SELECT COUNT(*) FROM brands WHERE is_active = true"))
            active_count = result.scalar()
            
            # Check for duplicates
            result = await session.execute(text("""
                SELECT name, COUNT(*) as count 
                FROM brands 
                GROUP BY name 
                HAVING COUNT(*) > 1
            """))
            duplicates = result.fetchall()
            
            print(f"✅ Database verification:")
            print(f"  Total brands in database: {total_count}")
            print(f"  Active brands: {active_count}")
            print(f"  Inactive brands: {total_count - active_count}")
            print(f"  Duplicate names found: {len(duplicates)}")
            
            if duplicates:
                print("❌ Warning: Duplicate names found:")
                for name, count in duplicates[:5]:
                    print(f"  '{name}': {count} occurrences")
            
            return total_count == expected_count and len(duplicates) == 0
            
    except Exception as e:
        print(f"❌ Error verifying insertion: {e}")
        return False
    finally:
        await engine.dispose()


async def main():
    """Main execution function."""
    print("🚀 Starting Brand Mock Data Generation")
    print("=" * 50)
    
    # Generate mock data
    generator = BrandMockDataGenerator()
    brands_data = generator.generate_brand_data(10000)
    
    # Print statistics
    stats = generator.get_statistics()
    print(f"\n📊 Generated Data Statistics:")
    print(f"  Total brands: {stats['total_brands']}")
    print(f"  Active: {stats['active_brands']} ({stats['active_brands']/stats['total_brands']*100:.1f}%)")
    print(f"  With codes: {stats['brands_with_code']} ({stats['brands_with_code']/stats['total_brands']*100:.1f}%)")
    print(f"  With descriptions: {stats['brands_with_description']} ({stats['brands_with_description']/stats['total_brands']*100:.1f}%)")
    print(f"  Name length: {stats['name_length_stats']['min']}-{stats['name_length_stats']['max']} chars (avg: {stats['name_length_stats']['avg']:.1f})")
    print(f"  Code length: {stats['code_length_stats']['min']}-{stats['code_length_stats']['max']} chars (avg: {stats['code_length_stats']['avg']:.1f})")
    
    # Insert into database
    print(f"\n💾 Database Insertion")
    print("=" * 30)
    await insert_brands_to_database(brands_data, batch_size=500)
    
    # Verify insertion
    print(f"\n🔍 Verification")
    print("=" * 20)
    success = await verify_insertion(len(brands_data))
    
    if success:
        print("✅ Mock data generation completed successfully!")
        print(f"✅ {len(brands_data)} brand variations ready for testing")
    else:
        print("❌ Mock data generation completed with issues")
        print("❌ Please check the verification results above")
    
    print("\n🎯 Next Steps:")
    print("  1. Run performance tests: pytest test_brand_performance.py")
    print("  2. Run API load tests: pytest test_brand_api_load.py")
    print("  3. Run database stress tests: pytest test_brand_database_load.py")
    print("  4. Clean up test data: python scripts/cleanup_test_brands.py")


if __name__ == "__main__":
    asyncio.run(main())