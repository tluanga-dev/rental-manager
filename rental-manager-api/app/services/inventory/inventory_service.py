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
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.orm import selectinload, joinedload

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
    
    async def get_inventory_stocks(
        self,
        db: AsyncSession,
        *,
        search: Optional[str] = None,
        category_id: Optional[UUID] = None,
        brand_id: Optional[UUID] = None,
        location_id: Optional[UUID] = None,
        stock_status: Optional[str] = None,
        is_rentable: Optional[bool] = None,
        is_saleable: Optional[bool] = None,
        sort_by: str = "item_name",
        sort_order: str = "asc",
        skip: int = 0,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get inventory stocks - all items that have inventory units.
        
        Args:
            db: Database session
            search: Search term for item name, SKU
            category_id: Filter by category
            brand_id: Filter by brand
            location_id: Filter by location
            stock_status: Filter by stock status
            is_rentable: Filter rentable items
            is_saleable: Filter saleable items
            sort_by: Sort field
            sort_order: Sort order
            skip: Skip records
            limit: Limit records
            
        Returns:
            List of inventory stock summaries
        """
        from app.models.item import Item
        from app.models.inventory.inventory_unit import InventoryUnit
        from app.models.inventory.stock_level import StockLevel
        from app.models.brand import Brand
        from app.models.category import Category
        from app.models.location import Location
        
        # Build base query for items that have inventory units
        query = (
            select(Item)
            .options(
                selectinload(Item.brand),
                selectinload(Item.category),
                selectinload(Item.unit_of_measurement),
                selectinload(Item.stock_levels).selectinload(StockLevel.location),
                selectinload(Item.inventory_units)
            )
            .join(InventoryUnit, Item.id == InventoryUnit.item_id)
            .distinct()
        )
        
        # Apply filters
        filters = []
        
        if search:
            search_term = f"%{search}%"
            filters.append(
                or_(
                    Item.item_name.ilike(search_term),
                    Item.sku.ilike(search_term),
                    Item.description.ilike(search_term)
                )
            )
        
        if category_id:
            filters.append(Item.category_id == category_id)
        
        if brand_id:
            filters.append(Item.brand_id == brand_id)
        
        if is_rentable is not None:
            filters.append(Item.is_rentable == is_rentable)
        
        if is_saleable is not None:
            filters.append(Item.is_saleable == is_saleable)
        
        # Apply location filter if specified
        if location_id:
            query = query.join(
                StockLevel, 
                and_(
                    Item.id == StockLevel.item_id,
                    StockLevel.location_id == location_id
                )
            )
        
        # Apply all filters
        if filters:
            query = query.where(and_(*filters))
        
        # Apply sorting
        sort_column = getattr(Item, sort_by, Item.item_name)
        if sort_order == "desc":
            query = query.order_by(desc(sort_column))
        else:
            query = query.order_by(sort_column)
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        
        # Execute query
        result = await db.execute(query)
        items = result.scalars().unique().all()
        
        # Build response data
        inventory_stocks = []
        
        for item in items:
            # Calculate stock totals across all locations
            stock_levels = item.stock_levels
            
            # Filter by location if specified
            if location_id:
                stock_levels = [sl for sl in stock_levels if sl.location_id == location_id]
            
            # Calculate aggregated quantities
            total_quantity = sum(sl.quantity_on_hand for sl in stock_levels)
            available_quantity = sum(sl.quantity_available for sl in stock_levels)
            reserved_quantity = sum(sl.quantity_reserved for sl in stock_levels)
            on_rent_quantity = sum(sl.quantity_on_rent for sl in stock_levels)
            damaged_quantity = sum(sl.quantity_damaged for sl in stock_levels)
            under_repair_quantity = sum(sl.quantity_under_repair for sl in stock_levels)
            
            # Count inventory units
            total_units = len(item.inventory_units)
            
            # Determine overall stock status
            if available_quantity == 0:
                overall_status = "OUT_OF_STOCK"
            elif any(sl.is_low_stock() for sl in stock_levels):
                overall_status = "LOW_STOCK"
            else:
                overall_status = "IN_STOCK"
            
            # Apply stock status filter
            if stock_status and overall_status != stock_status:
                continue
            
            # Build location breakdown
            location_breakdown = []
            for sl in stock_levels:
                location_breakdown.append({
                    "location_id": str(sl.location_id),
                    "location_name": sl.location.name if sl.location else "Unknown",
                    "quantity_on_hand": float(sl.quantity_on_hand),
                    "quantity_available": float(sl.quantity_available),
                    "quantity_reserved": float(sl.quantity_reserved),
                    "quantity_on_rent": float(sl.quantity_on_rent),
                    "quantity_damaged": float(sl.quantity_damaged)
                })
            
            inventory_stock = {
                "item_id": str(item.id),
                "item_name": item.item_name,
                "sku": item.sku,
                "description": item.description,
                "category": {
                    "id": str(item.category.id) if item.category else None,
                    "name": item.category.name if item.category else None,
                    "code": item.category.code if item.category else None
                } if item.category else None,
                "brand": {
                    "id": str(item.brand.id) if item.brand else None,
                    "name": item.brand.name if item.brand else None
                } if item.brand else None,
                "unit_of_measurement": {
                    "id": str(item.unit_of_measurement.id) if item.unit_of_measurement else None,
                    "name": item.unit_of_measurement.name if item.unit_of_measurement else None,
                    "abbreviation": item.unit_of_measurement.abbreviation if item.unit_of_measurement else None
                } if item.unit_of_measurement else None,
                "total_units": total_units,
                "total_quantity": float(total_quantity),
                "available_quantity": float(available_quantity),
                "reserved_quantity": float(reserved_quantity),
                "on_rent_quantity": float(on_rent_quantity),
                "damaged_quantity": float(damaged_quantity),
                "under_repair_quantity": float(under_repair_quantity),
                "stock_status": overall_status,
                "rental_rate": float(item.rental_rate_per_period) if item.rental_rate_per_period else None,
                "sale_price": float(item.sale_price) if item.sale_price else None,
                "security_deposit": float(item.security_deposit) if item.security_deposit else None,
                "is_rentable": item.is_rentable,
                "is_saleable": item.is_saleable,
                "is_active": item.is_active,
                "location_breakdown": location_breakdown,
                "created_at": item.created_at.isoformat(),
                "updated_at": item.updated_at.isoformat()
            }
            
            inventory_stocks.append(inventory_stock)
        
        return inventory_stocks
    
    async def get_inventory_item_detail(
        self,
        db: AsyncSession,
        *,
        item_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """
        Get detailed inventory information for a specific item.
        
        Args:
            db: Database session
            item_id: Item ID
            
        Returns:
            Detailed inventory item information
        """
        from app.models.item import Item
        from app.models.inventory.inventory_unit import InventoryUnit
        from app.models.inventory.stock_level import StockLevel
        from app.models.inventory.stock_movement import StockMovement
        
        # Get item with all related data
        query = (
            select(Item)
            .options(
                selectinload(Item.brand),
                selectinload(Item.category),
                selectinload(Item.unit_of_measurement),
                selectinload(Item.stock_levels).selectinload(StockLevel.location),
                selectinload(Item.inventory_units).selectinload(InventoryUnit.location),
                selectinload(Item.inventory_units).selectinload(InventoryUnit.supplier),
                selectinload(Item.stock_movements).selectinload(StockMovement.location)
            )
            .where(Item.id == item_id)
        )
        
        result = await db.execute(query)
        item = result.scalar_one_or_none()
        
        if not item:
            return None
        
        # Build inventory units details
        inventory_units = []
        for unit in item.inventory_units:
            inventory_units.append({
                "id": str(unit.id),
                "sku": unit.sku,
                "serial_number": unit.serial_number,
                "batch_code": unit.batch_code,
                "barcode": unit.barcode,
                "status": unit.status,
                "status_display": unit.status_display,
                "condition": unit.condition,
                "condition_display": unit.condition_display,
                "quantity": float(unit.quantity),
                "location": {
                    "id": str(unit.location.id) if unit.location else None,
                    "name": unit.location.name if unit.location else None
                } if unit.location else None,
                "supplier": {
                    "id": str(unit.supplier.id) if unit.supplier else None,
                    "name": unit.supplier.supplier_name if unit.supplier else None
                } if unit.supplier else None,
                "purchase_date": unit.purchase_date.isoformat() if unit.purchase_date else None,
                "purchase_price": float(unit.purchase_price),
                "sale_price": float(unit.sale_price) if unit.sale_price else None,
                "rental_rate_per_period": float(unit.rental_rate_per_period) if unit.rental_rate_per_period else None,
                "security_deposit": float(unit.security_deposit),
                "warranty_expiry": unit.warranty_expiry.isoformat() if unit.warranty_expiry else None,
                "next_maintenance_date": unit.next_maintenance_date.isoformat() if unit.next_maintenance_date else None,
                "is_rental_blocked": unit.is_rental_blocked,
                "rental_block_reason": unit.rental_block_reason,
                "can_be_rented": unit.can_be_rented(),
                "is_available": unit.is_available(),
                "notes": unit.notes,
                "created_at": unit.created_at.isoformat(),
                "updated_at": unit.updated_at.isoformat()
            })
        
        # Build stock level summary
        stock_levels = []
        total_on_hand = Decimal("0")
        total_available = Decimal("0")
        total_reserved = Decimal("0")
        total_on_rent = Decimal("0")
        total_damaged = Decimal("0")
        
        for sl in item.stock_levels:
            stock_levels.append({
                "id": str(sl.id),
                "location": {
                    "id": str(sl.location.id) if sl.location else None,
                    "name": sl.location.name if sl.location else None
                } if sl.location else None,
                "quantity_on_hand": float(sl.quantity_on_hand),
                "quantity_available": float(sl.quantity_available),
                "quantity_reserved": float(sl.quantity_reserved),
                "quantity_on_rent": float(sl.quantity_on_rent),
                "quantity_damaged": float(sl.quantity_damaged),
                "quantity_under_repair": float(sl.quantity_under_repair),
                "quantity_beyond_repair": float(sl.quantity_beyond_repair),
                "stock_status": sl.stock_status,
                "reorder_point": float(sl.reorder_point) if sl.reorder_point else None,
                "maximum_stock": float(sl.maximum_stock) if sl.maximum_stock else None,
                "average_cost": float(sl.average_cost) if sl.average_cost else None,
                "total_value": float(sl.total_value) if sl.total_value else None,
                "last_movement_date": sl.last_movement_date.isoformat() if sl.last_movement_date else None,
                "utilization_rate": float(sl.get_utilization_rate()),
                "availability_rate": float(sl.get_availability_rate()),
                "is_low_stock": sl.is_low_stock(),
                "updated_at": sl.updated_at.isoformat()
            })
            
            # Add to totals
            total_on_hand += sl.quantity_on_hand
            total_available += sl.quantity_available
            total_reserved += sl.quantity_reserved
            total_on_rent += sl.quantity_on_rent
            total_damaged += sl.quantity_damaged
        
        # Get recent stock movements (last 20)
        movements_query = (
            select(StockMovement)
            .options(
                selectinload(StockMovement.location),
                selectinload(StockMovement.performed_by)
            )
            .where(StockMovement.item_id == item_id)
            .order_by(desc(StockMovement.movement_date))
            .limit(20)
        )
        
        movements_result = await db.execute(movements_query)
        movements = movements_result.scalars().all()
        
        recent_movements = []
        for movement in movements:
            recent_movements.append({
                "id": str(movement.id),
                "movement_type": movement.movement_type.value,
                "quantity_change": float(movement.quantity_change),
                "quantity_before": float(movement.quantity_before),
                "quantity_after": float(movement.quantity_after),
                "location": {
                    "id": str(movement.location.id) if movement.location else None,
                    "name": movement.location.name if movement.location else None
                } if movement.location else None,
                "performed_by": {
                    "id": str(movement.performed_by.id) if movement.performed_by else None,
                    "name": movement.performed_by.full_name if movement.performed_by else None
                } if movement.performed_by else None,
                "reason": movement.reason,
                "notes": movement.notes,
                "unit_cost": float(movement.unit_cost) if movement.unit_cost else None,
                "total_cost": float(movement.total_cost) if movement.total_cost else None,
                "movement_date": movement.movement_date.isoformat(),
                "created_at": movement.created_at.isoformat()
            })
        
        # Build complete response
        return {
            "item": {
                "id": str(item.id),
                "item_name": item.item_name,
                "sku": item.sku,
                "description": item.description,
                "image_url": item.image_url,
                "category": {
                    "id": str(item.category.id) if item.category else None,
                    "name": item.category.name if item.category else None,
                    "code": item.category.code if item.category else None
                } if item.category else None,
                "brand": {
                    "id": str(item.brand.id) if item.brand else None,
                    "name": item.brand.name if item.brand else None
                } if item.brand else None,
                "unit_of_measurement": {
                    "id": str(item.unit_of_measurement.id) if item.unit_of_measurement else None,
                    "name": item.unit_of_measurement.name if item.unit_of_measurement else None,
                    "abbreviation": item.unit_of_measurement.abbreviation if item.unit_of_measurement else None
                } if item.unit_of_measurement else None,
                "rental_rate_per_period": float(item.rental_rate_per_period) if item.rental_rate_per_period else None,
                "rental_period": item.rental_period,
                "sale_price": float(item.sale_price) if item.sale_price else None,
                "security_deposit": float(item.security_deposit) if item.security_deposit else None,
                "is_rentable": item.is_rentable,
                "is_saleable": item.is_saleable,
                "is_active": item.is_active,
                "created_at": item.created_at.isoformat(),
                "updated_at": item.updated_at.isoformat()
            },
            "inventory_units": inventory_units,
            "stock_levels": stock_levels,
            "stock_summary": {
                "total_units": len(inventory_units),
                "total_on_hand": float(total_on_hand),
                "total_available": float(total_available),
                "total_reserved": float(total_reserved),
                "total_on_rent": float(total_on_rent),
                "total_damaged": float(total_damaged),
                "locations_count": len(stock_levels),
                "overall_utilization_rate": float(total_on_rent / total_on_hand * 100) if total_on_hand > 0 else 0,
                "overall_availability_rate": float(total_available / total_on_hand * 100) if total_on_hand > 0 else 0
            },
            "recent_movements": recent_movements
        }


# Create service instance
inventory_service = InventoryService()