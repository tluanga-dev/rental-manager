from __future__ import annotations
import asyncio
from datetime import date, datetime, time, timezone
from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4, UUID
import pytz
from sqlalchemy import literal, select, update, case, func, or_
from sqlalchemy.dialects.postgresql import insert as pg_insert, UUID as PostgreSQLUUID
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from sqlalchemy.sql import text

from app.modules.customers.models import Customer
from app.modules.inventory.enums import StockMovementType
from app.modules.inventory.models import StockMovement, StockLevel, InventoryUnit
from app.modules.master_data.item_master.models import Item
from app.modules.master_data.locations.models import Location
from app.modules.transactions.base.models.transaction_headers import (
    TransactionHeader, TransactionType, TransactionStatus, RentalPeriodUnit
)
from app.modules.transactions.base.models.transaction_lines import TransactionLine, LineItemType
from app.modules.transactions.base.models import RentalStatus
from app.modules.transactions.rentals.rental_core.schemas import NewRentalRequest


class RentalsRepository:
    """
    Pure SQLAlchemy 2.0, 4 round-trips max.
    All DB modifications are executed in a single transaction
    that is automatically rolled-back on any exception.
    """

    # ------------------------------------------------------------------
    # PUBLIC ENTRY POINT
    # ------------------------------------------------------------------
    async def create_transaction(
        self, session: AsyncSession, dto: NewRentalRequest
    ) -> dict:
        """
        Create a rental transaction and all related records atomically.
        The entire method is wrapped in a single DB transaction.
        """
        # Execute operations within the session (caller manages transaction)
        # 1. Validate customer & location
        cust, loc = await self._validate_customer_location(
            session, dto.customer_id, dto.location_id
        )

        # 2. Validate items & stock
        ctx = await self._validate_items_and_stock(
            session, dto.items, loc.id
        )

        # 3. Insert transaction header
        header = await self._insert_header(session, dto, cust.id, loc.id, ctx)

        # 4. Bulk-insert lines + stock movements
        await self._bulk_insert_lines_and_movements(session, header, ctx, dto)

        # 5. Bulk-update stock levels
        await self._bulk_update_stock_levels(session, ctx, loc.id, dto)

        # 6. Reserve inventory units (serialised items)
        await self._bulk_reserve_inventory_units(session, ctx, loc.id, dto)

        return {"tx_id": str(header.id), "tx_number": header.transaction_number}

    # ------------------------------------------------------------------
    # INTERNAL HELPERS
    # ------------------------------------------------------------------
    async def _validate_customer_location(
        self, s: AsyncSession, cid: str | UUID, lid: str | UUID
    ) -> tuple[Customer, Location]:
        cid = UUID(str(cid))
        lid = UUID(str(lid))

        stmt = (
            select(Customer, Location)
            .join(Location, Location.id == lid)
            .where(
                Customer.id == cid,
                Customer.is_active.is_(True),
                Customer.status == "ACTIVE",
                Customer.blacklist_status != "BLACKLISTED",
                Location.is_active.is_(True),
            )
        )
        row = (await s.execute(stmt)).first()
        if not row:
            raise ValueError("Invalid customer or location")
        return row.Customer, row.Location

    async def _validate_items_and_stock(
        self, s: AsyncSession, items: list, lid: UUID
    ) -> dict:
        wanted = {
            UUID(str(it.item_id)): Decimal(str(it.quantity))
            for it in items
        }

        # Ensure positive quantities
        for item_id, qty in wanted.items():
            if qty <= 0:
                raise ValueError(f"Item {item_id}: quantity must be positive")

        stmt = (
            select(Item, StockLevel)
            .join(StockLevel, (StockLevel.item_id == Item.id) & (StockLevel.location_id == lid))
            .where(Item.id.in_(wanted), Item.is_active.is_(True))
        )
        rows = (await s.execute(stmt)).all()

        item_map = {r.Item.id: r.Item for r in rows}
        stock_map = {UUID(str(r.StockLevel.item_id)): r.StockLevel for r in rows}

        missing = wanted.keys() - item_map.keys()
        if missing:
            raise ValueError(f"Item(s) inactive or not found: {missing}")

        no_stock = wanted.keys() - stock_map.keys()
        if no_stock:
            raise ValueError(f"Stock level missing at location {lid}: {no_stock}")

        for iid, qty in wanted.items():
            if stock_map[iid].quantity_available < qty:
                raise ValueError(
                    f"Insufficient stock for {iid}: requested={qty}, available={stock_map[iid].quantity_available}"
                )

        return {"item_map": item_map, "stock_map": stock_map}

    async def _insert_header(
        self, s: AsyncSession, dto, cid: UUID, lid: UUID, ctx: dict
    ) -> TransactionHeader:
        subtotal = Decimal("0.00")
        for it in dto.items:
            item_id = UUID(str(it.item_id))
            unit_rate = Decimal(str(it.unit_rate))
            rental_periods = Decimal(str(it.rental_period_value or 1))
            discount = Decimal(str(it.discount_value or 0))
            qty = Decimal(str(it.quantity))
            subtotal += (qty * unit_rate * rental_periods - discount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        tax = (subtotal * Decimal("0.18")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        # Parse datetime safely - ensure timezone-naive for database storage
        if isinstance(dto.transaction_date, str):
            transaction_date = datetime.fromisoformat(dto.transaction_date.replace("Z", "+00:00"))
            # Convert to UTC and make timezone-naive for database
            if transaction_date.tzinfo is not None:
                transaction_date = transaction_date.astimezone(pytz.UTC).replace(tzinfo=None)
        elif isinstance(dto.transaction_date, datetime):
            transaction_date = dto.transaction_date
            # Convert to UTC and make timezone-naive for database
            if transaction_date.tzinfo is not None:
                transaction_date = transaction_date.astimezone(pytz.UTC).replace(tzinfo=None)
        elif isinstance(dto.transaction_date, date):
            # If it's a date, convert to datetime at start of day in UTC
            transaction_date = datetime.combine(dto.transaction_date, time.min)
        else:
            # Current time in UTC, timezone-naive for database
            transaction_date = datetime.now(timezone.utc)
        
        # Parse time fields safely
        def parse_time_str(time_str):
            if time_str is None:
                return None
            if isinstance(time_str, str):
                return time.fromisoformat(time_str)
            return time_str

        header = TransactionHeader(
            id=uuid4(),
            transaction_number=await self._next_tx_number(s),
            transaction_type=TransactionType.RENTAL,
            status=TransactionStatus.IN_PROGRESS,  # Set rental status to IN_PROGRESS
            transaction_date=transaction_date,
            customer_id=str(cid),
            location_id=str(lid),
            payment_method=dto.payment_method,
            subtotal=subtotal,
            tax_amount=tax,
            total_amount=subtotal + tax,
            deposit_amount=Decimal(str(dto.deposit_amount or 0)),
            delivery_required=dto.delivery_required,
            delivery_address=dto.delivery_address,
            delivery_date=dto.delivery_date,
            delivery_time=parse_time_str(dto.delivery_time),
            pickup_required=dto.pickup_required,
            pickup_date=dto.pickup_date,
            pickup_time=parse_time_str(dto.pickup_time),
            reference_number=dto.reference_number,
        )
        s.add(header)
        await s.flush()
        return header

    async def _bulk_insert_lines_and_movements(
        self, s: AsyncSession, header: TransactionHeader, ctx: dict, dto
    ):
        lines, moves = [], []
        period_map = {"DAILY": RentalPeriodUnit.DAY, "WEEKLY": RentalPeriodUnit.WEEK, "MONTHLY": RentalPeriodUnit.MONTH}
        for idx, it in enumerate(dto.items):
            item_id = UUID(str(it.item_id))
            db_item = ctx["item_map"][item_id]

            qty = Decimal(str(it.quantity))
            unit_price = Decimal(str(it.unit_rate))
            rental_periods = Decimal(str(it.rental_period_value or 1))
            discount = Decimal(str(it.discount_value or 0))
            line_total = (qty * unit_price * rental_periods - discount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            transaction_line = TransactionLine(
                id=uuid4(),  # Generate UUID explicitly to ensure transaction_line_id is available
                transaction_header_id=header.id,
                item_id=str(item_id),
                line_number=idx + 1,
                line_type=LineItemType.PRODUCT,
                sku=db_item.sku or f"SKU-{str(item_id)[:8]}",  # Add required SKU field
                description=db_item.item_name or f"Rental Item {db_item.sku}",
                quantity=qty,
                unit_price=unit_price,
                line_total=line_total,
                discount_amount=discount,
                rental_period=it.rental_period_value,
                rental_period_unit=period_map.get(it.rental_period_type, RentalPeriodUnit.DAY),
                rental_start_date=it.rental_start_date,
                rental_end_date=it.rental_end_date,
                current_rental_status=RentalStatus.RENTAL_INPROGRESS,  # Set initial rental status
                notes=it.notes or "",
            )
            lines.append(transaction_line)

            sl = ctx["stock_map"][item_id]
            moves.append(
                StockMovement(
                    id=uuid4(),
                    stock_level_id=sl.id,
                    item_id=item_id,
                    location_id=header.location_id,
                    movement_type=StockMovementType.RENTAL_OUT,
                    quantity_change=-qty,
                    quantity_before=sl.quantity_on_hand,
                    quantity_after=sl.quantity_on_hand - qty,
                    transaction_header_id=header.id,
                    transaction_line_id=transaction_line.id  # Use the specific transaction line ID
                )
            )

        s.add_all(lines)
        s.add_all(moves)
        await s.flush()

    async def _bulk_update_stock_levels(
        self, s: AsyncSession, ctx: dict, lid: UUID, dto
    ):
        # Update each item individually to avoid UUID casting issues
        for it in dto.items:
            item_id = UUID(str(it.item_id))
            qty = Decimal(str(it.quantity))
            
            stmt = (
                update(StockLevel)
                .where(StockLevel.item_id == item_id, StockLevel.location_id == lid)
                .values(
                    quantity_available=StockLevel.quantity_available - qty,
                    quantity_on_rent=StockLevel.quantity_on_rent + qty,
                )
            )
            await s.execute(stmt)
        
        # Flush to ensure updates are visible
        await s.flush()

    async def _bulk_reserve_inventory_units(
        self, s: AsyncSession, ctx: dict, lid: UUID, dto
    ):
        """
        Atomically reserve inventory units for serialised items.
        Uses SELECT ... FOR UPDATE SKIP LOCKED to prevent race conditions.
        """
        for it in dto.items:
            item_id = UUID(str(it.item_id))
            db_item = ctx["item_map"][item_id]
            if not db_item.serial_number_required:
                continue

            qty = int(it.quantity)

            # Lock & fetch units
            rows = await s.execute(
                select(InventoryUnit.id)
                .where(
                    InventoryUnit.item_id == item_id,
                    InventoryUnit.location_id == lid,
                    InventoryUnit.status == "AVAILABLE",
                )
                .order_by(InventoryUnit.id)
                .limit(qty)
                .with_for_update(skip_locked=True)
            )
            unit_ids = [r[0] for r in rows]

            if len(unit_ids) < qty:
                raise ValueError(
                    f"Insufficient inventory units for {item_id}: "
                    f"requested={qty}, available={len(unit_ids)}"
                )

            # Bulk update
            await s.execute(
                update(InventoryUnit)
                .where(InventoryUnit.id.in_(unit_ids))
                .values(status="RENTED")
            )

    async def get_all_rentals(
        self, 
        session: AsyncSession, 
        skip: int = 0, 
        limit: int = 100,
        search: str = None,
        customer_id: str = None,
        location_id: str = None,
        status: str = None,
        rental_status: str = None,
        payment_status: str = None,
        start_date: date = None,
        end_date: date = None,
        rental_start_date: date = None,
        rental_end_date: date = None,
        item_id: str = None,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> list[dict]:
        # Base query
        stmt = (
            select(
                TransactionHeader,
                case(
                    (Customer.customer_type == "BUSINESS", Customer.business_name),
                    else_=func.concat(Customer.first_name, " ", Customer.last_name)
                ).label("customer_name"),
                Customer.email.label("customer_email"),
                Customer.phone.label("customer_phone"),
                Location.location_name.label("location_name"),
            )
            .join(Customer, Customer.id == func.cast(TransactionHeader.customer_id, postgresql.UUID))
            .join(Location, Location.id == func.cast(TransactionHeader.location_id, postgresql.UUID))
            .where(TransactionHeader.transaction_type == TransactionType.RENTAL)
        )

        # Apply search filter
        if search and search.strip():
            search_term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    case(
                        (Customer.customer_type == "BUSINESS", Customer.business_name),
                        else_=func.concat(Customer.first_name, " ", Customer.last_name)
                    ).ilike(search_term),
                    TransactionHeader.transaction_number.ilike(search_term),
                    TransactionHeader.reference_number.ilike(search_term),
                    Location.location_name.ilike(search_term)
                )
            )

        # Apply other filters
        if customer_id:
            try:
                customer_uuid = UUID(str(customer_id))
                stmt = stmt.where(TransactionHeader.customer_id == str(customer_uuid))
            except ValueError:
                pass

        if location_id:
            try:
                location_uuid = UUID(str(location_id))
                stmt = stmt.where(TransactionHeader.location_id == str(location_uuid))
            except ValueError:
                pass

        if status:
            stmt = stmt.where(TransactionHeader.status == status)

        if payment_status:
            stmt = stmt.where(TransactionHeader.payment_status == payment_status)

        if start_date:
            start_datetime = datetime.combine(start_date, datetime.min.time())
            stmt = stmt.where(TransactionHeader.created_at >= start_datetime)

        if end_date:
            end_datetime = datetime.combine(end_date, datetime.max.time())
            stmt = stmt.where(TransactionHeader.created_at <= end_datetime)

        # Apply sorting
        sort_column = TransactionHeader.created_at  # Default
        if sort_by == "transaction_date":
            sort_column = TransactionHeader.transaction_date
        elif sort_by == "customer_name":
            sort_column = case(
                (Customer.customer_type == "BUSINESS", Customer.business_name),
                else_=func.concat(Customer.first_name, " ", Customer.last_name)
            )
        elif sort_by == "location_name":
            sort_column = Location.location_name
        elif sort_by == "total_amount":
            sort_column = TransactionHeader.total_amount
        elif sort_by == "status":
            sort_column = TransactionHeader.status
        elif sort_by == "payment_status":
            sort_column = TransactionHeader.payment_status

        if sort_order.lower() == "asc":
            stmt = stmt.order_by(sort_column.asc())
        else:
            stmt = stmt.order_by(sort_column.desc())

        # Add pagination
        stmt = stmt.offset(skip).limit(limit)
        headers = (await session.execute(stmt)).all()

        if not headers:
            return []

        tx_ids = [h.TransactionHeader.id for h in headers]

        lines_stmt = (
            select(TransactionLine, Item.item_name, Item.sku)
            .join(Item, Item.id == func.cast(TransactionLine.item_id, postgresql.UUID))
            .where(TransactionLine.transaction_header_id.in_(tx_ids))
            .order_by(TransactionLine.transaction_header_id, TransactionLine.line_number)
        )
        lines = (await session.execute(lines_stmt)).all()

        # Group lines
        lines_by_tx = {}
        for line, item_name, sku in lines:
            tx_id = line.transaction_header_id
            lines_by_tx.setdefault(tx_id, []).append(
                {
                    "line_number": line.line_number,
                    "item_id": line.item_id,
                    "item_name": item_name,
                    "sku": sku,
                    "description": line.description,
                    "quantity": float(line.quantity),
                    "unit_price": float(line.unit_price),
                    "line_total": float(line.line_total),
                    "discount_amount": float(line.discount_amount or 0),
                    "rental_period": line.rental_period,
                    "rental_period_unit": line.rental_period_unit.value if line.rental_period_unit else None,
                    "rental_start_date": line.rental_start_date.isoformat() if line.rental_start_date else None,
                    "rental_end_date": line.rental_end_date.isoformat() if line.rental_end_date else None,
                    "current_rental_status": line.current_rental_status.value if line.current_rental_status else None,
                }
            )

        results = []
        for h in headers:
            items = lines_by_tx.get(h.TransactionHeader.id, [])
            
            # Calculate rental period from first item if available
            rental_start_date = None
            rental_end_date = None
            duration_days = 0
            
            if items:
                first_item = items[0]
                rental_start_date = first_item.get("rental_start_date")
                rental_end_date = first_item.get("rental_end_date")
                
                # Calculate duration
                if rental_start_date and rental_end_date:
                    from datetime import datetime
                    try:
                        start = datetime.fromisoformat(rental_start_date.replace('Z', '+00:00'))
                        end = datetime.fromisoformat(rental_end_date.replace('Z', '+00:00'))
                        duration_days = (end - start).days + 1
                    except:
                        duration_days = 1
            
            # Get first item's rental status for overall rental status
            rental_status = None
            if items:
                rental_status = items[0].get("current_rental_status")
            
            rental_dict = {
                "id": str(h.TransactionHeader.id),
                "transaction_number": h.TransactionHeader.transaction_number,
                "transaction_date": h.TransactionHeader.transaction_date.isoformat() if h.TransactionHeader.transaction_date else None,
                
                # Customer object (frontend expects this structure)
                "customer": {
                    "id": str(h.TransactionHeader.customer_id),
                    "name": h.customer_name or "Unknown",
                    "email": h.customer_email,
                    "phone": h.customer_phone,
                    "customer_type": "INDIVIDUAL"
                },
                
                # Location object
                "location": {
                    "id": str(h.TransactionHeader.location_id),
                    "name": h.location_name or "Unknown"
                },
                
                # Rental period object
                "rental_period": {
                    "start_date": rental_start_date,
                    "end_date": rental_end_date,
                    "duration_days": duration_days
                },
                
                # Financial object
                "financial": {
                    "subtotal": float(h.TransactionHeader.subtotal),
                    "discount_amount": float(h.TransactionHeader.discount_amount or 0),
                    "tax_amount": float(h.TransactionHeader.tax_amount),
                    "total_amount": float(h.TransactionHeader.total_amount),
                    "deposit_amount": float(h.TransactionHeader.deposit_amount or 0)
                },
                
                # Status object
                "status": {
                    "transaction_status": h.TransactionHeader.status.value if hasattr(h.TransactionHeader.status, 'value') else (h.TransactionHeader.status or "PENDING"),
                    "rental_status": rental_status,
                    "payment_status": h.TransactionHeader.payment_status.value if hasattr(h.TransactionHeader.payment_status, 'value') else h.TransactionHeader.payment_status
                },
                
                # Items array
                "items": items,
                
                # Legacy fields for backward compatibility
                "transaction_type": h.TransactionHeader.transaction_type.value if h.TransactionHeader.transaction_type else None,
                "customer_id": str(h.TransactionHeader.customer_id),
                "customer_name": h.customer_name,
                "location_id": str(h.TransactionHeader.location_id),
                "location_name": h.location_name,
                "payment_method": h.TransactionHeader.payment_method.value if hasattr(h.TransactionHeader.payment_method, 'value') else h.TransactionHeader.payment_method,
                "subtotal": float(h.TransactionHeader.subtotal),
                "tax_amount": float(h.TransactionHeader.tax_amount),
                "total_amount": float(h.TransactionHeader.total_amount),
                "deposit_amount": float(h.TransactionHeader.deposit_amount or 0),
                "rental_status": rental_status,
                "payment_status": h.TransactionHeader.payment_status.value if hasattr(h.TransactionHeader.payment_status, 'value') else h.TransactionHeader.payment_status,
                "delivery_required": h.TransactionHeader.delivery_required,
                "delivery_address": h.TransactionHeader.delivery_address,
                "delivery_date": h.TransactionHeader.delivery_date.isoformat() if h.TransactionHeader.delivery_date else None,
                "delivery_time": h.TransactionHeader.delivery_time.isoformat() if h.TransactionHeader.delivery_time else None,
                "pickup_required": h.TransactionHeader.pickup_required,
                "pickup_date": h.TransactionHeader.pickup_date.isoformat() if h.TransactionHeader.pickup_date else None,
                "pickup_time": h.TransactionHeader.pickup_time.isoformat() if h.TransactionHeader.pickup_time else None,
                "reference_number": h.TransactionHeader.reference_number,
                "notes": h.TransactionHeader.notes,
                "created_at": h.TransactionHeader.created_at.isoformat() if h.TransactionHeader.created_at else None,
                "updated_at": h.TransactionHeader.updated_at.isoformat() if h.TransactionHeader.updated_at else None,
            }
            
            results.append(rental_dict)
        
        return results

    async def get_rental_by_id(self, session: AsyncSession, rental_id: str) -> dict | None:
        """
        Get a specific rental transaction by ID with full details including items.
        """
        try:
            rental_uuid = UUID(rental_id)
        except ValueError:
            return None

        # Query to get rental with customer and location info - avoid any properties or computed fields
        stmt = (
            select(
                TransactionHeader.id,
                TransactionHeader.transaction_number,
                TransactionHeader.transaction_type,
                TransactionHeader.transaction_date,
                TransactionHeader.customer_id,
                TransactionHeader.location_id,
                TransactionHeader.payment_method,
                TransactionHeader.subtotal,
                TransactionHeader.tax_amount,
                TransactionHeader.total_amount,
                TransactionHeader.deposit_amount,
                TransactionHeader.discount_amount,
                TransactionHeader.status,
                TransactionHeader.payment_status,
                TransactionHeader.delivery_required,
                TransactionHeader.delivery_address,
                TransactionHeader.delivery_date,
                TransactionHeader.delivery_time,
                TransactionHeader.pickup_required,
                TransactionHeader.pickup_date,
                TransactionHeader.pickup_time,
                TransactionHeader.reference_number,
                TransactionHeader.notes,
                TransactionHeader.created_at,
                TransactionHeader.updated_at,
                case(
                    (Customer.customer_type == "BUSINESS", Customer.business_name),
                    else_=func.concat(Customer.first_name, " ", Customer.last_name)
                ).label("customer_name"),
                Customer.email.label("customer_email"),
                Customer.phone.label("customer_phone"),
                Customer.customer_type,
                Location.location_name.label("location_name"),
            )
            .join(Customer, func.cast(TransactionHeader.customer_id, postgresql.UUID) == Customer.id)
            .join(Location, func.cast(TransactionHeader.location_id, postgresql.UUID) == Location.id)
            .where(
                TransactionHeader.id == rental_uuid,
                TransactionHeader.transaction_type == TransactionType.RENTAL
            )
        )

        result = await session.execute(stmt)
        row = result.first()
        
        if not row:
            return None

        # Get rental items
        lines_stmt = (
            select(
                TransactionLine.id,
                TransactionLine.line_number,
                TransactionLine.item_id,
                TransactionLine.quantity,
                TransactionLine.unit_price,
                TransactionLine.line_total,
                TransactionLine.discount_amount,
                TransactionLine.rental_period,
                TransactionLine.rental_period_unit,
                TransactionLine.rental_start_date,
                TransactionLine.rental_end_date,
                TransactionLine.current_rental_status,
                TransactionLine.notes,
                Item.item_name,
                Item.sku,
                Item.description
            )
            .join(Item, func.cast(TransactionLine.item_id, postgresql.UUID) == Item.id)
            .where(TransactionLine.transaction_header_id == rental_uuid)
            .order_by(TransactionLine.line_number)
        )

        lines_result = await session.execute(lines_stmt)
        lines_rows = lines_result.fetchall()

        rental_items = []
        earliest_start_date = None
        latest_end_date = None
        line_statuses = []
        
        for line in lines_rows:
            item_data = {
                "id": str(line.id) if line.id else None,
                "line_number": line.line_number,
                "item_id": str(line.item_id),
                "item_name": line.item_name,
                "sku": line.sku,
                "description": line.description,
                "quantity": float(line.quantity),
                "unit_price": float(line.unit_price),
                "line_total": float(line.line_total),
                "discount_amount": float(line.discount_amount or 0),
                "rental_period": line.rental_period,
                "rental_period_unit": line.rental_period_unit.value if hasattr(line.rental_period_unit, 'value') else str(line.rental_period_unit) if line.rental_period_unit else None,
                "rental_start_date": line.rental_start_date.isoformat() if line.rental_start_date else None,
                "rental_end_date": line.rental_end_date.isoformat() if line.rental_end_date else None,
                "current_rental_status": line.current_rental_status.value if hasattr(line.current_rental_status, 'value') else str(line.current_rental_status) if line.current_rental_status else None,
                "notes": line.notes,
            }
            rental_items.append(item_data)
            
            # Track rental statuses for aggregation
            if line.current_rental_status:
                line_statuses.append(line.current_rental_status)
            
            # Track earliest start and latest end dates
            if line.rental_start_date:
                if earliest_start_date is None or line.rental_start_date < earliest_start_date:
                    earliest_start_date = line.rental_start_date
            
            if line.rental_end_date:
                if latest_end_date is None or line.rental_end_date > latest_end_date:
                    latest_end_date = line.rental_end_date

        # Aggregate rental status from line statuses
        aggregated_rental_status = None
        if line_statuses:
            # Status aggregation logic (same as TransactionHeader.current_rental_status property)
            if RentalStatus.RENTAL_LATE in line_statuses or RentalStatus.RENTAL_LATE_PARTIAL_RETURN in line_statuses:
                if RentalStatus.RENTAL_PARTIAL_RETURN in line_statuses or RentalStatus.RENTAL_LATE_PARTIAL_RETURN in line_statuses:
                    aggregated_rental_status = RentalStatus.RENTAL_LATE_PARTIAL_RETURN
                else:
                    aggregated_rental_status = RentalStatus.RENTAL_LATE
            elif RentalStatus.RENTAL_PARTIAL_RETURN in line_statuses:
                aggregated_rental_status = RentalStatus.RENTAL_PARTIAL_RETURN
            elif all(status == RentalStatus.RENTAL_COMPLETED for status in line_statuses):
                aggregated_rental_status = RentalStatus.RENTAL_COMPLETED
            elif RentalStatus.RENTAL_EXTENDED in line_statuses:
                aggregated_rental_status = RentalStatus.RENTAL_EXTENDED
            else:
                aggregated_rental_status = RentalStatus.RENTAL_INPROGRESS

        return {
            "id": str(row.id),
            "transaction_number": row.transaction_number,
            "transaction_type": row.transaction_type.value if hasattr(row.transaction_type, 'value') else str(row.transaction_type),
            "transaction_date": row.transaction_date.isoformat() if row.transaction_date else None,
            "customer_id": str(row.customer_id),
            "customer_name": row.customer_name,
            "customer_email": row.customer_email,
            "customer_phone": row.customer_phone,
            "customer_type": row.customer_type,
            "location_id": str(row.location_id),
            "location_name": row.location_name,
            "payment_method": row.payment_method,
            "subtotal": float(row.subtotal),
            "tax_amount": float(row.tax_amount),
            "total_amount": float(row.total_amount),
            "deposit_amount": float(row.deposit_amount or 0),
            "discount_amount": float(row.discount_amount or 0),
            "status": row.status.value if hasattr(row.status, 'value') else str(row.status) if row.status else None,
            "rental_status": aggregated_rental_status.value if hasattr(aggregated_rental_status, 'value') else str(aggregated_rental_status) if aggregated_rental_status else None,
            "payment_status": row.payment_status,
            "rental_start_date": earliest_start_date.isoformat() if earliest_start_date else None,
            "rental_end_date": latest_end_date.isoformat() if latest_end_date else None,
            "delivery_required": row.delivery_required,
            "delivery_address": row.delivery_address,
            "delivery_date": row.delivery_date.isoformat() if row.delivery_date else None,
            "delivery_time": row.delivery_time.isoformat() if row.delivery_time else None,
            "pickup_required": row.pickup_required,
            "pickup_date": row.pickup_date.isoformat() if row.pickup_date else None,
            "pickup_time": row.pickup_time.isoformat() if row.pickup_time else None,
            "reference_number": row.reference_number,
            "notes": row.notes,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
            "items": rental_items,
            "customer": {
                "id": str(row.customer_id),
                "name": row.customer_name,
                "email": row.customer_email,
                "phone": row.customer_phone,
                "customer_type": row.customer_type,
            },
            "location": {
                "id": str(row.location_id),
                "name": row.location_name,
            },
            "financial_summary": {
                "subtotal": float(row.subtotal),
                "discount_amount": float(row.discount_amount or 0),
                "tax_amount": float(row.tax_amount),
                "total_amount": float(row.total_amount),
                "deposit_amount": float(row.deposit_amount or 0),
            },
            "rental_period": {
                "start_date": earliest_start_date.isoformat() if earliest_start_date else None,
                "end_date": latest_end_date.isoformat() if latest_end_date else None,
                "duration_days": (latest_end_date - earliest_start_date).days if earliest_start_date and latest_end_date else 0,
            }
        }

    async def get_rentable_items_with_stock(
        self,
        session: AsyncSession,
        location_id: str | UUID | None = None,
        search_name: str | None = None,
        category_id: str | UUID | None = None,
    ) -> list[dict]:
        from app.modules.master_data.categories.models import Category
        from app.modules.master_data.units.models import UnitOfMeasurement

        location_id = UUID(str(location_id)) if location_id else None
        category_id = UUID(str(category_id)) if category_id else None

        stmt = (
            select(
                Item.id.label("item_id"),
                Item.item_name.label("itemname"),
                Category.name.label("itemcategory_name"),
                Item.rental_rate_per_period.label("rental_rate_per_period"),
                Item.rental_period.label("rental_period"),
                UnitOfMeasurement.name.label("unit_of_measurement"),
                func.coalesce(func.sum(StockLevel.quantity_available), 0).label("available_units"),
                Location.id.label("location_id"),
                Location.location_name.label("location_name"),
            )
            .outerjoin(Category, Category.id == Item.category_id)
            .outerjoin(UnitOfMeasurement, UnitOfMeasurement.id == Item.unit_of_measurement_id)
            .outerjoin(StockLevel, StockLevel.item_id == Item.id)
            .outerjoin(Location, Location.id == StockLevel.location_id)
            .where(
                Item.is_active.is_(True),
                Item.is_rentable.is_(True),
                StockLevel.quantity_available > 0
            )
            .group_by(
                Item.id,
                Item.item_name,
                Category.name,
                Item.rental_rate_per_period,
                Item.rental_period,
                UnitOfMeasurement.name,
                Location.id,
                Location.location_name,
            )
            .order_by(Category.name, Item.item_name, Location.location_name)
        )

        if location_id:
            stmt = stmt.where(StockLevel.location_id == location_id)

        if search_name and search_name.strip():
            stmt = stmt.where(Item.item_name.ilike(func.concat("%", search_name.strip(), "%")))

        if category_id:
            stmt = stmt.where(Item.category_id == category_id)

        rows = (await session.execute(stmt)).all()

        # Group by item
        items = {}
        for r in rows:
            key = str(r.item_id)
            if key not in items:
                items[key] = {
                    "item_id": key,
                    "itemname": r.itemname,
                    "itemcategory_name": r.itemcategory_name or "Uncategorized",
                    "rental_rate_per_period": float(r.rental_rate_per_period or 0),
                    "rental_period": int(r.rental_period or 1),
                    "unit_of_measurement": r.unit_of_measurement or "Unit",
                    "available_units": [],
                }

            if r.location_id:
                items[key]["available_units"].append(
                    {
                        "location_id": str(r.location_id),
                        "location_name": r.location_name or "Unknown",
                        "available_units": int(r.available_units or 0),
                        "quantity_available": int(r.available_units or 0),
                    }
                )

        # Only return items that have at least one available_units entry
        return [item for item in items.values() if item["available_units"]]

    async def get_active_rentals(
        self, 
        session: AsyncSession, 
        skip: int = 0, 
        limit: int = 100,
        location_id: str = None,
        customer_id: str = None
    ) -> list[dict]:
        """
        Get all active rental transactions (in progress, late, extended, or partial returns).
        Active statuses: RENTAL_IN_PROGRESS, RENTAL_LATE, RENTAL_EXTENDED, RENTAL_PARTIAL_RETURN, RENTAL_LATE_PARTIAL_RETURN
        
        Args:
            session: Database session
            skip: Number of records to skip for pagination
            limit: Maximum number of records to return
            location_id: Optional filter by location UUID
            customer_id: Optional filter by customer UUID
        """
        # Define active rental statuses
        active_statuses = [
            RentalStatus.RENTAL_INPROGRESS,
            RentalStatus.RENTAL_LATE, 
            RentalStatus.RENTAL_EXTENDED,
            RentalStatus.RENTAL_PARTIAL_RETURN,
            RentalStatus.RENTAL_LATE_PARTIAL_RETURN
        ]

        # Get transaction headers with customer and location info
        stmt = (
            select(
                TransactionHeader,
                case(
                    (Customer.customer_type == "BUSINESS", Customer.business_name),
                    else_=func.concat(Customer.first_name, " ", Customer.last_name)
                ).label("customer_name"),
                Customer.email.label("customer_email"),
                Customer.phone.label("customer_phone"),
                Customer.customer_type,
                Location.location_name.label("location_name"),
            )
            .join(Customer, Customer.id == func.cast(TransactionHeader.customer_id, postgresql.UUID))
            .join(Location, Location.id == func.cast(TransactionHeader.location_id, postgresql.UUID))
            .where(
                TransactionHeader.transaction_type == TransactionType.RENTAL,
                # Filter by transactions that have active rental status in their lines
                TransactionHeader.id.in_(
                    select(TransactionLine.transaction_header_id)
                    .where(TransactionLine.current_rental_status.in_(active_statuses))
                    .distinct()
                )
            )
        )
        
        # Apply optional filters
        if location_id:
            stmt = stmt.where(TransactionHeader.location_id == location_id)
        if customer_id:
            stmt = stmt.where(TransactionHeader.customer_id == customer_id)
            
        # Apply ordering and pagination
        stmt = stmt.order_by(TransactionHeader.created_at.desc()).offset(skip).limit(limit)
        
        headers = (await session.execute(stmt)).all()

        if not headers:
            return []

        tx_ids = [h.TransactionHeader.id for h in headers]

        # Get transaction lines with items for active rentals only
        lines_stmt = (
            select(TransactionLine, Item.item_name, Item.sku, Item.description)
            .join(Item, Item.id == func.cast(TransactionLine.item_id, postgresql.UUID))
            .where(
                TransactionLine.transaction_header_id.in_(tx_ids),
                TransactionLine.current_rental_status.in_(active_statuses)
            )
            .order_by(TransactionLine.transaction_header_id, TransactionLine.line_number)
        )
        lines = (await session.execute(lines_stmt)).all()

        # Group lines by transaction
        lines_by_tx = {}
        for line, item_name, sku, description in lines:
            tx_id = line.transaction_header_id
            lines_by_tx.setdefault(tx_id, []).append(
                {
                    "id": str(line.id),
                    "line_number": line.line_number,
                    "item_id": line.item_id,
                    "item_name": item_name,
                    "sku": sku,
                    "description": description,
                    "quantity": float(line.quantity),
                    "unit_price": float(line.unit_price),
                    "line_total": float(line.line_total),
                    "discount_amount": float(line.discount_amount or 0),
                    "rental_period": line.rental_period,
                    "rental_period_unit": line.rental_period_unit,
                    "rental_start_date": line.rental_start_date.isoformat() if line.rental_start_date else None,
                    "rental_end_date": line.rental_end_date.isoformat() if line.rental_end_date else None,
                    "current_rental_status": line.current_rental_status.value if line.current_rental_status else None,
                    "notes": line.notes,
                }
            )

        # Calculate aggregated rental status for each transaction
        result = []
        for h in headers:
            header = h.TransactionHeader
            tx_lines = lines_by_tx.get(header.id, [])
            
            # Aggregate rental status from lines
            line_statuses = [
                RentalStatus(line["current_rental_status"]) 
                for line in tx_lines 
                if line["current_rental_status"]
            ]
            
            aggregated_rental_status = None
            if line_statuses:
                # Status aggregation logic
                if RentalStatus.RENTAL_LATE in line_statuses or RentalStatus.RENTAL_LATE_PARTIAL_RETURN in line_statuses:
                    if RentalStatus.RENTAL_PARTIAL_RETURN in line_statuses or RentalStatus.RENTAL_LATE_PARTIAL_RETURN in line_statuses:
                        aggregated_rental_status = RentalStatus.RENTAL_LATE_PARTIAL_RETURN
                    else:
                        aggregated_rental_status = RentalStatus.RENTAL_LATE
                elif RentalStatus.RENTAL_PARTIAL_RETURN in line_statuses:
                    aggregated_rental_status = RentalStatus.RENTAL_PARTIAL_RETURN
                elif RentalStatus.RENTAL_EXTENDED in line_statuses:
                    aggregated_rental_status = RentalStatus.RENTAL_EXTENDED
                else:
                    aggregated_rental_status = RentalStatus.RENTAL_INPROGRESS

            # Calculate rental period info
            rental_start_date = None
            rental_end_date = None
            if tx_lines:
                start_dates = [line["rental_start_date"] for line in tx_lines if line["rental_start_date"]]
                end_dates = [line["rental_end_date"] for line in tx_lines if line["rental_end_date"]]
                rental_start_date = min(start_dates) if start_dates else None
                rental_end_date = max(end_dates) if end_dates else None

            # Calculate if overdue
            is_overdue = False
            days_overdue = 0
            if rental_end_date:
                end_date_obj = date.fromisoformat(rental_end_date.split('T')[0])
                if end_date_obj < date.today():
                    is_overdue = True
                    days_overdue = (date.today() - end_date_obj).days

            result.append({
                "id": str(header.id),
                "transaction_number": header.transaction_number,
                "transaction_date": header.transaction_date.isoformat() if header.transaction_date else None,
                "customer_id": header.customer_id,
                "customer_name": h.customer_name,
                "customer_email": h.customer_email,
                "customer_phone": h.customer_phone,
                "customer_type": h.customer_type,
                "location_id": header.location_id,
                "location_name": h.location_name,
                "payment_method": header.payment_method,
                "subtotal": float(header.subtotal),
                "tax_amount": float(header.tax_amount),
                "total_amount": float(header.total_amount),
                "deposit_amount": float(header.deposit_amount or 0),
                "discount_amount": float(header.discount_amount or 0),
                "status": header.status.value if header.status else None,
                "rental_status": aggregated_rental_status.value if aggregated_rental_status else None,
                "payment_status": header.payment_status,
                "rental_start_date": rental_start_date,
                "rental_end_date": rental_end_date,
                "is_overdue": is_overdue,
                "days_overdue": days_overdue,
                "delivery_required": header.delivery_required,
                "delivery_address": header.delivery_address,
                "delivery_date": header.delivery_date.isoformat() if header.delivery_date else None,
                "delivery_time": header.delivery_time.isoformat() if header.delivery_time else None,
                "pickup_required": header.pickup_required,
                "pickup_date": header.pickup_date.isoformat() if header.pickup_date else None,
                "pickup_time": header.pickup_time.isoformat() if header.pickup_time else None,
                "reference_number": header.reference_number,
                "notes": header.notes,
                "created_at": header.created_at.isoformat() if header.created_at else None,
                "updated_at": header.updated_at.isoformat() if header.updated_at else None,
                "items": tx_lines,
                "items_count": len(tx_lines),
                "customer": {
                    "id": header.customer_id,
                    "name": h.customer_name,
                    "email": h.customer_email,
                    "phone": h.customer_phone,
                    "customer_type": h.customer_type,
                },
                "location": {
                    "id": header.location_id,
                    "name": h.location_name,
                },
                "financial_summary": {
                    "subtotal": float(header.subtotal),
                    "discount_amount": float(header.discount_amount or 0),
                    "tax_amount": float(header.tax_amount),
                    "total_amount": float(header.total_amount),
                    "deposit_amount": float(header.deposit_amount or 0),
                },
                "rental_period": {
                    "start_date": rental_start_date,
                    "end_date": rental_end_date,
                    "duration_days": (date.fromisoformat(rental_end_date.split('T')[0]) - date.fromisoformat(rental_start_date.split('T')[0])).days if rental_start_date and rental_end_date else 0,
                }
            })

        return result

    async def get_due_today_rentals(
        self,
        session: AsyncSession,
        location_id: str | UUID | None = None,
        search: str | None = None,
        status: str | None = None,
    ) -> list[dict]:
        """
        Get all rental transactions that are due today.
        
        Args:
            session: Database session
            location_id: Optional location filter
            search: Optional search term for customer name or transaction number
            status: Optional status filter
            
        Returns:
            List of dictionaries with due today rental data
        """
        from app.modules.master_data.item_master.models import Item
        
        today = date.today()
        location_id = UUID(str(location_id)) if location_id else None
        
        # Base query for rentals due today
        stmt = (
            select(
                TransactionHeader,
                case(
                    (Customer.customer_type == "BUSINESS", Customer.business_name),
                    else_=func.concat(Customer.first_name, " ", Customer.last_name)
                ).label("customer_name"),
                Customer.phone.label("customer_phone"),
                Customer.email.label("customer_email"),
                Location.location_name.label("location_name"),
                func.count(TransactionLine.id).label("items_count"),
            )
            .join(Customer, Customer.id == func.cast(TransactionHeader.customer_id, postgresql.UUID))
            .join(Location, Location.id == func.cast(TransactionHeader.location_id, postgresql.UUID))
            .join(TransactionLine, TransactionLine.transaction_header_id == TransactionHeader.id)
            .where(
                TransactionHeader.transaction_type == TransactionType.RENTAL,
                TransactionLine.rental_end_date == today,
                TransactionHeader.status.in_([TransactionStatus.PENDING, TransactionStatus.PROCESSING, TransactionStatus.IN_PROGRESS])
            )
            .group_by(
                TransactionHeader.id,
                Customer.customer_type,
                Customer.business_name,
                Customer.first_name,
                Customer.last_name,
                Customer.phone,
                Customer.email,
                Location.location_name,
            )
            .order_by(TransactionHeader.created_at.desc())
        )
        
        # Apply filters
        if location_id:
            stmt = stmt.where(TransactionHeader.location_id == str(location_id))
            
        if search and search.strip():
            search_term = f"%{search.strip()}%"
            stmt = stmt.where(
                func.or_(
                    case(
                        (Customer.customer_type == "BUSINESS", Customer.business_name),
                        else_=func.concat(Customer.first_name, " ", Customer.last_name)
                    ).ilike(search_term),
                    TransactionHeader.transaction_number.ilike(search_term)
                )
            )
            
        if status and status.strip():
            stmt = stmt.where(TransactionHeader.status == status.strip())
        
        headers = (await session.execute(stmt)).all()
        
        if not headers:
            return []
        
        tx_ids = [h.TransactionHeader.id for h in headers]
        
        # Get transaction lines with item details
        lines_stmt = (
            select(
                TransactionLine,
                Item.item_name,
                Item.sku,
            )
            .join(Item, Item.id == func.cast(TransactionLine.item_id, postgresql.UUID))
            .where(
                TransactionLine.transaction_header_id.in_(tx_ids),
                TransactionLine.rental_end_date == today
            )
            .order_by(TransactionLine.transaction_header_id, TransactionLine.line_number)
        )
        lines = (await session.execute(lines_stmt)).all()
        
        # Group lines by transaction
        lines_by_tx = {}
        for line, item_name, sku in lines:
            tx_id = line.transaction_header_id
            lines_by_tx.setdefault(tx_id, []).append({
                "id": str(line.id),
                "item_id": str(line.item_id),
                "item_name": item_name or "Unknown Item",
                "sku": sku,
                "quantity": float(line.quantity),
                "unit_price": float(line.unit_price),
                "rental_period_value": line.rental_period or 1,
                "rental_period_unit": line.rental_period_unit or "DAY",
                "current_rental_status": line.current_rental_status,
                "notes": line.notes or "",
            })
        
        # Build result
        result = []
        for h in headers:
            header = h.TransactionHeader
            
            # Calculate overdue status
            earliest_start = None
            latest_end = None
            for line_data in lines_by_tx.get(header.id, []):
                # We need to get the actual dates from the lines
                pass
            
            # Get the actual rental dates from the first line (they should all be the same for due today)
            rental_start_date = today  # Default
            rental_end_date = today
            
            if lines_by_tx.get(header.id):
                # Get dates from the actual transaction lines
                first_line_id = lines_by_tx[header.id][0]["id"]
                date_stmt = select(TransactionLine.rental_start_date, TransactionLine.rental_end_date).where(
                    TransactionLine.id == UUID(first_line_id)
                )
                date_result = (await session.execute(date_stmt)).first()
                if date_result:
                    rental_start_date = date_result[0]
                    rental_end_date = date_result[1]
            
            days_overdue = max(0, (today - rental_end_date).days) if rental_end_date < today else 0
            is_overdue = rental_end_date < today
            
            result.append({
                "id": str(header.id),
                "transaction_number": header.transaction_number,
                "customer_id": str(header.customer_id),
                "customer_name": h.customer_name or "Unknown Customer",
                "customer_phone": h.customer_phone,
                "customer_email": h.customer_email,
                "location_id": str(header.location_id),
                "location_name": h.location_name or "Unknown Location",
                "rental_start_date": rental_start_date,
                "rental_end_date": rental_end_date,
                "days_overdue": days_overdue,
                "is_overdue": is_overdue,
                "status": header.status,
                "payment_status": header.payment_status,
                "total_amount": float(header.total_amount),
                "deposit_amount": float(header.deposit_amount or 0),
                "items_count": h.items_count,
                "items": lines_by_tx.get(header.id, []),
                "created_at": header.created_at,
                "updated_at": header.updated_at,
            })
        
        return result

    async def _next_tx_number(self, s: AsyncSession) -> str:
        today = date.today().strftime("%Y%m%d")
        last = await s.scalar(
            select(func.max(TransactionHeader.transaction_number)).where(
                TransactionHeader.transaction_number.like(f"RENT-{today}-%")
            )
        )
        seq = int(last.split("-")[-1]) + 1 if last else 1
        return f"RENT-{today}-{seq:04d}"