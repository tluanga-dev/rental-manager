"""
Unit tests for rental return functionality
"""
import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import Mock, AsyncMock, patch
import asyncio

from tests.fixtures.rental_test_data import RentalTestData

# Mock the service and repository classes since we're testing business logic
class MockRentalRepository:
    async def get_by_id(self, rental_id: str):
        return RentalTestData.create_rental_data("standard")
    
    async def update(self, rental):
        return rental
    
    async def create_return_record(self, return_data):
        return {"id": "return-001", **return_data}

class MockInventoryService:
    async def restore_items(self, items):
        return True
    
    async def mark_item_damaged(self, item_id, damage_notes):
        return True

class MockPaymentService:
    async def process_refund(self, amount, customer_id):
        return {"transaction_id": "txn-001", "status": "success"}
    
    async def charge_customer(self, amount, customer_id):
        return {"transaction_id": "txn-002", "status": "success"}

class RentalReturnService:
    """Simulated rental return service for testing."""
    
    def __init__(self, rental_repo, inventory_service, payment_service):
        self.rental_repo = rental_repo
        self.inventory_service = inventory_service
        self.payment_service = payment_service
    
    async def process_return(self, rental_id: str, return_data: dict):
        """Process a rental return."""
        # Get rental
        rental = await self.rental_repo.get_by_id(rental_id)
        if not rental:
            raise ValueError(f"Rental {rental_id} not found")
        
        # Calculate charges
        calculations = self.calculate_return_charges(rental, return_data)
        
        # Update inventory
        await self.restore_inventory(return_data["items"])
        
        # Process payment
        if calculations["refund_amount"] > 0:
            await self.payment_service.process_refund(
                calculations["refund_amount"],
                rental["customer_id"]
            )
        elif calculations["customer_owes"] > 0:
            await self.payment_service.charge_customer(
                calculations["customer_owes"],
                rental["customer_id"]
            )
        
        # Update rental status
        rental["status"] = self.determine_final_status(return_data)
        rental["return_date"] = return_data["return_date"]
        rental["return_calculations"] = calculations
        
        # Save return record
        return_record = await self.rental_repo.create_return_record({
            "rental_id": rental_id,
            **return_data,
            "calculations": calculations
        })
        
        return {
            "success": True,
            "rental": rental,
            "return_record": return_record,
            "calculations": calculations
        }
    
    def calculate_return_charges(self, rental: dict, return_data: dict) -> dict:
        """Calculate all charges and refunds for the return."""
        calculations = {
            "deposit_amount": rental["deposit_amount"],
            "rental_charges": rental["total_amount"],
            "late_fees": Decimal("0.00"),
            "damage_charges": Decimal("0.00"),
            "refund_amount": Decimal("0.00"),
            "customer_owes": Decimal("0.00")
        }
        
        # Calculate late fees
        if rental["status"] == "LATE":
            days_late = rental.get("days_late", 0)
            late_fee_per_day = Decimal("10.00")
            calculations["late_fees"] = late_fee_per_day * days_late * len(rental["items"])
        
        # Calculate damage charges
        for item in return_data.get("items", []):
            if item.get("condition") == "DAMAGED":
                if item.get("damage_severity") == "MINOR":
                    calculations["damage_charges"] += Decimal("50.00")
                elif item.get("damage_severity") == "MAJOR":
                    calculations["damage_charges"] += Decimal("250.00")
            elif item.get("condition") == "LOST":
                calculations["damage_charges"] += Decimal("500.00")
        
        # Calculate final amounts
        total_charges = (
            calculations["rental_charges"] + 
            calculations["late_fees"] + 
            calculations["damage_charges"]
        )
        
        if total_charges <= calculations["deposit_amount"]:
            calculations["refund_amount"] = calculations["deposit_amount"] - total_charges
        else:
            calculations["customer_owes"] = total_charges - calculations["deposit_amount"]
        
        return calculations
    
    def determine_final_status(self, return_data: dict) -> str:
        """Determine the final rental status based on return type."""
        if return_data["return_type"] == "COMPLETE":
            return "COMPLETED"
        elif return_data["return_type"] == "PARTIAL":
            return "PARTIAL_RETURN"
        else:
            return "COMPLETED"
    
    async def restore_inventory(self, items: list):
        """Restore inventory for returned items."""
        for item in items:
            if item.get("condition") in ["GOOD", "DAMAGED"]:
                await self.inventory_service.restore_items([item])
            if item.get("condition") == "DAMAGED":
                await self.inventory_service.mark_item_damaged(
                    item["item_id"],
                    item.get("condition_notes", "")
                )


class TestRentalReturns:
    """Test suite for rental returns."""
    
    @pytest.fixture
    def rental_return_service(self):
        """Create rental return service with mocked dependencies."""
        return RentalReturnService(
            rental_repo=MockRentalRepository(),
            inventory_service=MockInventoryService(),
            payment_service=MockPaymentService()
        )
    
    @pytest.mark.asyncio
    async def test_complete_on_time_return(self, rental_return_service):
        """Test complete on-time return processing."""
        # Arrange
        rental_data = RentalTestData.create_rental_data("standard")
        return_request = RentalTestData.create_return_request("complete")
        
        # Act
        result = await rental_return_service.process_return("rental-001", return_request)
        
        # Assert
        assert result["success"] is True
        assert result["rental"]["status"] == "COMPLETED"
        assert result["calculations"]["late_fees"] == Decimal("0.00")
        assert result["calculations"]["damage_charges"] == Decimal("0.00")
        assert result["calculations"]["refund_amount"] == rental_data["deposit_amount"]
        print("✅ Complete on-time return test passed")
    
    @pytest.mark.asyncio
    async def test_late_return_with_fees(self, rental_return_service):
        """Test late return with fee calculation."""
        # Arrange
        rental_return_service.rental_repo.get_by_id = AsyncMock(
            return_value=RentalTestData.create_rental_data("late")
        )
        return_request = RentalTestData.create_return_request("complete")
        
        # Act
        result = await rental_return_service.process_return("rental-002", return_request)
        
        # Assert
        assert result["success"] is True
        assert result["calculations"]["late_fees"] > Decimal("0.00")
        assert result["calculations"]["late_fees"] == Decimal("30.00")  # 3 days * $10 * 1 item
        print("✅ Late return fee calculation test passed")
    
    @pytest.mark.asyncio
    async def test_partial_return(self, rental_return_service):
        """Test partial return functionality."""
        # Arrange
        rental_return_service.rental_repo.get_by_id = AsyncMock(
            return_value=RentalTestData.create_rental_data("partial")
        )
        return_request = RentalTestData.create_return_request("partial")
        
        # Act
        result = await rental_return_service.process_return("rental-003", return_request)
        
        # Assert
        assert result["success"] is True
        assert result["rental"]["status"] == "PARTIAL_RETURN"
        print("✅ Partial return test passed")
    
    @pytest.mark.asyncio
    async def test_damaged_item_return(self, rental_return_service):
        """Test return with damaged items."""
        # Arrange
        rental_return_service.rental_repo.get_by_id = AsyncMock(
            return_value=RentalTestData.create_rental_data("damaged")
        )
        return_request = RentalTestData.create_return_request("damaged")
        
        # Act
        result = await rental_return_service.process_return("rental-004", return_request)
        
        # Assert
        assert result["success"] is True
        assert result["calculations"]["damage_charges"] == Decimal("250.00")
        assert result["calculations"]["refund_amount"] == Decimal("250.00")  # 500 deposit - 250 damage
        print("✅ Damaged item return test passed")
    
    @pytest.mark.asyncio
    async def test_mixed_condition_return(self, rental_return_service):
        """Test return with multiple items in different conditions."""
        # Arrange
        rental_data = RentalTestData.create_rental_data("standard")
        return_request = RentalTestData.create_return_request("mixed")
        
        # Act
        result = await rental_return_service.process_return("rental-005", return_request)
        
        # Assert
        assert result["success"] is True
        assert result["calculations"]["damage_charges"] == Decimal("550.00")  # 50 + 500
        # Deposit 500 < Total charges (350 rental + 550 damage)
        assert result["calculations"]["refund_amount"] == Decimal("0.00")
        assert result["calculations"]["customer_owes"] == Decimal("400.00")  # 900 total - 500 deposit
        print("✅ Mixed condition return test passed")
    
    @pytest.mark.asyncio
    async def test_return_calculations_accuracy(self, rental_return_service):
        """Test accuracy of return calculations."""
        test_cases = [
            {
                "name": "No charges",
                "rental": {"deposit_amount": Decimal("500"), "total_amount": Decimal("300"), "status": "IN_PROGRESS", "items": [{}]},
                "return": {"return_type": "COMPLETE", "items": [{"condition": "GOOD"}]},
                "expected": {"refund_amount": Decimal("200"), "customer_owes": Decimal("0")}
            },
            {
                "name": "With late fees",
                "rental": {"deposit_amount": Decimal("500"), "total_amount": Decimal("300"), "status": "LATE", "days_late": 2, "items": [{}]},
                "return": {"return_type": "COMPLETE", "items": [{"condition": "GOOD"}]},
                "expected": {"refund_amount": Decimal("180"), "customer_owes": Decimal("0")}  # 500 - 300 - 20
            },
            {
                "name": "Exceeds deposit",
                "rental": {"deposit_amount": Decimal("200"), "total_amount": Decimal("300"), "status": "IN_PROGRESS", "items": [{}]},
                "return": {"return_type": "COMPLETE", "items": [{"condition": "DAMAGED", "damage_severity": "MAJOR"}]},
                "expected": {"refund_amount": Decimal("0"), "customer_owes": Decimal("350")}  # 300 + 250 - 200
            }
        ]
        
        for test_case in test_cases:
            calculations = rental_return_service.calculate_return_charges(
                test_case["rental"],
                test_case["return"]
            )
            assert calculations["refund_amount"] == test_case["expected"]["refund_amount"], f"Failed: {test_case['name']}"
            assert calculations["customer_owes"] == test_case["expected"]["customer_owes"], f"Failed: {test_case['name']}"
            print(f"✅ Calculation test passed: {test_case['name']}")
    
    def test_status_determination(self, rental_return_service):
        """Test rental status determination logic."""
        test_cases = [
            ("COMPLETE", "COMPLETED"),
            ("PARTIAL", "PARTIAL_RETURN"),
            ("DAMAGE_ONLY", "COMPLETED"),
        ]
        
        for return_type, expected_status in test_cases:
            status = rental_return_service.determine_final_status({"return_type": return_type})
            assert status == expected_status
            print(f"✅ Status determination test passed: {return_type} -> {expected_status}")


# Run the tests
if __name__ == "__main__":
    print("\n" + "="*60)
    print("🧪 RUNNING RENTAL RETURN UNIT TESTS")
    print("="*60 + "\n")
    
    # Run tests using pytest
    pytest.main([__file__, "-v", "-s"])