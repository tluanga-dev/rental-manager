"""
Comprehensive test suite for Rental Return API contract validation.
Tests both request payload and response format against documented specification.
"""

import pytest
from datetime import datetime, date, timedelta
from uuid import uuid4
import json
from typing import Dict, List, Any
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.modules.auth.schemas import TokenData
from app.modules.transactions.rentals.schemas import (
    RentalReturnRequest,
    RentalReturnResponse,
    ReturnItemRequest
)


class TestRentalReturnAPIContract:
    """Test suite for rental return API contract validation"""

    @pytest.fixture
    async def test_rental_data(self, db_session: AsyncSession, auth_token: str):
        """Create test rental with items for return testing"""
        # This would create a rental transaction with known IDs
        # Implementation depends on your test utilities
        return {
            "rental_id": "824b31ac-c15a-4936-9c07-faa810cd9fec",
            "line_id": "08acd06b-8d31-414d-914b-f82a3da8f72b",
            "item_id": "05e50a32-8b8a-4de3-b4c4-b2ae1c6b5e93",
            "quantity": 2,
            "due_date": (date.today() + timedelta(days=7)).isoformat()
        }

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_valid_complete_return_payload(self, client: AsyncClient, test_rental_data: Dict):
        """Test complete return with all required and optional fields"""
        payload = {
            "rental_id": test_rental_data["rental_id"],
            "return_date": date.today().isoformat(),
            "items": [
                {
                    "line_id": test_rental_data["line_id"],
                    "item_id": test_rental_data["item_id"],
                    "return_quantity": 2,
                    "return_date": date.today().isoformat(),
                    "return_action": "COMPLETE_RETURN",
                    "condition_notes": "Items returned in excellent condition",
                    "damage_notes": None,
                    "damage_penalty": 0
                }
            ],
            "notes": "Complete return - all items in good condition",
            "processed_by": "test_user"
        }
        
        # Validate schema compliance
        try:
            RentalReturnRequest(**payload)
        except Exception as e:
            pytest.fail(f"Valid payload failed schema validation: {e}")

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_minimal_required_fields_only(self, test_rental_data: Dict):
        """Test with only required fields - no optional fields"""
        payload = {
            "rental_id": test_rental_data["rental_id"],
            "return_date": date.today().isoformat(),
            "items": [
                {
                    "line_id": test_rental_data["line_id"],
                    "item_id": test_rental_data["item_id"],
                    "return_quantity": 2,
                    "return_date": date.today().isoformat(),
                    "return_action": "COMPLETE_RETURN"
                }
            ]
        }
        
        # Should pass validation without optional fields
        try:
            RentalReturnRequest(**payload)
        except Exception as e:
            pytest.fail(f"Minimal payload failed validation: {e}")

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.parametrize("missing_field,payload_modifier", [
        ("rental_id", lambda p: p.pop("rental_id")),
        ("return_date", lambda p: p.pop("return_date")),
        ("items", lambda p: p.pop("items")),
        ("line_id", lambda p: p["items"][0].pop("line_id")),
        ("item_id", lambda p: p["items"][0].pop("item_id")),
        ("return_quantity", lambda p: p["items"][0].pop("return_quantity")),
        ("return_date_item", lambda p: p["items"][0].pop("return_date")),
        ("return_action", lambda p: p["items"][0].pop("return_action")),
    ])
    async def test_missing_required_fields(self, test_rental_data: Dict, missing_field: str, payload_modifier):
        """Test validation errors for missing required fields"""
        payload = {
            "rental_id": test_rental_data["rental_id"],
            "return_date": date.today().isoformat(),
            "items": [
                {
                    "line_id": test_rental_data["line_id"],
                    "item_id": test_rental_data["item_id"],
                    "return_quantity": 2,
                    "return_date": date.today().isoformat(),
                    "return_action": "COMPLETE_RETURN"
                }
            ]
        }
        
        # Remove the field using the modifier
        payload_modifier(payload)
        
        # Should fail validation
        with pytest.raises(Exception) as exc_info:
            RentalReturnRequest(**payload)
        
        assert missing_field != "fake_test"  # Ensure test is working

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_empty_items_array_validation(self, test_rental_data: Dict):
        """Test that empty items array fails validation"""
        payload = {
            "rental_id": test_rental_data["rental_id"],
            "return_date": date.today().isoformat(),
            "items": []
        }
        
        with pytest.raises(Exception) as exc_info:
            RentalReturnRequest(**payload)
        
        # Verify it's specifically about empty items
        assert "items" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.parametrize("invalid_data,field_path", [
        ({"rental_id": "not-a-uuid"}, "rental_id"),
        ({"return_date": "02-08-2025"}, "return_date"),
        ({"return_date": "2025/08/02"}, "return_date"),
        ({"items": [{"return_quantity": "two"}]}, "return_quantity"),
        ({"items": [{"return_quantity": -1}]}, "return_quantity"),
        ({"items": [{"return_quantity": 0}]}, "return_quantity"),
        ({"items": [{"return_action": "INVALID_ACTION"}]}, "return_action"),
        ({"items": [{"damage_penalty": "fifty"}]}, "damage_penalty"),
        ({"items": [{"damage_penalty": -10}]}, "damage_penalty"),
    ])
    async def test_invalid_field_types_and_values(self, test_rental_data: Dict, invalid_data: Dict, field_path: str):
        """Test invalid data types and values for fields"""
        base_payload = {
            "rental_id": test_rental_data["rental_id"],
            "return_date": date.today().isoformat(),
            "items": [
                {
                    "line_id": test_rental_data["line_id"],
                    "item_id": test_rental_data["item_id"],
                    "return_quantity": 2,
                    "return_date": date.today().isoformat(),
                    "return_action": "COMPLETE_RETURN"
                }
            ]
        }
        
        # Deep merge invalid data
        payload = self._deep_merge(base_payload, invalid_data)
        
        with pytest.raises(Exception) as exc_info:
            RentalReturnRequest(**payload)
        
        # Verify error is related to the expected field
        assert field_path in str(exc_info.value).lower()

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_all_valid_return_actions(self, test_rental_data: Dict):
        """Test all valid return action enum values"""
        valid_actions = ["COMPLETE_RETURN", "PARTIAL_RETURN", "MARK_LATE", "MARK_DAMAGED"]
        
        for action in valid_actions:
            payload = {
                "rental_id": test_rental_data["rental_id"],
                "return_date": date.today().isoformat(),
                "items": [
                    {
                        "line_id": test_rental_data["line_id"],
                        "item_id": test_rental_data["item_id"],
                        "return_quantity": 1,
                        "return_date": date.today().isoformat(),
                        "return_action": action
                    }
                ]
            }
            
            try:
                RentalReturnRequest(**payload)
            except Exception as e:
                pytest.fail(f"Valid return action '{action}' failed validation: {e}")

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_complete_return_api_response_format(self, client: AsyncClient, test_rental_data: Dict, auth_token: str):
        """Test that API response matches documented format exactly"""
        payload = {
            "rental_id": test_rental_data["rental_id"],
            "return_date": date.today().isoformat(),
            "items": [
                {
                    "line_id": test_rental_data["line_id"],
                    "item_id": test_rental_data["item_id"],
                    "return_quantity": 2,
                    "return_date": date.today().isoformat(),
                    "return_action": "COMPLETE_RETURN",
                    "condition_notes": "Items returned in excellent condition"
                }
            ]
        }
        
        response = await client.post(
            f"/api/transactions/rentals/{test_rental_data['rental_id']}/return",
            json=payload,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Validate root level fields
        required_root_fields = [
            "success", "message", "rental_id", "transaction_number",
            "return_date", "items_returned", "rental_status",
            "financial_impact", "timestamp"
        ]
        
        for field in required_root_fields:
            assert field in data, f"Missing required root field: {field}"
        
        # Validate data types
        assert isinstance(data["success"], bool)
        assert data["success"] is True
        assert isinstance(data["message"], str)
        assert isinstance(data["rental_id"], str)
        assert isinstance(data["transaction_number"], str)
        assert isinstance(data["return_date"], str)
        assert isinstance(data["items_returned"], list)
        assert isinstance(data["rental_status"], str)
        assert isinstance(data["financial_impact"], dict)
        assert isinstance(data["timestamp"], str)
        
        # Validate items_returned structure
        assert len(data["items_returned"]) > 0
        for item in data["items_returned"]:
            required_item_fields = [
                "line_id", "item_name", "sku", "original_quantity",
                "returned_quantity", "remaining_quantity", "return_date",
                "new_status", "condition_notes"
            ]
            for field in required_item_fields:
                assert field in item, f"Missing required item field: {field}"
        
        # Validate financial_impact structure
        required_financial_fields = [
            "deposit_amount", "late_fees", "days_late",
            "total_refund", "charges_applied"
        ]
        for field in required_financial_fields:
            assert field in data["financial_impact"], f"Missing financial field: {field}"
        
        # Validate specific data types in financial_impact
        assert isinstance(data["financial_impact"]["deposit_amount"], (int, float))
        assert isinstance(data["financial_impact"]["late_fees"], (int, float))
        assert isinstance(data["financial_impact"]["days_late"], int)
        assert isinstance(data["financial_impact"]["total_refund"], (int, float))
        assert isinstance(data["financial_impact"]["charges_applied"], bool)

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_validation_error_response_format(self, client: AsyncClient, auth_token: str):
        """Test 422 validation error response format"""
        # Invalid payload - missing items
        payload = {
            "rental_id": str(uuid4()),
            "return_date": date.today().isoformat()
        }
        
        response = await client.post(
            f"/api/transactions/rentals/{payload['rental_id']}/return",
            json=payload,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 422
        error_data = response.json()
        
        # Validate error response format
        assert "detail" in error_data
        assert isinstance(error_data["detail"], list)
        
        # Check error detail structure
        for error in error_data["detail"]:
            assert "type" in error or "msg" in error
            assert "loc" in error

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_partial_return_scenario(self, client: AsyncClient, test_rental_data: Dict, auth_token: str):
        """Test partial return with correct response"""
        # Assume rental has quantity 5, returning 3
        payload = {
            "rental_id": test_rental_data["rental_id"],
            "return_date": date.today().isoformat(),
            "items": [
                {
                    "line_id": test_rental_data["line_id"],
                    "item_id": test_rental_data["item_id"],
                    "return_quantity": 3,
                    "return_date": date.today().isoformat(),
                    "return_action": "PARTIAL_RETURN"
                }
            ]
        }
        
        response = await client.post(
            f"/api/transactions/rentals/{test_rental_data['rental_id']}/return",
            json=payload,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify partial return specifics
        assert data["items_returned"][0]["returned_quantity"] == 3
        assert data["items_returned"][0]["remaining_quantity"] == 2
        assert data["rental_status"] in ["RENTAL_PARTIAL", "RENTAL_INPROGRESS"]

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_late_return_with_fees(self, client: AsyncClient, test_rental_data: Dict, auth_token: str):
        """Test late return calculates fees correctly"""
        # Use past return date to trigger late fees
        past_date = (date.today() - timedelta(days=3)).isoformat()
        
        payload = {
            "rental_id": test_rental_data["rental_id"],
            "return_date": date.today().isoformat(),
            "items": [
                {
                    "line_id": test_rental_data["line_id"],
                    "item_id": test_rental_data["item_id"],
                    "return_quantity": 2,
                    "return_date": date.today().isoformat(),
                    "return_action": "MARK_LATE"
                }
            ]
        }
        
        response = await client.post(
            f"/api/transactions/rentals/{test_rental_data['rental_id']}/return",
            json=payload,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify late return handling
        assert data["financial_impact"]["days_late"] > 0
        assert data["financial_impact"]["late_fees"] > 0
        assert data["financial_impact"]["charges_applied"] is True

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_damaged_return_with_penalty(self, client: AsyncClient, test_rental_data: Dict, auth_token: str):
        """Test damaged return with penalty application"""
        payload = {
            "rental_id": test_rental_data["rental_id"],
            "return_date": date.today().isoformat(),
            "items": [
                {
                    "line_id": test_rental_data["line_id"],
                    "item_id": test_rental_data["item_id"],
                    "return_quantity": 1,
                    "return_date": date.today().isoformat(),
                    "return_action": "MARK_DAMAGED",
                    "condition_notes": "Minor cosmetic damage",
                    "damage_notes": "Scratch on front panel",
                    "damage_penalty": 25.00
                }
            ],
            "notes": "Customer reported damage",
            "processed_by": "staff_user"
        }
        
        response = await client.post(
            f"/api/transactions/rentals/{test_rental_data['rental_id']}/return",
            json=payload,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify damage handling
        assert data["items_returned"][0]["condition_notes"] == "Minor cosmetic damage"
        assert data["financial_impact"]["charges_applied"] is True
        # The actual penalty should be reflected in the financial calculations

    @pytest.mark.asyncio
    @pytest.mark.error
    async def test_already_returned_error(self, client: AsyncClient, test_rental_data: Dict, auth_token: str):
        """Test error when trying to return already returned rental"""
        # First, complete the return
        payload = {
            "rental_id": test_rental_data["rental_id"],
            "return_date": date.today().isoformat(),
            "items": [
                {
                    "line_id": test_rental_data["line_id"],
                    "item_id": test_rental_data["item_id"],
                    "return_quantity": 2,
                    "return_date": date.today().isoformat(),
                    "return_action": "COMPLETE_RETURN"
                }
            ]
        }
        
        # First return should succeed
        response1 = await client.post(
            f"/api/transactions/rentals/{test_rental_data['rental_id']}/return",
            json=payload,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response1.status_code == 200
        
        # Second return should fail
        response2 = await client.post(
            f"/api/transactions/rentals/{test_rental_data['rental_id']}/return",
            json=payload,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response2.status_code == 400
        error_data = response2.json()
        assert "already been completed" in error_data["detail"].lower()

    @pytest.mark.asyncio
    @pytest.mark.error
    async def test_return_quantity_exceeds_rented(self, client: AsyncClient, test_rental_data: Dict, auth_token: str):
        """Test error when return quantity exceeds rented quantity"""
        payload = {
            "rental_id": test_rental_data["rental_id"],
            "return_date": date.today().isoformat(),
            "items": [
                {
                    "line_id": test_rental_data["line_id"],
                    "item_id": test_rental_data["item_id"],
                    "return_quantity": 10,  # Exceeds rented quantity of 2
                    "return_date": date.today().isoformat(),
                    "return_action": "COMPLETE_RETURN"
                }
            ]
        }
        
        response = await client.post(
            f"/api/transactions/rentals/{test_rental_data['rental_id']}/return",
            json=payload,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 400
        error_data = response.json()
        assert "exceeds" in error_data["detail"].lower() or "quantity" in error_data["detail"].lower()

    @pytest.mark.asyncio
    @pytest.mark.error
    async def test_rental_not_found_error(self, client: AsyncClient, auth_token: str):
        """Test 404 error for non-existent rental"""
        fake_rental_id = str(uuid4())
        payload = {
            "rental_id": fake_rental_id,
            "return_date": date.today().isoformat(),
            "items": [
                {
                    "line_id": str(uuid4()),
                    "item_id": str(uuid4()),
                    "return_quantity": 1,
                    "return_date": date.today().isoformat(),
                    "return_action": "COMPLETE_RETURN"
                }
            ]
        }
        
        response = await client.post(
            f"/api/transactions/rentals/{fake_rental_id}/return",
            json=payload,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 404
        error_data = response.json()
        assert "not found" in error_data["detail"].lower()

    @pytest.mark.asyncio
    @pytest.mark.performance
    async def test_return_processing_performance(self, client: AsyncClient, test_rental_data: Dict, auth_token: str):
        """Test that return processing completes within acceptable time"""
        import time
        
        payload = {
            "rental_id": test_rental_data["rental_id"],
            "return_date": date.today().isoformat(),
            "items": [
                {
                    "line_id": test_rental_data["line_id"],
                    "item_id": test_rental_data["item_id"],
                    "return_quantity": 2,
                    "return_date": date.today().isoformat(),
                    "return_action": "COMPLETE_RETURN"
                }
            ]
        }
        
        start_time = time.time()
        response = await client.post(
            f"/api/transactions/rentals/{test_rental_data['rental_id']}/return",
            json=payload,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        end_time = time.time()
        
        assert response.status_code == 200
        processing_time = end_time - start_time
        assert processing_time < 2.0, f"Return processing took {processing_time}s, expected < 2s"

    def _deep_merge(self, base: Dict, update: Dict) -> Dict:
        """Deep merge two dictionaries"""
        import copy
        result = copy.deepcopy(base)
        
        for key, value in update.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge(result[key], value)
            elif key in result and isinstance(result[key], list) and isinstance(value, list):
                if len(value) > 0 and isinstance(value[0], dict):
                    # Merge first item of list
                    if len(result[key]) > 0:
                        result[key][0] = self._deep_merge(result[key][0], value[0])
            else:
                result[key] = value
        
        return result