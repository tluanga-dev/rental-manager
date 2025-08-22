from typing import Optional, List
from uuid import UUID
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
import time
import logging

from app.core.errors import NotFoundError, ValidationError, ConflictError
from app.modules.master_data.item_master.models import Item, ItemStatus
from app.modules.master_data.item_master.repository import ItemMasterRepository
from app.modules.master_data.units.repository import UnitOfMeasurementRepository
from app.modules.master_data.item_master.schemas import (
    ItemCreate,
    ItemUpdate,
    ItemResponse,
    ItemListResponse,
    ItemWithInventoryResponse,
    ItemWithRelationsResponse,
    ItemListWithRelationsResponse,
    ItemNestedResponse,
    SKUGenerationRequest,
    SKUGenerationResponse,
    SKUBulkGenerationResponse,
    BrandNested,
    CategoryNested,
    UnitOfMeasurementNested,
)
from app.shared.utils.sku_generator import SKUGenerator


class ItemMasterService:
    """Service for item master data operations."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.item_repository = ItemMasterRepository(session)
        self.unit_repository = UnitOfMeasurementRepository(session)
        self.sku_generator = SKUGenerator(session)
        self.logger = logging.getLogger(__name__)

    # Item operations
    async def create_item(self, item_data: ItemCreate) -> ItemResponse:
        """Create a new item with automatic SKU generation."""
        start_time = time.time()
        self.logger.info(f"🔧 Service: Starting item creation for: {item_data.item_name}")
        self.logger.info(f"📋 Service: Full item data received: {item_data.dict()}")

        try:
            # Generate SKU automatically using new format
            sku_start = time.time()
            sku = await self.sku_generator.generate_sku(
                category_id=item_data.category_id,
                item_name=item_data.item_name,
                is_rentable=item_data.is_rentable,
                is_saleable=item_data.is_saleable,
            )
            sku_time = time.time() - sku_start
            self.logger.info(f"SKU generation completed in {sku_time:.3f}s. SKU: {sku}")

            # Validate item type and pricing
            validation_start = time.time()
            self._validate_item_pricing(item_data)
            validation_time = time.time() - validation_start
            self.logger.debug(f"Item validation completed in {validation_time:.3f}s")

            # Extract initial stock quantity before creating item
            initial_stock_quantity = item_data.initial_stock_quantity
            item_data_dict = item_data.model_dump()
            # Remove initial_stock_quantity as it's not a model field
            item_data_dict.pop("initial_stock_quantity", None)

            # Create ItemCreate without initial_stock_quantity
            from app.modules.master_data.item_master.schemas import ItemCreate as ItemCreateClean

            item_data_clean = ItemCreateClean(**item_data_dict)

            # Create item with generated SKU
            db_start = time.time()
            item = await self.item_repository.create(item_data_clean, sku)
            db_time = time.time() - db_start
            self.logger.info(f"Database insertion completed in {db_time:.3f}s")

            # Create initial stock if specified
            if initial_stock_quantity and initial_stock_quantity > 0:
                try:
                    # Import inventory service to create initial stock
                    from app.modules.inventory.service import InventoryService

                    inventory_service = InventoryService(self.session)
                    stock_result = await inventory_service.create_initial_stock(
                        item_id=item.id,
                        item_sku=sku,
                        purchase_price=item_data.purchase_price,
                        quantity=initial_stock_quantity,
                    )

                    if stock_result.get("created"):
                        self.logger.info(
                            f"Created initial stock: {stock_result['total_quantity']} units "
                            f"at {stock_result['location_name']} for item {item.id}. "
                            f"SKUs: {', '.join(stock_result.get('skus', stock_result.get('unit_codes', [])))}"
                        )
                    else:
                        self.logger.warning(
                            f"Failed to create initial stock: {stock_result.get('reason', 'Unknown error')}"
                        )
                except Exception as stock_error:
                    self.logger.error(
                        f"Exception during initial stock creation: {str(stock_error)}"
                    )
                    # Don't fail item creation if stock creation fails

            total_time = time.time() - start_time
            self.logger.info(
                f"Item creation completed successfully in {total_time:.3f}s. Item ID: {item.id}"
            )

            return ItemResponse.model_validate(item)

        except Exception as e:
            total_time = time.time() - start_time
            self.logger.error(f"❌ Service: Item creation failed after {total_time:.3f}s: {str(e)}")
            self.logger.error(f"📋 Service: Failed item data: {item_data.dict()}")
            self.logger.exception("🔍 Service: Full exception details:")
            raise

    async def get_item(self, item_id: UUID) -> ItemWithRelationsResponse:
        """Get item by ID with relationships."""
        try:
            item = await self.item_repository.get_by_id_with_relations(item_id)
            if not item:
                raise NotFoundError(f"Item with ID {item_id} not found")

            # Debug logging to see what we're getting
            self.logger.info(f"🔍 Item retrieved: {item.item_name}")
            self.logger.info(f"🔍 Brand: {item.brand}")
            self.logger.info(f"🔍 Category: {item.category}")
            self.logger.info(f"🔍 Unit: {item.unit_of_measurement}")

            # Create the response manually to ensure relationships are included
            response_data = {
                # Basic item fields
                "id": item.id,
                "sku": item.sku,
                "item_name": item.item_name,
                "item_status": item.item_status,
                "brand_id": item.brand_id,
                "category_id": item.category_id,
                "unit_of_measurement_id": item.unit_of_measurement_id,
                "rental_rate_per_period": item.rental_rate_per_period,
                "rental_period": item.rental_period,
                "sale_price": item.sale_price,
                "purchase_price": item.purchase_price,
                "security_deposit": item.security_deposit,
                "description": item.description,
                "specifications": item.specifications,
                "model_number": item.model_number,
                "serial_number_required": item.serial_number_required,
                "warranty_period_days": item.warranty_period_days,
                "reorder_point": item.reorder_point,
                "is_rentable": item.is_rentable,
                "is_saleable": item.is_saleable,
                "is_active": item.is_active,
                "created_at": item.created_at,
                "updated_at": item.updated_at,
                
                # Relationship data
                "brand": {
                    "id": item.brand.id,
                    "name": item.brand.name,
                    "code": item.brand.code,
                    "description": item.brand.description,
                } if item.brand else None,
                
                "category": {
                    "id": item.category.id,
                    "name": item.category.name,
                    "category_path": item.category.category_path,
                    "category_level": item.category.category_level,
                } if item.category else None,
                
                "unit_of_measurement": {
                    "id": item.unit_of_measurement.id,
                    "name": item.unit_of_measurement.name,
                    "code": item.unit_of_measurement.code,
                } if item.unit_of_measurement else None,
                
                # Default inventory values
                "total_units": 0,
                "available_units": 0,
                "rented_units": 0,
            }
            
            try:
                response = ItemWithRelationsResponse.model_validate(response_data)
                self.logger.info(f"🔍 Schema validation successful")
                self.logger.info(f"🔍 Response brand: {response.brand}")
                self.logger.info(f"🔍 Response category: {response.category}")
                self.logger.info(f"🔍 Response unit: {response.unit_of_measurement}")
                return response
            except Exception as val_e:
                self.logger.error(f"🔍 Schema validation failed: {str(val_e)}")
                self.logger.error(f"🔍 Response data: {response_data}")
                raise
        except Exception as e:
            self.logger.error(f"🔍 Service error in get_item: {str(e)}")
            self.logger.error(f"🔍 Error type: {type(e).__name__}")
            self.logger.error(f"🔍 Item ID: {item_id}")
            if 'response_data' in locals():
                self.logger.error(f"🔍 Response data: {response_data}")
            self.logger.exception("🔍 Full error details:")
            # Re-raise with more context
            raise Exception(f"Failed to get item {item_id}: {str(e)}") from e

    async def get_item_by_sku(self, sku: str) -> ItemResponse:
        """Get item by SKU."""
        item = await self.item_repository.get_by_sku(sku)
        if not item:
            raise NotFoundError(f"Item with SKU '{sku}' not found")
        return ItemResponse.model_validate(item)

    async def get_items(
        self,
        skip: int = 0,
        limit: int = 100,
        category_id: Optional[UUID] = None,
        brand_id: Optional[UUID] = None,
        item_status: Optional[ItemStatus] = None,
        active_only: bool = True,
        # Date filters
        created_after: Optional[str] = None,
        created_before: Optional[str] = None,
        updated_after: Optional[str] = None,
        updated_before: Optional[str] = None,
    ) -> List[ItemListResponse]:
        """Get all items with essential filtering."""
        items = await self.item_repository.get_all(
            skip=skip,
            limit=limit,
            item_status=item_status,
            brand_id=brand_id,
            category_id=category_id,
            active_only=active_only,
            # Date filters
            created_after=created_after,
            created_before=created_before,
            updated_after=updated_after,
            updated_before=updated_before,
        )

        return [ItemListResponse.model_validate(item) for item in items]

    async def get_items_with_relations(
        self,
        skip: int = 0,
        limit: int = 100,
        item_status: Optional[ItemStatus] = None,
        brand_ids: Optional[List[UUID]] = None,
        category_ids: Optional[List[UUID]] = None,
        active_only: bool = True,
        # Additional filters
        is_rentable: Optional[bool] = None,
        is_saleable: Optional[bool] = None,
        min_rental_rate: Optional[float] = None,
        max_rental_rate: Optional[float] = None,
        min_sale_price: Optional[float] = None,
        max_sale_price: Optional[float] = None,
        has_stock: Optional[bool] = None,
        search_term: Optional[str] = None,
        # Date filters
        created_after: Optional[str] = None,
        created_before: Optional[str] = None,
        updated_after: Optional[str] = None,
        updated_before: Optional[str] = None,
    ) -> List[ItemListWithRelationsResponse]:
        """Get all items with relationship data and enhanced filtering."""
        from decimal import Decimal

        # Convert float parameters to Decimal for repository
        min_rental_rate_decimal = Decimal(str(min_rental_rate)) if min_rental_rate else None
        max_rental_rate_decimal = Decimal(str(max_rental_rate)) if max_rental_rate else None
        min_sale_price_decimal = Decimal(str(min_sale_price)) if min_sale_price else None
        max_sale_price_decimal = Decimal(str(max_sale_price)) if max_sale_price else None

        items_data = await self.item_repository.get_all_with_relations(
            skip=skip,
            limit=limit,
            item_status=item_status,
            brand_ids=brand_ids,
            category_ids=category_ids,
            active_only=active_only,
            is_rentable=is_rentable,
            is_saleable=is_saleable,
            min_rental_rate=min_rental_rate_decimal,
            max_rental_rate=max_rental_rate_decimal,
            min_sale_price=min_sale_price_decimal,
            max_sale_price=max_sale_price_decimal,
            has_stock=has_stock,
            search_term=search_term,
            created_after=created_after,
            created_before=created_before,
            updated_after=updated_after,
            updated_before=updated_before,
        )

        # Convert raw data to Pydantic models
        response_items = []
        for item_data in items_data:
            response_items.append(ItemListWithRelationsResponse(**item_data))

        return response_items

    async def count_items(
        self,
        search: Optional[str] = None,
        item_status: Optional[ItemStatus] = None,
        brand_id: Optional[UUID] = None,
        category_id: Optional[UUID] = None,
        is_rentable: Optional[bool] = None,
        is_saleable: Optional[bool] = None,
        active_only: bool = True,
    ) -> int:
        """Count all items with optional search and filtering."""
        return await self.item_repository.count_all(
            search=search,
            item_status=item_status,
            brand_id=brand_id,
            category_id=category_id,
            is_rentable=is_rentable,
            is_saleable=is_saleable,
            active_only=active_only,
        )

    async def search_items(
        self, search_term: str, skip: int = 0, limit: int = 100, active_only: bool = True
    ) -> List[ItemListResponse]:
        """Search items by name or code."""
        items = await self.item_repository.search(
            search_term=search_term, skip=skip, limit=limit, active_only=active_only
        )

        return [ItemListResponse.model_validate(item) for item in items]

    async def update_item(self, item_id: UUID, item_data: ItemUpdate) -> ItemResponse:
        """Update an item."""
        # Get existing item
        existing_item = await self.item_repository.get_by_id(item_id)
        if not existing_item:
            raise NotFoundError(f"Item with ID {item_id} not found")

        # Validate pricing if boolean fields or pricing is being updated
        if any(
            [
                item_data.is_rentable is not None,
                item_data.is_saleable is not None,
                item_data.rental_rate_per_period is not None,
                item_data.sale_price is not None,
            ]
        ):
            self._validate_item_pricing_update(existing_item, item_data)

        # Update item
        updated_item = await self.item_repository.update(item_id, item_data)
        if not updated_item:
            raise NotFoundError(f"Item with ID {item_id} not found")

        return ItemResponse.model_validate(updated_item)

    async def delete_item(self, item_id: UUID) -> bool:
        """Delete (soft delete) an item."""
        success = await self.item_repository.delete(item_id)
        if not success:
            raise NotFoundError(f"Item with ID {item_id} not found")
        return success


    async def get_sale_items(self, active_only: bool = True) -> List[ItemListResponse]:
        """Get all sale items."""
        items = await self.item_repository.get_sale_items(active_only=active_only)
        return [ItemListResponse.model_validate(item) for item in items]

    async def get_items_by_category(
        self, category_id: UUID, active_only: bool = True
    ) -> List[ItemListResponse]:
        """Get all items in a specific category."""
        items = await self.item_repository.get_items_by_category(
            category_id, active_only=active_only
        )
        return [ItemListResponse.model_validate(item) for item in items]

    async def get_items_by_brand(
        self, brand_id: UUID, active_only: bool = True
    ) -> List[ItemListResponse]:
        """Get all items for a specific brand."""
        items = await self.item_repository.get_items_by_brand(brand_id, active_only=active_only)
        return [ItemListResponse.model_validate(item) for item in items]

    async def get_low_stock_items(self, active_only: bool = True) -> List[ItemListResponse]:
        """Get items that need reordering based on reorder level."""
        items = await self.item_repository.get_low_stock_items(active_only=active_only)
        return [ItemListResponse.model_validate(item) for item in items]

    async def get_items_nested_format(
        self,
        skip: int = 0,
        limit: int = 100,
        item_status: Optional[ItemStatus] = None,
        brand_ids: Optional[List[UUID]] = None,
        category_ids: Optional[List[UUID]] = None,
        active_only: bool = True,
        is_rentable: Optional[bool] = None,
        is_saleable: Optional[bool] = None,
        min_rental_rate: Optional[Decimal] = None,
        max_rental_rate: Optional[Decimal] = None,
        min_sale_price: Optional[Decimal] = None,
        max_sale_price: Optional[Decimal] = None,
        has_stock: Optional[bool] = None,
        search_term: Optional[str] = None,
        created_after: Optional[str] = None,
        created_before: Optional[str] = None,
        updated_after: Optional[str] = None,
        updated_before: Optional[str] = None,
    ) -> List[ItemNestedResponse]:
        """Get items with nested relationship format."""
        self.logger.info(f"🔍 Service: get_items_nested_format called with search_term='{search_term}'")
        """Get items with nested relationship format."""
        # Convert decimal price filters if provided
        if min_rental_rate is not None:
            min_rental_rate = Decimal(str(min_rental_rate))
        if max_rental_rate is not None:
            max_rental_rate = Decimal(str(max_rental_rate))
        if min_sale_price is not None:
            min_sale_price = Decimal(str(min_sale_price))
        if max_sale_price is not None:
            max_sale_price = Decimal(str(max_sale_price))

        # Get items with eagerly loaded relationships
        items = await self.item_repository.get_all_with_nested_relations(
            skip=skip,
            limit=limit,
            item_status=item_status,
            brand_ids=brand_ids,
            category_ids=category_ids,
            active_only=active_only,
            is_rentable=is_rentable,
            is_saleable=is_saleable,
            min_rental_rate=min_rental_rate,
            max_rental_rate=max_rental_rate,
            min_sale_price=min_sale_price,
            max_sale_price=max_sale_price,
            has_stock=has_stock,
            search_term=search_term,
            created_after=created_after,
            created_before=created_before,
            updated_after=updated_after,
            updated_before=updated_before,
        )

        # Transform to nested format
        response_items = []
        for item in items:
            # Build nested response
            nested_item = {
                "id": item.id,
                "sku": item.sku,
                "item_name": item.item_name,
                "item_status": item.item_status,
                "brand_id": None,
                "category_id": None,
                "unit_of_measurement_id": None,
                "rental_rate_per_period": item.rental_rate_per_period or Decimal("0"),
                "rental_period": item.rental_period or "1",
                "sale_price": item.sale_price or Decimal("0"),
                "purchase_price": item.purchase_price or Decimal("0"),
                "initial_stock_quantity": 0,  # This would need to come from inventory
                "security_deposit": item.security_deposit or Decimal("0"),
                "description": item.description,
                "specifications": item.specifications,
                "model_number": item.model_number,
                "serial_number_required": item.serial_number_required,
                "warranty_period_days": item.warranty_period_days or "0",
                "reorder_level": item.reorder_point or 0,
                "reorder_quantity": 0,  # This field doesn't exist in the model
                "is_rentable": item.is_rentable,
                "is_saleable": item.is_saleable,
            }

            # Add nested brand info
            if item.brand:
                nested_item["brand_id"] = BrandNested(id=item.brand.id, name=item.brand.name)

            # Add nested category info
            if item.category:
                nested_item["category_id"] = CategoryNested(
                    id=item.category.id, name=item.category.name
                )

            # Add nested unit info (required field)
            if item.unit_of_measurement:
                nested_item["unit_of_measurement_id"] = UnitOfMeasurementNested(
                    id=item.unit_of_measurement.id,
                    name=item.unit_of_measurement.name,
                    code=item.unit_of_measurement.code,
                )
            elif item.unit_of_measurement_id:
                # Fallback: if relationship not loaded but ID exists, fetch the unit
                unit = await self.unit_repository.get_by_id(item.unit_of_measurement_id)
                if unit:
                    nested_item["unit_of_measurement_id"] = UnitOfMeasurementNested(
                        id=unit.id, name=unit.name, code=unit.code
                    )
                else:
                    # Data inconsistency: unit ID exists but unit not found
                    raise ValueError(
                        f"Unit of measurement with ID {item.unit_of_measurement_id} not found for item {item.item_name}"
                    )
            else:
                # This should not happen if database constraints are correct
                raise ValueError(f"Item {item.item_name} has no unit of measurement")

            response_items.append(ItemNestedResponse(**nested_item))

        return response_items

    # SKU-specific operations
    async def generate_sku_preview(self, request: SKUGenerationRequest) -> SKUGenerationResponse:
        """Generate a preview of what SKU would be created."""
        sku = await self.sku_generator.preview_sku(
            category_id=request.category_id,
            item_name=request.item_name,
            is_rentable=request.is_rentable,
            is_saleable=request.is_saleable,
        )

        # Extract components for response
        parts = sku.split("-")
        if len(parts) == 5:
            category_code, subcategory_code, product_code, attributes_code, sequence = parts
            sequence_number = int(sequence)
        else:
            category_code = "MISC"
            subcategory_code = "ITEM"
            product_code = parts[2] if len(parts) > 2 else "PROD"
            attributes_code = parts[3] if len(parts) > 3 else "R"
            sequence_number = 1

        return SKUGenerationResponse(
            sku=sku,
            category_code=category_code,
            subcategory_code=subcategory_code,
            product_code=product_code,
            attributes_code=attributes_code,
            sequence_number=sequence_number,
        )

    async def bulk_generate_skus(self) -> SKUBulkGenerationResponse:
        """Generate SKUs for all existing items that don't have them."""
        result = await self.sku_generator.bulk_generate_skus_for_existing_items()
        return SKUBulkGenerationResponse(**result)

    # Helper methods
    def _validate_item_pricing(self, item_data: ItemCreate):
        """Validate item pricing based on boolean fields."""
        if item_data.is_rentable:
            # Rental rate is optional, but if provided must be positive
            if item_data.rental_rate_per_period is not None and item_data.rental_rate_per_period <= 0:
                raise ValidationError("Rental rate per period must be greater than 0 if provided")
            # Rental period is required for rentable items, can be zero or positive
            if item_data.rental_period is None:
                raise ValidationError("Rental period is required for rentable items")
            # Convert string to int for comparison
            try:
                rental_period_int = int(item_data.rental_period)
                if rental_period_int < 0:
                    raise ValidationError("Rental period cannot be negative")
            except (ValueError, TypeError):
                raise ValidationError("Rental period must be a valid number")

        # Sale price is now optional for saleable items - can be 0 or null
        # This allows for free items, promotional items, and dynamic pricing

    def _validate_item_pricing_update(self, existing_item: Item, item_data: ItemUpdate):
        """Validate item pricing for updates."""
        # Get effective boolean fields after update
        is_rentable = (
            item_data.is_rentable
            if item_data.is_rentable is not None
            else existing_item.is_rentable
        )
        is_saleable = (
            item_data.is_saleable
            if item_data.is_saleable is not None
            else existing_item.is_saleable
        )

        # Get effective pricing after update
        rental_rate = (
            item_data.rental_rate_per_period
            if item_data.rental_rate_per_period is not None
            else existing_item.rental_rate_per_period
        )
        rental_period = (
            item_data.rental_period
            if item_data.rental_period is not None
            else existing_item.rental_period
        )
        sale_price = (
            item_data.sale_price if item_data.sale_price is not None else existing_item.sale_price
        )

        if is_rentable:
            # Rental rate is optional, but if provided must be positive
            if rental_rate is not None and rental_rate <= 0:
                raise ValidationError("Rental rate per period must be greater than 0 if provided")
            # Rental period is required for rentable items, can be zero or positive
            if rental_period is None:
                raise ValidationError("Rental period is required for rentable items")
            # Convert string to int for comparison
            try:
                rental_period_int = int(rental_period)
                if rental_period_int < 0:
                    raise ValidationError("Rental period cannot be negative")
            except (ValueError, TypeError):
                raise ValidationError("Rental period must be a valid number")

        # Sale price is now optional for saleable items - can be 0 or null
        # This allows for free items, promotional items, and dynamic pricing
    
    async def get_low_stock_items(
        self, 
        location_id: Optional[UUID] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[ItemWithInventoryResponse]:
        """
        Get items with stock levels at or below their reorder point.
        Uses efficient JOIN pattern to avoid copying reorder_point data.
        
        Args:
            location_id: Optional location filter
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            List of items that need reordering
        """
        try:
            low_stock_items = await self.item_repository.get_low_stock_items(
                location_id=location_id,
                skip=skip,
                limit=limit
            )
            
            return [
                ItemWithInventoryResponse.model_validate(item) 
                for item in low_stock_items
            ]
            
        except Exception as e:
            self.logger.error(f"Error fetching low stock items: {str(e)}")
            raise
    
    async def get_stock_alerts_summary(self) -> dict:
        """
        Get summary of stock alerts across all items.
        
        Returns:
            Dictionary with stock alert counts and statistics
        """
        try:
            summary = await self.item_repository.get_stock_alerts_summary()
            
            return {
                "out_of_stock_count": summary.get("out_of_stock", 0),
                "low_stock_count": summary.get("low_stock", 0),
                "total_items": summary.get("total_items", 0),
                "average_reorder_point": summary.get("avg_reorder_point", 0),
                "items_needing_attention": summary.get("out_of_stock", 0) + summary.get("low_stock", 0)
            }
            
        except Exception as e:
            self.logger.error(f"Error fetching stock alerts summary: {str(e)}")
            raise
