#!/usr/bin/env python3
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine
from app.core.config import settings
from app.models.base import Base
from app.models import (
    User, Property, Tenant, Lease, Payment, MaintenanceRequest
)

def main():
    """Create all database tables using sync engine"""
    print("Creating database tables...")
    
    # Create sync engine
    engine = create_engine(settings.database_url_sync, echo=True)
    
    # Create all tables
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    
    print("✅ Database tables created successfully!")
    
    # List tables
    from sqlalchemy import inspect
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print("\nCreated tables:")
    for table in tables:
        print(f"  - {table}")


if __name__ == "__main__":
    main()