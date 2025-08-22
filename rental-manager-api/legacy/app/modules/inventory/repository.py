from typing import List, Dict, Any, Optional
from uuid import UUID
from decimal import Decimal
from sqlalchemy import select, func, and_, or_, cast, text, desc, asc
from sqlalchemy.types import String, Integer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.modules.inventory.models import (
    StockMovement, StockLevel, SKUSequence, InventoryUnit
)
from app.modules.inventory.enums import InventoryUnitStatus
from app.modules.master_data.item_master.models import Item
from app.modules.master_data.categories.models import Category
from app.modules.master_data.units.models import UnitOfMeasurement
from app.modules.master_data.brands.models import Brand

class InventoryReadRepository:
    """
    Pure SQLAlchemy Core (no ORM) read repository for aggregated inventory info.
    """

    async def get_all_items_inventory(
        self,
        session: AsyncSession,
        *,
        search: Optional[str] = None,
        sku: Optional[str] = None,
        item_name: Optional[str] = None,
        brand: Optional[str] = None,
        category: Optional[str] = None,
        item_status: Optional[str] = None,
        stock_status: Optional[str] = None,
        min_total: Optional[int] = None,
        max_total: Optional[int] = None,
        min_available: Optional[int] = None,
        max_available: Optional[int] = None,
        sort_by: str = "item_name",
        sort_order: str = "asc",
        skip: int = 0,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Full-text search + multi-column sorting version.
        sort_by can be:
            item_name, sku, brand, category, item_status,
            total, available, rented, stock_status
        sort_order: asc | desc
        """
        # ----- table shortcuts -----
        sl_tbl   = StockLevel.__table__
        item_tbl = Item.__table__
        cat_tbl  = Category.__table__
        uom_tbl  = UnitOfMeasurement.__table__
        brand_tbl = Brand.__table__

        # ----- stock aggregate CTE -----
        stock_cte = (
            select(
                sl_tbl.c.item_id,
                func.coalesce(func.sum(sl_tbl.c.quantity_on_hand), 0).label("total"),
                func.coalesce(func.sum(sl_tbl.c.quantity_available), 0).label("available"),
                func.coalesce(func.sum(sl_tbl.c.quantity_on_rent), 0).label("rented"),
            )
            .group_by(sl_tbl.c.item_id)
            .cte("stock")
        )

        # ----- main query -----
        stmt = (
            select(
                item_tbl.c.sku,
                item_tbl.c.item_name,
                item_tbl.c.item_status,
                brand_tbl.c.name.label("brand"),
                cat_tbl.c.name.label("category"),
                uom_tbl.c.code.label("unit_of_measurement"),
                item_tbl.c.rental_rate_per_period,
                item_tbl.c.sale_price,
                item_tbl.c.purchase_price,  # Add purchase price for valuation
                item_tbl.c.reorder_point,
                stock_cte.c.total,
                stock_cte.c.available,
                stock_cte.c.rented,
            )
            .select_from(
                item_tbl.outerjoin(brand_tbl, brand_tbl.c.id == item_tbl.c.brand_id)
                .outerjoin(cat_tbl, cat_tbl.c.id == item_tbl.c.category_id)
                .outerjoin(uom_tbl, uom_tbl.c.id == item_tbl.c.unit_of_measurement_id)
                .outerjoin(stock_cte, stock_cte.c.item_id == item_tbl.c.id)
            )
            .where(item_tbl.c.is_active.is_(True))
        )

        # ----- filtering -----
        if search:
            like_expr = f"%{search}%"
            stmt = stmt.where(
                or_(
                    cast(item_tbl.c.sku, String).ilike(like_expr),
                    item_tbl.c.item_name.ilike(like_expr),
                    brand_tbl.c.name.ilike(like_expr),
                    cat_tbl.c.name.ilike(like_expr),
                )
            )
        if sku:
            stmt = stmt.where(item_tbl.c.sku.ilike(f"%{sku}%"))
        if item_name:
            stmt = stmt.where(item_tbl.c.item_name.ilike(f"%{item_name}%"))
        if brand:
            stmt = stmt.where(brand_tbl.c.name.ilike(f"%{brand}%"))
        if category:
            stmt = stmt.where(cat_tbl.c.name.ilike(f"%{category}%"))
        if item_status:
            stmt = stmt.where(item_tbl.c.item_status == item_status)

        if stock_status or min_total is not None or max_total is not None or \
           min_available is not None or max_available is not None:
            # inline stock_status calculation
            total_col = cast(stock_cte.c.total, Integer)
            available_col = cast(stock_cte.c.available, Integer)
            reorder_col = cast(item_tbl.c.reorder_point, Integer)

            if min_total is not None:
                stmt = stmt.where(total_col >= min_total)
            if max_total is not None:
                stmt = stmt.where(total_col <= max_total)
            if min_available is not None:
                stmt = stmt.where(available_col >= min_available)
            if max_available is not None:
                stmt = stmt.where(available_col <= max_available)
            if stock_status:
                if stock_status.upper() == "OUT_OF_STOCK":
                    stmt = stmt.where(total_col == 0)
                elif stock_status.upper() == "LOW_STOCK":
                    stmt = stmt.where(and_(total_col > 0, available_col <= reorder_col))
                elif stock_status.upper() == "IN_STOCK":
                    stmt = stmt.where(and_(total_col > 0, available_col > reorder_col))

        # ----- sorting -----
        sortable = {
            "sku": item_tbl.c.sku,
            "item_name": item_tbl.c.item_name,
            "brand": brand_tbl.c.name,
            "category": cat_tbl.c.name,
            "item_status": item_tbl.c.item_status,
            "total": stock_cte.c.total,
            "available": stock_cte.c.available,
            "rented": stock_cte.c.rented,
            "stock_status": text("total"),   # handled below
        }

        order_col = sortable.get(sort_by, item_tbl.c.item_name)
        
        # Handle NULL values properly for stock columns
        if sort_by in ["total", "available", "rented"]:
            if sort_order.lower() == "desc":
                # For descending, add NULLS LAST and secondary sort by SKU ascending for ties
                stmt = stmt.order_by(desc(order_col).nulls_last(), asc(item_tbl.c.sku))
            else:
                # For ascending, add NULLS LAST and secondary sort by SKU ascending for ties
                stmt = stmt.order_by(asc(order_col).nulls_last(), asc(item_tbl.c.sku))
        else:
            if sort_order.lower() == "desc":
                # For descending, add secondary sort by SKU ascending for ties
                stmt = stmt.order_by(desc(order_col), asc(item_tbl.c.sku))
            else:
                # For ascending, add secondary sort by SKU ascending for ties
                stmt = stmt.order_by(asc(order_col), asc(item_tbl.c.sku))

        stmt = stmt.offset(skip)
        if limit is not None:
            stmt = stmt.limit(limit)

        # ----- execute -----
        rows = (await session.execute(stmt)).mappings().all()

        # ----- row shaping -----
        results = []
        for r in rows:
            total = int(r["total"] or 0)
            available = int(r["available"] or 0)
            rented = int(r["rented"] or 0)
            reorder = int(r["reorder_point"] or 0)

            if total == 0:
                status = "OUT_OF_STOCK"
            elif available <= reorder:
                status = "LOW_STOCK"
            else:
                status = "IN_STOCK"

            # Calculate total value using purchase price as primary, sale price as fallback
            purchase_price = Decimal(str(r.get("purchase_price", 0) or 0))
            sale_price = Decimal(str(r["sale_price"]) if r["sale_price"] else 0)
            valuation_price = purchase_price if purchase_price > 0 else sale_price
            total_value = float(Decimal(str(total)) * valuation_price)

            results.append({
                "sku": r["sku"],
                "item_name": r["item_name"],
                "item_status": r["item_status"],
                "brand": r["brand"] or None,
                "category": r["category"] or None,
                "unit_of_measurement": r["unit_of_measurement"] or None,
                "rental_rate": float(r["rental_rate_per_period"]) if r["rental_rate_per_period"] else None,
                "sale_price": float(r["sale_price"]) if r["sale_price"] else None,
                "total_value": round(total_value, 2),  # Add calculated total value
                "stock": {
                    "total": total,
                    "available": available,
                    "rented": rented,
                    "status": status,
                }
            })

        return results
# ---------------------------------------------------------------------------
# StockMovement
# ---------------------------------------------------------------------------
class StockMovementRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, obj: Dict[str, Any]) -> StockMovement:
        db_obj = StockMovement(**obj)
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    def get(self, movement_id: UUID) -> Optional[StockMovement]:
        return self.db.query(StockMovement).filter(StockMovement.id == movement_id).first()

    def list_by_item(
        self,
        item_id: UUID,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> List[StockMovement]:
        return (
            self.db.query(StockMovement)
            .filter(StockMovement.item_id == item_id)
            .order_by(StockMovement.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def list_by_stock_level(
        self,
        stock_level_id: UUID,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> List[StockMovement]:
        return (
            self.db.query(StockMovement)
            .filter(StockMovement.stock_level_id == stock_level_id)
            .order_by(StockMovement.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def update(self, db_obj: StockMovement, updates: Dict[str, Any]) -> StockMovement:
        for k, v in updates.items():
            setattr(db_obj, k, v)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    def delete(self, db_obj: StockMovement) -> None:
        self.db.delete(db_obj)
        self.db.commit()


# ---------------------------------------------------------------------------
# StockLevel
# ---------------------------------------------------------------------------
class StockLevelRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, obj: Dict[str, Any]) -> StockLevel:
        db_obj = StockLevel(**obj)
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    def get(self, stock_level_id: UUID) -> Optional[StockLevel]:
        return self.db.query(StockLevel).filter(StockLevel.id == stock_level_id).first()

    def get_by_item_location(
        self,
        item_id: UUID,
        location_id: UUID,
    ) -> Optional[StockLevel]:
        return (
            self.db.query(StockLevel)
            .filter(
                and_(
                    StockLevel.item_id == item_id,
                    StockLevel.location_id == location_id,
                )
            )
            .first()
        )

    def list_by_item(
        self,
        item_id: UUID,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> List[StockLevel]:
        return (
            self.db.query(StockLevel)
            .filter(StockLevel.item_id == item_id)
            .order_by(StockLevel.location_id)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def list_by_location(
        self,
        location_id: UUID,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> List[StockLevel]:
        return (
            self.db.query(StockLevel)
            .filter(StockLevel.location_id == location_id)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def update(self, db_obj: StockLevel, updates: Dict[str, Any]) -> StockLevel:
        for k, v in updates.items():
            setattr(db_obj, k, v)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    def delete(self, db_obj: StockLevel) -> None:
        self.db.delete(db_obj)
        self.db.commit()


# ---------------------------------------------------------------------------
# SKUSequence
# ---------------------------------------------------------------------------
class SKUSequenceRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, obj: Dict[str, Any]) -> SKUSequence:
        db_obj = SKUSequence(**obj)
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    def get(self, seq_id: UUID) -> Optional[SKUSequence]:
        return self.db.query(SKUSequence).filter(SKUSequence.id == seq_id).first()

    def get_by_codes(
        self,
        brand_code: Optional[str],
        category_code: Optional[str],
    ) -> Optional[SKUSequence]:
        return (
            self.db.query(SKUSequence)
            .filter(
                and_(
                    SKUSequence.brand_code == brand_code,
                    SKUSequence.category_code == category_code,
                )
            )
            .first()
        )

    def next_sequence(self, brand_code: str, category_code: str) -> str:
        seq = self.get_by_codes(brand_code, category_code)
        if not seq:
            seq = self.create(
                {"brand_code": brand_code, "category_code": category_code, "next_sequence": "1"}
            )
        num = seq.get_next_sequence_number()
        seq.increment_sequence()
        self.db.commit()
        return str(num).zfill(6)

    def update(self, db_obj: SKUSequence, updates: Dict[str, Any]) -> SKUSequence:
        for k, v in updates.items():
            setattr(db_obj, k, v)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    def delete(self, db_obj: SKUSequence) -> None:
        self.db.delete(db_obj)
        self.db.commit()


# ---------------------------------------------------------------------------
# InventoryUnit
# ---------------------------------------------------------------------------
class InventoryUnitRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, obj: Dict[str, Any]) -> InventoryUnit:
        db_obj = InventoryUnit(**obj)
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    def get(self, unit_id: UUID) -> Optional[InventoryUnit]:
        return self.db.query(InventoryUnit).filter(InventoryUnit.id == unit_id).first()

    def get_by_sku(self, sku: str) -> Optional[InventoryUnit]:
        return (
            self.db.query(InventoryUnit)
            .filter(InventoryUnit.sku == sku)
            .first()
        )

    def list_by_item(
        self,
        item_id: UUID,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> List[InventoryUnit]:
        return (
            self.db.query(InventoryUnit)
            .filter(InventoryUnit.item_id == item_id)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def list_by_location(
        self,
        location_id: UUID,
        *,
        status: Optional[InventoryUnitStatus] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[InventoryUnit]:
        q = self.db.query(InventoryUnit).filter(InventoryUnit.location_id == location_id)
        if status:
            q = q.filter(InventoryUnit.status == status.value)
        return q.offset(skip).limit(limit).all()

    def list_available_for_rent(
        self,
        item_id: UUID,
        location_id: UUID,
    ) -> List[InventoryUnit]:
        return (
            self.db.query(InventoryUnit)
            .filter(
                and_(
                    InventoryUnit.item_id == item_id,
                    InventoryUnit.location_id == location_id,
                    InventoryUnit.status == InventoryUnitStatus.AVAILABLE.value,
                    InventoryUnit.is_active.is_(True),
                )
            )
            .all()
        )

    def update(self, db_obj: InventoryUnit, updates: Dict[str, Any]) -> InventoryUnit:
        for k, v in updates.items():
            setattr(db_obj, k, v)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    def delete(self, db_obj: InventoryUnit) -> None:
        self.db.delete(db_obj)
        self.db.commit()

        
    @staticmethod
    async def get_all_items_inventory_static(
        session: AsyncSession,
    ) -> List[Dict[str, Any]]:
        """
        Returns list[dict] shaped exactly like the required JSON.
        """
        # Get the table references from the models
        sl_tbl = StockLevel.__table__
        item_tbl = Item.__table__
        cat_tbl = Category.__table__
        uom_tbl = UnitOfMeasurement.__table__

        # 1) Stock sub-query
        stock_sq = (
            select(
                sl_tbl.c.item_id,
                func.coalesce(func.sum(sl_tbl.c.quantity_on_hand), 0).label("total"),
                func.coalesce(func.sum(sl_tbl.c.quantity_available), 0).label("available"),
                func.coalesce(func.sum(sl_tbl.c.quantity_on_rent), 0).label("rented"),
            )
            .group_by(sl_tbl.c.item_id)
            .cte("stock")
        )

        # 2) Main query
        stmt = (
            select(
                item_tbl.c.item_name,
                item_tbl.c.item_status,
                cat_tbl.c.name.label("category"),
                uom_tbl.c.code.label("unit_of_measurement"),
                item_tbl.c.reorder_point,
                stock_sq.c.total,
                stock_sq.c.available,
                stock_sq.c.rented,
            )
            .select_from(
                item_tbl.outerjoin(cat_tbl, cat_tbl.c.id == item_tbl.c.category_id)
                .outerjoin(uom_tbl, uom_tbl.c.id == item_tbl.c.unit_of_measurement_id)
                .outerjoin(stock_sq, stock_sq.c.item_id == item_tbl.c.id)
            )
            .where(item_tbl.c.is_active.is_(True))
        )

        rows = (await session.execute(stmt)).mappings().all()

        # 3) Compose final dict
        results = []
        for r in rows:
            total = int(r["total"] or 0)
            available = int(r["available"] or 0)
            rented = int(r["rented"] or 0)
            reorder = int(r["reorder_point"] or 0)

            status = "OUT_OF_STOCK"
            if total == 0:
                status = "OUT_OF_STOCK"
            elif available <= reorder:
                status = "LOW_STOCK"
            else:
                status = "IN_STOCK"

            results.append(
                {
                    "item_name": r["item_name"],
                    "item_status": r["item_status"],
                    "category": r["category"] or None,
                    "unit_of_measurement": r["unit_of_measurement"] or None,
                    "stock": {
                        "total": total,
                        "available": available,
                        "rented": rented,
                        "status": status,
                    },
                }
            )
        return results


# ---------------------------------------------------------------------------
# ASYNC VERSIONS FOR ASYNC SERVICES
# ---------------------------------------------------------------------------

class AsyncStockMovementRepository:
    """Async version of StockMovementRepository for use with AsyncSession."""
    
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, obj: Dict[str, Any]) -> StockMovement:
        db_obj = StockMovement(**obj)
        self.session.add(db_obj)
        await self.session.flush()  # Use flush instead of commit for transaction control
        await self.session.refresh(db_obj)
        return db_obj

    async def get(self, movement_id: UUID) -> Optional[StockMovement]:
        stmt = select(StockMovement).where(StockMovement.id == movement_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()


class AsyncStockLevelRepository:
    """Async version of StockLevelRepository for use with AsyncSession."""
    
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, obj: Dict[str, Any]) -> StockLevel:
        db_obj = StockLevel(**obj)
        self.session.add(db_obj)
        await self.session.flush()  # Use flush instead of commit for transaction control
        await self.session.refresh(db_obj)
        return db_obj

    async def get(self, stock_level_id: UUID) -> Optional[StockLevel]:
        stmt = select(StockLevel).where(StockLevel.id == stock_level_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_item_location(
        self,
        item_id: UUID,
        location_id: UUID,
    ) -> Optional[StockLevel]:
        stmt = select(StockLevel).where(
            and_(
                StockLevel.item_id == str(item_id),
                StockLevel.location_id == str(location_id),
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def update(self, db_obj: StockLevel, updates: Dict[str, Any]) -> StockLevel:
        for k, v in updates.items():
            setattr(db_obj, k, v)
        await self.session.flush()  # Use flush instead of commit for transaction control
        await self.session.refresh(db_obj)
        return db_obj
    
    async def get_rentable_quantity(self, item_id: UUID, location_id: UUID) -> Decimal:
        """
        Get quantity actually available for rental (excludes damaged).
        CRITICAL: Only quantity_available can be rented!
        """
        stock_level = await self.get_by_item_location(item_id, location_id)
        if not stock_level:
            return Decimal("0")
        
        # ONLY quantity_available can be rented
        # Damaged, under_repair, beyond_repair are EXCLUDED
        return max(stock_level.quantity_available, Decimal("0"))
    
    async def can_fulfill_rental(self, item_id: UUID, location_id: UUID, quantity: Decimal) -> bool:
        """
        Check if rental can be fulfilled (damaged items excluded).
        Returns True only if sufficient AVAILABLE (non-damaged) inventory exists.
        """
        rentable = await self.get_rentable_quantity(item_id, location_id)
        return rentable >= quantity and quantity > 0


class AsyncInventoryUnitRepository:
    """Async version of InventoryUnitRepository for use with AsyncSession."""
    
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, obj: Dict[str, Any]) -> InventoryUnit:
        try:
            db_obj = InventoryUnit(**obj)
            self.session.add(db_obj)
            await self.session.flush()  # Use flush instead of commit for transaction control
            await self.session.refresh(db_obj)
            return db_obj
        except Exception as e:
            # Log the actual error for debugging
            error_str = str(e)
            print(f"[InventoryUnitRepo] Failed to create inventory unit: {error_str}")
            print(f"[InventoryUnitRepo] Data attempted: SKU={obj.get('sku')}, Serial={obj.get('serial_number')}, Batch={obj.get('batch_code')}")
            
            # Re-raise with more context if it's a constraint violation
            if "violates unique constraint" in error_str.lower():
                if "serial" in error_str.lower():
                    raise ValueError(f"Serial number '{obj.get('serial_number')}' already exists")
                elif "batch" in error_str.lower():
                    raise ValueError(f"Batch code '{obj.get('batch_code')}' already exists")
                elif "sku" in error_str.lower():
                    raise ValueError(f"SKU '{obj.get('sku')}' already exists")
            elif "violates check constraint" in error_str.lower():
                if "check_serial_or_batch" in error_str.lower():
                    raise ValueError(f"Item must have either serial number OR batch code, not both. Serial: {obj.get('serial_number')}, Batch: {obj.get('batch_code')}")
                elif "check_serial_batch_exclusive" in error_str.lower():
                    raise ValueError(f"Item cannot have both serial number and batch code. Serial: {obj.get('serial_number')}, Batch: {obj.get('batch_code')}")
            
            raise

    async def get(self, unit_id: UUID) -> Optional[InventoryUnit]:
        stmt = select(InventoryUnit).where(InventoryUnit.id == unit_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_sku(self, sku: str) -> Optional[InventoryUnit]:
        stmt = select(InventoryUnit).where(InventoryUnit.sku == sku)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_serial_number(self, serial_number: str) -> Optional[InventoryUnit]:
        """Get inventory unit by serial number."""
        stmt = select(InventoryUnit).where(InventoryUnit.serial_number == serial_number)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_item(
        self,
        item_id: UUID,
        status: Optional[InventoryUnitStatus] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[InventoryUnit]:
        stmt = select(InventoryUnit).where(InventoryUnit.item_id == str(item_id))
        
        if status:
            stmt = stmt.where(InventoryUnit.status == status.value)
        
        stmt = stmt.offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def generate_sku(self, item_id: UUID) -> str:
        """Generate a unique SKU for an inventory unit."""
        # Get the item to use its SKU as base
        from app.modules.master_data.item_master.models import Item
        item_stmt = select(Item).where(Item.id == item_id)
        item_result = await self.session.execute(item_stmt)
        item = item_result.scalar_one_or_none()
        
        if not item:
            raise ValueError(f"Item {item_id} not found")
        
        # Use a more robust method to find the next available sequence
        # Get the highest sequence number for this item's SKU pattern
        pattern = f"{item.sku}-%"
        max_seq_stmt = select(
            func.max(
                func.cast(
                    func.right(InventoryUnit.sku, 4), 
                    Integer
                )
            )
        ).where(
            InventoryUnit.sku.like(pattern)
        )
        
        try:
            max_seq_result = await self.session.execute(max_seq_stmt)
            max_sequence = max_seq_result.scalar() or 0
        except:
            # Fallback to count-based approach if the above fails
            count_stmt = select(func.count(InventoryUnit.id)).where(
                InventoryUnit.item_id == str(item_id)
            )
            count_result = await self.session.execute(count_stmt)
            max_sequence = count_result.scalar() or 0
        
        # Generate next sequence number
        next_sequence = max_sequence + 1
        
        # Generate SKU: ITEM_SKU-NNNN with retry logic for uniqueness
        for attempt in range(10):  # Max 10 attempts
            candidate_sku = f"{item.sku}-{next_sequence + attempt:04d}"
            
            # Check if this SKU already exists
            exists_stmt = select(func.count(InventoryUnit.id)).where(
                InventoryUnit.sku == candidate_sku
            )
            exists_result = await self.session.execute(exists_stmt)
            exists = exists_result.scalar() > 0
            
            if not exists:
                return candidate_sku
        
        # If all attempts failed, use timestamp-based suffix
        from datetime import datetime
        timestamp_suffix = datetime.now().strftime("%m%d%H%M%S")
        return f"{item.sku}-{timestamp_suffix}"
    
    async def generate_batch_id(self, item_id: UUID, transaction_id: Optional[UUID] = None) -> str:
        """
        Generate a unique batch ID for non-serialized items.
        For extreme concurrency, uses UUID-based generation for guaranteed uniqueness.
        """
        from datetime import datetime, timezone
        import uuid
        
        # Get current date for batch ID
        now = datetime.now(timezone.utc)
        date_str = now.strftime("%Y%m%d")
        
        # Get item prefix
        from app.modules.master_data.item_master.models import Item
        item_stmt = select(Item).where(Item.id == item_id)
        item_result = await self.session.execute(item_stmt)
        item = item_result.scalar_one_or_none()
        
        prefix = "XXXX"  # Default prefix
        if item and item.sku:
            # Use first 4 chars of SKU
            clean_sku = ''.join(c for c in item.sku if c.isalnum())
            if clean_sku:
                prefix = clean_sku[:4].upper().ljust(4, '0')
        
        # Generate unique suffix using UUID
        # This guarantees uniqueness even with thousands of concurrent requests
        unique_suffix = str(uuid.uuid4())[:8].upper()
        
        # Format: BATCH-YYYYMMDD-PREFIX-UUUUUUUU
        return f"BATCH-{date_str}-{prefix}-{unique_suffix}"

    async def serial_number_exists(self, serial_number: str) -> bool:
        """
        Check if a serial number already exists in the database.
        
        Args:
            serial_number: The serial number to check
            
        Returns:
            True if serial number exists, False otherwise
        """
        if not serial_number or not serial_number.strip():
            return False
            
        stmt = select(func.count(InventoryUnit.id)).where(
            InventoryUnit.serial_number == serial_number.strip()
        )
        
        result = await self.session.execute(stmt)
        count = result.scalar() or 0
        
        return count > 0

    async def validate_serial_numbers(self, serial_numbers: List[str]) -> Dict[str, bool]:
        """
        Batch validate multiple serial numbers for uniqueness.
        
        Args:
            serial_numbers: List of serial numbers to check
            
        Returns:
            Dictionary mapping serial_number -> exists (True if duplicate)
        """
        if not serial_numbers:
            return {}
        
        # Remove duplicates and clean up serial numbers
        clean_serials = list(set(sn.strip() for sn in serial_numbers if sn and sn.strip()))
        
        if not clean_serials:
            return {}
        
        stmt = select(InventoryUnit.serial_number).where(
            InventoryUnit.serial_number.in_(clean_serials)
        )
        
        result = await self.session.execute(stmt)
        existing_serials = {row[0] for row in result.fetchall()}
        
        return {sn: sn in existing_serials for sn in clean_serials}

    async def batch_code_exists(self, batch_code: str) -> bool:
        """
        Check if a batch code already exists in the database.
        
        Args:
            batch_code: The batch code to check
            
        Returns:
            True if batch code exists, False otherwise
        """
        if not batch_code or not batch_code.strip():
            return False
            
        stmt = select(func.count(InventoryUnit.id)).where(
            InventoryUnit.batch_code == batch_code.strip()
        )
        
        result = await self.session.execute(stmt)
        count = result.scalar() or 0
        
        return count > 0

    async def update(self, db_obj: InventoryUnit, updates: Dict[str, Any]) -> InventoryUnit:
        """Update an inventory unit with the provided updates."""
        for k, v in updates.items():
            setattr(db_obj, k, v)
        await self.session.flush()  # Use flush instead of commit for transaction control
        await self.session.refresh(db_obj)
        return db_obj
    
    async def get_available_units_for_rental(
        self,
        item_id: UUID,
        location_id: UUID,
        quantity_needed: int
    ) -> List[InventoryUnit]:
        """
        Get available inventory units for rental.
        CRITICAL: Only returns units with AVAILABLE status.
        Damaged, under repair, and beyond repair units are excluded.
        """
        stmt = select(InventoryUnit).where(
            and_(
                InventoryUnit.item_id == str(item_id),
                InventoryUnit.location_id == str(location_id),
                InventoryUnit.status == InventoryUnitStatus.AVAILABLE.value,
                InventoryUnit.is_active == True
            )
        ).limit(quantity_needed)
        
        result = await self.session.execute(stmt)
        available_units = result.scalars().all()
        
        if len(available_units) < quantity_needed:
            print(f"[INVENTORY] Warning: Only {len(available_units)} units available, {quantity_needed} requested")
        
        return available_units

