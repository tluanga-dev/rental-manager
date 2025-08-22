#!/usr/bin/env python3
"""
Comprehensive test data generator for inventory module.

Generates realistic test data for all inventory models:
- SKU sequences
- Stock levels  
- Inventory units
- Stock movements

Supports different data scales and realistic business scenarios.
"""

import asyncio
import argparse
import random
import json
import csv
from decimal import Decimal
from datetime import datetime, date, timedelta
from uuid import uuid4, UUID
from typing import List, Dict, Any, Optional
from pathlib import Path

# Add project to path
import sys
sys.path.insert(0, '/code')

from app.models.inventory.enums import (
    StockMovementType, InventoryUnitStatus, InventoryUnitCondition
)


class InventoryDataGenerator:
    """Generate realistic inventory test data."""
    
    def __init__(self, seed: Optional[int] = None):
        """Initialize generator with optional seed for reproducible data."""
        if seed:
            random.seed(seed)
        
        self.brands = self._generate_brand_data()
        self.categories = self._generate_category_data()
        self.locations = self._generate_location_data()
        self.items = self._generate_item_data()
        
        # Track generated data
        self.generated_data = {
            'sku_sequences': [],
            'stock_levels': [],
            'inventory_units': [],
            'stock_movements': []
        }
    
    def _generate_brand_data(self) -> List[Dict]:
        """Generate brand data."""
        brands = [
            {"id": str(uuid4()), "name": "Acme Tools", "code": "ACME"},
            {"id": str(uuid4()), "name": "Superior Equipment", "code": "SUP"},
            {"id": str(uuid4()), "name": "Prime Machinery", "code": "PRIME"},
            {"id": str(uuid4()), "name": "Elite Systems", "code": "ELITE"},
            {"id": str(uuid4()), "name": "ProTech Solutions", "code": "PTECH"},
            {"id": str(uuid4()), "name": "Industrial Direct", "code": "INDUST"},
            {"id": str(uuid4()), "name": "BuildPro", "code": "BUILD"},
            {"id": str(uuid4()), "name": "MegaTools", "code": "MEGA"},
            {"id": str(uuid4()), "name": "CraftMaster", "code": "CRAFT"},
            {"id": str(uuid4()), "name": "TechFlow", "code": "TFLOW"}
        ]
        return brands
    
    def _generate_category_data(self) -> List[Dict]:
        """Generate category data."""
        categories = [
            {"id": str(uuid4()), "name": "Power Tools", "code": "PWR"},
            {"id": str(uuid4()), "name": "Hand Tools", "code": "HAND"},
            {"id": str(uuid4()), "name": "Safety Equipment", "code": "SAFE"},
            {"id": str(uuid4()), "name": "Measuring Tools", "code": "MEAS"},
            {"id": str(uuid4()), "name": "Cutting Tools", "code": "CUT"},
            {"id": str(uuid4()), "name": "Fasteners", "code": "FAST"},
            {"id": str(uuid4()), "name": "Electrical", "code": "ELEC"},
            {"id": str(uuid4()), "name": "Plumbing", "code": "PLUMB"},
            {"id": str(uuid4()), "name": "HVAC", "code": "HVAC"},
            {"id": str(uuid4()), "name": "Machinery", "code": "MACH"},
            {"id": str(uuid4()), "name": "Automotive", "code": "AUTO"},
            {"id": str(uuid4()), "name": "Garden Tools", "code": "GARDEN"}
        ]
        return categories
    
    def _generate_location_data(self) -> List[Dict]:
        """Generate location data."""
        locations = [
            {"id": str(uuid4()), "name": "Main Warehouse", "code": "WH-MAIN"},
            {"id": str(uuid4()), "name": "Downtown Store", "code": "ST-DOWN"},
            {"id": str(uuid4()), "name": "North Branch", "code": "BR-NORTH"},
            {"id": str(uuid4()), "name": "South Branch", "code": "BR-SOUTH"},
            {"id": str(uuid4()), "name": "East Distribution", "code": "DC-EAST"},
            {"id": str(uuid4()), "name": "West Outlet", "code": "OUT-WEST"},
            {"id": str(uuid4()), "name": "Service Center", "code": "SVC-CTR"},
            {"id": str(uuid4()), "name": "Repair Shop", "code": "REP-SHOP"}
        ]
        return locations
    
    def _generate_item_data(self) -> List[Dict]:
        """Generate item data."""
        items = []
        item_templates = [
            ("Drill", ["Cordless", "Corded", "Impact", "Hammer"]),
            ("Saw", ["Circular", "Jigsaw", "Reciprocating", "Miter"]),
            ("Wrench", ["Adjustable", "Socket", "Combination", "Torque"]),
            ("Screwdriver", ["Phillips", "Flathead", "Torx", "Electric"]),
            ("Hammer", ["Claw", "Ball Peen", "Sledge", "Rubber Mallet"]),
            ("Level", ["Spirit", "Laser", "Digital", "Torpedo"]),
            ("Tape Measure", ["Standard", "Metric", "Laser", "Digital"]),
            ("Safety Glasses", ["Clear", "Tinted", "Prescription", "Wraparound"]),
            ("Gloves", ["Leather", "Rubber", "Cut-Resistant", "Disposable"]),
            ("Extension Cord", ["Indoor", "Outdoor", "Heavy Duty", "Retractable"])
        ]
        
        for brand in self.brands:
            for category in self.categories[:6]:  # Use first 6 categories
                for base_name, variants in item_templates[:5]:  # Use first 5 templates
                    for variant in variants[:2]:  # Use first 2 variants
                        items.append({
                            "id": str(uuid4()),
                            "name": f"{brand['name']} {variant} {base_name}",
                            "brand_id": brand["id"],
                            "category_id": category["id"],
                            "sku_prefix": f"{brand['code']}-{category['code']}"
                        })
        
        return items[:200]  # Limit to 200 items for manageable dataset
    
    def generate_sku_sequences(self, count: Optional[int] = None) -> List[Dict]:
        """Generate SKU sequences."""
        if count is None:
            count = len(self.brands) * len(self.categories)
        
        sequences = []
        sequence_combinations = set()
        
        for i in range(count):
            brand = random.choice(self.brands)
            category = random.choice(self.categories)
            
            # Ensure unique brand/category combinations
            combo = (brand["id"], category["id"])
            if combo in sequence_combinations:
                continue
            sequence_combinations.add(combo)
            
            sequence = {
                "id": str(uuid4()),
                "brand_id": brand["id"],
                "category_id": category["id"],
                "prefix": brand["code"],
                "suffix": category["code"],
                "next_sequence": random.randint(1, 100),
                "padding_length": random.choice([3, 4, 5]),
                "format_template": f"{brand['code']}-{category['code']}-{{sequence:0{random.choice([3,4,5])}d}}",
                "total_generated": random.randint(0, 50),
                "is_active": random.choice([True, True, True, False]),  # 75% active
                "created_at": self._random_past_date(days=365),
                "updated_at": self._random_past_date(days=30)
            }
            sequences.append(sequence)
        
        self.generated_data['sku_sequences'] = sequences
        return sequences
    
    def generate_stock_levels(self, count: int = 500) -> List[Dict]:
        """Generate stock levels."""
        stock_levels = []
        
        # Ensure each item has stock in at least one location
        for item in self.items:
            location = random.choice(self.locations)
            stock_level = self._create_stock_level(item, location)
            stock_levels.append(stock_level)
        
        # Add additional random stock levels
        while len(stock_levels) < count:
            item = random.choice(self.items)
            location = random.choice(self.locations)
            
            # Avoid duplicates
            if not any(sl["item_id"] == item["id"] and sl["location_id"] == location["id"] 
                      for sl in stock_levels):
                stock_level = self._create_stock_level(item, location)
                stock_levels.append(stock_level)
        
        self.generated_data['stock_levels'] = stock_levels
        return stock_levels
    
    def _create_stock_level(self, item: Dict, location: Dict) -> Dict:
        """Create a single stock level record."""
        total_quantity = random.uniform(0, 500)
        reserved = random.uniform(0, total_quantity * 0.3)
        on_rent = random.uniform(0, (total_quantity - reserved) * 0.5)
        damaged = random.uniform(0, total_quantity * 0.1)
        maintenance = random.uniform(0, total_quantity * 0.05)
        available = max(0, total_quantity - reserved - on_rent - damaged - maintenance)
        
        reorder_point = random.uniform(10, total_quantity * 0.3)
        is_low_stock = available < reorder_point
        
        return {
            "id": str(uuid4()),
            "item_id": item["id"],
            "location_id": location["id"],
            "quantity_on_hand": round(Decimal(str(total_quantity)), 2),
            "quantity_available": round(Decimal(str(available)), 2),
            "quantity_reserved": round(Decimal(str(reserved)), 2),
            "quantity_on_rent": round(Decimal(str(on_rent)), 2),
            "quantity_damaged": round(Decimal(str(damaged)), 2),
            "quantity_in_maintenance": round(Decimal(str(maintenance)), 2),
            "reorder_point": round(Decimal(str(reorder_point)), 2),
            "reorder_quantity": round(Decimal(str(random.uniform(50, 200))), 2),
            "max_stock_level": round(Decimal(str(random.uniform(total_quantity, total_quantity * 2))), 2),
            "last_reorder_date": self._random_past_date(days=90) if random.random() > 0.5 else None,
            "last_stock_check": self._random_past_date(days=30),
            "average_daily_usage": round(Decimal(str(random.uniform(0.1, 5.0))), 2),
            "days_until_reorder": random.randint(1, 60) if is_low_stock else None,
            "is_low_stock": is_low_stock,
            "version": random.randint(0, 10),
            "created_at": self._random_past_date(days=365),
            "updated_at": self._random_past_date(days=7)
        }
    
    def generate_inventory_units(self, count: int = 1000) -> List[Dict]:
        """Generate inventory units."""
        units = []
        statuses = list(InventoryUnitStatus)
        conditions = list(InventoryUnitCondition)
        
        # Weight status distribution (more available items)
        status_weights = {
            InventoryUnitStatus.AVAILABLE: 0.6,
            InventoryUnitStatus.ON_RENT: 0.2,
            InventoryUnitStatus.IN_MAINTENANCE: 0.05,
            InventoryUnitStatus.DAMAGED: 0.05,
            InventoryUnitStatus.RESERVED: 0.05,
            InventoryUnitStatus.IN_TRANSIT: 0.03,
            InventoryUnitStatus.RETIRED: 0.015,
            InventoryUnitStatus.LOST: 0.005
        }
        
        for i in range(count):
            item = random.choice(self.items)
            location = random.choice(self.locations)
            
            # Generate SKU
            sku = f"{item['sku_prefix']}-{i+1:06d}"
            
            # Choose status based on weights
            status = self._weighted_choice(status_weights)
            
            # Choose condition (better conditions more likely)
            condition_weights = {
                InventoryUnitCondition.NEW: 0.3,
                InventoryUnitCondition.EXCELLENT: 0.25,
                InventoryUnitCondition.GOOD: 0.25,
                InventoryUnitCondition.FAIR: 0.15,
                InventoryUnitCondition.POOR: 0.04,
                InventoryUnitCondition.DAMAGED: 0.01
            }
            condition = self._weighted_choice(condition_weights)
            
            # Generate dates
            purchase_date = self._random_past_date(days=1095)  # Up to 3 years ago
            warranty_months = random.choice([12, 24, 36, 60])
            warranty_end = purchase_date + timedelta(days=warranty_months * 30)
            
            unit = {
                "id": str(uuid4()),
                "item_id": item["id"],
                "location_id": location["id"],
                "sku": sku,
                "serial_number": f"SN{random.randint(100000000, 999999999)}" if random.random() > 0.1 else None,
                "batch_code": f"BATCH{random.randint(1000, 9999)}" if random.random() > 0.3 else None,
                "status": status.value,
                "condition": condition.value,
                "purchase_date": purchase_date.isoformat() if purchase_date else None,
                "purchase_price": round(Decimal(str(random.uniform(50, 2000))), 2),
                "supplier_id": str(uuid4()) if random.random() > 0.2 else None,
                "warranty_end_date": warranty_end.isoformat() if warranty_end > datetime.now().date() else None,
                "last_maintenance_date": self._random_past_date(days=180).isoformat() if random.random() > 0.7 else None,
                "next_maintenance_date": self._random_future_date(days=365).isoformat() if random.random() > 0.6 else None,
                "maintenance_history": self._generate_maintenance_history() if random.random() > 0.8 else None,
                "rental_count": random.randint(0, 50) if status == InventoryUnitStatus.ON_RENT or random.random() > 0.5 else 0,
                "total_rental_days": random.randint(0, 1000),
                "last_rental_date": self._random_past_date(days=90).isoformat() if random.random() > 0.6 else None,
                "current_customer_id": str(uuid4()) if status == InventoryUnitStatus.ON_RENT else None,
                "is_rental_blocked": random.random() < 0.05,  # 5% blocked
                "rental_block_reason": "Maintenance required" if random.random() < 0.05 else None,
                "rental_blocked_until": self._random_future_date(days=30).isoformat() if random.random() < 0.05 else None,
                "rental_blocked_by": str(uuid4()) if random.random() < 0.05 else None,
                "notes": self._random_notes() if random.random() > 0.7 else None,
                "custom_attributes": self._generate_custom_attributes() if random.random() > 0.8 else None,
                "version": random.randint(0, 5),
                "created_at": purchase_date.isoformat() if purchase_date else datetime.now().isoformat(),
                "updated_at": self._random_past_date(days=30).isoformat()
            }
            units.append(unit)
        
        self.generated_data['inventory_units'] = units
        return units
    
    def generate_stock_movements(self, count: int = 2000) -> List[Dict]:
        """Generate stock movements."""
        movements = []
        movement_types = list(StockMovementType)
        
        # Weight movement types (more common operations more frequent)
        type_weights = {
            StockMovementType.PURCHASE: 0.15,
            StockMovementType.SALE: 0.10,
            StockMovementType.RENTAL_OUT: 0.20,
            StockMovementType.RENTAL_RETURN: 0.18,
            StockMovementType.ADJUSTMENT_POSITIVE: 0.05,
            StockMovementType.ADJUSTMENT_NEGATIVE: 0.05,
            StockMovementType.TRANSFER_IN: 0.08,
            StockMovementType.TRANSFER_OUT: 0.08,
            StockMovementType.DAMAGE_LOSS: 0.03,
            StockMovementType.REPAIR_COMPLETED: 0.02,
            StockMovementType.WRITE_OFF: 0.01,
            StockMovementType.SYSTEM_CORRECTION: 0.05
        }
        
        for i in range(count):
            item = random.choice(self.items)
            location = random.choice(self.locations)
            movement_type = self._weighted_choice(type_weights)
            
            # Generate realistic quantities based on movement type
            if movement_type in [StockMovementType.PURCHASE, StockMovementType.TRANSFER_IN]:
                quantity_change = round(Decimal(str(random.uniform(10, 100))), 2)
            elif movement_type in [StockMovementType.SALE, StockMovementType.RENTAL_OUT]:
                quantity_change = -round(Decimal(str(random.uniform(1, 20))), 2)
            elif movement_type in [StockMovementType.RENTAL_RETURN, StockMovementType.REPAIR_COMPLETED]:
                quantity_change = round(Decimal(str(random.uniform(1, 20))), 2)
            else:
                quantity_change = round(Decimal(str(random.uniform(-10, 10))), 2)
            
            quantity_before = round(Decimal(str(random.uniform(0, 200))), 2)
            quantity_after = quantity_before + quantity_change
            
            movement = {
                "id": str(uuid4()),
                "movement_type": movement_type.value,
                "item_id": item["id"],
                "location_id": location["id"],
                "from_location_id": random.choice(self.locations)["id"] if movement_type == StockMovementType.TRANSFER_IN else None,
                "to_location_id": random.choice(self.locations)["id"] if movement_type == StockMovementType.TRANSFER_OUT else None,
                "quantity_change": quantity_change,
                "quantity_before": quantity_before,
                "quantity_after": max(Decimal('0'), quantity_after),
                "unit_cost": round(Decimal(str(random.uniform(10, 500))), 2) if random.random() > 0.3 else None,
                "total_cost": round(quantity_change * Decimal(str(random.uniform(10, 500))), 2) if random.random() > 0.3 else None,
                "reference_type": random.choice(["purchase_order", "sales_order", "rental_agreement", "adjustment", None]),
                "reference_id": str(uuid4()) if random.random() > 0.3 else None,
                "transaction_id": str(uuid4()) if random.random() > 0.4 else None,
                "customer_id": str(uuid4()) if movement_type in [StockMovementType.SALE, StockMovementType.RENTAL_OUT] else None,
                "supplier_id": str(uuid4()) if movement_type == StockMovementType.PURCHASE else None,
                "inventory_unit_ids": [str(uuid4()) for _ in range(random.randint(1, 3))] if random.random() > 0.5 else None,
                "reason": self._generate_movement_reason(movement_type),
                "notes": self._random_notes() if random.random() > 0.6 else None,
                "metadata": self._generate_movement_metadata(movement_type) if random.random() > 0.7 else None,
                "created_at": self._random_past_date(days=365).isoformat(),
                "created_by": str(uuid4())
            }
            movements.append(movement)
        
        # Sort by date for realistic chronological order
        movements.sort(key=lambda x: x['created_at'])
        
        self.generated_data['stock_movements'] = movements
        return movements
    
    def _weighted_choice(self, weights: Dict) -> Any:
        """Choose item based on weights."""
        items = list(weights.keys())
        weight_values = list(weights.values())
        return random.choices(items, weights=weight_values)[0]
    
    def _random_past_date(self, days: int) -> date:
        """Generate random date in the past."""
        return datetime.now().date() - timedelta(days=random.randint(0, days))
    
    def _random_future_date(self, days: int) -> date:
        """Generate random date in the future."""
        return datetime.now().date() + timedelta(days=random.randint(1, days))
    
    def _generate_maintenance_history(self) -> List[Dict]:
        """Generate maintenance history."""
        history = []
        for _ in range(random.randint(1, 5)):
            history.append({
                "date": self._random_past_date(days=365).isoformat(),
                "type": random.choice(["routine", "repair", "inspection", "calibration"]),
                "description": random.choice([
                    "Regular maintenance check", "Oil change", "Part replacement",
                    "Calibration adjustment", "Safety inspection", "Cleaning and lubrication"
                ]),
                "cost": random.uniform(25, 500),
                "technician": f"Tech{random.randint(100, 999)}"
            })
        return history
    
    def _random_notes(self) -> str:
        """Generate random notes."""
        notes = [
            "Item in good condition", "Minor wear visible", "Recently serviced",
            "Customer reported issue", "Scheduled for maintenance", "High demand item",
            "Popular rental item", "Requires special handling", "New acquisition",
            "Replacement part installed", "Quality check passed", "Training required"
        ]
        return random.choice(notes)
    
    def _generate_custom_attributes(self) -> Dict:
        """Generate custom attributes."""
        attributes = {}
        possible_attrs = {
            "weight_kg": random.uniform(0.5, 50),
            "dimensions": f"{random.randint(10, 100)}x{random.randint(10, 100)}x{random.randint(5, 50)}cm",
            "color": random.choice(["red", "blue", "black", "yellow", "green", "orange"]),
            "model_year": random.randint(2018, 2024),
            "power_rating": f"{random.randint(500, 3000)}W",
            "voltage": random.choice(["110V", "220V", "12V", "24V"]),
            "certification": random.choice(["CE", "UL", "CSA", "ISO9001"]),
            "warranty_type": random.choice(["standard", "extended", "professional"])
        }
        
        # Include 2-4 random attributes
        for attr in random.sample(list(possible_attrs.keys()), random.randint(2, 4)):
            attributes[attr] = possible_attrs[attr]
        
        return attributes
    
    def _generate_movement_reason(self, movement_type: StockMovementType) -> str:
        """Generate appropriate reason for movement type."""
        reasons = {
            StockMovementType.PURCHASE: [
                "New inventory purchase", "Restock low inventory", "Seasonal purchase",
                "Bulk order discount", "Special customer request"
            ],
            StockMovementType.SALE: [
                "Customer purchase", "Retail sale", "Online order", "Walk-in customer",
                "Bulk sale to contractor"
            ],
            StockMovementType.RENTAL_OUT: [
                "Equipment rental", "Tool rental", "Weekly rental", "Monthly rental",
                "Event rental", "Construction project rental"
            ],
            StockMovementType.RENTAL_RETURN: [
                "Rental period ended", "Early return", "Customer return",
                "Project completed", "Equipment no longer needed"
            ],
            StockMovementType.ADJUSTMENT_POSITIVE: [
                "Inventory count correction", "Found missing items", "System error correction",
                "Receiving error correction", "Damaged item restored"
            ],
            StockMovementType.ADJUSTMENT_NEGATIVE: [
                "Physical count discrepancy", "Theft loss", "Unaccounted shrinkage",
                "System error correction", "Damaged beyond repair"
            ]
        }
        
        default_reasons = ["Manual adjustment", "System correction", "Administrative change"]
        
        return random.choice(reasons.get(movement_type, default_reasons))
    
    def _generate_movement_metadata(self, movement_type: StockMovementType) -> Dict:
        """Generate metadata for movement."""
        metadata = {
            "timestamp": datetime.now().isoformat(),
            "user_agent": "InventorySystem/1.0",
            "session_id": str(uuid4())[:8]
        }
        
        if movement_type == StockMovementType.RENTAL_OUT:
            metadata.update({
                "rental_period_days": random.randint(1, 30),
                "deposit_amount": random.uniform(50, 500),
                "insurance_required": random.choice([True, False])
            })
        elif movement_type == StockMovementType.PURCHASE:
            metadata.update({
                "po_number": f"PO{random.randint(10000, 99999)}",
                "vendor_invoice": f"INV{random.randint(1000, 9999)}",
                "discount_percent": random.uniform(0, 15)
            })
        
        return metadata
    
    def save_to_files(self, output_dir: str = "test_data", format: str = "json"):
        """Save generated data to files."""
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)
        
        for data_type, data in self.generated_data.items():
            if not data:
                continue
            
            if format.lower() == "json":
                file_path = output_path / f"{data_type}.json"
                with open(file_path, 'w') as f:
                    json.dump(data, f, indent=2, default=str)
            
            elif format.lower() == "csv":
                file_path = output_path / f"{data_type}.csv"
                if data:
                    with open(file_path, 'w', newline='') as f:
                        writer = csv.DictWriter(f, fieldnames=data[0].keys())
                        writer.writeheader()
                        writer.writerows(data)
        
        # Save metadata
        metadata = {
            "generated_at": datetime.now().isoformat(),
            "total_records": sum(len(data) for data in self.generated_data.values()),
            "record_counts": {k: len(v) for k, v in self.generated_data.items()},
            "brands": len(self.brands),
            "categories": len(self.categories),
            "locations": len(self.locations),
            "items": len(self.items)
        }
        
        with open(output_path / "metadata.json", 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"Generated test data saved to {output_path}")
        print(f"Total records: {metadata['total_records']}")
        for data_type, count in metadata['record_counts'].items():
            print(f"  {data_type}: {count}")
    
    def generate_all(self, 
                    sku_sequences: int = 50,
                    stock_levels: int = 500, 
                    inventory_units: int = 1000,
                    stock_movements: int = 2000) -> Dict[str, List]:
        """Generate all data types."""
        print("🏭 Generating comprehensive inventory test data...")
        
        print(f"📋 Generating {sku_sequences} SKU sequences...")
        self.generate_sku_sequences(sku_sequences)
        
        print(f"📊 Generating {stock_levels} stock levels...")
        self.generate_stock_levels(stock_levels)
        
        print(f"📦 Generating {inventory_units} inventory units...")
        self.generate_inventory_units(inventory_units)
        
        print(f"📈 Generating {stock_movements} stock movements...")
        self.generate_stock_movements(stock_movements)
        
        print("✅ Data generation complete!")
        return self.generated_data


def main():
    """Main function for CLI usage."""
    parser = argparse.ArgumentParser(description="Generate inventory test data")
    parser.add_argument("--seed", type=int, help="Random seed for reproducible data")
    parser.add_argument("--sku-sequences", type=int, default=50, help="Number of SKU sequences")
    parser.add_argument("--stock-levels", type=int, default=500, help="Number of stock levels")
    parser.add_argument("--inventory-units", type=int, default=1000, help="Number of inventory units")
    parser.add_argument("--stock-movements", type=int, default=2000, help="Number of stock movements")
    parser.add_argument("--output-dir", default="test_data", help="Output directory")
    parser.add_argument("--format", choices=["json", "csv"], default="json", help="Output format")
    parser.add_argument("--preset", choices=["small", "medium", "large", "xlarge"], 
                       help="Use preset data sizes")
    
    args = parser.parse_args()
    
    # Apply presets
    if args.preset:
        presets = {
            "small": (10, 50, 100, 200),
            "medium": (25, 200, 500, 1000),
            "large": (50, 500, 1000, 2000),
            "xlarge": (100, 1000, 2000, 5000)
        }
        args.sku_sequences, args.stock_levels, args.inventory_units, args.stock_movements = presets[args.preset]
    
    # Generate data
    generator = InventoryDataGenerator(seed=args.seed)
    generator.generate_all(
        sku_sequences=args.sku_sequences,
        stock_levels=args.stock_levels,
        inventory_units=args.inventory_units,
        stock_movements=args.stock_movements
    )
    
    # Save to files
    generator.save_to_files(args.output_dir, args.format)
    
    print(f"\n🎯 Test data generation summary:")
    print(f"   Preset: {args.preset or 'custom'}")
    print(f"   Seed: {args.seed or 'random'}")
    print(f"   Format: {args.format}")
    print(f"   Output: {args.output_dir}")
    print(f"\n🚀 Ready for testing and development!")


if __name__ == "__main__":
    main()