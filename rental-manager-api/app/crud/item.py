from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from sqlalchemy import select, func, or_, and_, desc, asc, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from app.models.item import Item
from app.models.brand import Brand
from app.models.category import Category
from app.models.unit_of_measurement import UnitOfMeasurement


class ItemRepository:
    """Repository for item data access operations."""
    
    def __init__(self, session: AsyncSession):
        """Initialize repository with database session."""
        self.session = session
    
    async def create(self, item_data: dict) -> Item:
        """Create a new item."""
        item = Item(**item_data)
        self.session.add(item)
        await self.session.commit()
        await self.session.refresh(item)
        return item
    
    async def get_by_id(
        self, 
        item_id: UUID, 
        include_relations: bool = False
    ) -> Optional[Item]:
        """Get item by ID with optional related data."""
        query = select(Item).where(Item.id == item_id)
        
        if include_relations:
            query = query.options(
                joinedload(Item.brand),
                joinedload(Item.category),
                joinedload(Item.unit_of_measurement)
            )
        
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def get_by_sku(
        self, 
        sku: str, 
        include_relations: bool = False
    ) -> Optional[Item]:
        """Get item by SKU."""
        query = select(Item).where(Item.sku == sku.upper())
        
        if include_relations:
            query = query.options(
                joinedload(Item.brand),
                joinedload(Item.category),
                joinedload(Item.unit_of_measurement)
            )
        
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def get_by_name(self, item_name: str) -> Optional[Item]:
        """Get item by exact name match."""
        query = select(Item).where(Item.item_name == item_name)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def list(
        self,
        skip: int = 0,
        limit: int = 100,
        filters: Optional[Dict[str, Any]] = None,
        sort_by: str = "item_name",
        sort_order: str = "asc",
        include_inactive: bool = False,
        include_relations: bool = False
    ) -> List[Item]:
        """List items with optional filters and sorting."""
        query = select(Item)
        
        # Include related data if requested
        if include_relations:
            query = query.options(
                joinedload(Item.brand),
                joinedload(Item.category),
                joinedload(Item.unit_of_measurement)
            )
        
        # Apply base filters
        if not include_inactive:
            query = query.where(Item.is_active == True)
        
        # Apply additional filters
        if filters:
            query = self._apply_filters(query, filters)
        
        # Apply sorting
        sort_column = self._get_sort_column(sort_by)
        if sort_order.lower() == "desc":
            query = query.order_by(desc(sort_column))
        else:
            query = query.order_by(asc(sort_column))
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        
        result = await self.session.execute(query)
        return result.scalars().unique().all()
    
    async def get_paginated(
        self,
        page: int = 1,
        page_size: int = 20,
        filters: Optional[Dict[str, Any]] = None,
        sort_by: str = "item_name",
        sort_order: str = "asc",
        include_inactive: bool = False,
        include_relations: bool = False
    ) -> Tuple[List[Item], int]:
        """Get paginated items with total count."""
        query = select(Item)
        count_query = select(func.count()).select_from(Item)
        
        # Include related data if requested
        if include_relations:
            query = query.options(
                joinedload(Item.brand),
                joinedload(Item.category),
                joinedload(Item.unit_of_measurement)
            )
        
        # Apply base filters
        if not include_inactive:
            query = query.where(Item.is_active == True)
            count_query = count_query.where(Item.is_active == True)
        
        # Apply additional filters
        if filters:
            query = self._apply_filters(query, filters)
            count_query = self._apply_filters(count_query, filters)
        
        # Get total count
        count_result = await self.session.execute(count_query)
        total = count_result.scalar_one()
        
        # Apply sorting
        sort_column = self._get_sort_column(sort_by)
        if sort_order.lower() == "desc":
            query = query.order_by(desc(sort_column))
        else:
            query = query.order_by(asc(sort_column))
        
        # Calculate pagination
        skip = (page - 1) * page_size
        limit = page_size
        
        result = await self.session.execute(query.offset(skip).limit(limit))
        items = result.scalars().unique().all()
        
        return items, total
    
    async def update(self, item_id: UUID, update_data: dict) -> Optional[Item]:
        """Update existing item."""
        item = await self.get_by_id(item_id)
        if not item:
            return None
        
        # Update fields directly on the model
        for key, value in update_data.items():
            if hasattr(item, key) and value is not None:
                setattr(item, key, value)
        
        # Update pricing if provided
        pricing_fields = ['cost_price', 'sale_price', 'rental_rate_per_day', 'security_deposit']
        pricing_updates = {k: v for k, v in update_data.items() if k in pricing_fields and v is not None}
        if pricing_updates:
            item.update_pricing(**pricing_updates, updated_by=update_data.get('updated_by'))
        
        await self.session.commit()
        await self.session.refresh(item)
        
        return item
    
    async def delete(self, item_id: UUID) -> bool:
        """Soft delete item by setting is_active to False."""
        item = await self.get_by_id(item_id)
        if not item:
            return False
        
        item.soft_delete()
        await self.session.commit()
        
        return True
    
    async def hard_delete(self, item_id: UUID) -> bool:
        """Hard delete item from database."""
        item = await self.get_by_id(item_id)
        if not item:
            return False
        
        # Check if item has any dependencies (inventory units, transactions, etc.)
        # For now, we'll allow hard delete if item is inactive
        if item.is_active:
            return False
        
        await self.session.delete(item)
        await self.session.commit()
        
        return True
    
    async def count(
        self,
        filters: Optional[Dict[str, Any]] = None,
        include_inactive: bool = False
    ) -> int:
        """Count items matching filters."""
        query = select(func.count()).select_from(Item)
        
        # Apply base filters
        if not include_inactive:
            query = query.where(Item.is_active == True)
        
        # Apply additional filters
        if filters:
            query = self._apply_filters(query, filters)
        
        result = await self.session.execute(query)
        return result.scalar_one()
    
    async def exists_by_sku(self, sku: str, exclude_id: Optional[UUID] = None) -> bool:
        """Check if an item with the given SKU exists."""
        query = select(func.count()).select_from(Item).where(
            Item.sku == sku.upper()
        )
        
        if exclude_id:
            query = query.where(Item.id != exclude_id)
        
        result = await self.session.execute(query)
        count = result.scalar_one()
        
        return count > 0
    
    async def exists_by_name(self, item_name: str, exclude_id: Optional[UUID] = None) -> bool:
        """Check if an item with the given name exists."""
        query = select(func.count()).select_from(Item).where(
            Item.item_name == item_name
        )
        
        if exclude_id:
            query = query.where(Item.id != exclude_id)
        
        result = await self.session.execute(query)
        count = result.scalar_one()
        
        return count > 0
    
    async def search(
        self,
        search_term: str,
        limit: int = 10,
        include_inactive: bool = False
    ) -> List[Item]:
        """Search items by name, SKU, or description."""
        search_pattern = f"%{search_term}%"
        
        query = select(Item).where(
            or_(
                Item.item_name.ilike(search_pattern),
                Item.sku.ilike(search_pattern),
                Item.description.ilike(search_pattern),
                Item.short_description.ilike(search_pattern),
                Item.tags.ilike(search_pattern)
            )
        )
        
        if not include_inactive:
            query = query.where(Item.is_active == True)
        
        query = query.order_by(Item.item_name).limit(limit)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_rentable_items(
        self,
        limit: Optional[int] = None,
        include_blocked: bool = False
    ) -> List[Item]:
        """Get items that can be rented."""
        query = select(Item).where(
            and_(
                Item.is_active == True,
                Item.is_rentable == True,
                Item.status == "ACTIVE"
            )
        )
        
        if not include_blocked:
            query = query.where(Item.is_rental_blocked == False)
        
        query = query.order_by(Item.item_name)
        
        if limit:
            query = query.limit(limit)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_salable_items(self, limit: Optional[int] = None) -> List[Item]:
        """Get items that can be sold."""
        query = select(Item).where(
            and_(
                Item.is_active == True,
                Item.is_salable == True,
                Item.status == "ACTIVE"
            )
        ).order_by(Item.item_name)
        
        if limit:
            query = query.limit(limit)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_by_brand(self, brand_id: UUID, limit: Optional[int] = None) -> List[Item]:
        """Get items by brand."""
        query = select(Item).where(
            and_(
                Item.brand_id == brand_id,
                Item.is_active == True
            )
        ).order_by(Item.item_name)
        
        if limit:
            query = query.limit(limit)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_by_category(self, category_id: UUID, limit: Optional[int] = None) -> List[Item]:
        """Get items by category."""
        query = select(Item).where(
            and_(
                Item.category_id == category_id,
                Item.is_active == True
            )
        ).order_by(Item.item_name)
        
        if limit:
            query = query.limit(limit)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_rental_blocked_items(self, limit: Optional[int] = None) -> List[Item]:
        """Get items that are blocked from rental."""
        query = select(Item).where(
            and_(
                Item.is_active == True,
                Item.is_rental_blocked == True
            )
        ).order_by(Item.rental_blocked_at.desc())
        
        if limit:
            query = query.limit(limit)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_maintenance_due_items(self, days_threshold: int = 180) -> List[Item]:
        """Get items that need maintenance."""
        threshold_date = func.now() - text(f"INTERVAL '{days_threshold} days'")
        
        query = select(Item).where(
            and_(
                Item.is_active == True,
                or_(
                    Item.last_maintenance_date.is_(None),
                    Item.last_maintenance_date < threshold_date
                )
            )
        ).order_by(Item.last_maintenance_date.asc().nulls_first())
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_warranty_expired_items(self) -> List[Item]:
        """Get items with expired warranty."""
        query = select(Item).where(
            and_(
                Item.is_active == True,
                Item.warranty_expiry_date.is_not(None),
                Item.warranty_expiry_date < func.now()
            )
        ).order_by(Item.warranty_expiry_date.desc())
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_low_stock_items(self) -> List[Item]:
        """Get items that are at or below reorder level."""
        # This would need to be implemented with inventory relationship
        # For now, return items with low reorder levels
        query = select(Item).where(
            and_(
                Item.is_active == True,
                Item.reorder_level.is_not(None),
                Item.reorder_level > 0
            )
        ).order_by(Item.reorder_level.asc())
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_price_range_items(
        self,
        min_price: Optional[Decimal] = None,
        max_price: Optional[Decimal] = None,
        price_type: str = "sale_price"
    ) -> List[Item]:
        """Get items within a price range."""
        query = select(Item).where(Item.is_active == True)
        
        price_column = getattr(Item, price_type)
        
        if min_price is not None:
            query = query.where(price_column >= min_price)
        
        if max_price is not None:
            query = query.where(price_column <= max_price)
        
        query = query.order_by(price_column.asc())
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def bulk_update_status(self, item_ids: List[UUID], status: str) -> int:
        """Update status for multiple items."""
        query = select(Item).where(Item.id.in_(item_ids))
        result = await self.session.execute(query)
        items = result.scalars().all()
        
        count = 0
        for item in items:
            item.status = status
            count += 1
        
        await self.session.commit()
        return count
    
    async def bulk_activate(self, item_ids: List[UUID]) -> int:
        """Activate multiple items."""
        query = select(Item).where(Item.id.in_(item_ids))
        result = await self.session.execute(query)
        items = result.scalars().all()
        
        count = 0
        for item in items:
            if not item.is_active:
                item.restore()
                count += 1
        
        await self.session.commit()
        return count
    
    async def bulk_deactivate(self, item_ids: List[UUID]) -> int:
        """Deactivate multiple items."""
        query = select(Item).where(Item.id.in_(item_ids))
        result = await self.session.execute(query)
        items = result.scalars().all()
        
        count = 0
        for item in items:
            if item.is_active:
                item.soft_delete()
                count += 1
        
        await self.session.commit()
        return count
    
    async def bulk_block_rental(
        self, 
        item_ids: List[UUID], 
        reason: str, 
        blocked_by: UUID
    ) -> int:
        """Block rental for multiple items."""
        query = select(Item).where(Item.id.in_(item_ids))
        result = await self.session.execute(query)
        items = result.scalars().all()
        
        count = 0
        for item in items:
            if not item.is_rental_blocked:
                item.block_rental(reason, blocked_by)
                count += 1
        
        await self.session.commit()
        return count
    
    async def bulk_unblock_rental(self, item_ids: List[UUID]) -> int:
        """Unblock rental for multiple items."""
        query = select(Item).where(Item.id.in_(item_ids))
        result = await self.session.execute(query)
        items = result.scalars().all()
        
        count = 0
        for item in items:
            if item.is_rental_blocked:
                item.unblock_rental()
                count += 1
        
        await self.session.commit()
        return count
    
    async def get_statistics(self) -> Dict[str, Any]:
        """Get item statistics."""
        # Base counts
        stats_queries = {
            "total_items": select(func.count()).select_from(Item),
            "active_items": select(func.count()).select_from(Item).where(Item.is_active == True),
            "rentable_items": select(func.count()).select_from(Item).where(
                and_(Item.is_active == True, Item.is_rentable == True)
            ),
            "salable_items": select(func.count()).select_from(Item).where(
                and_(Item.is_active == True, Item.is_salable == True)
            ),
            "rental_blocked_items": select(func.count()).select_from(Item).where(
                and_(Item.is_active == True, Item.is_rental_blocked == True)
            ),
        }
        
        stats = {}
        for key, query in stats_queries.items():
            result = await self.session.execute(query)
            stats[key] = result.scalar_one()
        
        stats["inactive_items"] = stats["total_items"] - stats["active_items"]
        
        # Price statistics
        price_stats_query = select(
            func.avg(Item.sale_price).label("avg_sale_price"),
            func.avg(Item.rental_rate_per_day).label("avg_rental_rate"),
            func.avg(Item.cost_price).label("avg_cost_price"),
            func.sum(Item.cost_price * 1).label("total_inventory_value")  # Would multiply by quantity when inventory is implemented
        ).where(Item.is_active == True)
        
        price_result = await self.session.execute(price_stats_query)
        price_stats = price_result.first()
        
        if price_stats:
            stats.update({
                "avg_sale_price": price_stats.avg_sale_price,
                "avg_rental_rate": price_stats.avg_rental_rate,
                "avg_cost_price": price_stats.avg_cost_price,
                "total_inventory_value": price_stats.total_inventory_value
            })
        
        return stats
    
    async def get_items_by_status(self) -> Dict[str, int]:
        """Get count of items by status."""
        query = select(
            Item.status,
            func.count().label("count")
        ).where(Item.is_active == True).group_by(Item.status)
        
        result = await self.session.execute(query)
        rows = result.fetchall()
        
        return {row.status: row.count for row in rows}
    
    async def get_items_by_category(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get count of items by category."""
        query = select(
            Category.name.label("category_name"),
            func.count(Item.id).label("item_count")
        ).select_from(
            Item
        ).join(
            Category, Item.category_id == Category.id, isouter=True
        ).where(
            Item.is_active == True
        ).group_by(
            Category.name
        ).order_by(
            func.count(Item.id).desc()
        ).limit(limit)
        
        result = await self.session.execute(query)
        rows = result.fetchall()
        
        return [{"category_name": row.category_name or "Uncategorized", "item_count": row.item_count} for row in rows]
    
    async def get_items_by_brand(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get count of items by brand."""
        query = select(
            Brand.name.label("brand_name"),
            func.count(Item.id).label("item_count")
        ).select_from(
            Item
        ).join(
            Brand, Item.brand_id == Brand.id, isouter=True
        ).where(
            Item.is_active == True
        ).group_by(
            Brand.name
        ).order_by(
            func.count(Item.id).desc()
        ).limit(limit)
        
        result = await self.session.execute(query)
        rows = result.fetchall()
        
        return [{"brand_name": row.brand_name or "No Brand", "item_count": row.item_count} for row in rows]
    
    def _apply_filters(self, query, filters: Dict[str, Any]):
        """Apply filters to query."""
        for key, value in filters.items():
            if value is None:
                continue
            
            if key == "item_name":
                query = query.where(Item.item_name.ilike(f"%{value}%"))
            elif key == "sku":
                query = query.where(Item.sku.ilike(f"%{value}%"))
            elif key == "brand_id":
                query = query.where(Item.brand_id == value)
            elif key == "category_id":
                query = query.where(Item.category_id == value)
            elif key == "unit_of_measurement_id":
                query = query.where(Item.unit_of_measurement_id == value)
            elif key == "is_rentable":
                query = query.where(Item.is_rentable == value)
            elif key == "is_salable":
                query = query.where(Item.is_salable == value)
            elif key == "is_active":
                query = query.where(Item.is_active == value)
            elif key == "status":
                query = query.where(Item.status == value)
            elif key == "is_rental_blocked":
                query = query.where(Item.is_rental_blocked == value)
            elif key == "min_sale_price":
                query = query.where(Item.sale_price >= value)
            elif key == "max_sale_price":
                query = query.where(Item.sale_price <= value)
            elif key == "min_rental_rate":
                query = query.where(Item.rental_rate_per_day >= value)
            elif key == "max_rental_rate":
                query = query.where(Item.rental_rate_per_day <= value)
            elif key == "created_after":
                query = query.where(Item.created_at >= value)
            elif key == "created_before":
                query = query.where(Item.created_at <= value)
            elif key == "updated_after":
                query = query.where(Item.updated_at >= value)
            elif key == "updated_before":
                query = query.where(Item.updated_at <= value)
            elif key == "search":
                search_pattern = f"%{value}%"
                query = query.where(
                    or_(
                        Item.item_name.ilike(search_pattern),
                        Item.sku.ilike(search_pattern),
                        Item.description.ilike(search_pattern),
                        Item.short_description.ilike(search_pattern),
                        Item.tags.ilike(search_pattern)
                    )
                )
            elif key == "tags":
                # Handle comma-separated tags
                tag_list = [tag.strip() for tag in value.split(',')]
                tag_conditions = []
                for tag in tag_list:
                    if tag:
                        tag_conditions.append(Item.tags.ilike(f"%{tag}%"))
                if tag_conditions:
                    query = query.where(or_(*tag_conditions))
        
        return query
    
    def _get_sort_column(self, sort_by: str):
        """Get sort column based on field name."""
        # Handle joined columns
        if sort_by == "brand_name":
            return Brand.name
        elif sort_by == "category_name":
            return Category.name
        else:
            return getattr(Item, sort_by, Item.item_name)