from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.item import ItemRepository
from app.models.item import Item
from app.services.sku_generator import SKUGenerator
from app.schemas.item import (
    ItemCreate, ItemUpdate, ItemResponse, ItemSummary,
    ItemList, ItemFilter, ItemSort, ItemStats,
    ItemRentalStatusRequest, ItemRentalStatusResponse,
    ItemBulkOperation, ItemBulkResult, ItemExport,
    ItemImport, ItemImportResult, ItemAvailabilityCheck,
    ItemAvailabilityResponse, ItemPricingUpdate, ItemDuplicate
)
from app.core.errors import (
    NotFoundError, ConflictError, ValidationError, 
    BusinessRuleError
)


class ItemService:
    """Service layer for item business logic."""
    
    def __init__(self, repository: ItemRepository, sku_generator: SKUGenerator, session: AsyncSession):
        """Initialize service with repository, SKU generator, and session."""
        self.repository = repository
        self.sku_generator = sku_generator
        self.session = session
    
    async def create_item(
        self,
        item_data: ItemCreate,
        created_by: Optional[str] = None
    ) -> ItemResponse:
        """Create a new item.
        
        Args:
            item_data: Item creation data
            created_by: User creating the item
            
        Returns:
            Created item response
            
        Raises:
            ConflictError: If item SKU already exists
            ValidationError: If item data is invalid
        """
        # Generate SKU if not provided
        sku = item_data.sku
        if not sku or sku == "AUTO":
            # Now using proper SKU generation with session parameter
            sku = await self.sku_generator.generate_sku(
                self.session,
                category_id=item_data.category_id
            )
        
        # Check if SKU already exists
        if await self.repository.exists_by_sku(sku):
            raise ConflictError(f"Item with SKU '{sku}' already exists")
        
        # Check if item name already exists
        if await self.repository.exists_by_name(item_data.item_name):
            raise ConflictError(f"Item with name '{item_data.item_name}' already exists")
        
        # Validate business rules
        if not item_data.is_rentable and not item_data.is_salable:
            raise ValidationError("Item must be either rentable or salable (or both)")
        
        if item_data.cost_price and item_data.sale_price:
            if item_data.sale_price <= item_data.cost_price:
                raise ValidationError("Sale price must be greater than cost price")
        
        # Prepare item data
        create_data = item_data.model_dump()
        create_data.update({
            "sku": sku,
            "created_by": created_by,
            "updated_by": created_by
        })
        
        # Create item
        item = await self.repository.create(create_data)
        
        # Get the created item with relationships loaded
        item_with_relations = await self.repository.get_by_id(item.id, include_relations=True)
        
        # Convert to response
        return await self._to_response(item_with_relations)
    
    async def get_item(self, item_id: UUID) -> ItemResponse:
        """Get item by ID.
        
        Args:
            item_id: Item UUID
            
        Returns:
            Item response
            
        Raises:
            NotFoundError: If item not found
        """
        item = await self.repository.get_by_id(item_id, include_relations=True)
        if not item:
            raise NotFoundError(f"Item with id {item_id} not found")
        
        return await self._to_response(item)
    
    async def get_item_by_sku(self, sku: str) -> ItemResponse:
        """Get item by SKU.
        
        Args:
            sku: Item SKU
            
        Returns:
            Item response
            
        Raises:
            NotFoundError: If item not found
        """
        item = await self.repository.get_by_sku(sku, include_relations=True)
        if not item:
            raise NotFoundError(f"Item with SKU '{sku}' not found")
        
        return await self._to_response(item)
    
    async def update_item(
        self,
        item_id: UUID,
        item_data: ItemUpdate,
        updated_by: Optional[str] = None
    ) -> ItemResponse:
        """Update an existing item.
        
        Args:
            item_id: Item UUID
            item_data: Item update data
            updated_by: User updating the item
            
        Returns:
            Updated item response
            
        Raises:
            NotFoundError: If item not found
            ConflictError: If SKU or name already exists
            ValidationError: If update data is invalid
        """
        # Get existing item
        existing_item = await self.repository.get_by_id(item_id)
        if not existing_item:
            raise NotFoundError(f"Item with id {item_id} not found")
        
        # Prepare update data
        update_data = {}
        
        # Check SKU uniqueness if provided
        if item_data.sku is not None and item_data.sku != existing_item.sku:
            if await self.repository.exists_by_sku(item_data.sku, exclude_id=item_id):
                raise ConflictError(f"Item with SKU '{item_data.sku}' already exists")
            update_data["sku"] = item_data.sku
        
        # Check name uniqueness if provided
        if item_data.item_name is not None and item_data.item_name != existing_item.item_name:
            if await self.repository.exists_by_name(item_data.item_name, exclude_id=item_id):
                raise ConflictError(f"Item with name '{item_data.item_name}' already exists")
            update_data["item_name"] = item_data.item_name
        
        # Update other fields
        allowed_fields = [
            'description', 'short_description', 'brand_id', 'category_id',
            'unit_of_measurement_id', 'weight', 'dimensions_length', 'dimensions_width',
            'dimensions_height', 'color', 'material', 'is_rentable', 'is_salable',
            'requires_serial_number', 'reorder_level', 'maximum_stock_level',
            'status', 'notes', 'tags', 'is_active', 'last_maintenance_date',
            'warranty_expiry_date'
        ]
        
        for field in allowed_fields:
            value = getattr(item_data, field, None)
            if value is not None:
                update_data[field] = value
        
        # Validate business rules
        rentable = update_data.get('is_rentable', existing_item.is_rentable)
        salable = update_data.get('is_salable', existing_item.is_salable)
        if not rentable and not salable:
            raise ValidationError("Item must be either rentable or salable (or both)")
        
        # Add updated_by
        update_data["updated_by"] = updated_by
        
        # Update item
        updated_item = await self.repository.update(item_id, update_data)
        if not updated_item:
            raise NotFoundError(f"Item with id {item_id} not found")
        
        # Get the updated item with relationships loaded
        item_with_relations = await self.repository.get_by_id(updated_item.id, include_relations=True)
        
        return await self._to_response(item_with_relations)
    
    async def delete_item(self, item_id: UUID) -> bool:
        """Soft delete an item.
        
        Args:
            item_id: Item UUID
            
        Returns:
            True if deleted successfully
            
        Raises:
            NotFoundError: If item not found
            BusinessRuleError: If item has dependencies
        """
        item = await self.repository.get_by_id(item_id)
        if not item:
            raise NotFoundError(f"Item with id {item_id} not found")
        
        # Check if item can be deleted (has inventory, transactions, etc.)
        # For now, allow deletion
        
        return await self.repository.delete(item_id)
    
    async def list_items(
        self,
        page: int = 1,
        page_size: int = 20,
        filters: Optional[ItemFilter] = None,
        sort: Optional[ItemSort] = None,
        include_inactive: bool = False
    ) -> ItemList:
        """List items with pagination and filtering.
        
        Args:
            page: Page number (1-based)
            page_size: Items per page
            filters: Filter criteria
            sort: Sort options
            include_inactive: Include inactive items
            
        Returns:
            Paginated item list
        """
        # Convert filters to dict
        filter_dict = {}
        if filters:
            filter_data = filters.model_dump(exclude_none=True)
            for key, value in filter_data.items():
                if value is not None:
                    filter_dict[key] = value
        
        # Set sort options
        sort_by = sort.field if sort and sort.field else "item_name"
        sort_order = sort.direction if sort and sort.direction else "asc"
        
        # Get paginated items
        items_list, total = await self.repository.get_paginated(
            page=page,
            page_size=page_size,
            filters=filter_dict,
            sort_by=sort_by,
            sort_order=sort_order,
            include_inactive=include_inactive,
            include_relations=True
        )
        
        # Convert to summaries
        item_summaries = []
        for item in items_list:
            summary = await self._to_summary(item)
            item_summaries.append(summary)
        
        # Calculate pagination info
        total_pages = (total + page_size - 1) // page_size
        
        return ItemList(
            items=item_summaries,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1
        )
    
    async def search_items(
        self,
        search_term: str,
        limit: int = 10,
        include_inactive: bool = False
    ) -> List[ItemSummary]:
        """Search items by name, SKU, or description.
        
        Args:
            search_term: Search term
            limit: Maximum results
            include_inactive: Include inactive items
            
        Returns:
            List of item summaries
        """
        items = await self.repository.search(
            search_term=search_term,
            limit=limit,
            include_inactive=include_inactive
        )
        
        return [await self._to_summary(item) for item in items]
    
    async def toggle_rental_status(
        self,
        item_id: UUID,
        request: ItemRentalStatusRequest,
        changed_by: UUID
    ) -> ItemRentalStatusResponse:
        """Toggle rental status for an item.
        
        Args:
            item_id: Item UUID
            request: Rental status change request
            changed_by: User making the change
            
        Returns:
            Rental status change response
            
        Raises:
            NotFoundError: If item not found
        """
        # Get the item
        item = await self.repository.get_by_id(item_id)
        if not item:
            raise NotFoundError(f"Item with id {item_id} not found")
        
        # Store previous status
        previous_status = item.is_rental_blocked
        
        # Check if status is actually changing
        if previous_status == request.is_rental_blocked:
            return ItemRentalStatusResponse(
                item_id=item.id,
                item_name=item.item_name,
                is_rental_blocked=item.is_rental_blocked,
                rental_block_reason=item.rental_block_reason,
                rental_blocked_at=item.rental_blocked_at,
                rental_blocked_by=item.rental_blocked_by,
                previous_status=previous_status,
                message="No change - status already set to requested value"
            )
        
        # Update item status
        if request.is_rental_blocked:
            item.block_rental(request.remarks or "Manual block", changed_by)
        else:
            item.unblock_rental()
        
        # Save changes
        await self.repository.update(item_id, {
            "is_rental_blocked": item.is_rental_blocked,
            "rental_block_reason": item.rental_block_reason,
            "rental_blocked_at": item.rental_blocked_at,
            "rental_blocked_by": item.rental_blocked_by,
            "updated_by": str(changed_by)
        })
        
        status_word = "blocked" if request.is_rental_blocked else "unblocked"
        return ItemRentalStatusResponse(
            item_id=item.id,
            item_name=item.item_name,
            is_rental_blocked=item.is_rental_blocked,
            rental_block_reason=item.rental_block_reason,
            rental_blocked_at=item.rental_blocked_at,
            rental_blocked_by=item.rental_blocked_by,
            previous_status=previous_status,
            message=f"Item successfully {status_word} from rental"
        )
    
    async def check_availability(
        self,
        availability_check: ItemAvailabilityCheck
    ) -> ItemAvailabilityResponse:
        """Check item availability for rental or sale.
        
        Args:
            availability_check: Availability check request
            
        Returns:
            Availability response
            
        Raises:
            NotFoundError: If item not found
        """
        item = await self.repository.get_by_id(availability_check.item_id)
        if not item:
            raise NotFoundError(f"Item with id {availability_check.item_id} not found")
        
        # For now, return basic availability (would integrate with inventory system)
        can_be_rented = item.can_be_rented()
        can_be_sold = item.can_be_sold()
        
        # Mock availability data (would come from inventory system)
        available_quantity = 1 if (can_be_rented or can_be_sold) else 0
        total_quantity = 1
        reserved_quantity = 0
        
        # Create availability message
        if item.is_rental_blocked:
            availability_message = f"Item blocked from rental: {item.rental_block_reason}"
        elif not item.is_rentable and not item.is_salable:
            availability_message = "Item is not available for rental or sale"
        elif not item.is_active:
            availability_message = "Item is inactive"
        elif item.status != "ACTIVE":
            availability_message = f"Item status is {item.status}"
        else:
            availability_message = "Item is available"
        
        return ItemAvailabilityResponse(
            item_id=item.id,
            item_name=item.item_name,
            is_available=available_quantity >= availability_check.quantity_needed,
            available_quantity=available_quantity,
            total_quantity=total_quantity,
            reserved_quantity=reserved_quantity,
            can_be_rented=can_be_rented,
            can_be_sold=can_be_sold,
            availability_message=availability_message,
            next_available_date=None  # Would be calculated from reservations
        )
    
    async def update_pricing(
        self,
        item_id: UUID,
        pricing_update: ItemPricingUpdate,
        updated_by: Optional[str] = None
    ) -> ItemResponse:
        """Update item pricing.
        
        Args:
            item_id: Item UUID
            pricing_update: Pricing update data
            updated_by: User updating pricing
            
        Returns:
            Updated item response
        """
        item = await self.repository.get_by_id(item_id)
        if not item:
            raise NotFoundError(f"Item with id {item_id} not found")
        
        # Update pricing using the model's method
        pricing_data = pricing_update.model_dump(exclude_none=True)
        item.update_pricing(**pricing_data, updated_by=updated_by)
        
        # Save changes
        await self.repository.update(item_id, pricing_data)
        
        # Get the updated item with relationships loaded
        item_with_relations = await self.repository.get_by_id(item_id, include_relations=True)
        
        return await self._to_response(item_with_relations)
    
    async def duplicate_item(
        self,
        duplicate_request: ItemDuplicate,
        created_by: Optional[str] = None
    ) -> ItemResponse:
        """Duplicate an existing item.
        
        Args:
            duplicate_request: Duplication request data
            created_by: User creating the duplicate
            
        Returns:
            New item response
        """
        # Get source item
        source_item = await self.repository.get_by_id(duplicate_request.source_item_id)
        if not source_item:
            raise NotFoundError(f"Source item with id {duplicate_request.source_item_id} not found")
        
        # Generate new SKU if not provided
        new_sku = duplicate_request.new_sku
        if not new_sku:
            new_sku = await self.sku_generator.generate_sku(source_item.category_id)
        
        # Check if new SKU already exists
        if await self.repository.exists_by_sku(new_sku):
            raise ConflictError(f"Item with SKU '{new_sku}' already exists")
        
        # Check if new name already exists
        if await self.repository.exists_by_name(duplicate_request.new_item_name):
            raise ConflictError(f"Item with name '{duplicate_request.new_item_name}' already exists")
        
        # Prepare new item data
        new_item_data = {
            "item_name": duplicate_request.new_item_name,
            "sku": new_sku,
            "description": source_item.description,
            "short_description": source_item.short_description,
            "brand_id": source_item.brand_id,
            "category_id": source_item.category_id,
            "unit_of_measurement_id": source_item.unit_of_measurement_id,
            "is_rentable": source_item.is_rentable,
            "is_salable": source_item.is_salable,
            "requires_serial_number": source_item.requires_serial_number,
            "status": "ACTIVE",
            "created_by": created_by,
            "updated_by": created_by
        }
        
        # Copy physical properties if requested
        if duplicate_request.copy_physical_properties:
            new_item_data.update({
                "weight": source_item.weight,
                "dimensions_length": source_item.dimensions_length,
                "dimensions_width": source_item.dimensions_width,
                "dimensions_height": source_item.dimensions_height,
                "color": source_item.color,
                "material": source_item.material
            })
        
        # Copy pricing if requested
        if duplicate_request.copy_pricing:
            new_item_data.update({
                "cost_price": source_item.cost_price,
                "sale_price": source_item.sale_price,
                "rental_rate_per_day": source_item.rental_rate_per_day,
                "security_deposit": source_item.security_deposit
            })
        
        # Copy inventory settings if requested
        if duplicate_request.copy_inventory_settings:
            new_item_data.update({
                "reorder_level": source_item.reorder_level,
                "maximum_stock_level": source_item.maximum_stock_level
            })
        
        # Create the new item
        new_item = await self.repository.create(new_item_data)
        
        # Get the created item with relationships loaded
        item_with_relations = await self.repository.get_by_id(new_item.id, include_relations=True)
        
        return await self._to_response(item_with_relations)
    
    async def bulk_operation(
        self,
        operation: ItemBulkOperation,
        updated_by: Optional[str] = None
    ) -> ItemBulkResult:
        """Perform bulk operations on items.
        
        Args:
            operation: Bulk operation data
            updated_by: User performing the operation
            
        Returns:
            Bulk operation result
        """
        successful_items = []
        failed_items = []
        
        for item_id in operation.item_ids:
            try:
                if operation.operation == "activate":
                    await self.repository.bulk_activate([item_id])
                    successful_items.append(item_id)
                    
                elif operation.operation == "deactivate":
                    await self.repository.bulk_deactivate([item_id])
                    successful_items.append(item_id)
                    
                elif operation.operation == "block_rental":
                    if not operation.rental_block_reason:
                        raise ValidationError("Rental block reason is required")
                    await self.repository.bulk_block_rental(
                        [item_id], 
                        operation.rental_block_reason,
                        UUID(updated_by) if updated_by else None
                    )
                    successful_items.append(item_id)
                    
                elif operation.operation == "unblock_rental":
                    await self.repository.bulk_unblock_rental([item_id])
                    successful_items.append(item_id)
                    
                elif operation.operation == "update_status":
                    if not operation.status:
                        raise ValidationError("Status is required for status update operation")
                    await self.repository.bulk_update_status([item_id], operation.status)
                    successful_items.append(item_id)
                    
            except Exception as e:
                failed_items.append({
                    "item_id": str(item_id),
                    "error": str(e)
                })
        
        return ItemBulkResult(
            total_requested=len(operation.item_ids),
            success_count=len(successful_items),
            failure_count=len(failed_items),
            successful_items=successful_items,
            failed_items=failed_items
        )
    
    async def get_rentable_items(self, limit: Optional[int] = None) -> List[ItemSummary]:
        """Get items available for rental."""
        items = await self.repository.get_rentable_items(limit=limit)
        return [await self._to_summary(item) for item in items]
    
    async def get_salable_items(self, limit: Optional[int] = None) -> List[ItemSummary]:
        """Get items available for sale."""
        items = await self.repository.get_salable_items(limit=limit)
        return [await self._to_summary(item) for item in items]
    
    async def get_rental_blocked_items(self, limit: Optional[int] = None) -> List[ItemSummary]:
        """Get items blocked from rental."""
        items = await self.repository.get_rental_blocked_items(limit=limit)
        return [await self._to_summary(item) for item in items]
    
    async def get_maintenance_due_items(self, days_threshold: int = 180) -> List[ItemSummary]:
        """Get items that need maintenance."""
        items = await self.repository.get_maintenance_due_items(days_threshold)
        return [await self._to_summary(item) for item in items]
    
    async def get_item_statistics(self) -> ItemStats:
        """Get item statistics."""
        stats = await self.repository.get_statistics()
        items_by_category = await self.repository.get_items_by_category()
        items_by_brand = await self.repository.get_items_by_brand()
        items_by_status_dict = await self.repository.get_items_by_status()
        items_by_status = [{"status": k, "count": v} for k, v in items_by_status_dict.items()]
        
        return ItemStats(
            total_items=stats.get("total_items", 0),
            active_items=stats.get("active_items", 0),
            inactive_items=stats.get("inactive_items", 0),
            rentable_items=stats.get("rentable_items", 0),
            salable_items=stats.get("salable_items", 0),
            both_rentable_salable=0,  # Would need additional query
            rental_blocked_items=stats.get("rental_blocked_items", 0),
            maintenance_due_items=0,  # Would need additional query
            warranty_expired_items=0,  # Would need additional query
            items_by_category=items_by_category,
            items_by_brand=items_by_brand,
            items_by_status=items_by_status,
            avg_sale_price=stats.get("avg_sale_price"),
            avg_rental_rate=stats.get("avg_rental_rate"),
            avg_cost_price=stats.get("avg_cost_price"),
            total_inventory_value=stats.get("total_inventory_value")
        )
    
    async def export_items(
        self,
        include_inactive: bool = False
    ) -> List[ItemExport]:
        """Export items data."""
        items = await self.repository.list(
            skip=0,
            limit=10000,  # Large limit for export
            include_inactive=include_inactive,
            include_relations=True
        )
        
        export_data = []
        for item in items:
            export_item = ItemExport.model_validate(item)
            # Add computed fields
            export_item.profit_margin = item.profit_margin
            export_item.dimensions = item.dimensions
            export_data.append(export_item)
        
        return export_data
    
    async def import_items(
        self,
        import_data: List[ItemImport],
        created_by: Optional[str] = None
    ) -> ItemImportResult:
        """Import items data."""
        total_processed = len(import_data)
        successful_imports = 0
        failed_imports = 0
        skipped_imports = 0
        updated_items = 0
        errors = []
        warnings = []
        
        for row, item_data in enumerate(import_data, 1):
            try:
                # Generate SKU if not provided
                sku = item_data.sku or await self.sku_generator.generate_sku(None)
                
                # Check if item already exists
                existing_item = await self.repository.get_by_sku(sku)
                if existing_item:
                    # Update existing item
                    update_data = item_data.model_dump(exclude={'brand_name', 'category_name', 'unit_name'})
                    update_data['updated_by'] = created_by
                    await self.repository.update(existing_item.id, update_data)
                    updated_items += 1
                    continue
                
                # Create new item
                create_data = item_data.model_dump(exclude={'brand_name', 'category_name', 'unit_name'})
                create_data.update({
                    "sku": sku,
                    "created_by": created_by,
                    "updated_by": created_by
                })
                
                # Resolve brand, category, and unit IDs from names
                # This would need additional repository calls
                
                await self.repository.create(create_data)
                successful_imports += 1
                
            except Exception as e:
                failed_imports += 1
                errors.append({
                    "row": row,
                    "message": str(e)
                })
        
        return ItemImportResult(
            total_processed=total_processed,
            successful_imports=successful_imports,
            failed_imports=failed_imports,
            skipped_imports=skipped_imports,
            updated_items=updated_items,
            errors=errors,
            warnings=warnings
        )
    
    async def regenerate_item_sku(
        self,
        item_id: UUID,
        new_category_id: Optional[UUID] = None,
        pattern: Optional[str] = None
    ) -> ItemResponse:
        """Regenerate SKU for an existing item.
        
        Args:
            item_id: Item UUID
            new_category_id: Optional new category ID
            pattern: Optional custom pattern
            
        Returns:
            Updated item response
        """
        new_sku = await self.sku_generator.regenerate_sku(
            item_id, 
            new_category_id, 
            pattern
        )
        
        # Return updated item
        return await self.get_item(item_id)
    
    async def _to_response(self, item: Item) -> ItemResponse:
        """Convert item model to response schema."""
        # Get related data names
        brand_name = item.brand.name if item.brand else None
        category_name = item.category.name if item.category else None
        category_path = item.category.category_path if item.category else None
        unit_name = item.unit_of_measurement.name if item.unit_of_measurement else None
        
        # Convert to dict and add computed fields
        item_dict = {
            "id": item.id,
            "item_name": item.item_name,
            "sku": item.sku,
            "description": item.description,
            "short_description": item.short_description,
            "brand_id": item.brand_id,
            "category_id": item.category_id,
            "unit_of_measurement_id": item.unit_of_measurement_id,
            "weight": item.weight,
            "dimensions_length": item.dimensions_length,
            "dimensions_width": item.dimensions_width,
            "dimensions_height": item.dimensions_height,
            "color": item.color,
            "material": item.material,
            "is_rentable": item.is_rentable,
            "is_salable": item.is_salable,
            "requires_serial_number": item.requires_serial_number,
            "cost_price": item.cost_price,
            "sale_price": item.sale_price,
            "rental_rate_per_day": item.rental_rate_per_day,
            "security_deposit": item.security_deposit,
            "is_rental_blocked": item.is_rental_blocked,
            "rental_block_reason": item.rental_block_reason,
            "rental_blocked_at": item.rental_blocked_at,
            "rental_blocked_by": item.rental_blocked_by,
            "reorder_level": item.reorder_level,
            "maximum_stock_level": item.maximum_stock_level,
            "status": item.status,
            "notes": item.notes,
            "tags": item.tags,
            "last_maintenance_date": item.last_maintenance_date,
            "warranty_expiry_date": item.warranty_expiry_date,
            "is_active": item.is_active,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
            "created_by": item.created_by,
            "updated_by": item.updated_by,
            # Computed properties
            "display_name": item.display_name,
            "profit_margin": item.profit_margin,
            "dimensions": item.dimensions,
            "is_maintenance_due": item.is_maintenance_due,
            "is_warranty_expired": item.is_warranty_expired,
            "can_be_rented": item.can_be_rented(),
            "can_be_sold": item.can_be_sold(),
            # Related data
            "brand_name": brand_name,
            "category_name": category_name,
            "category_path": category_path,
            "unit_name": unit_name
        }
        
        return ItemResponse(**item_dict)
    
    async def _to_summary(self, item: Item) -> ItemSummary:
        """Convert item model to summary schema."""
        # Get related data names
        brand_name = item.brand.name if item.brand else None
        category_name = item.category.name if item.category else None
        
        # Convert to dict
        item_dict = {
            "id": item.id,
            "item_name": item.item_name,
            "sku": item.sku,
            "short_description": item.short_description,
            "brand_id": item.brand_id,
            "category_id": item.category_id,
            "is_rentable": item.is_rentable,
            "is_salable": item.is_salable,
            "sale_price": item.sale_price,
            "rental_rate_per_day": item.rental_rate_per_day,
            "status": item.status,
            "is_active": item.is_active,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
            # Computed fields
            "display_name": item.display_name,
            "can_be_rented": item.can_be_rented(),
            "can_be_sold": item.can_be_sold(),
            # Related data
            "brand_name": brand_name,
            "category_name": category_name
        }
        
        return ItemSummary(**item_dict)