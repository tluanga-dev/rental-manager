#!/usr/bin/env python3
"""
🌱 Unit of Measurement - 10k Data Seeding Script
Generates 10,000 realistic Units of Measurement with variations for performance testing
"""

import asyncio
import random
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import sys
import os
from pathlib import Path

# Add the app directory to the Python path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.database import async_session_maker
from app.models.unit_of_measurement import UnitOfMeasurement
from app.services.unit_of_measurement import unit_of_measurement_service


class UoMSeeder:
    """Unit of Measurement data seeder with realistic variations."""
    
    # Base unit categories with realistic variations
    UNIT_CATEGORIES = {
        'weight': {
            'base_units': [
                ('Kilogram', 'KG'), ('Gram', 'G'), ('Milligram', 'MG'), 
                ('Pound', 'LB'), ('Ounce', 'OZ'), ('Ton', 'TON'),
                ('Stone', 'ST'), ('Carat', 'CT'), ('Troy Ounce', 'TROZ')
            ],
            'variations': [
                'Standard', 'Metric', 'Imperial', 'Precision', 'Heavy Duty',
                'Laboratory', 'Commercial', 'Industrial', 'Medical', 'Jewelry'
            ],
            'descriptions': [
                'Standard weight measurement',
                'Precision weight for laboratory use',
                'Industrial weight measurement',
                'Commercial weight standard',
                'Medical dosage measurement'
            ]
        },
        'length': {
            'base_units': [
                ('Meter', 'M'), ('Centimeter', 'CM'), ('Millimeter', 'MM'),
                ('Kilometer', 'KM'), ('Inch', 'IN'), ('Foot', 'FT'),
                ('Yard', 'YD'), ('Mile', 'MI'), ('Micrometer', 'UM')
            ],
            'variations': [
                'Standard', 'Metric', 'Imperial', 'Survey', 'Engineering',
                'Architectural', 'Marine', 'Aviation', 'Scientific', 'Textile'
            ],
            'descriptions': [
                'Standard length measurement',
                'Precision length for engineering',
                'Architectural measurement standard',
                'Scientific length measurement',
                'Marine distance measurement'
            ]
        },
        'volume': {
            'base_units': [
                ('Liter', 'L'), ('Milliliter', 'ML'), ('Gallon', 'GAL'),
                ('Quart', 'QT'), ('Pint', 'PT'), ('Cup', 'CUP'),
                ('Fluid Ounce', 'FLOZ'), ('Cubic Meter', 'M3'), ('Barrel', 'BBL')
            ],
            'variations': [
                'Standard', 'Metric', 'Imperial', 'US', 'UK', 'Cooking',
                'Laboratory', 'Industrial', 'Oil', 'Chemical'
            ],
            'descriptions': [
                'Standard volume measurement',
                'Laboratory volume standard',
                'Industrial liquid measurement',
                'Cooking measurement unit',
                'Oil industry standard'
            ]
        },
        'area': {
            'base_units': [
                ('Square Meter', 'M2'), ('Square Centimeter', 'CM2'),
                ('Square Kilometer', 'KM2'), ('Square Foot', 'SQFT'),
                ('Square Inch', 'SQIN'), ('Acre', 'AC'), ('Hectare', 'HA')
            ],
            'variations': [
                'Standard', 'Metric', 'Imperial', 'Real Estate', 'Agricultural',
                'Construction', 'Land Survey', 'Architectural', 'Urban Planning'
            ],
            'descriptions': [
                'Standard area measurement',
                'Real estate area standard',
                'Agricultural land measurement',
                'Construction area unit',
                'Land survey measurement'
            ]
        },
        'time': {
            'base_units': [
                ('Second', 'S'), ('Minute', 'MIN'), ('Hour', 'HR'),
                ('Day', 'DAY'), ('Week', 'WK'), ('Month', 'MO'),
                ('Year', 'YR'), ('Millisecond', 'MS'), ('Microsecond', 'US')
            ],
            'variations': [
                'Standard', 'Precise', 'Business', 'Scientific', 'Atomic',
                'Calendar', 'Work', 'Project', 'Billing', 'Scheduling'
            ],
            'descriptions': [
                'Standard time measurement',
                'Precise scientific timing',
                'Business time unit',
                'Project scheduling unit',
                'Billing time measurement'
            ]
        },
        'quantity': {
            'base_units': [
                ('Piece', 'PC'), ('Pair', 'PR'), ('Dozen', 'DOZ'),
                ('Gross', 'GR'), ('Set', 'SET'), ('Pack', 'PACK'),
                ('Box', 'BOX'), ('Case', 'CASE'), ('Lot', 'LOT')
            ],
            'variations': [
                'Standard', 'Retail', 'Wholesale', 'Bulk', 'Individual',
                'Commercial', 'Industrial', 'Consumer', 'Professional'
            ],
            'descriptions': [
                'Standard quantity measurement',
                'Retail quantity unit',
                'Wholesale quantity standard',
                'Bulk quantity measurement',
                'Individual item count'
            ]
        },
        'energy': {
            'base_units': [
                ('Joule', 'J'), ('Calorie', 'CAL'), ('Kilocalorie', 'KCAL'),
                ('BTU', 'BTU'), ('Kilowatt Hour', 'KWH'), ('Watt Hour', 'WH')
            ],
            'variations': [
                'Standard', 'Electrical', 'Thermal', 'Mechanical', 'Nuclear',
                'Solar', 'Chemical', 'Nutritional', 'Industrial'
            ],
            'descriptions': [
                'Standard energy measurement',
                'Electrical energy unit',
                'Thermal energy standard',
                'Nutritional energy measurement',
                'Industrial energy unit'
            ]
        },
        'pressure': {
            'base_units': [
                ('Pascal', 'PA'), ('Bar', 'BAR'), ('PSI', 'PSI'),
                ('Atmosphere', 'ATM'), ('Torr', 'TORR'), ('mmHg', 'MMHG')
            ],
            'variations': [
                'Standard', 'Atmospheric', 'Hydraulic', 'Pneumatic',
                'Vacuum', 'Medical', 'Industrial', 'Scientific'
            ],
            'descriptions': [
                'Standard pressure measurement',
                'Atmospheric pressure unit',
                'Hydraulic pressure standard',
                'Medical pressure measurement',
                'Industrial pressure unit'
            ]
        },
        'temperature': {
            'base_units': [
                ('Celsius', 'C'), ('Fahrenheit', 'F'), ('Kelvin', 'K'),
                ('Rankine', 'R')
            ],
            'variations': [
                'Standard', 'Scientific', 'Medical', 'Industrial',
                'Weather', 'Cooking', 'Laboratory', 'Environmental'
            ],
            'descriptions': [
                'Standard temperature measurement',
                'Scientific temperature unit',
                'Medical temperature standard',
                'Weather temperature measurement',
                'Industrial temperature unit'
            ]
        }
    }
    
    # Additional descriptive terms
    DESCRIPTIVE_TERMS = [
        'Precision', 'Standard', 'High-Grade', 'Commercial', 'Industrial',
        'Laboratory', 'Medical', 'Scientific', 'Professional', 'Premium',
        'Heavy-Duty', 'Light-Duty', 'Multi-Purpose', 'Specialized', 'Universal',
        'Certified', 'Calibrated', 'Traceable', 'ISO Standard', 'NIST Standard',
        'FDA Approved', 'CE Marked', 'Military Grade', 'Aerospace', 'Marine',
        'Automotive', 'Construction', 'Agricultural', 'Food Grade', 'Pharmaceutical'
    ]
    
    def __init__(self):
        self.created_names = set()
        self.created_codes = set()
        self.created_count = 0
        self.duplicate_attempts = 0
        
    def generate_unique_name(self, category: str, base_name: str, variation: str = None) -> str:
        """Generate a unique unit name with variations."""
        attempts = 0
        while attempts < 50:  # Prevent infinite loops
            parts = []
            
            # Add descriptive term occasionally
            if random.random() < 0.3:
                parts.append(random.choice(self.DESCRIPTIVE_TERMS))
            
            # Add variation if provided
            if variation and random.random() < 0.7:
                parts.append(variation)
            
            # Add base name
            parts.append(base_name)
            
            # Add category specification occasionally
            if random.random() < 0.2:
                parts.append(f"({category.title()})")
            
            # Add number suffix for variations
            if random.random() < 0.4:
                parts.append(f"Type {random.randint(1, 99)}")
            
            name = ' '.join(parts)
            
            # Ensure uniqueness
            if name not in self.created_names and len(name) <= 50:
                self.created_names.add(name)
                return name
            
            attempts += 1
            self.duplicate_attempts += 1
        
        # Fallback with timestamp
        fallback_name = f"{base_name} {int(datetime.now().timestamp())}"
        self.created_names.add(fallback_name)
        return fallback_name
    
    def generate_unique_code(self, base_code: str) -> Optional[str]:
        """Generate a unique unit code with variations."""
        if not base_code:
            return None
            
        attempts = 0
        while attempts < 50:
            variations = [
                base_code,
                f"{base_code}{random.randint(1, 99)}",
                f"{base_code}{random.choice(['A', 'B', 'C', 'X', 'Y', 'Z'])}",
                f"{base_code}_{random.randint(1, 9)}",
                f"STD_{base_code}",
                f"PRE_{base_code}",
                f"IND_{base_code}",
                f"COM_{base_code}",
                f"{base_code}_V{random.randint(1, 5)}"
            ]
            
            code = random.choice(variations)
            
            if code not in self.created_codes and len(code) <= 10:
                self.created_codes.add(code)
                return code
            
            attempts += 1
            self.duplicate_attempts += 1
        
        # Skip code if can't generate unique one
        return None
    
    def generate_description(self, category: str, name: str, base_description: str = None) -> Optional[str]:
        """Generate a realistic description."""
        if random.random() < 0.3:  # 30% chance of no description
            return None
        
        base_descriptions = self.UNIT_CATEGORIES[category].get('descriptions', [])
        
        if base_description:
            desc = base_description
        elif base_descriptions:
            desc = random.choice(base_descriptions)
        else:
            desc = f"Standard {category} measurement unit"
        
        # Add additional context occasionally
        additions = []
        
        if random.random() < 0.4:
            contexts = [
                "Used in professional applications",
                "Suitable for industrial use",
                "Meets international standards",
                "High precision measurement",
                "Certified for commercial use",
                "Laboratory grade accuracy",
                "Weather resistant standard",
                "Food grade certification",
                "Medical device compatible",
                "Automotive industry standard"
            ]
            additions.append(random.choice(contexts))
        
        if random.random() < 0.2:
            standards = [
                "ISO 9001 compliant",
                "NIST traceable",
                "CE marked",
                "FDA approved",
                "RoHS compliant",
                "OSHA certified",
                "API standard",
                "ASTM compliant"
            ]
            additions.append(random.choice(standards))
        
        if additions:
            full_desc = f"{desc}. {' '.join(additions)}."
        else:
            full_desc = f"{desc}."
        
        return full_desc if len(full_desc) <= 500 else full_desc[:497] + "..."
    
    def generate_units(self, count: int) -> List[Dict]:
        """Generate the specified number of unit variations."""
        units = []
        categories = list(self.UNIT_CATEGORIES.keys())
        
        print(f"🌱 Generating {count:,} Unit of Measurement variations...")
        
        while len(units) < count:
            # Select random category
            category = random.choice(categories)
            category_data = self.UNIT_CATEGORIES[category]
            
            # Select random base unit
            base_name, base_code = random.choice(category_data['base_units'])
            
            # Select random variation
            variation = random.choice(category_data['variations']) if random.random() < 0.6 else None
            
            # Generate unique name and code
            name = self.generate_unique_name(category, base_name, variation)
            code = self.generate_unique_code(base_code)
            description = self.generate_description(category, name)
            
            unit = {
                'name': name,
                'code': code,
                'description': description,
                'category': category  # For reference, not stored in DB
            }
            
            units.append(unit)
            
            # Progress reporting
            if len(units) % 1000 == 0:
                print(f"   Generated {len(units):,} units...")
        
        print(f"✅ Generated {len(units):,} unique units")
        print(f"⚠️  Handled {self.duplicate_attempts} duplicate attempts")
        
        return units
    
    async def seed_database(self, units: List[Dict], batch_size: int = 100) -> None:
        """Seed the database with generated units."""
        print(f"\n💾 Seeding database with {len(units):,} units (batch size: {batch_size})")
        
        async with async_session_maker() as session:
            try:
                # Clear existing UoM data for clean seeding
                print("🧹 Clearing existing UoM data...")
                await session.execute(text("DELETE FROM unit_of_measurements WHERE name LIKE '%Test%' OR name LIKE '%Generated%' OR name LIKE '%Seed%'"))
                await session.commit()
                
                # Process in batches
                for i in range(0, len(units), batch_size):
                    batch = units[i:i + batch_size]
                    batch_uoms = []
                    
                    for unit_data in batch:
                        try:
                            # Create UoM instance
                            uom = UnitOfMeasurement(
                                name=unit_data['name'],
                                code=unit_data['code'],
                                description=unit_data['description'],
                                created_by='seeder',
                                updated_by='seeder'
                            )
                            
                            batch_uoms.append(uom)
                            
                        except Exception as e:
                            print(f"⚠️  Error creating unit {unit_data['name']}: {e}")
                            continue
                    
                    # Add batch to session
                    session.add_all(batch_uoms)
                    
                    try:
                        await session.commit()
                        self.created_count += len(batch_uoms)
                        print(f"   ✅ Seeded batch {i//batch_size + 1}: {len(batch_uoms)} units (Total: {self.created_count:,})")
                        
                    except Exception as e:
                        await session.rollback()
                        print(f"   ❌ Failed to seed batch {i//batch_size + 1}: {e}")
                        
                        # Try individual inserts for this batch
                        successful_individual = 0
                        for uom in batch_uoms:
                            try:
                                session.add(uom)
                                await session.commit()
                                successful_individual += 1
                                self.created_count += 1
                            except Exception as individual_error:
                                await session.rollback()
                                print(f"      ⚠️  Individual insert failed for {uom.name}: {individual_error}")
                        
                        if successful_individual > 0:
                            print(f"   🔄 Recovered {successful_individual} units from failed batch")
                
                print(f"\n🎉 Successfully seeded {self.created_count:,} units!")
                
            except Exception as e:
                await session.rollback()
                print(f"❌ Database seeding failed: {e}")
                raise
    
    async def verify_seeded_data(self) -> Dict:
        """Verify the seeded data and generate statistics."""
        print(f"\n🔍 Verifying seeded data...")
        
        async with async_session_maker() as session:
            try:
                # Count total UoMs
                result = await session.execute(text("SELECT COUNT(*) FROM unit_of_measurements"))
                total_count = result.scalar()
                
                # Count active UoMs
                result = await session.execute(text("SELECT COUNT(*) FROM unit_of_measurements WHERE is_active = true"))
                active_count = result.scalar()
                
                # Count UoMs with codes
                result = await session.execute(text("SELECT COUNT(*) FROM unit_of_measurements WHERE code IS NOT NULL AND code != ''"))
                with_codes = result.scalar()
                
                # Count UoMs with descriptions
                result = await session.execute(text("SELECT COUNT(*) FROM unit_of_measurements WHERE description IS NOT NULL AND description != ''"))
                with_descriptions = result.scalar()
                
                # Sample some random UoMs
                result = await session.execute(text("SELECT name, code, description FROM unit_of_measurements ORDER BY RANDOM() LIMIT 10"))
                samples = result.fetchall()
                
                stats = {
                    'total_units': total_count,
                    'active_units': active_count,
                    'units_with_codes': with_codes,
                    'units_with_descriptions': with_descriptions,
                    'sample_units': [
                        {'name': row[0], 'code': row[1], 'description': row[2][:100] + '...' if row[2] and len(row[2]) > 100 else row[2]}
                        for row in samples
                    ]
                }
                
                print(f"📊 Verification Results:")
                print(f"   Total Units: {stats['total_units']:,}")
                print(f"   Active Units: {stats['active_units']:,}")
                print(f"   Units with Codes: {stats['units_with_codes']:,} ({stats['units_with_codes']/stats['total_units']*100:.1f}%)")
                print(f"   Units with Descriptions: {stats['units_with_descriptions']:,} ({stats['units_with_descriptions']/stats['total_units']*100:.1f}%)")
                
                print(f"\n📝 Sample Units:")
                for i, unit in enumerate(stats['sample_units'], 1):
                    print(f"   {i}. {unit['name']} ({unit['code']}) - {unit['description'][:80]}...")
                
                return stats
                
            except Exception as e:
                print(f"❌ Verification failed: {e}")
                return {}
    
    async def run_seeding(self, count: int = 10000) -> None:
        """Main seeding orchestration."""
        start_time = datetime.now()
        
        print("🌱 Unit of Measurement Seeding Script")
        print("=" * 60)
        print(f"Target: {count:,} units")
        print(f"Started: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print("")
        
        try:
            # Generate units
            units = self.generate_units(count)
            
            # Seed database
            await self.seed_database(units)
            
            # Verify data
            stats = await self.verify_seeded_data()
            
            # Final summary
            end_time = datetime.now()
            duration = end_time - start_time
            
            print(f"\n🎯 Seeding Complete!")
            print("=" * 60)
            print(f"Duration: {duration}")
            print(f"Units Created: {self.created_count:,}")
            print(f"Success Rate: {(self.created_count / count * 100):.1f}%")
            
            if self.created_count >= count * 0.95:  # 95% success rate
                print("✅ Seeding successful!")
                return True
            else:
                print("⚠️  Seeding completed with warnings")
                return False
                
        except Exception as e:
            print(f"❌ Seeding failed: {e}")
            return False


async def main():
    """Main function to run the seeding process."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Seed UoM database with test data')
    parser.add_argument('--count', type=int, default=10000, help='Number of units to generate (default: 10000)')
    parser.add_argument('--verify-only', action='store_true', help='Only verify existing data, do not seed')
    
    args = parser.parse_args()
    
    seeder = UoMSeeder()
    
    if args.verify_only:
        print("🔍 Verification Mode - Checking existing data only")
        await seeder.verify_seeded_data()
    else:
        success = await seeder.run_seeding(args.count)
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())