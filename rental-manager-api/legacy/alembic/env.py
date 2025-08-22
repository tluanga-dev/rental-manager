import asyncio
import os
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context

# Add project root to path
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import your models here to ensure they are registered with SQLAlchemy
from app.db.base import Base, UUIDType
from app.core.config import settings

# Import UUIDType for migration compatibility
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import all models to ensure they are registered
from app.modules.company.models import Company
from app.modules.customers.models import Customer
from app.modules.inventory.models import (
    InventoryUnit,
    SKUSequence,
    StockLevel
)
from app.modules.inventory.rental_block_history import RentalBlockHistory
# Import damage tracking models
from app.modules.inventory.damage_models import (
    DamageAssessment,
    RepairOrder,
    ReturnLineDetails
)
from app.modules.master_data.brands.models import Brand
from app.modules.master_data.categories.models import Category
from app.modules.master_data.item_master.models import Item
from app.modules.master_data.locations.models import Location
from app.modules.master_data.units.models import UnitOfMeasurement
from app.modules.suppliers.models import Supplier
from app.modules.system.models import (
    AuditLog,
    SystemBackup,
    SystemSetting
)
from app.modules.transactions.base.models.events import TransactionEvent
from app.modules.transactions.base.models.inspections import (
    PurchaseCreditMemo,
    RentalInspection
)
from app.modules.transactions.base.models.metadata import TransactionMetadata
from app.modules.transactions.base.models.rental_lifecycle import (
    RentalItemInspection,
    RentalLifecycle,
    RentalReturnEvent,
    RentalStatusLog
)
from app.modules.transactions.base.models.transaction_headers import TransactionHeader
from app.modules.transactions.base.models.transaction_lines import TransactionLine
# Import rental extension and booking models
try:
    from app.modules.transactions.rentals.rental_booking.models import BookingHeader, BookingLine
except ImportError:
    pass
try:
    from app.modules.transactions.rentals.rental_extension.models import RentalExtension, RentalExtensionLine
except ImportError:
    pass
# Import auth and user models  
from app.modules.auth.models import RefreshToken, LoginAttempt, PasswordResetToken, Role, Permission
from app.modules.users.models import User, UserProfile
# Import security models
from app.modules.security.models import SecurityAuditLog, SessionToken, IPWhitelist
# Import sales transition models
from app.modules.sales.models import (
    SaleTransitionRequest, SaleConflict, SaleResolution,
    SaleNotification, TransitionCheckpoint, SaleTransitionAudit
)

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def get_url():
    """Get database URL from environment or config"""
    return settings.DATABASE_URL


def render_item(type_, obj, autogen_context):
    """Render items for migration templates"""
    # Import here to avoid circular imports
    from app.db.base import UUIDType
    
    if type_ == "type" and hasattr(obj, "__class__"):
        if obj.__class__.__name__ == "UUIDType":
            # Make UUIDType available in migration context by importing from app.db.base
            autogen_context.imports.add("from app.db.base import UUIDType")
            return "UUIDType()"
    
    return False


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_item=render_item,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Run migrations with database connection"""
    context.configure(
        connection=connection, 
        target_metadata=target_metadata,
        render_item=render_item,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in async mode"""
    connectable = create_async_engine(
        get_url(),
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()