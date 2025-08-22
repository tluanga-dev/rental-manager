from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import datetime
from decimal import Decimal
from uuid import UUID


class ItemBase(BaseModel):
    """Base item schema with common fields."""
    
    item_name: str = Field(..., min_length=1, max_length=255, description="Item name")
    sku: Optional[str] = Field(None, min_length=1, max_length=50, description="Stock Keeping Unit")
    description: Optional[str] = Field(None, max_length=5000, description="Detailed item description")
    short_description: Optional[str] = Field(None, max_length=500, description="Brief description")
    brand_id: Optional[UUID] = Field(None, description="Brand ID")
    category_id: Optional[UUID] = Field(None, description="Category ID")
    unit_of_measurement_id: Optional[UUID] = Field(None, description="Unit of measurement ID")
    
    # Physical properties
    weight: Optional[Decimal] = Field(None, ge=0, description="Weight in kg")
    dimensions_length: Optional[Decimal] = Field(None, ge=0, description="Length in cm")
    dimensions_width: Optional[Decimal] = Field(None, ge=0, description="Width in cm")
    dimensions_height: Optional[Decimal] = Field(None, ge=0, description="Height in cm")
    color: Optional[str] = Field(None, max_length=50, description="Item color")
    material: Optional[str] = Field(None, max_length=100, description="Material composition")
    
    # Business configuration
    is_rentable: bool = Field(True, description="Whether item can be rented")
    is_salable: bool = Field(True, description="Whether item can be sold")
    requires_serial_number: bool = Field(False, description="Whether serial numbers are required")
    
    # Pricing
    cost_price: Optional[Decimal] = Field(None, ge=0, description="Cost price")
    sale_price: Optional[Decimal] = Field(None, ge=0, description="Sale price")
    rental_rate_per_day: Optional[Decimal] = Field(None, ge=0, description="Daily rental rate")
    security_deposit: Optional[Decimal] = Field(None, ge=0, description="Security deposit amount")
    
    # Inventory management
    reorder_level: Optional[int] = Field(None, ge=0, description="Minimum stock level")
    maximum_stock_level: Optional[int] = Field(None, ge=0, description="Maximum stock level")
    
    # Status and notes
    status: str = Field("ACTIVE", description="Item status")
    notes: Optional[str] = Field(None, max_length=5000, description="Additional notes")
    tags: Optional[str] = Field(None, max_length=1000, description="Comma-separated tags")
    
    # Maintenance and warranty
    last_maintenance_date: Optional[datetime] = Field(None, description="Last maintenance date")
    warranty_expiry_date: Optional[datetime] = Field(None, description="Warranty expiry date")
    
    @field_validator('item_name')
    @classmethod
    def validate_item_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Item name cannot be empty')
        return v.strip()
    
    @field_validator('sku')
    @classmethod
    def validate_sku(cls, v):
        if v is not None:
            if not v.strip():
                raise ValueError('SKU cannot be empty if provided')
            return v.strip().upper()
        return v
    
    @field_validator('cost_price', 'sale_price')
    @classmethod
    def validate_pricing(cls, v, info):
        """Validate pricing relationships."""
        if v is not None and v < 0:
            raise ValueError(f'{info.field_name} cannot be negative')
        return v
    
    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        allowed_statuses = ['ACTIVE', 'INACTIVE', 'DISCONTINUED', 'OUT_OF_STOCK']
        if v not in allowed_statuses:
            raise ValueError(f'Status must be one of: {", ".join(allowed_statuses)}')
        return v
    
    @field_validator('is_rentable', 'is_salable')
    @classmethod
    def validate_business_config(cls, v, info):
        """Ensure at least one business type is enabled."""
        return v
    
    def model_post_init(self, __context) -> None:
        """Validate business logic after model initialization."""
        if not self.is_rentable and not self.is_salable:
            raise ValueError('Item must be either rentable or salable (or both)')
        
        if self.cost_price and self.sale_price:
            if self.sale_price <= self.cost_price:
                raise ValueError('Sale price must be greater than cost price')


class ItemCreate(ItemBase):
    """Schema for creating a new item."""
    pass


class ItemUpdate(BaseModel):
    """Schema for updating an existing item."""
    
    item_name: Optional[str] = Field(None, min_length=1, max_length=255, description="Item name")
    sku: Optional[str] = Field(None, min_length=1, max_length=50, description="Stock Keeping Unit")
    description: Optional[str] = Field(None, max_length=5000, description="Detailed item description")
    short_description: Optional[str] = Field(None, max_length=500, description="Brief description")
    brand_id: Optional[UUID] = Field(None, description="Brand ID")
    category_id: Optional[UUID] = Field(None, description="Category ID")
    unit_of_measurement_id: Optional[UUID] = Field(None, description="Unit of measurement ID")
    
    # Physical properties
    weight: Optional[Decimal] = Field(None, ge=0, description="Weight in kg")
    dimensions_length: Optional[Decimal] = Field(None, ge=0, description="Length in cm")
    dimensions_width: Optional[Decimal] = Field(None, ge=0, description="Width in cm")
    dimensions_height: Optional[Decimal] = Field(None, ge=0, description="Height in cm")
    color: Optional[str] = Field(None, max_length=50, description="Item color")
    material: Optional[str] = Field(None, max_length=100, description="Material composition")
    
    # Business configuration
    is_rentable: Optional[bool] = Field(None, description="Whether item can be rented")
    is_salable: Optional[bool] = Field(None, description="Whether item can be sold")
    requires_serial_number: Optional[bool] = Field(None, description="Whether serial numbers are required")
    
    # Pricing
    cost_price: Optional[Decimal] = Field(None, ge=0, description="Cost price")
    sale_price: Optional[Decimal] = Field(None, ge=0, description="Sale price")
    rental_rate_per_day: Optional[Decimal] = Field(None, ge=0, description="Daily rental rate")
    security_deposit: Optional[Decimal] = Field(None, ge=0, description="Security deposit amount")
    
    # Inventory management
    reorder_level: Optional[int] = Field(None, ge=0, description="Minimum stock level")
    maximum_stock_level: Optional[int] = Field(None, ge=0, description="Maximum stock level")
    
    # Status and notes
    status: Optional[str] = Field(None, description="Item status")
    notes: Optional[str] = Field(None, max_length=5000, description="Additional notes")
    tags: Optional[str] = Field(None, max_length=1000, description="Comma-separated tags")
    is_active: Optional[bool] = Field(None, description="Item active status")
    
    # Maintenance and warranty
    last_maintenance_date: Optional[datetime] = Field(None, description="Last maintenance date")
    warranty_expiry_date: Optional[datetime] = Field(None, description="Warranty expiry date")
    
    @field_validator('item_name')
    @classmethod
    def validate_item_name(cls, v):
        if v is not None:
            if not v or not v.strip():
                raise ValueError('Item name cannot be empty')
            return v.strip()
        return v
    
    @field_validator('sku')
    @classmethod
    def validate_sku(cls, v):
        if v is not None:
            if not v.strip():
                raise ValueError('SKU cannot be empty if provided')
            return v.strip().upper()
        return v
    
    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        if v is not None:
            allowed_statuses = ['ACTIVE', 'INACTIVE', 'DISCONTINUED', 'OUT_OF_STOCK']
            if v not in allowed_statuses:
                raise ValueError(f'Status must be one of: {", ".join(allowed_statuses)}')
        return v


class ItemResponse(ItemBase):
    """Schema for item response with all fields."""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID = Field(..., description="Item unique identifier")
    is_active: bool = Field(True, description="Item active status")
    created_at: datetime = Field(..., description="Item creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Item last update timestamp")
    created_by: Optional[str] = Field(None, description="User who created the item")
    updated_by: Optional[str] = Field(None, description="User who last updated the item")
    
    # Rental blocking fields
    is_rental_blocked: bool = Field(False, description="Whether rental is blocked")
    rental_block_reason: Optional[str] = Field(None, description="Reason for rental blocking")
    rental_blocked_at: Optional[datetime] = Field(None, description="When rental was blocked")
    rental_blocked_by: Optional[UUID] = Field(None, description="User who blocked rental")
    
    # Computed properties
    display_name: Optional[str] = Field(None, description="Item display name (computed)")
    profit_margin: Optional[Decimal] = Field(None, description="Profit margin percentage")
    dimensions: Optional[str] = Field(None, description="Formatted dimensions string")
    is_maintenance_due: bool = Field(False, description="Whether maintenance is due")
    is_warranty_expired: bool = Field(False, description="Whether warranty has expired")
    can_be_rented: bool = Field(False, description="Whether item can currently be rented")
    can_be_sold: bool = Field(False, description="Whether item can currently be sold")
    
    # Related data (summary)
    brand_name: Optional[str] = Field(None, description="Brand name")
    category_name: Optional[str] = Field(None, description="Category name")
    category_path: Optional[str] = Field(None, description="Full category path")
    unit_name: Optional[str] = Field(None, description="Unit of measurement name")


class ItemSummary(BaseModel):
    """Schema for item summary with minimal fields."""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID = Field(..., description="Item unique identifier")
    item_name: str = Field(..., description="Item name")
    sku: str = Field(..., description="Stock Keeping Unit")
    short_description: Optional[str] = Field(None, description="Brief description")
    brand_id: Optional[UUID] = Field(None, description="Brand ID")
    category_id: Optional[UUID] = Field(None, description="Category ID")
    is_rentable: bool = Field(True, description="Whether item can be rented")
    is_salable: bool = Field(True, description="Whether item can be sold")
    sale_price: Optional[Decimal] = Field(None, description="Sale price")
    rental_rate_per_day: Optional[Decimal] = Field(None, description="Daily rental rate")
    status: str = Field(..., description="Item status")
    is_active: bool = Field(True, description="Item active status")
    created_at: datetime = Field(..., description="Item creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Item last update timestamp")
    
    # Computed fields
    display_name: Optional[str] = Field(None, description="Item display name")
    can_be_rented: bool = Field(False, description="Whether item can currently be rented")
    can_be_sold: bool = Field(False, description="Whether item can currently be sold")
    
    # Related data
    brand_name: Optional[str] = Field(None, description="Brand name")
    category_name: Optional[str] = Field(None, description="Category name")


class ItemList(BaseModel):
    """Schema for paginated item list response."""
    
    items: List[ItemSummary] = Field(..., description="List of item summaries")
    total: int = Field(..., description="Total number of items")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Number of items per page")
    total_pages: int = Field(..., description="Total number of pages")
    has_next: bool = Field(..., description="Whether there are more pages")
    has_previous: bool = Field(..., description="Whether there are previous pages")


class ItemFilter(BaseModel):
    """Schema for item filtering and search."""
    
    item_name: Optional[str] = Field(None, description="Filter by item name (partial match)")
    sku: Optional[str] = Field(None, description="Filter by SKU (partial match)")
    brand_id: Optional[UUID] = Field(None, description="Filter by brand ID")
    category_id: Optional[UUID] = Field(None, description="Filter by category ID")
    unit_of_measurement_id: Optional[UUID] = Field(None, description="Filter by unit ID")
    is_rentable: Optional[bool] = Field(None, description="Filter by rentable status")
    is_salable: Optional[bool] = Field(None, description="Filter by salable status")
    is_active: Optional[bool] = Field(None, description="Filter by active status")
    status: Optional[str] = Field(None, description="Filter by item status")
    is_rental_blocked: Optional[bool] = Field(None, description="Filter by rental blocking status")
    
    # Price range filters
    min_sale_price: Optional[Decimal] = Field(None, ge=0, description="Minimum sale price")
    max_sale_price: Optional[Decimal] = Field(None, ge=0, description="Maximum sale price")
    min_rental_rate: Optional[Decimal] = Field(None, ge=0, description="Minimum rental rate")
    max_rental_rate: Optional[Decimal] = Field(None, ge=0, description="Maximum rental rate")
    
    # Date filters
    created_after: Optional[datetime] = Field(None, description="Filter by creation date (after)")
    created_before: Optional[datetime] = Field(None, description="Filter by creation date (before)")
    updated_after: Optional[datetime] = Field(None, description="Filter by update date (after)")
    updated_before: Optional[datetime] = Field(None, description="Filter by update date (before)")
    
    # Search
    search: Optional[str] = Field(None, description="Search in name, SKU, and description")
    tags: Optional[str] = Field(None, description="Filter by tags (comma-separated)")
    
    @field_validator('item_name', 'sku', 'search', 'tags')
    @classmethod
    def validate_string_filters(cls, v):
        if v is not None:
            return v.strip() if v.strip() else None
        return v
    
    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        if v is not None:
            allowed_statuses = ['ACTIVE', 'INACTIVE', 'DISCONTINUED', 'OUT_OF_STOCK']
            if v not in allowed_statuses:
                raise ValueError(f'Status must be one of: {", ".join(allowed_statuses)}')
        return v


class ItemSort(BaseModel):
    """Schema for item sorting options."""
    
    field: str = Field('item_name', description="Field to sort by")
    direction: str = Field('asc', description="Sort direction (asc/desc)")
    
    @field_validator('field')
    @classmethod
    def validate_field(cls, v):
        allowed_fields = [
            'item_name', 'sku', 'created_at', 'updated_at', 'status', 'is_active',
            'sale_price', 'rental_rate_per_day', 'cost_price', 'brand_name', 'category_name'
        ]
        if v not in allowed_fields:
            raise ValueError(f'Sort field must be one of: {", ".join(allowed_fields)}')
        return v
    
    @field_validator('direction')
    @classmethod
    def validate_direction(cls, v):
        if v.lower() not in ['asc', 'desc']:
            raise ValueError('Sort direction must be "asc" or "desc"')
        return v.lower()


class ItemStats(BaseModel):
    """Schema for item statistics."""
    
    total_items: int = Field(..., description="Total number of items")
    active_items: int = Field(..., description="Number of active items")
    inactive_items: int = Field(..., description="Number of inactive items")
    rentable_items: int = Field(..., description="Number of rentable items")
    salable_items: int = Field(..., description="Number of salable items")
    both_rentable_salable: int = Field(..., description="Items that are both rentable and salable")
    rental_blocked_items: int = Field(..., description="Number of rental blocked items")
    maintenance_due_items: int = Field(..., description="Items with maintenance due")
    warranty_expired_items: int = Field(..., description="Items with expired warranty")
    
    # By category/brand stats
    items_by_category: List[dict] = Field(..., description="Item count by category")
    items_by_brand: List[dict] = Field(..., description="Item count by brand")
    items_by_status: List[dict] = Field(..., description="Item count by status")
    
    # Pricing stats
    avg_sale_price: Optional[Decimal] = Field(None, description="Average sale price")
    avg_rental_rate: Optional[Decimal] = Field(None, description="Average rental rate")
    avg_cost_price: Optional[Decimal] = Field(None, description="Average cost price")
    total_inventory_value: Optional[Decimal] = Field(None, description="Total inventory value")


class ItemRentalStatusRequest(BaseModel):
    """Schema for rental status change request."""
    
    is_rental_blocked: bool = Field(..., description="Whether to block or unblock rental")
    remarks: Optional[str] = Field(None, max_length=500, description="Reason for status change")


class ItemRentalStatusResponse(BaseModel):
    """Schema for rental status change response."""
    
    item_id: UUID = Field(..., description="Item ID")
    item_name: str = Field(..., description="Item name")
    is_rental_blocked: bool = Field(..., description="Current rental blocked status")
    rental_block_reason: Optional[str] = Field(None, description="Reason for blocking")
    rental_blocked_at: Optional[datetime] = Field(None, description="When rental was blocked")
    rental_blocked_by: Optional[UUID] = Field(None, description="User who blocked rental")
    previous_status: bool = Field(..., description="Previous rental blocked status")
    message: str = Field(..., description="Status change message")


class ItemBulkOperation(BaseModel):
    """Schema for bulk item operations."""
    
    item_ids: List[UUID] = Field(..., min_length=1, description="List of item IDs")
    operation: str = Field(..., description="Operation to perform")
    
    # Optional fields for specific operations
    status: Optional[str] = Field(None, description="New status for status change operations")
    is_rental_blocked: Optional[bool] = Field(None, description="Rental blocking status")
    rental_block_reason: Optional[str] = Field(None, description="Reason for rental blocking")
    pricing_updates: Optional[dict] = Field(None, description="Pricing updates")
    
    @field_validator('operation')
    @classmethod
    def validate_operation(cls, v):
        allowed_operations = [
            'activate', 'deactivate', 'block_rental', 'unblock_rental', 
            'update_status', 'bulk_pricing_update', 'bulk_delete'
        ]
        if v not in allowed_operations:
            raise ValueError(f'Operation must be one of: {", ".join(allowed_operations)}')
        return v


class ItemBulkResult(BaseModel):
    """Schema for bulk operation results."""
    
    total_requested: int = Field(..., description="Total number of items requested")
    success_count: int = Field(..., description="Number of successful operations")
    failure_count: int = Field(..., description="Number of failed operations")
    skipped_count: int = Field(0, description="Number of skipped operations")
    successful_items: List[UUID] = Field(..., description="Successfully processed item IDs")
    failed_items: List[dict] = Field(..., description="Failed operations with errors")
    
    @field_validator('failed_items')
    @classmethod
    def validate_failed_items(cls, v):
        """Validate the structure of failed_items."""
        for item in v:
            if not isinstance(item, dict) or 'item_id' not in item or 'error' not in item:
                raise ValueError('Each failed item must have item_id and error fields')
        return v


class ItemExport(BaseModel):
    """Schema for item export data."""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    item_name: str
    sku: str
    description: Optional[str]
    short_description: Optional[str]
    brand_name: Optional[str]
    category_name: Optional[str]
    category_path: Optional[str]
    unit_name: Optional[str]
    weight: Optional[Decimal]
    dimensions: Optional[str]
    color: Optional[str]
    material: Optional[str]
    is_rentable: bool
    is_salable: bool
    requires_serial_number: bool
    cost_price: Optional[Decimal]
    sale_price: Optional[Decimal]
    rental_rate_per_day: Optional[Decimal]
    security_deposit: Optional[Decimal]
    profit_margin: Optional[Decimal]
    reorder_level: Optional[int]
    maximum_stock_level: Optional[int]
    status: str
    notes: Optional[str]
    tags: Optional[str]
    is_rental_blocked: bool
    rental_block_reason: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    created_by: Optional[str]
    updated_by: Optional[str]


class ItemImport(BaseModel):
    """Schema for item import data."""
    
    item_name: str = Field(..., min_length=1, max_length=255)
    sku: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=5000)
    short_description: Optional[str] = Field(None, max_length=500)
    brand_name: Optional[str] = Field(None, description="Brand name (will be resolved to ID)")
    category_name: Optional[str] = Field(None, description="Category name (will be resolved to ID)")
    unit_name: Optional[str] = Field(None, description="Unit name (will be resolved to ID)")
    
    # Physical properties
    weight: Optional[Decimal] = Field(None, ge=0)
    dimensions_length: Optional[Decimal] = Field(None, ge=0)
    dimensions_width: Optional[Decimal] = Field(None, ge=0)
    dimensions_height: Optional[Decimal] = Field(None, ge=0)
    color: Optional[str] = Field(None, max_length=50)
    material: Optional[str] = Field(None, max_length=100)
    
    # Business configuration
    is_rentable: bool = Field(True)
    is_salable: bool = Field(True)
    requires_serial_number: bool = Field(False)
    
    # Pricing
    cost_price: Optional[Decimal] = Field(None, ge=0)
    sale_price: Optional[Decimal] = Field(None, ge=0)
    rental_rate_per_day: Optional[Decimal] = Field(None, ge=0)
    security_deposit: Optional[Decimal] = Field(None, ge=0)
    
    # Inventory
    reorder_level: Optional[int] = Field(None, ge=0)
    maximum_stock_level: Optional[int] = Field(None, ge=0)
    
    # Status
    status: str = Field("ACTIVE")
    notes: Optional[str] = Field(None, max_length=5000)
    tags: Optional[str] = Field(None, max_length=1000)
    is_active: bool = Field(True)
    
    @field_validator('item_name')
    @classmethod
    def validate_item_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Item name cannot be empty')
        return v.strip()
    
    @field_validator('sku')
    @classmethod
    def validate_sku(cls, v):
        if v is not None:
            if not v.strip():
                raise ValueError('SKU cannot be empty if provided')
            return v.strip().upper()
        return v
    
    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        allowed_statuses = ['ACTIVE', 'INACTIVE', 'DISCONTINUED', 'OUT_OF_STOCK']
        if v not in allowed_statuses:
            raise ValueError(f'Status must be one of: {", ".join(allowed_statuses)}')
        return v
    
    def model_post_init(self, __context) -> None:
        """Validate business logic after model initialization."""
        if not self.is_rentable and not self.is_salable:
            raise ValueError('Item must be either rentable or salable (or both)')
        
        if self.cost_price and self.sale_price:
            if self.sale_price <= self.cost_price:
                raise ValueError('Sale price must be greater than cost price')


class ItemImportResult(BaseModel):
    """Schema for item import results."""
    
    total_processed: int = Field(..., description="Total number of items processed")
    successful_imports: int = Field(..., description="Number of successful imports")
    failed_imports: int = Field(..., description="Number of failed imports")
    skipped_imports: int = Field(..., description="Number of skipped imports (duplicates)")
    updated_items: int = Field(..., description="Number of updated existing items")
    errors: List[dict] = Field(..., description="List of import errors")
    warnings: List[dict] = Field(default_factory=list, description="List of import warnings")
    
    @field_validator('errors', 'warnings')
    @classmethod
    def validate_errors_warnings(cls, v):
        """Validate the structure of errors and warnings."""
        for item in v:
            if not isinstance(item, dict) or 'row' not in item or 'message' not in item:
                raise ValueError('Each error/warning must have row and message fields')
        return v


class ItemAvailabilityCheck(BaseModel):
    """Schema for checking item availability."""
    
    item_id: UUID = Field(..., description="Item ID to check")
    check_date: Optional[datetime] = Field(None, description="Date to check availability")
    quantity_needed: int = Field(1, ge=1, description="Quantity needed")


class ItemAvailabilityResponse(BaseModel):
    """Schema for item availability response."""
    
    item_id: UUID = Field(..., description="Item ID")
    item_name: str = Field(..., description="Item name")
    is_available: bool = Field(..., description="Whether item is available")
    available_quantity: int = Field(..., description="Available quantity")
    total_quantity: int = Field(..., description="Total quantity in inventory")
    reserved_quantity: int = Field(..., description="Reserved quantity")
    can_be_rented: bool = Field(..., description="Whether item can be rented")
    can_be_sold: bool = Field(..., description="Whether item can be sold")
    availability_message: str = Field(..., description="Human readable availability message")
    next_available_date: Optional[datetime] = Field(None, description="Next availability date")


class ItemPricingUpdate(BaseModel):
    """Schema for updating item pricing."""
    
    cost_price: Optional[Decimal] = Field(None, ge=0, description="New cost price")
    sale_price: Optional[Decimal] = Field(None, ge=0, description="New sale price")
    rental_rate_per_day: Optional[Decimal] = Field(None, ge=0, description="New rental rate")
    security_deposit: Optional[Decimal] = Field(None, ge=0, description="New security deposit")
    
    def model_post_init(self, __context) -> None:
        """Validate pricing relationships."""
        if self.cost_price and self.sale_price:
            if self.sale_price <= self.cost_price:
                raise ValueError('Sale price must be greater than cost price')


class ItemDuplicate(BaseModel):
    """Schema for duplicating an item."""
    
    source_item_id: UUID = Field(..., description="Source item ID to duplicate")
    new_item_name: str = Field(..., min_length=1, max_length=255, description="New item name")
    new_sku: Optional[str] = Field(None, min_length=1, max_length=50, description="New SKU")
    copy_pricing: bool = Field(True, description="Whether to copy pricing information")
    copy_inventory_settings: bool = Field(True, description="Whether to copy inventory settings")
    copy_physical_properties: bool = Field(True, description="Whether to copy physical properties")
    
    @field_validator('new_item_name')
    @classmethod
    def validate_new_item_name(cls, v):
        if not v or not v.strip():
            raise ValueError('New item name cannot be empty')
        return v.strip()
    
    @field_validator('new_sku')
    @classmethod
    def validate_new_sku(cls, v):
        if v is not None:
            if not v.strip():
                raise ValueError('New SKU cannot be empty if provided')
            return v.strip().upper()
        return v