"""
Tests for Sale Transition API Endpoints

Tests all API endpoints for sale transition management.
"""

import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.sales.models import (
    SaleTransitionRequest,
    SaleConflict,
    TransitionStatus,
    ConflictType,
    ConflictSeverity
)
from app.modules.master_data.item_master.models import Item
from app.modules.users.models import User, Role
from app.modules.customers.models import Customer
from app.modules.transactions.base.models import TransactionHeader, TransactionLine, TransactionType
from app.modules.transactions.base.models.transaction_headers import RentalStatus


@pytest.fixture
async def test_item(session: AsyncSession):
    """Create a test item"""
    item = Item(
        id=uuid4(),
        item_name="Test Equipment",
        item_code="EQ-001",
        category_id=uuid4(),
        brand_id=uuid4(),
        is_rentable=True,
        is_saleable=False,
        rental_rate=Decimal("150.00"),
        sale_price=Decimal("3000.00")
    )
    session.add(item)
    await session.commit()
    return item


@pytest.fixture
async def auth_headers(async_client: AsyncClient, test_user: User):
    """Get authentication headers"""
    # Login to get token
    response = await async_client.post(
        "/api/auth/login",
        json={
            "username": test_user.username,
            "password": "TestPassword123!"
        }
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def manager_auth_headers(async_client: AsyncClient, manager_user: User):
    """Get manager authentication headers"""
    response = await async_client.post(
        "/api/auth/login",
        json={
            "username": manager_user.username,
            "password": "ManagerPassword123!"
        }
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
class TestSaleEligibilityEndpoint:
    """Test sale eligibility checking endpoint"""
    
    async def test_check_eligibility_for_available_item(
        self,
        async_client: AsyncClient,
        test_item: Item,
        auth_headers: dict
    ):
        """Test checking eligibility for an available item"""
        response = await async_client.get(
            f"/api/sales/items/{test_item.id}/sale-eligibility",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["eligible"] is True
        assert data["item_id"] == str(test_item.id)
        assert data["item_name"] == test_item.item_name
        assert data["conflicts"] is None
        assert data["requires_approval"] is False
    
    async def test_check_eligibility_with_active_rental(
        self,
        async_client: AsyncClient,
        test_item: Item,
        auth_headers: dict,
        session: AsyncSession
    ):
        """Test eligibility when item has active rental"""
        # Create active rental
        customer = Customer(
            id=uuid4(),
            name="Rental Customer",
            email="rental@example.com"
        )
        
        transaction = TransactionHeader(
            id=uuid4(),
            transaction_number="RENT-100",
            transaction_type=TransactionType.RENTAL,
            customer_id=customer.id,
            transaction_date=datetime.utcnow(),
            total_amount=Decimal("450.00")
        )
        
        rental_line = TransactionLine(
            id=uuid4(),
            transaction_id=transaction.id,
            item_id=test_item.id,
            quantity=1,
            unit_price=Decimal("150.00"),
            line_total=Decimal("450.00"),
            rental_status=RentalStatus.RENTAL_INPROGRESS,
            rental_start_date=datetime.utcnow(),
            rental_end_date=datetime.utcnow() + timedelta(days=3)
        )
        
        session.add_all([customer, transaction, rental_line])
        await session.commit()
        
        # Check eligibility
        response = await async_client.get(
            f"/api/sales/items/{test_item.id}/sale-eligibility",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["eligible"] is True  # Still eligible but has conflicts
        assert data["conflicts"] is not None
        assert data["conflicts"]["total_conflicts"] > 0
        assert data["revenue_impact"] is not None
    
    async def test_check_eligibility_already_for_sale(
        self,
        async_client: AsyncClient,
        test_item: Item,
        auth_headers: dict,
        session: AsyncSession
    ):
        """Test eligibility for item already marked for sale"""
        # Mark item as already for sale
        test_item.is_saleable = True
        await session.commit()
        
        response = await async_client.get(
            f"/api/sales/items/{test_item.id}/sale-eligibility",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["eligible"] is False
        assert "already" in data["recommendation"].lower()
    
    async def test_check_eligibility_nonexistent_item(
        self,
        async_client: AsyncClient,
        auth_headers: dict
    ):
        """Test eligibility check for non-existent item"""
        fake_id = uuid4()
        response = await async_client.get(
            f"/api/sales/items/{fake_id}/sale-eligibility",
            headers=auth_headers
        )
        
        assert response.status_code == 404


@pytest.mark.asyncio
class TestInitiateSaleTransition:
    """Test sale transition initiation endpoint"""
    
    async def test_initiate_transition_success(
        self,
        async_client: AsyncClient,
        test_item: Item,
        auth_headers: dict
    ):
        """Test successful transition initiation"""
        response = await async_client.post(
            f"/api/sales/items/{test_item.id}/initiate-sale",
            headers=auth_headers,
            json={
                "sale_price": 3500.00,
                "effective_date": (datetime.utcnow() + timedelta(days=1)).date().isoformat(),
                "resolution_strategy": "WAIT_FOR_RETURN"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "transition_id" in data
        assert data["status"] in ["PENDING", "COMPLETED", "AWAITING_APPROVAL"]
        assert data["message"] is not None
    
    async def test_initiate_transition_with_conflicts(
        self,
        async_client: AsyncClient,
        test_item: Item,
        auth_headers: dict,
        session: AsyncSession
    ):
        """Test transition initiation with conflicts"""
        # Create rental conflict
        customer = Customer(
            id=uuid4(),
            name="Test Customer",
            email="test@example.com"
        )
        
        transaction = TransactionHeader(
            id=uuid4(),
            transaction_number="RENT-200",
            transaction_type=TransactionType.RENTAL,
            customer_id=customer.id,
            transaction_date=datetime.utcnow(),
            total_amount=Decimal("300.00")
        )
        
        rental_line = TransactionLine(
            id=uuid4(),
            transaction_id=transaction.id,
            item_id=test_item.id,
            quantity=1,
            unit_price=Decimal("150.00"),
            line_total=Decimal("300.00"),
            rental_status=RentalStatus.RENTAL_INPROGRESS,
            rental_start_date=datetime.utcnow(),
            rental_end_date=datetime.utcnow() + timedelta(days=2)
        )
        
        session.add_all([customer, transaction, rental_line])
        await session.commit()
        
        # Initiate transition
        response = await async_client.post(
            f"/api/sales/items/{test_item.id}/initiate-sale",
            headers=auth_headers,
            json={
                "sale_price": 3000.00,
                "effective_date": None,
                "resolution_strategy": "WAIT_FOR_RETURN"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "PENDING"  # Needs confirmation due to conflicts
        assert data["conflicts_found"] > 0
        assert data["affected_customers"] > 0
        assert "review" in data["message"].lower()
    
    async def test_initiate_transition_invalid_price(
        self,
        async_client: AsyncClient,
        test_item: Item,
        auth_headers: dict
    ):
        """Test transition initiation with invalid price"""
        response = await async_client.post(
            f"/api/sales/items/{test_item.id}/initiate-sale",
            headers=auth_headers,
            json={
                "sale_price": -100.00,  # Invalid negative price
                "effective_date": None
            }
        )
        
        assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
class TestConfirmTransition:
    """Test transition confirmation endpoint"""
    
    async def test_confirm_transition_success(
        self,
        async_client: AsyncClient,
        test_item: Item,
        auth_headers: dict,
        session: AsyncSession
    ):
        """Test successful transition confirmation"""
        # Create pending transition
        transition = SaleTransitionRequest(
            id=uuid4(),
            item_id=test_item.id,
            requested_by=uuid4(),
            sale_price=Decimal("3000.00"),
            request_status=TransitionStatus.PENDING
        )
        session.add(transition)
        await session.commit()
        
        # Confirm transition
        response = await async_client.post(
            f"/api/sales/transitions/{transition.id}/confirm",
            headers=auth_headers,
            json={
                "confirmed": True,
                "resolution_overrides": {}
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert data["transition_id"] == str(transition.id)
        assert data["status"] == "COMPLETED"
    
    async def test_reject_transition(
        self,
        async_client: AsyncClient,
        test_item: Item,
        auth_headers: dict,
        session: AsyncSession
    ):
        """Test rejecting a transition"""
        # Create pending transition
        transition = SaleTransitionRequest(
            id=uuid4(),
            item_id=test_item.id,
            requested_by=uuid4(),
            sale_price=Decimal("3000.00"),
            request_status=TransitionStatus.PENDING
        )
        session.add(transition)
        await session.commit()
        
        # Reject transition
        response = await async_client.post(
            f"/api/sales/transitions/{transition.id}/confirm",
            headers=auth_headers,
            json={
                "confirmed": False
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is False
        assert data["status"] == "REJECTED"
        assert "cancelled" in data["message"].lower()


@pytest.mark.asyncio
class TestTransitionStatus:
    """Test transition status endpoint"""
    
    async def test_get_transition_status(
        self,
        async_client: AsyncClient,
        test_item: Item,
        auth_headers: dict,
        session: AsyncSession
    ):
        """Test getting transition status"""
        # Create transition with conflicts
        transition = SaleTransitionRequest(
            id=uuid4(),
            item_id=test_item.id,
            requested_by=uuid4(),
            sale_price=Decimal("3000.00"),
            request_status=TransitionStatus.PROCESSING
        )
        
        conflict = SaleConflict(
            id=uuid4(),
            transition_request_id=transition.id,
            conflict_type=ConflictType.ACTIVE_RENTAL,
            entity_type="rental",
            entity_id=uuid4(),
            severity=ConflictSeverity.HIGH,
            description="Active rental conflict",
            resolved=False
        )
        
        session.add_all([transition, conflict])
        await session.commit()
        
        # Get status
        response = await async_client.get(
            f"/api/sales/transitions/{transition.id}/status",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["transition_id"] == str(transition.id)
        assert data["item_id"] == str(test_item.id)
        assert data["status"] == "PROCESSING"
        assert data["conflicts_pending"] == 1
        assert data["conflicts_resolved"] == 0
        assert data["progress_percentage"] == 0


@pytest.mark.asyncio
class TestManagerApproval:
    """Test manager approval endpoints"""
    
    async def test_approve_transition_as_manager(
        self,
        async_client: AsyncClient,
        test_item: Item,
        manager_auth_headers: dict,
        session: AsyncSession
    ):
        """Test manager approving a transition"""
        # Create transition awaiting approval
        transition = SaleTransitionRequest(
            id=uuid4(),
            item_id=test_item.id,
            requested_by=uuid4(),
            sale_price=Decimal("10000.00"),
            request_status=TransitionStatus.AWAITING_APPROVAL,
            approval_required=True
        )
        session.add(transition)
        await session.commit()
        
        # Approve as manager
        response = await async_client.post(
            f"/api/sales/transitions/{transition.id}/approve",
            headers=manager_auth_headers,
            params={"approval_notes": "Approved for sale"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert data["status"] in ["COMPLETED", "PROCESSING"]
    
    async def test_reject_transition_as_manager(
        self,
        async_client: AsyncClient,
        test_item: Item,
        manager_auth_headers: dict,
        session: AsyncSession
    ):
        """Test manager rejecting a transition"""
        # Create transition awaiting approval
        transition = SaleTransitionRequest(
            id=uuid4(),
            item_id=test_item.id,
            requested_by=uuid4(),
            sale_price=Decimal("10000.00"),
            request_status=TransitionStatus.AWAITING_APPROVAL,
            approval_required=True
        )
        session.add(transition)
        await session.commit()
        
        # Reject as manager
        response = await async_client.post(
            f"/api/sales/transitions/{transition.id}/reject",
            headers=manager_auth_headers,
            params={"rejection_reason": "Price too low for this item"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is False
        assert data["status"] == "REJECTED"
        assert "Price too low" in data["message"]
    
    async def test_approve_without_permission_fails(
        self,
        async_client: AsyncClient,
        test_item: Item,
        auth_headers: dict,  # Regular user headers
        session: AsyncSession
    ):
        """Test that regular users cannot approve transitions"""
        transition = SaleTransitionRequest(
            id=uuid4(),
            item_id=test_item.id,
            requested_by=uuid4(),
            sale_price=Decimal("10000.00"),
            request_status=TransitionStatus.AWAITING_APPROVAL,
            approval_required=True
        )
        session.add(transition)
        await session.commit()
        
        # Try to approve as regular user
        response = await async_client.post(
            f"/api/sales/transitions/{transition.id}/approve",
            headers=auth_headers,
            params={"approval_notes": "Trying to approve"}
        )
        
        assert response.status_code == 403  # Forbidden


@pytest.mark.asyncio
class TestTransitionMetrics:
    """Test metrics and dashboard endpoints"""
    
    async def test_get_transition_metrics(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        session: AsyncSession
    ):
        """Test getting transition metrics"""
        # Create some transitions for metrics
        transitions = [
            SaleTransitionRequest(
                id=uuid4(),
                item_id=uuid4(),
                requested_by=uuid4(),
                sale_price=Decimal("1000.00"),
                request_status=TransitionStatus.COMPLETED,
                completed_at=datetime.utcnow()
            ),
            SaleTransitionRequest(
                id=uuid4(),
                item_id=uuid4(),
                requested_by=uuid4(),
                sale_price=Decimal("2000.00"),
                request_status=TransitionStatus.AWAITING_APPROVAL,
                approval_required=True
            ),
            SaleTransitionRequest(
                id=uuid4(),
                item_id=uuid4(),
                requested_by=uuid4(),
                sale_price=Decimal("1500.00"),
                request_status=TransitionStatus.FAILED,
                revenue_impact=Decimal("500.00")
            )
        ]
        
        for t in transitions:
            session.add(t)
        await session.commit()
        
        # Get metrics
        response = await async_client.get(
            "/api/sales/metrics/dashboard",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "active_transitions" in data
        assert "pending_approvals" in data
        assert data["pending_approvals"] >= 1
        assert "successful_transitions_today" in data
        assert data["successful_transitions_today"] >= 1
        assert "failed_transitions_today" in data
        assert data["failed_transitions_today"] >= 1