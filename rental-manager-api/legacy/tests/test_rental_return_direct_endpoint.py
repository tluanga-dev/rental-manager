"""
Comprehensive tests for the new direct rental return endpoint.
Tests that the /return-direct endpoint returns responses in the exact format
specified in the documentation without the standard API wrapper.
"""

import pytest
from httpx import AsyncClient
from datetime import date, datetime
from typing import Dict, Any
import json
from decimal import Decimal


class TestRentalReturnDirectEndpoint:
    """Test suite for the direct rental return endpoint"""
    
    @pytest.fixture
    async def test_rental_data(self) -> Dict[str, Any]:
        """Create test data for rental return"""
        return {
            "rental_id": "test-rental-123",
            "line_id": "test-line-456",
            "item_id": "5f20f570-cb6c-43b9-8ef2-4148d9834fd4",
            "customer_id": "50850097-48ed-4543-a598-6f04d51732f0",
            "location_id": "2c43ac33-3628-4c93-a976-cef69711fa36"
        }
    
    @pytest.fixture
    async def create_test_rental(self, client: AsyncClient, test_rental_data: Dict) -> Dict[str, Any]:
        """Create a rental for testing returns"""
        rental_payload = {
            "transaction_date": date.today().isoformat(),
            "customer_id": test_rental_data["customer_id"],
            "location_id": test_rental_data["location_id"],
            "payment_method": "CASH",
            "payment_reference": f"TEST-DIRECT-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "notes": "Test rental for direct return endpoint",
            "items": [
                {
                    "item_id": test_rental_data["item_id"],
                    "quantity": 2,
                    "unit_rate": 65.0,
                    "rental_period_value": 7,
                    "rental_period_type": "DAILY",
                    "rental_start_date": date.today().isoformat(),
                    "rental_end_date": date.today().isoformat(),
                    "discount_value": 0,
                    "notes": "Test item"
                }
            ]
        }
        
        response = await client.post(
            "/api/transactions/rentals/new",
            json=rental_payload,
            headers={"Origin": "http://localhost:3000"}
        )
        assert response.status_code in [200, 201]
        data = response.json()
        
        # Get rental details to extract line ID
        rental_id = data.get("transaction_id") or data.get("data", {}).get("id")
        details_response = await client.get(
            f"/api/transactions/rentals/{rental_id}",
            headers={"Origin": "http://localhost:3000"}
        )
        details = details_response.json()
        
        return {
            "rental_id": rental_id,
            "transaction_number": data.get("transaction_number") or data.get("data", {}).get("transaction_number"),
            "line_id": details.get("data", {}).get("items", [{}])[0].get("id")
        }
    
    @pytest.mark.asyncio
    async def test_direct_endpoint_returns_unwrapped_response(self, client: AsyncClient, create_test_rental: Dict):
        """Test that the direct endpoint returns response without wrapper"""
        rental_data = create_test_rental
        
        return_payload = {
            "rental_id": rental_data["rental_id"],
            "return_date": date.today().isoformat(),
            "items": [
                {
                    "line_id": rental_data["line_id"],
                    "item_id": "5f20f570-cb6c-43b9-8ef2-4148d9834fd4",
                    "return_quantity": 2,
                    "return_date": date.today().isoformat(),
                    "return_action": "COMPLETE_RETURN",
                    "condition_notes": "Excellent condition",
                    "damage_notes": None,
                    "damage_penalty": 0
                }
            ],
            "notes": "Direct endpoint test",
            "processed_by": "test_user"
        }
        
        response = await client.post(
            f"/api/transactions/rentals/{rental_data['rental_id']}/return-direct",
            json=return_payload,
            headers={"Origin": "http://localhost:3000"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check that response is NOT wrapped
        assert "data" not in data, "Response should not have 'data' wrapper"
        
        # Check all required fields are at root level
        required_fields = [
            "success", "message", "rental_id", "transaction_number",
            "return_date", "items_returned", "rental_status", 
            "financial_impact", "timestamp"
        ]
        
        for field in required_fields:
            assert field in data, f"Field '{field}' should be at root level"
        
        # Verify field values
        assert data["success"] is True
        assert data["rental_id"] == rental_data["rental_id"]
        assert data["transaction_number"] == rental_data["transaction_number"]
        assert isinstance(data["items_returned"], list)
        assert len(data["items_returned"]) > 0
        assert isinstance(data["financial_impact"], dict)
    
    @pytest.mark.asyncio
    async def test_direct_endpoint_custom_header(self, client: AsyncClient, create_test_rental: Dict):
        """Test that the direct endpoint includes custom header"""
        rental_data = create_test_rental
        
        return_payload = {
            "rental_id": rental_data["rental_id"],
            "return_date": date.today().isoformat(),
            "items": [
                {
                    "line_id": rental_data["line_id"],
                    "item_id": "5f20f570-cb6c-43b9-8ef2-4148d9834fd4",
                    "return_quantity": 1,
                    "return_date": date.today().isoformat(),
                    "return_action": "COMPLETE_RETURN",
                    "condition_notes": "Good condition"
                }
            ],
            "notes": "Header test",
            "processed_by": "test_user"
        }
        
        response = await client.post(
            f"/api/transactions/rentals/{rental_data['rental_id']}/return-direct",
            json=return_payload,
            headers={"Origin": "http://localhost:3000"}
        )
        
        assert response.status_code == 200
        assert response.headers.get("X-Direct-Response") == "true"
        assert response.headers.get("Content-Type") == "application/json"
    
    @pytest.mark.asyncio
    async def test_direct_endpoint_item_return_structure(self, client: AsyncClient, create_test_rental: Dict):
        """Test the structure of items_returned in direct response"""
        rental_data = create_test_rental
        
        return_payload = {
            "rental_id": rental_data["rental_id"],
            "return_date": date.today().isoformat(),
            "items": [
                {
                    "line_id": rental_data["line_id"],
                    "item_id": "5f20f570-cb6c-43b9-8ef2-4148d9834fd4",
                    "return_quantity": 2,
                    "return_date": date.today().isoformat(),
                    "return_action": "COMPLETE_RETURN",
                    "condition_notes": "Items in perfect condition",
                    "damage_notes": None,
                    "damage_penalty": 0
                }
            ],
            "notes": "Structure test",
            "processed_by": "test_user"
        }
        
        response = await client.post(
            f"/api/transactions/rentals/{rental_data['rental_id']}/return-direct",
            json=return_payload,
            headers={"Origin": "http://localhost:3000"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check items_returned structure
        assert "items_returned" in data
        assert isinstance(data["items_returned"], list)
        assert len(data["items_returned"]) == 1
        
        item = data["items_returned"][0]
        expected_item_fields = [
            "line_id", "item_name", "sku", "original_quantity",
            "returned_quantity", "remaining_quantity", "return_date",
            "new_status", "condition_notes"
        ]
        
        for field in expected_item_fields:
            assert field in item, f"Item field '{field}' missing"
    
    @pytest.mark.asyncio
    async def test_direct_endpoint_financial_impact_structure(self, client: AsyncClient, create_test_rental: Dict):
        """Test the financial_impact structure in direct response"""
        rental_data = create_test_rental
        
        return_payload = {
            "rental_id": rental_data["rental_id"],
            "return_date": date.today().isoformat(),
            "items": [
                {
                    "line_id": rental_data["line_id"],
                    "item_id": "5f20f570-cb6c-43b9-8ef2-4148d9834fd4",
                    "return_quantity": 2,
                    "return_date": date.today().isoformat(),
                    "return_action": "COMPLETE_RETURN",
                    "condition_notes": "Good condition"
                }
            ],
            "notes": "Financial test",
            "processed_by": "test_user"
        }
        
        response = await client.post(
            f"/api/transactions/rentals/{rental_data['rental_id']}/return-direct",
            json=return_payload,
            headers={"Origin": "http://localhost:3000"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check financial_impact structure
        assert "financial_impact" in data
        financial = data["financial_impact"]
        
        expected_financial_fields = [
            "deposit_amount", "late_fees", "days_late",
            "total_refund", "charges_applied"
        ]
        
        for field in expected_financial_fields:
            assert field in financial, f"Financial field '{field}' missing"
        
        # Verify types
        assert isinstance(financial["deposit_amount"], (int, float))
        assert isinstance(financial["late_fees"], (int, float))
        assert isinstance(financial["days_late"], int)
        assert isinstance(financial["total_refund"], (int, float))
        assert isinstance(financial["charges_applied"], bool)
    
    @pytest.mark.asyncio
    async def test_direct_endpoint_error_handling(self, client: AsyncClient):
        """Test error handling for direct endpoint"""
        # Test with invalid rental ID
        return_payload = {
            "rental_id": "invalid-id",
            "return_date": date.today().isoformat(),
            "items": [
                {
                    "line_id": "invalid-line",
                    "item_id": "invalid-item",
                    "return_quantity": 1,
                    "return_date": date.today().isoformat(),
                    "return_action": "COMPLETE_RETURN"
                }
            ],
            "notes": "Error test",
            "processed_by": "test_user"
        }
        
        response = await client.post(
            "/api/transactions/rentals/invalid-id/return-direct",
            json=return_payload,
            headers={"Origin": "http://localhost:3000"}
        )
        
        # Should return error
        assert response.status_code in [400, 404, 500]
        
        # Error response should not be wrapped
        error_data = response.json()
        if "detail" in error_data:
            # FastAPI error format
            assert isinstance(error_data["detail"], str)
    
    @pytest.mark.asyncio
    async def test_direct_endpoint_partial_return(self, client: AsyncClient, create_test_rental: Dict):
        """Test partial return with direct endpoint"""
        rental_data = create_test_rental
        
        return_payload = {
            "rental_id": rental_data["rental_id"],
            "return_date": date.today().isoformat(),
            "items": [
                {
                    "line_id": rental_data["line_id"],
                    "item_id": "5f20f570-cb6c-43b9-8ef2-4148d9834fd4",
                    "return_quantity": 1,  # Partial return (rented 2, returning 1)
                    "return_date": date.today().isoformat(),
                    "return_action": "PARTIAL_RETURN",
                    "condition_notes": "One item returned"
                }
            ],
            "notes": "Partial return test",
            "processed_by": "test_user"
        }
        
        response = await client.post(
            f"/api/transactions/rentals/{rental_data['rental_id']}/return-direct",
            json=return_payload,
            headers={"Origin": "http://localhost:3000"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert data["success"] is True
        assert data["rental_status"] in ["RENTAL_PARTIAL_RETURN", "RENTAL_INPROGRESS"]
        
        # Check remaining quantity
        item = data["items_returned"][0]
        assert float(item["returned_quantity"]) == 1.0
        assert float(item["remaining_quantity"]) == 1.0
    
    @pytest.mark.asyncio
    async def test_direct_endpoint_datetime_formatting(self, client: AsyncClient, create_test_rental: Dict):
        """Test that datetime fields are properly formatted"""
        rental_data = create_test_rental
        
        return_payload = {
            "rental_id": rental_data["rental_id"],
            "return_date": date.today().isoformat(),
            "items": [
                {
                    "line_id": rental_data["line_id"],
                    "item_id": "5f20f570-cb6c-43b9-8ef2-4148d9834fd4",
                    "return_quantity": 2,
                    "return_date": date.today().isoformat(),
                    "return_action": "COMPLETE_RETURN",
                    "condition_notes": "Datetime test"
                }
            ],
            "notes": "Datetime formatting test",
            "processed_by": "test_user"
        }
        
        response = await client.post(
            f"/api/transactions/rentals/{rental_data['rental_id']}/return-direct",
            json=return_payload,
            headers={"Origin": "http://localhost:3000"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check datetime formatting
        assert "timestamp" in data
        assert "T" in data["timestamp"]  # ISO format with time
        
        assert "return_date" in data
        # return_date should be date string
        
        # Check item return dates
        for item in data["items_returned"]:
            assert "return_date" in item
    
    @pytest.mark.asyncio
    async def test_direct_endpoint_idempotency(self, client: AsyncClient, create_test_rental: Dict):
        """Test that multiple returns fail appropriately"""
        rental_data = create_test_rental
        
        return_payload = {
            "rental_id": rental_data["rental_id"],
            "return_date": date.today().isoformat(),
            "items": [
                {
                    "line_id": rental_data["line_id"],
                    "item_id": "5f20f570-cb6c-43b9-8ef2-4148d9834fd4",
                    "return_quantity": 2,
                    "return_date": date.today().isoformat(),
                    "return_action": "COMPLETE_RETURN",
                    "condition_notes": "First return"
                }
            ],
            "notes": "Idempotency test",
            "processed_by": "test_user"
        }
        
        # First return should succeed
        response1 = await client.post(
            f"/api/transactions/rentals/{rental_data['rental_id']}/return-direct",
            json=return_payload,
            headers={"Origin": "http://localhost:3000"}
        )
        assert response1.status_code == 200
        
        # Second return should fail
        response2 = await client.post(
            f"/api/transactions/rentals/{rental_data['rental_id']}/return-direct",
            json=return_payload,
            headers={"Origin": "http://localhost:3000"}
        )
        assert response2.status_code in [400, 409]  # Bad request or conflict