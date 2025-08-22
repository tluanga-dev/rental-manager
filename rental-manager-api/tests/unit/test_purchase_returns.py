"""
Unit tests for purchase returns service.
Tests vendor returns, defective items, inspection workflow, and credit processing.
"""

import pytest
from decimal import Decimal
from datetime import datetime, timedelta
from uuid import UUID, uuid4
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.transaction.purchase_returns_service import (
    PurchaseReturnsService,
    ReturnType,
)
from app.schemas.transaction.purchase_returns import (
    PurchaseReturnCreate,
    PurchaseReturnItemCreate,
    PurchaseReturnInspection,
    VendorCreditRequest,
    PurchaseReturnApproval,
)
from app.models.transaction.enums import (
    ReturnStatus,
    ItemDisposition,
    ConditionRating,
    DamageSeverity,
)


@pytest.fixture
def returns_service():
    """Create purchase returns service instance with mocked dependencies."""
    mock_db = AsyncMock()
    mock_crud = MagicMock()
    mock_event_service = AsyncMock()
    mock_notification_service = AsyncMock()
    
    service = PurchaseReturnsService(mock_db)
    service.crud = mock_crud
    service.event_service = mock_event_service
    service.notification_service = mock_notification_service
    
    return service


@pytest.fixture
def sample_return_data():
    """Sample purchase return data for testing."""
    return PurchaseReturnCreate(
        purchase_id=uuid4(),
        supplier_id=uuid4(),
        location_id=uuid4(),
        reference_number="PR-2024-001",
        return_date=datetime.utcnow(),
        return_type=ReturnType.DEFECTIVE,
        rma_number="RMA-123456",
        items=[
            PurchaseReturnItemCreate(
                purchase_line_id=uuid4(),
                item_id=uuid4(),
                quantity=5,
                unit_cost=Decimal("100.00"),
                return_reason=ReturnType.DEFECTIVE,
                condition_rating=ConditionRating.POOR,
                defect_description="Manufacturing defect - does not power on",
                serial_numbers=["SN001", "SN002", "SN003", "SN004", "SN005"],
            ),
            PurchaseReturnItemCreate(
                purchase_line_id=uuid4(),
                item_id=uuid4(),
                quantity=3,
                unit_cost=Decimal("50.00"),
                return_reason=ReturnType.WRONG_ITEM,
                condition_rating=ConditionRating.EXCELLENT,
                defect_description=None,
            ),
        ],
        shipping_method="FedEx Ground",
        tracking_number="TRACK123456",
        return_shipping_cost=Decimal("25.00"),
        restocking_fee_percent=Decimal("15.00"),
        notes="Urgent return - customer complaints",
        require_inspection=True,
    )


@pytest.fixture
def mock_purchase():
    """Mock purchase order data."""
    purchase = MagicMock()
    purchase.id = uuid4()
    purchase.transaction_number = "PO-2024-001"
    purchase.supplier_id = uuid4()
    purchase.total_amount = Decimal("5000.00")
    purchase.status = "COMPLETED"
    return purchase


@pytest.fixture
def mock_supplier():
    """Mock supplier data."""
    supplier = MagicMock()
    supplier.id = uuid4()
    supplier.name = "Test Supplier Inc."
    supplier.return_policy_days = 30
    supplier.restocking_fee_percent = Decimal("15.00")
    supplier.requires_rma = True
    return supplier


@pytest.fixture
def mock_items():
    """Mock item data."""
    items = []
    for i in range(2):
        item = MagicMock()
        item.id = uuid4()
        item.name = f"Test Item {i+1}"
        item.sku = f"ITEM-{i+1:03d}"
        item.is_returnable = True
        items.append(item)
    return items


class TestPurchaseReturnsService:
    """Test suite for purchase returns service."""
    
    @pytest.mark.asyncio
    async def test_create_return_success(
        self, returns_service, sample_return_data, mock_purchase, mock_supplier
    ):
        """Test successful purchase return creation."""
        # Setup mocks
        returns_service.crud.purchase.get = AsyncMock(return_value=mock_purchase)
        returns_service.crud.supplier.get = AsyncMock(return_value=mock_supplier)
        returns_service._validate_return_eligibility = AsyncMock(return_value=True)
        
        mock_return = MagicMock()
        mock_return.id = uuid4()
        mock_return.return_number = "PR-2024-001"
        mock_return.total_return_amount = Decimal("650.00")
        returns_service.crud.purchase_return.create = AsyncMock(
            return_value=mock_return
        )
        
        # Execute
        result = await returns_service.create_return(
            sample_return_data, user_id=uuid4()
        )
        
        # Assert
        assert result.id == mock_return.id
        assert result.return_number == "PR-2024-001"
        returns_service._validate_return_eligibility.assert_called_once()
        returns_service.event_service.publish.assert_called()
    
    @pytest.mark.asyncio
    async def test_create_return_no_rma_for_warranty(
        self, returns_service, sample_return_data
    ):
        """Test return creation fails without RMA for warranty claims."""
        # Modify data for warranty claim without RMA
        sample_return_data.return_type = ReturnType.WARRANTY_CLAIM
        sample_return_data.rma_number = None
        
        # Execute and assert
        with pytest.raises(ValueError, match="RMA number required"):
            await returns_service.create_return(
                sample_return_data, user_id=uuid4()
            )
    
    @pytest.mark.asyncio
    async def test_create_return_expired_window(
        self, returns_service, sample_return_data, mock_purchase, mock_supplier
    ):
        """Test return creation fails outside return window."""
        # Setup mocks with old purchase date
        mock_purchase.transaction_date = datetime.utcnow() - timedelta(days=60)
        mock_supplier.return_policy_days = 30
        
        returns_service.crud.purchase.get = AsyncMock(return_value=mock_purchase)
        returns_service.crud.supplier.get = AsyncMock(return_value=mock_supplier)
        
        # Execute and assert
        with pytest.raises(ValueError, match="outside return window"):
            await returns_service.create_return(
                sample_return_data, user_id=uuid4()
            )
    
    @pytest.mark.asyncio
    async def test_process_inspection_approve_for_return(self, returns_service):
        """Test inspection processing with return to vendor disposition."""
        return_id = uuid4()
        mock_return = MagicMock()
        mock_return.id = return_id
        mock_return.status = ReturnStatus.PENDING_INSPECTION
        mock_return.items = [
            MagicMock(
                id=uuid4(),
                quantity=5,
                unit_cost=Decimal("100.00"),
            )
        ]
        
        returns_service.crud.purchase_return.get = AsyncMock(return_value=mock_return)
        returns_service.crud.purchase_return.update = AsyncMock(return_value=mock_return)
        
        inspection_data = PurchaseReturnInspection(
            return_line_id=mock_return.items[0].id,
            condition_verified=True,
            condition_rating=ConditionRating.POOR,
            damage_severity=DamageSeverity.SEVERE,
            disposition=ItemDisposition.RETURN_TO_VENDOR,
            inspection_notes="Confirmed manufacturing defect",
            inspector_id=uuid4(),
        )
        
        # Execute
        result = await returns_service.process_inspection(
            return_id, [inspection_data], user_id=uuid4()
        )
        
        # Assert
        assert result.inspection_completed is True
        assert result.status == ReturnStatus.INSPECTED
        returns_service.event_service.publish.assert_called()
    
    @pytest.mark.asyncio
    async def test_process_inspection_repair_disposition(self, returns_service):
        """Test inspection with repair disposition."""
        return_id = uuid4()
        mock_return = MagicMock()
        mock_return.id = return_id
        mock_return.status = ReturnStatus.PENDING_INSPECTION
        mock_return.items = [
            MagicMock(
                id=uuid4(),
                quantity=2,
                unit_cost=Decimal("200.00"),
            )
        ]
        
        returns_service.crud.purchase_return.get = AsyncMock(return_value=mock_return)
        returns_service.crud.purchase_return.update = AsyncMock(return_value=mock_return)
        
        inspection_data = PurchaseReturnInspection(
            return_line_id=mock_return.items[0].id,
            condition_verified=True,
            condition_rating=ConditionRating.FAIR,
            damage_severity=DamageSeverity.MINOR,
            disposition=ItemDisposition.REPAIR,
            inspection_notes="Minor damage - can be repaired",
            repair_cost_estimate=Decimal("50.00"),
            inspector_id=uuid4(),
        )
        
        # Execute
        result = await returns_service.process_inspection(
            return_id, [inspection_data], user_id=uuid4()
        )
        
        # Assert
        assert result.disposition == ItemDisposition.REPAIR
        assert inspection_data.repair_cost_estimate == Decimal("50.00")
    
    @pytest.mark.asyncio
    async def test_approve_return_auto_approval(self, returns_service):
        """Test automatic approval for defective items."""
        return_id = uuid4()
        mock_return = MagicMock()
        mock_return.id = return_id
        mock_return.status = ReturnStatus.INSPECTED
        mock_return.return_type = ReturnType.DEFECTIVE
        mock_return.total_return_amount = Decimal("500.00")
        
        returns_service.crud.purchase_return.get = AsyncMock(return_value=mock_return)
        returns_service.crud.purchase_return.update = AsyncMock(return_value=mock_return)
        returns_service._should_auto_approve = AsyncMock(return_value=True)
        
        approval_data = PurchaseReturnApproval(
            approved=True,
            approval_notes="Auto-approved for defective items",
            approved_credit_amount=Decimal("500.00"),
        )
        
        # Execute
        result = await returns_service.approve_return(
            return_id, approval_data, user_id=uuid4()
        )
        
        # Assert
        assert result.status == ReturnStatus.APPROVED
        assert result.approved_credit_amount == Decimal("500.00")
        returns_service.notification_service.notify.assert_called()
    
    @pytest.mark.asyncio
    async def test_approve_return_rejection(self, returns_service):
        """Test return rejection."""
        return_id = uuid4()
        mock_return = MagicMock()
        mock_return.id = return_id
        mock_return.status = ReturnStatus.INSPECTED
        
        returns_service.crud.purchase_return.get = AsyncMock(return_value=mock_return)
        returns_service.crud.purchase_return.update = AsyncMock(return_value=mock_return)
        
        approval_data = PurchaseReturnApproval(
            approved=False,
            approval_notes="Items not eligible for return - outside warranty",
        )
        
        # Execute
        result = await returns_service.approve_return(
            return_id, approval_data, user_id=uuid4()
        )
        
        # Assert
        assert result.status == ReturnStatus.REJECTED
        assert result.approved_credit_amount is None
        returns_service.notification_service.notify.assert_called()
    
    @pytest.mark.asyncio
    async def test_process_vendor_credit_success(self, returns_service):
        """Test successful vendor credit processing."""
        return_id = uuid4()
        mock_return = MagicMock()
        mock_return.id = return_id
        mock_return.status = ReturnStatus.APPROVED
        mock_return.approved_credit_amount = Decimal("500.00")
        mock_return.supplier_id = uuid4()
        
        returns_service.crud.purchase_return.get = AsyncMock(return_value=mock_return)
        returns_service.crud.purchase_return.update = AsyncMock(return_value=mock_return)
        returns_service._apply_credit_to_account = AsyncMock()
        
        credit_data = VendorCreditRequest(
            return_id=return_id,
            credit_amount=Decimal("500.00"),
            credit_type="credit_note",
            credit_reference="CN-2024-001",
            expected_date=datetime.utcnow() + timedelta(days=7),
        )
        
        # Execute
        result = await returns_service.process_vendor_credit(
            return_id, credit_data, user_id=uuid4()
        )
        
        # Assert
        assert result.credit_amount == Decimal("500.00")
        assert result.credit_type == "credit_note"
        assert result.credit_status == "PROCESSED"
        returns_service._apply_credit_to_account.assert_called_once()
        returns_service.event_service.publish.assert_called()
    
    @pytest.mark.asyncio
    async def test_process_vendor_credit_unapproved(self, returns_service):
        """Test vendor credit processing for unapproved return."""
        return_id = uuid4()
        mock_return = MagicMock()
        mock_return.id = return_id
        mock_return.status = ReturnStatus.PENDING
        
        returns_service.crud.purchase_return.get = AsyncMock(return_value=mock_return)
        
        credit_data = VendorCreditRequest(
            return_id=return_id,
            credit_amount=Decimal("500.00"),
            credit_type="refund",
        )
        
        # Execute and assert
        with pytest.raises(ValueError, match="Return not approved"):
            await returns_service.process_vendor_credit(
                return_id, credit_data, user_id=uuid4()
            )
    
    @pytest.mark.asyncio
    async def test_calculate_restocking_fee(self, returns_service):
        """Test restocking fee calculation."""
        items = [
            {"quantity": 5, "unit_cost": Decimal("100.00")},
            {"quantity": 3, "unit_cost": Decimal("50.00")},
        ]
        restocking_percent = Decimal("15.00")
        
        # Execute
        fee = returns_service._calculate_restocking_fee(items, restocking_percent)
        
        # Assert
        assert fee == Decimal("97.50")  # (500 + 150) * 0.15
    
    @pytest.mark.asyncio
    async def test_should_auto_approve_defective(self, returns_service):
        """Test auto-approval logic for defective items."""
        # Execute
        result = await returns_service._should_auto_approve(
            Decimal("500.00"), ReturnType.DEFECTIVE
        )
        
        # Assert
        assert result is True
    
    @pytest.mark.asyncio
    async def test_should_auto_approve_recall(self, returns_service):
        """Test auto-approval logic for recall items."""
        # Execute
        result = await returns_service._should_auto_approve(
            Decimal("10000.00"), ReturnType.RECALL
        )
        
        # Assert
        assert result is True
    
    @pytest.mark.asyncio
    async def test_should_auto_approve_high_value(self, returns_service):
        """Test auto-approval denied for high value returns."""
        # Execute
        result = await returns_service._should_auto_approve(
            Decimal("15000.00"), ReturnType.OVERSTOCK
        )
        
        # Assert
        assert result is False
    
    @pytest.mark.asyncio
    async def test_validate_return_eligibility_success(self, returns_service):
        """Test successful return eligibility validation."""
        mock_purchase = MagicMock()
        mock_purchase.transaction_date = datetime.utcnow() - timedelta(days=10)
        
        mock_supplier = MagicMock()
        mock_supplier.return_policy_days = 30
        
        items = [
            MagicMock(is_returnable=True),
            MagicMock(is_returnable=True),
        ]
        
        # Execute
        result = await returns_service._validate_return_eligibility(
            mock_purchase, mock_supplier, items
        )
        
        # Assert
        assert result is True
    
    @pytest.mark.asyncio
    async def test_validate_return_eligibility_non_returnable(self, returns_service):
        """Test return eligibility validation with non-returnable items."""
        mock_purchase = MagicMock()
        mock_purchase.transaction_date = datetime.utcnow() - timedelta(days=10)
        
        mock_supplier = MagicMock()
        mock_supplier.return_policy_days = 30
        
        items = [
            MagicMock(is_returnable=False, name="Non-returnable Item"),
            MagicMock(is_returnable=True),
        ]
        
        # Execute and assert
        with pytest.raises(ValueError, match="non-returnable"):
            await returns_service._validate_return_eligibility(
                mock_purchase, mock_supplier, items
            )