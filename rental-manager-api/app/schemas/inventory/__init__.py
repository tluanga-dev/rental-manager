"""
Inventory Schemas Package.

This package contains all Pydantic schemas for the inventory module.
"""

# Base schemas
from app.schemas.inventory.base import (
    InventoryBaseSchema,
    TimestampMixin,
    AuditMixin,
    PaginationParams,
    FilterParams,
    SortParams,
    BulkOperationResult,
    QuantityAdjustment,
    PriceUpdate,
    LocationTransfer,
    StockSummary,
    InventoryAlert
)

# Stock Movement schemas
from app.schemas.inventory.stock_movement import (
    StockMovementBase,
    StockMovementCreate,
    StockMovementUpdate,
    StockMovementResponse,
    StockMovementWithRelations,
    StockMovementFilter,
    StockMovementSummary,
    BulkStockMovementCreate,
    RentalMovementCreate,
    RentalReturnMovementCreate
)

# Stock Level schemas
from app.schemas.inventory.stock_level import (
    StockLevelBase,
    StockLevelCreate,
    StockLevelUpdate,
    StockLevelResponse,
    StockLevelWithRelations,
    StockLevelFilter,
    StockAdjustment,
    StockReservation,
    RentalOperation,
    RentalReturn,
    RepairOperation,
    StockTransfer,
    MultiLocationStock
)

# Inventory Unit schemas
from app.schemas.inventory.inventory_unit import (
    InventoryUnitBase,
    InventoryUnitCreate,
    InventoryUnitUpdate,
    InventoryUnitResponse,
    InventoryUnitWithRelations,
    InventoryUnitFilter,
    BatchInventoryUnitCreate,
    UnitStatusChange,
    UnitTransfer,
    RentalBlock,
    MaintenanceSchedule,
    UnitValuation
)

# SKU Sequence schemas
from app.schemas.inventory.sku_sequence import (
    SKUSequenceBase,
    SKUSequenceCreate,
    SKUSequenceUpdate,
    SKUSequenceResponse,
    SKUSequenceWithRelations,
    SKUGenerateRequest,
    SKUGenerateResponse,
    BulkSKUGenerateRequest,
    BulkSKUGenerateResponse,
    SKUValidationRequest,
    SKUValidationResponse
)

__all__ = [
    # Base
    "InventoryBaseSchema",
    "TimestampMixin",
    "AuditMixin",
    "PaginationParams",
    "FilterParams",
    "SortParams",
    "BulkOperationResult",
    "QuantityAdjustment",
    "PriceUpdate",
    "LocationTransfer",
    "StockSummary",
    "InventoryAlert",
    
    # Stock Movement
    "StockMovementBase",
    "StockMovementCreate",
    "StockMovementUpdate",
    "StockMovementResponse",
    "StockMovementWithRelations",
    "StockMovementFilter",
    "StockMovementSummary",
    "BulkStockMovementCreate",
    "RentalMovementCreate",
    "RentalReturnMovementCreate",
    
    # Stock Level
    "StockLevelBase",
    "StockLevelCreate",
    "StockLevelUpdate",
    "StockLevelResponse",
    "StockLevelWithRelations",
    "StockLevelFilter",
    "StockAdjustment",
    "StockReservation",
    "RentalOperation",
    "RentalReturn",
    "RepairOperation",
    "StockTransfer",
    "MultiLocationStock",
    
    # Inventory Unit
    "InventoryUnitBase",
    "InventoryUnitCreate",
    "InventoryUnitUpdate",
    "InventoryUnitResponse",
    "InventoryUnitWithRelations",
    "InventoryUnitFilter",
    "BatchInventoryUnitCreate",
    "UnitStatusChange",
    "UnitTransfer",
    "RentalBlock",
    "MaintenanceSchedule",
    "UnitValuation",
    
    # SKU Sequence
    "SKUSequenceBase",
    "SKUSequenceCreate",
    "SKUSequenceUpdate",
    "SKUSequenceResponse",
    "SKUSequenceWithRelations",
    "SKUGenerateRequest",
    "SKUGenerateResponse",
    "BulkSKUGenerateRequest",
    "BulkSKUGenerateResponse",
    "SKUValidationRequest",
    "SKUValidationResponse",
]