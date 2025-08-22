"""
CORS Test Endpoint
"""

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
import os

router = APIRouter()

@router.get("/cors-test")
async def cors_test():
    """Test endpoint to verify CORS is working"""
    return JSONResponse({
        "status": "success",
        "message": "CORS is working correctly",
        "environment": os.getenv("RAILWAY_ENVIRONMENT", os.getenv("ENV", "unknown")),
        "cors_configured": True
    })

@router.options("/cors-test")
async def cors_test_options():
    """Handle preflight requests"""
    return JSONResponse({
        "status": "preflight_success"
    })

@router.get("/cors-debug")
async def cors_debug(request: Request):
    """Debug endpoint to show current CORS configuration"""
    is_production = (
        os.getenv("RAILWAY_ENVIRONMENT") or 
        os.getenv("ENV") == "production" or 
        os.getenv("ENVIRONMENT") == "production"
    )
    
    origin = request.headers.get("origin", "No origin header")
    
    return JSONResponse({
        "status": "debug_info",
        "is_production": is_production,
        "request_origin": origin,
        "environment_vars": {
            "RAILWAY_ENVIRONMENT": os.getenv("RAILWAY_ENVIRONMENT"),
            "ENV": os.getenv("ENV"),
            "ENVIRONMENT": os.getenv("ENVIRONMENT")
        },
        "cors_mode": "wildcard (*)" if is_production else "configured origins",
        "middleware_active": "EnhancedCORSMiddleware",
        "expected_headers": {
            "Access-Control-Allow-Origin": "*" if is_production else origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Expose-Headers": "*"
        }
    })