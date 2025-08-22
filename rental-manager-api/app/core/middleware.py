"""
Custom middleware for whitelist enforcement and security.
"""

import logging
import time
from typing import Callable, Dict, Any
from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.whitelist import whitelist_manager

logger = logging.getLogger(__name__)


class WhitelistMiddleware(BaseHTTPMiddleware):
    """Middleware to enforce whitelist rules for API endpoints."""
    
    def __init__(self, app: ASGIApp, enabled: bool = True):
        super().__init__(app)
        self.enabled = enabled
        self.rate_limiter: Dict[str, Dict[str, Any]] = {}
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request through whitelist rules."""
        
        if not self.enabled:
            return await call_next(request)
        
        start_time = time.time()
        
        try:
            # Check CORS origin if present
            origin = request.headers.get("origin")
            if origin and not whitelist_manager.is_origin_allowed(origin):
                logger.warning(f"Blocked request from disallowed origin: {origin}")
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={"detail": "Origin not allowed"}
                )
            
            # Get the request path
            path = request.url.path
            
            # Check rate limiting
            if self._is_rate_limited(request, path):
                logger.warning(f"Rate limit exceeded for {request.client.host} on {path}")
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "Rate limit exceeded"}
                )
            
            # Process the request
            response = await call_next(request)
            
            # Add security headers
            response = self._add_security_headers(response)
            
            # Log request details
            process_time = time.time() - start_time
            self._log_request(request, response, process_time)
            
            return response
            
        except Exception as e:
            logger.error(f"Error in WhitelistMiddleware: {e}")
            return await call_next(request)
    
    def _is_rate_limited(self, request: Request, path: str) -> bool:
        """Check if request should be rate limited."""
        client_ip = request.client.host if request.client else "unknown"
        
        # Determine rate limit type based on path
        endpoint_type = "auth" if "/auth/" in path else "default"
        rate_config = whitelist_manager.get_rate_limit(endpoint_type)
        
        # Simple in-memory rate limiting (in production, use Redis)
        rate_key = f"{client_ip}:{endpoint_type}"
        current_time = time.time()
        
        if rate_key not in self.rate_limiter:
            self.rate_limiter[rate_key] = {
                "requests": 1,
                "window_start": current_time
            }
            return False
        
        limiter_data = self.rate_limiter[rate_key]
        time_window = rate_config.get("period", 60)
        max_requests = rate_config.get("requests", 100)
        
        # Reset window if expired
        if current_time - limiter_data["window_start"] > time_window:
            self.rate_limiter[rate_key] = {
                "requests": 1,
                "window_start": current_time
            }
            return False
        
        # Check if over limit
        if limiter_data["requests"] >= max_requests:
            return True
        
        # Increment counter
        limiter_data["requests"] += 1
        return False
    
    def _add_security_headers(self, response: Response) -> Response:
        """Add security headers to response."""
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Add HSTS in production (commented out for development)
        # if whitelist_manager.should_require_https():
        #     response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        return response
    
    def _log_request(self, request: Request, response: Response, process_time: float):
        """Log request details."""
        client_ip = request.client.host if request.client else "unknown"
        
        # Log basic request info
        logger.info(
            f"{request.method} {request.url.path} - "
            f"{response.status_code} - {process_time:.3f}s - "
            f"IP: {client_ip}"
        )
        
        # Log slow requests
        if process_time > 1.0:  # Slow request threshold
            logger.warning(
                f"Slow request: {request.method} {request.url.path} - "
                f"{process_time:.3f}s - IP: {client_ip}"
            )


class CORSMiddleware(BaseHTTPMiddleware):
    """Custom CORS middleware with whitelist integration."""
    
    def __init__(
        self,
        app: ASGIApp,
        allow_origins: list = None,
        allow_methods: list = None,
        allow_headers: list = None,
        allow_credentials: bool = True,
    ):
        super().__init__(app)
        self.allow_origins = allow_origins or []
        self.allow_methods = allow_methods or ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
        self.allow_headers = allow_headers or ["*"]
        self.allow_credentials = allow_credentials
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Handle CORS for requests."""
        origin = request.headers.get("origin")
        
        # Handle preflight requests
        if request.method == "OPTIONS":
            response = Response()
            if origin and whitelist_manager.is_origin_allowed(origin):
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Methods"] = ", ".join(self.allow_methods)
                response.headers["Access-Control-Allow-Headers"] = ", ".join(self.allow_headers)
                
                if self.allow_credentials:
                    response.headers["Access-Control-Allow-Credentials"] = "true"
            
            return response
        
        # Process normal request
        response = await call_next(request)
        
        # Add CORS headers to response
        if origin and whitelist_manager.is_origin_allowed(origin):
            response.headers["Access-Control-Allow-Origin"] = origin
            
            if self.allow_credentials:
                response.headers["Access-Control-Allow-Credentials"] = "true"
        
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for detailed request/response logging."""
    
    def __init__(self, app: ASGIApp, log_body: bool = False, max_body_size: int = 10000):
        super().__init__(app)
        self.log_body = log_body
        self.max_body_size = max_body_size
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Log request and response details."""
        start_time = time.time()
        
        # Log request
        request_data = {
            "method": request.method,
            "url": str(request.url),
            "headers": dict(request.headers),
            "client": request.client.host if request.client else "unknown",
        }
        
        # Log request body if enabled (and not too large)
        if self.log_body and request.method in ["POST", "PUT", "PATCH"]:
            try:
                body = await request.body()
                if len(body) <= self.max_body_size:
                    request_data["body"] = body.decode("utf-8", errors="replace")
            except Exception:
                request_data["body"] = "Unable to read body"
        
        logger.info(f"Request: {request_data}")
        
        # Process request
        response = await call_next(request)
        
        # Log response
        process_time = time.time() - start_time
        response_data = {
            "status_code": response.status_code,
            "headers": dict(response.headers),
            "process_time": f"{process_time:.3f}s"
        }
        
        logger.info(f"Response: {response_data}")
        
        return response


# Utility functions for adding middleware
def add_whitelist_middleware(app, enabled: bool = True):
    """Add whitelist middleware to FastAPI app."""
    app.add_middleware(WhitelistMiddleware, enabled=enabled)

def add_cors_middleware(app):
    """Add CORS middleware to FastAPI app."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=whitelist_manager.get_cors_origins(),
        allow_methods=whitelist_manager.get_allowed_methods(),
        allow_credentials=True
    )

def add_request_logging_middleware(app, log_body: bool = False):
    """Add request logging middleware to FastAPI app."""
    app.add_middleware(RequestLoggingMiddleware, log_body=log_body)