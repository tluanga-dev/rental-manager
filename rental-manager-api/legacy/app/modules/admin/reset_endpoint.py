"""
TEMPORARY RESET ENDPOINT - DELETE AFTER USE!
This creates an endpoint to reset production data.
"""

from fastapi import APIRouter, HTTPException, Query
import subprocess
import os
from datetime import datetime

router = APIRouter()

@router.get("/reset-production-now")
async def reset_production_data(
    confirm: str = Query(..., description="Must be 'DELETE-ALL-DATA-NOW'"),
    token: str = Query(..., description="Security token")
):
    """
    Reset production data - DANGEROUS!
    
    Usage: 
    /api/admin/reset-production-now?confirm=DELETE-ALL-DATA-NOW&token=your-secret-token
    """
    
    # Security check
    expected_token = os.getenv("RESET_TOKEN", "reset2024admin")
    if token != expected_token:
        raise HTTPException(status_code=403, detail="Invalid token")
    
    if confirm != "DELETE-ALL-DATA-NOW":
        raise HTTPException(
            status_code=400, 
            detail="Invalid confirmation. Must be 'DELETE-ALL-DATA-NOW'"
        )
    
    try:
        # Log the reset attempt
        print(f"PRODUCTION RESET INITIATED at {datetime.now()}")
        
        # Run the reset script
        result = subprocess.run(
            ["python", "scripts/reset_railway_production.py", "--production-reset", "--seed-master-data"],
            input="DELETE ALL DATA\n",
            text=True,
            capture_output=True,
            timeout=60,
            cwd="/app"
        )
        
        if result.returncode == 0:
            return {
                "success": True,
                "message": "Production data reset successfully",
                "timestamp": datetime.now().isoformat(),
                "details": "All data cleared and reinitialized with admin user"
            }
        else:
            return {
                "success": False,
                "message": "Reset failed - check logs",
                "error": result.stderr[-500:] if result.stderr else "Unknown error"
            }
            
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "message": "Reset timeout - operation may still be running"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")