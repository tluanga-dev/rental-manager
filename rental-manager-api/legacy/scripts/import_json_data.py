#!/usr/bin/env python3
"""
Comprehensive JSON Data Import Script
Imports all dummy data from JSON files into the database
"""

import asyncio
import json
import sys
from pathlib import Path
from decimal import Decimal
from typing import Dict, List, Optional, Any
from datetime import datetime
from uuid import uuid4

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.core.database import AsyncSessionLocal, engine
from app.modules.master_data.units.models import UnitOfMeasurement
from app.modules.master_data.brands.models import Brand
from app.modules.master_data.categories.models import Category
from app.modules.master_data.locations.models import Location, LocationType
from app.modules.suppliers.models import Supplier, SupplierType, SupplierTier, SupplierStatus
from app.modules.customers.models import Customer, CustomerType, CustomerTier, CustomerStatus, BlacklistStatus, CreditRating
from app.modules.master_data.item_master.models import Item, ItemStatus

# ANSI color codes for output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'


class JSONDataImporter:
    """Imports data from JSON files into the database"""
    
    def __init__(self, dummy_data_path: str = None):
        if dummy_data_path is None:
            self.data_path = Path(__file__).parent.parent / "dummy_data"
        else:
            self.data_path = Path(dummy_data_path)
            
        self.session: Optional[AsyncSession] = None
        self.stats = {
            'units': {'created': 0, 'updated': 0, 'errors': 0},
            'brands': {'created': 0, 'updated': 0, 'errors': 0},
            'categories': {'created': 0, 'updated': 0, 'errors': 0},
            'locations': {'created': 0, 'updated': 0, 'errors': 0},
            'suppliers': {'created': 0, 'updated': 0, 'errors': 0},
            'customers': {'created': 0, 'updated': 0, 'errors': 0},
            'items': {'created': 0, 'updated': 0, 'errors': 0},
        }
        
        # Caches for ID lookups
        self.units_cache = {}  # code -> id
        self.brands_cache = {}  # code -> id
        self.categories_cache = {}  # code -> id
        self.locations_cache = {}  # code -> id
    
    def load_json_file(self, filename: str) -> List[Dict]:
        """Load JSON data from file"""
        file_path = self.data_path / filename
        if not file_path.exists():
            print(f"{Colors.FAIL}❌ File not found: {file_path}{Colors.ENDC}")
            return []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                print(f"{Colors.GREEN}✓ Loaded {len(data)} records from {filename}{Colors.ENDC}")
                return data
        except Exception as e:
            print(f"{Colors.FAIL}❌ Error loading {filename}: {e}{Colors.ENDC}")
            return []
    
    async def import_all(self):
        """Import all data in dependency order"""
        async with AsyncSessionLocal() as session:
            self.session = session
            
            try:
                await session.begin()
                
                print(f"\n{Colors.HEADER}{Colors.BOLD}=== Starting JSON Data Import ==={Colors.ENDC}")
                print(f"Data path: {self.data_path}")
                
                # Import in dependency order
                await self.import_units()
                await self.import_brands()
                await self.import_locations()
                await self.import_categories()
                await self.import_suppliers()
                await self.import_customers()
                await self.import_items()
                
                await session.commit()
                print(f"\n{Colors.GREEN}✅ All data committed successfully!{Colors.ENDC}")
                
                self.print_summary()
                
            except Exception as e:
                await session.rollback()
                print(f"\n{Colors.FAIL}❌ Import failed: {e}{Colors.ENDC}")
                raise
    
    async def import_units(self):
        """Import units of measurement"""
        print(f"\n{Colors.CYAN}📏 Importing Units of Measurement...{Colors.ENDC}")
        
        units_data = self.load_json_file("units.json")
        
        for unit_data in units_data:
            try:
                code = unit_data.get('code')
                name = unit_data.get('name')
                
                if not code or not name:
                    self.stats['units']['errors'] += 1
                    continue
                
                # Check if exists
                result = await self.session.execute(
                    select(UnitOfMeasurement).where(UnitOfMeasurement.code == code)
                )
                existing = result.scalar_one_or_none()
                
                if existing:
                    # Update existing
                    existing.name = name
                    existing.description = unit_data.get('description')
                    self.units_cache[code] = existing.id
                    self.stats['units']['updated'] += 1
                    print(f"  {Colors.WARNING}↻{Colors.ENDC} Updated unit: {name} ({code})")
                else:
                    # Create new
                    unit = UnitOfMeasurement(
                        name=name,
                        code=code,
                        abbreviation=code,  # Use code as abbreviation
                        description=unit_data.get('description')
                    )
                    self.session.add(unit)
                    await self.session.flush()
                    self.units_cache[code] = unit.id
                    self.stats['units']['created'] += 1
                    print(f"  {Colors.GREEN}✓{Colors.ENDC} Created unit: {name} ({code})")
                    
            except Exception as e:
                self.stats['units']['errors'] += 1
                print(f"  {Colors.FAIL}✗{Colors.ENDC} Error with unit {unit_data}: {e}")
    
    async def import_brands(self):
        """Import brands"""
        print(f"\n{Colors.CYAN}🏷️ Importing Brands...{Colors.ENDC}")
        
        brands_data = self.load_json_file("brands.json")
        
        for brand_data in brands_data:
            try:
                code = brand_data.get('code')
                name = brand_data.get('name')
                
                if not code or not name:
                    self.stats['brands']['errors'] += 1
                    continue
                
                # Check if exists
                result = await self.session.execute(
                    select(Brand).where(Brand.code == code)
                )
                existing = result.scalar_one_or_none()
                
                if existing:
                    # Update existing
                    existing.name = name
                    existing.description = brand_data.get('description')
                    self.brands_cache[code] = existing.id
                    self.stats['brands']['updated'] += 1
                    print(f"  {Colors.WARNING}↻{Colors.ENDC} Updated brand: {name} ({code})")
                else:
                    # Create new
                    brand = Brand(
                        name=name,
                        code=code,
                        description=brand_data.get('description')
                    )
                    self.session.add(brand)
                    await self.session.flush()
                    self.brands_cache[code] = brand.id
                    self.stats['brands']['created'] += 1
                    print(f"  {Colors.GREEN}✓{Colors.ENDC} Created brand: {name} ({code})")
                    
            except Exception as e:
                self.stats['brands']['errors'] += 1
                print(f"  {Colors.FAIL}✗{Colors.ENDC} Error with brand {brand_data}: {e}")
    
    async def import_locations(self):
        """Import locations"""
        print(f"\n{Colors.CYAN}📍 Importing Locations...{Colors.ENDC}")
        
        locations_data = self.load_json_file("locations.json")
        
        for location_data in locations_data:
            try:
                location_code = location_data.get('location_code')
                location_name = location_data.get('location_name')
                
                if not location_code or not location_name:
                    self.stats['locations']['errors'] += 1
                    continue
                
                # Check if exists
                result = await self.session.execute(
                    select(Location).where(Location.location_code == location_code)
                )
                existing = result.scalar_one_or_none()
                
                if existing:
                    # Update existing
                    existing.location_name = location_name
                    existing.location_type = LocationType[location_data.get('location_type', 'WAREHOUSE')]
                    existing.address = location_data.get('address')
                    existing.city = location_data.get('city')
                    existing.state = location_data.get('state')
                    existing.postal_code = location_data.get('postal_code')
                    existing.country = location_data.get('country')
                    existing.contact_number = location_data.get('contact_number')
                    existing.email = location_data.get('email')
                    self.locations_cache[location_code] = existing.id
                    self.stats['locations']['updated'] += 1
                    print(f"  {Colors.WARNING}↻{Colors.ENDC} Updated location: {location_name}")
                else:
                    # Create new
                    location = Location(
                        location_code=location_code,
                        location_name=location_name,
                        location_type=LocationType[location_data.get('location_type', 'WAREHOUSE')],
                        address=location_data.get('address'),
                        city=location_data.get('city'),
                        state=location_data.get('state'),
                        postal_code=location_data.get('postal_code'),
                        country=location_data.get('country'),
                        contact_number=location_data.get('contact_number'),
                        email=location_data.get('email')
                    )
                    self.session.add(location)
                    await self.session.flush()
                    self.locations_cache[location_code] = location.id
                    self.stats['locations']['created'] += 1
                    print(f"  {Colors.GREEN}✓{Colors.ENDC} Created location: {location_name}")
                    
            except Exception as e:
                self.stats['locations']['errors'] += 1
                print(f"  {Colors.FAIL}✗{Colors.ENDC} Error with location {location_data}: {e}")
    
    async def import_categories(self):
        """Import categories with hierarchy"""
        print(f"\n{Colors.CYAN}📂 Importing Categories...{Colors.ENDC}")
        
        categories_data = self.load_json_file("categories.json")
        
        # First pass: import root categories (no parent)
        for cat_data in categories_data:
            if cat_data.get('parent_category_id') is None:
                await self.import_single_category(cat_data)
        
        # Second pass: import child categories
        for cat_data in categories_data:
            if cat_data.get('parent_category_id') is not None:
                await self.import_single_category(cat_data)
    
    async def import_single_category(self, cat_data: Dict):
        """Import a single category"""
        try:
            category_code = cat_data.get('category_code')
            name = cat_data.get('name')
            
            if not category_code or not name:
                self.stats['categories']['errors'] += 1
                return
            
            # Check if exists
            result = await self.session.execute(
                select(Category).where(Category.category_code == category_code)
            )
            existing = result.scalar_one_or_none()
            
            # Get parent ID if specified
            parent_id = None
            parent_code = cat_data.get('parent_category_id')
            if parent_code:
                parent_id = self.categories_cache.get(parent_code)
            
            if existing:
                # Update existing
                existing.name = name
                existing.parent_category_id = parent_id
                existing.category_path = cat_data.get('category_path')
                existing.category_level = cat_data.get('category_level', 1)
                existing.display_order = cat_data.get('display_order', 0)
                existing.is_leaf = cat_data.get('is_leaf', False)
                self.categories_cache[category_code] = existing.id
                self.stats['categories']['updated'] += 1
                print(f"  {Colors.WARNING}↻{Colors.ENDC} Updated category: {name}")
            else:
                # Create new
                category = Category(
                    category_code=category_code,
                    name=name,
                    parent_category_id=parent_id,
                    category_path=cat_data.get('category_path'),
                    category_level=cat_data.get('category_level', 1),
                    display_order=cat_data.get('display_order', 0),
                    is_leaf=cat_data.get('is_leaf', False)
                )
                self.session.add(category)
                await self.session.flush()
                self.categories_cache[category_code] = category.id
                self.stats['categories']['created'] += 1
                print(f"  {Colors.GREEN}✓{Colors.ENDC} Created category: {name}")
                
        except Exception as e:
            self.stats['categories']['errors'] += 1
            print(f"  {Colors.FAIL}✗{Colors.ENDC} Error with category {cat_data}: {e}")
    
    async def import_suppliers(self):
        """Import suppliers"""
        print(f"\n{Colors.CYAN}🏢 Importing Suppliers...{Colors.ENDC}")
        
        suppliers_data = self.load_json_file("suppliers.json")
        
        for supplier_data in suppliers_data:
            try:
                supplier_code = supplier_data.get('supplier_code')
                company_name = supplier_data.get('company_name')
                
                if not supplier_code or not company_name:
                    self.stats['suppliers']['errors'] += 1
                    continue
                
                # Check if exists
                result = await self.session.execute(
                    select(Supplier).where(Supplier.supplier_code == supplier_code)
                )
                existing = result.scalar_one_or_none()
                
                if existing:
                    self.stats['suppliers']['updated'] += 1
                    print(f"  {Colors.WARNING}↻{Colors.ENDC} Skipped existing supplier: {company_name}")
                else:
                    # Create new supplier
                    supplier = Supplier(
                        supplier_code=supplier_code,
                        company_name=company_name,
                        supplier_type=SupplierType[supplier_data.get('supplier_type', 'GENERAL')],
                        contact_person=supplier_data.get('contact_person'),
                        email=supplier_data.get('email'),
                        phone=supplier_data.get('phone'),
                        mobile=supplier_data.get('mobile'),
                        address_line1=supplier_data.get('address_line1'),
                        address_line2=supplier_data.get('address_line2'),
                        city=supplier_data.get('city'),
                        state=supplier_data.get('state'),
                        postal_code=supplier_data.get('postal_code'),
                        country=supplier_data.get('country'),
                        tax_id=supplier_data.get('tax_id'),
                        payment_terms=supplier_data.get('payment_terms', 'NET30'),
                        credit_limit=Decimal(str(supplier_data.get('credit_limit', 0))),
                        supplier_tier=SupplierTier[supplier_data.get('supplier_tier', 'STANDARD')],
                        status=SupplierStatus[supplier_data.get('status', 'ACTIVE')],
                        quality_rating=float(supplier_data.get('quality_rating', 0)) if supplier_data.get('quality_rating') else None,
                        delivery_rating=float(supplier_data.get('delivery_rating', 0)) if supplier_data.get('delivery_rating') else None,
                        notes=supplier_data.get('notes'),
                        website=supplier_data.get('website'),
                        account_manager=supplier_data.get('account_manager'),
                        preferred_payment_method=supplier_data.get('preferred_payment_method'),
                        certifications=supplier_data.get('certifications')
                    )
                    self.session.add(supplier)
                    self.stats['suppliers']['created'] += 1
                    print(f"  {Colors.GREEN}✓{Colors.ENDC} Created supplier: {company_name}")
                    
            except Exception as e:
                self.stats['suppliers']['errors'] += 1
                print(f"  {Colors.FAIL}✗{Colors.ENDC} Error with supplier {supplier_data.get('supplier_code')}: {e}")
    
    async def import_customers(self):
        """Import customers"""
        print(f"\n{Colors.CYAN}👥 Importing Customers...{Colors.ENDC}")
        
        customers_data = self.load_json_file("customers.json")
        
        for customer_data in customers_data:
            try:
                customer_code = customer_data.get('customer_code')
                
                if not customer_code:
                    self.stats['customers']['errors'] += 1
                    continue
                
                # Check if exists
                result = await self.session.execute(
                    select(Customer).where(Customer.customer_code == customer_code)
                )
                existing = result.scalar_one_or_none()
                
                if existing:
                    self.stats['customers']['updated'] += 1
                    print(f"  {Colors.WARNING}↻{Colors.ENDC} Skipped existing customer: {customer_code}")
                else:
                    # Determine display name
                    if customer_data.get('customer_type') == 'BUSINESS':
                        display_name = customer_data.get('business_name')
                    else:
                        display_name = f"{customer_data.get('first_name')} {customer_data.get('last_name')}"
                    
                    # Create new customer
                    customer = Customer(
                        customer_code=customer_code,
                        customer_type=CustomerType[customer_data.get('customer_type', 'INDIVIDUAL')],
                        business_name=customer_data.get('business_name'),
                        first_name=customer_data.get('first_name'),
                        last_name=customer_data.get('last_name'),
                        email=customer_data.get('email'),
                        phone=customer_data.get('phone'),
                        mobile=customer_data.get('mobile'),
                        address_line1=customer_data.get('address_line1'),
                        address_line2=customer_data.get('address_line2'),
                        city=customer_data.get('city'),
                        state=customer_data.get('state'),
                        postal_code=customer_data.get('postal_code'),
                        country=customer_data.get('country'),
                        tax_number=customer_data.get('tax_number'),
                        payment_terms=customer_data.get('payment_terms'),
                        customer_tier=CustomerTier[customer_data.get('customer_tier', 'BRONZE')],
                        credit_limit=Decimal(str(customer_data.get('credit_limit', 0))),
                        status=CustomerStatus[customer_data.get('status', 'ACTIVE')],
                        blacklist_status=BlacklistStatus[customer_data.get('blacklist_status', 'CLEAR')],
                        credit_rating=CreditRating[customer_data.get('credit_rating', 'GOOD')],
                        notes=customer_data.get('notes')
                    )
                    self.session.add(customer)
                    self.stats['customers']['created'] += 1
                    print(f"  {Colors.GREEN}✓{Colors.ENDC} Created customer: {display_name} ({customer_code})")
                    
            except Exception as e:
                self.stats['customers']['errors'] += 1
                print(f"  {Colors.FAIL}✗{Colors.ENDC} Error with customer {customer_data.get('customer_code')}: {e}")
    
    async def import_items(self):
        """Import items"""
        print(f"\n{Colors.CYAN}📦 Importing Items...{Colors.ENDC}")
        
        # Use the enhanced items file with 250+ items
        items_data = self.load_json_file("items_enhanced_250.json")
        
        for item_data in items_data:
            try:
                sku = item_data.get('sku')
                item_name = item_data.get('item_name')
                
                if not sku or not item_name:
                    self.stats['items']['errors'] += 1
                    continue
                
                # Check if exists
                result = await self.session.execute(
                    select(Item).where(Item.sku == sku)
                )
                existing = result.scalar_one_or_none()
                
                if existing:
                    self.stats['items']['updated'] += 1
                    print(f"  {Colors.WARNING}↻{Colors.ENDC} Skipped existing item: {item_name}")
                    continue
                
                # Get foreign key IDs
                unit_id = self.units_cache.get(item_data.get('unit_of_measurement_code'))
                brand_id = self.brands_cache.get(item_data.get('brand_code'))
                category_id = self.categories_cache.get(item_data.get('category_code'))
                
                if not unit_id:
                    print(f"  {Colors.WARNING}⚠{Colors.ENDC} Unit not found for item {item_name}: {item_data.get('unit_of_measurement_code')}")
                    self.stats['items']['errors'] += 1
                    continue
                
                # Create new item
                item = Item(
                    sku=sku,
                    item_name=item_name,
                    item_status=ItemStatus[item_data.get('item_status', 'ACTIVE')],
                    unit_of_measurement_id=unit_id,
                    brand_id=brand_id,
                    category_id=category_id,
                    model_number=item_data.get('model_number'),
                    description=item_data.get('description'),
                    specifications=item_data.get('specifications'),
                    rental_rate_per_period=Decimal(str(item_data.get('rental_rate_per_period', 0))),
                    rental_period=item_data.get('rental_period', '1'),
                    sale_price=Decimal(str(item_data.get('sale_price', 0))) if item_data.get('sale_price') else None,
                    purchase_price=Decimal(str(item_data.get('purchase_price', 0))),
                    security_deposit=Decimal(str(item_data.get('security_deposit', 0))),
                    warranty_period_days=item_data.get('warranty_period_days', '0'),
                    reorder_point=int(item_data.get('reorder_point', 0)),
                    is_rentable=item_data.get('is_rentable', True),
                    is_saleable=item_data.get('is_saleable', False),
                    serial_number_required=item_data.get('serial_number_required', False)
                )
                self.session.add(item)
                self.stats['items']['created'] += 1
                
                # Print progress every 10 items
                if self.stats['items']['created'] % 10 == 0:
                    print(f"  {Colors.BLUE}...{Colors.ENDC} Processed {self.stats['items']['created']} items")
                    
            except Exception as e:
                self.stats['items']['errors'] += 1
                print(f"  {Colors.FAIL}✗{Colors.ENDC} Error with item {item_data.get('sku')}: {e}")
        
        print(f"  {Colors.GREEN}✓{Colors.ENDC} Completed importing {self.stats['items']['created']} items")
    
    def print_summary(self):
        """Print import summary"""
        print(f"\n{Colors.HEADER}{Colors.BOLD}=== Import Summary ==={Colors.ENDC}")
        
        total_created = sum(stat['created'] for stat in self.stats.values())
        total_updated = sum(stat['updated'] for stat in self.stats.values())
        total_errors = sum(stat['errors'] for stat in self.stats.values())
        
        print(f"\n{Colors.CYAN}Overall Statistics:{Colors.ENDC}")
        print(f"  Total Records Created: {Colors.GREEN}{total_created}{Colors.ENDC}")
        print(f"  Total Records Updated: {Colors.WARNING}{total_updated}{Colors.ENDC}")
        print(f"  Total Errors: {Colors.FAIL}{total_errors}{Colors.ENDC}")
        
        print(f"\n{Colors.CYAN}Breakdown by Entity:{Colors.ENDC}")
        for entity, stat in self.stats.items():
            print(f"  {entity.capitalize()}:")
            print(f"    Created: {Colors.GREEN}{stat['created']}{Colors.ENDC}")
            print(f"    Updated: {Colors.WARNING}{stat['updated']}{Colors.ENDC}")
            print(f"    Errors: {Colors.FAIL}{stat['errors']}{Colors.ENDC}")
        
        if total_errors > 0:
            print(f"\n{Colors.WARNING}⚠ Some records failed to import. Check the error messages above.{Colors.ENDC}")
        else:
            print(f"\n{Colors.GREEN}✅ Import completed successfully with no errors!{Colors.ENDC}")


async def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Import JSON dummy data into database')
    parser.add_argument('--path', help='Path to dummy_data folder', 
                        default='/Users/tluanga/current_work/rental-manager/rental-manager-backend/dummy_data')
    
    args = parser.parse_args()
    
    try:
        importer = JSONDataImporter(args.path)
        await importer.import_all()
    except Exception as e:
        print(f"\n{Colors.FAIL}Import failed with error: {e}{Colors.ENDC}")
        sys.exit(1)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())