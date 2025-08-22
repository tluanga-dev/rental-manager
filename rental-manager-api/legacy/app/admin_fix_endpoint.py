"""
Temporary admin endpoint to fix production database schema
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any
from app.shared.dependencies import get_session
from app.modules.auth.dependencies import get_current_user
from app.modules.users.models import User

router = APIRouter(prefix="/admin", tags=["Admin Fix"])

@router.post("/fix-items-columns")
async def fix_items_columns(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Emergency fix for missing rental blocking columns in items table
    THIS IS A TEMPORARY ENDPOINT - REMOVE AFTER USE
    """
    
    # Only allow superusers to run this
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Superuser access required")
    
    try:
        # Check existing columns
        existing_columns_query = text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'items' AND table_schema = 'public'
        AND column_name IN ('is_rental_blocked', 'rental_block_reason', 'rental_blocked_at', 'rental_blocked_by')
        """)
        
        result = await session.execute(existing_columns_query)
        existing_columns = [row[0] for row in result.fetchall()]
        
        # Define columns to add
        rental_blocking_columns = [
            'is_rental_blocked', 
            'rental_block_reason', 
            'rental_blocked_at', 
            'rental_blocked_by'
        ]
        
        missing_columns = [col for col in rental_blocking_columns if col not in existing_columns]
        
        if not missing_columns:
            return {
                "status": "success",
                "message": "All rental blocking columns already exist",
                "existing_columns": existing_columns
            }
        
        # Add missing columns
        column_ddl = {
            'is_rental_blocked': 'ALTER TABLE items ADD COLUMN IF NOT EXISTS is_rental_blocked BOOLEAN NOT NULL DEFAULT FALSE',
            'rental_block_reason': 'ALTER TABLE items ADD COLUMN IF NOT EXISTS rental_block_reason TEXT',
            'rental_blocked_at': 'ALTER TABLE items ADD COLUMN IF NOT EXISTS rental_blocked_at TIMESTAMP',
            'rental_blocked_by': 'ALTER TABLE items ADD COLUMN IF NOT EXISTS rental_blocked_by UUID'
        }
        
        added_columns = []
        
        for column_name in missing_columns:
            try:
                await session.execute(text(column_ddl[column_name]))
                added_columns.append(column_name)
            except Exception as e:
                return {
                    "status": "error",
                    "message": f"Failed to add column {column_name}: {str(e)}",
                    "added_columns": added_columns
                }
        
        # Commit changes
        await session.commit()
        
        # Verify final state
        final_result = await session.execute(existing_columns_query)
        final_columns = [row[0] for row in final_result.fetchall()]
        
        return {
            "status": "success",
            "message": "Successfully added missing rental blocking columns",
            "added_columns": added_columns,
            "final_columns": final_columns,
            "total_columns_added": len(added_columns)
        }
        
    except Exception as e:
        await session.rollback()
        return {
            "status": "error", 
            "message": f"Database fix failed: {str(e)}"
        }

@router.post("/fix-inventory-units-columns")
async def fix_inventory_units_columns(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Emergency fix for missing columns in inventory_units table
    CRITICAL: This fixes the sale_price column error
    """
    
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Superuser access required")
    
    try:
        # Check existing columns
        check_query = text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'inventory_units' 
        AND table_schema = 'public'
        """)
        
        result = await session.execute(check_query)
        existing_columns = [row[0] for row in result.fetchall()]
        
        # Define all columns that should be added
        columns_to_add = {
            'sale_price': "ALTER TABLE inventory_units ADD COLUMN IF NOT EXISTS sale_price NUMERIC(10, 2)",
            'security_deposit': "ALTER TABLE inventory_units ADD COLUMN IF NOT EXISTS security_deposit NUMERIC(10, 2) DEFAULT 0.00",
            'rental_rate_per_period': "ALTER TABLE inventory_units ADD COLUMN IF NOT EXISTS rental_rate_per_period NUMERIC(10, 2)",
            'rental_period': "ALTER TABLE inventory_units ADD COLUMN IF NOT EXISTS rental_period INTEGER DEFAULT 1",
            'model_number': "ALTER TABLE inventory_units ADD COLUMN IF NOT EXISTS model_number VARCHAR(100)",
            'warranty_period_days': "ALTER TABLE inventory_units ADD COLUMN IF NOT EXISTS warranty_period_days INTEGER DEFAULT 0",
            'batch_code': "ALTER TABLE inventory_units ADD COLUMN IF NOT EXISTS batch_code VARCHAR(50)",
            'quantity': "ALTER TABLE inventory_units ADD COLUMN IF NOT EXISTS quantity NUMERIC(10, 2) DEFAULT 1.00",
            'remarks': "ALTER TABLE inventory_units ADD COLUMN IF NOT EXISTS remarks TEXT",
            'is_rental_blocked': "ALTER TABLE inventory_units ADD COLUMN IF NOT EXISTS is_rental_blocked BOOLEAN DEFAULT FALSE",
            'rental_block_reason': "ALTER TABLE inventory_units ADD COLUMN IF NOT EXISTS rental_block_reason TEXT",
            'rental_blocked_at': "ALTER TABLE inventory_units ADD COLUMN IF NOT EXISTS rental_blocked_at TIMESTAMP",
            'rental_blocked_by': "ALTER TABLE inventory_units ADD COLUMN IF NOT EXISTS rental_blocked_by UUID"
        }
        
        # Add missing columns
        added_columns = []
        skipped_columns = []
        failed_columns = []
        
        for col_name, ddl in columns_to_add.items():
            if col_name in existing_columns:
                skipped_columns.append(col_name)
                continue
            
            try:
                await session.execute(text(ddl))
                added_columns.append(col_name)
            except Exception as col_error:
                failed_columns.append(f"{col_name}: {str(col_error)}")
        
        # Commit changes
        await session.commit()
        
        # Verify sale_price column exists
        verify_query = text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'inventory_units' 
        AND column_name = 'sale_price'
        """)
        
        verify_result = await session.execute(verify_query)
        sale_price_exists = verify_result.fetchone() is not None
        
        return {
            "status": "success" if sale_price_exists else "partial",
            "message": f"Added {len(added_columns)} columns",
            "added_columns": added_columns,
            "skipped_columns": skipped_columns,
            "failed_columns": failed_columns,
            "sale_price_exists": sale_price_exists,
            "fix_complete": sale_price_exists
        }
        
    except Exception as e:
        await session.rollback()
        return {
            "status": "error",
            "message": f"Fix failed: {str(e)}"
        }