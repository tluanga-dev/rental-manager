"""
Enumeration types for the inventory module.

This module defines all the enumeration types used throughout the inventory system
for status tracking, movement types, and condition assessments.
"""

from enum import Enum


class ItemStatus(str, Enum):
    """Item status enumeration for tracking item availability."""
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    DISCONTINUED = "DISCONTINUED"


class InventoryUnitStatus(str, Enum):
    """
    Inventory unit status enumeration.
    Tracks the current state of individual inventory units.
    """
    AVAILABLE = "AVAILABLE"
    RENTED = "RENTED"
    SOLD = "SOLD"
    MAINTENANCE = "MAINTENANCE"
    DAMAGED = "DAMAGED"
    UNDER_REPAIR = "UNDER_REPAIR"
    BEYOND_REPAIR = "BEYOND_REPAIR"
    RETIRED = "RETIRED"
    RESERVED = "RESERVED"  # Added for reservation support


class InventoryUnitCondition(str, Enum):
    """
    Inventory unit condition enumeration.
    Describes the physical condition of inventory units.
    """
    NEW = "NEW"
    EXCELLENT = "EXCELLENT"
    GOOD = "GOOD"
    FAIR = "FAIR"
    POOR = "POOR"
    DAMAGED = "DAMAGED"


class StockMovementType(str, Enum):
    """
    Stock movement type enumeration.
    Comprehensive tracking of all inventory movements.
    """
    # Purchase related
    PURCHASE = "STOCK_MOVEMENT_PURCHASE"
    PURCHASE_RETURN = "STOCK_MOVEMENT_PURCHASE_RETURN"
    
    # Sales related
    SALE = "STOCK_MOVEMENT_SALE"
    SALE_RETURN = "STOCK_MOVEMENT_SALE_RETURN"
    
    # Rental related
    RENTAL_OUT = "STOCK_MOVEMENT_RENTAL_OUT"
    RENTAL_RETURN = "STOCK_MOVEMENT_RENTAL_RETURN"
    RENTAL_RETURN_DAMAGED = "STOCK_MOVEMENT_RENTAL_RETURN_DAMAGED"
    RENTAL_RETURN_MIXED = "STOCK_MOVEMENT_RENTAL_RETURN_MIXED"
    RENTAL_EXTENSION = "STOCK_MOVEMENT_RENTAL_EXTENSION"
    
    # Damage and repair related
    DAMAGE_ASSESSMENT = "STOCK_MOVEMENT_DAMAGE_ASSESSMENT"
    SENT_FOR_REPAIR = "STOCK_MOVEMENT_SENT_FOR_REPAIR"
    REPAIR_COMPLETED = "STOCK_MOVEMENT_REPAIR_COMPLETED"
    WRITE_OFF = "STOCK_MOVEMENT_WRITE_OFF"
    
    # Adjustments
    ADJUSTMENT_POSITIVE = "STOCK_MOVEMENT_ADJUSTMENT_POSITIVE"
    ADJUSTMENT_NEGATIVE = "STOCK_MOVEMENT_ADJUSTMENT_NEGATIVE"
    SYSTEM_CORRECTION = "STOCK_MOVEMENT_SYSTEM_CORRECTION"
    
    # Transfers
    TRANSFER_IN = "STOCK_MOVEMENT_TRANSFER_IN"
    TRANSFER_OUT = "STOCK_MOVEMENT_TRANSFER_OUT"
    
    # Reservations
    RESERVATION_CREATED = "STOCK_MOVEMENT_RESERVATION_CREATED"
    RESERVATION_CANCELLED = "STOCK_MOVEMENT_RESERVATION_CANCELLED"
    RESERVATION_EXTENDED = "STOCK_MOVEMENT_RESERVATION_EXTENDED"
    
    # Losses
    DAMAGE_LOSS = "STOCK_MOVEMENT_DAMAGE_LOSS"
    THEFT_LOSS = "STOCK_MOVEMENT_THEFT_LOSS"
    EXPIRY_LOSS = "STOCK_MOVEMENT_EXPIRY_LOSS"


class DamageType(str, Enum):
    """Types of damage that can occur to inventory items."""
    PHYSICAL = "PHYSICAL"
    WATER = "WATER"
    ELECTRICAL = "ELECTRICAL"
    WEAR_AND_TEAR = "WEAR_AND_TEAR"
    COSMETIC = "COSMETIC"
    FUNCTIONAL = "FUNCTIONAL"
    ACCIDENTAL = "ACCIDENTAL"
    VANDALISM = "VANDALISM"
    OTHER = "OTHER"


class DamageSeverity(str, Enum):
    """Severity levels for damage assessment."""
    MINOR = "MINOR"
    MODERATE = "MODERATE"
    SEVERE = "SEVERE"
    CRITICAL = "CRITICAL"
    BEYOND_REPAIR = "BEYOND_REPAIR"


class RepairStatus(str, Enum):
    """Status of repair orders for damaged inventory."""
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class QualityCheckStatus(str, Enum):
    """Quality check status for repaired or returned items."""
    PENDING = "PENDING"
    PASSED = "PASSED"
    FAILED = "FAILED"
    PARTIAL = "PARTIAL"


class StockStatus(str, Enum):
    """Overall stock status for inventory items."""
    IN_STOCK = "IN_STOCK"
    LOW_STOCK = "LOW_STOCK"
    OUT_OF_STOCK = "OUT_OF_STOCK"
    OVERSTOCKED = "OVERSTOCKED"


class ReservationStatus(str, Enum):
    """Status for inventory reservations."""
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"
    FULFILLED = "FULFILLED"


class TransferStatus(str, Enum):
    """Status for inventory transfers between locations."""
    INITIATED = "INITIATED"
    IN_TRANSIT = "IN_TRANSIT"
    RECEIVED = "RECEIVED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"


# Helper functions for enum operations

def get_movement_category(movement_type: StockMovementType) -> str:
    """
    Categorize stock movement types into broader categories.
    
    Args:
        movement_type: The stock movement type to categorize
        
    Returns:
        Category name as string
    """
    rental_types = {
        StockMovementType.RENTAL_OUT,
        StockMovementType.RENTAL_RETURN,
        StockMovementType.RENTAL_RETURN_DAMAGED,
        StockMovementType.RENTAL_RETURN_MIXED,
        StockMovementType.RENTAL_EXTENSION
    }
    
    purchase_types = {
        StockMovementType.PURCHASE,
        StockMovementType.PURCHASE_RETURN
    }
    
    sale_types = {
        StockMovementType.SALE,
        StockMovementType.SALE_RETURN
    }
    
    transfer_types = {
        StockMovementType.TRANSFER_IN,
        StockMovementType.TRANSFER_OUT
    }
    
    damage_repair_types = {
        StockMovementType.DAMAGE_ASSESSMENT,
        StockMovementType.SENT_FOR_REPAIR,
        StockMovementType.REPAIR_COMPLETED,
        StockMovementType.WRITE_OFF
    }
    
    adjustment_types = {
        StockMovementType.ADJUSTMENT_POSITIVE,
        StockMovementType.ADJUSTMENT_NEGATIVE,
        StockMovementType.SYSTEM_CORRECTION
    }
    
    loss_types = {
        StockMovementType.DAMAGE_LOSS,
        StockMovementType.THEFT_LOSS,
        StockMovementType.EXPIRY_LOSS
    }
    
    reservation_types = {
        StockMovementType.RESERVATION_CREATED,
        StockMovementType.RESERVATION_CANCELLED,
        StockMovementType.RESERVATION_EXTENDED
    }
    
    if movement_type in rental_types:
        return "RENTAL"
    elif movement_type in purchase_types:
        return "PURCHASE"
    elif movement_type in sale_types:
        return "SALE"
    elif movement_type in transfer_types:
        return "TRANSFER"
    elif movement_type in damage_repair_types:
        return "DAMAGE_REPAIR"
    elif movement_type in adjustment_types:
        return "ADJUSTMENT"
    elif movement_type in loss_types:
        return "LOSS"
    elif movement_type in reservation_types:
        return "RESERVATION"
    else:
        return "OTHER"


def is_positive_movement(movement_type: StockMovementType) -> bool:
    """
    Check if a movement type increases inventory.
    
    Args:
        movement_type: The stock movement type to check
        
    Returns:
        True if movement increases inventory, False otherwise
    """
    positive_types = {
        StockMovementType.PURCHASE,
        StockMovementType.SALE_RETURN,
        StockMovementType.RENTAL_RETURN,
        StockMovementType.REPAIR_COMPLETED,
        StockMovementType.ADJUSTMENT_POSITIVE,
        StockMovementType.TRANSFER_IN,
        StockMovementType.PURCHASE_RETURN  # Returns to vendor decrease our inventory
    }
    
    return movement_type in positive_types


def is_negative_movement(movement_type: StockMovementType) -> bool:
    """
    Check if a movement type decreases inventory.
    
    Args:
        movement_type: The stock movement type to check
        
    Returns:
        True if movement decreases inventory, False otherwise
    """
    negative_types = {
        StockMovementType.SALE,
        StockMovementType.RENTAL_OUT,
        StockMovementType.PURCHASE_RETURN,
        StockMovementType.DAMAGE_LOSS,
        StockMovementType.THEFT_LOSS,
        StockMovementType.EXPIRY_LOSS,
        StockMovementType.ADJUSTMENT_NEGATIVE,
        StockMovementType.TRANSFER_OUT,
        StockMovementType.WRITE_OFF,
        StockMovementType.SENT_FOR_REPAIR
    }
    
    return movement_type in negative_types


def get_acceptable_rental_conditions() -> set:
    """
    Get the set of conditions acceptable for rental.
    
    Returns:
        Set of InventoryUnitCondition values acceptable for rental
    """
    return {
        InventoryUnitCondition.NEW,
        InventoryUnitCondition.EXCELLENT,
        InventoryUnitCondition.GOOD,
        InventoryUnitCondition.FAIR
    }


def get_rentable_statuses() -> set:
    """
    Get the set of statuses that allow an item to be rented.
    
    Returns:
        Set of InventoryUnitStatus values that allow rental
    """
    return {
        InventoryUnitStatus.AVAILABLE
    }


def requires_repair_statuses() -> set:
    """
    Get the set of statuses that indicate repair is needed.
    
    Returns:
        Set of InventoryUnitStatus values requiring repair
    """
    return {
        InventoryUnitStatus.DAMAGED,
        InventoryUnitStatus.UNDER_REPAIR
    }


def get_inbound_movement_types() -> set:
    """
    Get stock movement types that increase inventory.
    
    Returns:
        Set of StockMovementType values that increase stock
    """
    return {
        StockMovementType.PURCHASE,
        StockMovementType.SALE_RETURN,
        StockMovementType.RENTAL_RETURN,
        StockMovementType.RENTAL_RETURN_DAMAGED,
        StockMovementType.RENTAL_RETURN_MIXED,
        StockMovementType.REPAIR_COMPLETED,
        StockMovementType.ADJUSTMENT_POSITIVE,
        StockMovementType.TRANSFER_IN
    }


def get_outbound_movement_types() -> set:
    """
    Get stock movement types that decrease inventory.
    
    Returns:
        Set of StockMovementType values that decrease stock
    """
    return {
        StockMovementType.SALE,
        StockMovementType.RENTAL_OUT,
        StockMovementType.PURCHASE_RETURN,
        StockMovementType.DAMAGE_LOSS,
        StockMovementType.THEFT_LOSS,
        StockMovementType.EXPIRY_LOSS,
        StockMovementType.ADJUSTMENT_NEGATIVE,
        StockMovementType.TRANSFER_OUT,
        StockMovementType.WRITE_OFF,
        StockMovementType.SENT_FOR_REPAIR
    }