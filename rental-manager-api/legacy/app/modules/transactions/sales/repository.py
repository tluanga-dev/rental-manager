"""
Sales repository for database operations.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_, or_, text
from sqlalchemy.orm import selectinload, joinedload

from app.modules.transactions.base.models import TransactionHeader, TransactionLine
from app.modules.transactions.base.models.transaction_headers import TransactionType, TransactionStatus, PaymentStatus
from app.modules.customers.models import Customer
from app.modules.master_data.locations.models import Location
from app.modules.master_data.item_master.models import Item, ItemStatus
from app.modules.master_data.categories.models import Category
from app.modules.master_data.brands.models import Brand
from app.modules.master_data.units.models import UnitOfMeasurement
from app.modules.users.models import User
from app.modules.inventory.models import StockLevel, StockMovement
from .schemas import SaleFilters


class SalesRepository:
    """Repository for sales transaction operations"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create_sale_transaction(
        self,
        customer_id: UUID,
        transaction_data: Dict[str, Any],
        items_data: List[Dict[str, Any]]
    ) -> TransactionHeader:
        """
        Create a new sale transaction with line items
        """
        # Create the transaction header
        transaction = TransactionHeader(
            transaction_type=TransactionType.SALE,
            customer_id=customer_id,
            **transaction_data
        )
        
        self.session.add(transaction)
        await self.session.flush()  # Get the transaction ID
        
        # Create transaction line items
        for line_number, item_data in enumerate(items_data, 1):
            line_item = TransactionLine(
                transaction_header_id=transaction.id,
                line_number=line_number,
                line_type="PRODUCT",
                **item_data
            )
            self.session.add(line_item)
        
        await self.session.commit()
        await self.session.refresh(transaction)
        
        return transaction
    
    async def get_sale_by_id(self, transaction_id: UUID) -> Optional[TransactionHeader]:
        """Get a sale transaction by ID"""
        stmt = (
            select(TransactionHeader)
            .options(
                selectinload(TransactionHeader.transaction_lines),
                joinedload(TransactionHeader.customer)
            )
            .where(
                and_(
                    TransactionHeader.id == transaction_id,
                    TransactionHeader.transaction_type == TransactionType.SALE
                )
            )
        )
        
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def get_sale_by_number(self, transaction_number: str) -> Optional[TransactionHeader]:
        """Get a sale transaction by transaction number"""
        stmt = (
            select(TransactionHeader)
            .options(
                selectinload(TransactionHeader.transaction_lines),
                joinedload(TransactionHeader.customer)
            )
            .where(
                and_(
                    TransactionHeader.transaction_number == transaction_number,
                    TransactionHeader.transaction_type == TransactionType.SALE
                )
            )
        )
        
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def list_sales(self, filters: SaleFilters) -> tuple[List[TransactionHeader], int]:
        """
        List sales transactions with filtering and pagination
        """
        # Base query
        stmt = (
            select(TransactionHeader)
            .options(joinedload(TransactionHeader.customer))
            .where(TransactionHeader.transaction_type == TransactionType.SALE)
        )
        
        # Apply filters
        conditions = []
        
        if filters.customer_id:
            conditions.append(TransactionHeader.customer_id == filters.customer_id)
        
        if filters.location_id:
            conditions.append(TransactionHeader.location_id == str(filters.location_id))
        
        if filters.sales_person_id:
            conditions.append(TransactionHeader.sales_person_id == filters.sales_person_id)
        
        if filters.status:
            conditions.append(TransactionHeader.status == filters.status)
        
        if filters.payment_status:
            conditions.append(TransactionHeader.payment_status == filters.payment_status)
        
        if filters.date_from:
            conditions.append(TransactionHeader.transaction_date >= filters.date_from)
        
        if filters.date_to:
            end_of_day = datetime.combine(filters.date_to, datetime.max.time())
            conditions.append(TransactionHeader.transaction_date <= end_of_day)
        
        if filters.search:
            search_conditions = [
                TransactionHeader.transaction_number.ilike(f"%{filters.search}%"),
                TransactionHeader.reference_number.ilike(f"%{filters.search}%"),
                TransactionHeader.notes.ilike(f"%{filters.search}%")
            ]
            conditions.append(or_(*search_conditions))
        
        if conditions:
            stmt = stmt.where(and_(*conditions))
        
        # Count total records
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await self.session.execute(count_stmt)
        total = total_result.scalar()
        
        # Apply pagination and ordering
        stmt = (
            stmt
            .order_by(desc(TransactionHeader.transaction_date))
            .offset(filters.skip)
            .limit(filters.limit)
        )
        
        result = await self.session.execute(stmt)
        transactions = result.scalars().all()
        
        return list(transactions), total
    
    async def update_sale_status(
        self, 
        transaction_id: UUID, 
        status: TransactionStatus,
        notes: Optional[str] = None
    ) -> Optional[TransactionHeader]:
        """Update sale transaction status"""
        transaction = await self.get_sale_by_id(transaction_id)
        if not transaction:
            return None
        
        transaction.status = status
        if notes:
            transaction.notes = f"{transaction.notes or ''}\n{notes}".strip()
        
        await self.session.commit()
        await self.session.refresh(transaction)
        
        return transaction
    
    async def process_refund(
        self,
        transaction_id: UUID,
        refund_amount: Optional[Decimal] = None,
        reason: str = ""
    ) -> Optional[TransactionHeader]:
        """Process refund for a sale transaction"""
        transaction = await self.get_sale_by_id(transaction_id)
        if not transaction:
            return None
        
        # If no refund amount specified, refund the full paid amount
        if refund_amount is None:
            refund_amount = transaction.paid_amount
        
        # Update payment status
        if refund_amount >= transaction.paid_amount:
            transaction.payment_status = PaymentStatus.REFUNDED
            transaction.paid_amount = Decimal("0.00")
        else:
            transaction.payment_status = PaymentStatus.PARTIAL
            transaction.paid_amount -= refund_amount
        
        # Update balance due
        transaction.balance_due = transaction.total_amount - transaction.paid_amount
        
        # Add refund note
        refund_note = f"Refund processed: {refund_amount} - {reason}"
        transaction.notes = f"{transaction.notes or ''}\n{refund_note}".strip()
        
        await self.session.commit()
        await self.session.refresh(transaction)
        
        return transaction
    
    async def get_sales_stats(
        self,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None
    ) -> Dict[str, Any]:
        """Get sales statistics"""
        base_query = (
            select(TransactionHeader)
            .where(
                and_(
                    TransactionHeader.transaction_type == TransactionType.SALE,
                    TransactionHeader.status == TransactionStatus.COMPLETED,
                    TransactionHeader.payment_status.in_([PaymentStatus.PAID, PaymentStatus.PARTIAL])
                )
            )
        )
        
        # Apply date filters if provided
        if date_from:
            base_query = base_query.where(TransactionHeader.transaction_date >= date_from)
        if date_to:
            end_of_day = datetime.combine(date_to, datetime.max.time())
            base_query = base_query.where(TransactionHeader.transaction_date <= end_of_day)
        
        # Total sales and transaction count
        stats_stmt = (
            select(
                func.sum(TransactionHeader.total_amount).label("total_sales"),
                func.count(TransactionHeader.id).label("total_transactions"),
                func.avg(TransactionHeader.total_amount).label("average_sale_amount")
            )
            .select_from(base_query.subquery())
        )
        
        stats_result = await self.session.execute(stats_stmt)
        stats_row = stats_result.first()
        
        # Today's sales
        today = date.today()
        today_start = datetime.combine(today, datetime.min.time())
        today_end = datetime.combine(today, datetime.max.time())
        
        today_stmt = (
            select(func.sum(TransactionHeader.total_amount))
            .where(
                and_(
                    TransactionHeader.transaction_type == TransactionType.SALE,
                    TransactionHeader.status == TransactionStatus.COMPLETED,
                    TransactionHeader.transaction_date >= today_start,
                    TransactionHeader.transaction_date <= today_end
                )
            )
        )
        
        today_result = await self.session.execute(today_stmt)
        today_sales = today_result.scalar() or Decimal("0.00")
        
        # This month's sales
        month_start = today.replace(day=1)
        month_stmt = (
            select(func.sum(TransactionHeader.total_amount))
            .where(
                and_(
                    TransactionHeader.transaction_type == TransactionType.SALE,
                    TransactionHeader.status == TransactionStatus.COMPLETED,
                    TransactionHeader.transaction_date >= month_start
                )
            )
        )
        
        month_result = await self.session.execute(month_stmt)
        monthly_sales = month_result.scalar() or Decimal("0.00")
        
        return {
            "today_sales": float(today_sales),
            "monthly_sales": float(monthly_sales),
            "total_sales": float(stats_row.total_sales or 0),
            "total_transactions": stats_row.total_transactions or 0,
            "average_sale_amount": float(stats_row.average_sale_amount or 0)
        }
    
    async def get_recent_sales(self, limit: int = 10) -> List[TransactionHeader]:
        """Get recent sales transactions"""
        stmt = (
            select(TransactionHeader)
            .options(joinedload(TransactionHeader.customer))
            .where(TransactionHeader.transaction_type == TransactionType.SALE)
            .order_by(desc(TransactionHeader.transaction_date))
            .limit(limit)
        )
        
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
    
    async def get_top_selling_items(
        self,
        limit: int = 10,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        """Get top selling items"""
        # Build the query for top selling items
        stmt = (
            select(
                Item.id,
                Item.item_name,
                Item.sku,
                func.sum(TransactionLine.quantity).label("total_quantity"),
                func.sum(TransactionLine.line_total).label("total_revenue"),
                func.count(func.distinct(TransactionLine.transaction_header_id)).label("transaction_count")
            )
            .join(TransactionLine, Item.id == func.cast(TransactionLine.item_id, text("UUID")))
            .join(TransactionHeader, TransactionLine.transaction_header_id == TransactionHeader.id)
            .where(
                and_(
                    TransactionHeader.transaction_type == TransactionType.SALE,
                    TransactionHeader.status == TransactionStatus.COMPLETED
                )
            )
            .group_by(Item.id, Item.item_name, Item.sku)
            .order_by(desc("total_quantity"))
            .limit(limit)
        )
        
        # Apply date filters if provided
        if date_from:
            stmt = stmt.where(TransactionHeader.transaction_date >= date_from)
        if date_to:
            end_of_day = datetime.combine(date_to, datetime.max.time())
            stmt = stmt.where(TransactionHeader.transaction_date <= end_of_day)
        
        result = await self.session.execute(stmt)
        items = result.fetchall()
        
        return [
            {
                "item_id": str(item.id),
                "item_name": item.item_name,
                "sku": item.sku,
                "quantity_sold": item.total_quantity,
                "revenue": float(item.total_revenue),
                "transaction_count": item.transaction_count
            }
            for item in items
        ]
    
    async def check_item_availability(self, item_id: UUID, quantity: int, location_id: Optional[UUID] = None) -> Dict[str, Any]:
        """Check if item is available for sale"""
        # Query stock levels for the item
        stmt = select(StockLevel).where(StockLevel.item_id == str(item_id))
        
        if location_id:
            stmt = stmt.where(StockLevel.location_id == str(location_id))
        
        result = await self.session.execute(stmt)
        stock_records = result.scalars().all()
        
        total_available = sum(stock.quantity_available for stock in stock_records)
        
        return {
            "item_id": str(item_id),
            "requested_quantity": quantity,
            "available_stock": total_available,
            "is_available": total_available >= quantity,
            "insufficient_stock": total_available < quantity
        }
    
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
    ) -> Dict[str, Any]:
        """
        Get saleable items with filters and stock information
        
        Returns:
            Dictionary with items and total count
        """
        # Subquery to get aggregated stock levels per item
        stock_subquery = (
            select(
                StockLevel.item_id,
                func.sum(StockLevel.quantity_available).label("total_available")
            )
            .group_by(StockLevel.item_id)
        )
        
        # Add location filter if specified
        if location_id:
            stock_subquery = stock_subquery.where(StockLevel.location_id == location_id)
        
        stock_subquery = stock_subquery.subquery()
        
        # Base query for saleable items with stock information
        query = (
            select(
                Item.id,
                Item.item_name,
                Item.sku,
                Item.sale_price,
                Item.purchase_price,
                Item.is_saleable,
                Item.item_status,
                Item.model_number,
                Item.description,
                Item.specifications,
                Item.unit_of_measurement_id,
                Category.id.label("category_id"),
                Category.name.label("category_name"),
                Brand.id.label("brand_id"),
                Brand.name.label("brand_name"),
                UnitOfMeasurement.name.label("unit_name"),
                UnitOfMeasurement.code.label("unit_abbreviation"),
                func.coalesce(stock_subquery.c.total_available, 0).label("available_quantity")
            )
            .outerjoin(Category, Item.category_id == Category.id)
            .outerjoin(Brand, Item.brand_id == Brand.id)
            .join(UnitOfMeasurement, Item.unit_of_measurement_id == UnitOfMeasurement.id)
            .outerjoin(stock_subquery, Item.id == stock_subquery.c.item_id)
            .where(
                and_(
                    Item.is_saleable == True,
                    Item.item_status == ItemStatus.ACTIVE,
                    Item.is_active == True
                )
            )
        )
        
        # Apply filters
        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                or_(
                    Item.item_name.ilike(search_pattern),
                    Item.sku.ilike(search_pattern),
                    Item.model_number.ilike(search_pattern)
                )
            )
        
        if category_id:
            query = query.where(Item.category_id == category_id)
        
        if brand_id:
            query = query.where(Item.brand_id == brand_id)
        
        if min_price is not None:
            query = query.where(Item.sale_price >= min_price)
        
        if max_price is not None:
            query = query.where(Item.sale_price <= max_price)
        
        # If in_stock_only is True, filter for items with available stock
        if in_stock_only:
            query = query.where(
                func.coalesce(stock_subquery.c.total_available, 0) > 0
            )
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.session.execute(count_query)
        total = total_result.scalar() or 0
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        
        # Execute query
        result = await self.session.execute(query)
        items = []
        
        for row in result:
            item_dict = {
                "id": row.id,
                "item_name": row.item_name,
                "sku": row.sku,
                "sale_price": row.sale_price,
                "purchase_price": row.purchase_price,
                "tax_rate": Decimal("0.00"),  # Default tax rate, can be enhanced
                "is_saleable": row.is_saleable,
                "item_status": row.item_status,
                "category_id": row.category_id,
                "category_name": row.category_name,
                "brand_id": row.brand_id,
                "brand_name": row.brand_name,
                "unit_of_measurement_id": row.unit_of_measurement_id,
                "unit_name": row.unit_name,
                "unit_abbreviation": row.unit_abbreviation,
                "model_number": row.model_number,
                "description": row.description,
                "specifications": row.specifications,
                "available_quantity": row.available_quantity  # Include stock quantity from query
            }
            items.append(item_dict)
        
        return {
            "items": items,
            "total": total
        }