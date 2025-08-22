"""
Test data fixtures for rental testing
"""
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4
from typing import Dict, List, Any

class RentalTestData:
    """Test data factory for rental tests."""
    
    @staticmethod
    def create_test_customer(customer_id: str = None) -> Dict[str, Any]:
        """Create test customer data."""
        return {
            "id": customer_id or str(uuid4()),
            "name": "John Smith",
            "email": "john.smith@test.com",
            "phone": "+1234567890",
            "address": "123 Test Street",
            "credit_limit": Decimal("5000.00"),
            "outstanding_balance": Decimal("0.00"),
            "customer_type": "REGULAR",
            "is_active": True
        }
    
    @staticmethod
    def create_test_item(item_id: str = None, **kwargs) -> Dict[str, Any]:
        """Create test item data."""
        defaults = {
            "id": item_id or str(uuid4()),
            "item_code": f"ITEM-{uuid4().hex[:6].upper()}",
            "item_name": "Canon 5D Mark IV Camera",
            "category": "Camera",
            "brand": "Canon",
            "daily_rate": Decimal("50.00"),
            "weekly_rate": Decimal("300.00"),
            "monthly_rate": Decimal("1000.00"),
            "replacement_cost": Decimal("2500.00"),
            "deposit_amount": Decimal("500.00"),
            "is_rentable": True,
            "is_active": True
        }
        defaults.update(kwargs)
        return defaults
    
    @staticmethod
    def create_rental_data(rental_type: str = "standard") -> Dict[str, Any]:
        """Create rental test data based on scenario type."""
        
        base_rental = {
            "id": str(uuid4()),
            "rental_number": f"RNT-{datetime.now().strftime('%Y%m%d')}-001",
            "customer_id": str(uuid4()),
            "start_date": datetime.now().date(),
            "end_date": (datetime.now() + timedelta(days=7)).date(),
            "total_amount": Decimal("350.00"),
            "deposit_amount": Decimal("500.00"),
            "status": "IN_PROGRESS",
            "created_at": datetime.now(),
            "created_by": "test_user"
        }
        
        if rental_type == "standard":
            # Standard 7-day rental with 3 items
            base_rental["items"] = [
                {
                    "item_id": str(uuid4()),
                    "item_name": "Canon 5D Camera",
                    "quantity": 1,
                    "daily_rate": Decimal("50.00"),
                    "total_amount": Decimal("350.00")
                },
                {
                    "item_id": str(uuid4()),
                    "item_name": "24-70mm Lens",
                    "quantity": 1,
                    "daily_rate": Decimal("30.00"),
                    "total_amount": Decimal("210.00")
                },
                {
                    "item_id": str(uuid4()),
                    "item_name": "Tripod",
                    "quantity": 1,
                    "daily_rate": Decimal("10.00"),
                    "total_amount": Decimal("70.00")
                }
            ]
            
        elif rental_type == "late":
            # Late rental - 3 days overdue
            base_rental["end_date"] = (datetime.now() - timedelta(days=3)).date()
            base_rental["status"] = "LATE"
            base_rental["days_late"] = 3
            base_rental["late_fee_per_day"] = Decimal("10.00")
            base_rental["items"] = [
                {
                    "item_id": str(uuid4()),
                    "item_name": "Professional Camera Kit",
                    "quantity": 1,
                    "daily_rate": Decimal("100.00"),
                    "total_amount": Decimal("700.00")
                }
            ]
            
        elif rental_type == "partial":
            # Rental with multiple items for partial return
            base_rental["items"] = [
                {
                    "item_id": str(uuid4()),
                    "item_name": "Camera Body",
                    "quantity": 2,  # Multiple quantity for partial return
                    "daily_rate": Decimal("50.00"),
                    "total_amount": Decimal("700.00")
                },
                {
                    "item_id": str(uuid4()),
                    "item_name": "Lens Kit",
                    "quantity": 3,
                    "daily_rate": Decimal("30.00"),
                    "total_amount": Decimal("630.00")
                },
                {
                    "item_id": str(uuid4()),
                    "item_name": "Memory Cards",
                    "quantity": 5,
                    "daily_rate": Decimal("5.00"),
                    "total_amount": Decimal("175.00")
                }
            ]
            
        elif rental_type == "damaged":
            # Rental for damage testing
            base_rental["items"] = [
                {
                    "item_id": str(uuid4()),
                    "item_name": "Drone DJI Mavic",
                    "quantity": 1,
                    "daily_rate": Decimal("75.00"),
                    "total_amount": Decimal("525.00"),
                    "replacement_cost": Decimal("1500.00")
                },
                {
                    "item_id": str(uuid4()),
                    "item_name": "Extra Battery",
                    "quantity": 2,
                    "daily_rate": Decimal("10.00"),
                    "total_amount": Decimal("140.00"),
                    "replacement_cost": Decimal("150.00")
                }
            ]
            
        return base_rental
    
    @staticmethod
    def create_return_request(return_type: str = "complete") -> Dict[str, Any]:
        """Create return request test data."""
        
        if return_type == "complete":
            return {
                "return_type": "COMPLETE",
                "return_date": datetime.now(),
                "items": [
                    {
                        "item_id": str(uuid4()),
                        "quantity_returned": 1,
                        "condition": "GOOD",
                        "condition_notes": ""
                    }
                ],
                "return_notes": "All items returned in good condition",
                "processed_by": "test_staff"
            }
            
        elif return_type == "partial":
            return {
                "return_type": "PARTIAL",
                "return_date": datetime.now(),
                "items": [
                    {
                        "item_id": str(uuid4()),
                        "quantity_returned": 1,
                        "quantity_remaining": 1,
                        "condition": "GOOD",
                        "condition_notes": ""
                    }
                ],
                "return_notes": "Customer keeping some items for extended period",
                "processed_by": "test_staff"
            }
            
        elif return_type == "damaged":
            return {
                "return_type": "COMPLETE",
                "return_date": datetime.now(),
                "items": [
                    {
                        "item_id": str(uuid4()),
                        "quantity_returned": 1,
                        "condition": "DAMAGED",
                        "damage_severity": "MAJOR",
                        "condition_notes": "Screen cracked, requires replacement",
                        "damage_charge": Decimal("250.00")
                    }
                ],
                "return_notes": "Item damaged during use",
                "processed_by": "test_staff"
            }
            
        elif return_type == "mixed":
            return {
                "return_type": "COMPLETE",
                "return_date": datetime.now(),
                "items": [
                    {
                        "item_id": str(uuid4()),
                        "quantity_returned": 1,
                        "condition": "GOOD",
                        "condition_notes": ""
                    },
                    {
                        "item_id": str(uuid4()),
                        "quantity_returned": 1,
                        "condition": "DAMAGED",
                        "damage_severity": "MINOR",
                        "condition_notes": "Minor scratches",
                        "damage_charge": Decimal("50.00")
                    },
                    {
                        "item_id": str(uuid4()),
                        "quantity_returned": 0,
                        "condition": "LOST",
                        "condition_notes": "Customer reported item lost",
                        "damage_charge": Decimal("500.00")
                    }
                ],
                "return_notes": "Mixed condition return",
                "processed_by": "test_staff"
            }
    
    @staticmethod
    def expected_return_calculations(rental_data: Dict, return_data: Dict) -> Dict[str, Any]:
        """Calculate expected return values for assertions."""
        
        calculations = {
            "deposit_amount": rental_data["deposit_amount"],
            "rental_charges": rental_data["total_amount"],
            "late_fees": Decimal("0.00"),
            "damage_charges": Decimal("0.00"),
            "refund_amount": Decimal("0.00"),
            "customer_owes": Decimal("0.00")
        }
        
        # Calculate late fees
        if rental_data.get("days_late", 0) > 0:
            late_fee_per_day = rental_data.get("late_fee_per_day", Decimal("10.00"))
            calculations["late_fees"] = late_fee_per_day * rental_data["days_late"] * len(rental_data["items"])
        
        # Calculate damage charges
        for item in return_data.get("items", []):
            if item.get("damage_charge"):
                calculations["damage_charges"] += item["damage_charge"]
        
        # Calculate final amounts
        total_charges = calculations["rental_charges"] + calculations["late_fees"] + calculations["damage_charges"]
        
        if total_charges <= calculations["deposit_amount"]:
            calculations["refund_amount"] = calculations["deposit_amount"] - total_charges
            calculations["customer_owes"] = Decimal("0.00")
        else:
            calculations["refund_amount"] = Decimal("0.00")
            calculations["customer_owes"] = total_charges - calculations["deposit_amount"]
        
        return calculations