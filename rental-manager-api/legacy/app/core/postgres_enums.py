"""
PostgreSQL Enum Types for SQLAlchemy models
This module defines PostgreSQL enum types that correspond to the database enum types.
"""
from sqlalchemy.dialects.postgresql import ENUM

# Customer related enums
CustomerTypeEnum = ENUM('INDIVIDUAL', 'BUSINESS', name='customer_type_enum', create_type=True)
CustomerTierEnum = ENUM('BRONZE', 'SILVER', 'GOLD', 'PLATINUM', name='customer_tier_enum', create_type=True)
CustomerStatusEnum = ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING', name='customer_status_enum', create_type=True)
BlacklistStatusEnum = ENUM('CLEAR', 'WARNING', 'BLACKLISTED', name='blacklist_status_enum', create_type=True)
CreditRatingEnum = ENUM('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'NO_RATING', name='credit_rating_enum', create_type=True)

# Supplier related enums
SupplierTypeEnum = ENUM('MANUFACTURER', 'DISTRIBUTOR', 'WHOLESALER', 'RETAILER', 'INVENTORY', 'SERVICE', 'DIRECT', name='supplier_type_enum', create_type=True)
SupplierTierEnum = ENUM('PREMIUM', 'STANDARD', 'BASIC', 'TRIAL', name='supplier_tier_enum', create_type=True)
SupplierStatusEnum = ENUM('ACTIVE', 'INACTIVE', 'PENDING', 'APPROVED', 'SUSPENDED', 'BLACKLISTED', name='supplier_status_enum', create_type=True)

# Item and location enums
ItemStatusEnum = ENUM('ACTIVE', 'INACTIVE', 'DISCONTINUED', name='item_status_enum', create_type=True)
LocationTypeEnum = ENUM('STORE', 'WAREHOUSE', 'SERVICE_CENTER', name='location_type_enum', create_type=True)