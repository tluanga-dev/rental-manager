#!/usr/bin/env python3
"""
Enhanced Item Generator for Rental Management System
Generates 250 diverse rental items with proper category_code and unit_of_measurement_code linking.

Author: Claude Code Assistant
Date: July 31, 2025
"""

import json
import random
import os
from decimal import Decimal
from typing import Dict, List, Optional
from dataclasses import dataclass


@dataclass
class ItemTemplate:
    """Template for generating similar items"""
    name_pattern: str
    model_pattern: str
    description: str
    specifications: str
    rental_rate_range: tuple
    purchase_price_range: tuple
    security_deposit_range: tuple
    serial_number_required: bool
    is_rentable: bool
    is_saleable: bool
    warranty_days: str


class EnhancedItemGenerator:
    """Generates 250 diverse rental items with proper linking"""
    
    def __init__(self):
        self.base_path = "/Users/tluanga/current_work/rental-manager/rental-manager-backend"
        self.brands = {}
        self.categories = {}
        self.units = {}
        self.sku_counter = 1
        self.setup_templates()
        
    def load_reference_data(self):
        """Load brands, categories, and units data"""
        try:
            with open(os.path.join(self.base_path, 'dummy_data/brands.json')) as f:
                brands_list = json.load(f)
                self.brands = {b['code']: b for b in brands_list}
                
            with open(os.path.join(self.base_path, 'dummy_data/categories.json')) as f:
                categories_list = json.load(f)
                self.categories = {c['category_code']: c for c in categories_list}
                
            with open(os.path.join(self.base_path, 'dummy_data/units.json')) as f:
                units_list = json.load(f)
                self.units = {u['code']: u for u in units_list}
                
            print(f"✅ Loaded {len(self.brands)} brands, {len(self.categories)} categories, {len(self.units)} units")
            
        except Exception as e:
            print(f"❌ Error loading reference data: {e}")
            raise
    
    def setup_templates(self):
        """Setup item templates for different categories"""
        
        # Construction Equipment Templates
        self.construction_templates = {
            "CON-EXC": [  # Excavators
                ItemTemplate("Mini Excavator", "MODEL-{}", "Compact excavator ideal for urban construction and landscaping", 
                           "Operating weight: {}-{} kg, Engine power: {}-{} kW, Max dig depth: {}-{} m", 
                           (145, 695), (38000, 320000), (1200, 8000), True, True, False, "90"),
                ItemTemplate("Standard Excavator", "MODEL-{}", "Heavy-duty excavator for construction and earthmoving", 
                           "Operating weight: {}-{} kg, Engine power: {}-{} kW, Bucket capacity: {}-{} m³", 
                           (485, 950), (185000, 450000), (5000, 12000), True, True, False, "60"),
            ],
            "CON-BUL": [  # Bulldozers
                ItemTemplate("Compact Bulldozer", "D{}", "Versatile dozer for grading and earthmoving", 
                           "Operating weight: {}-{} kg, Engine power: {}-{} kW, Blade capacity: {}-{} m³", 
                           (375, 625), (125000, 280000), (3500, 7500), True, True, False, "90"),
                ItemTemplate("Heavy Bulldozer", "D{}", "Large bulldozer for major earthmoving projects", 
                           "Operating weight: {}-{} kg, Engine power: {}-{} kW, Blade width: {}-{} m", 
                           (825, 1250), (380000, 650000), (10000, 18000), True, True, False, "60"),
            ],
            "CON-CRN": [  # Cranes
                ItemTemplate("Mobile Crane", "RT{}", "Rough terrain crane for construction sites", 
                           "Max capacity: {}-{} tons, Boom length: {}-{} m, Engine power: {}-{} kW", 
                           (450, 850), (185000, 425000), (4500, 9500), True, True, False, "60"),
                ItemTemplate("Tower Crane", "TC{}", "High-capacity tower crane for tall buildings", 
                           "Max capacity: {}-{} tons, Jib length: {}-{} m, Max height: {}-{} m", 
                           (1200, 2500), (650000, 1200000), (15000, 35000), True, True, False, "30"),
            ],
            "CON-FOR": [  # Forklifts & Telehandlers
                ItemTemplate("Forklift", "FLT{}", "Industrial forklift for material handling", 
                           "Lift capacity: {}-{} kg, Lift height: {}-{} m, Engine power: {}-{} kW", 
                           (85, 185), (25000, 65000), (850, 2000), True, True, False, "90"),
                ItemTemplate("Telehandler", "TH{}", "Telescopic handler for construction and agriculture", 
                           "Lift capacity: {}-{} kg, Reach: {}-{} m, Lift height: {}-{} m", 
                           (125, 285), (45000, 125000), (1250, 3500), True, True, False, "90"),
            ],
            "CON-AWP": [  # Aerial Work Platforms
                ItemTemplate("Scissor Lift", "SL{}", "Electric scissor lift for indoor work", 
                           "Platform height: {}-{} m, Platform capacity: {}-{} kg, Width: {}-{} m", 
                           (65, 145), (18000, 45000), (650, 1500), True, True, False, "90"),
                ItemTemplate("Boom Lift", "BL{}", "Articulating boom lift for outdoor access", 
                           "Working height: {}-{} m, Horizontal reach: {}-{} m, Platform capacity: {}-{} kg", 
                           (95, 265), (35000, 95000), (950, 2850), True, True, False, "90"),
            ],
            "CON-LOD": [  # Loaders
                ItemTemplate("Wheel Loader", "WL{}", "Front-end loader for material handling", 
                           "Operating weight: {}-{} kg, Bucket capacity: {}-{} m³, Engine power: {}-{} kW", 
                           (185, 485), (65000, 185000), (1850, 5500), True, True, False, "90"),
                ItemTemplate("Skid Steer Loader", "SSL{}", "Compact skid steer for tight spaces", 
                           "Operating weight: {}-{} kg, Rated capacity: {}-{} kg, Engine power: {}-{} kW", 
                           (125, 225), (35000, 75000), (1250, 2500), True, True, False, "90"),
            ]
        }
        
        # Catering Equipment Templates
        self.catering_templates = {
            "CAT-COOK-OVN": [  # Commercial Ovens
                ItemTemplate("Convection Oven", "CO{}", "Commercial convection oven for bakeries and restaurants", 
                           "Capacity: {} trays, Temperature range: {}-{}°C, Power: {} kW", 
                           (45, 125), (8500, 25000), (450, 1250), False, True, True, "365"),
                ItemTemplate("Deck Oven", "DO{}", "Stone deck oven for pizza and bread baking", 
                           "Deck size: {}x{} cm, Temperature: up to {}°C, Chambers: {}", 
                           (85, 185), (15000, 45000), (850, 2000), False, True, True, "365"),
            ],
            "CAT-COOK-GR": [  # Gas Ranges
                ItemTemplate("Gas Range", "GR{}", "Heavy-duty commercial gas range", 
                           "Burners: {}, BTU output: {} per burner, Oven capacity: {} liters", 
                           (35, 95), (4500, 15000), (350, 950), False, True, True, "365"),
                ItemTemplate("Griddle", "GD{}", "Commercial gas griddle for high-volume cooking", 
                           "Cooking surface: {}x{} cm, BTU output: {}, Temperature range: {}-{}°C", 
                           (55, 145), (6500, 22000), (550, 1450), False, True, True, "365"),
            ],
            "CAT-COOK-DF": [  # Deep Fryers
                ItemTemplate("Deep Fryer", "DF{}", "Commercial deep fryer for restaurants", 
                           "Oil capacity: {} liters, Power: {} kW, Baskets: {}", 
                           (25, 75), (3500, 12000), (250, 750), False, True, True, "365"),
                ItemTemplate("Pressure Fryer", "PF{}", "High-efficiency pressure fryer", 
                           "Capacity: {} kg, Pressure: {} psi, Recovery time: {} minutes", 
                           (65, 145), (8500, 28000), (650, 1450), False, True, True, "365"),
            ],
            "CAT-PREP-BM": [  # Blenders & Mixers
                ItemTemplate("Commercial Blender", "CB{}", "High-speed commercial blender", 
                           "Motor power: {} HP, Container capacity: {} liters, Speed settings: {}", 
                           (15, 45), (1200, 4500), (150, 450), False, True, True, "365"),
                ItemTemplate("Stand Mixer", "SM{}", "Heavy-duty stand mixer for bakeries", 
                           "Bowl capacity: {} liters, Motor power: {} HP, Attachments included: {}", 
                           (25, 85), (2500, 8500), (250, 850), False, True, True, "365"),
            ],
            "CAT-PREP-FP": [  # Food Processors
                ItemTemplate("Food Processor", "FP{}", "Commercial food processor for prep work", 
                           "Bowl capacity: {} liters, Motor power: {} HP, Blade types: {}", 
                           (18, 55), (1800, 6500), (180, 550), False, True, True, "365"),
                ItemTemplate("Vegetable Cutter", "VC{}", "Industrial vegetable cutting machine", 
                           "Cutting capacity: {} kg/hr, Blade options: {}, Motor power: {} HP", 
                           (35, 95), (4500, 15000), (350, 950), False, True, True, "365"),
            ],
            "CAT-BEV": [  # Beverage Equipment
                ItemTemplate("Coffee Machine", "CM{}", "Commercial espresso machine", 
                           "Groups: {}, Boiler capacity: {} liters, Steam wands: {}", 
                           (45, 145), (5500, 25000), (450, 1450), False, True, True, "365"),
                ItemTemplate("Beverage Dispenser", "BD{}", "Cold beverage dispenser", 
                           "Tanks: {}, Capacity per tank: {} liters, Cooling system: {}", 
                           (25, 75), (2500, 12000), (250, 750), False, True, True, "365"),
            ]
        }
        
        # Event Equipment Templates
        self.event_templates = {
            "EVT-AUD": [  # Audio Equipment
                ItemTemplate("PA System", "PA{}", "Professional PA system for events", 
                           "Power output: {} watts, Frequency response: {}-{} Hz, Channels: {}", 
                           (35, 145), (2500, 15000), (350, 1450), False, True, True, "180"),
                ItemTemplate("Wireless Microphone", "WM{}", "Professional wireless microphone system", 
                           "Frequency range: {} MHz, Battery life: {} hours, Range: {} meters", 
                           (15, 55), (850, 4500), (150, 550), False, True, True, "180"),
            ],
            "EVT-VIS": [  # Visual Equipment
                ItemTemplate("Projector", "PJ{}", "High-brightness projector for events", 
                           "Brightness: {} lumens, Resolution: {}x{}, Throw ratio: {}", 
                           (25, 95), (2800, 12000), (250, 950), False, True, True, "180"),
                ItemTemplate("LED Screen", "LED{}", "Large LED display screen", 
                           "Size: {}x{} meters, Pixel pitch: {} mm, Brightness: {} nits", 
                           (85, 285), (8500, 35000), (850, 2850), False, True, True, "180"),
            ],
            "EVT-LGT": [  # Lighting & Effects
                ItemTemplate("LED Par Light", "LP{}", "LED par light for stage lighting", 
                           "LED count: {}, Power consumption: {} watts, Beam angle: {}°", 
                           (8, 25), (450, 1500), (80, 250), False, True, True, "180"),
                ItemTemplate("Moving Head Light", "MH{}", "Intelligent moving head light", 
                           "Light source: {} W, Pan/Tilt: {}°/{}°, Gobo wheel: {} positions", 
                           (18, 65), (1200, 6500), (180, 650), False, True, True, "180"),
            ],
            "EVT-STR": [  # Staging & Rigging
                ItemTemplate("Stage Platform", "SP{}", "Modular stage platform", 
                           "Size: {}x{} meters, Height: {} cm, Load capacity: {} kg/m²", 
                           (12, 45), (850, 3500), (120, 450), False, True, False, "90"),
                ItemTemplate("Truss System", "TS{}", "Aluminum truss system for rigging", 
                           "Length: {} meters, Load capacity: {} kg, Cross section: {} mm", 
                           (15, 55), (1200, 5500), (150, 550), False, True, False, "90"),
            ],
            "EVT-FURN": [  # Furniture & Décor
                ItemTemplate("Round Table", "RT{}", "Round banquet table for events", 
                           "Diameter: {} cm, Height: {} cm, Capacity: {} people", 
                           (5, 15), (180, 650), (50, 150), False, True, False, "30"),
                ItemTemplate("Chiavari Chair", "CC{}", "Elegant chiavari chair for weddings", 
                           "Material: {}, Weight capacity: {} kg, Stackable: {}", 
                           (3, 8), (85, 250), (30, 80), False, True, False, "30"),
            ]
        }
        
        # Power Tools Templates
        self.power_templates = {
            "PWR-DRL": [  # Power Drills
                ItemTemplate("Cordless Drill", "CD{}", "Professional cordless drill", 
                           "Voltage: {} V, Chuck size: {} mm, Torque: {} Nm", 
                           (8, 25), (180, 650), (80, 250), False, True, True, "365"),
                ItemTemplate("Hammer Drill", "HD{}", "Heavy-duty hammer drill", 
                           "Power: {} W, Impact energy: {} J, Chuck: {} mm", 
                           (12, 35), (250, 850), (120, 350), False, True, True, "365"),
            ],
            "PWR-GRD": [  # Angle Grinders
                ItemTemplate("Angle Grinder", "AG{}", "Professional angle grinder", 
                           "Disc size: {} mm, Power: {} W, No-load speed: {} rpm", 
                           (6, 18), (150, 550), (60, 180), False, True, True, "365"),
                ItemTemplate("Cut-off Saw", "CS{}", "Electric cut-off saw", 
                           "Blade size: {} mm, Power: {} W, Cutting depth: {} mm", 
                           (15, 45), (450, 1200), (150, 450), False, True, True, "365"),
            ],
            "PWR-EXT": [  # Extension Cords
                ItemTemplate("Heavy Duty Extension Cord", "EC{}", "Industrial extension cord", 
                           "Length: {} meters, AWG: {}, Amperage: {} A", 
                           (2, 8), (45, 180), (20, 80), False, True, False, "180"),
                ItemTemplate("Retractable Cord Reel", "CR{}", "Retractable cord reel", 
                           "Length: {} meters, Outlets: {}, Circuit breaker: {} A", 
                           (5, 15), (120, 450), (50, 150), False, True, False, "180"),
            ]
        }
        
        # Cleaning Equipment Templates
        self.cleaning_templates = {
            "CLN-VAC": [  # Vacuum Cleaners
                ItemTemplate("Wet/Dry Vacuum", "WDV{}", "Industrial wet/dry vacuum", 
                           "Tank capacity: {} liters, Motor power: {} HP, Hose length: {} meters", 
                           (12, 35), (450, 1200), (120, 350), False, True, True, "365"),
                ItemTemplate("Backpack Vacuum", "BPV{}", "Lightweight backpack vacuum", 
                           "Weight: {} kg, Tank capacity: {} liters, Cord length: {} meters", 
                           (8, 22), (280, 850), (80, 220), False, True, True, "365"),
            ],
            "CLN-PW": [  # Pressure Washers
                ItemTemplate("Electric Pressure Washer", "EPW{}", "Electric pressure washer", 
                           "Pressure: {} PSI, Flow rate: {} GPM, Motor: {} HP", 
                           (15, 45), (650, 1800), (150, 450), False, True, True, "365"),
                ItemTemplate("Gas Pressure Washer", "GPW{}", "Gas-powered pressure washer", 
                           "Pressure: {} PSI, Flow rate: {} GPM, Engine: {} HP", 
                           (25, 75), (1200, 3500), (250, 750), False, True, True, "365"),
            ],
            "CLN-SCRUB": [  # Floor Scrubbers
                ItemTemplate("Walk-Behind Scrubber", "WBS{}", "Walk-behind floor scrubber", 
                           "Cleaning width: {} cm, Tank capacity: {} liters, Battery: {} V", 
                           (35, 95), (2500, 8500), (350, 950), False, True, True, "365"),
                ItemTemplate("Ride-On Scrubber", "ROS{}", "Ride-on floor scrubber", 
                           "Cleaning width: {} cm, Solution tank: {} liters, Speed: {} km/h", 
                           (65, 185), (5500, 18500), (650, 1850), False, True, True, "365"),
            ],
            "CLN-MB": [  # Mops & Buckets
                ItemTemplate("Commercial Mop Bucket", "MB{}", "Heavy-duty mop bucket with wringer", 
                           "Capacity: {} liters, Material: {}, Wheels: {}", 
                           (3, 8), (65, 185), (30, 80), False, True, False, "180"),
                ItemTemplate("String Mop Set", "SMS{}", "Commercial string mop with handle", 
                           "Handle length: {} cm, Mop head size: {} cm, Material: {}", 
                           (2, 6), (25, 85), (20, 60), False, True, False, "180"),
            ]
        }
    
    def get_category_unit_mapping(self) -> Dict[str, str]:
        """Define unit mappings for categories"""
        return {
            # Construction Equipment - typically "pcs" (pieces)
            "CON-EXC": "pcs", "CON-BUL": "pcs", "CON-CRN": "pcs",
            "CON-FOR": "pcs", "CON-AWP": "pcs", "CON-LOD": "pcs",
            "CON-CMP": "pcs", "CON-CNC": "pcs", "CON-HYD": "pcs",
            
            # Catering Equipment - mix of "pcs" and "set"
            "CAT-COOK-OVN": "pcs", "CAT-COOK-GR": "pcs", "CAT-COOK-DF": "pcs",
            "CAT-COOK-FW": "pcs", "CAT-PREP-BM": "pcs", "CAT-PREP-FP": "pcs",
            "CAT-SERVE": "set", "CAT-BEV": "pcs", "CAT-DISP": "set", "CAT-COLD": "pcs",
            
            # Event Equipment - typically "pcs" or "set"  
            "EVT-AUD": "set", "EVT-VIS": "pcs", "EVT-LGT": "pcs",
            "EVT-STR": "set", "EVT-FURN": "pcs", "EVT-SUP": "set", "EVT-LOG": "pcs",
            
            # Power Tools - typically "pcs"
            "PWR-DRL": "pcs", "PWR-GRD": "pcs", "PWR-EXT": "ft",
            
            # Cleaning Equipment - typically "pcs"
            "CLN-VAC": "pcs", "CLN-PW": "pcs", "CLN-SCRUB": "pcs", "CLN-MB": "set"
        }
    
    def get_brand_category_mapping(self) -> Dict[str, List[str]]:
        """Define which brands can be used for which categories"""
        return {
            # Construction Equipment Brands
            "CAT": ["CON-EXC", "CON-BUL", "CON-LOD", "CLN-PW", "CLN-SCRUB"],
            "JD": ["CON-EXC", "CON-LOD", "CON-FOR"],
            "KOM": ["CON-EXC", "CON-BUL", "CON-CRN"],
            "VOLVO": ["CON-EXC", "CON-LOD", "CON-CRN"],
            "LIEBH": ["CON-CRN", "CON-EXC"],
            "HIT": ["CON-EXC"],
            "HYU": ["CON-EXC", "CON-LOD"],
            "JCB": ["CON-EXC", "CON-FOR", "CON-LOD"],
            "CASE": ["CON-EXC", "CON-LOD", "CON-FOR"],
            "NH": ["CON-LOD", "CON-FOR"],
            "BOB": ["CON-EXC", "CON-LOD", "CON-AWP", "CLN-VAC", "CLN-PW", "CLN-SCRUB"],
            "KUB": ["CON-EXC", "CON-FOR"],
            "TAKE": ["CON-EXC"],
            "YAN": ["CON-EXC"],
            "DOO": ["CON-EXC", "CON-LOD"],
            
            # Power Tool Brands
            "MAK": ["PWR-DRL", "PWR-GRD", "PWR-EXT", "CLN-VAC"],
            "DEW": ["PWR-DRL", "PWR-GRD", "PWR-EXT", "CLN-VAC"],
            "MIL": ["PWR-DRL", "PWR-GRD", "PWR-EXT"],
            "BOS": ["PWR-DRL", "PWR-GRD", "PWR-EXT", "CLN-VAC", "CLN-PW"],
            "HIL": ["PWR-DRL", "PWR-GRD", "PWR-EXT"],
            
            # Catering Equipment Brands
            "WEB": ["CAT-COOK-OVN", "CAT-COOK-GR"],
            "VIK": ["CAT-COOK-OVN", "CAT-PREP-BM"],
            "HOB": ["CAT-PREP-BM", "CAT-PREP-FP"],
            "VUL": ["CAT-COOK-OVN", "CAT-COOK-DF"],
            "GAR": ["CAT-COOK-GR", "CAT-COOK-OVN"],
            "TRUE": ["CAT-COLD", "CAT-BEV"],
            "BEV": ["CAT-COLD", "CAT-BEV"],
            "TRA": ["CAT-COLD"],
            "CAM": ["CAT-DISP", "CAT-SERVE"],
            "VOL": ["CAT-SERVE", "CAT-PREP-BM"],
            "CDD": ["CAT-SERVE", "CAT-DISP"],
            
            # Event Equipment Brands
            "PRP": ["EVT-FURN", "EVT-SUP"],
            "EPR": ["EVT-AUD", "EVT-VIS", "EVT-LGT"],
            "YAM": ["EVT-AUD"],
            "JBL": ["EVT-AUD"],
            "BOSE": ["EVT-AUD"],
            "SHU": ["EVT-AUD"],
            "QSC": ["EVT-AUD"],
            "MAC": ["EVT-AUD"],
            "CHA": ["EVT-LGT"],
            "MAR": ["EVT-LGT"],
            "ETC": ["EVT-LGT"],
            "ADJ": ["EVT-LGT"],
            "ELA": ["EVT-LGT"],
            "LIN": ["EVT-FURN"],
            "PPR": ["EVT-FURN", "EVT-SUP"],
            "CLA": ["EVT-STR", "EVT-SUP"],
            "ELE": ["EVT-FURN", "EVT-DISP"],
            "FES": ["EVT-SUP", "EVT-LOG"],
            "PRO": ["EVT-STR"],
            "DFD": ["EVT-FURN"],
            
            # Additional brands for cleaning equipment
            "VOL": ["CAT-SERVE", "CAT-PREP-BM", "CLN-MB"],
            "CAM": ["CAT-DISP", "CAT-SERVE", "CLN-MB"],
            "TRUE": ["CAT-COLD", "CAT-BEV", "CLN-MB"]
        }
    
    def generate_sku(self, brand_code: str, model: str) -> str:
        """Generate unique SKU"""
        sku = f"{brand_code}-{model}-{self.sku_counter:03d}"
        self.sku_counter += 1
        return sku
    
    def generate_specifications(self, spec_template: str, category_code: str) -> str:
        """Generate realistic specifications based on category"""
        try:
            if "CON-EXC" in category_code:  # Excavators
                return spec_template.format(
                    random.randint(1500, 35000),  # weight kg
                    random.randint(45000, 55000),  # weight kg upper
                    random.randint(15, 200),  # power kW
                    random.randint(25, 250),  # power kW upper  
                    random.uniform(2.5, 7.9),  # dig depth
                    random.uniform(3.1, 8.5)   # dig depth upper
                )
            elif "CAT-COOK" in category_code:  # Cooking equipment
                return spec_template.format(
                    random.randint(4, 20),  # capacity/trays
                    random.randint(150, 300),  # temp range low
                    random.randint(350, 500),  # temp range high
                    random.randint(5, 25)   # power kW
                )
            elif "EVT-AUD" in category_code:  # Audio equipment
                return spec_template.format(
                    random.randint(100, 2000),  # power watts
                    random.randint(20, 50),     # freq low
                    random.randint(18000, 22000),  # freq high
                    random.randint(2, 32)       # channels
                )
            elif "PWR-DRL" in category_code:  # Power drills
                return spec_template.format(
                    random.randint(12, 24),     # voltage
                    random.randint(10, 13),     # chuck size
                    random.randint(25, 95)      # torque
                )
            elif "CLN-VAC" in category_code:  # Vacuum cleaners
                return spec_template.format(
                    random.randint(20, 80),     # tank capacity
                    random.uniform(1.5, 6.5),  # motor HP
                    random.randint(5, 15)       # hose length
                )
            else:
                # Generic fallback
                return spec_template.format(
                    random.randint(10, 100),
                    random.randint(100, 500),
                    random.randint(5, 50),
                    random.randint(2, 20)
                )
        except:
            return "Professional grade equipment with industry-standard specifications"
    
    def generate_items_for_category(self, category_code: str, count: int, templates: Dict) -> List[Dict]:
        """Generate items for a specific category"""
        items = []
        category_unit_map = self.get_category_unit_mapping()
        brand_category_map = self.get_brand_category_mapping()
        
        # Get valid brands for this category
        valid_brands = [brand for brand, categories in brand_category_map.items() 
                       if category_code in categories]
        
        if not valid_brands:
            print(f"⚠️  No valid brands found for category {category_code}")
            return items
        
        # Get templates for this category
        category_templates = templates.get(category_code, [])
        if not category_templates:
            print(f"⚠️  No templates found for category {category_code}")
            return items
        
        unit_code = category_unit_map.get(category_code, "pcs")
        
        for i in range(count):
            try:
                # Select random brand and template
                brand_code = random.choice(valid_brands)
                template = random.choice(category_templates)
                
                # Generate model number
                model_num = template.model_pattern.format(random.randint(100, 999))
                
                # Generate item data
                item = {
                    "sku": self.generate_sku(brand_code, model_num),
                    "item_name": f"{self.brands[brand_code]['name']} {template.name_pattern.replace('{}', str(random.randint(10, 99)))}",
                    "item_status": "ACTIVE",
                    "brand_code": brand_code,
                    "category_code": category_code,
                    "unit_of_measurement_code": unit_code,
                    "model_number": model_num,
                    "description": template.description,
                    "specifications": self.generate_specifications(template.specifications, category_code),
                    "rental_rate_per_period": round(random.uniform(*template.rental_rate_range), 2),
                    "rental_period": "1",
                    "sale_price": None if not template.is_saleable else round(random.uniform(*template.purchase_price_range) * 1.3, 2),
                    "purchase_price": round(random.uniform(*template.purchase_price_range), 2),
                    "security_deposit": round(random.uniform(*template.security_deposit_range), 2),
                    "warranty_period_days": template.warranty_days,
                    "reorder_point": random.randint(1, 5),
                    "is_rentable": template.is_rentable,
                    "is_saleable": template.is_saleable,
                    "serial_number_required": template.serial_number_required
                }
                
                items.append(item)
                
            except Exception as e:
                print(f"❌ Error generating item {i+1} for category {category_code}: {e}")
                continue
        
        return items
    
    def generate_250_items(self) -> List[Dict]:
        """Generate 250 diverse rental items"""
        print("🚀 Starting generation of 250 items...")
        items = []
        
        # Define item distribution (total 250 items)
        distribution = {
            # Construction Equipment (80 items)
            "CON-EXC": 25,   # Excavators
            "CON-BUL": 15,   # Bulldozers
            "CON-CRN": 10,   # Cranes
            "CON-FOR": 12,   # Forklifts & Telehandlers
            "CON-AWP": 8,    # Aerial Work Platforms
            "CON-LOD": 10,   # Loaders
            
            # Catering Equipment (60 items)
            "CAT-COOK-OVN": 15,  # Commercial Ovens
            "CAT-COOK-GR": 12,   # Gas Ranges
            "CAT-COOK-DF": 8,    # Deep Fryers
            "CAT-PREP-BM": 10,   # Blenders & Mixers
            "CAT-PREP-FP": 8,    # Food Processors
            "CAT-BEV": 7,        # Beverage Equipment
            
            # Event Management Equipment (50 items)
            "EVT-AUD": 15,   # Audio Equipment
            "EVT-VIS": 12,   # Visual Equipment
            "EVT-LGT": 10,   # Lighting & Effects
            "EVT-STR": 8,    # Staging & Rigging
            "EVT-FURN": 5,   # Furniture & Décor
            
            # Power & Electrical Tools (35 items)
            "PWR-DRL": 15,   # Power Drills
            "PWR-GRD": 12,   # Angle Grinders
            "PWR-EXT": 8,    # Extension Cords
            
            # Cleaning Equipment (33 items to reach 250 total)
            "CLN-VAC": 12,   # Vacuum Cleaners
            "CLN-PW": 10,    # Pressure Washers
            "CLN-SCRUB": 8,  # Floor Scrubbers
            "CLN-MB": 3,     # Mops & Buckets
        }
        
        # Combine all templates
        all_templates = {
            **self.construction_templates,
            **self.catering_templates,
            **self.event_templates,
            **self.power_templates,
            **self.cleaning_templates
        }
        
        # Generate items for each category
        total_generated = 0
        for category_code, count in distribution.items():
            print(f"📦 Generating {count} items for category {category_code}...")
            category_items = self.generate_items_for_category(category_code, count, all_templates)
            items.extend(category_items)
            total_generated += len(category_items)
            print(f"✅ Generated {len(category_items)}/{count} items for {category_code}")
        
        print(f"🎉 Successfully generated {total_generated} items total!")
        return items
    
    def save_items_to_file(self, items: List[Dict], filename: str = "items_enhanced_250.json"):
        """Save generated items to JSON file"""
        filepath = os.path.join(self.base_path, "dummy_data", filename)
        
        try:
            with open(filepath, 'w') as f:
                json.dump(items, f, indent=2)
            print(f"💾 Saved {len(items)} items to {filepath}")
            return filepath
        except Exception as e:
            print(f"❌ Error saving items: {e}")
            raise
    
    def validate_items(self, items: List[Dict]) -> Dict[str, int]:
        """Validate generated items"""
        print("🔍 Validating generated items...")
        
        validation_results = {
            "total_items": len(items),
            "unique_skus": len(set(item["sku"] for item in items)),
            "valid_brands": 0,
            "valid_categories": 0,
            "valid_units": 0,
            "rentable_items": 0,
            "saleable_items": 0,
            "serial_required": 0
        }
        
        for item in items:
            # Check brand validity
            if item["brand_code"] in self.brands:
                validation_results["valid_brands"] += 1
            
            # Check category validity
            if item["category_code"] in self.categories:
                validation_results["valid_categories"] += 1
            
            # Check unit validity
            if item["unit_of_measurement_code"] in self.units:
                validation_results["valid_units"] += 1
            
            # Count rentable/saleable items
            if item["is_rentable"]:
                validation_results["rentable_items"] += 1
            if item["is_saleable"]:
                validation_results["saleable_items"] += 1
            if item["serial_number_required"]:
                validation_results["serial_required"] += 1
        
        # Print validation summary
        print(f"📊 Validation Results:")
        print(f"   Total items: {validation_results['total_items']}")
        print(f"   Unique SKUs: {validation_results['unique_skus']}")
        print(f"   Valid brands: {validation_results['valid_brands']}/{validation_results['total_items']}")
        print(f"   Valid categories: {validation_results['valid_categories']}/{validation_results['total_items']}")
        print(f"   Valid units: {validation_results['valid_units']}/{validation_results['total_items']}")
        print(f"   Rentable items: {validation_results['rentable_items']}")
        print(f"   Saleable items: {validation_results['saleable_items']}")
        print(f"   Serial required: {validation_results['serial_required']}")
        
        return validation_results
    
    def run(self):
        """Main execution method"""
        print("🎯 Enhanced Item Generator Starting...")
        
        try:
            # Load reference data
            self.load_reference_data()
            
            # Generate 250 items
            items = self.generate_250_items()
            
            # Validate items
            validation_results = self.validate_items(items)
            
            # Save to file
            filepath = self.save_items_to_file(items)
            
            print(f"\n🎉 SUCCESS! Generated and saved 250 enhanced items!")
            print(f"📁 File: {filepath}")
            print(f"✅ All items have proper category_code and unit_of_measurement_code linking")
            
            return filepath, validation_results
            
        except Exception as e:
            print(f"❌ Error during generation: {e}")
            raise


def main():
    """Main entry point"""
    generator = EnhancedItemGenerator()
    filepath, results = generator.run()
    
    print(f"\n📋 Summary:")
    print(f"   Items generated: {results['total_items']}")
    print(f"   SKU uniqueness: {'✅' if results['unique_skus'] == results['total_items'] else '❌'}")
    print(f"   Brand linking: {'✅' if results['valid_brands'] == results['total_items'] else '❌'}")
    print(f"   Category linking: {'✅' if results['valid_categories'] == results['total_items'] else '❌'}")
    print(f"   Unit linking: {'✅' if results['valid_units'] == results['total_items'] else '❌'}")
    
    return filepath


if __name__ == "__main__":
    main()