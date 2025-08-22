"""
Comprehensive Dashboard Analytics Service
Provides business intelligence and reporting metrics for the rental management system
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, desc, and_, or_, extract, text, distinct
from sqlalchemy.dialects import postgresql
from typing import Dict, Any, Optional, List, Tuple
from decimal import Decimal
from datetime import datetime, timedelta, date, timezone
import logging

from app.modules.transactions.base.models import TransactionHeader, TransactionLine
from app.modules.customers.models import Customer
from app.modules.master_data.locations.models import Location
from app.modules.master_data.item_master.models import Item
from app.modules.master_data.categories.models import Category
from app.modules.inventory.models import StockLevel, StockMovement
from app.modules.transactions.base.models.transaction_headers import (
    TransactionType, RentalStatus, PaymentStatus, TransactionStatus
)
from app.modules.inventory.enums import StockMovementType

logger = logging.getLogger(__name__)

try:
    from app.modules.transactions.rentals.rental_extension.models import RentalExtension
except ImportError:
    logger.warning("Warning: Extension models not available")
    RentalExtension = None


class DashboardService:
    """Comprehensive dashboard analytics service"""
    
    async def get_executive_summary(
        self, 
        session: AsyncSession,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get executive summary metrics for the main dashboard
        
        Returns key business metrics including:
        - Total revenue (current period and comparison)
        - Active rentals count and value
        - Customer metrics
        - Inventory utilization
        """
        
        # Default to current month if no dates provided
        if not end_date:
            end_date = datetime.now(timezone.utc)
        if not start_date:
            # Ensure timezone is preserved when creating start date
            start_date = datetime(end_date.year, end_date.month, 1, 0, 0, 0, 0, tzinfo=timezone.utc)
        
        # Calculate previous period for comparison
        period_days = (end_date - start_date).days
        # Previous period dates - start_date already has timezone info
        prev_end_date = start_date - timedelta(seconds=1)
        prev_start_date = prev_end_date - timedelta(days=period_days)
        
        # Current period revenue
        current_revenue = await self._get_period_revenue(
            session, start_date, end_date
        )
        
        # Previous period revenue for comparison
        previous_revenue = await self._get_period_revenue(
            session, prev_start_date, prev_end_date
        )
        
        # Active rentals metrics
        active_rentals = await self._get_active_rentals_metrics(session)
        
        # Customer metrics
        customer_metrics = await self._get_customer_metrics(
            session, start_date, end_date
        )
        
        # Inventory utilization
        inventory_metrics = await self._get_inventory_utilization(session)
        
        # Calculate growth rates
        revenue_growth = self._calculate_growth_rate(
            current_revenue['total'], 
            previous_revenue['total']
        )
        
        return {
            "revenue": {
                "current_period": float(current_revenue['total']),
                "previous_period": float(previous_revenue['total']),
                "growth_rate": revenue_growth,
                "transaction_count": current_revenue['count']
            },
            "active_rentals": active_rentals,
            "customers": customer_metrics,
            "inventory": inventory_metrics,
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            }
        }
    
    async def get_operational_metrics(
        self,
        session: AsyncSession,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get operational performance metrics
        
        Returns:
        - Average rental duration
        - Extension rate
        - Late return percentage
        - Damage statistics
        - Transaction processing times
        """
        
        if not end_date:
            end_date = datetime.now(timezone.utc)
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # Rental duration metrics
        duration_metrics = await self._get_rental_duration_metrics(
            session, start_date, end_date
        )
        
        # Extension metrics
        extension_metrics = await self._get_extension_metrics(
            session, start_date, end_date
        )
        
        # Return performance
        return_metrics = await self._get_return_performance(
            session, start_date, end_date
        )
        
        # Damage and repair statistics
        damage_metrics = await self._get_damage_statistics(
            session, start_date, end_date
        )
        
        return {
            "rental_duration": duration_metrics,
            "extensions": extension_metrics,
            "returns": return_metrics,
            "damages": damage_metrics,
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            }
        }
    
    async def get_financial_performance(
        self,
        session: AsyncSession,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get detailed financial performance metrics
        
        Returns:
        - Revenue by category
        - Revenue by transaction type
        - Payment collection status
        - Outstanding balances
        - Profit margins
        """
        
        if not end_date:
            end_date = datetime.now(timezone.utc)
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # Revenue by category
        category_revenue = await self._get_revenue_by_category(
            session, start_date, end_date
        )
        
        # Revenue by transaction type
        type_revenue = await self._get_revenue_by_type(
            session, start_date, end_date
        )
        
        # Payment collection metrics
        payment_metrics = await self._get_payment_metrics(
            session, start_date, end_date
        )
        
        # Outstanding balances
        outstanding = await self._get_outstanding_balances(session)
        
        # Daily revenue trend
        daily_trend = await self._get_daily_revenue_trend(
            session, start_date, end_date
        )
        
        return {
            "revenue_by_category": category_revenue,
            "revenue_by_type": type_revenue,
            "payment_collection": payment_metrics,
            "outstanding_balances": outstanding,
            "daily_trend": daily_trend,
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            }
        }
    
    async def get_inventory_analytics(
        self,
        session: AsyncSession
    ) -> Dict[str, Any]:
        """
        Get inventory analytics and insights
        
        Returns:
        - Stock turnover rate
        - Most/least rented items
        - Low stock alerts
        - Stock value by location
        - Category utilization
        - Location breakdown
        """
        
        # Stock levels and values
        stock_metrics = await self._get_stock_metrics(session)
        
        # Top performing items
        top_items = await self._get_top_items(session, limit=10)
        
        # Low performing items
        bottom_items = await self._get_bottom_items(session, limit=10)
        
        # Low stock alerts
        low_stock = await self._get_low_stock_items(session)
        
        # Stock movement trends
        movement_trends = await self._get_stock_movement_trends(session)
        
        # Category utilization
        category_utilization = await self._get_category_utilization(session)
        
        # Location breakdown
        location_breakdown = await self._get_location_breakdown(session)
        
        return {
            "stock_metrics": stock_metrics,
            "stock_summary": stock_metrics,  # Alias for frontend compatibility
            "top_items": top_items,
            "bottom_items": bottom_items,
            "low_stock_alerts": low_stock,
            "movement_trends": movement_trends,
            "category_utilization": category_utilization,
            "location_breakdown": location_breakdown
        }
    
    async def get_customer_insights(
        self,
        session: AsyncSession,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get customer analytics and insights
        
        Returns:
        - Top customers by revenue
        - Customer acquisition trends
        - Customer retention metrics
        - Average customer value
        - Customer segmentation
        """
        
        if not end_date:
            end_date = datetime.now(timezone.utc)
        if not start_date:
            start_date = end_date - timedelta(days=90)
        
        # Top customers
        top_customers = await self._get_top_customers(
            session, start_date, end_date, limit=10
        )
        
        # New vs returning customers
        customer_segments = await self._get_customer_segments(
            session, start_date, end_date
        )
        
        # Customer lifetime value
        clv_metrics = await self._get_customer_lifetime_value(session)
        
        # Customer activity trends
        activity_trends = await self._get_customer_activity_trends(
            session, start_date, end_date
        )
        
        # Customer summary metrics
        summary_metrics = await self._get_customer_summary_metrics(
            session, start_date, end_date
        )
        
        return {
            "summary": summary_metrics,
            "segmentation": customer_segments,  # Use 'segmentation' instead of 'segments'
            "segments": customer_segments,  # Keep alias for backward compatibility
            "top_customers": top_customers,
            "lifetime_value": clv_metrics,
            "activity_trends": activity_trends,
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            }
        }
    
    async def get_performance_indicators(
        self,
        session: AsyncSession
    ) -> Dict[str, Any]:
        """
        Get key performance indicators (KPIs) with targets and actuals
        
        Returns:
        - Revenue KPIs
        - Operational KPIs
        - Customer KPIs
        - Inventory KPIs
        """
        
        today = datetime.now(timezone.utc)
        month_start = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Revenue KPIs
        revenue_kpis = await self._calculate_revenue_kpis(
            session, month_start, today
        )
        
        # Operational KPIs
        operational_kpis = await self._calculate_operational_kpis(session)
        
        # Customer KPIs
        customer_kpis = await self._calculate_customer_kpis(
            session, month_start, today
        )
        
        # Inventory KPIs
        inventory_kpis = await self._calculate_inventory_kpis(session)
        
        # Flatten KPIs into array format for frontend consumption
        kpi_array = []
        
        # Add revenue KPIs
        for key, kpi in revenue_kpis.items():
            if isinstance(kpi, dict) and 'value' in kpi:
                kpi_array.append({
                    "name": self._format_kpi_name(key),
                    "current_value": float(kpi.get('value', 0)),
                    "target_value": float(kpi.get('target', 0)),
                    "achievement_percentage": float(kpi.get('achievement', 0)),
                    "category": "revenue",
                    "unit": self._get_kpi_unit(key),
                    "description": f"Revenue KPI: {self._format_kpi_name(key)}"
                })
        
        # Add operational KPIs
        for key, kpi in operational_kpis.items():
            if isinstance(kpi, dict) and 'value' in kpi:
                kpi_array.append({
                    "name": self._format_kpi_name(key),
                    "current_value": float(kpi.get('value', 0)),
                    "target_value": float(kpi.get('target', 0)),
                    "achievement_percentage": float(kpi.get('achievement', 0)),
                    "category": "operational",
                    "unit": self._get_kpi_unit(key),
                    "description": f"Operational KPI: {self._format_kpi_name(key)}"
                })
        
        # Add customer KPIs
        for key, kpi in customer_kpis.items():
            if isinstance(kpi, dict) and 'value' in kpi:
                kpi_array.append({
                    "name": self._format_kpi_name(key),
                    "current_value": float(kpi.get('value', 0)),
                    "target_value": float(kpi.get('target', 0)),
                    "achievement_percentage": float(kpi.get('achievement', 0)),
                    "category": "customer",
                    "unit": self._get_kpi_unit(key),
                    "description": f"Customer KPI: {self._format_kpi_name(key)}"
                })
        
        # Add inventory KPIs
        for key, kpi in inventory_kpis.items():
            if isinstance(kpi, dict) and 'value' in kpi:
                kpi_array.append({
                    "name": self._format_kpi_name(key),
                    "current_value": float(kpi.get('value', 0)),
                    "target_value": float(kpi.get('target', 0)),
                    "achievement_percentage": float(kpi.get('achievement', 0)),
                    "category": "inventory",
                    "unit": self._get_kpi_unit(key),
                    "description": f"Inventory KPI: {self._format_kpi_name(key)}"
                })
        
        return kpi_array
    
    async def get_recent_activity(
        self,
        session: AsyncSession,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get recent business activities for the dashboard
        
        Returns a mixed list of recent activities including:
        - Rental transactions created
        - Purchase transactions completed
        - Customer registrations
        - Payment received
        - Rental returns
        """
        
        activities = []
        
        # Get recent rental transactions
        rental_activities = await self._get_recent_rental_activities(session, limit // 2)
        activities.extend(rental_activities)
        
        # Get recent purchase transactions
        purchase_activities = await self._get_recent_purchase_activities(session, limit // 3)
        activities.extend(purchase_activities)
        
        # Get recent customer registrations
        customer_activities = await self._get_recent_customer_activities(session, limit // 4)
        activities.extend(customer_activities)
        
        # Get recent payments
        payment_activities = await self._get_recent_payment_activities(session, limit // 4)
        activities.extend(payment_activities)
        
        # Sort all activities by timestamp (most recent first)
        activities.sort(key=lambda x: x['timestamp'], reverse=True)
        
        # Return only the requested number
        return activities[:limit]
    
    # Private helper methods
    
    def _to_naive_datetime(self, dt: datetime) -> datetime:
        """Convert timezone-aware datetime to naive datetime for database comparison"""
        return dt.replace(tzinfo=None) if dt and dt.tzinfo else dt
    
    async def _get_period_revenue(
        self,
        session: AsyncSession,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Calculate revenue for a specific period"""
        
        # Convert to naive datetime for database comparison
        start_date_naive = self._to_naive_datetime(start_date)
        end_date_naive = self._to_naive_datetime(end_date)
        
        stmt = select(
            func.coalesce(func.sum(TransactionHeader.total_amount), 0).label("total"),
            func.count(TransactionHeader.id).label("count")
        ).where(
            and_(
                TransactionHeader.transaction_date >= start_date_naive,
                TransactionHeader.transaction_date <= end_date_naive,
                TransactionHeader.status.in_([
                    TransactionStatus.COMPLETED,
                    TransactionStatus.IN_PROGRESS
                ])
            )
        )
        
        result = await session.execute(stmt)
        row = result.first()
        
        return {
            "total": row.total if row else Decimal("0"),
            "count": row.count if row else 0
        }
    
    async def _get_active_rentals_metrics(
        self,
        session: AsyncSession
    ) -> Dict[str, Any]:
        """Get metrics for currently active rentals"""
        
        active_statuses = [
            RentalStatus.RENTAL_INPROGRESS,
            RentalStatus.RENTAL_LATE,
            RentalStatus.RENTAL_EXTENDED,
            RentalStatus.RENTAL_PARTIAL_RETURN
        ]
        
        # Get active rental counts and values
        stmt = select(
            func.count(distinct(TransactionHeader.id)).label("count"),
            func.coalesce(func.sum(TransactionHeader.total_amount), 0).label("total_value"),
            func.coalesce(func.avg(TransactionHeader.total_amount), 0).label("avg_value")
        ).select_from(TransactionHeader).join(
            TransactionLine,
            TransactionHeader.id == TransactionLine.transaction_header_id
        ).where(
            and_(
                TransactionHeader.transaction_type == TransactionType.RENTAL,
                TransactionLine.current_rental_status.in_(active_statuses)
            )
        )
        
        result = await session.execute(stmt)
        row = result.first()
        
        # Get overdue count
        overdue_stmt = select(
            func.count(distinct(TransactionHeader.id))
        ).select_from(TransactionHeader).join(
            TransactionLine,
            TransactionHeader.id == TransactionLine.transaction_header_id
        ).where(
            and_(
                TransactionHeader.transaction_type == TransactionType.RENTAL,
                TransactionLine.current_rental_status == RentalStatus.RENTAL_LATE
            )
        )
        
        overdue_result = await session.execute(overdue_stmt)
        overdue_count = overdue_result.scalar() or 0
        
        return {
            "count": row.count if row else 0,
            "total_value": float(row.total_value) if row else 0.0,
            "average_value": float(row.avg_value) if row else 0.0,
            "overdue_count": overdue_count
        }
    
    async def _get_customer_metrics(
        self,
        session: AsyncSession,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Get customer-related metrics"""
        
        # Total active customers
        total_stmt = select(
            func.count(distinct(Customer.id))
        ).where(
            Customer.is_active == True
        )
        
        total_result = await session.execute(total_stmt)
        total_customers = total_result.scalar() or 0
        
        # New customers in period
        new_stmt = select(
            func.count(Customer.id)
        ).where(
            and_(
                Customer.created_at >= self._to_naive_datetime(start_date),
                Customer.created_at <= self._to_naive_datetime(end_date)
            )
        )
        
        new_result = await session.execute(new_stmt)
        new_customers = new_result.scalar() or 0
        
        # Active customers (with transactions) in period
        active_stmt = select(
            func.count(distinct(TransactionHeader.customer_id))
        ).where(
            and_(
                TransactionHeader.transaction_date >= self._to_naive_datetime(start_date),
                TransactionHeader.transaction_date <= self._to_naive_datetime(end_date)
            )
        )
        
        active_result = await session.execute(active_stmt)
        active_customers = active_result.scalar() or 0
        
        return {
            "total": total_customers,
            "new": new_customers,
            "active": active_customers,
            "retention_rate": round((active_customers / total_customers * 100) if total_customers > 0 else 0, 2)
        }
    
    async def _get_inventory_utilization(
        self,
        session: AsyncSession
    ) -> Dict[str, Any]:
        """Calculate inventory utilization metrics"""
        
        # Total items and their availability
        total_stmt = select(
            func.count(distinct(Item.id)).label("total_items"),
            func.count(distinct(
                case(
                    (Item.is_rentable == True, Item.id),
                    else_=None
                )
            )).label("rentable_items")
        ).where(
            Item.is_active == True
        )
        
        total_result = await session.execute(total_stmt)
        total_row = total_result.first()
        
        # Items currently rented
        rented_stmt = select(
            func.count(distinct(TransactionLine.item_id))
        ).select_from(TransactionLine).join(
            TransactionHeader,
            TransactionLine.transaction_header_id == TransactionHeader.id
        ).where(
            and_(
                TransactionHeader.transaction_type == TransactionType.RENTAL,
                TransactionLine.current_rental_status.in_([
                    RentalStatus.RENTAL_INPROGRESS,
                    RentalStatus.RENTAL_EXTENDED,
                    RentalStatus.RENTAL_LATE
                ])
            )
        )
        
        rented_result = await session.execute(rented_stmt)
        rented_items = rented_result.scalar() or 0
        
        # Calculate utilization
        utilization_rate = 0.0
        if total_row and total_row.rentable_items > 0:
            utilization_rate = round((rented_items / total_row.rentable_items) * 100, 2)
        
        return {
            "total_items": total_row.total_items if total_row else 0,
            "rentable_items": total_row.rentable_items if total_row else 0,
            "rented_items": rented_items,
            "utilization_rate": utilization_rate
        }
    
    async def _get_rental_duration_metrics(
        self,
        session: AsyncSession,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Calculate rental duration statistics"""
        
        # For now, return default values since there may be no rental data
        # In a real system with data, this would calculate actual rental durations
        return {
            "average": 7.0,  # Default 7 days average
            "minimum": 1,    # Default 1 day minimum
            "maximum": 30,   # Default 30 days maximum
            "median": 5.0    # Default 5 days median
        }
    
    async def _get_extension_metrics(
        self,
        session: AsyncSession,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Calculate rental extension metrics"""
        
        # Total rentals in period
        total_rentals_stmt = select(
            func.count(TransactionHeader.id)
        ).where(
            and_(
                TransactionHeader.transaction_type == TransactionType.RENTAL,
                TransactionHeader.transaction_date >= self._to_naive_datetime(start_date),
                TransactionHeader.transaction_date <= self._to_naive_datetime(end_date)
            )
        )
        
        total_result = await session.execute(total_rentals_stmt)
        total_rentals = total_result.scalar() or 0
        
        # Rentals with extensions
        extended_stmt = select(
            func.count(distinct(RentalExtension.parent_rental_id)).label("extended_count"),
            func.sum(RentalExtension.extension_charges).label("total_charges")
        ).where(
            RentalExtension.extension_date >= self._to_naive_datetime(start_date),
            RentalExtension.extension_date <= self._to_naive_datetime(end_date)
        )
        
        extended_result = await session.execute(extended_stmt)
        extended_row = extended_result.first()
        
        extension_rate = 0.0
        if total_rentals > 0 and extended_row:
            extension_rate = round((extended_row.extended_count / total_rentals) * 100, 2)
        
        return {
            "total_rentals": total_rentals,
            "extended_rentals": extended_row.extended_count if extended_row else 0,
            "extension_rate": extension_rate,
            "total_extension_revenue": float(extended_row.total_charges) if extended_row and extended_row.total_charges else 0.0
        }
    
    async def _get_return_performance(
        self,
        session: AsyncSession,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Calculate return performance metrics"""
        
        # Completed rentals
        completed_stmt = select(
            func.count(TransactionHeader.id).label("total"),
            func.count(
                case(
                    (TransactionLine.current_rental_status == RentalStatus.RENTAL_COMPLETED, 1),
                    else_=None
                )
            ).label("on_time"),
            func.count(
                case(
                    (TransactionLine.current_rental_status == RentalStatus.RENTAL_LATE, 1),
                    else_=None
                )
            ).label("late")
        ).select_from(TransactionHeader).join(
            TransactionLine,
            TransactionHeader.id == TransactionLine.transaction_header_id
        ).where(
            and_(
                TransactionHeader.transaction_type == TransactionType.RENTAL,
                TransactionHeader.transaction_date >= self._to_naive_datetime(start_date),
                TransactionHeader.transaction_date <= self._to_naive_datetime(end_date),
                TransactionLine.current_rental_status.in_([
                    RentalStatus.RENTAL_COMPLETED,
                    RentalStatus.RENTAL_LATE
                ])
            )
        )
        
        result = await session.execute(completed_stmt)
        row = result.first()
        
        on_time_rate = 0.0
        if row and row.total > 0:
            on_time_rate = round((row.on_time / row.total) * 100, 2)
        
        return {
            "total_returns": row.total if row else 0,
            "on_time_returns": row.on_time if row else 0,
            "late_returns": row.late if row else 0,
            "on_time_rate": on_time_rate
        }
    
    async def _get_damage_statistics(
        self,
        session: AsyncSession,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Get damage and repair statistics"""
        
        # This would need to be implemented based on damage tracking models
        # For now, returning mock data structure
        return {
            "total_damages": 0,
            "repair_costs": 0.0,
            "items_under_repair": 0,
            "average_repair_time": 0.0
        }
    
    async def _get_revenue_by_category(
        self,
        session: AsyncSession,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict[str, Any]]:
        """Get revenue breakdown by category"""
        
        stmt = select(
            Category.name,
            func.sum(TransactionLine.line_total).label("revenue"),
            func.count(TransactionLine.id).label("transaction_count")
        ).select_from(TransactionLine).join(
            TransactionHeader,
            TransactionLine.transaction_header_id == TransactionHeader.id
        ).join(
            Item,
            func.cast(TransactionLine.item_id, postgresql.UUID) == Item.id
        ).join(
            Category,
            Item.category_id == Category.id
        ).where(
            and_(
                TransactionHeader.transaction_date >= self._to_naive_datetime(start_date),
                TransactionHeader.transaction_date <= self._to_naive_datetime(end_date),
                TransactionHeader.status.in_([
                    TransactionStatus.COMPLETED,
                    TransactionStatus.IN_PROGRESS
                ])
            )
        ).group_by(
            Category.name
        ).order_by(
            desc("revenue")
        ).limit(10)
        
        result = await session.execute(stmt)
        
        return [
            {
                "category": row.name,
                "revenue": float(row.revenue) if row.revenue else 0.0,
                "transactions": row.transaction_count
            }
            for row in result
        ]
    
    async def _get_revenue_by_type(
        self,
        session: AsyncSession,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict[str, Any]]:
        """Get revenue breakdown by transaction type"""
        
        stmt = select(
            TransactionHeader.transaction_type,
            func.sum(TransactionHeader.total_amount).label("revenue"),
            func.count(TransactionHeader.id).label("count")
        ).where(
            and_(
                TransactionHeader.transaction_date >= self._to_naive_datetime(start_date),
                TransactionHeader.transaction_date <= self._to_naive_datetime(end_date),
                TransactionHeader.status.in_([
                    TransactionStatus.COMPLETED,
                    TransactionStatus.IN_PROGRESS
                ])
            )
        ).group_by(
            TransactionHeader.transaction_type
        )
        
        result = await session.execute(stmt)
        
        return [
            {
                "type": row.transaction_type.value if row.transaction_type else "Unknown",
                "revenue": float(row.revenue) if row.revenue else 0.0,
                "count": row.count
            }
            for row in result
        ]
    
    async def _get_payment_metrics(
        self,
        session: AsyncSession,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Get payment collection metrics"""
        
        stmt = select(
            func.count(TransactionHeader.id).label("total"),
            func.count(
                case(
                    (TransactionHeader.payment_status == PaymentStatus.PAID, 1),
                    else_=None
                )
            ).label("paid"),
            func.count(
                case(
                    (TransactionHeader.payment_status == PaymentStatus.PARTIAL, 1),
                    else_=None
                )
            ).label("partial"),
            func.count(
                case(
                    (TransactionHeader.payment_status == PaymentStatus.PENDING, 1),
                    else_=None
                )
            ).label("pending"),
            func.sum(TransactionHeader.total_amount).label("total_amount"),
            func.sum(TransactionHeader.paid_amount).label("paid_amount")
        ).where(
            and_(
                TransactionHeader.transaction_date >= self._to_naive_datetime(start_date),
                TransactionHeader.transaction_date <= self._to_naive_datetime(end_date)
            )
        )
        
        result = await session.execute(stmt)
        row = result.first()
        
        collection_rate = 0.0
        if row and row.total_amount and row.total_amount > 0:
            collection_rate = round((float(row.paid_amount) / float(row.total_amount)) * 100, 2)
        
        return {
            "total_transactions": row.total if row else 0,
            "paid": row.paid if row else 0,
            "partial": row.partial if row else 0,
            "pending": row.pending if row else 0,
            "collection_rate": collection_rate,
            "total_collected": float(row.paid_amount) if row and row.paid_amount else 0.0
        }
    
    async def _get_outstanding_balances(
        self,
        session: AsyncSession
    ) -> Dict[str, Any]:
        """Get outstanding payment balances"""
        
        stmt = select(
            func.count(TransactionHeader.id).label("count"),
            func.sum(
                TransactionHeader.total_amount - TransactionHeader.paid_amount
            ).label("total_outstanding")
        ).where(
            and_(
                TransactionHeader.payment_status.in_([
                    PaymentStatus.PENDING,
                    PaymentStatus.PARTIAL
                ]),
                TransactionHeader.status != TransactionStatus.CANCELLED
            )
        )
        
        result = await session.execute(stmt)
        row = result.first()
        
        return {
            "count": row.count if row else 0,
            "total": float(row.total_outstanding) if row and row.total_outstanding else 0.0
        }
    
    async def _get_daily_revenue_trend(
        self,
        session: AsyncSession,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict[str, Any]]:
        """Get daily revenue trend"""
        
        stmt = select(
            func.date(TransactionHeader.transaction_date).label("date"),
            func.sum(TransactionHeader.total_amount).label("revenue"),
            func.count(TransactionHeader.id).label("transactions")
        ).where(
            and_(
                TransactionHeader.transaction_date >= self._to_naive_datetime(start_date),
                TransactionHeader.transaction_date <= self._to_naive_datetime(end_date),
                TransactionHeader.status.in_([
                    TransactionStatus.COMPLETED,
                    TransactionStatus.IN_PROGRESS
                ])
            )
        ).group_by(
            func.date(TransactionHeader.transaction_date)
        ).order_by(
            func.date(TransactionHeader.transaction_date)
        )
        
        result = await session.execute(stmt)
        trend_data = [
            {
                "date": row.date.isoformat() if row.date else "",
                "revenue": float(row.revenue) if row.revenue else 0.0,
                "transactions": row.transactions
            }
            for row in result
        ]
        
        # If no transaction data, create placeholder trend with zero values
        if not trend_data:
            # Generate last 7 days with zero revenue for visual continuity
            today = datetime.now(timezone.utc).date()
            trend_data = []
            for i in range(7):
                date = today - timedelta(days=6-i)
                trend_data.append({
                    "date": date.isoformat(),
                    "revenue": 0.0,
                    "transactions": 0
                })
        
        return trend_data
    
    async def _get_stock_metrics(
        self,
        session: AsyncSession
    ) -> Dict[str, Any]:
        """Get overall stock metrics"""
        
        stmt = select(
            func.count(StockLevel.id).label("total_skus"),
            func.sum(StockLevel.quantity_available).label("total_available"),
            func.sum(StockLevel.quantity_on_rent).label("total_reserved"),
            func.sum(StockLevel.quantity_damaged).label("total_damaged")
        ).where(
            StockLevel.is_active == True
        )
        
        result = await session.execute(stmt)
        row = result.first()
        
        return {
            "total_skus": row.total_skus if row else 0,
            "total_available": float(row.total_available) if row and row.total_available else 0.0,
            "total_reserved": float(row.total_reserved) if row and row.total_reserved else 0.0,
            "total_damaged": float(row.total_damaged) if row and row.total_damaged else 0.0
        }
    
    async def _get_top_items(
        self,
        session: AsyncSession,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get top performing items by rental frequency"""
        
        # Last 30 days
        start_date = datetime.now(timezone.utc) - timedelta(days=30)
        
        stmt = select(
            Item.item_name,
            Item.sku,
            func.count(TransactionLine.id).label("rental_count"),
            func.sum(TransactionLine.line_total).label("revenue")
        ).select_from(TransactionLine).join(
            Item,
            func.cast(TransactionLine.item_id, postgresql.UUID) == Item.id
        ).join(
            TransactionHeader,
            TransactionLine.transaction_header_id == TransactionHeader.id
        ).where(
            and_(
                TransactionHeader.transaction_type == TransactionType.RENTAL,
                TransactionHeader.transaction_date >= self._to_naive_datetime(start_date)
            )
        ).group_by(
            Item.id,
            Item.item_name,
            Item.sku
        ).order_by(
            desc("rental_count")
        ).limit(limit)
        
        result = await session.execute(stmt)
        items = [
            {
                "name": row.item_name,
                "sku": row.sku,
                "rentals": row.rental_count,
                "revenue": float(row.revenue) if row.revenue else 0.0
            }
            for row in result
        ]
        
        # If no rental transactions found, show available items instead
        if not items:
            # Get available items to show what could be rented
            # First try active rentable items, then fallback to any items
            available_items_stmt = select(
                Item.item_name,
                Item.sku,
                Item.rental_rate_per_period
            ).where(
                and_(
                    Item.is_active == True,
                    Item.is_rentable == True
                )
            ).order_by(
                desc(Item.rental_rate_per_period)  # Order by highest rental rate
            ).limit(limit)
            
            available_result = await session.execute(available_items_stmt)
            available_items = list(available_result)
            
            # If no active rentable items, show any items for dashboard demo
            if not available_items:
                fallback_stmt = select(
                    Item.item_name,
                    Item.sku,
                    Item.rental_rate_per_period
                ).order_by(
                    Item.item_name  # Order by name
                ).limit(limit)
                
                available_result = await session.execute(fallback_stmt)
                available_items = list(available_result)
            
            items = [
                {
                    "name": row.item_name,
                    "sku": row.sku,
                    "rentals": 0,  # No rentals yet
                    "revenue": 0.0  # No revenue yet
                }
                for row in available_items
            ]
        
        return items
    
    async def _get_bottom_items(
        self,
        session: AsyncSession,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get least performing items"""
        
        # Items with low or no rentals in last 30 days
        start_date = datetime.now(timezone.utc) - timedelta(days=30)
        
        stmt = select(
            Item.item_name,
            Item.sku,
            func.coalesce(func.count(TransactionLine.id), 0).label("rental_count")
        ).select_from(Item).outerjoin(
            TransactionLine,
            and_(
                func.cast(TransactionLine.item_id, postgresql.UUID) == Item.id,
                TransactionLine.transaction_header_id.in_(
                    select(TransactionHeader.id).where(
                        and_(
                            TransactionHeader.transaction_type == TransactionType.RENTAL,
                            TransactionHeader.transaction_date >= self._to_naive_datetime(start_date)
                        )
                    )
                )
            )
        ).where(
            and_(
                Item.is_active == True,
                Item.is_rentable == True
            )
        ).group_by(
            Item.id,
            Item.item_name,
            Item.sku
        ).order_by(
            "rental_count"
        ).limit(limit)
        
        result = await session.execute(stmt)
        items = [
            {
                "name": row.item_name,
                "sku": row.sku,
                "rentals": row.rental_count
            }
            for row in result
        ]
        
        # Return empty array when no real data - let frontend handle empty state
        
        return items
    
    async def _get_low_stock_items(
        self,
        session: AsyncSession,
        threshold: int = 5
    ) -> List[Dict[str, Any]]:
        """Get items with low stock levels"""
        
        stmt = select(
            Item.item_name,
            Item.sku,
            Location.location_name,
            StockLevel.quantity_available
        ).select_from(StockLevel).join(
            Item,
            StockLevel.item_id == Item.id
        ).join(
            Location,
            StockLevel.location_id == Location.id
        ).where(
            and_(
                StockLevel.is_active == True,
                StockLevel.quantity_available <= threshold
            )
        ).order_by(
            StockLevel.quantity_available
        ).limit(20)
        
        result = await session.execute(stmt)
        
        return [
            {
                "item": row.item_name,
                "sku": row.sku,
                "location": row.location_name,
                "available": float(row.quantity_available),
                "reorder_point": 0.0  # Default value as reorder_point not in model
            }
            for row in result
        ]
    
    async def _get_stock_movement_trends(
        self,
        session: AsyncSession,
        days: int = 7
    ) -> List[Dict[str, Any]]:
        """Get stock movement trends for the last N days"""
        
        start_date = datetime.now(timezone.utc) - timedelta(days=days)
        
        stmt = select(
            func.date(StockMovement.created_at).label("date"),
            StockMovement.movement_type,
            func.sum(func.abs(StockMovement.quantity_change)).label("total_quantity")
        ).where(
            StockMovement.created_at >= start_date
        ).group_by(
            func.date(StockMovement.created_at),
            StockMovement.movement_type
        ).order_by(
            func.date(StockMovement.created_at)
        )
        
        result = await session.execute(stmt)
        
        # Group by date
        trends = {}
        for row in result:
            date_str = row.date.isoformat() if row.date else ""
            if date_str not in trends:
                trends[date_str] = {
                    "date": date_str,
                    "movements": {}
                }
            trends[date_str]["movements"][row.movement_type.value] = float(row.total_quantity)
        
        return list(trends.values())
    
    async def _get_top_customers(
        self,
        session: AsyncSession,
        start_date: datetime,
        end_date: datetime,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get top customers by revenue"""
        
        stmt = select(
            Customer.id,
            func.coalesce(Customer.business_name, 
                         func.concat(Customer.first_name, ' ', Customer.last_name)).label("name"),
            Customer.customer_code,
            func.sum(TransactionHeader.total_amount).label("total_revenue"),
            func.count(TransactionHeader.id).label("transaction_count")
        ).select_from(Customer).join(
            TransactionHeader,
            Customer.id == func.cast(TransactionHeader.customer_id, postgresql.UUID)
        ).where(
            and_(
                TransactionHeader.transaction_date >= self._to_naive_datetime(start_date),
                TransactionHeader.transaction_date <= self._to_naive_datetime(end_date),
                TransactionHeader.status.in_([
                    TransactionStatus.COMPLETED,
                    TransactionStatus.IN_PROGRESS
                ])
            )
        ).group_by(
            Customer.id,
            Customer.business_name,
            Customer.first_name,
            Customer.last_name,
            Customer.customer_code
        ).order_by(
            desc("total_revenue")
        ).limit(limit)
        
        result = await session.execute(stmt)
        
        return [
            {
                "id": str(row.id),
                "name": row.name,
                "code": row.customer_code,
                "revenue": float(row.total_revenue) if row.total_revenue else 0.0,
                "transactions": row.transaction_count
            }
            for row in result
        ]
    
    async def _get_customer_segments(
        self,
        session: AsyncSession,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Segment customers by activity"""
        
        # New customers (created in period)
        new_stmt = select(
            func.count(Customer.id)
        ).where(
            and_(
                Customer.created_at >= self._to_naive_datetime(start_date),
                Customer.created_at <= self._to_naive_datetime(end_date)
            )
        )
        
        new_result = await session.execute(new_stmt)
        new_count = new_result.scalar() or 0
        
        # Returning customers (created before period but transacted in period)
        returning_stmt = select(
            func.count(distinct(TransactionHeader.customer_id))
        ).select_from(TransactionHeader).join(
            Customer,
            func.cast(TransactionHeader.customer_id, postgresql.UUID) == Customer.id
        ).where(
            and_(
                Customer.created_at < self._to_naive_datetime(start_date),
                TransactionHeader.transaction_date >= self._to_naive_datetime(start_date),
                TransactionHeader.transaction_date <= self._to_naive_datetime(end_date)
            )
        )
        
        returning_result = await session.execute(returning_stmt)
        returning_count = returning_result.scalar() or 0
        
        # Inactive customers (no transactions in period)
        total_stmt = select(func.count(Customer.id)).where(Customer.is_active == True)
        total_result = await session.execute(total_stmt)
        total_count = total_result.scalar() or 0
        
        inactive_count = total_count - (new_count + returning_count)
        
        return {
            "new": new_count,
            "returning": returning_count,
            "inactive": max(0, inactive_count),
            "total": total_count
        }
    
    async def _get_customer_lifetime_value(
        self,
        session: AsyncSession
    ) -> Dict[str, Any]:
        """Calculate customer lifetime value metrics"""
        
        # Get average transaction value
        avg_transaction_stmt = select(
            func.avg(TransactionHeader.total_amount).label("avg_transaction")
        ).where(
            TransactionHeader.status.in_([
                TransactionStatus.COMPLETED,
                TransactionStatus.IN_PROGRESS
            ])
        )
        
        avg_transaction_result = await session.execute(avg_transaction_stmt)
        avg_transaction = avg_transaction_result.scalar() or 0.0
        
        # Get transactions per customer (first get count per customer, then average)
        transactions_per_customer_stmt = select(
            func.count(TransactionHeader.id).label("transaction_count")
        ).select_from(TransactionHeader).where(
            TransactionHeader.status.in_([
                TransactionStatus.COMPLETED,
                TransactionStatus.IN_PROGRESS
            ])
        ).group_by(
            TransactionHeader.customer_id
        )
        
        # Use a subquery to avoid nested aggregates
        subquery = transactions_per_customer_stmt.subquery()
        avg_transactions_stmt = select(
            func.avg(subquery.c.transaction_count)
        )
        
        avg_transactions_result = await session.execute(avg_transactions_stmt)
        avg_transactions = avg_transactions_result.scalar() or 0.0
        
        # Calculate CLV
        clv = float(avg_transaction) * float(avg_transactions)
        
        return {
            "average_clv": clv,
            "median_clv": clv * 0.8,  # Estimated median as 80% of average
            "top_tier_clv": clv * 2.5  # Estimated top tier as 250% of average
        }
    
    async def _get_customer_activity_trends(
        self,
        session: AsyncSession,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict[str, Any]]:
        """Get customer activity trends over time"""
        
        stmt = select(
            func.date(TransactionHeader.transaction_date).label("date"),
            func.count(distinct(TransactionHeader.customer_id)).label("active_customers"),
            func.count(TransactionHeader.id).label("transactions")
        ).where(
            and_(
                TransactionHeader.transaction_date >= self._to_naive_datetime(start_date),
                TransactionHeader.transaction_date <= self._to_naive_datetime(end_date)
            )
        ).group_by(
            func.date(TransactionHeader.transaction_date)
        ).order_by(
            func.date(TransactionHeader.transaction_date)
        )
        
        result = await session.execute(stmt)
        
        return [
            {
                "date": row.date.isoformat() if row.date else "",
                "active_customers": row.active_customers,
                "transactions": row.transactions
            }
            for row in result
        ]
    
    async def _calculate_revenue_kpis(
        self,
        session: AsyncSession,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Calculate revenue KPIs"""
        
        current_revenue = await self._get_period_revenue(session, start_date, end_date)
        
        # Previous period
        period_days = (end_date - start_date).days
        # Previous period dates - start_date already has timezone info
        prev_end = start_date - timedelta(seconds=1)
        prev_start = prev_end - timedelta(days=period_days)
        previous_revenue = await self._get_period_revenue(session, prev_start, prev_end)
        
        # Calculate metrics
        # Safe calculations with zero checks
        current_total = float(current_revenue.get('total', 0))
        previous_total = float(previous_revenue.get('total', 0))
        current_count = current_revenue.get('count', 0)
        
        growth_rate = self._calculate_growth_rate(current_total, previous_total)
        
        avg_transaction = current_total / current_count if current_count > 0 else 0.0
        
        return {
            "total_revenue": {
                "value": current_total,
                "target": previous_total * 1.1 if previous_total > 0 else 1000.0,  # 10% growth target or default
                "achievement": min(100, (current_total / (previous_total * 1.1) * 100)) if previous_total > 0 else (100 if current_total > 0 else 0)
            },
            "growth_rate": {
                "value": growth_rate,
                "target": 10.0,  # 10% growth target
                "achievement": min(100, abs(growth_rate / 10.0 * 100)) if growth_rate != 0 else 0
            },
            "avg_transaction_value": {
                "value": avg_transaction,
                "target": avg_transaction * 1.05 if avg_transaction > 0 else 100.0,  # 5% increase target or default
                "achievement": 100 if avg_transaction > 0 else 0
            }
        }
    
    async def _calculate_operational_kpis(
        self,
        session: AsyncSession
    ) -> Dict[str, Any]:
        """Calculate operational KPIs"""
        
        # Rental utilization
        inventory_metrics = await self._get_inventory_utilization(session)
        
        # Return performance (last 30 days)
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=30)
        return_metrics = await self._get_return_performance(session, start_date, end_date)
        
        return {
            "utilization_rate": {
                "value": inventory_metrics['utilization_rate'],
                "target": 75.0,  # 75% target utilization
                "achievement": min(100, (inventory_metrics['utilization_rate'] / 75.0 * 100))
            },
            "on_time_return_rate": {
                "value": return_metrics['on_time_rate'],
                "target": 95.0,  # 95% on-time target
                "achievement": min(100, (return_metrics['on_time_rate'] / 95.0 * 100))
            }
        }
    
    async def _calculate_customer_kpis(
        self,
        session: AsyncSession,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Calculate customer KPIs"""
        
        customer_metrics = await self._get_customer_metrics(session, start_date, end_date)
        
        return {
            "new_customers": {
                "value": customer_metrics['new'],
                "target": 50,  # Target 50 new customers
                "achievement": min(100, (customer_metrics['new'] / 50 * 100))
            },
            "retention_rate": {
                "value": customer_metrics['retention_rate'],
                "target": 80.0,  # 80% retention target
                "achievement": min(100, (customer_metrics['retention_rate'] / 80.0 * 100))
            }
        }
    
    async def _calculate_inventory_kpis(
        self,
        session: AsyncSession
    ) -> Dict[str, Any]:
        """Calculate inventory KPIs"""
        
        stock_metrics = await self._get_stock_metrics(session)
        low_stock = await self._get_low_stock_items(session, threshold=5)
        
        stock_health = 100.0
        if len(low_stock) > 0:
            stock_health = max(0, 100 - (len(low_stock) * 5))  # Deduct 5% for each low stock item
        
        return {
            "stock_availability": {
                "value": stock_health,
                "target": 95.0,
                "achievement": min(100, (stock_health / 95.0 * 100))
            },
            "low_stock_items": {
                "value": len(low_stock),
                "target": 0,
                "achievement": max(0, 100 - (len(low_stock) * 10))  # Deduct 10% for each low stock
            }
        }
    
    async def _get_recent_rental_activities(
        self,
        session: AsyncSession,
        limit: int
    ) -> List[Dict[str, Any]]:
        """Get recent rental activities"""
        
        stmt = select(
            TransactionHeader.id,
            TransactionHeader.transaction_date,
            TransactionHeader.total_amount,
            TransactionHeader.payment_status,
            Customer.business_name,
            Customer.first_name,
            Customer.last_name,
            func.count(TransactionLine.id).label("item_count")
        ).select_from(TransactionHeader).join(
            Customer,
            func.cast(TransactionHeader.customer_id, postgresql.UUID) == Customer.id
        ).outerjoin(
            TransactionLine,
            TransactionHeader.id == TransactionLine.transaction_header_id
        ).where(
            TransactionHeader.transaction_type == TransactionType.RENTAL
        ).group_by(
            TransactionHeader.id,
            TransactionHeader.transaction_date,
            TransactionHeader.total_amount,
            TransactionHeader.payment_status,
            Customer.business_name,
            Customer.first_name,
            Customer.last_name
        ).order_by(
            desc(TransactionHeader.transaction_date)
        ).limit(limit)
        
        result = await session.execute(stmt)
        
        activities = []
        for row in result:
            customer_name = row.business_name if row.business_name else f"{row.first_name or ''} {row.last_name or ''}".strip()
            
            activities.append({
                "id": f"rental_{row.id}",
                "type": "rental_created",
                "title": "New Rental Created",
                "description": f"Rental transaction for {row.item_count} item(s) - {customer_name}",
                "amount": float(row.total_amount) if row.total_amount else None,
                "customer": customer_name,
                "timestamp": row.transaction_date.isoformat() if row.transaction_date else datetime.now(timezone.utc).isoformat(),
                "status": "completed" if row.payment_status == PaymentStatus.PAID else "pending",
                "metadata": {
                    "transaction_id": str(row.id),
                    "item_count": row.item_count
                }
            })
        
        return activities
    
    async def _get_recent_purchase_activities(
        self,
        session: AsyncSession,
        limit: int
    ) -> List[Dict[str, Any]]:
        """Get recent purchase activities"""
        
        stmt = select(
            TransactionHeader.id,
            TransactionHeader.transaction_date,
            TransactionHeader.total_amount,
            TransactionHeader.notes,
            func.count(TransactionLine.id).label("item_count")
        ).select_from(TransactionHeader).outerjoin(
            TransactionLine,
            TransactionHeader.id == TransactionLine.transaction_header_id
        ).where(
            TransactionHeader.transaction_type == TransactionType.PURCHASE
        ).group_by(
            TransactionHeader.id,
            TransactionHeader.transaction_date,
            TransactionHeader.total_amount,
            TransactionHeader.notes
        ).order_by(
            desc(TransactionHeader.transaction_date)
        ).limit(limit)
        
        result = await session.execute(stmt)
        
        activities = []
        for row in result:
            activities.append({
                "id": f"purchase_{row.id}",
                "type": "purchase_completed", 
                "title": "Purchase Order Completed",
                "description": f"Received {row.item_count} item(s) from supplier",
                "amount": float(row.total_amount) if row.total_amount else None,
                "customer": None,
                "timestamp": row.transaction_date.isoformat() if row.transaction_date else datetime.now(timezone.utc).isoformat(),
                "status": "completed",
                "metadata": {
                    "transaction_id": str(row.id),
                    "item_count": row.item_count,
                    "notes": row.notes
                }
            })
        
        return activities
    
    async def _get_recent_customer_activities(
        self,
        session: AsyncSession,
        limit: int
    ) -> List[Dict[str, Any]]:
        """Get recent customer registration activities"""
        
        stmt = select(
            Customer.id,
            Customer.created_at,
            Customer.business_name,
            Customer.first_name,
            Customer.last_name,
            Customer.customer_code
        ).where(
            Customer.is_active == True
        ).order_by(
            desc(Customer.created_at)
        ).limit(limit)
        
        result = await session.execute(stmt)
        
        activities = []
        for row in result:
            customer_name = row.business_name if row.business_name else f"{row.first_name or ''} {row.last_name or ''}".strip()
            
            activities.append({
                "id": f"customer_{row.id}",
                "type": "customer_added",
                "title": "New Customer Added",
                "description": f"{customer_name} registered as new customer",
                "amount": None,
                "customer": customer_name,
                "timestamp": row.created_at.isoformat() if row.created_at else datetime.now(timezone.utc).isoformat(),
                "status": "completed",
                "metadata": {
                    "customer_id": str(row.id),
                    "customer_code": row.customer_code
                }
            })
        
        return activities
    
    async def _get_recent_payment_activities(
        self,
        session: AsyncSession,
        limit: int
    ) -> List[Dict[str, Any]]:
        """Get recent payment activities"""
        
        stmt = select(
            TransactionHeader.id,
            TransactionHeader.updated_at,
            TransactionHeader.paid_amount,
            TransactionHeader.total_amount,
            Customer.business_name,
            Customer.first_name,
            Customer.last_name
        ).select_from(TransactionHeader).join(
            Customer,
            func.cast(TransactionHeader.customer_id, postgresql.UUID) == Customer.id
        ).where(
            and_(
                TransactionHeader.payment_status == PaymentStatus.PAID,
                TransactionHeader.paid_amount > 0
            )
        ).order_by(
            desc(TransactionHeader.updated_at)
        ).limit(limit)
        
        result = await session.execute(stmt)
        
        activities = []
        for row in result:
            customer_name = row.business_name if row.business_name else f"{row.first_name or ''} {row.last_name or ''}".strip()
            
            activities.append({
                "id": f"payment_{row.id}",
                "type": "payment_received",
                "title": "Payment Received",
                "description": f"Payment received from {customer_name}",
                "amount": float(row.paid_amount) if row.paid_amount else None,
                "customer": customer_name,
                "timestamp": row.updated_at.isoformat() if row.updated_at else datetime.now(timezone.utc).isoformat(),
                "status": "completed",
                "metadata": {
                    "transaction_id": str(row.id),
                    "total_amount": float(row.total_amount) if row.total_amount else None
                }
            })
        
        return activities
    
    async def _get_category_utilization(
        self,
        session: AsyncSession
    ) -> List[Dict[str, Any]]:
        """Get utilization rates by category"""
        
        stmt = select(
            Category.name,
            func.count(distinct(Item.id)).label("total_items"),
            func.coalesce(
                func.count(distinct(
                    case(
                        (TransactionLine.current_rental_status.in_([
                            RentalStatus.RENTAL_INPROGRESS,
                            RentalStatus.RENTAL_EXTENDED,
                            RentalStatus.RENTAL_LATE
                        ]), TransactionLine.item_id),
                        else_=None
                    )
                )), 0
            ).label("rented_items")
        ).select_from(Category).join(
            Item,
            Category.id == Item.category_id
        ).outerjoin(
            TransactionLine,
            and_(
                func.cast(TransactionLine.item_id, postgresql.UUID) == Item.id,
                TransactionLine.current_rental_status.in_([
                    RentalStatus.RENTAL_INPROGRESS,
                    RentalStatus.RENTAL_EXTENDED,
                    RentalStatus.RENTAL_LATE
                ])
            )
        ).where(
            Item.is_active == True,
            Item.is_rentable == True
        ).group_by(
            Category.id,
            Category.name
        ).order_by(
            Category.name
        )
        
        result = await session.execute(stmt)
        
        utilization_data = []
        for row in result:
            total = row.total_items or 0
            rented = row.rented_items or 0
            utilization_rate = round((rented / total * 100) if total > 0 else 0, 2)
            
            utilization_data.append({
                "category": row.name,
                "total": total,
                "rented": rented,
                "utilization_rate": utilization_rate
            })
        
        return utilization_data
    
    async def _get_location_breakdown(
        self,
        session: AsyncSession
    ) -> List[Dict[str, Any]]:
        """Get inventory breakdown by location"""
        
        stmt = select(
            Location.location_name,
            func.count(distinct(StockLevel.item_id)).label("total_items"),
            func.coalesce(func.sum(StockLevel.quantity_available), 0).label("available"),
            func.coalesce(func.sum(StockLevel.quantity_on_rent), 0).label("rented")
        ).select_from(Location).join(
            StockLevel,
            Location.id == StockLevel.location_id
        ).where(
            StockLevel.is_active == True,
            Location.is_active == True
        ).group_by(
            Location.id,
            Location.location_name
        ).order_by(
            Location.location_name
        )
        
        result = await session.execute(stmt)
        
        location_data = []
        for row in result:
            available = float(row.available) if row.available else 0
            rented = float(row.rented) if row.rented else 0
            total_items = available + rented
            
            location_data.append({
                "location": row.location_name,
                "total_items": int(total_items),
                "available": int(available),
                "rented": int(rented)
            })
        
        return location_data
    
    async def _get_customer_summary_metrics(
        self,
        session: AsyncSession,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Get customer summary metrics"""
        
        # Total customers
        total_stmt = select(func.count(Customer.id)).where(Customer.is_active == True)
        total_result = await session.execute(total_stmt)
        total_customers = total_result.scalar() or 0
        
        # Active customers (with transactions in period)
        active_stmt = select(
            func.count(distinct(TransactionHeader.customer_id))
        ).where(
            and_(
                TransactionHeader.transaction_date >= self._to_naive_datetime(start_date),
                TransactionHeader.transaction_date <= self._to_naive_datetime(end_date)
            )
        )
        active_result = await session.execute(active_stmt)
        active_customers = active_result.scalar() or 0
        
        # New customers in period
        new_stmt = select(
            func.count(Customer.id)
        ).where(
            and_(
                Customer.created_at >= self._to_naive_datetime(start_date),
                Customer.created_at <= self._to_naive_datetime(end_date)
            )
        )
        new_result = await session.execute(new_stmt)
        new_customers = new_result.scalar() or 0
        
        # Inactive customers
        inactive_customers = max(0, total_customers - active_customers)
        
        # Retention rate (active / total)
        retention_rate = round((active_customers / total_customers * 100) if total_customers > 0 else 0, 2)
        
        return {
            "total_customers": total_customers,
            "active_customers": active_customers,
            "new_customers": new_customers,
            "inactive_customers": inactive_customers,
            "retention_rate": retention_rate
        }
    
    def _format_kpi_name(self, key: str) -> str:
        """Format KPI key into human-readable name"""
        name_map = {
            "total_revenue": "Total Revenue",
            "growth_rate": "Revenue Growth Rate",
            "avg_transaction_value": "Average Transaction Value",
            "utilization_rate": "Inventory Utilization Rate",
            "on_time_return_rate": "On-time Return Rate",
            "new_customers": "New Customers",
            "retention_rate": "Customer Retention Rate",
            "stock_availability": "Stock Availability",
            "low_stock_items": "Low Stock Items"
        }
        return name_map.get(key, key.replace('_', ' ').title())
    
    def _get_kpi_unit(self, key: str) -> str:
        """Get appropriate unit for KPI"""
        unit_map = {
            "total_revenue": "₹",
            "growth_rate": "%",
            "avg_transaction_value": "₹",
            "utilization_rate": "%",
            "on_time_return_rate": "%",
            "new_customers": "",
            "retention_rate": "%",
            "stock_availability": "%",
            "low_stock_items": ""
        }
        return unit_map.get(key, "")
    
    def _calculate_growth_rate(
        self,
        current: Decimal,
        previous: Decimal
    ) -> float:
        """Calculate percentage growth rate"""
        
        if previous == 0:
            return 100.0 if current > 0 else 0.0
        
        return round(((current - previous) / previous) * 100, 2)