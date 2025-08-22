"""
CRUD operations for Inventory Unit.

Handles database operations for individual inventory unit management.
"""

from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from decimal import Decimal
from datetime import datetime

from sqlalchemy import select, and_, or_, func, update, desc, distinct
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.crud.inventory.base import CRUDBase
from app.models.inventory.inventory_unit import InventoryUnit
from app.models.inventory.enums import (
    InventoryUnitStatus,
    InventoryUnitCondition,
    get_acceptable_rental_conditions,
    get_rentable_statuses
)
from app.schemas.inventory.inventory_unit import (
    InventoryUnitCreate,
    InventoryUnitUpdate,
    InventoryUnitFilter,
    BatchInventoryUnitCreate,
    UnitStatusChange,
    UnitTransfer,
    RentalBlock,
    MaintenanceSchedule
)


class CRUDInventoryUnit(CRUDBase[InventoryUnit, InventoryUnitCreate, InventoryUnitUpdate]):
    """CRUD operations for inventory units."""
    
    async def create_with_sku(
        self,
        db: AsyncSession,
        *,
        unit_in: InventoryUnitCreate,
        created_by: Optional[UUID] = None,
        auto_generate_sku: bool = False
    ) -> InventoryUnit:
        """
        Create inventory unit with optional SKU generation.
        
        Args:
            db: Database session
            unit_in: Unit creation data
            created_by: User creating the unit
            auto_generate_sku: Generate SKU automatically
            
        Returns:
            Created inventory unit
        """
        unit_data = unit_in.dict()
        
        # Generate SKU if needed
        if auto_generate_sku and not unit_data.get('sku'):
            unit_data['sku'] = await self.generate_sku(
                db,
                item_id=unit_data['item_id']
            )
        
        # Set audit fields
        if created_by:
            unit_data['created_by'] = created_by
            unit_data['updated_by'] = created_by
        
        # Create unit
        unit = InventoryUnit(**unit_data)
        unit.validate()
        
        try:
            db.add(unit)
            await db.flush()
            await db.refresh(unit)
            return unit
            
        except IntegrityError as e:
            await db.rollback()
            if 'serial_number' in str(e):
                raise ValueError(f"Serial number {unit_data.get('serial_number')} already exists")
            elif 'sku' in str(e):
                raise ValueError(f"SKU {unit_data.get('sku')} already exists")
            else:
                raise
    
    async def create_batch(
        self,
        db: AsyncSession,
        *,
        batch_in: BatchInventoryUnitCreate,
        created_by: Optional[UUID] = None
    ) -> List[InventoryUnit]:
        """
        Create multiple inventory units in batch.
        
        Args:
            db: Database session
            batch_in: Batch creation data
            created_by: User creating the units
            
        Returns:
            List of created units
        """
        units = []
        
        # Generate batch code if not provided
        if not batch_in.batch_code:
            batch_in.batch_code = await self.generate_batch_code(
                db,
                item_id=batch_in.item_id
            )
        
        # Create units
        for i in range(batch_in.quantity):
            unit_data = {
                'item_id': batch_in.item_id,
                'location_id': batch_in.location_id,
                'batch_code': batch_in.batch_code,
                'purchase_date': batch_in.purchase_date,
                'purchase_price': batch_in.purchase_price,
                'supplier_id': batch_in.supplier_id,
                'purchase_order_number': batch_in.purchase_order_number,
                'sale_price': batch_in.sale_price,
                'rental_rate_per_period': batch_in.rental_rate_per_period,
                'security_deposit': batch_in.security_deposit,
                'warranty_expiry': batch_in.warranty_expiry,
                'quantity': Decimal("1")
            }
            
            # Add serial number if provided
            if batch_in.serial_numbers and i < len(batch_in.serial_numbers):
                unit_data['serial_number'] = batch_in.serial_numbers[i]
            
            # Generate SKU
            unit_data['sku'] = await self.generate_sku(
                db,
                item_id=batch_in.item_id,
                suffix=f"{i+1:04d}"
            )
            
            # Create unit
            unit = InventoryUnit(**unit_data)
            
            if created_by:
                unit.created_by = created_by
                unit.updated_by = created_by
            
            unit.validate()
            db.add(unit)
            units.append(unit)
        
        # Flush all at once
        await db.flush()
        
        # Refresh all units
        for unit in units:
            await db.refresh(unit)
        
        return units
    
    async def get_by_sku(
        self,
        db: AsyncSession,
        *,
        sku: str
    ) -> Optional[InventoryUnit]:
        """
        Get unit by SKU.
        
        Args:
            db: Database session
            sku: Unit SKU
            
        Returns:
            Unit or None
        """
        query = select(InventoryUnit).where(InventoryUnit.sku == sku)
        result = await db.execute(query)
        return result.scalar_one_or_none()
    
    async def get_by_serial_number(
        self,
        db: AsyncSession,
        *,
        serial_number: str
    ) -> Optional[InventoryUnit]:
        """
        Get unit by serial number.
        
        Args:
            db: Database session
            serial_number: Serial number
            
        Returns:
            Unit or None
        """
        query = select(InventoryUnit).where(
            InventoryUnit.serial_number == serial_number
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()
    
    async def get_by_batch_code(
        self,
        db: AsyncSession,
        *,
        batch_code: str,
        skip: int = 0,
        limit: int = 100
    ) -> List[InventoryUnit]:
        """
        Get units by batch code.
        
        Args:
            db: Database session
            batch_code: Batch code
            skip: Number to skip
            limit: Maximum to return
            
        Returns:
            List of units
        """
        query = (
            select(InventoryUnit)
            .where(InventoryUnit.batch_code == batch_code)
            .offset(skip)
            .limit(limit)
        )
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_available_for_rental(
        self,
        db: AsyncSession,
        *,
        item_id: UUID,
        location_id: UUID,
        quantity_needed: int = 1
    ) -> List[InventoryUnit]:
        """
        Get available units for rental.
        
        Args:
            db: Database session
            item_id: Item ID
            location_id: Location ID
            quantity_needed: Number of units needed
            
        Returns:
            List of available units
        """
        query = (
            select(InventoryUnit)
            .where(
                and_(
                    InventoryUnit.item_id == item_id,
                    InventoryUnit.location_id == location_id,
                    InventoryUnit.status == InventoryUnitStatus.AVAILABLE.value,
                    InventoryUnit.is_rental_blocked == False,
                    InventoryUnit.is_active == True,
                    InventoryUnit.condition.in_([c.value for c in get_acceptable_rental_conditions()])
                )
            )
            .limit(quantity_needed)
        )
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_filtered(
        self,
        db: AsyncSession,
        *,
        filter_params: InventoryUnitFilter,
        skip: int = 0,
        limit: int = 100
    ) -> List[InventoryUnit]:
        """
        Get filtered inventory units.
        
        Args:
            db: Database session
            filter_params: Filter parameters
            skip: Number to skip
            limit: Maximum to return
            
        Returns:
            List of filtered units
        """
        query = select(InventoryUnit)
        
        # Apply filters
        if filter_params.item_id:
            query = query.where(InventoryUnit.item_id == filter_params.item_id)
        
        if filter_params.location_id:
            query = query.where(InventoryUnit.location_id == filter_params.location_id)
        
        if filter_params.supplier_id:
            query = query.where(InventoryUnit.supplier_id == filter_params.supplier_id)
        
        if filter_params.status:
            query = query.where(InventoryUnit.status == filter_params.status.value)
        
        if filter_params.condition:
            query = query.where(InventoryUnit.condition == filter_params.condition.value)
        
        if filter_params.serial_number:
            query = query.where(
                InventoryUnit.serial_number.ilike(f"%{filter_params.serial_number}%")
            )
        
        if filter_params.batch_code:
            query = query.where(InventoryUnit.batch_code == filter_params.batch_code)
        
        if filter_params.barcode:
            query = query.where(InventoryUnit.barcode == filter_params.barcode)
        
        if filter_params.is_available is not None:
            if filter_params.is_available:
                query = query.where(
                    and_(
                        InventoryUnit.status == InventoryUnitStatus.AVAILABLE.value,
                        InventoryUnit.is_rental_blocked == False
                    )
                )
        
        if filter_params.is_rental_blocked is not None:
            query = query.where(
                InventoryUnit.is_rental_blocked == filter_params.is_rental_blocked
            )
        
        if filter_params.is_maintenance_due is not None:
            if filter_params.is_maintenance_due:
                query = query.where(
                    and_(
                        InventoryUnit.next_maintenance_date.isnot(None),
                        InventoryUnit.next_maintenance_date <= datetime.utcnow()
                    )
                )
        
        if filter_params.has_valid_warranty is not None:
            if filter_params.has_valid_warranty:
                query = query.where(
                    and_(
                        InventoryUnit.warranty_expiry.isnot(None),
                        InventoryUnit.warranty_expiry > datetime.utcnow()
                    )
                )
        
        if filter_params.purchase_date_from:
            query = query.where(
                InventoryUnit.purchase_date >= filter_params.purchase_date_from
            )
        
        if filter_params.purchase_date_to:
            query = query.where(
                InventoryUnit.purchase_date <= filter_params.purchase_date_to
            )
        
        if filter_params.min_price is not None:
            query = query.where(InventoryUnit.purchase_price >= filter_params.min_price)
        
        if filter_params.max_price is not None:
            query = query.where(InventoryUnit.purchase_price <= filter_params.max_price)
        
        # Apply ordering and pagination
        query = (
            query.order_by(desc(InventoryUnit.created_at))
            .offset(skip)
            .limit(limit)
        )
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def change_status(
        self,
        db: AsyncSession,
        *,
        unit_id: UUID,
        status_change: UnitStatusChange,
        updated_by: UUID
    ) -> InventoryUnit:
        """
        Change unit status with validation.
        
        Args:
            db: Database session
            unit_id: Unit ID
            status_change: Status change details
            updated_by: User making the change
            
        Returns:
            Updated unit
        """
        # Get unit with lock
        query = (
            select(InventoryUnit)
            .where(InventoryUnit.id == unit_id)
            .with_for_update()
        )
        
        result = await db.execute(query)
        unit = result.scalar_one_or_none()
        
        if not unit:
            raise ValueError(f"Unit {unit_id} not found")
        
        # Handle specific status changes
        if status_change.status == InventoryUnitStatus.RENTED:
            if not unit.can_be_rented():
                raise ValueError("Unit cannot be rented in current state")
            
            if not status_change.customer_id:
                raise ValueError("Customer ID required for rental")
            
            unit.rent_out(
                customer_id=status_change.customer_id,
                updated_by=updated_by
            )
            
        elif status_change.status == InventoryUnitStatus.AVAILABLE:
            if unit.status == InventoryUnitStatus.RENTED.value:
                unit.return_from_rent(
                    condition=status_change.new_condition,
                    updated_by=updated_by
                )
            elif unit.status == InventoryUnitStatus.UNDER_REPAIR.value:
                unit.complete_repair(
                    new_condition=status_change.new_condition or InventoryUnitCondition.GOOD,
                    updated_by=updated_by
                )
            else:
                unit.status = status_change.status.value
                unit.updated_by = updated_by
                unit.version += 1
                
        elif status_change.status == InventoryUnitStatus.UNDER_REPAIR:
            unit.send_for_repair(updated_by=updated_by)
            
        elif status_change.status == InventoryUnitStatus.DAMAGED:
            unit.mark_as_damaged(
                notes=status_change.notes,
                updated_by=updated_by
            )
            
        elif status_change.status == InventoryUnitStatus.RETIRED:
            unit.retire(
                reason=status_change.reason,
                updated_by=updated_by
            )
            
        else:
            # Generic status change
            unit.status = status_change.status.value
            unit.updated_by = updated_by
            unit.updated_at = datetime.utcnow()
            unit.version += 1
        
        # Add notes if provided
        if status_change.notes:
            current_notes = unit.notes or ""
            unit.notes = f"{current_notes}\n{status_change.notes}".strip()
        
        await db.flush()
        await db.refresh(unit)
        
        return unit
    
    async def transfer_unit(
        self,
        db: AsyncSession,
        *,
        unit_id: UUID,
        transfer: UnitTransfer,
        updated_by: UUID
    ) -> InventoryUnit:
        """
        Transfer unit to another location.
        
        Args:
            db: Database session
            unit_id: Unit ID
            transfer: Transfer details
            updated_by: User performing transfer
            
        Returns:
            Updated unit
        """
        unit = await self.get(db, id=unit_id)
        
        if not unit:
            raise ValueError(f"Unit {unit_id} not found")
        
        unit.transfer_to_location(
            transfer.new_location_id,
            updated_by=updated_by
        )
        
        # Add transfer notes
        if transfer.notes:
            current_notes = unit.notes or ""
            unit.notes = f"{current_notes}\nTransferred: {transfer.notes}".strip()
        
        await db.flush()
        await db.refresh(unit)
        
        return unit
    
    async def block_rental(
        self,
        db: AsyncSession,
        *,
        unit_id: UUID,
        rental_block: RentalBlock,
        blocked_by: UUID
    ) -> InventoryUnit:
        """
        Block or unblock unit from rental.
        
        Args:
            db: Database session
            unit_id: Unit ID
            rental_block: Block details
            blocked_by: User performing action
            
        Returns:
            Updated unit
        """
        unit = await self.get(db, id=unit_id)
        
        if not unit:
            raise ValueError(f"Unit {unit_id} not found")
        
        if rental_block.block:
            unit.block_rental(
                reason=rental_block.reason,
                blocked_by=blocked_by
            )
        else:
            unit.unblock_rental(updated_by=blocked_by)
        
        await db.flush()
        await db.refresh(unit)
        
        return unit
    
    async def schedule_maintenance(
        self,
        db: AsyncSession,
        *,
        unit_id: UUID,
        schedule: MaintenanceSchedule,
        updated_by: UUID
    ) -> InventoryUnit:
        """
        Schedule maintenance for unit.
        
        Args:
            db: Database session
            unit_id: Unit ID
            schedule: Maintenance schedule
            updated_by: User scheduling
            
        Returns:
            Updated unit
        """
        unit = await self.get(db, id=unit_id)
        
        if not unit:
            raise ValueError(f"Unit {unit_id} not found")
        
        unit.schedule_maintenance(
            schedule.next_maintenance_date,
            updated_by=updated_by
        )
        
        # Add maintenance notes
        if schedule.notes:
            current_notes = unit.notes or ""
            unit.notes = (
                f"{current_notes}\nMaintenance scheduled for "
                f"{schedule.next_maintenance_date}: {schedule.notes}"
            ).strip()
        
        await db.flush()
        await db.refresh(unit)
        
        return unit
    
    async def get_maintenance_due(
        self,
        db: AsyncSession,
        *,
        location_id: Optional[UUID] = None,
        days_ahead: int = 7
    ) -> List[InventoryUnit]:
        """
        Get units with maintenance due.
        
        Args:
            db: Database session
            location_id: Optional location filter
            days_ahead: Days to look ahead
            
        Returns:
            List of units needing maintenance
        """
        cutoff_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        cutoff_date = cutoff_date.replace(day=cutoff_date.day + days_ahead)
        
        query = select(InventoryUnit).where(
            and_(
                InventoryUnit.next_maintenance_date.isnot(None),
                InventoryUnit.next_maintenance_date <= cutoff_date,
                InventoryUnit.is_active == True
            )
        )
        
        if location_id:
            query = query.where(InventoryUnit.location_id == location_id)
        
        query = query.order_by(InventoryUnit.next_maintenance_date)
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_expiring_warranties(
        self,
        db: AsyncSession,
        *,
        days_ahead: int = 30
    ) -> List[InventoryUnit]:
        """
        Get units with expiring warranties.
        
        Args:
            db: Database session
            days_ahead: Days to look ahead
            
        Returns:
            List of units with expiring warranties
        """
        cutoff_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        cutoff_date = cutoff_date.replace(day=cutoff_date.day + days_ahead)
        
        query = (
            select(InventoryUnit)
            .where(
                and_(
                    InventoryUnit.warranty_expiry.isnot(None),
                    InventoryUnit.warranty_expiry > datetime.utcnow(),
                    InventoryUnit.warranty_expiry <= cutoff_date
                )
            )
            .order_by(InventoryUnit.warranty_expiry)
        )
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def generate_sku(
        self,
        db: AsyncSession,
        *,
        item_id: UUID,
        suffix: Optional[str] = None
    ) -> str:
        """
        Generate a unique SKU for a unit.
        
        Args:
            db: Database session
            item_id: Item ID
            suffix: Optional suffix
            
        Returns:
            Generated SKU
        """
        # Get item for base SKU
        from app.models.item import Item
        
        query = select(Item).where(Item.id == item_id)
        result = await db.execute(query)
        item = result.scalar_one_or_none()
        
        if not item:
            raise ValueError(f"Item {item_id} not found")
        
        # Get highest sequence for this item
        seq_query = (
            select(func.count(InventoryUnit.id))
            .where(InventoryUnit.item_id == item_id)
        )
        
        result = await db.execute(seq_query)
        count = result.scalar() or 0
        
        # Generate SKU
        if suffix:
            sku = f"{item.sku}-{suffix}"
        else:
            sku = f"{item.sku}-{count + 1:04d}"
        
        # Check uniqueness
        check_query = select(func.count()).where(InventoryUnit.sku == sku)
        result = await db.execute(check_query)
        
        if result.scalar() > 0:
            # Add timestamp for uniqueness
            import time
            sku = f"{sku}-{int(time.time() * 1000) % 100000}"
        
        return sku
    
    async def generate_batch_code(
        self,
        db: AsyncSession,
        *,
        item_id: UUID
    ) -> str:
        """
        Generate a unique batch code.
        
        Args:
            db: Database session
            item_id: Item ID
            
        Returns:
            Generated batch code
        """
        from datetime import datetime
        import uuid
        
        # Format: BATCH-YYYYMMDD-XXXX
        date_str = datetime.utcnow().strftime("%Y%m%d")
        unique_suffix = str(uuid.uuid4())[:8].upper()
        
        return f"BATCH-{date_str}-{unique_suffix}"
    
    async def get_valuation_summary(
        self,
        db: AsyncSession,
        *,
        item_id: Optional[UUID] = None,
        location_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Get valuation summary for units.
        
        Args:
            db: Database session
            item_id: Optional item filter
            location_id: Optional location filter
            
        Returns:
            Valuation summary
        """
        query = select(
            func.count(InventoryUnit.id).label('total_units'),
            func.sum(InventoryUnit.purchase_price * InventoryUnit.quantity).label('total_purchase_value'),
            func.avg(InventoryUnit.purchase_price).label('avg_purchase_price'),
            func.sum(
                func.case(
                    (InventoryUnit.sale_price.isnot(None), 
                     InventoryUnit.sale_price * InventoryUnit.quantity),
                    else_=InventoryUnit.purchase_price * InventoryUnit.quantity
                )
            ).label('total_sale_value')
        )
        
        if item_id:
            query = query.where(InventoryUnit.item_id == item_id)
        
        if location_id:
            query = query.where(InventoryUnit.location_id == location_id)
        
        query = query.where(InventoryUnit.is_active == True)
        
        result = await db.execute(query)
        row = result.first()
        
        return {
            'total_units': row.total_units or 0,
            'total_purchase_value': float(row.total_purchase_value or 0),
            'average_purchase_price': float(row.avg_purchase_price or 0),
            'total_sale_value': float(row.total_sale_value or 0)
        }


# Create singleton instance
inventory_unit = CRUDInventoryUnit(InventoryUnit)