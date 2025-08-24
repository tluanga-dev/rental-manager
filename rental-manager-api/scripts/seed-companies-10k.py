#!/usr/bin/env python3

"""
Company Stress Test Data Generator
Creates 10,000 unique companies for stress testing
Tests database performance, API scalability, and memory usage
"""

import sys
import os
import asyncio
import random
import string
import time
from uuid import uuid4
from datetime import datetime
from typing import List, Dict, Any

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool
from app.db.base import Base
from app.models.company import Company

# Database configuration
DATABASE_URL = "postgresql+asyncpg://rental_user:rental_password@localhost:5432/rental_db"

# Company name prefixes and suffixes for realistic names
COMPANY_PREFIXES = [
    "Global", "International", "United", "Universal", "Advanced", "Modern", "Dynamic",
    "Elite", "Premier", "Supreme", "Professional", "Expert", "Innovative", "Creative",
    "Strategic", "Optimal", "Prime", "Alpha", "Beta", "Gamma", "Delta", "Omega",
    "Nexus", "Vertex", "Apex", "Zenith", "Summit", "Peak", "Core", "Edge", "Fusion",
    "Quantum", "Digital", "Cyber", "Tech", "Smart", "Rapid", "Swift", "Agile",
    "Stellar", "Cosmic", "Phoenix", "Eagle", "Lion", "Tiger", "Falcon", "Hawk"
]

COMPANY_TYPES = [
    "Technologies", "Solutions", "Systems", "Services", "Enterprises", "Corporation",
    "Industries", "Group", "Holdings", "Partners", "Associates", "Consulting", 
    "Engineering", "Manufacturing", "Trading", "Logistics", "Development",
    "Innovation", "Research", "Analytics", "Dynamics", "Networks", "Resources",
    "Capital", "Ventures", "Investments", "Properties", "Construction", "Design",
    "Marketing", "Communications", "Media", "Entertainment", "Productions",
    "Software", "Hardware", "Robotics", "Automation", "Intelligence", "Data"
]

COMPANY_SUFFIXES = [
    "Ltd", "LLC", "Corp", "Inc", "Co", "Group", "Holdings", "Enterprises",
    "Partners", "Associates", "Solutions", "Systems", "Technologies"
]

# Address components for realistic addresses
CITIES = [
    "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia",
    "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "Jacksonville",
    "San Francisco", "Columbus", "Charlotte", "Indianapolis", "Seattle", "Denver",
    "Boston", "Nashville", "Baltimore", "Portland", "Oklahoma City", "Milwaukee",
    "Las Vegas", "Albuquerque", "Tucson", "Fresno", "Sacramento", "Kansas City",
    "Atlanta", "Miami", "Raleigh", "Omaha", "Colorado Springs", "Virginia Beach",
    "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune",
    "Ahmedabad", "Jaipur", "Surat", "Lucknow", "Kanpur", "Nagpur", "Patna"
]

STREETS = [
    "Main St", "First Ave", "Oak St", "Park Ave", "Broadway", "Second St",
    "Elm St", "Washington Ave", "Third St", "Hill St", "Maple St", "Cedar St",
    "Sunset Blvd", "Pine St", "Church St", "Market St", "Spring St", "Center St",
    "Technology Drive", "Innovation Way", "Business Park", "Industrial Blvd",
    "Corporate Plaza", "Executive Ave", "Commerce St", "Trade Center", "Enterprise Way"
]

# Email domains for realistic emails
EMAIL_DOMAINS = [
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "company.com",
    "business.net", "enterprise.org", "corp.com", "group.net", "solutions.com",
    "tech.io", "startup.co", "innovation.net", "digital.com", "services.biz"
]

# Indian GST number patterns (realistic format)
GST_STATES = [
    "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
    "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
    "21", "22", "23", "24", "25", "26", "27", "28", "29", "30"
]

# Registration number prefixes (Indian company format)
REG_PREFIXES = [
    "L", "U", "CIN-L", "CIN-U", "INC", "PVT", "LTD", "LLC", "CORP"
]

REG_STATES = [
    "DL", "MH", "KA", "TN", "AP", "UP", "WB", "GJ", "RJ", "MP",
    "OR", "PB", "HR", "KL", "AS", "JH", "CG", "UK", "HP", "JK"
]


class CompanyDataGenerator:
    """Generates realistic company data for stress testing"""
    
    def __init__(self):
        self.used_names = set()
        self.used_emails = set()
        self.used_gst_numbers = set()
        self.used_reg_numbers = set()
        
    def generate_company_name(self) -> str:
        """Generate a unique, realistic company name"""
        attempts = 0
        while attempts < 100:  # Prevent infinite loop
            prefix = random.choice(COMPANY_PREFIXES)
            company_type = random.choice(COMPANY_TYPES)
            suffix = random.choice(COMPANY_SUFFIXES)
            
            # Various name patterns
            patterns = [
                f"{prefix} {company_type}",
                f"{prefix} {company_type} {suffix}",
                f"{prefix} {suffix}",
                f"{company_type} {suffix}",
                f"{prefix} {company_type} ({suffix})",
                f"{prefix}-{company_type}",
                f"{company_type}-{suffix}"
            ]
            
            name = random.choice(patterns)
            
            # Add random number for uniqueness if needed
            if attempts > 50:
                name += f" {random.randint(1, 9999)}"
            
            if name not in self.used_names:
                self.used_names.add(name)
                return name
            
            attempts += 1
        
        # Fallback with UUID
        unique_name = f"Company {uuid4().hex[:8].upper()}"
        self.used_names.add(unique_name)
        return unique_name
    
    def generate_address(self) -> str:
        """Generate a realistic business address"""
        building_num = random.randint(1, 9999)
        street = random.choice(STREETS)
        city = random.choice(CITIES)
        
        # Various address patterns
        patterns = [
            f"{building_num} {street}, {city}",
            f"Suite {random.randint(100, 999)}, {building_num} {street}, {city}",
            f"Building {random.choice(['A', 'B', 'C'])}, {building_num} {street}, {city}",
            f"Floor {random.randint(1, 50)}, {building_num} {street}, {city}",
            f"{building_num}-{random.randint(1, 999)} {street}, {city}",
        ]
        
        address = random.choice(patterns)
        
        # Add zip/postal code
        if city in ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai"]:
            address += f", {random.randint(100000, 999999)}"  # Indian PIN
        else:
            address += f", {random.randint(10000, 99999)}"  # US ZIP
        
        return address
    
    def generate_email(self, company_name: str) -> str:
        """Generate a unique business email based on company name"""
        attempts = 0
        while attempts < 50:
            # Extract words from company name for email
            words = company_name.lower().replace("(", "").replace(")", "").replace("-", " ").split()
            clean_words = [word for word in words if len(word) > 2 and word not in ["ltd", "llc", "inc", "corp", "co"]]
            
            if clean_words:
                base = clean_words[0][:8]  # First significant word, max 8 chars
                if len(clean_words) > 1:
                    base += clean_words[1][:4]  # Add part of second word
            else:
                base = f"company{random.randint(1, 9999)}"
            
            # Email patterns
            prefixes = ["info", "contact", "admin", "hello", "support", "sales", "office"]
            prefix = random.choice(prefixes)
            domain = random.choice(EMAIL_DOMAINS)
            
            patterns = [
                f"{prefix}@{base}.com",
                f"{prefix}@{base}.net",
                f"{prefix}@{base}.biz",
                f"{base}@{domain}",
                f"{prefix}.{base}@{domain}",
            ]
            
            if attempts > 25:
                # Add random numbers for uniqueness
                patterns.append(f"{prefix}{random.randint(1, 999)}@{base}.com")
                patterns.append(f"{base}{random.randint(1, 999)}@{domain}")
            
            email = random.choice(patterns)
            
            if email not in self.used_emails:
                self.used_emails.add(email)
                return email
            
            attempts += 1
        
        # Fallback unique email
        unique_email = f"company{uuid4().hex[:8]}@test.com"
        self.used_emails.add(unique_email)
        return unique_email
    
    def generate_phone(self) -> str:
        """Generate a realistic phone number"""
        patterns = [
            f"+1-{random.randint(200, 999)}-{random.randint(200, 999)}-{random.randint(1000, 9999)}",
            f"+91-{random.randint(70, 99)}{random.randint(10000000, 99999999)}",
            f"({random.randint(200, 999)}) {random.randint(200, 999)}-{random.randint(1000, 9999)}",
            f"{random.randint(200, 999)}.{random.randint(200, 999)}.{random.randint(1000, 9999)}",
            f"+44-20-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}",
            f"+86-{random.randint(10, 99)}-{random.randint(10000000, 99999999)}",
        ]
        
        return random.choice(patterns)
    
    def generate_gst_number(self) -> str:
        """Generate a unique, realistic GST number (Indian format)"""
        attempts = 0
        while attempts < 100:
            state = random.choice(GST_STATES)
            pan_part = ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))
            entity_code = random.randint(1, 9)
            check_digit = random.choice(string.ascii_uppercase + string.digits)
            
            gst = f"{state}{pan_part}{entity_code}Z{check_digit}"
            
            if gst not in self.used_gst_numbers:
                self.used_gst_numbers.add(gst)
                return gst
            
            attempts += 1
        
        # Fallback unique GST
        unique_gst = f"99{uuid4().hex[:10].upper()}1ZA"
        self.used_gst_numbers.add(unique_gst)
        return unique_gst
    
    def generate_registration_number(self) -> str:
        """Generate a unique, realistic registration number"""
        attempts = 0
        while attempts < 100:
            prefix = random.choice(REG_PREFIXES)
            state = random.choice(REG_STATES)
            year = random.randint(1995, 2024)
            company_type = random.choice(["PTC", "PLC", "OPC", "LLP"])
            number = random.randint(100000, 999999)
            
            patterns = [
                f"{prefix}{random.randint(10000, 99999)}{state}{year}{company_type}{number}",
                f"CIN-{prefix}{random.randint(10000, 99999)}{state}{year}{company_type}{number}",
                f"{prefix}-{state}-{year}-{company_type}-{number}",
                f"{state}{year}{company_type}{number}",
            ]
            
            reg_num = random.choice(patterns)
            
            if reg_num not in self.used_reg_numbers:
                self.used_reg_numbers.add(reg_num)
                return reg_num
            
            attempts += 1
        
        # Fallback unique registration
        unique_reg = f"L{uuid4().hex[:8].upper()}DL2023PTC{random.randint(100000, 999999)}"
        self.used_reg_numbers.add(unique_reg)
        return unique_reg
    
    def generate_company_data(self) -> Dict[str, Any]:
        """Generate complete company data"""
        company_name = self.generate_company_name()
        
        # Not all companies will have all optional fields (realistic scenario)
        has_email = random.random() > 0.1  # 90% have email
        has_phone = random.random() > 0.15  # 85% have phone  
        has_address = random.random() > 0.2  # 80% have address
        has_gst = random.random() > 0.3  # 70% have GST
        has_registration = random.random() > 0.25  # 75% have registration
        
        data = {
            "company_name": company_name,
            "address": self.generate_address() if has_address else None,
            "email": self.generate_email(company_name) if has_email else None,
            "phone": self.generate_phone() if has_phone else None,
            "gst_no": self.generate_gst_number() if has_gst else None,
            "registration_number": self.generate_registration_number() if has_registration else None,
        }
        
        return data
    
    def generate_batch(self, count: int) -> List[Dict[str, Any]]:
        """Generate a batch of company data"""
        return [self.generate_company_data() for _ in range(count)]


class StressTestRunner:
    """Runs stress tests with 10,000 companies"""
    
    def __init__(self, database_url: str = DATABASE_URL):
        self.database_url = database_url
        self.generator = CompanyDataGenerator()
        self.engine = None
        self.session_maker = None
        
    async def setup_database(self):
        """Setup database connection"""
        print("🔧 Setting up database connection...")
        
        self.engine = create_async_engine(
            self.database_url,
            echo=False,  # Set to True for SQL debugging
            pool_size=20,
            max_overflow=40,
            pool_pre_ping=True,
            pool_recycle=3600,
        )
        
        self.session_maker = async_sessionmaker(
            bind=self.engine,
            class_=AsyncSession,
            expire_on_commit=False
        )
        
        # Ensure tables exist
        try:
            async with self.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            print("✅ Database tables created/verified")
        except Exception as e:
            print(f"❌ Database setup failed: {e}")
            raise
    
    async def cleanup_database(self):
        """Cleanup database connection"""
        if self.engine:
            await self.engine.dispose()
            print("🔄 Database connection closed")
    
    async def clear_existing_test_data(self):
        """Clear existing test companies to start fresh"""
        print("🧹 Clearing existing test data...")
        
        async with self.session_maker() as session:
            try:
                # Delete companies that look like test data
                from sqlalchemy import delete, select
                
                # Count existing companies first
                result = await session.execute(select(Company))
                existing_count = len(result.scalars().all())
                print(f"Found {existing_count} existing companies")
                
                if existing_count > 0:
                    # Delete test companies (be careful not to delete real data)
                    await session.execute(
                        delete(Company).where(
                            Company.company_name.like('%Test%') |
                            Company.company_name.like('%Stress%') |
                            Company.company_name.like('%Company %') |
                            Company.email.like('%test.com%')
                        )
                    )
                    await session.commit()
                    print("✅ Test data cleared")
                else:
                    print("ℹ️ No existing data to clear")
                    
            except Exception as e:
                print(f"⚠️ Error clearing test data: {e}")
                await session.rollback()
    
    async def create_companies_batch(self, batch_data: List[Dict[str, Any]], batch_num: int) -> tuple:
        """Create a batch of companies and return timing/success info"""
        start_time = time.time()
        successful = 0
        failed = 0
        errors = []
        
        async with self.session_maker() as session:
            try:
                companies = []
                for data in batch_data:
                    try:
                        company = Company(**data)
                        companies.append(company)
                        successful += 1
                    except Exception as e:
                        failed += 1
                        errors.append(f"Company creation error: {str(e)[:100]}")
                
                if companies:
                    session.add_all(companies)
                    await session.commit()
                    
                end_time = time.time()
                batch_time = end_time - start_time
                
                print(f"Batch {batch_num}: {successful} created, {failed} failed in {batch_time:.2f}s")
                
                return successful, failed, batch_time, errors
                
            except Exception as e:
                await session.rollback()
                failed = len(batch_data)
                successful = 0
                end_time = time.time()
                batch_time = end_time - start_time
                
                error_msg = f"Batch commit error: {str(e)}"
                print(f"❌ Batch {batch_num} failed: {error_msg[:100]}")
                
                return successful, failed, batch_time, [error_msg]
    
    async def run_stress_test(self, total_companies: int = 10000, batch_size: int = 100):
        """Run the main stress test"""
        print(f"🚀 Starting stress test: {total_companies} companies in batches of {batch_size}")
        
        total_batches = (total_companies + batch_size - 1) // batch_size
        overall_start = time.time()
        
        total_successful = 0
        total_failed = 0
        total_batch_time = 0
        all_errors = []
        
        for batch_num in range(1, total_batches + 1):
            # Calculate batch size for this iteration
            companies_in_batch = min(batch_size, total_companies - (batch_num - 1) * batch_size)
            
            print(f"\n📦 Generating batch {batch_num}/{total_batches} ({companies_in_batch} companies)...")
            
            # Generate batch data
            batch_start = time.time()
            batch_data = self.generator.generate_batch(companies_in_batch)
            generation_time = time.time() - batch_start
            
            print(f"Generated {len(batch_data)} companies in {generation_time:.2f}s")
            
            # Create companies in database
            successful, failed, batch_time, errors = await self.create_companies_batch(batch_data, batch_num)
            
            total_successful += successful
            total_failed += failed
            total_batch_time += batch_time
            all_errors.extend(errors)
            
            # Progress update
            progress = (batch_num / total_batches) * 100
            print(f"Progress: {progress:.1f}% | Total Created: {total_successful} | Total Failed: {total_failed}")
            
            # Small delay to prevent overwhelming the database
            if batch_num < total_batches:
                await asyncio.sleep(0.1)
        
        overall_time = time.time() - overall_start
        
        # Print final statistics
        print("\n" + "="*80)
        print("🧪 STRESS TEST RESULTS")
        print("="*80)
        print(f"Total Companies Attempted: {total_companies}")
        print(f"Successfully Created: {total_successful}")
        print(f"Failed: {total_failed}")
        print(f"Success Rate: {(total_successful / total_companies * 100):.2f}%")
        print(f"Total Time: {overall_time:.2f} seconds")
        print(f"Average Batch Time: {(total_batch_time / total_batches):.2f} seconds")
        print(f"Companies per Second: {(total_successful / overall_time):.2f}")
        print(f"Memory Usage: {self.get_memory_usage()} MB")
        
        if all_errors:
            print(f"\n❌ Error Summary ({len(all_errors)} errors):")
            # Show unique errors
            unique_errors = list(set(all_errors[:20]))  # Limit to first 20 unique errors
            for error in unique_errors:
                print(f"  - {error}")
            
            if len(all_errors) > 20:
                print(f"  ... and {len(all_errors) - 20} more errors")
        
        return total_successful, total_failed, overall_time
    
    async def run_performance_tests(self):
        """Run performance tests on the created data"""
        print("\n📊 Running performance tests on created data...")
        
        async with self.session_maker() as session:
            # Test 1: Count all companies
            count_start = time.time()
            from sqlalchemy import func, select
            
            result = await session.execute(select(func.count(Company.id)))
            total_count = result.scalar()
            count_time = time.time() - count_start
            
            print(f"✅ Count Query: {total_count} companies in {count_time:.3f}s")
            
            # Test 2: Search by name (index test)
            search_start = time.time()
            result = await session.execute(
                select(Company).where(Company.company_name.like('%Global%')).limit(100)
            )
            search_results = result.scalars().all()
            search_time = time.time() - search_start
            
            print(f"✅ Search Query: Found {len(search_results)} companies with 'Global' in {search_time:.3f}s")
            
            # Test 3: Filter by active status
            filter_start = time.time()
            result = await session.execute(
                select(Company).where(Company.is_active == True).limit(100)
            )
            filter_results = result.scalars().all()
            filter_time = time.time() - filter_start
            
            print(f"✅ Filter Query: Found {len(filter_results)} active companies in {filter_time:.3f}s")
            
            # Test 4: Complex query with multiple filters
            complex_start = time.time()
            result = await session.execute(
                select(Company).where(
                    (Company.is_active == True) &
                    (Company.email.isnot(None)) &
                    (Company.gst_no.isnot(None))
                ).limit(100)
            )
            complex_results = result.scalars().all()
            complex_time = time.time() - complex_start
            
            print(f"✅ Complex Query: Found {len(complex_results)} companies with email & GST in {complex_time:.3f}s")
    
    def get_memory_usage(self) -> float:
        """Get current memory usage in MB"""
        try:
            import psutil
            process = psutil.Process(os.getpid())
            return process.memory_info().rss / 1024 / 1024  # Convert to MB
        except ImportError:
            return 0.0
    
    async def cleanup_test_data(self, keep_sample: bool = True):
        """Clean up test data after stress test"""
        if not keep_sample:
            print("\n🧹 Cleaning up all test data...")
            await self.clear_existing_test_data()
        else:
            print("\n🧹 Keeping test data for further analysis")
            print("To clean up later, run: await self.clear_existing_test_data()")


async def main():
    """Main function to run the complete stress test suite"""
    print("🧪 Company Stress Test Suite - 10,000 Companies")
    print("="*60)
    
    runner = StressTestRunner()
    
    try:
        # Setup
        await runner.setup_database()
        
        # Clear existing test data
        await runner.clear_existing_test_data()
        
        # Run stress test with different batch sizes for comparison
        batch_sizes = [50, 100, 200]
        
        for batch_size in batch_sizes:
            print(f"\n🎯 Testing with batch size: {batch_size}")
            print("-" * 40)
            
            # Run smaller test first
            test_size = 1000  # Test with 1000 companies first
            successful, failed, duration = await runner.run_stress_test(
                total_companies=test_size,
                batch_size=batch_size
            )
            
            print(f"\nBatch size {batch_size} results:")
            print(f"  Companies/second: {successful / duration:.2f}")
            print(f"  Success rate: {(successful / test_size * 100):.2f}%")
            
            # Clear data before next test
            await runner.clear_existing_test_data()
        
        # Run the full 10K test with optimal batch size
        print("\n" + "="*60)
        print("🚀 RUNNING FULL 10,000 COMPANY STRESS TEST")
        print("="*60)
        
        await runner.run_stress_test(
            total_companies=10000,
            batch_size=100  # Use optimal batch size from testing
        )
        
        # Run performance tests
        await runner.run_performance_tests()
        
        # Keep sample data for analysis
        await runner.cleanup_test_data(keep_sample=True)
        
        print("\n🎉 Stress test completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Stress test failed: {e}")
        raise
    finally:
        await runner.cleanup_database()


if __name__ == "__main__":
    # Check for required dependencies
    try:
        import asyncpg
        import sqlalchemy
    except ImportError as e:
        print(f"❌ Missing required dependency: {e}")
        print("Install with: pip install asyncpg sqlalchemy")
        sys.exit(1)
    
    # Run the stress test
    asyncio.run(main())