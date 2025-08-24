#!/usr/bin/env python3

"""
🧪 Brand Stress Test - Seed 10,000 Brands
Generates and inserts 10,000 realistic brands for performance testing
"""

import asyncio
import sys
import os
import time
import random
from typing import List, Dict, Any
import string

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

from app.models.brand import Brand
from app.core.config import settings

# Test configuration
TEST_DATABASE_URL = settings.DATABASE_URL
if TEST_DATABASE_URL.startswith("postgresql://"):
    TEST_DATABASE_URL = TEST_DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# Brand data for realistic generation
BRAND_PREFIXES = [
    "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta", "Iota", "Kappa",
    "Lambda", "Mu", "Nu", "Xi", "Omicron", "Pi", "Rho", "Sigma", "Tau", "Upsilon",
    "Phi", "Chi", "Psi", "Omega", "Ace", "Prime", "Ultra", "Mega", "Super", "Hyper",
    "Neo", "Pro", "Elite", "Max", "Plus", "Premium", "Gold", "Silver", "Platinum", "Diamond",
    "Royal", "Crown", "Imperial", "Supreme", "Master", "Expert", "Advanced", "Superior",
    "Classic", "Modern", "Future", "Next", "Smart", "Tech", "Digital", "Cyber", "Nano",
    "Micro", "Macro", "Global", "Universal", "International", "Continental", "Regional"
]

BRAND_SUFFIXES = [
    "Corp", "Inc", "Ltd", "LLC", "Co", "Group", "Holdings", "Industries", "Systems",
    "Solutions", "Technologies", "Enterprises", "Partners", "Associates", "Ventures",
    "Works", "Labs", "Studio", "Design", "Creative", "Brand", "Company", "Firm",
    "Agency", "Services", "Products", "Manufacturing", "Distribution", "Retail",
    "International", "Global", "Worldwide", "Universal", "Premium", "Elite", "Pro"
]

INDUSTRY_KEYWORDS = [
    "Tech", "Digital", "Smart", "Innovation", "Future", "Advanced", "Modern", "Classic",
    "Premium", "Luxury", "Essential", "Professional", "Industrial", "Commercial",
    "Consumer", "Retail", "Wholesale", "Manufacturing", "Distribution", "Logistics",
    "Fashion", "Beauty", "Health", "Fitness", "Sports", "Outdoor", "Home", "Garden",
    "Automotive", "Electronics", "Appliances", "Furniture", "Clothing", "Footwear",
    "Accessories", "Jewelry", "Watches", "Bags", "Luggage", "Toys", "Games", "Books",
    "Music", "Entertainment", "Media", "Publishing", "Education", "Training", "Services"
]

DESCRIPTIONS = [
    "Leading provider of innovative solutions",
    "Trusted brand with over 50 years of experience",
    "Premium quality products for discerning customers",
    "Cutting-edge technology and superior performance",
    "Sustainable and environmentally friendly solutions",
    "Affordable luxury for everyday use",
    "Professional-grade equipment and tools",
    "Consumer-focused design and functionality",
    "International brand with global presence",
    "Specialized solutions for specific industries",
    "High-performance products for demanding applications",
    "Elegant design meets practical functionality",
    "Revolutionary products that change the industry",
    "Time-tested reliability and durability",
    "Contemporary style with classic appeal"
]

class BrandStressTest:
    def __init__(self):
        self.engine = None
        self.session_factory = None
        self.brands_created = 0
        self.start_time = None
        
    async def setup_database(self):
        """Setup database connection"""
        print("🔧 Setting up database connection...")
        self.engine = create_async_engine(
            TEST_DATABASE_URL, 
            echo=False,
            pool_size=20,
            max_overflow=40
        )
        self.session_factory = sessionmaker(
            self.engine, 
            class_=AsyncSession, 
            expire_on_commit=False
        )
        print("✅ Database connection established")
    
    async def cleanup_existing_brands(self):
        """Clean up existing test brands"""
        print("🧹 Cleaning up existing test brands...")
        
        async with self.session_factory() as session:
            try:
                # Delete brands with names containing "Brand " or codes starting with "TEST"
                result = await session.execute(
                    text("DELETE FROM brands WHERE name LIKE 'Brand %' OR name LIKE '%Test%' OR code LIKE 'TEST-%' OR code LIKE 'BRD-%'")
                )
                await session.commit()
                print(f"✅ Cleaned up existing test brands")
            except Exception as e:
                print(f"⚠️  Cleanup warning: {e}")
                await session.rollback()
    
    def generate_brand_name(self, index: int) -> str:
        """Generate a realistic brand name"""
        # 70% chance of using prefix + suffix pattern
        if random.random() < 0.7:
            prefix = random.choice(BRAND_PREFIXES)
            suffix = random.choice(BRAND_SUFFIXES)
            return f"{prefix} {suffix}"
        else:
            # 30% chance of using single word + industry keyword
            keyword = random.choice(INDUSTRY_KEYWORDS)
            suffix = random.choice(BRAND_SUFFIXES)
            return f"{keyword} {suffix}"
    
    def generate_brand_code(self, index: int) -> str:
        """Generate a unique brand code"""
        # Format: BRD-{5-digit-index}
        return f"BRD-{index:05d}"
    
    def generate_description(self, name: str) -> str:
        """Generate a realistic description"""
        base_desc = random.choice(DESCRIPTIONS)
        
        # 50% chance of adding industry-specific details
        if random.random() < 0.5:
            industry = random.choice(INDUSTRY_KEYWORDS).lower()
            base_desc += f" specializing in {industry} solutions"
        
        # 30% chance of adding year established
        if random.random() < 0.3:
            year = random.randint(1950, 2020)
            base_desc += f". Established in {year}"
        
        # 20% chance of adding location
        if random.random() < 0.2:
            locations = ["USA", "Europe", "Asia", "globally", "internationally"]
            location = random.choice(locations)
            base_desc += f" with operations in {location}"
        
        return base_desc + "."
    
    async def create_brands_batch(self, start_index: int, batch_size: int) -> int:
        """Create a batch of brands"""
        brands = []
        
        for i in range(batch_size):
            index = start_index + i
            
            # Generate brand data
            name = self.generate_brand_name(index)
            code = self.generate_brand_code(index)
            
            # 80% of brands have descriptions
            description = self.generate_description(name) if random.random() < 0.8 else None
            
            brand = Brand(
                name=name,
                code=code,
                description=description
            )
            brands.append(brand)
        
        # Insert batch
        async with self.session_factory() as session:
            try:
                session.add_all(brands)
                await session.commit()
                return len(brands)
            except Exception as e:
                await session.rollback()
                print(f"❌ Batch insert failed: {e}")
                return 0
    
    async def create_brands_concurrent(self, total_brands: int, batch_size: int = 100, max_concurrent: int = 10):
        """Create brands using concurrent batches"""
        print(f"🚀 Creating {total_brands} brands in batches of {batch_size} (max {max_concurrent} concurrent)...")
        
        self.start_time = time.time()
        
        # Create semaphore to limit concurrent operations
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def create_batch_with_semaphore(start_idx: int, size: int):
            async with semaphore:
                return await self.create_brands_batch(start_idx, size)
        
        # Create tasks for all batches
        tasks = []
        for start_idx in range(0, total_brands, batch_size):
            remaining = min(batch_size, total_brands - start_idx)
            task = create_batch_with_semaphore(start_idx, remaining)
            tasks.append(task)
        
        # Execute batches and track progress
        completed = 0
        for i, task in enumerate(asyncio.as_completed(tasks)):
            created = await task
            completed += created
            
            elapsed = time.time() - self.start_time
            rate = completed / elapsed if elapsed > 0 else 0
            progress = (completed / total_brands) * 100
            
            print(f"📊 Progress: {completed:,}/{total_brands:,} ({progress:.1f}%) - Rate: {rate:.1f} brands/sec")
        
        self.brands_created = completed
        return completed
    
    async def verify_data_integrity(self) -> Dict[str, Any]:
        """Verify the integrity of created brands"""
        print("🔍 Verifying data integrity...")
        
        async with self.session_factory() as session:
            # Count total brands
            result = await session.execute(text("SELECT COUNT(*) FROM brands WHERE code LIKE 'BRD-%'"))
            total_count = result.scalar()
            
            # Count unique names
            result = await session.execute(text("SELECT COUNT(DISTINCT name) FROM brands WHERE code LIKE 'BRD-%'"))
            unique_names = result.scalar()
            
            # Count unique codes
            result = await session.execute(text("SELECT COUNT(DISTINCT code) FROM brands WHERE code LIKE 'BRD-%'"))
            unique_codes = result.scalar()
            
            # Count brands with descriptions
            result = await session.execute(text("SELECT COUNT(*) FROM brands WHERE code LIKE 'BRD-%' AND description IS NOT NULL"))
            with_descriptions = result.scalar()
            
            # Count active brands
            result = await session.execute(text("SELECT COUNT(*) FROM brands WHERE code LIKE 'BRD-%' AND is_active = true"))
            active_brands = result.scalar()
            
            # Sample some brands for spot checking
            result = await session.execute(text("SELECT name, code, description FROM brands WHERE code LIKE 'BRD-%' LIMIT 5"))
            samples = result.fetchall()
            
            integrity_data = {
                "total_brands": total_count,
                "unique_names": unique_names,
                "unique_codes": unique_codes,
                "with_descriptions": with_descriptions,
                "active_brands": active_brands,
                "samples": [{"name": s[0], "code": s[1], "description": s[2][:100] + "..." if s[2] and len(s[2]) > 100 else s[2]} for s in samples]
            }
            
            return integrity_data
    
    async def performance_test_queries(self) -> Dict[str, Any]:
        """Test query performance with large dataset"""
        print("⚡ Running performance tests...")
        
        async with self.session_factory() as session:
            performance_data = {}
            
            # Test 1: Count all brands
            start_time = time.time()
            result = await session.execute(text("SELECT COUNT(*) FROM brands"))
            total_brands = result.scalar()
            count_time = time.time() - start_time
            performance_data["count_query"] = {"time": count_time, "count": total_brands}
            
            # Test 2: Search by name pattern
            start_time = time.time()
            result = await session.execute(text("SELECT COUNT(*) FROM brands WHERE name ILIKE '%Tech%'"))
            tech_brands = result.scalar()
            search_time = time.time() - start_time
            performance_data["search_query"] = {"time": search_time, "matches": tech_brands}
            
            # Test 3: Pagination query (first page)
            start_time = time.time()
            result = await session.execute(text("SELECT id, name, code FROM brands ORDER BY name LIMIT 50 OFFSET 0"))
            page_results = result.fetchall()
            pagination_time = time.time() - start_time
            performance_data["pagination_query"] = {"time": pagination_time, "results": len(page_results)}
            
            # Test 4: Filter by active status
            start_time = time.time()
            result = await session.execute(text("SELECT COUNT(*) FROM brands WHERE is_active = true"))
            active_count = result.scalar()
            filter_time = time.time() - start_time
            performance_data["filter_query"] = {"time": filter_time, "count": active_count}
            
            # Test 5: Complex query with sorting
            start_time = time.time()
            result = await session.execute(text("""
                SELECT name, code, description 
                FROM brands 
                WHERE is_active = true AND description IS NOT NULL
                ORDER BY name 
                LIMIT 100
            """))
            complex_results = result.fetchall()
            complex_time = time.time() - start_time
            performance_data["complex_query"] = {"time": complex_time, "results": len(complex_results)}
            
            return performance_data
    
    async def generate_performance_report(self, integrity_data: Dict, performance_data: Dict):
        """Generate comprehensive performance report"""
        total_time = time.time() - self.start_time
        
        print("\n" + "="*60)
        print("📊 BRAND STRESS TEST PERFORMANCE REPORT")
        print("="*60)
        
        print(f"\n🏗️  DATA GENERATION METRICS:")
        print(f"   • Total Brands Created: {self.brands_created:,}")
        print(f"   • Total Time: {total_time:.2f} seconds")
        print(f"   • Average Rate: {self.brands_created / total_time:.1f} brands/second")
        print(f"   • Peak Memory Usage: N/A (would need monitoring)")
        
        print(f"\n🔍 DATA INTEGRITY VERIFICATION:")
        print(f"   • Total Brands in DB: {integrity_data['total_brands']:,}")
        print(f"   • Unique Names: {integrity_data['unique_names']:,}")
        print(f"   • Unique Codes: {integrity_data['unique_codes']:,}")
        print(f"   • With Descriptions: {integrity_data['with_descriptions']:,} ({(integrity_data['with_descriptions']/integrity_data['total_brands']*100):.1f}%)")
        print(f"   • Active Brands: {integrity_data['active_brands']:,}")
        
        print(f"\n⚡ QUERY PERFORMANCE METRICS:")
        for query_name, data in performance_data.items():
            query_display = query_name.replace('_', ' ').title()
            if 'count' in data:
                print(f"   • {query_display}: {data['time']*1000:.1f}ms ({data['count']:,} results)")
            elif 'matches' in data:
                print(f"   • {query_display}: {data['time']*1000:.1f}ms ({data['matches']:,} matches)")
            elif 'results' in data:
                print(f"   • {query_display}: {data['time']*1000:.1f}ms ({data['results']} results)")
        
        print(f"\n📋 SAMPLE DATA:")
        for i, sample in enumerate(integrity_data['samples'], 1):
            print(f"   {i}. {sample['name']} ({sample['code']})")
            if sample['description']:
                print(f"      Description: {sample['description']}")
        
        print(f"\n✅ PERFORMANCE BENCHMARKS:")
        # Check if performance meets requirements
        benchmarks = {
            "Count Query": {"actual": performance_data["count_query"]["time"], "target": 0.5, "unit": "seconds"},
            "Search Query": {"actual": performance_data["search_query"]["time"], "target": 0.3, "unit": "seconds"},
            "Pagination": {"actual": performance_data["pagination_query"]["time"], "target": 0.1, "unit": "seconds"},
            "Filter Query": {"actual": performance_data["filter_query"]["time"], "target": 0.2, "unit": "seconds"},
            "Complex Query": {"actual": performance_data["complex_query"]["time"], "target": 0.5, "unit": "seconds"}
        }
        
        all_passed = True
        for test_name, benchmark in benchmarks.items():
            passed = benchmark["actual"] <= benchmark["target"]
            status = "✅ PASS" if passed else "❌ FAIL"
            print(f"   • {test_name}: {status} ({benchmark['actual']*1000:.1f}ms ≤ {benchmark['target']*1000:.1f}ms)")
            if not passed:
                all_passed = False
        
        print(f"\n🎯 OVERALL RESULT:")
        if all_passed and integrity_data['total_brands'] >= 10000:
            print("   ✅ STRESS TEST PASSED - All performance benchmarks met!")
        else:
            print("   ❌ STRESS TEST FAILED - Some benchmarks not met or insufficient data")
        
        print("="*60)
        
        return all_passed and integrity_data['total_brands'] >= 10000
    
    async def run_stress_test(self, target_brands: int = 10000):
        """Run the complete stress test"""
        print(f"🧪 Brand Stress Test - Targeting {target_brands:,} brands")
        print("=" * 50)
        
        try:
            # Setup
            await self.setup_database()
            await self.cleanup_existing_brands()
            
            # Generate brands
            created = await self.create_brands_concurrent(
                total_brands=target_brands,
                batch_size=100,
                max_concurrent=10
            )
            
            if created < target_brands:
                print(f"⚠️  Only created {created:,} out of {target_brands:,} brands")
            
            # Verify data integrity
            integrity_data = await self.verify_data_integrity()
            
            # Performance testing
            performance_data = await self.performance_test_queries()
            
            # Generate report
            success = await self.generate_performance_report(integrity_data, performance_data)
            
            return success
            
        except Exception as e:
            print(f"❌ Stress test failed: {e}")
            return False
        finally:
            if self.engine:
                await self.engine.dispose()

async def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Brand Stress Test - Generate 10K brands')
    parser.add_argument('--count', type=int, default=10000, help='Number of brands to create (default: 10000)')
    parser.add_argument('--cleanup', action='store_true', help='Clean up test data and exit')
    parser.add_argument('--verify-only', action='store_true', help='Only verify existing data')
    
    args = parser.parse_args()
    
    stress_test = BrandStressTest()
    
    if args.cleanup:
        print("🧹 Cleanup mode - removing test brands...")
        await stress_test.setup_database()
        await stress_test.cleanup_existing_brands()
        print("✅ Cleanup completed")
        return 0
    
    if args.verify_only:
        print("🔍 Verify mode - checking existing data...")
        await stress_test.setup_database()
        integrity_data = await stress_test.verify_data_integrity()
        performance_data = await stress_test.performance_test_queries()
        success = await stress_test.generate_performance_report(integrity_data, performance_data)
        return 0 if success else 1
    
    # Run full stress test
    success = await stress_test.run_stress_test(args.count)
    return 0 if success else 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)