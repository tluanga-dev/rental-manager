#!/usr/bin/env python3
"""
Location Data Seeding Script

Generates 1000+ realistic locations with hierarchical structure and geographic distribution
for comprehensive location module testing.

Features:
- Hierarchical location structure (Countries -> States -> Cities -> Warehouses -> Zones)
- Realistic geographic coordinates and addresses
- Multiple location types with proper relationships
- Bulk insert operations for performance
- Progress tracking and detailed logging

Usage:
    python scripts/seed_locations.py
    
Environment Variables:
    SEED_LOCATIONS_COUNT: Number of locations to create (default: 1000)
    SEED_WITH_HIERARCHY: Enable hierarchical structure (default: true)
    SEED_WITH_COORDINATES: Generate realistic coordinates (default: true)
    DATABASE_URL: Database connection string
"""

import asyncio
import os
import random
import sys
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

import asyncpg
from faker import Faker
from faker.providers import automotive, company, geo

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.core.database import get_async_session
from app.models.location import Location, LocationType
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession


# Initialize Faker with multiple locales for geographic diversity
fake = Faker(['en_US', 'en_GB', 'en_CA', 'en_AU'])
fake.add_provider(automotive)
fake.add_provider(company)
fake.add_provider(geo)

# Seed configuration
SEED_COUNT = int(os.getenv('SEED_LOCATIONS_COUNT', 1000))
WITH_HIERARCHY = os.getenv('SEED_WITH_HIERARCHY', 'true').lower() == 'true'
WITH_COORDINATES = os.getenv('SEED_WITH_COORDINATES', 'true').lower() == 'true'

# Geographic regions for realistic distribution
REGIONS = {
    'North America': {
        'countries': ['United States', 'Canada', 'Mexico'],
        'lat_range': (25.0, 60.0),
        'lng_range': (-130.0, -60.0),
        'cities': [
            'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix',
            'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose',
            'Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Ottawa',
            'Mexico City', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana'
        ]
    },
    'Europe': {
        'countries': ['United Kingdom', 'Germany', 'France', 'Italy', 'Spain'],
        'lat_range': (36.0, 60.0),
        'lng_range': (-10.0, 30.0),
        'cities': [
            'London', 'Manchester', 'Birmingham', 'Liverpool', 'Leeds',
            'Berlin', 'Munich', 'Hamburg', 'Cologne', 'Frankfurt',
            'Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice',
            'Rome', 'Milan', 'Naples', 'Turin', 'Palermo',
            'Madrid', 'Barcelona', 'Valencia', 'Seville', 'Bilbao'
        ]
    },
    'Asia Pacific': {
        'countries': ['Australia', 'Japan', 'South Korea', 'Singapore', 'New Zealand'],
        'lat_range': (-45.0, 45.0),
        'lng_range': (100.0, 180.0),
        'cities': [
            'Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide',
            'Tokyo', 'Osaka', 'Yokohama', 'Nagoya', 'Sapporo',
            'Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon',
            'Singapore', 'Auckland', 'Wellington', 'Christchurch', 'Hamilton'
        ]
    }
}

# Location type distribution weights
TYPE_WEIGHTS = {
    LocationType.COUNTRY: 0.02,      # ~20 countries
    LocationType.STATE: 0.05,        # ~50 states/provinces
    LocationType.CITY: 0.15,         # ~150 cities
    LocationType.WAREHOUSE: 0.35,    # ~350 warehouses
    LocationType.ZONE: 0.25,         # ~250 zones
    LocationType.DOCK: 0.10,         # ~100 docks
    LocationType.SHELF: 0.08,        # ~80 shelves
}

# Business-specific location names
WAREHOUSE_NAMES = [
    'Central Distribution Center', 'North Regional Hub', 'South Logistics Center',
    'East Coast Facility', 'West Coast Depot', 'Metropolitan Warehouse',
    'Industrial Storage Complex', 'Automated Distribution Center', 'Cross-Dock Terminal',
    'Cold Storage Facility', 'Bulk Storage Center', 'Express Fulfillment Hub'
]

ZONE_NAMES = [
    'Receiving Area', 'Picking Zone', 'Packing Station', 'Shipping Bay',
    'Quality Control', 'Returns Processing', 'Overflow Storage', 'High-Value Items',
    'Temperature Controlled', 'Hazardous Materials', 'Bulk Items', 'Fast-Moving Goods'
]

DOCK_NAMES = [
    'Loading Dock A', 'Loading Dock B', 'Loading Dock C', 'Unloading Bay 1',
    'Unloading Bay 2', 'Express Lane', 'Truck Terminal', 'Container Bay',
    'Rail Siding', 'Cross-Dock Platform'
]

SHELF_NAMES = [
    'Aisle A-1', 'Aisle A-2', 'Aisle B-1', 'Aisle B-2', 'Aisle C-1',
    'High Rack Section', 'Medium Rack Section', 'Low Rack Section',
    'Bin Location', 'Pallet Rack', 'Cantilever Rack', 'Mezzanine Level'
]


class LocationSeeder:
    """Advanced location data seeder with hierarchical relationships."""
    
    def __init__(self):
        self.session: Optional[AsyncSession] = None
        self.created_locations: Dict[LocationType, List[Location]] = {
            loc_type: [] for loc_type in LocationType
        }
        self.total_created = 0
        
    async def connect_db(self):
        """Initialize database connection."""
        self.session = get_async_session()
        await self.session.__aenter__()
        
    async def disconnect_db(self):
        """Close database connection."""
        if self.session:
            await self.session.__aexit__(None, None, None)
            
    async def clear_existing_locations(self):
        """Clear existing location data for clean seeding."""
        print("🧹 Clearing existing location data...")
        await self.session.execute(text("DELETE FROM locations"))
        await self.session.commit()
        print("✅ Existing data cleared")
        
    def generate_coordinates(self, region: str, city: Optional[str] = None) -> Tuple[Decimal, Decimal]:
        """Generate realistic coordinates within a region."""
        if not WITH_COORDINATES:
            return Decimal('0.0'), Decimal('0.0')
            
        region_data = REGIONS[region]
        lat_min, lat_max = region_data['lat_range']
        lng_min, lng_max = region_data['lng_range']
        
        # Add some variation around city centers
        if city and random.random() < 0.7:  # 70% chance to cluster around cities
            lat_offset = random.uniform(-2.0, 2.0)
            lng_offset = random.uniform(-2.0, 2.0)
        else:
            lat_offset = 0
            lng_offset = 0
            
        latitude = Decimal(str(round(random.uniform(lat_min, lat_max) + lat_offset, 6)))
        longitude = Decimal(str(round(random.uniform(lng_min, lng_max) + lng_offset, 6)))
        
        return latitude, longitude
        
    def generate_address(self, country: str, city: str) -> Dict:
        """Generate realistic address components."""
        return {
            'street': fake.street_address(),
            'city': city,
            'state': fake.state() if country == 'United States' else fake.administrative_unit(),
            'postal_code': fake.postcode(),
            'country': country
        }
        
    def generate_metadata(self, location_type: LocationType) -> Dict:
        """Generate location-specific metadata."""
        base_metadata = {
            'created_by': 'data_seeder',
            'seeding_timestamp': datetime.now(timezone.utc).isoformat(),
            'region': random.choice(list(REGIONS.keys())),
            'is_active': random.choice([True] * 9 + [False]),  # 90% active
            'capacity_sqft': random.randint(1000, 50000) if location_type in [
                LocationType.WAREHOUSE, LocationType.ZONE
            ] else None
        }
        
        # Type-specific metadata
        if location_type == LocationType.WAREHOUSE:
            base_metadata.update({
                'warehouse_type': random.choice(['distribution', 'fulfillment', 'storage', 'cross_dock']),
                'automation_level': random.choice(['manual', 'semi_automated', 'fully_automated']),
                'temperature_controlled': random.choice([True, False]),
                'dock_count': random.randint(4, 24),
                'ceiling_height': random.randint(20, 40)
            })
        elif location_type == LocationType.ZONE:
            base_metadata.update({
                'zone_type': random.choice(['receiving', 'storage', 'picking', 'packing', 'shipping']),
                'equipment_type': random.choice(['forklift', 'conveyor', 'robot', 'manual']),
                'security_level': random.choice(['standard', 'high', 'restricted'])
            })
        elif location_type == LocationType.DOCK:
            base_metadata.update({
                'dock_type': random.choice(['truck', 'rail', 'container']),
                'max_vehicle_length': random.randint(40, 80),
                'loading_capacity_tons': random.randint(20, 50)
            })
        elif location_type == LocationType.SHELF:
            base_metadata.update({
                'shelf_type': random.choice(['pallet', 'bin', 'cantilever']),
                'weight_capacity_lbs': random.randint(1000, 5000),
                'height_levels': random.randint(1, 6)
            })
            
        return base_metadata
        
    async def create_location(
        self,
        name: str,
        location_type: LocationType,
        parent: Optional[Location] = None,
        region: str = 'North America',
        country: str = 'United States',
        city: str = 'New York'
    ) -> Location:
        """Create a single location with realistic data."""
        
        latitude, longitude = self.generate_coordinates(region, city)
        address = self.generate_address(country, city)
        metadata = self.generate_metadata(location_type)
        
        location = Location(
            name=name,
            location_type=location_type,
            description=f"{location_type.value.title()} in {city}, {country}",
            address=address['street'],
            city=city,
            state=address['state'],
            postal_code=address['postal_code'],
            country=country,
            latitude=latitude,
            longitude=longitude,
            parent_id=parent.id if parent else None,
            metadata=metadata,
            is_active=metadata['is_active']
        )
        
        self.session.add(location)
        await self.session.flush()  # Get ID without committing
        
        self.created_locations[location_type].append(location)
        self.total_created += 1
        
        return location
        
    async def create_hierarchical_structure(self):
        """Create hierarchical location structure."""
        print("🌳 Creating hierarchical location structure...")
        
        # Calculate target counts based on weights
        type_counts = {
            loc_type: max(1, int(SEED_COUNT * weight))
            for loc_type, weight in TYPE_WEIGHTS.items()
        }
        
        # Ensure we don't exceed total count
        total_planned = sum(type_counts.values())
        if total_planned > SEED_COUNT:
            # Scale down proportionally
            scale_factor = SEED_COUNT / total_planned
            type_counts = {
                loc_type: max(1, int(count * scale_factor))
                for loc_type, count in type_counts.items()
            }
        
        print(f"📊 Planned distribution: {type_counts}")
        
        # Create countries
        countries_created = []
        for region, region_data in REGIONS.items():
            region_countries = region_data['countries']
            for country in region_countries[:type_counts[LocationType.COUNTRY] // len(REGIONS) + 1]:
                if len(countries_created) >= type_counts[LocationType.COUNTRY]:
                    break
                    
                country_location = await self.create_location(
                    name=country,
                    location_type=LocationType.COUNTRY,
                    region=region,
                    country=country,
                    city=region_data['cities'][0]
                )
                countries_created.append((country_location, region))
                
        # Create states/provinces
        states_created = []
        states_per_country = max(1, type_counts[LocationType.STATE] // len(countries_created))
        for country_location, region in countries_created:
            for i in range(states_per_country):
                if len(states_created) >= type_counts[LocationType.STATE]:
                    break
                    
                state_name = fake.state() if country_location.name == 'United States' else fake.administrative_unit()
                state_location = await self.create_location(
                    name=state_name,
                    location_type=LocationType.STATE,
                    parent=country_location,
                    region=region,
                    country=country_location.name,
                    city=random.choice(REGIONS[region]['cities'])
                )
                states_created.append((state_location, region))
                
        # Create cities
        cities_created = []
        cities_per_state = max(1, type_counts[LocationType.CITY] // len(states_created))
        for state_location, region in states_created:
            region_cities = REGIONS[region]['cities']
            for i in range(cities_per_state):
                if len(cities_created) >= type_counts[LocationType.CITY]:
                    break
                    
                city_name = random.choice(region_cities)
                city_location = await self.create_location(
                    name=city_name,
                    location_type=LocationType.CITY,
                    parent=state_location,
                    region=region,
                    country=state_location.country,
                    city=city_name
                )
                cities_created.append((city_location, region))
                
        # Create warehouses
        warehouses_created = []
        warehouses_per_city = max(1, type_counts[LocationType.WAREHOUSE] // len(cities_created))
        for city_location, region in cities_created:
            for i in range(warehouses_per_city):
                if len(warehouses_created) >= type_counts[LocationType.WAREHOUSE]:
                    break
                    
                warehouse_name = f"{city_location.name} {random.choice(WAREHOUSE_NAMES)}"
                warehouse_location = await self.create_location(
                    name=warehouse_name,
                    location_type=LocationType.WAREHOUSE,
                    parent=city_location,
                    region=region,
                    country=city_location.country,
                    city=city_location.name
                )
                warehouses_created.append((warehouse_location, region))
                
        # Create zones
        zones_created = []
        zones_per_warehouse = max(1, type_counts[LocationType.ZONE] // len(warehouses_created))
        for warehouse_location, region in warehouses_created:
            for i in range(zones_per_warehouse):
                if len(zones_created) >= type_counts[LocationType.ZONE]:
                    break
                    
                zone_name = f"{random.choice(ZONE_NAMES)} {i+1}"
                zone_location = await self.create_location(
                    name=zone_name,
                    location_type=LocationType.ZONE,
                    parent=warehouse_location,
                    region=region,
                    country=warehouse_location.country,
                    city=warehouse_location.city
                )
                zones_created.append((zone_location, region))
                
        # Create docks
        docks_per_warehouse = max(1, type_counts[LocationType.DOCK] // len(warehouses_created))
        for warehouse_location, region in warehouses_created:
            for i in range(docks_per_warehouse):
                if self.total_created >= SEED_COUNT:
                    break
                    
                dock_name = f"{random.choice(DOCK_NAMES)} {i+1}"
                await self.create_location(
                    name=dock_name,
                    location_type=LocationType.DOCK,
                    parent=warehouse_location,
                    region=region,
                    country=warehouse_location.country,
                    city=warehouse_location.city
                )
                
        # Create shelves
        shelves_per_zone = max(1, type_counts[LocationType.SHELF] // len(zones_created))
        for zone_location, region in zones_created:
            for i in range(shelves_per_zone):
                if self.total_created >= SEED_COUNT:
                    break
                    
                shelf_name = f"{random.choice(SHELF_NAMES)} {i+1}"
                await self.create_location(
                    name=shelf_name,
                    location_type=LocationType.SHELF,
                    parent=zone_location,
                    region=region,
                    country=zone_location.country,
                    city=zone_location.city
                )
                
        await self.session.commit()
        print(f"✅ Hierarchical structure created: {self.total_created} locations")
        
    async def create_flat_structure(self):
        """Create flat location structure for performance testing."""
        print("📊 Creating flat location structure...")
        
        batch_size = 100
        batches = (SEED_COUNT // batch_size) + 1
        
        for batch in range(batches):
            batch_locations = []
            start_idx = batch * batch_size
            end_idx = min((batch + 1) * batch_size, SEED_COUNT)
            
            for i in range(start_idx, end_idx):
                # Distribute across regions
                region = random.choice(list(REGIONS.keys()))
                region_data = REGIONS[region]
                country = random.choice(region_data['countries'])
                city = random.choice(region_data['cities'])
                
                # Distribute location types
                location_type = random.choices(
                    list(LocationType),
                    weights=list(TYPE_WEIGHTS.values()),
                    k=1
                )[0]
                
                # Generate appropriate name
                if location_type == LocationType.WAREHOUSE:
                    name = f"{city} {random.choice(WAREHOUSE_NAMES)} #{i}"
                elif location_type == LocationType.ZONE:
                    name = f"{random.choice(ZONE_NAMES)} #{i}"
                elif location_type == LocationType.DOCK:
                    name = f"{random.choice(DOCK_NAMES)} #{i}"
                elif location_type == LocationType.SHELF:
                    name = f"{random.choice(SHELF_NAMES)} #{i}"
                else:
                    name = f"{location_type.value.title()} {city} #{i}"
                
                location = await self.create_location(
                    name=name,
                    location_type=location_type,
                    region=region,
                    country=country,
                    city=city
                )
                batch_locations.append(location)
                
            # Progress update
            print(f"📈 Created batch {batch + 1}/{batches}: {len(batch_locations)} locations")
            
        await self.session.commit()
        print(f"✅ Flat structure created: {self.total_created} locations")
        
    async def print_summary(self):
        """Print detailed seeding summary."""
        print("\n" + "="*70)
        print("🏆 LOCATION SEEDING COMPLETED SUCCESSFULLY! 🏆")
        print("="*70)
        
        # Count by type
        type_counts = {}
        for location_type in LocationType:
            count = len(self.created_locations[location_type])
            if count > 0:
                type_counts[location_type.value] = count
                
        print(f"\n📊 Distribution by Type:")
        for location_type, count in type_counts.items():
            print(f"  • {location_type.title()}: {count}")
            
        print(f"\n📍 Total Locations Created: {self.total_created}")
        print(f"🌍 Geographic Distribution: {len(REGIONS)} regions")
        print(f"🏗️  Structure Type: {'Hierarchical' if WITH_HIERARCHY else 'Flat'}")
        print(f"🗺️  With Coordinates: {'Yes' if WITH_COORDINATES else 'No'}")
        
        # Sample some locations
        print(f"\n🔍 Sample Locations:")
        result = await self.session.execute(
            select(Location).limit(5).order_by(Location.created_at.desc())
        )
        sample_locations = result.scalars().all()
        
        for loc in sample_locations:
            print(f"  • {loc.name} ({loc.location_type.value}) - {loc.city}, {loc.country}")
            
        print(f"\n🎯 Ready for comprehensive testing with {self.total_created} locations!")
        print("="*70)
        
    async def seed_locations(self):
        """Main seeding method."""
        start_time = datetime.now()
        print("🌱 Starting location data seeding...")
        print(f"📋 Configuration:")
        print(f"  • Target Count: {SEED_COUNT}")
        print(f"  • Hierarchical: {WITH_HIERARCHY}")
        print(f"  • Coordinates: {WITH_COORDINATES}")
        print(f"  • Regions: {list(REGIONS.keys())}")
        
        try:
            await self.connect_db()
            await self.clear_existing_locations()
            
            if WITH_HIERARCHY:
                await self.create_hierarchical_structure()
            else:
                await self.create_flat_structure()
                
            await self.print_summary()
            
        except Exception as e:
            print(f"❌ Error during seeding: {str(e)}")
            if self.session:
                await self.session.rollback()
            raise
        finally:
            await self.disconnect_db()
            
        duration = datetime.now() - start_time
        print(f"⏱️  Total time: {duration.total_seconds():.2f} seconds")


async def main():
    """Main entry point."""
    seeder = LocationSeeder()
    await seeder.seed_locations()


if __name__ == "__main__":
    print("🚀 Location Data Seeder v1.0")
    print("=" * 50)
    asyncio.run(main())