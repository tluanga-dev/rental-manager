"""
Analytics repository for rental dashboard data
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, desc, and_, or_, extract, text
from sqlalchemy.dialects import postgresql
from typing import Dict, List, Any, Optional
from decimal import Decimal
from datetime import datetime, timedelta

from app.modules.transactions.base.models import TransactionHeader, TransactionLine
from app.modules.customers.models import Customer
from app.modules.master_data.locations.models import Location
from app.modules.master_data.item_master.models import Item
from app.modules.transactions.base.models.transaction_headers import TransactionType, RentalStatus, PaymentStatus


class AnalyticsRepository:
    """Repository for analytics data queries"""

    async def get_dashboard_summary(self, session: AsyncSession) -> Dict[str, Any]:
        """Get basic dashboard summary metrics for active rentals"""
        
        # Active rental statuses
        active_statuses = [
            RentalStatus.RENTAL_INPROGRESS,
            RentalStatus.RENTAL_LATE,
            RentalStatus.RENTAL_EXTENDED,
            RentalStatus.RENTAL_PARTIAL_RETURN,
            RentalStatus.RENTAL_LATE_PARTIAL_RETURN
        ]

        # Get active rentals summary
        summary_stmt = (
            select(
                func.count(TransactionHeader.id).label("total_rentals"),
                func.sum(TransactionHeader.total_amount).label("total_revenue"),
                func.avg(TransactionHeader.total_amount).label("average_rental_value"),
                func.count(func.distinct(TransactionHeader.customer_id)).label("unique_customers")
            )
            .where(
                TransactionHeader.transaction_type == TransactionType.RENTAL,
                TransactionHeader.id.in_(
                    select(TransactionLine.transaction_header_id)
                    .where(TransactionLine.current_rental_status.in_(active_statuses))
                    .distinct()
                )
            )
        )
        
        summary_result = await session.execute(summary_stmt)
        summary_row = summary_result.first()
        
        # Get top performing item
        top_item_stmt = (
            select(
                Item.id.label("item_id"),
                Item.item_name,
                Item.sku,
                func.count(TransactionLine.id).label("rental_count"),
                func.sum(TransactionLine.line_total).label("revenue")
            )
            .join(TransactionLine, Item.id == func.cast(TransactionLine.item_id, postgresql.UUID))
            .join(TransactionHeader, TransactionLine.transaction_header_id == TransactionHeader.id)
            .where(
                TransactionHeader.transaction_type == TransactionType.RENTAL,
                TransactionLine.current_rental_status.in_(active_statuses)
            )
            .group_by(Item.id, Item.item_name, Item.sku)
            .order_by(desc("rental_count"))
            .limit(1)
        )
        
        top_item_result = await session.execute(top_item_stmt)
        top_item_row = top_item_result.first()
        
        # Get location breakdown
        location_stmt = (
            select(
                Location.id.label("location_id"),
                Location.location_name,
                func.count(TransactionHeader.id).label("rental_count"),
                func.sum(TransactionHeader.total_amount).label("total_value")
            )
            .join(TransactionHeader, Location.id == func.cast(TransactionHeader.location_id, postgresql.UUID))
            .where(
                TransactionHeader.transaction_type == TransactionType.RENTAL,
                TransactionHeader.id.in_(
                    select(TransactionLine.transaction_header_id)
                    .where(TransactionLine.current_rental_status.in_(active_statuses))
                    .distinct()
                )
            )
            .group_by(Location.id, Location.location_name)
            .order_by(desc("rental_count"))
        )
        
        location_result = await session.execute(location_stmt)
        locations = location_result.fetchall()
        
        # Get status breakdown
        status_stmt = (
            select(
                TransactionLine.current_rental_status,
                func.count(func.distinct(TransactionLine.transaction_header_id)).label("count")
            )
            .join(TransactionHeader, TransactionLine.transaction_header_id == TransactionHeader.id)
            .where(
                TransactionHeader.transaction_type == TransactionType.RENTAL,
                TransactionLine.current_rental_status.in_(active_statuses)
            )
            .group_by(TransactionLine.current_rental_status)
        )
        
        status_result = await session.execute(status_stmt)
        statuses = status_result.fetchall()
        
        # Format response
        dashboard_data = {
            "summary": {
                "total_rentals": summary_row.total_rentals or 0,
                "total_revenue": float(summary_row.total_revenue or 0),
                "average_rental_value": float(summary_row.average_rental_value or 0),
                "unique_customers": summary_row.unique_customers or 0
            },
            "top_item": {
                "item_id": str(top_item_row.item_id) if top_item_row else None,
                "item_name": top_item_row.item_name if top_item_row else None,
                "sku": top_item_row.sku if top_item_row else None,
                "rental_count": top_item_row.rental_count if top_item_row else 0,
                "revenue": float(top_item_row.revenue or 0) if top_item_row else 0
            } if top_item_row else None,
            "locations": [
                {
                    "location_id": str(location.location_id),
                    "location_name": location.location_name,
                    "rental_count": location.rental_count,
                    "total_value": float(location.total_value or 0)
                }
                for location in locations
            ],
            "status_breakdown": {
                status.current_rental_status.value if hasattr(status.current_rental_status, 'value') 
                else str(status.current_rental_status): status.count
                for status in statuses
            }
        }
        
        return dashboard_data

    async def get_financial_dashboard_summary(
        self, 
        session: AsyncSession,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get comprehensive financial dashboard summary"""
        
        # Default to last 30 days if no dates provided
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # Base query filters
        date_filter = and_(
            TransactionHeader.transaction_date >= start_date,
            TransactionHeader.transaction_date <= end_date
        )
        
        # Total Revenue (all completed transactions)
        revenue_stmt = (
            select(
                func.sum(TransactionHeader.total_amount).label("total_revenue"),
                func.count(TransactionHeader.id).label("total_transactions"),
                func.avg(TransactionHeader.total_amount).label("avg_transaction_value")
            )
            .where(
                date_filter,
                TransactionHeader.payment_status.in_([PaymentStatus.PAID, PaymentStatus.PARTIAL])
            )
        )
        
        revenue_result = await session.execute(revenue_stmt)
        revenue_row = revenue_result.first()
        
        # Revenue by transaction type
        revenue_by_type_stmt = (
            select(
                TransactionHeader.transaction_type,
                func.sum(TransactionHeader.total_amount).label("revenue"),
                func.count(TransactionHeader.id).label("count")
            )
            .where(
                date_filter,
                TransactionHeader.payment_status.in_([PaymentStatus.PAID, PaymentStatus.PARTIAL])
            )
            .group_by(TransactionHeader.transaction_type)
        )
        
        revenue_type_result = await session.execute(revenue_by_type_stmt)
        revenue_by_type = revenue_type_result.fetchall()
        
        # Outstanding payments (unpaid/partially paid)
        outstanding_stmt = (
            select(
                func.sum(TransactionHeader.total_amount - TransactionHeader.paid_amount).label("outstanding_amount"),
                func.count(TransactionHeader.id).label("outstanding_count")
            )
            .where(
                TransactionHeader.payment_status.in_([PaymentStatus.PENDING, PaymentStatus.PARTIAL])
            )
        )
        
        outstanding_result = await session.execute(outstanding_stmt)
        outstanding_row = outstanding_result.first()
        
        # Monthly revenue trend (last 12 months)
        monthly_revenue_stmt = (
            select(
                extract('year', TransactionHeader.transaction_date).label('year'),
                extract('month', TransactionHeader.transaction_date).label('month'),
                func.sum(TransactionHeader.total_amount).label('revenue'),
                func.count(TransactionHeader.id).label('transaction_count')
            )
            .where(
                TransactionHeader.transaction_date >= (end_date - timedelta(days=365)),
                TransactionHeader.payment_status.in_([PaymentStatus.PAID, PaymentStatus.PARTIAL])
            )
            .group_by(
                extract('year', TransactionHeader.transaction_date),
                extract('month', TransactionHeader.transaction_date)
            )
            .order_by('year', 'month')
        )
        
        monthly_result = await session.execute(monthly_revenue_stmt)
        monthly_revenue = monthly_result.fetchall()
        
        # Active rental value
        active_rental_value_stmt = (
            select(
                func.sum(TransactionHeader.total_amount).label("active_rental_value"),
                func.count(TransactionHeader.id).label("active_rental_count")
            )
            .where(
                TransactionHeader.transaction_type == TransactionType.RENTAL,
                TransactionHeader.id.in_(
                    select(TransactionLine.transaction_header_id)
                    .where(TransactionLine.current_rental_status.in_([
                        RentalStatus.RENTAL_INPROGRESS,
                        RentalStatus.RENTAL_LATE,
                        RentalStatus.RENTAL_EXTENDED,
                        RentalStatus.RENTAL_PARTIAL_RETURN,
                        RentalStatus.RENTAL_LATE_PARTIAL_RETURN
                    ]))
                    .distinct()
                )
            )
        )
        
        active_rental_result = await session.execute(active_rental_value_stmt)
        active_rental_row = active_rental_result.first()
        
        # Format response
        return {
            "summary": {
                "total_revenue": float(revenue_row.total_revenue or 0),
                "total_transactions": revenue_row.total_transactions or 0,
                "avg_transaction_value": float(revenue_row.avg_transaction_value or 0),
                "outstanding_amount": float(outstanding_row.outstanding_amount or 0),
                "outstanding_count": outstanding_row.outstanding_count or 0,
                "active_rental_value": float(active_rental_row.active_rental_value or 0),
                "active_rental_count": active_rental_row.active_rental_count or 0
            },
            "revenue_by_type": [
                {
                    "transaction_type": row.transaction_type.value if hasattr(row.transaction_type, 'value') else str(row.transaction_type),
                    "revenue": float(row.revenue or 0),
                    "count": row.count
                }
                for row in revenue_by_type
            ],
            "monthly_revenue": [
                {
                    "year": int(row.year),
                    "month": int(row.month),
                    "revenue": float(row.revenue or 0),
                    "transaction_count": row.transaction_count
                }
                for row in monthly_revenue
            ]
        }

    async def get_revenue_trends(
        self,
        session: AsyncSession,
        period: str = "monthly",  # daily, weekly, monthly, yearly
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """Get revenue trends over time"""
        
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            if period == "daily":
                start_date = end_date - timedelta(days=30)
            elif period == "weekly":
                start_date = end_date - timedelta(weeks=12)
            elif period == "monthly":
                start_date = end_date - timedelta(days=365)
            else:  # yearly
                start_date = end_date - timedelta(days=1825)  # 5 years
        
        # Build time grouping based on period
        if period == "daily":
            time_extract = [
                extract('year', TransactionHeader.transaction_date).label('year'),
                extract('month', TransactionHeader.transaction_date).label('month'),
                extract('day', TransactionHeader.transaction_date).label('day')
            ]
            time_group = [
                extract('year', TransactionHeader.transaction_date),
                extract('month', TransactionHeader.transaction_date),
                extract('day', TransactionHeader.transaction_date)
            ]
        elif period == "weekly":
            time_extract = [
                extract('year', TransactionHeader.transaction_date).label('year'),
                extract('week', TransactionHeader.transaction_date).label('week')
            ]
            time_group = [
                extract('year', TransactionHeader.transaction_date),
                extract('week', TransactionHeader.transaction_date)
            ]
        elif period == "monthly":
            time_extract = [
                extract('year', TransactionHeader.transaction_date).label('year'),
                extract('month', TransactionHeader.transaction_date).label('month')
            ]
            time_group = [
                extract('year', TransactionHeader.transaction_date),
                extract('month', TransactionHeader.transaction_date)
            ]
        else:  # yearly
            time_extract = [extract('year', TransactionHeader.transaction_date).label('year')]
            time_group = [extract('year', TransactionHeader.transaction_date)]
        
        stmt = (
            select(
                *time_extract,
                func.sum(TransactionHeader.total_amount).label('revenue'),
                func.count(TransactionHeader.id).label('transaction_count'),
                func.avg(TransactionHeader.total_amount).label('avg_transaction_value')
            )
            .where(
                and_(
                    TransactionHeader.transaction_date >= start_date,
                    TransactionHeader.transaction_date <= end_date,
                    TransactionHeader.payment_status.in_([PaymentStatus.PAID, PaymentStatus.PARTIAL])
                )
            )
            .group_by(*time_group)
            .order_by(*time_group)
        )
        
        result = await session.execute(stmt)
        rows = result.fetchall()
        
        trends = []
        for row in rows:
            trend_data = {
                "revenue": float(row.revenue or 0),
                "transaction_count": row.transaction_count,
                "avg_transaction_value": float(row.avg_transaction_value or 0)
            }
            
            if period == "daily":
                trend_data.update({
                    "year": int(row.year),
                    "month": int(row.month),
                    "day": int(row.day)
                })
            elif period == "weekly":
                trend_data.update({
                    "year": int(row.year),
                    "week": int(row.week)
                })
            elif period == "monthly":
                trend_data.update({
                    "year": int(row.year),
                    "month": int(row.month)
                })
            else:  # yearly
                trend_data.update({
                    "year": int(row.year)
                })
            
            trends.append(trend_data)
        
        return trends

    async def get_cash_flow_analysis(
        self,
        session: AsyncSession,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get cash flow analysis with inflows and outflows"""
        
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=90)  # Last 3 months
        
        # Cash inflows (revenue from sales and rentals)
        inflows_stmt = (
            select(
                TransactionHeader.transaction_type,
                func.sum(TransactionHeader.paid_amount).label('inflow'),
                func.count(TransactionHeader.id).label('count')
            )
            .where(
                and_(
                    TransactionHeader.transaction_date >= start_date,
                    TransactionHeader.transaction_date <= end_date,
                    TransactionHeader.transaction_type.in_([TransactionType.SALE, TransactionType.RENTAL]),
                    TransactionHeader.paid_amount > 0
                )
            )
            .group_by(TransactionHeader.transaction_type)
        )
        
        inflows_result = await session.execute(inflows_stmt)
        inflows = inflows_result.fetchall()
        
        # Cash outflows (purchases and expenses)
        outflows_stmt = (
            select(
                TransactionHeader.transaction_type,
                func.sum(TransactionHeader.paid_amount).label('outflow'),
                func.count(TransactionHeader.id).label('count')
            )
            .where(
                and_(
                    TransactionHeader.transaction_date >= start_date,
                    TransactionHeader.transaction_date <= end_date,
                    TransactionHeader.transaction_type == TransactionType.PURCHASE,
                    TransactionHeader.paid_amount > 0
                )
            )
            .group_by(TransactionHeader.transaction_type)
        )
        
        outflows_result = await session.execute(outflows_stmt)
        outflows = outflows_result.fetchall()
        
        # Monthly cash flow
        monthly_cashflow_stmt = (
            select(
                extract('year', TransactionHeader.transaction_date).label('year'),
                extract('month', TransactionHeader.transaction_date).label('month'),
                TransactionHeader.transaction_type,
                func.sum(TransactionHeader.paid_amount).label('amount')
            )
            .where(
                and_(
                    TransactionHeader.transaction_date >= start_date,
                    TransactionHeader.transaction_date <= end_date,
                    TransactionHeader.paid_amount > 0
                )
            )
            .group_by(
                extract('year', TransactionHeader.transaction_date),
                extract('month', TransactionHeader.transaction_date),
                TransactionHeader.transaction_type
            )
            .order_by('year', 'month')
        )
        
        monthly_result = await session.execute(monthly_cashflow_stmt)
        monthly_cashflow = monthly_result.fetchall()
        
        # Calculate totals
        total_inflows = sum(float(row.inflow or 0) for row in inflows)
        total_outflows = sum(float(row.outflow or 0) for row in outflows)
        net_cash_flow = total_inflows - total_outflows
        
        return {
            "summary": {
                "total_inflows": total_inflows,
                "total_outflows": total_outflows,
                "net_cash_flow": net_cash_flow
            },
            "inflows_by_type": [
                {
                    "transaction_type": row.transaction_type.value if hasattr(row.transaction_type, 'value') else str(row.transaction_type),
                    "amount": float(row.inflow or 0),
                    "count": row.count
                }
                for row in inflows
            ],
            "outflows_by_type": [
                {
                    "transaction_type": row.transaction_type.value if hasattr(row.transaction_type, 'value') else str(row.transaction_type),
                    "amount": float(row.outflow or 0),
                    "count": row.count
                }
                for row in outflows
            ],
            "monthly_cashflow": [
                {
                    "year": int(row.year),
                    "month": int(row.month),
                    "transaction_type": row.transaction_type.value if hasattr(row.transaction_type, 'value') else str(row.transaction_type),
                    "amount": float(row.amount or 0)
                }
                for row in monthly_cashflow
            ]
        }

    async def get_period_comparison(
        self,
        session: AsyncSession,
        current_start: datetime,
        current_end: datetime,
        previous_start: datetime,
        previous_end: datetime
    ) -> Dict[str, Any]:
        """Get period-over-period comparison for key metrics"""
        
        # Current period metrics
        current_stmt = (
            select(
                func.sum(TransactionHeader.total_amount).label("revenue"),
                func.count(TransactionHeader.id).label("transactions"),
                func.avg(TransactionHeader.total_amount).label("avg_value"),
                func.count(func.distinct(TransactionHeader.customer_id)).label("customers")
            )
            .where(
                and_(
                    TransactionHeader.transaction_date >= current_start,
                    TransactionHeader.transaction_date <= current_end,
                    TransactionHeader.payment_status.in_([PaymentStatus.PAID, PaymentStatus.PARTIAL])
                )
            )
        )
        
        current_result = await session.execute(current_stmt)
        current = current_result.first()
        
        # Previous period metrics
        previous_stmt = (
            select(
                func.sum(TransactionHeader.total_amount).label("revenue"),
                func.count(TransactionHeader.id).label("transactions"),
                func.avg(TransactionHeader.total_amount).label("avg_value"),
                func.count(func.distinct(TransactionHeader.customer_id)).label("customers")
            )
            .where(
                and_(
                    TransactionHeader.transaction_date >= previous_start,
                    TransactionHeader.transaction_date <= previous_end,
                    TransactionHeader.payment_status.in_([PaymentStatus.PAID, PaymentStatus.PARTIAL])
                )
            )
        )
        
        previous_result = await session.execute(previous_stmt)
        previous = previous_result.first()
        
        # Calculate percentage changes
        def calc_change(current_val, previous_val):
            if not previous_val or previous_val == 0:
                return 0 if not current_val else 100
            return ((current_val - previous_val) / previous_val) * 100
        
        return {
            "current_period": {
                "revenue": float(current.revenue or 0),
                "transactions": current.transactions or 0,
                "avg_value": float(current.avg_value or 0),
                "customers": current.customers or 0
            },
            "previous_period": {
                "revenue": float(previous.revenue or 0),
                "transactions": previous.transactions or 0,
                "avg_value": float(previous.avg_value or 0),
                "customers": previous.customers or 0
            },
            "changes": {
                "revenue_change": calc_change(current.revenue or 0, previous.revenue or 0),
                "transactions_change": calc_change(current.transactions or 0, previous.transactions or 0),
                "avg_value_change": calc_change(current.avg_value or 0, previous.avg_value or 0),
                "customers_change": calc_change(current.customers or 0, previous.customers or 0)
            }
        }

    async def get_receivables_aging(
        self,
        session: AsyncSession
    ) -> Dict[str, Any]:
        """Get aging analysis for outstanding receivables"""
        
        now = datetime.utcnow()
        
        # Aging buckets
        aging_stmt = (
            select(
                case(
                    (TransactionHeader.due_date >= now, "Current"),
                    (TransactionHeader.due_date >= now - timedelta(days=30), "1-30 days"),
                    (TransactionHeader.due_date >= now - timedelta(days=60), "31-60 days"),
                    (TransactionHeader.due_date >= now - timedelta(days=90), "61-90 days"),
                    else_="Over 90 days"
                ).label("aging_bucket"),
                func.count(TransactionHeader.id).label("count"),
                func.sum(TransactionHeader.total_amount - TransactionHeader.paid_amount).label("amount")
            )
            .where(
                TransactionHeader.payment_status.in_([PaymentStatus.PENDING, PaymentStatus.PARTIAL])
            )
            .group_by("aging_bucket")
        )
        
        aging_result = await session.execute(aging_stmt)
        aging_data = aging_result.fetchall()
        
        # Top overdue customers
        overdue_customers_stmt = (
            select(
                Customer.id,
                func.coalesce(Customer.business_name, func.concat(Customer.first_name, ' ', Customer.last_name)).label("customer_name"),
                func.sum(TransactionHeader.total_amount - TransactionHeader.paid_amount).label("outstanding"),
                func.min(TransactionHeader.due_date).label("oldest_due_date")
            )
            .join(Customer, Customer.id == TransactionHeader.customer_id)
            .where(
                and_(
                    TransactionHeader.payment_status.in_([PaymentStatus.PENDING, PaymentStatus.PARTIAL]),
                    TransactionHeader.due_date < now
                )
            )
            .group_by(Customer.id, Customer.business_name, Customer.first_name, Customer.last_name)
            .order_by(desc("outstanding"))
            .limit(10)
        )
        
        overdue_result = await session.execute(overdue_customers_stmt)
        overdue_customers = overdue_result.fetchall()
        
        return {
            "aging_summary": [
                {
                    "bucket": row.aging_bucket,
                    "count": row.count,
                    "amount": float(row.amount or 0)
                }
                for row in aging_data
            ],
            "total_outstanding": sum(float(row.amount or 0) for row in aging_data),
            "overdue_customers": [
                {
                    "customer_id": str(row.id),
                    "customer_name": row.customer_name,
                    "outstanding_amount": float(row.outstanding or 0),
                    "days_overdue": (now - row.oldest_due_date).days if row.oldest_due_date else 0
                }
                for row in overdue_customers
            ]
        }

    async def get_rental_utilization_metrics(
        self,
        session: AsyncSession,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get rental utilization and performance metrics"""
        
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # Total inventory count
        total_items_stmt = select(func.count(Item.id))
        total_items_result = await session.execute(total_items_stmt)
        total_items = total_items_result.scalar() or 0
        
        # Items currently rented
        rented_items_stmt = (
            select(func.count(func.distinct(TransactionLine.item_id)))
            .join(TransactionHeader, TransactionLine.transaction_header_id == TransactionHeader.id)
            .where(
                and_(
                    TransactionHeader.transaction_type == TransactionType.RENTAL,
                    TransactionLine.current_rental_status.in_([
                        RentalStatus.RENTAL_INPROGRESS,
                        RentalStatus.RENTAL_LATE,
                        RentalStatus.RENTAL_EXTENDED
                    ])
                )
            )
        )
        
        rented_items_result = await session.execute(rented_items_stmt)
        rented_items = rented_items_result.scalar() or 0
        
        # Rental performance metrics
        rental_metrics_stmt = (
            select(
                func.count(TransactionHeader.id).label("total_rentals"),
                func.avg(TransactionHeader.total_amount).label("avg_rental_value"),
                func.sum(
                    case(
                        (TransactionLine.current_rental_status == RentalStatus.RENTAL_LATE, 1),
                        else_=0
                    )
                ).label("late_rentals")
            )
            .join(TransactionLine, TransactionHeader.id == TransactionLine.transaction_header_id)
            .where(
                and_(
                    TransactionHeader.transaction_type == TransactionType.RENTAL,
                    TransactionHeader.transaction_date >= start_date,
                    TransactionHeader.transaction_date <= end_date
                )
            )
        )
        
        metrics_result = await session.execute(rental_metrics_stmt)
        metrics = metrics_result.first()
        
        # Calculate utilization rate
        utilization_rate = (rented_items / total_items * 100) if total_items > 0 else 0
        late_return_rate = (metrics.late_rentals / metrics.total_rentals * 100) if metrics.total_rentals else 0
        
        return {
            "utilization": {
                "total_items": total_items,
                "rented_items": rented_items,
                "available_items": total_items - rented_items,
                "utilization_rate": utilization_rate
            },
            "performance": {
                "total_rentals": metrics.total_rentals or 0,
                "avg_rental_value": float(metrics.avg_rental_value or 0),
                "late_rentals": int(metrics.late_rentals or 0),
                "late_return_rate": late_return_rate
            }
        }

    async def get_customer_lifetime_value(
        self,
        session: AsyncSession,
        limit: int = 10
    ) -> Dict[str, Any]:
        """Calculate customer lifetime value and related metrics"""
        
        # Customer value analysis
        customer_value_stmt = (
            select(
                Customer.id,
                func.coalesce(Customer.business_name, func.concat(Customer.first_name, ' ', Customer.last_name)).label("customer_name"),
                func.count(TransactionHeader.id).label("transaction_count"),
                func.sum(TransactionHeader.total_amount).label("lifetime_value"),
                func.avg(TransactionHeader.total_amount).label("avg_transaction"),
                func.min(TransactionHeader.transaction_date).label("first_transaction"),
                func.max(TransactionHeader.transaction_date).label("last_transaction")
            )
            .join(Customer, Customer.id == TransactionHeader.customer_id)
            .where(
                TransactionHeader.payment_status.in_([PaymentStatus.PAID, PaymentStatus.PARTIAL])
            )
            .group_by(Customer.id, Customer.business_name, Customer.first_name, Customer.last_name)
            .order_by(desc("lifetime_value"))
            .limit(limit)
        )
        
        customer_result = await session.execute(customer_value_stmt)
        top_customers = customer_result.fetchall()
        
        # Overall customer metrics - using subquery to avoid nested aggregates
        subquery = (
            select(
                TransactionHeader.customer_id,
                func.sum(TransactionHeader.total_amount).label("customer_total")
            )
            .where(
                TransactionHeader.payment_status.in_([PaymentStatus.PAID, PaymentStatus.PARTIAL])
            )
            .group_by(TransactionHeader.customer_id)
            .subquery()
        )
        
        overall_stmt = (
            select(
                func.count(subquery.c.customer_id).label("total_customers"),
                func.avg(subquery.c.customer_total).label("avg_lifetime_value")
            )
        )
        
        overall_result = await session.execute(overall_stmt)
        overall = overall_result.first()
        
        return {
            "top_customers": [
                {
                    "customer_id": str(row.id),
                    "customer_name": row.customer_name,
                    "lifetime_value": float(row.lifetime_value or 0),
                    "transaction_count": row.transaction_count,
                    "avg_transaction": float(row.avg_transaction or 0),
                    "customer_since": row.first_transaction.isoformat() if row.first_transaction else None,
                    "last_active": row.last_transaction.isoformat() if row.last_transaction else None
                }
                for row in top_customers
            ],
            "summary": {
                "total_customers": overall.total_customers if overall else 0,
                "avg_lifetime_value": float(overall.avg_lifetime_value or 0) if overall else 0
            }
        }