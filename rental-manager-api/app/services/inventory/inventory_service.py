"""
Main Inventory Service.

Orchestrates inventory operations across multiple models and handles business logic.
"""

from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from decimal import Decimal
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.crud.inventory import (
    stock_movement,
    stock_level,
    inventory_unit,
    sku_sequence
)
from app.models.inventory.enums import (
    StockMovementType,
    InventoryUnitStatus,
    InventoryUnitCondition
)
from app.schemas.inventory.stock_level import (
    StockLevelCreate,
    StockAdjustment,
    StockReservation,
    RentalOperation,
    RentalReturn,
    StockTransfer
)
from app.schemas.inventory.inventory_unit import (
    InventoryUnitCreate,
    BatchInventoryUnitCreate,
    UnitStatusChange
)
from app.schemas.inventory.stock_movement import (
    StockMovementCreate,
    RentalMovementCreate,
    RentalReturnMovementCreate
)


class InventoryService:
    """Main service for inventory operations."""
    
    async def initialize_stock_level(
        self,
        db: AsyncSession,
        *,
        item_id: UUID,
        location_id: UUID,
        initial_quantity: Decimal = Decimal("0"),
        reorder_point: Optional[Decimal] = None,
        maximum_stock: Optional[Decimal] = None,
        created_by: UUID
    ) -> Any:
        """
        Initialize stock level for an item at a location.
        
        Args:
            db: Database session
            item_id: Item ID
            location_id: Location ID
            initial_quantity: Initial stock quantity
            reorder_point: Reorder point
            maximum_stock: Maximum stock level
            created_by: User creating the record
            
        Returns:
            Created stock level
        """
        # Get or create stock level
        stock = await stock_level.get_or_create(
            db,
            item_id=item_id,
            location_id=location_id,
            created_by=created_by
        )
        
        # If newly created and has initial quantity
        if stock.quantity_on_hand == 0 and initial_quantity > 0:
            # Create initial adjustment
            adjustment = StockAdjustment(
                adjustment=initial_quantity,
                reason="Initial stock setup",
                affect_available=True,
                performed_by_id=created_by
            )
            
            stock, movement = await stock_level.adjust_quantity(
                db,
                stock_level_id=stock.id,
                adjustment=adjustment,
                performed_by=created_by
            )
        
        # Update settings
        if reorder_point is not None:
            stock.reorder_point = reorder_point
        if maximum_stock is not None:
            stock.maximum_stock = maximum_stock
        
        await db.flush()
        return stock
    
    async def create_inventory_units(
        self,
        db: AsyncSession,
        *,
        item_id: UUID,
        location_id: UUID,
        quantity: int,
        unit_cost: Decimal,
        serial_numbers: Optional[List[str]] = None,
        batch_code: Optional[str] = None,
        supplier_id: Optional[UUID] = None,
        purchase_order_number: Optional[str] = None,
        created_by: UUID
    ) -> Tuple[List[Any], Any, Any]:
        """
        Create inventory units and update stock levels.
        
        Args:
            db: Database session
            item_id: Item ID
            location_id: Location ID
            quantity: Number of units to create
            unit_cost: Cost per unit
            serial_numbers: Optional serial numbers
            batch_code: Optional batch code
            supplier_id: Supplier ID
            purchase_order_number: PO number
            created_by: User creating units
            
        Returns:
            Tuple of (units, stock_level, movement)
        """
        # Create batch request
        batch_request = BatchInventoryUnitCreate(
            item_id=item_id,
            location_id=location_id,
            quantity=quantity,
            batch_code=batch_code,
            purchase_date=datetime.utcnow(),
            purchase_price=unit_cost,
            supplier_id=supplier_id,
            purchase_order_number=purchase_order_number,
            serial_numbers=serial_numbers
        )
        
        # Create units
        units = await inventory_unit.create_batch(
            db,
            batch_in=batch_request,
            created_by=created_by
        )
        
        # Get or create stock level
        stock = await stock_level.get_or_create(
            db,
            item_id=item_id,
            location_id=location_id,
            created_by=created_by
        )
        
        # Create stock adjustment
        adjustment_quantity = Decimal(str(quantity))
        adjustment = StockAdjustment(
            adjustment=adjustment_quantity,
            reason=f"Purchase receipt - PO: {purchase_order_number or 'N/A'}",
            affect_available=True,
            performed_by_id=created_by
        )
        
        stock, movement = await stock_level.adjust_quantity(
            db,
            stock_level_id=stock.id,
            adjustment=adjustment,
            performed_by=created_by
        )
        
        # Update average cost
        await stock_level.update_average_cost(
            db,
            stock_level_id=stock.id,
            new_quantity=adjustment_quantity,
            new_cost=unit_cost
        )
        
        return units, stock, movement
    
    async def process_rental_checkout(
        self,
        db: AsyncSession,
        *,
        item_id: UUID,
        location_id: UUID,
        quantity: Decimal,
        customer_id: UUID,
        transaction_id: UUID,
        performed_by: UUID
    ) -> Tuple[List[Any], Any, Any]:
        """
        Process rental checkout with unit allocation.
        
        Args:
            db: Database session
            item_id: Item being rented
            location_id: Rental location
            quantity: Quantity to rent
            customer_id: Customer renting
            transaction_id: Rental transaction ID
            performed_by: User processing rental
            
        Returns:
            Tuple of (units, stock_level, movement)
        """
        # Get stock level
        stock = await stock_level.get_by_item_location(
            db,
            item_id=item_id,
            location_id=location_id
        )
        
        if not stock:
            raise ValueError(f"No stock found for item {item_id} at location {location_id}")
        
        # Check availability
        if not stock.can_fulfill_order(quantity):
            raise ValueError(
                f"Insufficient stock: requested {quantity}, available {stock.quantity_available}"
            )
        
        # Get available units
        units_needed = int(quantity)
        available_units = await inventory_unit.get_available_for_rental(
            db,
            item_id=item_id,
            location_id=location_id,
            quantity_needed=units_needed
        )
        
        if len(available_units) < units_needed:
            raise ValueError(
                f"Insufficient units: need {units_needed}, found {len(available_units)}"
            )
        
        # Mark units as rented
        rented_units = []
        for unit in available_units[:units_needed]:
            status_change = UnitStatusChange(
                status=InventoryUnitStatus.RENTED,
                reason="Rental checkout",
                customer_id=customer_id
            )
            
            updated_unit = await inventory_unit.change_status(
                db,
                unit_id=unit.id,
                status_change=status_change,
                updated_by=performed_by
            )
            rented_units.append(updated_unit)
        
        # Process stock level change
        rental_op = RentalOperation(
            quantity=quantity,
            customer_id=customer_id,
            transaction_id=transaction_id
        )
        
        stock, movement = await stock_level.process_rental_out(
            db,
            stock_level_id=stock.id,
            rental=rental_op,
            performed_by=performed_by
        )
        
        return rented_units, stock, movement
    
    async def process_rental_return(
        self,
        db: AsyncSession,
        *,
        item_id: UUID,
        location_id: UUID,
        quantity: Decimal,
        damaged_quantity: Decimal = Decimal("0"),
        transaction_id: UUID,
        unit_ids: List[UUID],
        condition_notes: Optional[str] = None,
        performed_by: UUID
    ) -> Tuple[List[Any], Any, Any]:
        """
        Process rental return with condition assessment.
        
        Args:
            db: Database session
            item_id: Item being returned
            location_id: Return location
            quantity: Total return quantity
            damaged_quantity: Damaged quantity
            transaction_id: Return transaction ID
            unit_ids: IDs of units being returned
            condition_notes: Condition notes
            performed_by: User processing return
            
        Returns:
            Tuple of (units, stock_level, movement)
        """
        # Get stock level
        stock = await stock_level.get_by_item_location(
            db,
            item_id=item_id,
            location_id=location_id
        )
        
        if not stock:
            raise ValueError(f"No stock found for item {item_id} at location {location_id}")
        
        # Process unit returns
        returned_units = []
        damaged_count = 0
        
        for unit_id in unit_ids:
            unit = await inventory_unit.get(db, id=unit_id)
            
            if not unit:
                continue
            
            # Determine condition
            if damaged_count < damaged_quantity:
                condition = InventoryUnitCondition.DAMAGED
                damaged_count += 1
            else:
                condition = InventoryUnitCondition.GOOD
            
            # Change status back to available (or damaged)
            status_change = UnitStatusChange(
                status=InventoryUnitStatus.AVAILABLE if condition != InventoryUnitCondition.DAMAGED else InventoryUnitStatus.DAMAGED,
                reason="Rental return",
                new_condition=condition,
                notes=condition_notes
            )
            
            updated_unit = await inventory_unit.change_status(
                db,
                unit_id=unit.id,
                status_change=status_change,
                updated_by=performed_by
            )
            returned_units.append(updated_unit)
        
        # Process stock level change
        rental_return = RentalReturn(
            quantity=quantity,
            damaged_quantity=damaged_quantity,
            transaction_id=transaction_id,
            condition_notes=condition_notes
        )
        
        stock, movement = await stock_level.process_rental_return(
            db,
            stock_level_id=stock.id,
            rental_return=rental_return,
            performed_by=performed_by
        )
        
        return returned_units, stock, movement
    
    async def transfer_stock(
        self,
        db: AsyncSession,
        *,
        item_id: UUID,
        from_location_id: UUID,
        to_location_id: UUID,
        quantity: Decimal,
        transfer_reason: str,
        performed_by: UUID
    ) -> Tuple[Any, Any, List[Any]]:
        """
        Transfer stock between locations.
        
        Args:
            db: Database session
            item_id: Item to transfer
            from_location_id: Source location
            to_location_id: Destination location
            quantity: Quantity to transfer
            transfer_reason: Reason for transfer
            performed_by: User performing transfer
            
        Returns:
            Tuple of (from_stock, to_stock, movements)
        """
        # Get source stock level
        from_stock = await stock_level.get_by_item_location(
            db,
            item_id=item_id,
            location_id=from_location_id
        )
        
        if not from_stock:
            raise ValueError(f"No stock at source location {from_location_id}")
        
        if from_stock.quantity_available < quantity:
            raise ValueError(
                f"Insufficient stock at source: available {from_stock.quantity_available}, "
                f"requested {quantity}"
            )
        
        # Get or create destination stock level
        to_stock = await stock_level.get_or_create(
            db,
            item_id=item_id,
            location_id=to_location_id,
            created_by=performed_by
        )
        
        # Create transfer out movement
        out_adjustment = StockAdjustment(
            adjustment=-quantity,
            reason=f"Transfer out: {transfer_reason}",
            affect_available=True,
            performed_by_id=performed_by
        )
        
        from_stock, out_movement = await stock_level.adjust_quantity(
            db,
            stock_level_id=from_stock.id,
            adjustment=out_adjustment,
            performed_by=performed_by
        )
        
        # Update movement type
        out_movement.movement_type = StockMovementType.TRANSFER_OUT
        
        # Create transfer in movement
        in_adjustment = StockAdjustment(
            adjustment=quantity,
            reason=f"Transfer in: {transfer_reason}",
            affect_available=True,
            performed_by_id=performed_by
        )
        
        to_stock, in_movement = await stock_level.adjust_quantity(
            db,
            stock_level_id=to_stock.id,
            adjustment=in_adjustment,
            performed_by=performed_by
        )
        
        # Update movement type
        in_movement.movement_type = StockMovementType.TRANSFER_IN
        
        return from_stock, to_stock, [out_movement, in_movement]
    
    async def get_stock_summary(
        self,
        db: AsyncSession,
        *,
        item_id: Optional[UUID] = None,
        location_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Get comprehensive stock summary.
        
        Args:
            db: Database session
            item_id: Optional item filter
            location_id: Optional location filter
            
        Returns:
            Stock summary dictionary
        """
        # Get stock levels
        if item_id and location_id:
            stocks = [await stock_level.get_by_item_location(
                db, item_id=item_id, location_id=location_id
            )]
            stocks = [s for s in stocks if s]
        elif item_id:
            stocks = await stock_level.get_by_item(db, item_id=item_id)
        elif location_id:
            stocks = await stock_level.get_by_location(db, location_id=location_id)
        else:
            stocks = await stock_level.get_multi(db, limit=1000)
        
        # Calculate totals
        total_on_hand = sum(s.quantity_on_hand for s in stocks)
        total_available = sum(s.quantity_available for s in stocks)
        total_reserved = sum(s.quantity_reserved for s in stocks)
        total_on_rent = sum(s.quantity_on_rent for s in stocks)
        total_damaged = sum(s.quantity_damaged for s in stocks)
        total_value = sum(s.total_value or 0 for s in stocks)
        
        # Get low stock items
        low_stock_items = [s for s in stocks if s.is_low_stock()]
        
        # Get movement summary
        movement_summary = await stock_movement.get_summary(
            db,
            item_id=item_id,
            location_id=location_id
        )
        
        return {
            'total_on_hand': float(total_on_hand),
            'total_available': float(total_available),
            'total_reserved': float(total_reserved),
            'total_on_rent': float(total_on_rent),
            'total_damaged': float(total_damaged),
            'total_value': float(total_value),
            'location_count': len(set(s.location_id for s in stocks)),
            'item_count': len(set(s.item_id for s in stocks)),
            'low_stock_count': len(low_stock_items),
            'utilization_rate': float(total_on_rent / total_on_hand * 100) if total_on_hand > 0 else 0,
            'availability_rate': float(total_available / total_on_hand * 100) if total_on_hand > 0 else 0,
            'movement_summary': movement_summary
        }
    
    async def perform_stock_adjustment(
        self,
        db: AsyncSession,
        *,
        item_id: UUID,
        location_id: UUID,
        adjustment_quantity: Decimal,
        reason: str,
        notes: Optional[str] = None,
        performed_by: UUID,
        requires_approval: bool = False
    ) -> Tuple[Any, Any]:
        """
        Perform manual stock adjustment.
        
        Args:
            db: Database session
            item_id: Item ID
            location_id: Location ID
            adjustment_quantity: Adjustment amount (+ or -)
            reason: Adjustment reason
            notes: Optional notes
            performed_by: User performing adjustment
            requires_approval: Whether approval is required
            
        Returns:
            Tuple of (stock_level, movement)
        """
        # Get or create stock level
        stock = await stock_level.get_or_create(
            db,
            item_id=item_id,
            location_id=location_id,
            created_by=performed_by
        )
        
        # Create adjustment
        adjustment = StockAdjustment(
            adjustment=adjustment_quantity,
            reason=reason,
            affect_available=True,
            performed_by_id=performed_by,
            notes=notes
        )
        
        # Perform adjustment
        stock, movement = await stock_level.adjust_quantity(
            db,
            stock_level_id=stock.id,
            adjustment=adjustment,
            performed_by=performed_by
        )
        
        # Mark as requiring approval if needed
        if requires_approval:
            movement.approved_by_id = None
        
        return stock, movement
    
    async def get_inventory_alerts(
        self,
        db: AsyncSession,
        *,
        location_id: Optional[UUID] = None
    ) -> List[Dict[str, Any]]:
        """
        Get inventory alerts (low stock, maintenance due, etc.).
        
        Args:
            db: Database session
            location_id: Optional location filter
            
        Returns:
            List of alerts
        """
        alerts = []
        
        # Low stock alerts
        low_stock_items = await stock_level.get_low_stock_items(
            db,
            location_id=location_id
        )
        
        for stock in low_stock_items:
            alerts.append({
                'alert_type': 'LOW_STOCK',
                'severity': 'high' if stock.quantity_available == 0 else 'medium',
                'message': f"Low stock for item at location",
                'item_id': stock.item_id,
                'location_id': stock.location_id,
                'quantity': float(stock.quantity_available),
                'threshold': float(stock.reorder_point or 0)
            })
        
        # Maintenance due alerts
        maintenance_units = await inventory_unit.get_maintenance_due(
            db,
            location_id=location_id,
            days_ahead=7
        )
        
        for unit in maintenance_units:
            alerts.append({
                'alert_type': 'MAINTENANCE_DUE',
                'severity': 'medium',
                'message': f"Maintenance due for unit {unit.sku}",
                'item_id': unit.item_id,
                'location_id': unit.location_id,
                'unit_id': unit.id,
                'due_date': unit.next_maintenance_date
            })
        
        # Warranty expiring alerts
        warranty_units = await inventory_unit.get_expiring_warranties(
            db,
            days_ahead=30
        )
        
        for unit in warranty_units:
            alerts.append({
                'alert_type': 'WARRANTY_EXPIRING',
                'severity': 'low',
                'message': f"Warranty expiring for unit {unit.sku}",
                'item_id': unit.item_id,
                'location_id': unit.location_id,
                'unit_id': unit.id,
                'expiry_date': unit.warranty_expiry
            })
        
        return alerts


# Create service instance
inventory_service = InventoryService()