"""
Enhanced error handling middleware and utilities for better debugging.
"""
import traceback
import sys
from typing import Any, Dict, Optional
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError, IntegrityError, OperationalError
from asyncpg.exceptions import PostgresError
from datetime import datetime
import logging

from app.core.config import settings
from app.shared.exceptions import CustomHTTPException

logger = logging.getLogger(__name__)


class EnhancedErrorResponse:
    """Structured error response for better debugging."""
    
    def __init__(
        self,
        error_code: str,
        message: str,
        status_code: int = 500,
        request_id: Optional[str] = None,
        endpoint: Optional[str] = None,
        method: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        stack_trace: Optional[str] = None,
        suggestions: Optional[list] = None
    ):
        self.error_code = error_code
        self.message = message
        self.status_code = status_code
        self.request_id = request_id
        self.endpoint = endpoint
        self.method = method
        self.details = details or {}
        self.stack_trace = stack_trace if settings.DEBUG else None
        self.suggestions = suggestions or []
        self.timestamp = datetime.utcnow().isoformat()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON response."""
        response = {
            "error": {
                "code": self.error_code,
                "message": self.message,
                "status_code": self.status_code,
                "timestamp": self.timestamp
            }
        }
        
        if self.request_id:
            response["error"]["request_id"] = self.request_id
        
        if self.endpoint:
            response["error"]["endpoint"] = self.endpoint
        
        if self.method:
            response["error"]["method"] = self.method
        
        if self.details:
            response["error"]["details"] = self.details
        
        if self.stack_trace and settings.DEBUG:
            response["error"]["stack_trace"] = self.stack_trace
        
        if self.suggestions:
            response["error"]["suggestions"] = self.suggestions
        
        return response


class ErrorAnalyzer:
    """Analyzes errors and provides suggestions for common issues."""
    
    @staticmethod
    def analyze_import_error(error: ImportError) -> EnhancedErrorResponse:
        """Analyze import errors and provide suggestions."""
        error_msg = str(error)
        suggestions = []
        
        if "require_permission" in error_msg:
            suggestions.extend([
                "Check if app.core.permissions module exists",
                "Verify the function name is 'require_permission' not 'require_permissions'",
                "Ensure no circular imports in the module"
            ])
        
        if "PaginationParams" in error_msg:
            suggestions.extend([
                "Check if app.shared.dependencies module exists", 
                "Verify PaginationParams is defined in the dependencies module",
                "Check for circular import issues"
            ])
        
        return EnhancedErrorResponse(
            error_code="IMPORT_ERROR",
            message=f"Failed to import required module: {error_msg}",
            status_code=500,
            suggestions=suggestions,
            stack_trace=traceback.format_exc()
        )
    
    @staticmethod
    def analyze_database_error(error: Exception) -> EnhancedErrorResponse:
        """Analyze database errors and provide suggestions."""
        error_msg = str(error)
        suggestions = []
        details = {}
        
        if "column" in error_msg.lower() and "does not exist" in error_msg.lower():
            suggestions.extend([
                "Run database migrations: alembic upgrade head",
                "Check if the column was added in a recent migration",
                "Verify the model definition matches the database schema"
            ])
            details["error_type"] = "missing_column"
        
        if "relation" in error_msg.lower() and "does not exist" in error_msg.lower():
            suggestions.extend([
                "Check if the table exists in the database",
                "Run database migrations to create missing tables",
                "Verify the table name in the model matches the database"
            ])
            details["error_type"] = "missing_table"
        
        if "constraint" in error_msg.lower():
            suggestions.extend([
                "Check for unique constraint violations",
                "Verify foreign key relationships",
                "Review data validation rules"
            ])
            details["error_type"] = "constraint_violation"
        
        return EnhancedErrorResponse(
            error_code="DATABASE_ERROR",
            message=f"Database operation failed: {error_msg}",
            status_code=500,
            details=details,
            suggestions=suggestions,
            stack_trace=traceback.format_exc()
        )
    
    @staticmethod
    def analyze_authentication_error(error: HTTPException) -> EnhancedErrorResponse:
        """Analyze authentication/authorization errors."""
        suggestions = []
        details = {}
        
        if error.status_code == 401:
            suggestions.extend([
                "Check if user is logged in",
                "Verify JWT token is valid and not expired",
                "Ensure Authorization header is present",
                "Check if token refresh is needed"
            ])
            details["error_type"] = "authentication_required"
        
        elif error.status_code == 403:
            suggestions.extend([
                "Check if user has required permissions",
                "Verify user role assignments",
                "Review permission requirements for this endpoint",
                "Contact admin for access privileges"
            ])
            details["error_type"] = "insufficient_permissions"
        
        return EnhancedErrorResponse(
            error_code="AUTH_ERROR",
            message=str(error.detail),
            status_code=error.status_code,
            details=details,
            suggestions=suggestions
        )
    
    @staticmethod
    def analyze_generic_error(error: Exception, request: Request) -> EnhancedErrorResponse:
        """Analyze generic errors."""
        error_type = type(error).__name__
        error_msg = str(error)
        
        suggestions = [
            "Check server logs for more details",
            "Verify all required services are running",
            "Check if this is a temporary issue by retrying"
        ]
        
        details = {
            "error_type": error_type,
            "python_version": sys.version,
            "module": getattr(error, "__module__", "unknown")
        }
        
        return EnhancedErrorResponse(
            error_code="INTERNAL_ERROR",
            message=f"An unexpected error occurred: {error_msg}",
            status_code=500,
            endpoint=str(request.url.path),
            method=request.method,
            details=details,
            suggestions=suggestions,
            stack_trace=traceback.format_exc()
        )


async def enhanced_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Enhanced exception handler that provides detailed error information.
    """
    # Get request ID for tracking
    request_id = request.headers.get("X-Request-ID", "unknown")
    
    # Log the error
    logger.error(
        f"Exception in {request.method} {request.url.path}: {exc}",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "error_type": type(exc).__name__
        }
    )
    
    # Analyze the error and create response
    if isinstance(exc, CustomHTTPException):
        error_response = EnhancedErrorResponse(
            error_code=exc.error_type,
            message=str(exc.detail),
            status_code=exc.status_code,
            request_id=request_id,
            endpoint=str(request.url.path),
            method=request.method
        )
    elif isinstance(exc, HTTPException):
        error_response = ErrorAnalyzer.analyze_authentication_error(exc)
        error_response.request_id = request_id
        error_response.endpoint = str(request.url.path)
        error_response.method = request.method
    elif isinstance(exc, ImportError):
        error_response = ErrorAnalyzer.analyze_import_error(exc)
        error_response.request_id = request_id
        error_response.endpoint = str(request.url.path)
        error_response.method = request.method
    elif isinstance(exc, (SQLAlchemyError, PostgresError)):
        error_response = ErrorAnalyzer.analyze_database_error(exc)
        error_response.request_id = request_id
        error_response.endpoint = str(request.url.path)
        error_response.method = request.method
    else:
        error_response = ErrorAnalyzer.analyze_generic_error(exc, request)
        error_response.request_id = request_id
    
    # Create JSON response with CORS headers
    response = JSONResponse(
        status_code=error_response.status_code,
        content=error_response.to_dict()
    )
    
    # Add CORS headers
    origin = request.headers.get("origin")
    if origin and (not settings.USE_WHITELIST_CONFIG or origin in settings.cors_origins):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
    
    return response


def add_error_details_to_response(response_data: dict, request: Request, error: Exception) -> dict:
    """Add detailed error information to response data."""
    if settings.DEBUG:
        response_data.update({
            "debug_info": {
                "request_url": str(request.url),
                "request_method": request.method,
                "error_type": type(error).__name__,
                "error_module": getattr(error, "__module__", "unknown"),
                "stack_trace": traceback.format_exc()
            }
        })
    
    return response_data