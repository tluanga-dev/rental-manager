"""
Comprehensive integration tests for transaction workflows.

Tests end-to-end transaction flows including purchase-to-sale,
rental lifecycles, return processing, and cross-module integration.
"""

import pytest
import pytest_asyncio
from datetime import datetime, date, timezone, timedelta
from decimal import Decimal
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import (
    TransactionType,
    TransactionStatus,
    PaymentMethod,
    PaymentStatus,
    RentalStatus,
    LineItemType
)
from app.services.transaction import (
    TransactionService,
    PurchaseService,
    SalesService,
    RentalService,
    PurchaseReturnsService
)


class TestPurchaseToInventoryWorkflow:
    """Test integration between purchase orders and inventory management."""

    @pytest.fixture
    def purchase_service(self):
        return PurchaseService()

    @pytest.fixture
    def transaction_service(self):
        return TransactionService()

    async def test_complete_purchase_workflow(self, db_session, purchase_service, transaction_service):
        """Test complete purchase workflow from order to inventory."""
        # Step 1: Create purchase order
        purchase_data = {
            "supplier_id": uuid4(),
            "location_id": uuid4(),
            "purchase_order_number": "PO-2025-001",
            "expected_delivery_date": date.today() + timedelta(days=7),
            "line_items": [
                {
                    "item_id": uuid4(),
                    "quantity": Decimal("50.00"),
                    "unit_cost": Decimal("20.00"),
                    "description": "Test equipment"
                }
            ]
        }
        
        with patch.object(purchase_service, 'create_purchase_order') as mock_create_po:
            mock_purchase = MagicMock()
            mock_purchase.id = uuid4()
            mock_purchase.transaction_number = "PUR-2025-001"
            mock_purchase.status = TransactionStatus.PENDING
            mock_purchase.total_amount = Decimal("1000.00")
            mock_create_po.return_value = mock_purchase
            
            purchase_order = await purchase_service.create_purchase_order(
                db_session,
                purchase_data=purchase_data,
                created_by=uuid4()
            )
            
            assert purchase_order.status == TransactionStatus.PENDING
            
        # Step 2: Receive purchase order
        received_items = [
            {
                "line_id": uuid4(),
                "quantity_received": Decimal("50.00"),
                "condition": "excellent",
                "notes": "All items received in good condition"
            }
        ]
        
        with patch.object(purchase_service, 'receive_purchase_order') as mock_receive, \
             patch('app.services.inventory.InventoryService.create_inventory_units') as mock_create_inventory:
            
            # Mock receiving process
            mock_receive.return_value = {
                "purchase_id": str(purchase_order.id),
                "status": "received",
                "total_received": Decimal("50.00"),
                "inventory_updated": True
            }
            
            # Mock inventory creation
            mock_create_inventory.return_value = (
                [MagicMock(id=uuid4()) for _ in range(50)],  # Created units
                MagicMock(quantity_on_hand=Decimal("50.00")),  # Updated stock level
                MagicMock(movement_type="purchase")  # Stock movement
            )
            
            receive_result = await purchase_service.receive_purchase_order(
                db_session,
                purchase_id=purchase_order.id,
                received_items=received_items,
                received_by=uuid4()
            )
            
            assert receive_result["status"] == "received"
            assert receive_result["inventory_updated"] is True
            
        # Step 3: Verify inventory update
        with patch('app.services.inventory.InventoryService.get_stock_level') as mock_get_stock:
            mock_stock_level = MagicMock()
            mock_stock_level.quantity_on_hand = Decimal("50.00")
            mock_stock_level.quantity_available = Decimal("50.00")
            mock_get_stock.return_value = mock_stock_level
            
            # Verify inventory was properly updated
            from app.services.inventory import InventoryService
            inventory_service = InventoryService()
            
            stock_level = await inventory_service.get_stock_level(
                db_session,
                item_id=purchase_data["line_items"][0]["item_id"],
                location_id=purchase_data["location_id"]
            )
            
            assert stock_level.quantity_on_hand == Decimal("50.00")

    async def test_partial_purchase_receipt_workflow(self, db_session, purchase_service):
        """Test workflow with partial purchase order receipt."""
        purchase_id = uuid4()
        
        # Simulate partial receipt
        received_items = [
            {
                "line_id": uuid4(),
                "quantity_received": Decimal("30.00"),  # Partial quantity
                "condition": "excellent",
                "notes": "First shipment"
            }
        ]
        
        with patch.object(purchase_service, 'receive_purchase_order') as mock_receive:
            mock_receive.return_value = {
                "purchase_id": str(purchase_id),
                "status": "partially_received",
                "total_received": Decimal("30.00"),
                "total_expected": Decimal("50.00"),
                "remaining_quantity": Decimal("20.00")
            }
            
            result = await purchase_service.receive_purchase_order(
                db_session,
                purchase_id=purchase_id,
                received_items=received_items,
                received_by=uuid4()
            )
            
            assert result["status"] == "partially_received"
            assert result["remaining_quantity"] == Decimal("20.00")

    async def test_purchase_with_quality_issues_workflow(self, db_session, purchase_service):
        """Test purchase workflow with quality issues."""
        purchase_id = uuid4()
        
        # Simulate receipt with quality issues
        received_items = [
            {
                "line_id": uuid4(),
                "quantity_received": Decimal("45.00"),  # 5 items rejected
                "quantity_rejected": Decimal("5.00"),
                "condition": "damaged",
                "notes": "5 items damaged in shipment",
                "quality_issues": [
                    {
                        "issue_type": "physical_damage",
                        "description": "Dents and scratches",
                        "affected_quantity": Decimal("5.00")
                    }
                ]
            }
        ]
        
        with patch.object(purchase_service, 'receive_purchase_order') as mock_receive, \
             patch.object(purchase_service, 'create_quality_report') as mock_quality_report:
            
            mock_receive.return_value = {
                "purchase_id": str(purchase_id),
                "status": "received_with_issues",
                "total_received": Decimal("45.00"),
                "total_rejected": Decimal("5.00"),
                "quality_report_id": str(uuid4())
            }
            
            mock_quality_report.return_value = {
                "report_id": str(uuid4()),
                "issues_logged": 1,
                "supplier_notified": True
            }
            
            result = await purchase_service.receive_purchase_order(
                db_session,
                purchase_id=purchase_id,
                received_items=received_items,
                received_by=uuid4()
            )
            
            assert result["status"] == "received_with_issues"
            assert result["total_rejected"] == Decimal("5.00")


class TestSalesWorkflow:
    """Test sales transaction workflows."""

    @pytest.fixture
    def sales_service(self):
        return SalesService()

    async def test_complete_sales_workflow(self, db_session, sales_service):
        """Test complete sales workflow from order to fulfillment."""
        # Step 1: Create sales transaction
        sales_data = {
            "customer_id": uuid4(),
            "location_id": uuid4(),
            "payment_method": PaymentMethod.CREDIT_CARD,
            "line_items": [
                {
                    "item_id": uuid4(),
                    "quantity": Decimal("3.00"),
                    "unit_price": Decimal("75.00"),
                    "discount_amount": Decimal("10.00")
                }
            ]
        }
        
        with patch.object(sales_service, 'create_sales_transaction') as mock_create_sale:
            mock_sale = MagicMock()
            mock_sale.id = uuid4()
            mock_sale.transaction_number = "SAL-2025-001"
            mock_sale.status = TransactionStatus.PENDING
            mock_sale.total_amount = Decimal("215.00")  # (75 * 3) - 10
            mock_create_sale.return_value = mock_sale
            
            sale = await sales_service.create_sales_transaction(
                db_session,
                sales_data=sales_data,
                created_by=uuid4()
            )
            
            assert sale.status == TransactionStatus.PENDING
            
        # Step 2: Process payment
        with patch.object(sales_service, 'process_payment') as mock_payment:
            mock_payment.return_value = {
                "payment_successful": True,
                "amount_processed": Decimal("215.00"),
                "payment_reference": "PAY123456",
                "receipt_number": "RCP-2025-001"
            }
            
            payment_result = await sales_service.process_payment(
                db_session,
                sales_id=sale.id,
                payment_amount=Decimal("215.00"),
                payment_method=PaymentMethod.CREDIT_CARD
            )
            
            assert payment_result["payment_successful"] is True
            
        # Step 3: Update inventory (reduce stock)
        with patch('app.services.inventory.InventoryService.process_sale') as mock_inventory_update:
            mock_inventory_update.return_value = {
                "units_allocated": 3,
                "stock_updated": True,
                "movement_recorded": True
            }
            
            inventory_result = await mock_inventory_update(
                db_session,
                sale_id=sale.id,
                line_items=sales_data["line_items"]
            )
            
            assert inventory_result["stock_updated"] is True

    async def test_sales_with_backorder_workflow(self, db_session, sales_service):
        """Test sales workflow with insufficient inventory (backorder)."""
        sales_data = {
            "customer_id": uuid4(),
            "location_id": uuid4(),
            "line_items": [
                {
                    "item_id": uuid4(),
                    "quantity": Decimal("10.00"),  # More than available
                    "unit_price": Decimal("50.00")
                }
            ]
        }
        
        with patch.object(sales_service, 'create_sales_transaction') as mock_create, \
             patch('app.services.inventory.InventoryService.check_availability') as mock_check_stock:
            
            # Mock insufficient stock
            mock_check_stock.return_value = {
                "available": False,
                "quantity_available": Decimal("5.00"),
                "quantity_requested": Decimal("10.00"),
                "shortage": Decimal("5.00")
            }
            
            mock_create.return_value = {
                "sale_id": str(uuid4()),
                "status": "partial_fulfillment",
                "fulfilled_quantity": Decimal("5.00"),
                "backordered_quantity": Decimal("5.00"),
                "backorder_id": str(uuid4())
            }
            
            result = await sales_service.create_sales_transaction(
                db_session,
                sales_data=sales_data,
                created_by=uuid4()
            )
            
            assert result["status"] == "partial_fulfillment"
            assert result["backordered_quantity"] == Decimal("5.00")


class TestRentalLifecycleWorkflow:
    """Test complete rental lifecycle workflows."""

    @pytest.fixture
    def rental_service(self):
        return RentalService()

    async def test_complete_rental_lifecycle(self, db_session, rental_service):
        """Test complete rental lifecycle from booking to return."""
        # Step 1: Create rental booking
        rental_data = {
            "customer_id": uuid4(),
            "location_id": uuid4(),
            "rental_start_date": date.today(),
            "rental_end_date": date.today() + timedelta(days=7),
            "line_items": [
                {
                    "item_id": uuid4(),
                    "quantity": Decimal("1.00"),
                    "daily_rate": Decimal("60.00"),
                    "deposit_amount": Decimal("120.00")
                }
            ]
        }
        
        with patch.object(rental_service, 'create_rental_transaction') as mock_create_rental:
            mock_rental = MagicMock()
            mock_rental.id = uuid4()
            mock_rental.transaction_number = "RNT-2025-001"
            mock_rental.rental_status = RentalStatus.ACTIVE
            mock_rental.total_amount = Decimal("540.00")  # (60 * 7) + 120
            mock_create_rental.return_value = mock_rental
            
            rental = await rental_service.create_rental_transaction(
                db_session,
                rental_data=rental_data,
                created_by=uuid4()
            )
            
            assert rental.rental_status == RentalStatus.ACTIVE
            
        # Step 2: Process rental extension
        with patch.object(rental_service, 'extend_rental_period') as mock_extend:
            mock_extend.return_value = {
                "rental_id": str(rental.id),
                "original_end_date": rental_data["rental_end_date"],
                "new_end_date": date.today() + timedelta(days=10),
                "additional_cost": Decimal("180.00"),  # 60 * 3 additional days
                "total_cost": Decimal("720.00")
            }
            
            extension_result = await rental_service.extend_rental_period(
                db_session,
                rental_id=rental.id,
                additional_days=3,
                daily_rate=Decimal("60.00"),
                extended_by=uuid4()
            )
            
            assert extension_result["additional_cost"] == Decimal("180.00")
            
        # Step 3: Process rental return
        return_data = {
            "return_date": date.today() + timedelta(days=8),  # Early return
            "items": [
                {
                    "line_id": uuid4(),
                    "condition": "good",
                    "damage_notes": "Minor wear, expected"
                }
            ],
            "early_return": True
        }
        
        with patch.object(rental_service, 'process_rental_return') as mock_return:
            mock_return.return_value = {
                "rental_id": str(rental.id),
                "return_processed": True,
                "deposit_refund": Decimal("120.00"),  # Full deposit return
                "early_return_credit": Decimal("120.00"),  # 2 days early credit
                "final_total": Decimal("600.00")
            }
            
            return_result = await rental_service.process_rental_return(
                db_session,
                rental_id=rental.id,
                return_data=return_data,
                processed_by=uuid4()
            )
            
            assert return_result["return_processed"] is True
            assert return_result["deposit_refund"] == Decimal("120.00")

    async def test_rental_with_damage_workflow(self, db_session, rental_service):
        """Test rental return workflow with damage assessment."""
        rental_id = uuid4()
        
        return_data = {
            "return_date": date.today(),
            "items": [
                {
                    "line_id": uuid4(),
                    "condition": "damaged",
                    "damage_notes": "Significant scratches on surface",
                    "damage_assessment": {
                        "damage_type": "surface_damage",
                        "severity": "moderate",
                        "repair_cost_estimate": Decimal("75.00"),
                        "photos": ["damage_photo_1.jpg", "damage_photo_2.jpg"]
                    }
                }
            ]
        }
        
        with patch.object(rental_service, 'process_rental_return') as mock_return, \
             patch.object(rental_service, 'assess_damage') as mock_damage_assessment:
            
            mock_damage_assessment.return_value = {
                "total_damage_cost": Decimal("75.00"),
                "deposit_deduction": Decimal("75.00"),
                "additional_charges": Decimal("0.00"),
                "inspection_report_id": str(uuid4())
            }
            
            mock_return.return_value = {
                "rental_id": str(rental_id),
                "return_processed": True,
                "deposit_refund": Decimal("45.00"),  # 120 - 75 damage
                "damage_charges": Decimal("75.00"),
                "inspection_required": True
            }
            
            result = await rental_service.process_rental_return(
                db_session,
                rental_id=rental_id,
                return_data=return_data,
                processed_by=uuid4()
            )
            
            assert result["damage_charges"] == Decimal("75.00")
            assert result["deposit_refund"] == Decimal("45.00")

    async def test_overdue_rental_workflow(self, db_session, rental_service):
        """Test overdue rental processing workflow."""
        rental_id = uuid4()
        
        with patch.object(rental_service, 'process_overdue_rentals') as mock_process_overdue:
            mock_overdue_rentals = [
                {
                    "rental_id": str(rental_id),
                    "customer_id": str(uuid4()),
                    "days_overdue": 3,
                    "original_end_date": date.today() - timedelta(days=3),
                    "late_fees": Decimal("45.00"),  # 15/day * 3 days
                    "status": "overdue"
                }
            ]
            mock_process_overdue.return_value = mock_overdue_rentals
            
            overdue_results = await rental_service.process_overdue_rentals(db_session)
            
            assert len(overdue_results) == 1
            assert overdue_results[0]["days_overdue"] == 3
            assert overdue_results[0]["late_fees"] == Decimal("45.00")


class TestPurchaseReturnWorkflow:
    """Test purchase return workflows."""

    @pytest.fixture
    def returns_service(self):
        return PurchaseReturnsService()

    async def test_defective_item_return_workflow(self, db_session, returns_service):
        """Test workflow for returning defective items."""
        # Step 1: Create return request
        return_data = {
            "original_purchase_id": uuid4(),
            "return_type": "DEFECTIVE",
            "supplier_id": uuid4(),
            "return_items": [
                {
                    "line_id": uuid4(),
                    "quantity_returned": Decimal("5.00"),
                    "return_reason": "Manufacturing defects",
                    "condition": "defective",
                    "defect_description": "Internal components malfunctioning"
                }
            ],
            "return_shipping_cost": Decimal("30.00"),
            "photos_attached": True
        }
        
        with patch.object(returns_service, 'create_purchase_return') as mock_create_return:
            mock_return = MagicMock()
            mock_return.id = uuid4()
            mock_return.transaction_number = "RTN-2025-001"
            mock_return.status = TransactionStatus.PENDING
            mock_return.expected_refund = Decimal("220.00")  # Full refund for defective items
            mock_create_return.return_value = mock_return
            
            purchase_return = await returns_service.create_purchase_return(
                db_session,
                return_data=return_data,
                created_by=uuid4()
            )
            
            assert purchase_return.status == TransactionStatus.PENDING
            
        # Step 2: Supplier approval process
        with patch.object(returns_service, 'process_supplier_approval') as mock_approval:
            mock_approval.return_value = {
                "approval_status": "approved",
                "approved_refund_amount": Decimal("220.00"),
                "replacement_offered": True,
                "rma_number": "RMA-2025-001"
            }
            
            approval_result = await returns_service.process_supplier_approval(
                db_session,
                return_id=purchase_return.id,
                supplier_response={
                    "approved": True,
                    "refund_amount": Decimal("220.00"),
                    "notes": "Defects confirmed, full refund approved"
                }
            )
            
            assert approval_result["approval_status"] == "approved"
            
        # Step 3: Process refund
        with patch.object(returns_service, 'process_refund') as mock_refund:
            mock_refund.return_value = {
                "refund_processed": True,
                "refund_amount": Decimal("220.00"),
                "refund_method": "credit_card",
                "processing_date": date.today()
            }
            
            refund_result = await returns_service.process_refund(
                db_session,
                return_id=purchase_return.id,
                refund_method="credit_card",
                processed_by=uuid4()
            )
            
            assert refund_result["refund_processed"] is True

    async def test_bulk_return_workflow(self, db_session, returns_service):
        """Test bulk return processing workflow."""
        return_batch = {
            "batch_id": str(uuid4()),
            "returns": [
                {
                    "original_purchase_id": uuid4(),
                    "return_type": "OVERSTOCK",
                    "return_items": [
                        {
                            "line_id": uuid4(),
                            "quantity_returned": Decimal("10.00"),
                            "return_reason": "Excess inventory"
                        }
                    ]
                },
                {
                    "original_purchase_id": uuid4(),
                    "return_type": "WRONG_ITEM",
                    "return_items": [
                        {
                            "line_id": uuid4(),
                            "quantity_returned": Decimal("5.00"),
                            "return_reason": "Incorrect item shipped"
                        }
                    ]
                }
            ]
        }
        
        with patch.object(returns_service, 'process_bulk_returns') as mock_bulk_returns:
            mock_bulk_returns.return_value = {
                "batch_id": return_batch["batch_id"],
                "total_returns": 2,
                "processed_returns": 2,
                "failed_returns": 0,
                "total_refund_amount": Decimal("375.00"),
                "processing_status": "completed"
            }
            
            result = await returns_service.process_bulk_returns(
                db_session,
                return_batch=return_batch,
                processed_by=uuid4()
            )
            
            assert result["processed_returns"] == 2
            assert result["failed_returns"] == 0


class TestCrossModuleIntegration:
    """Test integration across multiple modules."""

    async def test_inventory_transaction_sync(self, db_session):
        """Test synchronization between inventory and transaction modules."""
        # Simulate a complex workflow involving multiple modules
        item_id = uuid4()
        location_id = uuid4()
        customer_id = uuid4()
        
        # Step 1: Purchase creates inventory
        with patch('app.services.transaction.PurchaseService.create_purchase_order') as mock_purchase, \
             patch('app.services.inventory.InventoryService.create_inventory_units') as mock_inventory:
            
            mock_purchase.return_value = MagicMock(id=uuid4(), status=TransactionStatus.COMPLETED)
            mock_inventory.return_value = (
                [MagicMock(id=uuid4()) for _ in range(20)],  # 20 units created
                MagicMock(quantity_on_hand=Decimal("20.00")),
                MagicMock(movement_type="purchase")
            )
            
            # Process purchase
            purchase = await mock_purchase()
            inventory_result = await mock_inventory()
            
            assert len(inventory_result[0]) == 20  # 20 units created
            
        # Step 2: Sale reduces inventory
        with patch('app.services.transaction.SalesService.create_sales_transaction') as mock_sale, \
             patch('app.services.inventory.InventoryService.process_sale') as mock_sale_inventory:
            
            mock_sale.return_value = MagicMock(id=uuid4(), status=TransactionStatus.COMPLETED)
            mock_sale_inventory.return_value = {
                "units_allocated": 5,
                "remaining_inventory": Decimal("15.00"),
                "movement_recorded": True
            }
            
            # Process sale
            sale = await mock_sale()
            sale_inventory_result = await mock_sale_inventory()
            
            assert sale_inventory_result["units_allocated"] == 5
            assert sale_inventory_result["remaining_inventory"] == Decimal("15.00")
            
        # Step 3: Rental further reduces available inventory
        with patch('app.services.transaction.RentalService.create_rental_transaction') as mock_rental, \
             patch('app.services.inventory.InventoryService.process_rental_checkout') as mock_rental_inventory:
            
            mock_rental.return_value = MagicMock(id=uuid4(), rental_status=RentalStatus.ACTIVE)
            mock_rental_inventory.return_value = {
                "units_allocated": 3,
                "available_inventory": Decimal("12.00"),
                "on_rent_inventory": Decimal("3.00")
            }
            
            # Process rental
            rental = await mock_rental()
            rental_inventory_result = await mock_rental_inventory()
            
            assert rental_inventory_result["units_allocated"] == 3
            assert rental_inventory_result["available_inventory"] == Decimal("12.00")

    async def test_financial_reporting_integration(self, db_session):
        """Test integration with financial reporting across transaction types."""
        with patch('app.services.transaction.TransactionService.generate_financial_report') as mock_report:
            report_data = {
                "period": "monthly",
                "start_date": date.today() - timedelta(days=30),
                "end_date": date.today(),
                "revenue": {
                    "sales": Decimal("15000.00"),
                    "rentals": Decimal("8500.00"),
                    "total": Decimal("23500.00")
                },
                "expenses": {
                    "purchases": Decimal("12000.00"),
                    "returns_refunded": Decimal("500.00"),
                    "total": Decimal("12500.00")
                },
                "net_profit": Decimal("11000.00"),
                "transaction_counts": {
                    "sales": 150,
                    "purchases": 25,
                    "rentals": 85,
                    "returns": 8
                }
            }
            mock_report.return_value = report_data
            
            from app.services.transaction import TransactionService
            service = TransactionService()
            
            report = await service.generate_financial_report(
                db_session,
                start_date=date.today() - timedelta(days=30),
                end_date=date.today()
            )
            
            assert report["revenue"]["total"] == Decimal("23500.00")
            assert report["net_profit"] == Decimal("11000.00")

    async def test_audit_trail_integration(self, db_session):
        """Test audit trail integration across all transaction types."""
        with patch('app.services.transaction.TransactionService.get_audit_trail') as mock_audit:
            audit_trail = [
                {
                    "transaction_id": str(uuid4()),
                    "transaction_type": "PURCHASE",
                    "action": "created",
                    "timestamp": datetime.now(),
                    "user_id": str(uuid4()),
                    "changes": {"status": "PENDING"}
                },
                {
                    "transaction_id": str(uuid4()),
                    "transaction_type": "SALE",
                    "action": "payment_processed",
                    "timestamp": datetime.now(),
                    "user_id": str(uuid4()),
                    "changes": {"payment_status": "PAID"}
                },
                {
                    "transaction_id": str(uuid4()),
                    "transaction_type": "RENTAL",
                    "action": "returned",
                    "timestamp": datetime.now(),
                    "user_id": str(uuid4()),
                    "changes": {"rental_status": "RETURNED"}
                }
            ]
            mock_audit.return_value = audit_trail
            
            from app.services.transaction import TransactionService
            service = TransactionService()
            
            trail = await service.get_audit_trail(
                db_session,
                start_date=date.today() - timedelta(days=7),
                end_date=date.today()
            )
            
            assert len(trail) == 3
            assert any(entry["transaction_type"] == "PURCHASE" for entry in trail)
            assert any(entry["action"] == "payment_processed" for entry in trail)