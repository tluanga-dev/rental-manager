"""
Seed Manager Module

Handles data seeding operations for the rental management system.
Loads data from JSON files and populates database tables with proper dependency handling.
"""

import json
import logging
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path
from datetime import datetime
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession
from rich.console import Console
from rich.progress import Progress, TaskID
from rich.table import Table
from rich.panel import Panel
from rich.prompt import Confirm

# Import models from existing rental-manager-api
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "rental-manager-api"))

from app.models.brand import Brand
from app.models.category import Category
from app.models.customer import Customer
from app.models.supplier import Supplier
from app.models.location import Location
from app.models.item import Item
from app.models.company import Company
from app.models.unit_of_measurement import UnitOfMeasurement
from app.models.user import User, UserRole
from app.core.security import SecurityManager

logger = logging.getLogger(__name__)
console = Console()


class SeedManager:
    """Manages data seeding operations"""
    
    # Seeding order based on dependencies
    SEED_ORDER = [
        'companies',
        'users',
        'brands',
        'categories',
        'units_of_measurement',
        'locations',
        'suppliers',
        'customers',
        'items'
    ]
    
    # Model mapping
    MODEL_MAP = {
        'brands': Brand,
        'categories': Category,
        'customers': Customer,
        'suppliers': Supplier,
        'locations': Location,
        'items': Item,
        'companies': Company,
        'units_of_measurement': UnitOfMeasurement,
        'users': User
    }
    
    # File mapping
    FILE_MAP = {
        'brands': 'brands.json',
        'categories': 'categories.json',
        'customers': 'customers.json',
        'suppliers': 'suppliers.json',
        'locations': 'locations.json',
        'items': 'items.json',
        'companies': 'companies.json',
        'units_of_measurement': 'units.json',
        'users': 'users.json'
    }
    
    def __init__(self, session: AsyncSession, data_dir: Path):
        self.session = session
        self.data_dir = data_dir
        self._seeded_data = {}
    
    def load_seed_file(self, entity_type: str) -> Tuple[bool, List[Dict[str, Any]], str]:
        """Load seed data from JSON file"""
        try:
            file_name = self.FILE_MAP.get(entity_type)
            if not file_name:
                return False, [], f"No file mapping for entity type: {entity_type}"
            
            file_path = self.data_dir / file_name
            if not file_path.exists():
                return False, [], f"Seed file not found: {file_path}"
            
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Handle both array format and object format
            if isinstance(data, dict):
                if 'data' in data:
                    data = data['data']
                elif entity_type in data:
                    data = data[entity_type]
                else:
                    # Assume the dict itself is the data
                    data = [data]
            
            if not isinstance(data, list):
                return False, [], f"Seed data must be a list, got {type(data)}"
            
            return True, data, f"Loaded {len(data)} records from {file_name}"
            
        except json.JSONDecodeError as e:
            return False, [], f"Invalid JSON in seed file: {str(e)}"
        except Exception as e:
            return False, [], f"Error loading seed file: {str(e)}"
    
    async def check_existing_data(self, entity_type: str) -> Tuple[int, bool]:
        """Check if entity type already has data"""
        try:
            model_class = self.MODEL_MAP.get(entity_type)
            if not model_class:
                return 0, False
            
            stmt = select(model_class)
            result = await self.session.execute(stmt)
            existing_count = len(result.scalars().all())
            
            return existing_count, existing_count > 0
            
        except Exception as e:
            logger.error(f"Error checking existing data for {entity_type}: {e}")
            return 0, False
    
    async def seed_brands(self, brand_data: List[Dict[str, Any]], skip_existing: bool = True) -> Tuple[int, List[str]]:
        """Seed brand data"""
        created_count = 0
        errors = []
        
        try:
            for brand_info in brand_data:
                try:
                    # Check if brand already exists
                    if skip_existing:
                        existing_stmt = select(Brand).where(
                            Brand.brand_name == brand_info.get('brand_name') or 
                            Brand.brand_code == brand_info.get('brand_code')
                        )
                        existing = await self.session.execute(existing_stmt)
                        if existing.scalar_one_or_none():
                            continue
                    
                    # Create brand
                    brand = Brand(
                        brand_name=brand_info['brand_name'],
                        brand_code=brand_info.get('brand_code'),
                        description=brand_info.get('description'),
                        website=brand_info.get('website'),
                        contact_info=brand_info.get('contact_info'),
                        is_active=brand_info.get('is_active', True)
                    )
                    
                    self.session.add(brand)
                    created_count += 1
                    
                except Exception as e:
                    errors.append(f"Error creating brand {brand_info.get('brand_name', 'unknown')}: {str(e)}")
            
            return created_count, errors
            
        except Exception as e:
            errors.append(f"Error in seed_brands: {str(e)}")
            return created_count, errors
    
    async def seed_categories(self, category_data: List[Dict[str, Any]], skip_existing: bool = True) -> Tuple[int, List[str]]:
        """Seed category data with hierarchy support"""
        created_count = 0
        errors = []
        
        try:
            # First pass: create all categories without parent relationships
            category_map = {}
            
            for category_info in category_data:
                try:
                    # Check if category already exists
                    if skip_existing:
                        existing_stmt = select(Category).where(
                            Category.category_name == category_info.get('category_name') or
                            Category.category_code == category_info.get('category_code')
                        )
                        existing = await self.session.execute(existing_stmt)
                        if existing.scalar_one_or_none():
                            continue
                    
                    # Create category
                    category = Category(
                        category_name=category_info['category_name'],
                        category_code=category_info.get('category_code'),
                        description=category_info.get('description'),
                        is_active=category_info.get('is_active', True)
                    )
                    
                    self.session.add(category)
                    await self.session.flush()  # Get ID
                    
                    category_map[category_info['category_name']] = category
                    created_count += 1
                    
                except Exception as e:
                    errors.append(f"Error creating category {category_info.get('category_name', 'unknown')}: {str(e)}")
            
            # Second pass: set parent relationships
            for category_info in category_data:
                parent_name = category_info.get('parent_category')
                if parent_name and parent_name in category_map:
                    category_name = category_info['category_name']
                    if category_name in category_map:
                        category_map[category_name].parent_id = category_map[parent_name].id
            
            return created_count, errors
            
        except Exception as e:
            errors.append(f"Error in seed_categories: {str(e)}")
            return created_count, errors
    
    async def seed_units_of_measurement(self, unit_data: List[Dict[str, Any]], skip_existing: bool = True) -> Tuple[int, List[str]]:
        """Seed unit of measurement data"""
        created_count = 0
        errors = []
        
        try:
            for unit_info in unit_data:
                try:
                    # Check if unit already exists
                    if skip_existing:
                        existing_stmt = select(UnitOfMeasurement).where(
                            UnitOfMeasurement.unit_name == unit_info.get('unit_name') or
                            UnitOfMeasurement.unit_symbol == unit_info.get('unit_symbol')
                        )
                        existing = await self.session.execute(existing_stmt)
                        if existing.scalar_one_or_none():
                            continue
                    
                    # Create unit
                    unit = UnitOfMeasurement(
                        unit_name=unit_info['unit_name'],
                        unit_symbol=unit_info.get('unit_symbol'),
                        unit_type=unit_info.get('unit_type', 'general'),
                        description=unit_info.get('description'),
                        conversion_factor=unit_info.get('conversion_factor', 1.0),
                        is_active=unit_info.get('is_active', True)
                    )
                    
                    self.session.add(unit)
                    created_count += 1
                    
                except Exception as e:
                    errors.append(f"Error creating unit {unit_info.get('unit_name', 'unknown')}: {str(e)}")
            
            return created_count, errors
            
        except Exception as e:
            errors.append(f"Error in seed_units_of_measurement: {str(e)}")
            return created_count, errors
    
    async def seed_locations(self, location_data: List[Dict[str, Any]], skip_existing: bool = True) -> Tuple[int, List[str]]:
        """Seed location data"""
        created_count = 0
        errors = []
        
        try:
            for location_info in location_data:
                try:
                    # Check if location already exists
                    if skip_existing:
                        existing_stmt = select(Location).where(
                            Location.location_name == location_info.get('location_name') or
                            Location.location_code == location_info.get('location_code')
                        )
                        existing = await self.session.execute(existing_stmt)
                        if existing.scalar_one_or_none():
                            continue
                    
                    # Create location
                    location = Location(
                        location_name=location_info['location_name'],
                        location_code=location_info.get('location_code'),
                        location_type=location_info.get('location_type', 'warehouse'),
                        address=location_info.get('address'),
                        city=location_info.get('city'),
                        state=location_info.get('state'),
                        postal_code=location_info.get('postal_code'),
                        country=location_info.get('country'),
                        phone=location_info.get('phone'),
                        email=location_info.get('email'),
                        is_active=location_info.get('is_active', True)
                    )
                    
                    self.session.add(location)
                    created_count += 1
                    
                except Exception as e:
                    errors.append(f"Error creating location {location_info.get('location_name', 'unknown')}: {str(e)}")
            
            return created_count, errors
            
        except Exception as e:
            errors.append(f"Error in seed_locations: {str(e)}")
            return created_count, errors
    
    async def seed_customers(self, customer_data: List[Dict[str, Any]], skip_existing: bool = True) -> Tuple[int, List[str]]:
        """Seed customer data"""
        created_count = 0
        errors = []
        
        try:
            for customer_info in customer_data:
                try:
                    # Check if customer already exists
                    if skip_existing:
                        existing_stmt = select(Customer).where(
                            Customer.email == customer_info.get('email') or
                            Customer.phone == customer_info.get('phone')
                        )
                        existing = await self.session.execute(existing_stmt)
                        if existing.scalar_one_or_none():
                            continue
                    
                    # Create customer
                    customer = Customer(
                        first_name=customer_info['first_name'],
                        last_name=customer_info.get('last_name', ''),
                        email=customer_info.get('email'),
                        phone=customer_info.get('phone'),
                        address=customer_info.get('address'),
                        city=customer_info.get('city'),
                        state=customer_info.get('state'),
                        postal_code=customer_info.get('postal_code'),
                        country=customer_info.get('country'),
                        customer_type=customer_info.get('customer_type', 'individual'),
                        company_name=customer_info.get('company_name'),
                        is_active=customer_info.get('is_active', True)
                    )
                    
                    self.session.add(customer)
                    created_count += 1
                    
                except Exception as e:
                    errors.append(f"Error creating customer {customer_info.get('email', 'unknown')}: {str(e)}")
            
            return created_count, errors
            
        except Exception as e:
            errors.append(f"Error in seed_customers: {str(e)}")
            return created_count, errors
    
    async def seed_suppliers(self, supplier_data: List[Dict[str, Any]], skip_existing: bool = True) -> Tuple[int, List[str]]:
        """Seed supplier data"""
        created_count = 0
        errors = []
        
        try:
            for supplier_info in supplier_data:
                try:
                    # Check if supplier already exists
                    if skip_existing:
                        existing_stmt = select(Supplier).where(
                            Supplier.supplier_name == supplier_info.get('supplier_name') or
                            Supplier.email == supplier_info.get('email')
                        )
                        existing = await self.session.execute(existing_stmt)
                        if existing.scalar_one_or_none():
                            continue
                    
                    # Create supplier
                    supplier = Supplier(
                        supplier_name=supplier_info['supplier_name'],
                        supplier_code=supplier_info.get('supplier_code'),
                        contact_person=supplier_info.get('contact_person'),
                        email=supplier_info.get('email'),
                        phone=supplier_info.get('phone'),
                        address=supplier_info.get('address'),
                        city=supplier_info.get('city'),
                        state=supplier_info.get('state'),
                        postal_code=supplier_info.get('postal_code'),
                        country=supplier_info.get('country'),
                        website=supplier_info.get('website'),
                        tax_id=supplier_info.get('tax_id'),
                        payment_terms=supplier_info.get('payment_terms'),
                        is_active=supplier_info.get('is_active', True)
                    )
                    
                    self.session.add(supplier)
                    created_count += 1
                    
                except Exception as e:
                    errors.append(f"Error creating supplier {supplier_info.get('supplier_name', 'unknown')}: {str(e)}")
            
            return created_count, errors
            
        except Exception as e:
            errors.append(f"Error in seed_suppliers: {str(e)}")
            return created_count, errors
    
    async def seed_users(self, user_data: List[Dict[str, Any]], skip_existing: bool = True) -> Tuple[int, List[str]]:
        """Seed user data"""
        created_count = 0
        errors = []
        
        try:
            for user_info in user_data:
                try:
                    # Check if user already exists
                    if skip_existing:
                        existing_stmt = select(User).where(
                            User.username == user_info.get('username') or
                            User.email == user_info.get('email')
                        )
                        existing = await self.session.execute(existing_stmt)
                        if existing.scalar_one_or_none():
                            continue
                    
                    # Create user
                    hashed_password = SecurityManager.get_password_hash(user_info.get('password', 'default123'))
                    
                    user = User(
                        username=user_info['username'],
                        email=user_info['email'],
                        hashed_password=hashed_password,
                        first_name=user_info.get('first_name', ''),
                        last_name=user_info.get('last_name', ''),
                        phone=user_info.get('phone'),
                        role=user_info.get('role', UserRole.VIEWER.value),
                        is_active=user_info.get('is_active', True),
                        is_verified=user_info.get('is_verified', False),
                        is_superuser=user_info.get('is_superuser', False)
                    )
                    
                    self.session.add(user)
                    created_count += 1
                    
                except Exception as e:
                    errors.append(f"Error creating user {user_info.get('username', 'unknown')}: {str(e)}")
            
            return created_count, errors
            
        except Exception as e:
            errors.append(f"Error in seed_users: {str(e)}")
            return created_count, errors
    
    async def seed_entity(self, entity_type: str, skip_existing: bool = True) -> Tuple[int, List[str], str]:
        """Seed a specific entity type"""
        
        # Load seed data
        success, seed_data, message = self.load_seed_file(entity_type)
        if not success:
            return 0, [message], message
        
        if not seed_data:
            return 0, [], f"No seed data found for {entity_type}"
        
        # Check existing data
        existing_count, has_existing = await self.check_existing_data(entity_type)
        
        if has_existing and skip_existing:
            return 0, [], f"Skipped {entity_type}: {existing_count} records already exist"
        
        # Seed based on entity type
        seed_methods = {
            'brands': self.seed_brands,
            'categories': self.seed_categories,
            'units_of_measurement': self.seed_units_of_measurement,
            'locations': self.seed_locations,
            'customers': self.seed_customers,
            'suppliers': self.seed_suppliers,
            'users': self.seed_users
        }
        
        seed_method = seed_methods.get(entity_type)
        if not seed_method:
            return 0, [f"No seed method for entity type: {entity_type}"], f"Unsupported entity type: {entity_type}"
        
        # Execute seeding
        try:
            created_count, errors = await seed_method(seed_data, skip_existing)
            
            if created_count > 0:
                await self.session.commit()
                success_msg = f"Successfully seeded {created_count} {entity_type}"
            else:
                success_msg = f"No new {entity_type} records created"
            
            return created_count, errors, success_msg
            
        except Exception as e:
            await self.session.rollback()
            error_msg = f"Failed to seed {entity_type}: {str(e)}"
            logger.error(error_msg)
            return 0, [error_msg], error_msg
    
    async def seed_all(self, skip_existing: bool = True) -> Dict[str, Any]:
        """Seed all entities in the correct dependency order"""
        results = {
            'total_created': 0,
            'entity_results': {},
            'errors': [],
            'success': True
        }
        
        console.print("[bold blue]Starting comprehensive data seeding...[/bold blue]")
        
        with Progress() as progress:
            task = progress.add_task("Seeding data...", total=len(self.SEED_ORDER))
            
            for entity_type in self.SEED_ORDER:
                progress.update(task, description=f"Seeding {entity_type}...")
                
                created_count, errors, message = await self.seed_entity(entity_type, skip_existing)
                
                results['entity_results'][entity_type] = {
                    'created_count': created_count,
                    'errors': errors,
                    'message': message
                }
                
                results['total_created'] += created_count
                results['errors'].extend(errors)
                
                if errors:
                    console.print(f"[yellow]Warning in {entity_type}: {len(errors)} errors[/yellow]")
                else:
                    console.print(f"[green]✓ {entity_type}: {message}[/green]")
                
                progress.advance(task)
        
        results['success'] = len(results['errors']) == 0
        
        return results
    
    def display_seed_results(self, results: Dict[str, Any]) -> None:
        """Display seeding results in a formatted table"""
        entity_results = results['entity_results']
        total_created = results['total_created']
        total_errors = len(results['errors'])
        
        table = Table(title="Seed Results Summary", show_header=True, header_style="bold magenta")
        
        table.add_column("Entity Type", style="bold blue")
        table.add_column("Records Created", justify="right", style="green")
        table.add_column("Errors", justify="right", style="red")
        table.add_column("Status", style="yellow")
        
        for entity_type, result in entity_results.items():
            status = "✅ Success" if not result['errors'] else "⚠️ With Errors"
            
            table.add_row(
                entity_type.replace('_', ' ').title(),
                str(result['created_count']),
                str(len(result['errors'])),
                status
            )
        
        console.print(table)
        
        # Summary
        status_color = "green" if total_errors == 0 else "yellow"
        console.print(f"\n[{status_color}]Total records created: {total_created}[/{status_color}]")
        console.print(f"[{status_color}]Total errors: {total_errors}[/{status_color}]")
        
        # Show errors if any
        if results['errors']:
            console.print("\n[bold red]Errors encountered:[/bold red]")
            for error in results['errors'][:10]:  # Show first 10 errors
                console.print(f"  • {error}")
            
            if len(results['errors']) > 10:
                console.print(f"  ... and {len(results['errors']) - 10} more errors")
    
    def validate_seed_files(self) -> Dict[str, Any]:
        """Validate all seed files"""
        validation_results = {
            'valid_files': [],
            'invalid_files': [],
            'missing_files': [],
            'total_records': 0
        }
        
        for entity_type in self.SEED_ORDER:
            file_name = self.FILE_MAP.get(entity_type)
            if not file_name:
                validation_results['invalid_files'].append(f"{entity_type}: No file mapping")
                continue
            
            file_path = self.data_dir / file_name
            if not file_path.exists():
                validation_results['missing_files'].append(f"{entity_type}: {file_name} not found")
                continue
            
            success, data, message = self.load_seed_file(entity_type)
            if success:
                validation_results['valid_files'].append({
                    'entity_type': entity_type,
                    'file_name': file_name,
                    'record_count': len(data),
                    'message': message
                })
                validation_results['total_records'] += len(data)
            else:
                validation_results['invalid_files'].append(f"{entity_type}: {message}")
        
        return validation_results
    
    def display_validation_results(self, results: Dict[str, Any]) -> None:
        """Display seed file validation results"""
        valid_files = results['valid_files']
        invalid_files = results['invalid_files']
        missing_files = results['missing_files']
        
        if valid_files:
            table = Table(title="Valid Seed Files", show_header=True, header_style="bold green")
            table.add_column("Entity Type", style="bold blue")
            table.add_column("File Name", style="cyan")
            table.add_column("Records", justify="right", style="green")
            
            for file_info in valid_files:
                table.add_row(
                    file_info['entity_type'].replace('_', ' ').title(),
                    file_info['file_name'],
                    str(file_info['record_count'])
                )
            
            console.print(table)
        
        if missing_files:
            console.print(f"\n[bold yellow]Missing Files ({len(missing_files)}):[/bold yellow]")
            for missing in missing_files:
                console.print(f"  • {missing}")
        
        if invalid_files:
            console.print(f"\n[bold red]Invalid Files ({len(invalid_files)}):[/bold red]")
            for invalid in invalid_files:
                console.print(f"  • {invalid}")
        
        console.print(f"\n[bold blue]Total records available: {results['total_records']}[/bold blue]")