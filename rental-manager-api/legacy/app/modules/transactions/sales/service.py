"""
Sales service for business logic and orchestration.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.transactions.base.models.transaction_headers import (
    TransactionStatus, 
    PaymentStatus, 
    PaymentMethod
)
from app.modules.inventory.repository import AsyncStockMovementRepository, AsyncStockLevelRepository
from app.modules.inventory.enums import StockMovementType
from app.modules.inventory.models import StockLevel, StockMovement
from .repository import SalesRepository
from .schemas import (
    CreateSaleRequest,
    CreateSaleResponse,
    SaleFilters,
    SaleListResponse,
    SaleTransactionResponse,
    SaleTransactionWithLinesResponse,
    SalesStats,
    SalesDashboardData,
    SalesDashboardResponse,
    UpdateSaleStatusRequest,
    ProcessRefundRequest,
    SaleValidationResult,
    SaleableItemResponse,
    SaleableItemsListResponse
)


class SalesService:
    """Service for sales business logic"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.sales_repo = SalesRepository(session)
        self.stock_movement_repo = AsyncStockMovementRepository(session)
        self.stock_level_repo = AsyncStockLevelRepository(session)
    
    async def create_sale(self, request: CreateSaleRequest, created_by: Optional[UUID] = None) -> CreateSaleResponse:
        """
        Create a new sale transaction with inventory integration
        """
        # Validate the sale request
        validation = await self._validate_sale_request(request)
        if not validation.is_valid:
            raise ValueError(f"Sale validation failed: {', '.join(validation.errors)}")
        
        # Update prices from inventory units if not explicitly provided
        await self._update_prices_from_inventory(request)
        
        # Calculate totals
        totals = self._calculate_sale_totals(request.items)
        
        # Generate transaction number following the Purchase pattern
        transaction_number = await self._generate_transaction_number()
        
        # Prepare transaction data
        transaction_data = {
            "transaction_number": transaction_number,
            "transaction_date": request.transaction_date or datetime.utcnow(),
            "status": TransactionStatus.COMPLETED,  # Sales are typically completed immediately
            "payment_status": request.payment_status or PaymentStatus.PENDING,
            "payment_method": request.payment_method,
            "location_id": str(request.location_id) if request.location_id else None,
            "sales_person_id": request.sales_person_id,
            "currency": "INR",  # Default currency
            "subtotal": totals["subtotal"],
            "discount_amount": request.custom_discount or totals["total_discount"],
            "tax_amount": request.custom_tax or totals["total_tax"],
            "shipping_amount": Decimal("0.00"),
            "total_amount": totals["grand_total"],
            "paid_amount": totals["grand_total"] if request.payment_status == PaymentStatus.PAID else Decimal("0.00"),
            "notes": request.notes,
            "reference_number": request.reference_number,
            "created_by": created_by,
            "updated_by": created_by
        }
        
        # Prepare items data
        items_data = []
        for item_req in request.items:
            line_subtotal = item_req.unit_price * item_req.quantity
            tax_amount = line_subtotal * (item_req.tax_rate or Decimal("0.00")) / 100
            line_total = line_subtotal + tax_amount - (item_req.discount_amount or Decimal("0.00"))
            
            items_data.append({
                "item_id": str(item_req.item_id),
                "quantity": item_req.quantity,
                "unit_price": item_req.unit_price,
                "tax_rate": item_req.tax_rate or Decimal("0.00"),
                "tax_amount": tax_amount,
                "discount_amount": item_req.discount_amount or Decimal("0.00"),
                "line_subtotal": line_subtotal,
                "line_total": line_total,
                "notes": item_req.notes
            })
        
        # Create the transaction
        transaction = await self.sales_repo.create_sale_transaction(
            customer_id=request.customer_id,
            transaction_data=transaction_data,
            items_data=items_data
        )
        
        # Process inventory movements for each item
        for idx, item_req in enumerate(request.items, start=1):
            # Get the corresponding transaction line
            transaction_line = transaction.transaction_lines[idx - 1] if transaction.transaction_lines else None
            
            await self._update_stock_for_sale(
                item_id=item_req.item_id,
                location_id=UUID(transaction.location_id) if transaction.location_id else None,
                quantity=Decimal(str(item_req.quantity)),
                transaction_id=transaction.id,
                transaction_line_id=transaction_line.id if transaction_line else None
            )
        
        # Get the complete transaction with lines for response
        complete_transaction = await self.sales_repo.get_sale_by_id(transaction.id)
        
        return CreateSaleResponse(
            transaction_id=transaction.id,
            transaction_number=transaction.transaction_number,
            data=await self._format_transaction_with_lines_response(complete_transaction)
        )
    
    async def get_sale_by_id(self, transaction_id: UUID) -> Optional[SaleTransactionWithLinesResponse]:
        """Get a sale transaction by ID"""
        transaction = await self.sales_repo.get_sale_by_id(transaction_id)
        if not transaction:
            return None
        
        return await self._format_transaction_with_lines_response(transaction)
    
    async def get_sale_by_number(self, transaction_number: str) -> Optional[SaleTransactionWithLinesResponse]:
        """Get a sale transaction by transaction number"""
        transaction = await self.sales_repo.get_sale_by_number(transaction_number)
        if not transaction:
            return None
        
        return await self._format_transaction_with_lines_response(transaction)
    
    async def list_sales(self, filters: SaleFilters) -> SaleListResponse:
        """List sales transactions with filtering"""
        transactions, total = await self.sales_repo.list_sales(filters)
        
        formatted_transactions = []
        for transaction in transactions:
            formatted_transactions.append(await self._format_transaction_response(transaction))
        
        return SaleListResponse(
            data=formatted_transactions,
            total=total,
            skip=filters.skip or 0,
            limit=filters.limit or 100
        )
    
    async def update_sale_status(
        self, 
        transaction_id: UUID, 
        request: UpdateSaleStatusRequest,
        updated_by: Optional[UUID] = None
    ) -> Optional[SaleTransactionResponse]:
        """Update sale transaction status"""
        transaction = await self.sales_repo.update_sale_status(
            transaction_id=transaction_id,
            status=request.status,
            notes=request.notes
        )
        
        if not transaction:
            return None
        
        return await self._format_transaction_response(transaction)
    
    async def process_refund(
        self,
        transaction_id: UUID,
        request: ProcessRefundRequest,
        processed_by: Optional[UUID] = None
    ) -> Optional[SaleTransactionResponse]:
        """Process refund for a sale transaction"""
        transaction = await self.sales_repo.process_refund(
            transaction_id=transaction_id,
            refund_amount=request.refund_amount,
            reason=request.reason
        )
        
        if not transaction:
            return None
        
        # TODO: Process inventory returns if needed
        
        return await self._format_transaction_response(transaction)
    
    async def get_sales_stats(
        self,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None
    ) -> SalesStats:
        """Get sales statistics"""
        stats_data = await self.sales_repo.get_sales_stats(date_from, date_to)
        top_items = await self.sales_repo.get_top_selling_items(10, date_from, date_to)
        
        return SalesStats(
            today_sales=Decimal(str(stats_data["today_sales"])),
            monthly_sales=Decimal(str(stats_data["monthly_sales"])),
            total_transactions=stats_data["total_transactions"],
            average_sale_amount=Decimal(str(stats_data["average_sale_amount"])),
            top_selling_items=top_items
        )
    
    async def get_dashboard_data(self) -> SalesDashboardResponse:
        """Get comprehensive sales dashboard data"""
        # Get stats
        stats = await self.get_sales_stats()
        
        # Get recent sales
        recent_transactions = await self.sales_repo.get_recent_sales(limit=10)
        recent_sales = []
        for transaction in recent_transactions:
            recent_sales.append(await self._format_transaction_response(transaction))
        
        # TODO: Add sales trends data
        
        dashboard_data = SalesDashboardData(
            stats=stats,
            recent_sales=recent_sales,
            sales_trends=[]  # TODO: Implement trends calculation
        )
        
        return SalesDashboardResponse(data=dashboard_data)
    
    async def check_item_availability(self, item_id: UUID, quantity: int, location_id: Optional[UUID] = None) -> Dict[str, Any]:
        """Check if item is available for sale"""
        return await self.sales_repo.check_item_availability(item_id, quantity, location_id)
    
    async def get_saleable_items(
        self,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        category_id: Optional[UUID] = None,
        brand_id: Optional[UUID] = None,
        location_id: Optional[UUID] = None,
        min_price: Optional[Decimal] = None,
        max_price: Optional[Decimal] = None,
        in_stock_only: bool = True
    ) -> SaleableItemsListResponse:
        """
        Get list of saleable items with stock availability information
        
        Args:
            skip: Number of items to skip for pagination
            limit: Maximum number of items to return
            search: Search term for item name, SKU, or model number
            category_id: Filter by category
            brand_id: Filter by brand
            location_id: Filter by location for stock availability
            min_price: Minimum sale price filter
            max_price: Maximum sale price filter
            in_stock_only: Only show items with available stock
        
        Returns:
            Paginated list of saleable items with stock information
        """
        # Get saleable items from repository (now includes stock data)
        items_data = await self.sales_repo.get_saleable_items(
            skip=skip,
            limit=limit,
            search=search,
            category_id=category_id,
            brand_id=brand_id,
            location_id=location_id,
            min_price=min_price,
            max_price=max_price,
            in_stock_only=in_stock_only
        )
        
        # Format response - stock data is now included from repository
        items = []
        for item_row in items_data["items"]:
            # Stock data is now directly available from the repository query
            available_qty = item_row.get("available_quantity", 0)
            
            item_response = SaleableItemResponse(
                id=item_row["id"],
                item_name=item_row["item_name"],
                sku=item_row["sku"],
                sale_price=item_row.get("sale_price"),
                tax_rate=item_row.get("tax_rate", Decimal("0.00")),
                is_saleable=item_row["is_saleable"],
                item_status=item_row["item_status"],
                category_id=item_row.get("category_id"),
                category_name=item_row.get("category_name"),
                brand_id=item_row.get("brand_id"),
                brand_name=item_row.get("brand_name"),
                unit_of_measurement_id=item_row["unit_of_measurement_id"],
                unit_name=item_row["unit_name"],
                unit_abbreviation=item_row["unit_abbreviation"],
                available_quantity=available_qty,
                reserved_quantity=0,  # Can be enhanced later
                total_stock=available_qty,
                model_number=item_row.get("model_number"),
                description=item_row.get("description"),
                specifications=item_row.get("specifications")
            )
            items.append(item_response)
        
        return SaleableItemsListResponse(
            data=items,
            total=items_data["total"],
            skip=skip,
            limit=limit
        )
    
    # Private helper methods
    
    async def _validate_sale_request(self, request: CreateSaleRequest) -> SaleValidationResult:
        """Validate a sale request"""
        errors = []
        warnings = []
        stock_validation = {}
        
        # Validate items and check stock availability
        for item_req in request.items:
            availability = await self.check_item_availability(
                item_req.item_id, 
                item_req.quantity, 
                request.location_id
            )
            
            stock_validation[item_req.item_id] = availability
            
            if not availability["is_available"]:
                errors.append(
                    f"Insufficient stock for item {item_req.item_id}. "
                    f"Requested: {item_req.quantity}, Available: {availability['available_stock']}"
                )
        
        # Validate business rules
        if len(request.items) == 0:
            errors.append("At least one item is required for a sale")
        
        # Check for duplicate items
        item_ids = [item.item_id for item in request.items]
        if len(item_ids) != len(set(item_ids)):
            errors.append("Duplicate items are not allowed in a single sale")
        
        return SaleValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            stock_validation=stock_validation
        )
    
    async def _update_prices_from_inventory(self, request: CreateSaleRequest) -> None:
        """
        Update item prices from inventory units if not explicitly provided.
        This allows batch-specific pricing to be used for sales.
        """
        from sqlalchemy import select, and_
        from app.modules.inventory.models import InventoryUnit
        from app.modules.master_data.item_master.models import Item
        
        for item_req in request.items:
            # If price is already specified in request, skip
            if item_req.unit_price and item_req.unit_price > 0:
                continue
            
            # Try to get pricing from available inventory unit
            inv_unit_query = select(InventoryUnit).where(
                and_(
                    InventoryUnit.item_id == str(item_req.item_id),
                    InventoryUnit.status == "AVAILABLE",
                    InventoryUnit.is_active == True
                )
            )
            
            if request.location_id:
                inv_unit_query = inv_unit_query.where(
                    InventoryUnit.location_id == str(request.location_id)
                )
            
            inv_unit_query = inv_unit_query.limit(1)
            result = await self.session.execute(inv_unit_query)
            inventory_unit = result.scalar_one_or_none()
            
            if inventory_unit and inventory_unit.sale_price:
                item_req.unit_price = inventory_unit.sale_price
            else:
                # Fallback to item master price
                item = await self.session.get(Item, item_req.item_id)
                if item and item.sale_price:
                    item_req.unit_price = item.sale_price
                elif not item_req.unit_price:
                    item_req.unit_price = Decimal("0.00")
    
    def _calculate_sale_totals(self, items: List) -> Dict[str, Decimal]:
        """Calculate totals for a sale"""
        subtotal = Decimal("0.00")
        total_tax = Decimal("0.00")
        total_discount = Decimal("0.00")
        
        for item in items:
            line_subtotal = item.unit_price * item.quantity
            tax_amount = line_subtotal * (item.tax_rate or Decimal("0.00")) / 100
            
            subtotal += line_subtotal
            total_tax += tax_amount
            total_discount += item.discount_amount or Decimal("0.00")
        
        grand_total = subtotal + total_tax - total_discount
        
        return {
            "subtotal": subtotal,
            "total_tax": total_tax,
            "total_discount": total_discount,
            "grand_total": grand_total
        }
    
    
    async def _update_stock_for_sale(
        self,
        *,
        item_id: UUID,
        location_id: Optional[UUID],
        quantity: Decimal,
        transaction_id: UUID,
        transaction_line_id: Optional[UUID] = None,
    ) -> None:
        """
        Update inventory for sale transaction following the Purchase pattern:
        1. Update StockLevel table (decrease quantities for sales)
        2. Create StockMovement entry with proper quantity tracking
        
        This is the opposite of purchase transactions - sales reduce inventory.
        """
        
        print(f"[INVENTORY-UPDATE] Processing stock reduction for sale: item {item_id}, quantity {quantity}")
        
        # ----------------------------------------------------------------
        # 1. UPDATE/CHECK STOCK LEVEL (Requirements adapted for sales)
        # ----------------------------------------------------------------
        print(f"[INVENTORY-UPDATE] Processing stock level for item {item_id} at location {location_id}")
        
        # Check if stock level entry exists for this item_id and location_id
        stock_level = await self.stock_level_repo.get_by_item_location(item_id, location_id)
        
        if not stock_level:
            raise ValueError(f"No stock available for item {item_id} at location {location_id}")
        
        # Store original quantities for StockMovement tracking
        original_on_hand = stock_level.quantity_on_hand
        original_available = stock_level.quantity_available
        
        # Check if we have enough stock available for sale
        if original_available < quantity:
            raise ValueError(
                f"Insufficient stock for item {item_id}. "
                f"Requested: {quantity}, Available: {original_available}"
            )
        
        print(f"[INVENTORY-UPDATE] Current stock level: on_hand={original_on_hand}, available={original_available}")
        
        # Calculate new quantities (decrease for sale - opposite of purchase)
        new_on_hand = original_on_hand - quantity
        new_available = original_available - quantity
        
        # Update stock level with reduced quantities
        await self.stock_level_repo.update(stock_level, {
            "quantity_on_hand": new_on_hand,
            "quantity_available": new_available,
            "updated_by": "system"
        })
        
        print(f"[INVENTORY-UPDATE] ✔ Updated stock level: on_hand {original_on_hand} → {new_on_hand}, available {original_available} → {new_available}")
        
        # ----------------------------------------------------------------
        # 2. CREATE STOCK MOVEMENT ENTRY
        # ----------------------------------------------------------------
        print(f"[INVENTORY-UPDATE] Creating stock movement entry")
        
        # Get quantity_before from latest StockMovement for this item (following purchase pattern)
        quantity_before = await self._get_quantity_before_transaction(item_id, original_available)
        quantity_after = quantity_before - quantity  # Negative change for sales
        
        # Create stock movement record with all required fields
        stock_movement = await self.stock_movement_repo.create({
            "stock_level_id": str(stock_level.id),
            "item_id": str(item_id),
            "location_id": str(location_id) if location_id else stock_level.location_id,
            "movement_type": StockMovementType.SALE,
            "transaction_header_id": str(transaction_id),
            "transaction_line_id": str(transaction_line_id) if transaction_line_id else None,
            "quantity_change": -quantity,  # Negative for outbound sale
            "quantity_before": quantity_before,
            "quantity_after": quantity_after,
            "created_by": "system",
            "updated_by": "system"
        })
        
        print(f"[INVENTORY-UPDATE] ✔ Created stock movement: change={-quantity}, before={quantity_before}, after={quantity_after}")
        print(f"[INVENTORY-UPDATE] ✔ Inventory update completed for sale of item {item_id}")

    async def _get_quantity_before_transaction(self, item_id: UUID, original_quantity_available: Decimal) -> Decimal:
        """
        Determine the quantity before this transaction for StockMovement.quantity_before.
        
        Logic (adapted from Purchase service):
        1. If there are previous StockMovements, use the latest quantity_after
        2. If no previous StockMovements but original stock exists, use original quantity_available
        3. If neither exists, use 0
        
        This provides accurate tracking of stock changes over time.
        """
        from sqlalchemy import select, desc
        
        # First, check for previous StockMovements
        stmt = (
            select(StockMovement.quantity_after)
            .where(StockMovement.item_id == str(item_id))
            .order_by(desc(StockMovement.created_at))
            .limit(1)
        )
        
        result = await self.session.execute(stmt)
        latest_quantity_after = result.scalar_one_or_none()
        
        if latest_quantity_after is not None:
            print(f"[INVENTORY-UPDATE] Found latest stock movement quantity_after: {latest_quantity_after}")
            return Decimal(str(latest_quantity_after))
        elif original_quantity_available > 0:
            # No previous StockMovements, but original stock exists - use original quantity_available
            print(f"[INVENTORY-UPDATE] No previous stock movement found, using original StockLevel quantity_available: {original_quantity_available}")
            return original_quantity_available
        else:
            print(f"[INVENTORY-UPDATE] No previous stock movement or original stock found, using quantity_before = 0")
            return Decimal("0")

    async def _generate_transaction_number(self) -> str:
        """Generate daily sequential SALE-YYYYmmdd-NNNN following Purchase pattern."""
        from datetime import date
        from sqlalchemy import and_, func, select
        from app.modules.transactions.base.models import TransactionHeader
        from app.modules.transactions.base.models.transaction_headers import TransactionType
        
        today_str = date.today().strftime("%Y%m%d")
        start_of_day = datetime.combine(date.today(), datetime.min.time())

        stmt = select(func.count(TransactionHeader.id)).where(
            and_(
                TransactionHeader.transaction_type == TransactionType.SALE,
                TransactionHeader.created_at >= start_of_day,
            )
        )
        res = await self.session.execute(stmt)
        seq = (res.scalar() or 0) + 1
        return f"SALE-{today_str}-{seq:04d}"
    
    async def _format_transaction_response(self, transaction) -> SaleTransactionResponse:
        """Format transaction for response"""
        # TODO: Add proper field mapping from transaction model to response schema
        # This is a simplified version - you'll need to map all fields properly
        
        return SaleTransactionResponse(
            id=transaction.id,
            transaction_number=transaction.transaction_number,
            transaction_type=transaction.transaction_type.value,
            status=transaction.status,
            payment_status=transaction.payment_status,
            payment_method=transaction.payment_method,
            customer_id=transaction.customer_id,
            customer_name=getattr(transaction.customer, 'full_name', 'Unknown') if hasattr(transaction, 'customer') else 'Unknown',
            location_id=UUID(transaction.location_id) if transaction.location_id else None,
            sales_person_id=transaction.sales_person_id,
            transaction_date=transaction.transaction_date,
            due_date=transaction.due_date,
            currency=transaction.currency,
            subtotal=transaction.subtotal,
            discount_amount=transaction.discount_amount,
            tax_amount=transaction.tax_amount,
            shipping_amount=transaction.shipping_amount,
            total_amount=transaction.total_amount,
            paid_amount=transaction.paid_amount,
            balance_due=transaction.balance_due,
            notes=transaction.notes,
            reference_number=transaction.reference_number,
            created_at=transaction.created_at,
            updated_at=transaction.updated_at,
            created_by=transaction.created_by,
            updated_by=transaction.updated_by
        )
    
    async def _format_transaction_with_lines_response(self, transaction) -> SaleTransactionWithLinesResponse:
        """Format transaction with lines for response"""
        base_response = await self._format_transaction_response(transaction)
        
        # Format line items
        items = []
        for line in transaction.transaction_lines:
            items.append({
                "id": line.id,
                "line_number": line.line_number,
                "item_id": UUID(line.item_id),
                "item_name": line.item_name or "Unknown",
                "item_sku": line.item_sku or "",
                "quantity": line.quantity,
                "unit_price": line.unit_price,
                "tax_rate": line.tax_rate,
                "tax_amount": line.tax_amount,
                "discount_amount": line.discount_amount,
                "line_subtotal": line.line_subtotal,
                "line_total": line.line_total,
                "notes": line.notes,
                "created_at": line.created_at
            })
        
        return SaleTransactionWithLinesResponse(
            **base_response.dict(),
            items=items
        )