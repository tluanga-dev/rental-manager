"""
Rental Return Service for processing rental returns
"""

from datetime import date, datetime, timezone
from typing import List, Dict, Any
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from uuid import UUID

from app.modules.transactions.base.models import TransactionHeader, TransactionLine
from app.modules.transactions.base.models.transaction_headers import RentalStatus, TransactionStatus
from app.modules.inventory.models import StockLevel, StockMovement, InventoryUnit
from app.modules.inventory.enums import InventoryUnitStatus, InventoryUnitCondition, StockMovementType, DamageSeverity
# from app.modules.inventory.damage_models import DamageAssessment, ReturnLineDetails  # Module removed
from app.modules.inventory.repository import (
    AsyncStockLevelRepository,
    AsyncStockMovementRepository, 
    AsyncInventoryUnitRepository
)
from app.modules.master_data.item_master.models import Item
from app.shared.exceptions import ValidationError
from app.modules.transactions.rentals.rental_return.schemas import RentalReturnRequest, RentalReturnResponse, ItemReturnResponse, ReturnAction, DamageDetail
from app.modules.transactions.rentals.rental_core.repository import RentalsRepository


class RentalReturnService:
    """Service for processing rental returns with complete inventory integration"""
    
    def __init__(self):
        self.repo = RentalsRepository()
    
    def _initialize_repos(self, session: AsyncSession):
        """Initialize repository dependencies with session"""
        self.stock_level_repo = AsyncStockLevelRepository(session)
        self.stock_movement_repo = AsyncStockMovementRepository(session)
        self.inventory_unit_repo = AsyncInventoryUnitRepository(session)
    
    async def process_rental_return(
        self, 
        session: AsyncSession, 
        return_request: RentalReturnRequest
    ) -> RentalReturnResponse:
        """Process a complete rental return with full inventory integration"""
        
        import traceback
        
        
        # Initialize repository dependencies
        self._initialize_repos(session)
        
        try:
            rental_uuid = UUID(return_request.rental_id)
        except ValueError as e:
            raise ValueError("Invalid rental ID format")
        
        # Get the rental transaction
        rental = await self.repo.get_rental_by_id(session, return_request.rental_id)
        if not rental:
            raise ValueError("Rental not found")
        
        
        # Validate that rental can be returned
        if rental["rental_status"] in ["RENTAL_COMPLETED", "RENTAL_RETURNED"]:
            raise ValueError("Rental has already been completed/returned")
        
        # Process each item return
        items_returned = []
        all_items_returned = True
        
        for i, item_return in enumerate(return_request.items):
            try:
                item_response = await self._process_item_return(
                    session, rental_uuid, item_return, rental["location_id"]
                )
                items_returned.append(item_response)
                
                # Check if this item has remaining quantity
                if item_response.remaining_quantity > 0:
                    all_items_returned = False
                    
            except Exception as e:
                raise
        
        # Update overall rental status
        new_rental_status = await self._determine_rental_status(
            session, rental_uuid, all_items_returned
        )
        
        # Update transaction header status
        await self._update_transaction_status(
            session, rental_uuid, new_rental_status, return_request.return_date
        )
        
        # Calculate financial impact (deposits, late fees, etc.)
        financial_impact = await self._calculate_financial_impact(
            session, rental, return_request
        )
        
        await session.commit()
        
        response = RentalReturnResponse(
            success=True,
            message="Return processed successfully",
            rental_id=return_request.rental_id,
            transaction_number=rental["transaction_number"],
            return_date=return_request.return_date,
            items_returned=items_returned,
            rental_status=new_rental_status.value,
            financial_impact=financial_impact,
            timestamp=datetime.now(timezone.utc)
        )
        
        
        return response
    
    async def _process_item_return(
        self, 
        session: AsyncSession, 
        rental_uuid: UUID, 
        item_return,
        location_id: str
    ) -> ItemReturnResponse:
        """Process return for a single item with mixed condition support"""
        
        import traceback
        
        
        try:
            line_uuid = UUID(item_return.line_id)
        except ValueError as e:
            raise ValueError(f"Invalid line ID format: {item_return.line_id}")
        
        # Get the transaction line
        stmt = select(TransactionLine).where(
            TransactionLine.id == line_uuid,
            TransactionLine.transaction_header_id == rental_uuid
        )
        result = await session.execute(stmt)
        line = result.scalar_one_or_none()
        
        if not line:
            raise ValueError(f"Transaction line not found: {item_return.line_id}")
        
        
        # Validate return quantity
        if item_return.total_return_quantity > line.quantity:
            raise ValueError(f"Return quantity ({item_return.total_return_quantity}) exceeds rented quantity ({line.quantity})")
        
        # Calculate remaining quantity on rent after this return
        remaining_on_rent = line.quantity - item_return.total_return_quantity
        
        # Determine new rental status for this line
        new_status = self._determine_line_status(
            item_return.return_action, 
            remaining_on_rent > 0,
            item_return.return_date,
            line.rental_end_date
        )
        
        # Update the transaction line
        try:
            await session.execute(
                update(TransactionLine)
                .where(TransactionLine.id == line_uuid)
                .values(
                    current_rental_status=new_status,
                    notes=f"{line.notes or ''}\nReturned {item_return.total_return_quantity} on {item_return.return_date}".strip()
                )
            )
        except Exception as e:
            raise
        
        # Update inventory with mixed condition support
        try:
            await self._update_inventory_for_mixed_return(
                session=session,
                item_return=item_return,
                location_id=UUID(location_id),
                transaction_header_id=rental_uuid,
                transaction_line_id=line_uuid
            )
        except Exception as e:
            raise
        
        # Get item details for response
        try:
            from app.modules.master_data.item_master.models import Item
            item_stmt = select(Item.item_name, Item.sku).where(Item.id == UUID(item_return.item_id))
            item_result = await session.execute(item_stmt)
            item_info = item_result.first()
        except Exception as e:
            raise
        
        
        return ItemReturnResponse(
            line_id=item_return.line_id,
            item_name=item_info.item_name if item_info else "Unknown Item",
            sku=item_info.sku if item_info else "N/A",
            original_quantity=line.quantity,
            returned_quantity=item_return.total_return_quantity,
            remaining_quantity=remaining_on_rent,
            return_date=item_return.return_date,
            new_status=new_status.value,
            condition_notes=item_return.condition_notes
        )
    
    def _determine_line_status(
        self, 
        return_action: ReturnAction, 
        has_remaining: bool,
        return_date: date,
        expected_return_date: date
    ) -> RentalStatus:
        """Determine the new status for a rental line"""
        
        is_late = return_date > expected_return_date
        
        if return_action == ReturnAction.COMPLETE_RETURN and not has_remaining:
            return RentalStatus.RENTAL_COMPLETED
        elif return_action == ReturnAction.PARTIAL_RETURN or has_remaining:
            if is_late:
                return RentalStatus.RENTAL_LATE_PARTIAL_RETURN
            else:
                return RentalStatus.RENTAL_PARTIAL_RETURN
        elif return_action == ReturnAction.MARK_LATE or is_late:
            return RentalStatus.RENTAL_LATE
        else:
            return RentalStatus.RENTAL_COMPLETED
    
    async def _determine_rental_status(
        self, 
        session: AsyncSession, 
        rental_uuid: UUID, 
        all_items_returned: bool
    ) -> RentalStatus:
        """Determine overall rental status based on all line items"""
        
        if all_items_returned:
            return RentalStatus.RENTAL_COMPLETED
        
        # Check line statuses to determine aggregate status
        stmt = select(TransactionLine.current_rental_status).where(
            TransactionLine.transaction_header_id == rental_uuid
        )
        result = await session.execute(stmt)
        statuses = [row[0] for row in result.fetchall()]
        
        # Aggregate logic (same as in repository)
        if RentalStatus.RENTAL_LATE in statuses or RentalStatus.RENTAL_LATE_PARTIAL_RETURN in statuses:
            if RentalStatus.RENTAL_PARTIAL_RETURN in statuses or RentalStatus.RENTAL_LATE_PARTIAL_RETURN in statuses:
                return RentalStatus.RENTAL_LATE_PARTIAL_RETURN
            else:
                return RentalStatus.RENTAL_LATE
        elif RentalStatus.RENTAL_PARTIAL_RETURN in statuses:
            return RentalStatus.RENTAL_PARTIAL_RETURN
        elif RentalStatus.RENTAL_EXTENDED in statuses:
            return RentalStatus.RENTAL_EXTENDED
        else:
            return RentalStatus.RENTAL_INPROGRESS
    
    async def _update_transaction_status(
        self, 
        session: AsyncSession, 
        rental_uuid: UUID, 
        rental_status: RentalStatus, 
        return_date: date
    ):
        """Update the transaction header status"""
        
        transaction_status = TransactionStatus.COMPLETED if rental_status == RentalStatus.RENTAL_COMPLETED else TransactionStatus.IN_PROGRESS
        
        await session.execute(
            update(TransactionHeader)
            .where(TransactionHeader.id == rental_uuid)
            .values(
                status=transaction_status,
                updated_at=datetime.now(timezone.utc)
            )
        )
    
    async def _update_inventory_for_mixed_return(
        self,
        session: AsyncSession,
        item_return,
        location_id: UUID,
        transaction_header_id: UUID,
        transaction_line_id: UUID
    ) -> None:
        """
        Handle mixed condition returns with proper inventory routing.
        CRITICAL: Damaged items do NOT go to available inventory!
        """
        
        print(f"[RETURN-INVENTORY] Processing mixed return for item {item_return.item_id}")
        
        # Get item details to check serialization
        item = await session.get(Item, UUID(item_return.item_id))
        if not item:
            raise ValidationError(f"Item {item_return.item_id} not found")
        
        # Get or create stock level
        stock_level = await self.stock_level_repo.get_by_item_location(
            UUID(item_return.item_id), location_id
        )
        
        if not stock_level:
            raise ValidationError(f"No stock level found for item at location")
        
        # Store original values for audit
        original_on_rent = stock_level.quantity_on_rent
        original_available = stock_level.quantity_available
        original_damaged = stock_level.quantity_damaged
        
        # Process GOOD items - these go back to available
        if item_return.quantity_good > 0:
            print(f"[RETURN-INVENTORY] Processing {item_return.quantity_good} good items")
            stock_level.quantity_available += item_return.quantity_good
            stock_level.quantity_on_rent -= item_return.quantity_good
            
            # Update InventoryUnit status if serialized
            if item.serial_number_required:
                await self._update_units_to_available(
                    session, UUID(item_return.item_id), location_id, 
                    int(item_return.quantity_good)
                )
        
        # Process DAMAGED items - these do NOT go to available!
        if item_return.quantity_damaged > 0:
            print(f"[RETURN-INVENTORY] Processing {item_return.quantity_damaged} damaged items")
            stock_level.quantity_damaged += item_return.quantity_damaged
            stock_level.quantity_on_rent -= item_return.quantity_damaged
            # NOTE: quantity_available is NOT increased - damaged items not rentable!
            
            # Create damage assessments
            if item_return.damage_details:
                for detail in item_return.damage_details:
                    if detail.damage_severity != "BEYOND_REPAIR":
                        await self._create_damage_assessment(
                            session, item, detail, 
                            transaction_header_id, transaction_line_id
                        )
            
            # Update InventoryUnit status if serialized
            if item.serial_number_required and item_return.damage_details:
                for detail in item_return.damage_details:
                    if detail.serial_numbers and detail.damage_severity != "BEYOND_REPAIR":
                        for serial_no in detail.serial_numbers:
                            await self._update_unit_to_damaged(session, serial_no)
        
        # Process BEYOND REPAIR items
        if item_return.quantity_beyond_repair > 0:
            print(f"[RETURN-INVENTORY] Processing {item_return.quantity_beyond_repair} beyond repair items")
            stock_level.quantity_beyond_repair += item_return.quantity_beyond_repair
            stock_level.quantity_on_rent -= item_return.quantity_beyond_repair
            # NOTE: quantity_available is NOT increased - these items are write-off candidates!
            
            # Create damage assessments for beyond repair
            if item_return.damage_details:
                for detail in item_return.damage_details:
                    if detail.damage_severity == "BEYOND_REPAIR":
                        await self._create_damage_assessment(
                            session, item, detail,
                            transaction_header_id, transaction_line_id
                        )
            
            # Update InventoryUnit status if serialized
            if item.serial_number_required and item_return.damage_details:
                for detail in item_return.damage_details:
                    if detail.serial_numbers and detail.damage_severity == "BEYOND_REPAIR":
                        for serial_no in detail.serial_numbers:
                            await self._update_unit_to_beyond_repair(session, serial_no)
        
        # Process LOST items
        if item_return.quantity_lost > 0:
            print(f"[RETURN-INVENTORY] Processing {item_return.quantity_lost} lost items")
            stock_level.quantity_on_rent -= item_return.quantity_lost
            stock_level.quantity_on_hand -= item_return.quantity_lost  # Remove from total inventory
        
        # Update stock level
        await self.stock_level_repo.update(stock_level, {
            "quantity_available": stock_level.quantity_available,
            "quantity_on_rent": stock_level.quantity_on_rent,
            "quantity_damaged": stock_level.quantity_damaged,
            "quantity_beyond_repair": stock_level.quantity_beyond_repair,
            "quantity_on_hand": stock_level.quantity_on_hand,
            "updated_by": "system"
        })
        
        # Create comprehensive stock movement
        await self._create_mixed_return_movement(
            session, stock_level, item_return, 
            transaction_header_id, transaction_line_id,
            original_on_rent
        )
        
        # Create return line details for tracking
        return_details = ReturnLineDetails(
            transaction_line_id=transaction_line_id,
            return_date=datetime.now(timezone.utc),
            quantity_returned_good=item_return.quantity_good,
            quantity_returned_damaged=item_return.quantity_damaged,
            quantity_returned_beyond_repair=item_return.quantity_beyond_repair,
            quantity_lost=item_return.quantity_lost,
            damage_charges=item_return.damage_penalty or Decimal("0"),
            lost_item_charges=self._calculate_lost_charges(item_return, item)
        )
        session.add(return_details)
        
        print(f"[RETURN-INVENTORY] ✔ Mixed return completed. Good: {item_return.quantity_good}, "
              f"Damaged: {item_return.quantity_damaged}, Beyond Repair: {item_return.quantity_beyond_repair}, "
              f"Lost: {item_return.quantity_lost}")
    
    async def _update_inventory_for_return_complete(
        self,
        session: AsyncSession,
        item_id: UUID,
        location_id: UUID,
        return_quantity: Decimal,
        transaction_header_id: UUID,
        transaction_line_id: UUID,
        return_condition: str = "GOOD"
    ) -> None:
        """
        COMPLETE inventory update implementation for rental returns.
        
        Implements all requirements:
        1. StockLevel updates (quantity_available +, quantity_on_rent -)
        2. StockMovement creation with proper quantity tracking
        3. InventoryUnit status updates for serialized items
        """
        
        print(f"[RETURN-INVENTORY] Starting complete inventory update for item {item_id}")
        
        # ----------------------------------------------------------------
        # 1. UPDATE STOCK LEVEL (Requirements 2.1-2.2)
        # ----------------------------------------------------------------
        
        # Check if StockLevel entry exists for item_id and location_id
        stock_level = await self.stock_level_repo.get_by_item_location(item_id, location_id)
        
        if not stock_level:
            raise ValidationError(f"No stock level found for item {item_id} at location {location_id}")
        
        # Update quantities as specified
        original_available = stock_level.quantity_available
        original_on_rent = stock_level.quantity_on_rent
        
        # quantity_available += return_quantity
        # quantity_on_rent -= return_quantity
        updated_stock_level = await self.stock_level_repo.update(stock_level, {
            "quantity_available": original_available + return_quantity,
            "quantity_on_rent": original_on_rent - return_quantity,
            "updated_at": datetime.now(timezone.utc),
            "updated_by": "system"
        })
        
        print(f"[RETURN-INVENTORY] ✔ Updated StockLevel: available {original_available} -> {updated_stock_level.quantity_available}, on_rent {original_on_rent} -> {updated_stock_level.quantity_on_rent}")
        
        # ----------------------------------------------------------------
        # 2. CREATE STOCK MOVEMENT (Requirements 3.1-3.10)
        # ----------------------------------------------------------------
        
        # Find quantity_before from latest StockMovement
        latest_movement_query = select(StockMovement).where(
            StockMovement.item_id == str(item_id)
        ).order_by(StockMovement.created_at.desc()).limit(1)
        
        latest_result = await session.execute(latest_movement_query)
        latest_movement = latest_result.scalar_one_or_none()
        
        quantity_before = latest_movement.quantity_after if latest_movement else Decimal("0")
        quantity_after = quantity_before + return_quantity  # Positive for returns
        
        # Create StockMovement with all required fields
        stock_movement = await self.stock_movement_repo.create({
            "stock_level_id": str(stock_level.id),           # StockLevel id
            "item_id": str(item_id),                         # id from ItemMaster
            "location_id": str(location_id),                 # location_id
            "movement_type": "STOCK_MOVEMENT_RENTAL_RETURN", # movement_type
            "transaction_header_id": str(transaction_header_id), # Additional reference
            "transaction_line_id": str(transaction_line_id), # transaction_line_id
            "quantity_change": return_quantity,              # quantity supplied from line item
            "quantity_before": quantity_before,              # from latest StockMovement or 0
            "quantity_after": quantity_after,                # quantity_change + quantity_before
            "created_by": "system",
            "updated_by": "system"
        })
        
        print(f"[RETURN-INVENTORY] ✔ Created StockMovement: change={return_quantity}, before={quantity_before}, after={quantity_after}")
        
        # ----------------------------------------------------------------
        # 3. UPDATE INVENTORY UNITS (Requirement 4 - if serial_number_required = true)
        # ----------------------------------------------------------------
        
        # Check if item requires serial number tracking
        item = await session.get(Item, item_id)
        if item and item.serial_number_required:
            await self._update_inventory_units_for_return(
                session=session,
                item_id=item_id,
                location_id=location_id,
                return_quantity=int(return_quantity),
                return_condition=return_condition
            )
        
        print(f"[RETURN-INVENTORY] ✔ Complete inventory update finished for item {item_id}")
    
    async def _update_inventory_units_for_return(
        self,
        session: AsyncSession,
        item_id: UUID,
        location_id: UUID,
        return_quantity: int,
        return_condition: str = "GOOD"
    ) -> None:
        """
        Update InventoryUnit status for returned serialized items.
        
        Requirements 4.1-4.12: Update status and condition for returned units
        """
        
        print(f"[RETURN-INVENTORY] Updating {return_quantity} inventory units for serialized item")
        
        # Find rented inventory units to return
        rented_units_query = select(InventoryUnit).where(
            InventoryUnit.item_id == str(item_id),
            InventoryUnit.location_id == str(location_id),
            InventoryUnit.status == InventoryUnitStatus.RENTED.value
        ).limit(return_quantity)
        
        rented_result = await session.execute(rented_units_query)
        units_to_return = rented_result.scalars().all()
        
        if len(units_to_return) < return_quantity:
            raise ValidationError(
                f"Insufficient rented units to return. Found {len(units_to_return)}, need {return_quantity}"
            )
        
        # Map return condition to InventoryUnitCondition
        condition_map = {
            "EXCELLENT": InventoryUnitCondition.EXCELLENT,
            "GOOD": InventoryUnitCondition.GOOD,
            "FAIR": InventoryUnitCondition.FAIR,
            "POOR": InventoryUnitCondition.POOR,
            "DAMAGED": InventoryUnitCondition.DAMAGED
        }
        
        new_condition = condition_map.get(return_condition.upper(), InventoryUnitCondition.GOOD)
        
        # Update status and condition for each returned unit
        for i, unit in enumerate(units_to_return):
            updated_unit = await self.inventory_unit_repo.update(unit, {
                "status": InventoryUnitStatus.AVAILABLE.value,    # AVAILABLE status
                "condition": new_condition.value,                 # condition based on return assessment
                "updated_at": datetime.now(timezone.utc),         # Update timestamp
                "updated_by": "system"                            # Update audit
            })
            
            print(f"[RETURN-INVENTORY] ✔ Updated inventory unit {i+1}/{return_quantity}: {unit.sku} -> {InventoryUnitStatus.AVAILABLE.value}/{new_condition.value}")
    
    async def _create_damage_assessment(
        self,
        session: AsyncSession,
        item,
        damage_detail: DamageDetail,
        transaction_header_id: UUID,
        transaction_line_id: UUID
    ) -> DamageAssessment:
        """Create damage assessment record."""
        assessment = DamageAssessment(
            item_id=item.id,
            quantity=damage_detail.quantity,
            damage_date=datetime.now(timezone.utc),
            damage_type=damage_detail.damage_type,
            damage_severity=damage_detail.damage_severity,
            damage_description=damage_detail.description,
            assessment_date=datetime.now(timezone.utc),
            estimated_repair_cost=damage_detail.estimated_repair_cost,
            repair_feasible=damage_detail.damage_severity != "BEYOND_REPAIR",
            transaction_header_id=transaction_header_id,
            transaction_line_id=transaction_line_id
        )
        session.add(assessment)
        return assessment
    
    async def _update_units_to_available(
        self, session: AsyncSession, item_id: UUID, location_id: UUID, quantity: int
    ):
        """Update inventory units to AVAILABLE status."""
        from sqlalchemy import and_
        
        stmt = select(InventoryUnit).where(
            and_(
                InventoryUnit.item_id == str(item_id),
                InventoryUnit.location_id == str(location_id),
                InventoryUnit.status == InventoryUnitStatus.RENTED.value
            )
        ).limit(quantity)
        
        result = await session.execute(stmt)
        units = result.scalars().all()
        
        for unit in units:
            unit.status = InventoryUnitStatus.AVAILABLE.value
            unit.updated_at = datetime.now(timezone.utc)
    
    async def _update_unit_to_damaged(self, session: AsyncSession, serial_no: str):
        """Update specific unit to DAMAGED status."""
        stmt = select(InventoryUnit).where(InventoryUnit.serial_number == serial_no)
        result = await session.execute(stmt)
        unit = result.scalar_one_or_none()
        
        if unit:
            unit.status = InventoryUnitStatus.DAMAGED.value
            unit.condition = InventoryUnitCondition.DAMAGED.value
            unit.updated_at = datetime.now(timezone.utc)
    
    async def _update_unit_to_beyond_repair(self, session: AsyncSession, serial_no: str):
        """Update specific unit to BEYOND_REPAIR status."""
        stmt = select(InventoryUnit).where(InventoryUnit.serial_number == serial_no)
        result = await session.execute(stmt)
        unit = result.scalar_one_or_none()
        
        if unit:
            unit.status = InventoryUnitStatus.BEYOND_REPAIR.value
            unit.condition = InventoryUnitCondition.DAMAGED.value
            unit.updated_at = datetime.now(timezone.utc)
    
    def _calculate_lost_charges(self, item_return, item) -> Decimal:
        """Calculate charges for lost items."""
        if item_return.quantity_lost > 0 and item.purchase_price:
            return item_return.quantity_lost * item.purchase_price
        return Decimal("0")
    
    async def _create_mixed_return_movement(
        self,
        session: AsyncSession,
        stock_level: StockLevel,
        item_return,
        transaction_header_id: UUID,
        transaction_line_id: UUID,
        original_on_rent: Decimal
    ):
        """Create stock movement for mixed return."""
        movement_notes = (
            f"Mixed return: Good={item_return.quantity_good}, "
            f"Damaged={item_return.quantity_damaged}, "
            f"Beyond Repair={item_return.quantity_beyond_repair}, "
            f"Lost={item_return.quantity_lost}"
        )
        
        movement = StockMovement(
            stock_level_id=stock_level.id,
            item_id=stock_level.item_id,
            location_id=stock_level.location_id,
            movement_type=StockMovementType.RENTAL_RETURN_MIXED,
            transaction_header_id=transaction_header_id,
            transaction_line_id=transaction_line_id,
            quantity_change=-item_return.total_return_quantity,
            quantity_before=original_on_rent,
            quantity_after=stock_level.quantity_on_rent,
            created_by="system",
            updated_by="system"
        )
        session.add(movement)
    
    async def _calculate_financial_impact(
        self, 
        session: AsyncSession, 
        rental: Dict[str, Any], 
        return_request: RentalReturnRequest
    ) -> Dict[str, Any]:
        """Calculate financial impact of the return (deposits, fees, etc.)"""
        
        # Basic financial impact calculation
        # This could be expanded to include late fees, damage charges, etc.
        
        total_deposit = float(rental.get("deposit_amount", 0))
        
        # Check if return is late and calculate late fees
        expected_return = date.fromisoformat(rental["rental_end_date"])
        actual_return = return_request.return_date
        days_late = max(0, (actual_return - expected_return).days)
        
        late_fee = 0.0
        if days_late > 0:
            # Example: $5 per day late fee per item
            total_items = len(return_request.items)
            late_fee = days_late * total_items * 5.0
        
        return {
            "deposit_amount": total_deposit,
            "late_fees": late_fee,
            "days_late": days_late,
            "total_refund": max(0, total_deposit - late_fee),
            "charges_applied": late_fee > 0
        }