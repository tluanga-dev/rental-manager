"""
Admin API endpoint to fix inventory_units table missing columns
This provides a way to trigger the fix via API call
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, List
from app.shared.dependencies import get_session
from app.modules.auth.dependencies import get_current_user
from app.modules.users.models import User

router = APIRouter(prefix="/api/admin", tags=["Admin Database Fix"])

# Column definitions
INVENTORY_COLUMNS_SQL = {
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

@router.get("/check-inventory-columns")
async def check_inventory_columns(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Check which columns exist in inventory_units table
    """
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Superuser access required")
    
    try:
        # Check existing columns
        query = text("""
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'inventory_units' 
        AND table_schema = 'public'
        ORDER BY ordinal_position
        """)
        
        result = await session.execute(query)
        columns = [
            {
                "name": row[0],
                "type": row[1],
                "nullable": row[2],
                "default": row[3]
            }
            for row in result.fetchall()
        ]
        
        # Check for critical columns
        column_names = [col["name"] for col in columns]
        required_columns = list(INVENTORY_COLUMNS_SQL.keys())
        missing_columns = [col for col in required_columns if col not in column_names]
        
        return {
            "success": True,
            "total_columns": len(columns),
            "columns": columns,
            "required_columns": required_columns,
            "missing_columns": missing_columns,
            "has_sale_price": "sale_price" in column_names,
            "all_columns_present": len(missing_columns) == 0
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@router.post("/fix-inventory-columns")
async def fix_inventory_columns(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Fix missing columns in inventory_units table
    CRITICAL: This adds the sale_price column and other required columns
    """
    
    # Only allow superusers
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Superuser access required")
    
    try:
        # First check what columns exist
        check_query = text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'inventory_units' 
        AND table_schema = 'public'
        """)
        
        result = await session.execute(check_query)
        existing_columns = [row[0] for row in result.fetchall()]
        
        # Determine which columns to add
        columns_to_add = []
        for col_name in INVENTORY_COLUMNS_SQL.keys():
            if col_name not in existing_columns:
                columns_to_add.append(col_name)
        
        if not columns_to_add:
            return {
                "success": True,
                "message": "All required columns already exist",
                "existing_columns": existing_columns,
                "added_columns": [],
                "sale_price_exists": "sale_price" in existing_columns
            }
        
        # Add missing columns
        added_columns = []
        failed_columns = []
        
        for column_name in columns_to_add:
            try:
                await session.execute(text(INVENTORY_COLUMNS_SQL[column_name]))
                added_columns.append(column_name)
            except Exception as col_error:
                failed_columns.append({
                    "column": column_name,
                    "error": str(col_error)
                })
        
        # Commit the changes
        await session.commit()
        
        # Verify the columns were added
        verify_query = text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'inventory_units' 
        AND table_schema = 'public'
        AND column_name = ANY(:columns)
        """)
        
        result = await session.execute(verify_query, {"columns": columns_to_add})
        verified_columns = [row[0] for row in result.fetchall()]
        
        # Final check for sale_price
        sale_price_check = text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'inventory_units' 
        AND table_schema = 'public'
        AND column_name = 'sale_price'
        """)
        
        sale_price_result = await session.execute(sale_price_check)
        has_sale_price = sale_price_result.fetchone() is not None
        
        return {
            "success": len(failed_columns) == 0,
            "message": f"Successfully added {len(added_columns)} columns",
            "columns_to_add": columns_to_add,
            "added_columns": added_columns,
            "verified_columns": verified_columns,
            "failed_columns": failed_columns,
            "sale_price_added": "sale_price" in added_columns,
            "sale_price_exists": has_sale_price,
            "fix_complete": has_sale_price and len(failed_columns) == 0
        }
        
    except Exception as e:
        await session.rollback()
        return {
            "success": False,
            "error": f"Database fix failed: {str(e)}",
            "error_type": type(e).__name__
        }

@router.post("/force-fix-sale-price")
async def force_fix_sale_price(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Emergency endpoint to specifically fix the sale_price column
    """
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Superuser access required")
    
    try:
        # Direct SQL to add sale_price column
        await session.execute(text(
            "ALTER TABLE inventory_units ADD COLUMN IF NOT EXISTS sale_price NUMERIC(10, 2)"
        ))
        
        # Also add other critical columns
        critical_fixes = [
            "ALTER TABLE inventory_units ADD COLUMN IF NOT EXISTS security_deposit NUMERIC(10, 2) DEFAULT 0.00",
            "ALTER TABLE inventory_units ADD COLUMN IF NOT EXISTS rental_rate_per_period NUMERIC(10, 2)",
            "ALTER TABLE inventory_units ADD COLUMN IF NOT EXISTS batch_code VARCHAR(50)",
            "ALTER TABLE inventory_units ADD COLUMN IF NOT EXISTS quantity NUMERIC(10, 2) DEFAULT 1.00"
        ]
        
        for sql in critical_fixes:
            try:
                await session.execute(text(sql))
            except:
                pass  # Column might already exist
        
        await session.commit()
        
        # Verify
        check = await session.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'inventory_units' AND column_name = 'sale_price'"
        ))
        
        exists = check.fetchone() is not None
        
        return {
            "success": exists,
            "message": "sale_price column added successfully" if exists else "Failed to add sale_price column",
            "sale_price_exists": exists
        }
        
    except Exception as e:
        await session.rollback()
        return {
            "success": False,
            "error": str(e)
        }