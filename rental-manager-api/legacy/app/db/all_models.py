"""
Import all models to ensure they are registered with SQLAlchemy
"""
# Base must be imported first
from app.db.base import Base

# Import all model modules - SQLAlchemy will register them automatically
from app.modules.users import models as user_models
from app.modules.auth import models as auth_models  
from app.modules.security import models as security_models
from app.modules.company import models as company_models
from app.modules.customers import models as customer_models
from app.modules.suppliers import models as supplier_models
from app.modules.system import models as system_models

# Master data
from app.modules.master_data.brands import models as brand_models
from app.modules.master_data.categories import models as category_models
from app.modules.master_data.locations import models as location_models
from app.modules.master_data.units import models as unit_models
from app.modules.master_data.item_master import models as item_models

# Inventory
from app.modules.inventory import models as inventory_models
from app.modules.inventory import damage_models

# Transactions
from app.modules.transactions.base.models import transaction_headers, transaction_lines
from app.modules.transactions.rentals.rental_booking import models as booking_models
from app.modules.transactions.rentals.rental_extension import models as extension_models

# Sales 
from app.modules.sales import models as sales_models

# Rental block history
from app.modules.inventory import rental_block_history

print(f"✓ Imported all model modules")
print(f"✓ Registered {len(Base.metadata.tables)} tables with SQLAlchemy")