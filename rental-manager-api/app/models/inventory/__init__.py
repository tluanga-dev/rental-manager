"""
Inventory Models Package.

This package contains all the database models for the inventory management system.
"""

from app.models.inventory.enums import (
    ItemStatus,
    InventoryUnitStatus,
    InventoryUnitCondition,
    StockMovementType,
    DamageType,
    DamageSeverity,
    RepairStatus,
    QualityCheckStatus,
    StockStatus,
    ReservationStatus,
    TransferStatus,
    get_movement_category,
    is_positive_movement,
    is_negative_movement,
    get_acceptable_rental_conditions,
    get_rentable_statuses,
    requires_repair_statuses
)

from app.models.inventory.stock_movement import StockMovement
from app.models.inventory.stock_level import StockLevel
from app.models.inventory.inventory_unit import InventoryUnit
from app.models.inventory.sku_sequence import SKUSequence

__all__ = [
    # Enums
    "ItemStatus",
    "InventoryUnitStatus",
    "InventoryUnitCondition",
    "StockMovementType",
    "DamageType",
    "DamageSeverity",
    "RepairStatus",
    "QualityCheckStatus",
    "StockStatus",
    "ReservationStatus",
    "TransferStatus",
    
    # Enum helpers
    "get_movement_category",
    "is_positive_movement",
    "is_negative_movement",
    "get_acceptable_rental_conditions",
    "get_rentable_statuses",
    "requires_repair_statuses",
    
    # Models
    "StockMovement",
    "StockLevel",
    "InventoryUnit",
    "SKUSequence",
]