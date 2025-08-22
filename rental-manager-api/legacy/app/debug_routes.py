"""
Debug routes for checking database table status and rental return functionality.
These endpoints help verify that the return_line_details table exists after deployment.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Dict, Any
from app.core.database import get_db

debug_router = APIRouter(prefix="/debug", tags=["Debug"])

@debug_router.get("/tables")
async def check_tables(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """Check if required database tables exist, especially return_line_details."""
    
    required_tables = [
        'users',
        'transaction_headers', 
        'transaction_lines',
        'damage_assessments',
        'repair_orders',
        'return_line_details'  # This was the missing table causing 500 errors
    ]
    
    results = {
        "status": "checking",
        "tables": {},
        "summary": {},
        "return_line_details": {},
        "fix_applied": False
    }
    
    try:
        # Check each table
        existing_tables = []
        missing_tables = []
        
        for table in required_tables:
            result = await db.execute(text(f"""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = '{table}'
                );
            """))
            exists = result.scalar()
            
            if exists:
                results["tables"][table] = "exists"
                existing_tables.append(table)
            else:
                results["tables"][table] = "missing"
                missing_tables.append(table)
        
        # Summary
        results["summary"] = {
            "total_checked": len(required_tables),
            "existing": len(existing_tables), 
            "missing": len(missing_tables),
            "existing_tables": existing_tables,
            "missing_tables": missing_tables,
            "all_exist": len(missing_tables) == 0
        }
        
        # Special focus on return_line_details (the problematic table)
        if "return_line_details" in existing_tables:
            # Get detailed info about the table
            result = await db.execute(text("""
                SELECT COUNT(*) FROM information_schema.columns 
                WHERE table_name = 'return_line_details';
            """))
            column_count = result.scalar()
            
            result = await db.execute(text("SELECT COUNT(*) FROM return_line_details;"))
            record_count = result.scalar()
            
            # Test table accessibility
            try:
                await db.execute(text("SELECT 1 FROM return_line_details LIMIT 1;"))
                accessible = True
            except Exception:
                accessible = False
            
            results["return_line_details"] = {
                "exists": True,
                "columns": column_count,
                "records": record_count,
                "accessible": accessible,
                "status": "✅ READY - Rental returns should work",
                "error_resolved": True
            }
            results["fix_applied"] = True
            
        else:
            results["return_line_details"] = {
                "exists": False,
                "status": "❌ MISSING - This causes 500 errors during rental returns",
                "error": "Table not found in database",
                "solution": "Redeploy application - startup script will create the table",
                "error_resolved": False
            }
        
        results["status"] = "success"
        
        # Overall health check
        if results["fix_applied"]:
            results["health"] = "✅ HEALTHY - Rental return fix is applied"
        else:
            results["health"] = "❌ UNHEALTHY - return_line_details table missing"
        
        return results
        
    except Exception as e:
        results["status"] = "error" 
        results["error"] = str(e)
        results["health"] = "❌ ERROR - Cannot check database tables"
        return results

@debug_router.get("/rental-return-test")
async def test_rental_return_models(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """Test if rental return models can be imported and used."""
    
    results = {
        "status": "testing",
        "models": {},
        "table_check": {},
        "service_check": {}
    }
    
    try:
        # Test model imports
        from app.modules.inventory.damage_models import ReturnLineDetails, DamageAssessment, RepairOrder
        from app.modules.transactions.rentals.rental_return.service import RentalReturnService
        from app.modules.transactions.rentals.rental_return.schemas import RentalReturnRequest, ItemReturnRequest
        
        results["models"] = {
            "ReturnLineDetails": "✅ Imported successfully",
            "DamageAssessment": "✅ Imported successfully", 
            "RepairOrder": "✅ Imported successfully",
            "RentalReturnService": "✅ Imported successfully",
            "ReturnSchemas": "✅ Imported successfully"
        }
        
        # Test table existence for model
        result = await db.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'return_line_details'
            );
        """))
        table_exists = result.scalar()
        
        results["table_check"] = {
            "return_line_details": "✅ EXISTS" if table_exists else "❌ MISSING",
            "model_table_match": table_exists
        }
        
        # Test service instantiation
        try:
            service = RentalReturnService()
            results["service_check"] = {
                "instantiation": "✅ Service can be created",
                "ready": True
            }
        except Exception as e:
            results["service_check"] = {
                "instantiation": f"❌ Service creation failed: {e}",
                "ready": False
            }
        
        results["status"] = "success"
        
        # Overall assessment
        if table_exists and results["service_check"]["ready"]:
            results["assessment"] = "✅ READY - Rental return functionality should work correctly"
        elif table_exists:
            results["assessment"] = "⚠️ PARTIAL - Table exists but service issues"
        else:
            results["assessment"] = "❌ NOT READY - Missing database table"
        
        return results
        
    except Exception as e:
        results["status"] = "error"
        results["error"] = str(e)
        results["assessment"] = f"❌ ERROR - Cannot test models: {e}"
        return results

@debug_router.get("/health")
async def debug_health_check() -> Dict[str, Any]:
    """Simple health check for the debug endpoints."""
    
    return {
        "status": "healthy",
        "service": "rental-manager-backend", 
        "debug_endpoints": {
            "/debug/tables": "Check database table status",
            "/debug/rental-return-test": "Test rental return functionality",
            "/debug/health": "This health check endpoint"
        },
        "message": "Debug endpoints are working correctly"
    }