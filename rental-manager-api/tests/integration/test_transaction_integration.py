"""
Integration tests for transaction module with Docker.
Tests end-to-end workflows including database operations and service interactions.
"""

import pytest
import asyncio
from decimal import Decimal
from datetime import datetime, timedelta
from uuid import UUID, uuid4
from typing import AsyncGenerator

import asyncpg
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.config import settings
from app.core.database import Base
from app.main import app
from app.models.transaction import (
    TransactionHeader,
    TransactionLine,
    RentalLifecycle,
    TransactionEvent,
)
from app.schemas.transaction.sales import SalesCreate, SalesItemCreate
from app.schemas.transaction.rental import RentalCreate, RentalItemCreate
from app.schemas.transaction.purchase_returns import (
    PurchaseReturnCreate,
    PurchaseReturnItemCreate,
)


# Test database URL - uses Docker PostgreSQL
TEST_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@test-postgres:5432/test_transactions_db"


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_engine():
    """Create test database engine."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    await engine.dispose()


@pytest.fixture(scope="function")
async def test_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create test database session."""
    async_session = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    async with async_session() as session:
        yield session
        await session.rollback()


@pytest.fixture(scope="function")
async def test_client() -> AsyncGenerator[AsyncClient, None]:
    """Create test HTTP client."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest.fixture
async def test_user(test_session):
    """Create test user for authentication."""
    from app.models.user import User
    from app.core.security import get_password_hash
    
    user = User(
        id=uuid4(),
        email="test@example.com",
        username="testuser",
        hashed_password=get_password_hash("testpass123"),
        is_active=True,
        is_superuser=False,
    )
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)
    return user


@pytest.fixture
async def auth_headers(test_client, test_user):
    """Get authentication headers for test user."""
    from app.core.security import create_access_token
    
    token = create_access_token(subject=str(test_user.id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def test_customer(test_session):
    """Create test customer."""
    from app.models.customer import Customer
    
    customer = Customer(
        id=uuid4(),
        first_name="John",
        last_name="Doe",
        email="john.doe@example.com",
        phone="+1234567890",
        credit_limit=Decimal("10000.00"),
        current_balance=Decimal("0.00"),
        is_active=True,
    )
    test_session.add(customer)
    await test_session.commit()
    await test_session.refresh(customer)
    return customer


@pytest.fixture
async def test_supplier(test_session):
    """Create test supplier."""
    from app.models.supplier import Supplier
    
    supplier = Supplier(
        id=uuid4(),
        name="Test Supplier Inc.",
        email="supplier@example.com",
        phone="+1234567890",
        return_policy_days=30,
        is_active=True,
    )
    test_session.add(supplier)
    await test_session.commit()
    await test_session.refresh(supplier)
    return supplier


@pytest.fixture
async def test_location(test_session):
    """Create test location."""
    from app.models.location import Location
    
    location = Location(
        id=uuid4(),
        location_name="Main Warehouse",
        location_code="WH001",
        address="123 Warehouse St",
        is_active=True,
    )
    test_session.add(location)
    await test_session.commit()
    await test_session.refresh(location)
    return location


@pytest.fixture
async def test_items(test_session):
    """Create test items for transactions."""
    from app.models.item import Item
    
    items = []
    for i in range(5):
        item = Item(
            id=uuid4(),
            name=f"Test Item {i+1}",
            sku=f"ITEM-{i+1:03d}",
            description=f"Test item {i+1} for integration testing",
            unit_price=Decimal(f"{(i+1) * 100}.00"),
            quantity_on_hand=100,
            is_active=True,
            is_rentable=True,
            daily_rental_rate=Decimal(f"{(i+1) * 10}.00"),
            weekly_rental_rate=Decimal(f"{(i+1) * 60}.00"),
            monthly_rental_rate=Decimal(f"{(i+1) * 200}.00"),
        )
        test_session.add(item)
        items.append(item)
    
    await test_session.commit()
    for item in items:
        await test_session.refresh(item)
    
    return items


class TestSalesTransactionIntegration:
    """Integration tests for sales transactions."""
    
    @pytest.mark.asyncio
    async def test_create_sales_order_e2e(
        self,
        test_client,
        auth_headers,
        test_customer,
        test_location,
        test_items,
    ):
        """Test end-to-end sales order creation."""
        sales_data = {
            "customer_id": str(test_customer.id),
            "location_id": str(test_location.id),
            "reference_number": "SO-TEST-001",
            "sales_date": datetime.utcnow().isoformat(),
            "due_date": (datetime.utcnow() + timedelta(days=30)).isoformat(),
            "payment_terms": "Net 30",
            "items": [
                {
                    "item_id": str(test_items[0].id),
                    "quantity": 5,
                    "unit_price": "100.00",
                    "discount_amount": "10.00",
                    "tax_amount": "44.50",
                },
                {
                    "item_id": str(test_items[1].id),
                    "quantity": 3,
                    "unit_price": "200.00",
                    "discount_amount": "0.00",
                    "tax_amount": "54.00",
                },
            ],
            "shipping_address": "123 Test St, Test City, TS 12345",
            "notes": "Integration test order",
        }
        
        response = await test_client.post(
            "/api/v1/transactions/sales",
            json=sales_data,
            headers=auth_headers,
        )
        
        assert response.status_code == 201
        result = response.json()
        assert result["transaction_number"].startswith("SO-")
        assert result["customer_id"] == str(test_customer.id)
        assert result["total_amount"] == "1188.50"
        assert len(result["items"]) == 2
    
    @pytest.mark.asyncio
    async def test_process_sales_payment_e2e(
        self,
        test_client,
        auth_headers,
        test_customer,
        test_location,
        test_items,
    ):
        """Test end-to-end sales payment processing."""
        # First create a sales order
        sales_data = {
            "customer_id": str(test_customer.id),
            "location_id": str(test_location.id),
            "reference_number": "SO-TEST-002",
            "sales_date": datetime.utcnow().isoformat(),
            "items": [
                {
                    "item_id": str(test_items[0].id),
                    "quantity": 2,
                    "unit_price": "100.00",
                    "tax_amount": "18.00",
                }
            ],
        }
        
        create_response = await test_client.post(
            "/api/v1/transactions/sales",
            json=sales_data,
            headers=auth_headers,
        )
        assert create_response.status_code == 201
        sales_order = create_response.json()
        
        # Process payment
        payment_data = {
            "amount": "218.00",
            "payment_method": "CREDIT_CARD",
            "reference_number": "CC-123456",
        }
        
        payment_response = await test_client.post(
            f"/api/v1/transactions/sales/{sales_order['id']}/payment",
            json=payment_data,
            headers=auth_headers,
        )
        
        assert payment_response.status_code == 200
        result = payment_response.json()
        assert result["payment_status"] == "PAID"
        assert result["paid_amount"] == "218.00"
        assert result["balance_amount"] == "0.00"


class TestRentalTransactionIntegration:
    """Integration tests for rental transactions."""
    
    @pytest.mark.asyncio
    async def test_rental_lifecycle_e2e(
        self,
        test_client,
        auth_headers,
        test_customer,
        test_location,
        test_items,
    ):
        """Test complete rental lifecycle from creation to return."""
        # Create rental
        start_date = datetime.now() + timedelta(days=1)
        end_date = start_date + timedelta(days=7)
        
        rental_data = {
            "customer_id": str(test_customer.id),
            "location_id": str(test_location.id),
            "reference_number": "RNT-TEST-001",
            "rental_start_date": start_date.isoformat(),
            "rental_end_date": end_date.isoformat(),
            "items": [
                {
                    "item_id": str(test_items[2].id),
                    "quantity": 1,
                    "daily_rate": "30.00",
                    "weekly_rate": "180.00",
                    "deposit_amount": "100.00",
                }
            ],
            "delivery_required": False,
            "insurance_required": True,
        }
        
        # Create rental
        create_response = await test_client.post(
            "/api/v1/transactions/rentals",
            json=rental_data,
            headers=auth_headers,
        )
        assert create_response.status_code == 201
        rental = create_response.json()
        assert rental["status"] == "RESERVED"
        
        # Process pickup
        pickup_data = {
            "pickup_person_name": "John Doe",
            "pickup_person_id_type": "Driver License",
            "pickup_person_id_number": "DL123456",
            "items_condition_confirmed": True,
            "deposit_collected": True,
            "payment_collected": True,
        }
        
        pickup_response = await test_client.post(
            f"/api/v1/transactions/rentals/{rental['id']}/pickup",
            json=pickup_data,
            headers=auth_headers,
        )
        assert pickup_response.status_code == 200
        pickup_result = pickup_response.json()
        assert pickup_result["status"] == "ACTIVE"
        assert pickup_result["pickup_confirmed"] is True
        
        # Process return
        return_data = {
            "return_person_name": "Jane Doe",
            "items_returned": [str(test_items[2].id)],
            "late_return": False,
            "damages": [],
        }
        
        return_response = await test_client.post(
            f"/api/v1/transactions/rentals/{rental['id']}/return",
            json=return_data,
            headers=auth_headers,
        )
        assert return_response.status_code == 200
        return_result = return_response.json()
        assert return_result["deposit_refund"] == "100.00"
        assert return_result["late_fees"] == "0.00"
        assert return_result["damage_charges"] == "0.00"
    
    @pytest.mark.asyncio
    async def test_rental_extension_e2e(
        self,
        test_client,
        auth_headers,
        test_customer,
        test_location,
        test_items,
    ):
        """Test rental extension functionality."""
        # Create rental
        start_date = datetime.now() + timedelta(days=1)
        end_date = start_date + timedelta(days=3)
        
        rental_data = {
            "customer_id": str(test_customer.id),
            "location_id": str(test_location.id),
            "reference_number": "RNT-TEST-002",
            "rental_start_date": start_date.isoformat(),
            "rental_end_date": end_date.isoformat(),
            "items": [
                {
                    "item_id": str(test_items[1].id),
                    "quantity": 1,
                    "daily_rate": "20.00",
                }
            ],
        }
        
        create_response = await test_client.post(
            "/api/v1/transactions/rentals",
            json=rental_data,
            headers=auth_headers,
        )
        assert create_response.status_code == 201
        rental = create_response.json()
        
        # Extend rental
        new_end_date = end_date + timedelta(days=4)
        extension_data = {
            "new_end_date": new_end_date.isoformat(),
            "reason": "Need equipment longer",
            "maintain_current_rate": True,
        }
        
        extension_response = await test_client.post(
            f"/api/v1/transactions/rentals/{rental['id']}/extend",
            json=extension_data,
            headers=auth_headers,
        )
        
        assert extension_response.status_code == 200
        result = extension_response.json()
        assert result["extension_days"] == 4
        assert result["additional_charge"] == "80.00"


class TestPurchaseReturnsIntegration:
    """Integration tests for purchase returns."""
    
    @pytest.mark.asyncio
    async def test_purchase_return_workflow_e2e(
        self,
        test_client,
        auth_headers,
        test_supplier,
        test_location,
        test_items,
        test_session,
    ):
        """Test complete purchase return workflow."""
        # First create a purchase order (simplified for testing)
        from app.models.transaction import TransactionHeader, TransactionLine
        from app.models.transaction.enums import TransactionType, TransactionStatus
        
        purchase = TransactionHeader(
            id=uuid4(),
            transaction_number="PO-TEST-001",
            transaction_type=TransactionType.PURCHASE,
            transaction_date=datetime.utcnow(),
            status=TransactionStatus.COMPLETED,
            supplier_id=test_supplier.id,
            location_id=test_location.id,
            total_amount=Decimal("1000.00"),
            created_by=uuid4(),
        )
        test_session.add(purchase)
        
        purchase_line = TransactionLine(
            id=uuid4(),
            transaction_header_id=purchase.id,
            item_id=test_items[0].id,
            quantity=Decimal("10"),
            unit_price=Decimal("100.00"),
            line_total=Decimal("1000.00"),
        )
        test_session.add(purchase_line)
        await test_session.commit()
        
        # Create return
        return_data = {
            "purchase_id": str(purchase.id),
            "supplier_id": str(test_supplier.id),
            "location_id": str(test_location.id),
            "reference_number": "PR-TEST-001",
            "return_type": "DEFECTIVE",
            "rma_number": "RMA-123",
            "items": [
                {
                    "purchase_line_id": str(purchase_line.id),
                    "item_id": str(test_items[0].id),
                    "quantity": 5,
                    "unit_cost": "100.00",
                    "return_reason": "DEFECTIVE",
                    "condition_rating": "POOR",
                    "defect_description": "Not working",
                }
            ],
            "require_inspection": True,
        }
        
        create_response = await test_client.post(
            "/api/v1/transactions/purchase-returns",
            json=return_data,
            headers=auth_headers,
        )
        assert create_response.status_code == 201
        return_order = create_response.json()
        assert return_order["return_type"] == "DEFECTIVE"
        assert return_order["total_return_amount"] == "500.00"
        
        # Process inspection
        inspection_data = [
            {
                "return_line_id": return_order["items"][0]["id"],
                "condition_verified": True,
                "condition_rating": "POOR",
                "damage_severity": "SEVERE",
                "disposition": "RETURN_TO_VENDOR",
                "inspection_notes": "Confirmed defective",
                "inspector_id": str(uuid4()),
            }
        ]
        
        inspection_response = await test_client.post(
            f"/api/v1/transactions/purchase-returns/{return_order['id']}/inspection",
            json=inspection_data,
            headers=auth_headers,
        )
        assert inspection_response.status_code == 200
        inspection_result = inspection_response.json()
        assert inspection_result["inspection_completed"] is True
        
        # Approve return
        approval_data = {
            "approved": True,
            "approval_notes": "Defective items confirmed",
            "approved_credit_amount": "500.00",
        }
        
        approval_response = await test_client.post(
            f"/api/v1/transactions/purchase-returns/{return_order['id']}/approve",
            json=approval_data,
            headers=auth_headers,
        )
        assert approval_response.status_code == 200
        approval_result = approval_response.json()
        assert approval_result["status"] == "APPROVED"
        assert approval_result["approved_credit_amount"] == "500.00"


class TestTransactionReporting:
    """Integration tests for transaction reporting."""
    
    @pytest.mark.asyncio
    async def test_transaction_summary_report(
        self,
        test_client,
        auth_headers,
    ):
        """Test transaction summary report generation."""
        params = {
            "start_date": (datetime.now() - timedelta(days=30)).isoformat(),
            "end_date": datetime.now().isoformat(),
        }
        
        response = await test_client.get(
            "/api/v1/transactions/reports/summary",
            params=params,
            headers=auth_headers,
        )
        
        assert response.status_code == 200
        result = response.json()
        assert "total_sales" in result
        assert "total_rentals" in result
        assert "total_purchases" in result
        assert "total_returns" in result
    
    @pytest.mark.asyncio
    async def test_overdue_rentals_report(
        self,
        test_client,
        auth_headers,
    ):
        """Test overdue rentals report."""
        response = await test_client.get(
            "/api/v1/transactions/reports/rentals/overdue",
            headers=auth_headers,
        )
        
        assert response.status_code == 200
        result = response.json()
        assert isinstance(result, list)


class TestTransactionPerformance:
    """Performance tests for transaction operations."""
    
    @pytest.mark.asyncio
    async def test_bulk_transaction_creation(
        self,
        test_client,
        auth_headers,
        test_customer,
        test_location,
        test_items,
    ):
        """Test bulk creation of transactions."""
        import time
        
        start_time = time.time()
        
        # Create 100 sales transactions
        for i in range(100):
            sales_data = {
                "customer_id": str(test_customer.id),
                "location_id": str(test_location.id),
                "reference_number": f"SO-PERF-{i:04d}",
                "sales_date": datetime.utcnow().isoformat(),
                "items": [
                    {
                        "item_id": str(test_items[i % 5].id),
                        "quantity": (i % 10) + 1,
                        "unit_price": "100.00",
                    }
                ],
            }
            
            response = await test_client.post(
                "/api/v1/transactions/sales",
                json=sales_data,
                headers=auth_headers,
            )
            assert response.status_code == 201
        
        elapsed_time = time.time() - start_time
        
        # Should complete 100 transactions in under 30 seconds
        assert elapsed_time < 30
        print(f"Created 100 transactions in {elapsed_time:.2f} seconds")
    
    @pytest.mark.asyncio
    async def test_concurrent_rental_availability(
        self,
        test_client,
        auth_headers,
        test_items,
        test_location,
    ):
        """Test concurrent rental availability checks."""
        import asyncio
        
        async def check_availability(item_id):
            response = await test_client.post(
                "/api/v1/transactions/rentals/check-availability",
                json={
                    "item_id": str(item_id),
                    "location_id": str(test_location.id),
                    "start_date": datetime.now().isoformat(),
                    "end_date": (datetime.now() + timedelta(days=7)).isoformat(),
                    "quantity_needed": 1,
                },
                headers=auth_headers,
            )
            return response.status_code == 200
        
        # Run 50 concurrent availability checks
        tasks = [check_availability(test_items[i % 5].id) for i in range(50)]
        results = await asyncio.gather(*tasks)
        
        assert all(results)
        print(f"Completed 50 concurrent availability checks")