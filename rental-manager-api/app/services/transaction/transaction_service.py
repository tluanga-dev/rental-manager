"""
Base Transaction Service - Common transaction operations and utilities.
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import date, datetime, timezone
from decimal import Decimal
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_
from sqlalchemy.orm import selectinload

from app.models.transaction import (
    TransactionHeader, TransactionLine, TransactionEvent,
    TransactionType, TransactionStatus, PaymentStatus
)
from app.crud.transaction import (
    TransactionHeaderRepository,
    TransactionLineRepository,
    TransactionEventRepository,
)
from app.schemas.transaction import (
    TransactionHeaderResponse,
    TransactionEventResponse,
)
from app.core.errors import NotFoundError, ValidationError

logger = logging.getLogger(__name__)


class TransactionService:
    """Base service for common transaction operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.transaction_repo = TransactionHeaderRepository(session)
        self.line_repo = TransactionLineRepository(session)
        self.event_repo = TransactionEventRepository(session)
    
    async def list_transactions(
        self,
        transaction_type: Optional[str] = None,
        status: Optional[TransactionStatus] = None,
        payment_status: Optional[PaymentStatus] = None,
        customer_id: Optional[UUID] = None,
        supplier_id: Optional[UUID] = None,
        location_id: Optional[UUID] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[TransactionHeaderResponse]:
        """
        List transactions with comprehensive filters.
        """
        query = select(TransactionHeader).where(TransactionHeader.is_active == True)
        
        # Apply filters
        if transaction_type:
            try:
                tx_type = TransactionType(transaction_type)
                query = query.where(TransactionHeader.transaction_type == tx_type)
            except ValueError:
                raise ValidationError(f"Invalid transaction type: {transaction_type}")
        
        if status:
            query = query.where(TransactionHeader.status == status)
        
        if payment_status:
            query = query.where(TransactionHeader.payment_status == payment_status)
        
        if customer_id:
            query = query.where(TransactionHeader.customer_id == customer_id)
        
        if supplier_id:
            query = query.where(TransactionHeader.supplier_id == supplier_id)
        
        if location_id:
            query = query.where(TransactionHeader.location_id == location_id)
        
        if date_from:
            query = query.where(TransactionHeader.transaction_date >= date_from)
        
        if date_to:
            query = query.where(TransactionHeader.transaction_date <= date_to)
        
        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                or_(
                    TransactionHeader.transaction_number.ilike(search_pattern),
                    TransactionHeader.reference_number.ilike(search_pattern)
                )
            )
        
        # Apply pagination and ordering
        query = query.order_by(TransactionHeader.transaction_date.desc())
        query = query.offset(skip).limit(limit)
        
        # Include relationships
        query = query.options(
            selectinload(TransactionHeader.customer),
            selectinload(TransactionHeader.supplier),
            selectinload(TransactionHeader.location)
        )
        
        result = await self.session.execute(query)
        transactions = result.scalars().all()
        
        return [
            TransactionHeaderResponse.from_orm(tx)
            for tx in transactions
        ]
    
    async def get_transaction(
        self,
        transaction_id: UUID,
        include_lines: bool = True,
        include_events: bool = False
    ) -> TransactionHeaderResponse:
        """
        Get a specific transaction with optional details.
        """
        query = select(TransactionHeader).where(
            and_(
                TransactionHeader.id == transaction_id,
                TransactionHeader.is_active == True
            )
        )
        
        # Include relationships as needed
        if include_lines:
            query = query.options(selectinload(TransactionHeader.lines))
        
        if include_events:
            query = query.options(selectinload(TransactionHeader.events))
        
        query = query.options(
            selectinload(TransactionHeader.customer),
            selectinload(TransactionHeader.supplier),
            selectinload(TransactionHeader.location)
        )
        
        result = await self.session.execute(query)
        transaction = result.scalar_one_or_none()
        
        if not transaction:
            raise NotFoundError(f"Transaction {transaction_id} not found")
        
        return TransactionHeaderResponse.from_orm(transaction)
    
    async def get_transaction_events(
        self,
        transaction_id: UUID,
        event_category: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[TransactionEventResponse]:
        """
        Get event history for a transaction.
        """
        # First check if transaction exists
        transaction = await self.transaction_repo.get_by_id(transaction_id)
        if not transaction:
            raise NotFoundError(f"Transaction {transaction_id} not found")
        
        query = select(TransactionEvent).where(
            TransactionEvent.transaction_id == transaction_id
        )
        
        if event_category:
            query = query.where(TransactionEvent.event_category == event_category)
        
        query = query.order_by(TransactionEvent.event_timestamp.desc())
        query = query.offset(skip).limit(limit)
        
        result = await self.session.execute(query)
        events = result.scalars().all()
        
        return [
            TransactionEventResponse.from_orm(event)
            for event in events
        ]
    
    async def get_transaction_summary(
        self,
        date_from: date,
        date_to: date,
        location_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Generate transaction summary report.
        """
        base_query = select(TransactionHeader).where(
            and_(
                TransactionHeader.is_active == True,
                TransactionHeader.transaction_date >= date_from,
                TransactionHeader.transaction_date <= date_to
            )
        )
        
        if location_id:
            base_query = base_query.where(TransactionHeader.location_id == location_id)
        
        # Get transaction counts by type
        type_counts = {}
        for tx_type in TransactionType:
            count_query = select(func.count(TransactionHeader.id)).where(
                and_(
                    TransactionHeader.is_active == True,
                    TransactionHeader.transaction_date >= date_from,
                    TransactionHeader.transaction_date <= date_to,
                    TransactionHeader.transaction_type == tx_type
                )
            )
            if location_id:
                count_query = count_query.where(TransactionHeader.location_id == location_id)
            
            result = await self.session.execute(count_query)
            type_counts[tx_type.value] = result.scalar() or 0
        
        # Get total amounts by type
        type_amounts = {}
        for tx_type in TransactionType:
            amount_query = select(func.sum(TransactionHeader.total_amount)).where(
                and_(
                    TransactionHeader.is_active == True,
                    TransactionHeader.transaction_date >= date_from,
                    TransactionHeader.transaction_date <= date_to,
                    TransactionHeader.transaction_type == tx_type,
                    TransactionHeader.status == TransactionStatus.COMPLETED
                )
            )
            if location_id:
                amount_query = amount_query.where(TransactionHeader.location_id == location_id)
            
            result = await self.session.execute(amount_query)
            type_amounts[tx_type.value] = float(result.scalar() or 0)
        
        # Get payment status breakdown
        payment_breakdown = {}
        for payment_status in PaymentStatus:
            payment_query = select(func.count(TransactionHeader.id)).where(
                and_(
                    TransactionHeader.is_active == True,
                    TransactionHeader.transaction_date >= date_from,
                    TransactionHeader.transaction_date <= date_to,
                    TransactionHeader.payment_status == payment_status
                )
            )
            if location_id:
                payment_query = payment_query.where(TransactionHeader.location_id == location_id)
            
            result = await self.session.execute(payment_query)
            payment_breakdown[payment_status.value] = result.scalar() or 0
        
        # Get top customers (for sales and rentals)
        customer_query = select(
            TransactionHeader.customer_id,
            func.count(TransactionHeader.id).label("transaction_count"),
            func.sum(TransactionHeader.total_amount).label("total_amount")
        ).where(
            and_(
                TransactionHeader.is_active == True,
                TransactionHeader.transaction_date >= date_from,
                TransactionHeader.transaction_date <= date_to,
                TransactionHeader.transaction_type.in_([
                    TransactionType.SALE,
                    TransactionType.RENTAL
                ]),
                TransactionHeader.customer_id.isnot(None)
            )
        ).group_by(TransactionHeader.customer_id).order_by(
            func.sum(TransactionHeader.total_amount).desc()
        ).limit(10)
        
        if location_id:
            customer_query = customer_query.where(TransactionHeader.location_id == location_id)
        
        result = await self.session.execute(customer_query)
        top_customers = [
            {
                "customer_id": str(row.customer_id),
                "transaction_count": row.transaction_count,
                "total_amount": float(row.total_amount or 0)
            }
            for row in result
        ]
        
        # Get top suppliers (for purchases)
        supplier_query = select(
            TransactionHeader.supplier_id,
            func.count(TransactionHeader.id).label("transaction_count"),
            func.sum(TransactionHeader.total_amount).label("total_amount")
        ).where(
            and_(
                TransactionHeader.is_active == True,
                TransactionHeader.transaction_date >= date_from,
                TransactionHeader.transaction_date <= date_to,
                TransactionHeader.transaction_type == TransactionType.PURCHASE,
                TransactionHeader.supplier_id.isnot(None)
            )
        ).group_by(TransactionHeader.supplier_id).order_by(
            func.sum(TransactionHeader.total_amount).desc()
        ).limit(10)
        
        if location_id:
            supplier_query = supplier_query.where(TransactionHeader.location_id == location_id)
        
        result = await self.session.execute(supplier_query)
        top_suppliers = [
            {
                "supplier_id": str(row.supplier_id),
                "transaction_count": row.transaction_count,
                "total_amount": float(row.total_amount or 0)
            }
            for row in result
        ]
        
        # Calculate key metrics
        total_revenue = type_amounts.get("SALE", 0) + type_amounts.get("RENTAL", 0)
        total_expenses = type_amounts.get("PURCHASE", 0)
        net_amount = total_revenue - total_expenses
        
        return {
            "date_range": {
                "from": str(date_from),
                "to": str(date_to)
            },
            "location_id": str(location_id) if location_id else None,
            "transaction_counts": type_counts,
            "transaction_amounts": type_amounts,
            "payment_breakdown": payment_breakdown,
            "financial_summary": {
                "total_revenue": total_revenue,
                "total_expenses": total_expenses,
                "net_amount": net_amount
            },
            "top_customers": top_customers,
            "top_suppliers": top_suppliers,
            "report_generated_at": datetime.now(timezone.utc).isoformat()
        }
    
    async def validate_transaction_transition(
        self,
        transaction_id: UUID,
        new_status: TransactionStatus
    ) -> bool:
        """
        Validate if a status transition is allowed.
        """
        transaction = await self.transaction_repo.get_by_id(transaction_id)
        if not transaction:
            raise NotFoundError(f"Transaction {transaction_id} not found")
        
        # Define valid transitions
        valid_transitions = {
            TransactionStatus.PENDING: [
                TransactionStatus.PROCESSING,
                TransactionStatus.COMPLETED,
                TransactionStatus.CANCELLED
            ],
            TransactionStatus.PROCESSING: [
                TransactionStatus.COMPLETED,
                TransactionStatus.ON_HOLD,
                TransactionStatus.CANCELLED
            ],
            TransactionStatus.ON_HOLD: [
                TransactionStatus.PROCESSING,
                TransactionStatus.CANCELLED
            ],
            TransactionStatus.COMPLETED: [],
            TransactionStatus.CANCELLED: [],
        }
        
        current_status = transaction.status
        allowed = valid_transitions.get(current_status, [])
        
        if new_status not in allowed:
            raise ValidationError(
                f"Cannot transition from {current_status.value} to {new_status.value}"
            )
        
        return True
    
    async def recalculate_transaction_totals(
        self,
        transaction_id: UUID
    ) -> TransactionHeader:
        """
        Recalculate transaction totals from lines.
        """
        transaction = await self.transaction_repo.get_by_id(
            transaction_id,
            include_lines=True
        )
        
        if not transaction:
            raise NotFoundError(f"Transaction {transaction_id} not found")
        
        # Calculate from lines
        subtotal = Decimal("0.00")
        tax_amount = Decimal("0.00")
        discount_amount = Decimal("0.00")
        
        for line in transaction.lines:
            if line.is_active:
                subtotal += line.total_price
                tax_amount += line.tax_amount or Decimal("0.00")
                discount_amount += line.discount_amount or Decimal("0.00")
        
        # Update header
        transaction.subtotal = subtotal
        transaction.tax_amount = tax_amount
        transaction.discount_amount = discount_amount
        transaction.total_amount = (
            subtotal - discount_amount + tax_amount + 
            (transaction.shipping_amount or Decimal("0.00"))
        )
        
        # Update payment status if needed
        if transaction.paid_amount >= transaction.total_amount:
            transaction.payment_status = PaymentStatus.PAID
        elif transaction.paid_amount > 0:
            transaction.payment_status = PaymentStatus.PARTIAL
        else:
            transaction.payment_status = PaymentStatus.PENDING
        
        await self.session.flush()
        return transaction