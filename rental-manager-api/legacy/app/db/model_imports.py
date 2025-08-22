"""
Import all models so SQLAlchemy knows about them before creating tables.
This file should be imported before any database operations.
"""

# Import base model first
from app.db.base import Base, RentalManagerBaseModel

# Import all models
from app.modules.users.models import User, UserProfile
# Auth models are in auth module
try:
    from app.modules.auth.models import RefreshToken
except ImportError:
    pass
from app.modules.security.models import SecurityAuditLog, SessionToken, IPWhitelist
from app.modules.company.models import Company
from app.modules.customers.models import Customer
from app.modules.suppliers.models import Supplier

# Master data models
from app.modules.master_data.brands.models import Brand
from app.modules.master_data.categories.models import Category
from app.modules.master_data.locations.models import Location
from app.modules.master_data.units.models import UnitOfMeasurement
from app.modules.master_data.item_master.models import Item

# Inventory models
from app.modules.inventory.models import (
    StockMovement,
    StockLevel,
    InventoryUnit,
    SKUSequence
)

# Transaction models
from app.modules.transactions.base.models import (
    TransactionHeader,
    TransactionLine
)

# Rental models
from app.modules.transactions.rentals.rental_core.models import (
    RentalLifecycle,
    RentalExtension
)

# Booking models
from app.modules.transactions.rentals.rental_booking.models import (
    BookingHeader,
    BookingLine
)

# Damage tracking
from app.modules.inventory.damage_models import DamageRecord, DamageAssessment

# Rental blocking
from app.modules.inventory.rental_block_history import RentalBlockHistory

# Sales transition models (if they exist)
try:
    from app.modules.sales.models import (
        SaleTransitionRequest,
        SaleConflict,
        SaleTransitionAudit,
        TransitionCheckpoint,
        SaleResolution,
        SaleNotification
    )
except ImportError:
    pass  # Sales module may not be fully implemented

# System models
from app.modules.system.models import SystemSettings, SystemAuditLog

print(f"Loaded {len(Base.metadata.tables)} tables into metadata")

__all__ = ['Base', 'RentalManagerBaseModel']