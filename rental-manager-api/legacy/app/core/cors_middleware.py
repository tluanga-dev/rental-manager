"""
Enhanced CORS Middleware for production environments
"""

from fastapi import Request
from fastapi.responses import Response
from starlette.middleware.base import BaseHTTPMiddleware
import logging
import os

logger = logging.getLogger(__name__)

class EnhancedCORSMiddleware(BaseHTTPMiddleware):
    """
    Enhanced CORS middleware that handles both web and mobile app requests.
    Mobile apps don't have origins, so we need to handle them specially.
    """
    
    async def dispatch(self, request: Request, call_next):
        # Check if we're in production
        is_production = (
            os.getenv("RAILWAY_ENVIRONMENT") or 
            os.getenv("ENV") == "production" or 
            os.getenv("ENVIRONMENT") == "production"
        )
        
        # Get the origin from the request
        origin = request.headers.get("origin")
        
        # Check if this is a mobile app request (no origin header)
        is_mobile_app = origin is None and request.headers.get("user-agent")
        
        # For preflight requests, return immediately with CORS headers
        if request.method == "OPTIONS":
            headers = {
                # Use wildcard for mobile apps and production, or specific origin for web
                "Access-Control-Allow-Origin": "*" if (is_production or is_mobile_app) else (origin or "*"),
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Max-Age": "3600",
            }
            return Response(content="", status_code=200, headers=headers)
        
        # Process the actual request - wrap in try/except to ensure CORS headers on errors
        try:
            response = await call_next(request)
        except Exception as e:
            # If an error occurs, create an error response with CORS headers
            logger.error(f"Error processing request: {e}")
            response = Response(
                content=f'{{"detail": "Internal server error"}}',
                status_code=500,
                media_type="application/json"
            )
        
        # Add CORS headers to all responses
        # For mobile apps or production, use wildcard; otherwise use specific origin
        if is_production or is_mobile_app:
            response.headers["Access-Control-Allow-Origin"] = "*"
        elif origin:
            response.headers["Access-Control-Allow-Origin"] = origin
        else:
            response.headers["Access-Control-Allow-Origin"] = "*"
            
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Access-Control-Expose-Headers"] = "*"
        
        # Log for debugging
        if is_mobile_app:
            logger.debug("Handled request from mobile app (no origin header)")
        else:
            logger.debug(f"Added CORS headers for origin: {origin if origin else 'any'}")
        
        return response