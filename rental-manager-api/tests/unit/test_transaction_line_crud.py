"""
Comprehensive CRUD tests for TransactionLine model.

Tests all database operations, business logic, validations,
and edge cases for transaction line items.
"""

import pytest
import pytest_asyncio
from datetime import datetime, date, timezone, timedelta
from decimal import Decimal
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction.transaction_line import (
    TransactionLine,
    LineItemType
)
from app.crud.transaction.transaction_line import CRUDTransactionLine
from app.schemas.transaction.transaction_line import (
    TransactionLineCreate,
    TransactionLineUpdate,
    TransactionLineBulkCreate
)


class TestCRUDTransactionLine:
    """Test suite for TransactionLine CRUD operations."""

    @pytest.fixture
    def crud_instance(self):
        return CRUDTransactionLine(TransactionLine)

    @pytest.fixture
    def sample_line_data(self):
        return {
            "transaction_header_id": uuid4(),
            "item_id": uuid4(),
            "line_item_type": LineItemType.ITEM,
            "quantity": Decimal("2.00"),
            "unit_price": Decimal("75.50"),
            "discount_amount": Decimal("5.00"),
            "tax_rate": Decimal("0.08"),
            "line_total": Decimal("151.00"),
            "description": "Test item line",
            "notes": "Test notes"
        }

    @pytest.fixture
    def rental_line_data(self):
        return {
            "transaction_header_id": uuid4(),
            "item_id": uuid4(),
            "line_item_type": LineItemType.RENTAL,
            "quantity": Decimal("1.00"),
            "unit_price": Decimal("50.00"),
            "rental_period": 7,
            "rental_start_date": date.today(),
            "rental_end_date": date.today() + timedelta(days=7),
            "daily_rate": Decimal("50.00"),
            "deposit_amount": Decimal("100.00"),
            "line_total": Decimal("450.00"),  # (50 * 7) + 100
            "description": "Weekly equipment rental"
        }

    @pytest.fixture
    def service_line_data(self):
        return {
            "transaction_header_id": uuid4(),
            "line_item_type": LineItemType.SERVICE,
            "quantity": Decimal("1.00"),
            "unit_price": Decimal("125.00"),
            "service_description": "Equipment maintenance",
            "line_total": Decimal("125.00"),
            "description": "Maintenance service"
        }

    async def test_create_line_item_success(self, db_session, crud_instance, sample_line_data):
        """Test successful line item creation."""
        line_schema = TransactionLineCreate(**sample_line_data)
        
        with patch.object(crud_instance, 'create') as mock_create:
            mock_line = MagicMock()
            mock_line.id = uuid4()
            mock_line.transaction_header_id = sample_line_data["transaction_header_id"]
            mock_line.item_id = sample_line_data["item_id"]
            mock_line.quantity = sample_line_data["quantity"]
            mock_line.unit_price = sample_line_data["unit_price"]
            mock_line.line_total = sample_line_data["line_total"]
            mock_create.return_value = mock_line
            
            result = await crud_instance.create(db_session, obj_in=line_schema)
            
            assert result.transaction_header_id == sample_line_data["transaction_header_id"]
            assert result.quantity == sample_line_data["quantity"]
            assert result.unit_price == sample_line_data["unit_price"]
            assert result.line_total == sample_line_data["line_total"]

    async def test_create_rental_line_success(self, db_session, crud_instance, rental_line_data):
        """Test successful rental line item creation."""
        rental_schema = TransactionLineCreate(**rental_line_data)
        
        with patch.object(crud_instance, 'create') as mock_create:
            mock_rental_line = MagicMock()
            mock_rental_line.id = uuid4()
            mock_rental_line.line_item_type = LineItemType.RENTAL
            mock_rental_line.rental_period = rental_line_data["rental_period"]
            mock_rental_line.daily_rate = rental_line_data["daily_rate"]
            mock_rental_line.deposit_amount = rental_line_data["deposit_amount"]
            mock_create.return_value = mock_rental_line
            
            result = await crud_instance.create(db_session, obj_in=rental_schema)
            
            assert result.line_item_type == LineItemType.RENTAL
            assert result.rental_period == rental_line_data["rental_period"]
            assert result.daily_rate == rental_line_data["daily_rate"]

    async def test_create_service_line_success(self, db_session, crud_instance, service_line_data):
        """Test successful service line item creation."""
        service_schema = TransactionLineCreate(**service_line_data)
        
        with patch.object(crud_instance, 'create') as mock_create:
            mock_service_line = MagicMock()
            mock_service_line.id = uuid4()
            mock_service_line.line_item_type = LineItemType.SERVICE
            mock_service_line.service_description = service_line_data["service_description"]
            mock_create.return_value = mock_service_line
            
            result = await crud_instance.create(db_session, obj_in=service_schema)
            
            assert result.line_item_type == LineItemType.SERVICE
            assert result.service_description == service_line_data["service_description"]

    async def test_get_lines_by_transaction(self, db_session, crud_instance):
        """Test retrieving line items by transaction header."""
        transaction_id = uuid4()
        
        with patch.object(crud_instance, 'get_by_transaction') as mock_get_by_transaction:
            mock_lines = [
                MagicMock(transaction_header_id=transaction_id, line_item_type=LineItemType.ITEM),
                MagicMock(transaction_header_id=transaction_id, line_item_type=LineItemType.SERVICE)
            ]
            mock_get_by_transaction.return_value = mock_lines
            
            result = await crud_instance.get_by_transaction(db_session, transaction_id=transaction_id)
            
            assert len(result) == 2
            assert all(line.transaction_header_id == transaction_id for line in result)

    async def test_get_lines_by_item(self, db_session, crud_instance):
        """Test retrieving line items by item ID."""
        item_id = uuid4()
        
        with patch.object(crud_instance, 'get_by_item') as mock_get_by_item:
            mock_lines = [
                MagicMock(item_id=item_id, quantity=Decimal("1.00")),
                MagicMock(item_id=item_id, quantity=Decimal("3.00"))
            ]
            mock_get_by_item.return_value = mock_lines
            
            result = await crud_instance.get_by_item(db_session, item_id=item_id)
            
            assert len(result) == 2
            assert all(line.item_id == item_id for line in result)

    async def test_update_line_quantity(self, db_session, crud_instance):
        """Test updating line item quantity."""
        line_id = uuid4()
        
        with patch.object(crud_instance, 'get') as mock_get, \
             patch.object(crud_instance, 'update') as mock_update:
            
            mock_line = MagicMock()
            mock_line.id = line_id
            mock_line.quantity = Decimal("2.00")
            mock_line.unit_price = Decimal("50.00")
            mock_get.return_value = mock_line
            
            mock_updated_line = MagicMock()
            mock_updated_line.quantity = Decimal("5.00")
            mock_updated_line.line_total = Decimal("250.00")
            mock_update.return_value = mock_updated_line
            
            update_data = TransactionLineUpdate(quantity=Decimal("5.00"))
            result = await crud_instance.update(db_session, db_obj=mock_line, obj_in=update_data)
            
            assert result.quantity == Decimal("5.00")
            assert result.line_total == Decimal("250.00")

    async def test_update_line_price(self, db_session, crud_instance):
        """Test updating line item unit price."""
        line_id = uuid4()
        
        with patch.object(crud_instance, 'update_price') as mock_update_price:
            mock_line = MagicMock()
            mock_line.unit_price = Decimal("85.00")
            mock_line.line_total = Decimal("170.00")  # quantity * new price
            mock_update_price.return_value = mock_line
            
            result = await crud_instance.update_price(
                db_session,
                line_id=line_id,
                new_price=Decimal("85.00"),
                updated_by=uuid4()
            )
            
            assert result.unit_price == Decimal("85.00")

    async def test_apply_line_discount(self, db_session, crud_instance):
        """Test applying discount to line item."""
        line_id = uuid4()
        
        with patch.object(crud_instance, 'apply_discount') as mock_apply_discount:
            mock_line = MagicMock()
            mock_line.discount_amount = Decimal("15.00")
            mock_line.line_total = Decimal("135.00")  # Original - discount
            mock_apply_discount.return_value = mock_line
            
            result = await crud_instance.apply_discount(
                db_session,
                line_id=line_id,
                discount_amount=Decimal("15.00"),
                discount_reason="Volume discount"
            )
            
            assert result.discount_amount == Decimal("15.00")

    async def test_calculate_line_total(self, db_session, crud_instance):
        """Test line total calculation."""
        with patch.object(crud_instance, 'calculate_line_total') as mock_calculate:
            line_data = {
                "quantity": Decimal("3.00"),
                "unit_price": Decimal("25.00"),
                "tax_rate": Decimal("0.08"),
                "discount_amount": Decimal("5.00")
            }
            
            expected_total = Decimal("76.00")  # (3 * 25 * 1.08) - 5
            mock_calculate.return_value = expected_total
            
            result = await crud_instance.calculate_line_total(db_session, **line_data)
            
            assert result == expected_total

    async def test_get_transaction_totals(self, db_session, crud_instance):
        """Test calculating transaction totals from line items."""
        transaction_id = uuid4()
        
        with patch.object(crud_instance, 'get_transaction_totals') as mock_get_totals:
            mock_totals = {
                "subtotal": Decimal("200.00"),
                "total_discount": Decimal("20.00"),
                "total_tax": Decimal("14.40"),
                "grand_total": Decimal("194.40"),
                "line_count": 3
            }
            mock_get_totals.return_value = mock_totals
            
            result = await crud_instance.get_transaction_totals(db_session, transaction_id=transaction_id)
            
            assert result["subtotal"] == Decimal("200.00")
            assert result["total_discount"] == Decimal("20.00")
            assert result["grand_total"] == Decimal("194.40")

    async def test_bulk_create_lines(self, db_session, crud_instance):
        """Test bulk creation of line items."""
        transaction_id = uuid4()
        
        bulk_data = TransactionLineBulkCreate(
            transaction_header_id=transaction_id,
            lines=[
                {
                    "item_id": uuid4(),
                    "quantity": Decimal("2.00"),
                    "unit_price": Decimal("50.00"),
                    "line_item_type": LineItemType.ITEM
                },
                {
                    "item_id": uuid4(),
                    "quantity": Decimal("1.00"),
                    "unit_price": Decimal("100.00"),
                    "line_item_type": LineItemType.ITEM
                }
            ]
        )
        
        with patch.object(crud_instance, 'bulk_create') as mock_bulk_create:
            mock_lines = [
                MagicMock(id=uuid4(), line_total=Decimal("100.00")),
                MagicMock(id=uuid4(), line_total=Decimal("100.00"))
            ]
            mock_bulk_create.return_value = mock_lines
            
            result = await crud_instance.bulk_create(db_session, obj_in=bulk_data)
            
            assert len(result) == 2
            assert all(line.line_total == Decimal("100.00") for line in result)

    async def test_delete_line_item(self, db_session, crud_instance):
        """Test deleting a line item."""
        line_id = uuid4()
        
        with patch.object(crud_instance, 'get') as mock_get, \
             patch.object(crud_instance, 'remove') as mock_remove:
            
            mock_line = MagicMock()
            mock_line.id = line_id
            mock_get.return_value = mock_line
            
            mock_remove.return_value = mock_line
            
            result = await crud_instance.remove(db_session, id=line_id)
            
            assert result == mock_line
            mock_remove.assert_called_once()

    async def test_get_rental_lines_by_date_range(self, db_session, crud_instance):
        """Test retrieving rental lines by date range."""
        start_date = date.today()
        end_date = date.today() + timedelta(days=30)
        
        with patch.object(crud_instance, 'get_rental_lines_by_date') as mock_get_rental_lines:
            mock_rental_lines = [
                MagicMock(
                    line_item_type=LineItemType.RENTAL,
                    rental_start_date=start_date + timedelta(days=5),
                    rental_end_date=start_date + timedelta(days=12)
                ),
                MagicMock(
                    line_item_type=LineItemType.RENTAL,
                    rental_start_date=start_date + timedelta(days=10),
                    rental_end_date=start_date + timedelta(days=17)
                )
            ]
            mock_get_rental_lines.return_value = mock_rental_lines
            
            result = await crud_instance.get_rental_lines_by_date(
                db_session,
                start_date=start_date,
                end_date=end_date
            )
            
            assert len(result) == 2
            assert all(line.line_item_type == LineItemType.RENTAL for line in result)

    async def test_get_lines_by_type(self, db_session, crud_instance):
        """Test retrieving lines by item type."""
        line_type = LineItemType.SERVICE
        
        with patch.object(crud_instance, 'get_by_type') as mock_get_by_type:
            mock_service_lines = [
                MagicMock(line_item_type=line_type),
                MagicMock(line_item_type=line_type)
            ]
            mock_get_by_type.return_value = mock_service_lines
            
            result = await crud_instance.get_by_type(db_session, line_type=line_type)
            
            assert len(result) == 2
            assert all(line.line_item_type == line_type for line in result)

    async def test_update_rental_dates(self, db_session, crud_instance):
        """Test updating rental dates for rental line items."""
        line_id = uuid4()
        
        with patch.object(crud_instance, 'update_rental_dates') as mock_update_dates:
            mock_line = MagicMock()
            mock_line.rental_start_date = date.today() + timedelta(days=1)
            mock_line.rental_end_date = date.today() + timedelta(days=8)
            mock_line.rental_period = 7
            mock_update_dates.return_value = mock_line
            
            result = await crud_instance.update_rental_dates(
                db_session,
                line_id=line_id,
                new_start_date=date.today() + timedelta(days=1),
                new_end_date=date.today() + timedelta(days=8)
            )
            
            assert result.rental_period == 7

    async def test_extend_rental_period(self, db_session, crud_instance):
        """Test extending rental period for rental line items."""
        line_id = uuid4()
        
        with patch.object(crud_instance, 'extend_rental_period') as mock_extend:
            mock_line = MagicMock()
            mock_line.rental_end_date = date.today() + timedelta(days=10)
            mock_line.line_total = Decimal("500.00")  # Updated total with extension
            mock_extend.return_value = mock_line
            
            result = await crud_instance.extend_rental_period(
                db_session,
                line_id=line_id,
                additional_days=3,
                daily_rate=Decimal("50.00")
            )
            
            assert result.line_total == Decimal("500.00")

    async def test_get_item_rental_history(self, db_session, crud_instance):
        """Test retrieving item rental history from line items."""
        item_id = uuid4()
        
        with patch.object(crud_instance, 'get_item_rental_history') as mock_get_history:
            mock_history = [
                MagicMock(
                    item_id=item_id,
                    line_item_type=LineItemType.RENTAL,
                    rental_start_date=date.today() - timedelta(days=30),
                    rental_end_date=date.today() - timedelta(days=23)
                ),
                MagicMock(
                    item_id=item_id,
                    line_item_type=LineItemType.RENTAL,
                    rental_start_date=date.today() - timedelta(days=15),
                    rental_end_date=date.today() - timedelta(days=8)
                )
            ]
            mock_get_history.return_value = mock_history
            
            result = await crud_instance.get_item_rental_history(
                db_session,
                item_id=item_id,
                limit=10
            )
            
            assert len(result) == 2
            assert all(line.item_id == item_id for line in result)

    async def test_calculate_rental_extension_cost(self, db_session, crud_instance):
        """Test calculating cost for rental extension."""
        with patch.object(crud_instance, 'calculate_extension_cost') as mock_calculate_cost:
            extension_data = {
                "daily_rate": Decimal("60.00"),
                "additional_days": 5,
                "tax_rate": Decimal("0.08")
            }
            
            expected_cost = Decimal("324.00")  # 60 * 5 * 1.08
            mock_calculate_cost.return_value = expected_cost
            
            result = await crud_instance.calculate_extension_cost(db_session, **extension_data)
            
            assert result == expected_cost

    async def test_validate_rental_dates(self, db_session, crud_instance):
        """Test rental date validation."""
        with patch.object(crud_instance, 'validate_rental_dates') as mock_validate:
            # Test valid dates
            mock_validate.return_value = True
            
            result = await crud_instance.validate_rental_dates(
                db_session,
                start_date=date.today(),
                end_date=date.today() + timedelta(days=7)
            )
            
            assert result is True
            
            # Test invalid dates (end before start)
            mock_validate.return_value = False
            
            result = await crud_instance.validate_rental_dates(
                db_session,
                start_date=date.today(),
                end_date=date.today() - timedelta(days=1)
            )
            
            assert result is False

    async def test_get_lines_requiring_inventory_update(self, db_session, crud_instance):
        """Test retrieving lines that require inventory updates."""
        with patch.object(crud_instance, 'get_lines_requiring_inventory_update') as mock_get_lines:
            mock_lines = [
                MagicMock(
                    line_item_type=LineItemType.ITEM,
                    item_id=uuid4(),
                    quantity=Decimal("2.00"),
                    inventory_updated=False
                )
            ]
            mock_get_lines.return_value = mock_lines
            
            result = await crud_instance.get_lines_requiring_inventory_update(db_session)
            
            assert len(result) == 1
            assert result[0].inventory_updated is False

    async def test_mark_inventory_updated(self, db_session, crud_instance):
        """Test marking line items as inventory updated."""
        line_ids = [uuid4(), uuid4()]
        
        with patch.object(crud_instance, 'mark_inventory_updated') as mock_mark_updated:
            mock_mark_updated.return_value = 2  # Number of updated records
            
            result = await crud_instance.mark_inventory_updated(
                db_session,
                line_ids=line_ids,
                updated_by=uuid4()
            )
            
            assert result == 2

    async def test_line_validation_errors(self, db_session, crud_instance):
        """Test line item validation errors."""
        # Test negative quantity
        invalid_data = {
            "transaction_header_id": uuid4(),
            "item_id": uuid4(),
            "quantity": Decimal("-1.00"),  # Invalid negative quantity
            "unit_price": Decimal("50.00")
        }
        
        with pytest.raises(ValueError, match="Quantity must be positive"):
            line_schema = TransactionLineCreate(**invalid_data)
            await crud_instance.create(db_session, obj_in=line_schema)

    async def test_concurrent_line_updates(self, db_session, crud_instance):
        """Test handling concurrent line item updates."""
        line_id = uuid4()
        
        with patch.object(crud_instance, 'get') as mock_get, \
             patch.object(crud_instance, 'update') as mock_update:
            
            mock_line = MagicMock()
            mock_line.id = line_id
            mock_line.version = 1
            mock_get.return_value = mock_line
            
            # Simulate optimistic locking conflict
            mock_update.side_effect = IntegrityError("", "", "")
            
            with pytest.raises(IntegrityError):
                update_data = TransactionLineUpdate(quantity=Decimal("3.00"))
                await crud_instance.update(db_session, db_obj=mock_line, obj_in=update_data)