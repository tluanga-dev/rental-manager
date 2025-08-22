"""
Conflict Detection Engine

Core engine for detecting conflicts that prevent sale transitions.
"""

import asyncio
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload

from app.modules.sales.models import (
    SaleConflict, ConflictType, ConflictSeverity, ResolutionAction
)
from app.modules.transactions.base.models import TransactionHeader, TransactionLine, TransactionType
from app.modules.transactions.base.models.transaction_headers import RentalStatus
from app.modules.transactions.rentals.rental_booking.models import BookingHeader, BookingLine, BookingStatus
from app.modules.master_data.item_master.models import Item
from app.modules.inventory.models import InventoryUnit
from app.modules.inventory.enums import InventoryUnitStatus as UnitStatus
from app.modules.customers.models import Customer
from app.shared.exceptions import BusinessLogicError
import logging

logger = logging.getLogger(__name__)


class Conflict:
    """Represents a detected conflict"""
    
    def __init__(
        self,
        conflict_type: ConflictType,
        entity_id: UUID,
        entity_type: str,
        severity: ConflictSeverity,
        description: str,
        customer_id: Optional[UUID] = None,
        financial_impact: Optional[Decimal] = None,
        **kwargs
    ):
        self.type = conflict_type
        self.entity_id = entity_id
        self.entity_type = entity_type
        self.severity = severity
        self.description = description
        self.customer_id = customer_id
        self.financial_impact = financial_impact
        self.metadata = kwargs
        self.resolution_options = self._determine_resolution_options()
    
    def _determine_resolution_options(self) -> List[ResolutionAction]:
        """Determine available resolution options based on conflict type"""
        if self.type == ConflictType.ACTIVE_RENTAL:
            return [
                ResolutionAction.WAIT_FOR_RETURN,
                ResolutionAction.POSTPONE_SALE
            ]
        elif self.type in [ConflictType.FUTURE_BOOKING, ConflictType.PENDING_BOOKING]:
            return [
                ResolutionAction.CANCEL_BOOKING,
                ResolutionAction.TRANSFER_TO_ALTERNATIVE,
                ResolutionAction.OFFER_COMPENSATION,
                ResolutionAction.POSTPONE_SALE
            ]
        else:
            return [ResolutionAction.FORCE_SALE, ResolutionAction.POSTPONE_SALE]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert conflict to dictionary"""
        return {
            "type": self.type.value,
            "entity_id": str(self.entity_id),
            "entity_type": self.entity_type,
            "severity": self.severity.value,
            "description": self.description,
            "customer_id": str(self.customer_id) if self.customer_id else None,
            "financial_impact": float(self.financial_impact) if self.financial_impact else None,
            "resolution_options": [opt.value for opt in self.resolution_options],
            **self.metadata
        }


class ConflictReport:
    """Report containing all detected conflicts"""
    
    def __init__(
        self,
        item_id: UUID,
        conflicts: List[Conflict],
        revenue_impact: Decimal,
        check_date: datetime
    ):
        self.item_id = item_id
        self.conflicts = conflicts
        self.revenue_impact = revenue_impact
        self.check_date = check_date
        self.total_conflicts = len(conflicts)
        self.has_conflicts = self.total_conflicts > 0
        self.risk_score = self._calculate_risk_score()
        self.recommendation = self._generate_recommendation()
    
    def _calculate_risk_score(self) -> int:
        """Calculate overall risk score (0-100)"""
        if not self.conflicts:
            return 0
        
        score = 0
        severity_weights = {
            ConflictSeverity.LOW: 10,
            ConflictSeverity.MEDIUM: 25,
            ConflictSeverity.HIGH: 50,
            ConflictSeverity.CRITICAL: 100
        }
        
        for conflict in self.conflicts:
            score += severity_weights.get(conflict.severity, 0)
        
        # Normalize to 0-100
        return min(100, score)
    
    def _generate_recommendation(self) -> str:
        """Generate recommendation based on conflicts"""
        if not self.conflicts:
            return "No conflicts detected. Item can be marked for sale."
        
        critical_conflicts = [c for c in self.conflicts if c.severity == ConflictSeverity.CRITICAL]
        if critical_conflicts:
            return "Critical conflicts detected. Recommend postponing sale until resolved."
        
        if self.risk_score > 75:
            return "High risk conflicts detected. Manager approval required."
        elif self.risk_score > 50:
            return "Moderate conflicts detected. Review resolution options carefully."
        else:
            return "Minor conflicts detected. Can proceed with standard resolution."
    
    def get_affected_customers(self) -> List[UUID]:
        """Get list of affected customer IDs"""
        customers = set()
        for conflict in self.conflicts:
            if conflict.customer_id:
                customers.add(conflict.customer_id)
        return list(customers)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert report to dictionary"""
        return {
            "item_id": str(self.item_id),
            "check_date": self.check_date.isoformat(),
            "total_conflicts": self.total_conflicts,
            "has_conflicts": self.has_conflicts,
            "conflicts": [c.to_dict() for c in self.conflicts],
            "revenue_impact": float(self.revenue_impact),
            "risk_score": self.risk_score,
            "recommendation": self.recommendation,
            "affected_customers": [str(c) for c in self.get_affected_customers()]
        }


class ConflictDetectionEngine:
    """Engine for detecting all conflicts that prevent sale transitions"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def detect_all_conflicts(
        self,
        item_id: UUID,
        check_date: Optional[datetime] = None
    ) -> ConflictReport:
        """
        Detect all conflicts for an item
        
        Args:
            item_id: The item to check
            check_date: Date to check conflicts from (default: now)
        
        Returns:
            ConflictReport with all detected conflicts
        """
        check_date = check_date or datetime.utcnow()
        logger.info(f"Starting conflict detection for item {item_id} at {check_date}")
        
        # Run all detection tasks in parallel
        conflict_tasks = [
            self._detect_rental_conflicts(item_id, check_date),
            self._detect_booking_conflicts(item_id, check_date),
            self._detect_inventory_conflicts(item_id),
            self._detect_maintenance_conflicts(item_id, check_date)
        ]
        
        results = await asyncio.gather(*conflict_tasks, return_exceptions=True)
        
        # Aggregate conflicts
        all_conflicts = []
        for result in results:
            if isinstance(result, list):
                all_conflicts.extend(result)
            elif isinstance(result, Exception):
                logger.error(f"Conflict detection error: {result}")
        
        # Calculate revenue impact
        revenue_impact = await self._calculate_revenue_impact(all_conflicts)
        
        logger.info(f"Detected {len(all_conflicts)} conflicts for item {item_id}")
        
        return ConflictReport(
            item_id=item_id,
            conflicts=all_conflicts,
            revenue_impact=revenue_impact,
            check_date=check_date
        )
    
    async def _detect_rental_conflicts(
        self,
        item_id: UUID,
        check_date: datetime
    ) -> List[Conflict]:
        """Detect active and future rental conflicts"""
        conflicts = []
        
        # Query for active rentals
        query = select(TransactionLine).join(TransactionHeader).where(
            and_(
                TransactionLine.item_id == item_id,
                TransactionHeader.transaction_type == TransactionType.RENTAL,
                TransactionLine.rental_status.in_([
                    RentalStatus.RENTAL_INPROGRESS,
                    RentalStatus.RENTAL_EXTENDED,
                    RentalStatus.RENTAL_PARTIAL_RETURN,
                    RentalStatus.RENTAL_LATE,
                    RentalStatus.RENTAL_LATE_PARTIAL_RETURN
                ]),
                or_(
                    TransactionLine.rental_end_date >= check_date,
                    TransactionLine.rental_end_date.is_(None)
                )
            )
        ).options(selectinload(TransactionLine.transaction))
        
        result = await self.session.execute(query)
        rental_lines = result.scalars().all()
        
        for line in rental_lines:
            # Determine severity based on rental status
            if line.rental_status in [RentalStatus.RENTAL_LATE, RentalStatus.RENTAL_LATE_PARTIAL_RETURN]:
                severity = ConflictSeverity.CRITICAL
            elif line.rental_end_date and (line.rental_end_date - check_date).days <= 7:
                severity = ConflictSeverity.HIGH
            else:
                severity = ConflictSeverity.MEDIUM
            
            conflict = Conflict(
                conflict_type=ConflictType.ACTIVE_RENTAL,
                entity_id=line.id,
                entity_type="transaction_line",
                severity=severity,
                description=f"Item currently rented until {line.rental_end_date or 'indefinite'}",
                customer_id=line.transaction.customer_id,
                financial_impact=line.line_total,
                rental_status=line.rental_status.value,
                rental_end_date=line.rental_end_date.isoformat() if line.rental_end_date else None,
                days_remaining=(line.rental_end_date - check_date).days if line.rental_end_date else None
            )
            conflicts.append(conflict)
        
        logger.debug(f"Found {len(conflicts)} rental conflicts for item {item_id}")
        return conflicts
    
    async def _detect_booking_conflicts(
        self,
        item_id: UUID,
        check_date: datetime
    ) -> List[Conflict]:
        """Detect booking conflicts"""
        conflicts = []
        
        # Query for future bookings
        query = select(BookingLine).join(BookingHeader).where(
            and_(
                BookingLine.item_id == item_id,
                BookingHeader.status.in_([
                    BookingStatus.PENDING,
                    BookingStatus.CONFIRMED
                ]),
                BookingHeader.pickup_date >= check_date.date()
            )
        ).options(selectinload(BookingLine.booking))
        
        result = await self.session.execute(query)
        booking_lines = result.scalars().all()
        
        for line in booking_lines:
            booking = line.booking
            days_until_booking = (booking.pickup_date - check_date.date()).days
            
            # Determine severity based on proximity
            if days_until_booking <= 3:
                severity = ConflictSeverity.CRITICAL
            elif days_until_booking <= 7:
                severity = ConflictSeverity.HIGH
            elif days_until_booking <= 30:
                severity = ConflictSeverity.MEDIUM
            else:
                severity = ConflictSeverity.LOW
            
            # Determine conflict type
            if booking.status == BookingStatus.CONFIRMED:
                conflict_type = ConflictType.FUTURE_BOOKING
                description = f"Confirmed booking scheduled for {booking.pickup_date}"
            else:
                conflict_type = ConflictType.PENDING_BOOKING
                description = f"Pending booking scheduled for {booking.pickup_date}"
            
            conflict = Conflict(
                conflict_type=conflict_type,
                entity_id=booking.id,
                entity_type="booking",
                severity=severity,
                description=description,
                customer_id=booking.customer_id,
                financial_impact=line.line_total,
                booking_status=booking.status.value,
                pickup_date=booking.pickup_date.isoformat(),
                return_date=booking.return_date.isoformat(),
                days_until=days_until_booking,
                quantity=line.quantity
            )
            conflicts.append(conflict)
        
        logger.debug(f"Found {len(conflicts)} booking conflicts for item {item_id}")
        return conflicts
    
    async def _detect_inventory_conflicts(
        self,
        item_id: UUID
    ) -> List[Conflict]:
        """Detect inventory-related conflicts"""
        conflicts = []
        
        # Check for units in non-sellable states
        query = select(InventoryUnit).where(
            and_(
                InventoryUnit.item_id == item_id,
                InventoryUnit.status.in_([
                    UnitStatus.RENTED,
                    UnitStatus.MAINTENANCE,
                    UnitStatus.DAMAGED
                ])
            )
        )
        
        result = await self.session.execute(query)
        problem_units = result.scalars().all()
        
        if problem_units:
            rented_count = sum(1 for u in problem_units if u.status == UnitStatus.RENTED)
            maintenance_count = sum(1 for u in problem_units if u.status == UnitStatus.MAINTENANCE)
            damaged_count = sum(1 for u in problem_units if u.status == UnitStatus.DAMAGED)
            
            if rented_count > 0:
                severity = ConflictSeverity.HIGH
            elif maintenance_count > 0:
                severity = ConflictSeverity.MEDIUM
            else:
                severity = ConflictSeverity.LOW
            
            description_parts = []
            if rented_count > 0:
                description_parts.append(f"{rented_count} units rented")
            if maintenance_count > 0:
                description_parts.append(f"{maintenance_count} units in maintenance")
            if damaged_count > 0:
                description_parts.append(f"{damaged_count} units damaged")
            
            conflict = Conflict(
                conflict_type=ConflictType.CROSS_LOCATION,
                entity_id=item_id,
                entity_type="inventory",
                severity=severity,
                description=f"Inventory issues: {', '.join(description_parts)}",
                customer_id=None,
                financial_impact=None,
                rented_units=rented_count,
                maintenance_units=maintenance_count,
                damaged_units=damaged_count,
                total_problem_units=len(problem_units)
            )
            conflicts.append(conflict)
        
        logger.debug(f"Found {len(conflicts)} inventory conflicts for item {item_id}")
        return conflicts
    
    async def _detect_maintenance_conflicts(
        self,
        item_id: UUID,
        check_date: datetime
    ) -> List[Conflict]:
        """Detect scheduled maintenance conflicts"""
        conflicts = []
        
        # This would check for scheduled maintenance in a maintenance table
        # For now, returning empty as maintenance module is not yet implemented
        # In production, this would query maintenance schedules
        
        logger.debug(f"No maintenance conflicts found for item {item_id}")
        return conflicts
    
    async def _calculate_revenue_impact(
        self,
        conflicts: List[Conflict]
    ) -> Decimal:
        """Calculate total revenue impact of conflicts"""
        total_impact = Decimal("0.00")
        
        for conflict in conflicts:
            if conflict.financial_impact:
                total_impact += conflict.financial_impact
        
        return total_impact
    
    async def save_conflicts(
        self,
        transition_request_id: UUID,
        conflicts: List[Conflict]
    ) -> List[SaleConflict]:
        """Save detected conflicts to database"""
        saved_conflicts = []
        
        for conflict in conflicts:
            db_conflict = SaleConflict(
                transition_request_id=transition_request_id,
                conflict_type=conflict.type,
                entity_type=conflict.entity_type,
                entity_id=conflict.entity_id,
                severity=conflict.severity,
                description=conflict.description,
                customer_id=conflict.customer_id,
                financial_impact=conflict.financial_impact
            )
            self.session.add(db_conflict)
            saved_conflicts.append(db_conflict)
        
        await self.session.flush()
        logger.info(f"Saved {len(saved_conflicts)} conflicts for transition {transition_request_id}")
        
        return saved_conflicts