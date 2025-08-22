from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict, field_validator, computed_field, model_validator
from uuid import UUID

from app.modules.master_data.item_master.models import ItemStatus


# Nested relationship schemas
class BrandNested(BaseModel):
    """Nested brand information for item responses."""

    id: UUID
    name: str

    model_config = ConfigDict(from_attributes=True)


class CategoryNested(BaseModel):
    """Nested category information for item responses."""

    id: UUID
    name: str

    model_config = ConfigDict(from_attributes=True)


class UnitOfMeasurementNested(BaseModel):
    """Nested unit of measurement information for item responses."""

    id: UUID
    name: str
    code: Optional[str] = Field(None, description="Unit code/code")

    model_config = ConfigDict(from_attributes=True)


class ItemCreate(BaseModel):
    """Schema for creating a new item."""

    model_config = ConfigDict(protected_namespaces=())

    item_name: str = Field(..., max_length=200, description="Item name")
    item_status: ItemStatus = Field(default=ItemStatus.ACTIVE, description="Item status")
    brand_id: Optional[UUID] = Field(None, description="Brand ID")
    category_id: Optional[UUID] = Field(None, description="Category ID")
    unit_of_measurement_id: UUID = Field(..., description="Unit of measurement ID")
    rental_rate_per_period: Optional[Decimal] = Field(
        None, description="Rental rate per period"
    )
    rental_period: int = Field(
        default=1, description="Rental period (number of periods)", ge=1
    )
    sale_price: Optional[Decimal] = Field(None, description="Sale price")
    purchase_price: Optional[Decimal] = Field(None, description="Purchase price")
    initial_stock_quantity: Optional[int] = Field(
        None, description="Initial stock quantity (only for creation)"
    )
    security_deposit: Decimal = Field(default=Decimal("0.00"), description="Security deposit")
    description: Optional[str] = Field(None, description="Item description")
    specifications: Optional[str] = Field(None, description="Item specifications")
    model_number: Optional[str] = Field(None, max_length=100, description="Model number")
    serial_number_required: bool = Field(default=False, description="Serial number required")
    warranty_period_days: int = Field(default=0, description="Warranty period in days", ge=0)
    reorder_point: int = Field(..., description="Reorder point threshold (mandatory)")
    is_rentable: bool = Field(default=True, description="Item can be rented")
    is_saleable: bool = Field(default=False, description="Item can be sold")

    @field_validator("rental_period")
    @classmethod
    def validate_rental_period(cls, v):
        if v is not None:
            if not isinstance(v, int) or v <= 0:
                raise ValueError("Rental period must be a positive integer")
        return v

    @field_validator("warranty_period_days")
    @classmethod
    def validate_warranty_period(cls, v):
        if v is not None:
            if not isinstance(v, int) or v < 0:
                raise ValueError("Warranty period must be a non-negative integer")
        return v

    @field_validator("is_saleable")
    @classmethod
    def validate_boolean_exclusion(cls, v, info):
        """Validate that is_rentable and is_saleable are mutually exclusive."""
        is_rentable = info.data.get("is_rentable", True)  # Default value

        if v and is_rentable:
            raise ValueError(
                "Item cannot be both rentable and saleable - these are mutually exclusive"
            )

        if not v and not is_rentable:
            raise ValueError("Item must be either rentable or saleable")

        return v


class ItemUpdate(BaseModel):
    """Schema for updating an item."""

    model_config = ConfigDict(protected_namespaces=())

    item_name: Optional[str] = Field(None, max_length=200, description="Item name")
    item_status: Optional[ItemStatus] = Field(None, description="Item status")
    brand_id: Optional[UUID] = Field(None, description="Brand ID")
    category_id: Optional[UUID] = Field(None, description="Category ID")
    unit_of_measurement_id: Optional[UUID] = Field(None, description="Unit of measurement ID")
    rental_rate_per_period: Optional[Decimal] = Field(
        None, description="Rental rate per period"
    )
    rental_period: Optional[int] = Field(None, description="Rental period (number of periods)", ge=1)
    sale_price: Optional[Decimal] = Field(None, description="Sale price")
    purchase_price: Optional[Decimal] = Field(None, description="Purchase price")
    security_deposit: Optional[Decimal] = Field(None, description="Security deposit")
    description: Optional[str] = Field(None, description="Item description")
    specifications: Optional[str] = Field(None, description="Item specifications")
    model_number: Optional[str] = Field(None, max_length=100, description="Model number")
    serial_number_required: Optional[bool] = Field(None, description="Serial number required")
    warranty_period_days: Optional[int] = Field(None, description="Warranty period in days", ge=0)
    reorder_point: Optional[int] = Field(None, description="Reorder point threshold")
    is_rentable: Optional[bool] = Field(None, description="Item can be rented")
    is_saleable: Optional[bool] = Field(None, description="Item can be sold")

    @field_validator("warranty_period_days", "rental_period")
    @classmethod
    def validate_numeric_string(cls, v):
        if v is not None and v != "":
            try:
                int(v)
            except ValueError:
                raise ValueError("Must be a valid number")
        return v

    @model_validator(mode="after")
    def validate_boolean_fields(self):
        """Validate boolean field combinations for updates."""
        if self.is_rentable is not None and self.is_saleable is not None:
            if self.is_rentable and self.is_saleable:
                raise ValueError(
                    "Item cannot be both rentable and saleable - these are mutually exclusive"
                )
            if not self.is_rentable and not self.is_saleable:
                raise ValueError("Item must be either rentable or saleable")
        return self


class ItemResponse(BaseModel):
    """Schema for item response."""

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: UUID
    sku: str
    item_name: str
    item_status: ItemStatus
    brand_id: Optional[UUID]
    category_id: Optional[UUID]
    unit_of_measurement_id: UUID
    rental_rate_per_period: Optional[Decimal]
    rental_period: int
    sale_price: Optional[Decimal]
    purchase_price: Optional[Decimal]
    security_deposit: Decimal
    description: Optional[str]
    specifications: Optional[str]
    model_number: Optional[str]
    serial_number_required: bool
    warranty_period_days: int
    reorder_point: int
    is_rentable: bool
    is_saleable: bool
    is_active: Optional[bool] = True
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def display_name(self) -> str:
        return f"{self.item_name} ({self.sku})"

    @computed_field
    @property
    def is_rental_item(self) -> bool:
        return self.is_rentable

    @computed_field
    @property
    def is_sale_item(self) -> bool:
        return self.is_saleable


class ItemListResponse(BaseModel):
    """Schema for item list response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    sku: str
    item_name: str
    item_status: ItemStatus
    brand_id: Optional[UUID]
    category_id: Optional[UUID]
    unit_of_measurement_id: Optional[UUID]
    rental_rate_per_period: Optional[Decimal]
    sale_price: Optional[Decimal]
    purchase_price: Optional[Decimal]
    is_rentable: bool
    is_saleable: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def display_name(self) -> str:
        return f"{self.item_name} ({self.sku})"


class ItemWithInventoryResponse(BaseModel):
    """Schema for item response with inventory details."""

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: UUID
    sku: str
    item_name: str
    item_status: ItemStatus
    brand_id: Optional[UUID]
    category_id: Optional[UUID]
    unit_of_measurement_id: UUID
    rental_rate_per_period: Optional[Decimal]
    rental_period: int
    sale_price: Optional[Decimal]
    purchase_price: Optional[Decimal]
    security_deposit: Decimal
    description: Optional[str]
    specifications: Optional[str]
    model_number: Optional[str]
    serial_number_required: bool
    warranty_period_days: int
    reorder_point: int
    is_rentable: bool
    is_saleable: bool
    is_active: Optional[bool] = True
    created_at: datetime
    updated_at: datetime

    # Inventory summary fields
    total_inventory_units: int = Field(default=0, description="Total number of inventory units")
    available_units: int = Field(default=0, description="Number of available units")
    rented_units: int = Field(default=0, description="Number of rented units")

    @computed_field
    @property
    def display_name(self) -> str:
        return f"{self.item_name} ({self.sku})"

    @computed_field
    @property
    def is_rental_item(self) -> bool:
        return self.is_rentable

    @computed_field
    @property
    def is_sale_item(self) -> bool:
        return self.is_saleable
    
    @computed_field
    @property
    def stock_status(self) -> str:
        if self.available_units == 0:
            return "OUT_OF_STOCK"
        # Ensure reorder_point is converted to int for comparison
        reorder_point_int = int(self.reorder_point) if isinstance(self.reorder_point, str) else self.reorder_point
        if self.available_units <= reorder_point_int:
            return "LOW_STOCK"
        else:
            return "IN_STOCK"
    
    @computed_field
    @property
    def needs_reorder(self) -> bool:
        # Ensure reorder_point is converted to int for comparison
        reorder_point_int = int(self.reorder_point) if isinstance(self.reorder_point, str) else self.reorder_point
        return self.available_units <= reorder_point_int


# New nested response schema as requested by user
class ItemNestedResponse(BaseModel):
    """Schema for item response with nested relationship objects."""

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    # Basic fields with ID and SKU included
    id: UUID
    sku: str = Field(..., description="Stock Keeping Unit")
    item_name: str
    item_status: ItemStatus

    # Nested relationship objects
    brand_id: Optional[BrandNested] = Field(None, description="Brand information")
    category_id: Optional[CategoryNested] = Field(None, description="Category information")
    unit_of_measurement_id: UnitOfMeasurementNested = Field(
        ..., description="Unit of measurement information"
    )

    # Other fields
    rental_rate_per_period: Optional[Decimal] = Field(default=Decimal("0"))
    rental_period: int = Field(default=1)
    sale_price: Optional[Decimal] = Field(default=Decimal("0"))
    purchase_price: Optional[Decimal] = Field(default=Decimal("0"))
    initial_stock_quantity: Optional[int] = Field(default=0)
    security_deposit: Decimal = Field(default=Decimal("0"))
    description: Optional[str]
    specifications: Optional[str]
    model_number: Optional[str]
    serial_number_required: bool = Field(default=False)
    warranty_period_days: int = Field(default=0)
    reorder_point: int = Field(default=0)
    is_rentable: bool = Field(default=True)
    is_saleable: bool = Field(default=False)


# SKU-specific schemas
class SKUGenerationRequest(BaseModel):
    """Schema for SKU generation request."""

    category_id: Optional[UUID] = Field(None, description="Category ID for SKU generation")
    item_name: str = Field(..., description="Item name for product code generation")
    is_rentable: bool = Field(default=True, description="Item can be rented")
    is_saleable: bool = Field(default=False, description="Item can be sold")


class SKUGenerationResponse(BaseModel):
    """Schema for SKU generation response."""

    sku: str = Field(..., description="Generated SKU")
    category_code: str = Field(..., description="Category code used")
    subcategory_code: str = Field(..., description="Subcategory code used")
    product_code: str = Field(..., description="Product code (first 4 letters of item name)")
    attributes_code: str = Field(..., description="Attributes code (R/S/B)")
    sequence_number: int = Field(..., description="Sequence number used")


class SKUBulkGenerationResponse(BaseModel):
    """Schema for bulk SKU generation response."""

    total_processed: int = Field(..., description="Total items processed")
    successful_generations: int = Field(..., description="Number of successful generations")
    failed_generations: int = Field(..., description="Number of failed generations")
    errors: List[dict] = Field(default_factory=list, description="Generation errors")


# Enhanced response schemas with relationship data
class BrandInfo(BaseModel):
    """Brand information for item response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str  # Changed from brand_name to match model
    code: Optional[str] = None  # Changed from brand_code to match model
    description: Optional[str] = None


class CategoryInfo(BaseModel):
    """Category information for item response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str  # Changed from category_name to match model
    category_path: Optional[str] = None
    category_level: Optional[int] = None  # Changed from level to match model


class UnitInfo(BaseModel):
    """Unit of measurement information for item response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str  # Changed from unit_name to match model
    code: Optional[str] = None


class ItemWithRelationsResponse(BaseModel):
    """Enhanced schema for item response with relationship data."""

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    # Basic item fields
    id: UUID
    sku: str
    item_name: str
    item_status: ItemStatus
    brand_id: Optional[UUID]
    category_id: Optional[UUID]
    unit_of_measurement_id: UUID
    rental_rate_per_period: Optional[Decimal]
    rental_period: int
    sale_price: Optional[Decimal]
    purchase_price: Optional[Decimal]
    security_deposit: Decimal
    description: Optional[str]
    specifications: Optional[str]
    model_number: Optional[str]
    serial_number_required: bool
    warranty_period_days: int
    reorder_point: int
    is_rentable: bool
    is_saleable: bool
    is_active: Optional[bool] = True
    created_at: datetime
    updated_at: datetime

    # Relationship data
    brand: Optional[BrandInfo] = None
    category: Optional[CategoryInfo] = None
    unit_of_measurement: Optional[UnitInfo] = None

    # Inventory summary fields
    total_units: int = Field(default=0, description="Total number of inventory units")
    available_units: int = Field(default=0, description="Number of available units")
    rented_units: int = Field(default=0, description="Number of rented units")

    @computed_field
    @property
    def display_name(self) -> str:
        return f"{self.item_name} ({self.sku})"

    @computed_field
    @property
    def brand_name(self) -> Optional[str]:
        return self.brand.name if self.brand else None  # Changed to use .name

    @computed_field
    @property
    def brand_code(self) -> Optional[str]:
        return self.brand.code if self.brand else None  # Changed to use .code

    @computed_field
    @property
    def category_name(self) -> Optional[str]:
        return self.category.name if self.category else None  # Changed to use .name

    @computed_field
    @property
    def category_path(self) -> Optional[str]:
        return self.category.category_path if self.category else None

    @computed_field
    @property
    def unit_name(self) -> Optional[str]:
        return self.unit_of_measurement.name if self.unit_of_measurement else None  # Changed to use .name

    @computed_field
    @property
    def unit_code(self) -> Optional[str]:
        return self.unit_of_measurement.code if self.unit_of_measurement else None

    @computed_field
    @property
    def is_rental_item(self) -> bool:
        return self.is_rentable

    @computed_field
    @property
    def is_sale_item(self) -> bool:
        return self.is_saleable


class ItemListWithRelationsResponse(BaseModel):
    """Enhanced schema for item list response with relationship data (lightweight)."""

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    # Basic item fields
    id: UUID
    sku: str
    item_name: str
    item_status: ItemStatus
    brand_id: Optional[UUID]
    category_id: Optional[UUID]
    unit_of_measurement_id: UUID
    rental_rate_per_period: Optional[Decimal]
    sale_price: Optional[Decimal]
    purchase_price: Optional[Decimal]
    is_rentable: bool
    is_saleable: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    # Relationship data (lightweight)
    brand_name: Optional[str] = None
    brand_code: Optional[str] = None
    category_name: Optional[str] = None
    category_path: Optional[str] = None
    unit_name: Optional[str] = None
    unit_code: Optional[str] = None

    # Inventory summary fields
    total_units: int = Field(default=0, description="Total number of inventory units")
    available_units: int = Field(default=0, description="Number of available units")
    rented_units: int = Field(default=0, description="Number of rented units")

    @computed_field
    @property
    def display_name(self) -> str:
        return f"{self.item_name} ({self.sku})"
