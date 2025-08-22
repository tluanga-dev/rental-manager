"""
Centralized Logging Configuration

This module provides centralized configuration for all logging components
including transaction logging, audit logging, and API request/response logging.
"""

import logging
import logging.handlers
import os
from pathlib import Path
from typing import Dict, Any, Optional
from dataclasses import dataclass

from app.core.config import settings


@dataclass
class LoggingConfig:
    """Configuration class for all logging settings."""
    
    # General logging settings
    log_level: str = "INFO"
    log_format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # File logging settings
    log_directory: str = "logs"
    max_file_size: int = 10 * 1024 * 1024  # 10MB
    backup_count: int = 5
    
    # Transaction logging settings
    transaction_log_directory: str = "logs/transactions"
    transaction_log_enabled: bool = True
    
    # API logging settings
    api_log_enabled: bool = True
    api_log_include_request_body: bool = True
    api_log_include_response_body: bool = False
    api_log_max_body_size: int = 10000
    
    # Audit logging settings
    audit_log_enabled: bool = True
    
    # Performance logging settings
    slow_query_threshold: float = 1.0  # seconds
    log_sql_queries: bool = False
    
    # Error tracking settings
    error_tracking_enabled: bool = True
    capture_stack_traces: bool = True


class LoggingManager:
    """
    Centralized logging manager for the entire application.
    
    This class manages all logging configurations including:
    - Standard application logging
    - Transaction logging
    - API request/response logging
    - Audit logging
    - Error tracking
    """
    
    def __init__(self, config: Optional[LoggingConfig] = None):
        """
        Initialize the logging manager.
        
        Args:
            config: Logging configuration. If None, uses default configuration.
        """
        self.config = config or LoggingConfig()
        self._setup_directories()
        self._configure_root_logger()
        self._loggers: Dict[str, logging.Logger] = {}
        
    def _setup_directories(self) -> None:
        """Create necessary log directories."""
        directories = [
            self.config.log_directory,
            self.config.transaction_log_directory,
        ]
        
        for directory in directories:
            Path(directory).mkdir(parents=True, exist_ok=True)
    
    def _configure_root_logger(self) -> None:
        """Configure the root logger with appropriate handlers."""
        root_logger = logging.getLogger()
        root_logger.setLevel(getattr(logging, self.config.log_level.upper()))
        
        # Clear existing handlers
        root_logger.handlers.clear()
        
        # Console handler
        console_handler = logging.StreamHandler()
        console_formatter = logging.Formatter(self.config.log_format)
        console_handler.setFormatter(console_formatter)
        root_logger.addHandler(console_handler)
        
        # File handler (rotating)
        log_file_path = Path(self.config.log_directory) / "app.log"
        file_handler = logging.handlers.RotatingFileHandler(
            log_file_path,
            maxBytes=self.config.max_file_size,
            backupCount=self.config.backup_count
        )
        file_formatter = logging.Formatter(self.config.log_format)
        file_handler.setFormatter(file_formatter)
        root_logger.addHandler(file_handler)
        
        # Error file handler (for ERROR and CRITICAL only)
        error_log_path = Path(self.config.log_directory) / "errors.log"
        error_handler = logging.handlers.RotatingFileHandler(
            error_log_path,
            maxBytes=self.config.max_file_size,
            backupCount=self.config.backup_count
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(file_formatter)
        root_logger.addHandler(error_handler)
    
    def get_logger(self, name: str) -> logging.Logger:
        """
        Get or create a logger with the specified name.
        
        Args:
            name: Logger name (typically __name__)
        
        Returns:
            logging.Logger: Configured logger instance
        """
        if name not in self._loggers:
            logger = logging.getLogger(name)
            logger.setLevel(getattr(logging, self.config.log_level.upper()))
            self._loggers[name] = logger
        
        return self._loggers[name]
    
    def get_transaction_logger(self) -> logging.Logger:
        """
        Get logger for transaction operations.
        
        Returns:
            logging.Logger: Transaction logger
        """
        if not self.config.transaction_log_enabled:
            return logging.getLogger("transaction.disabled")
        
        logger_name = "transaction"
        if logger_name not in self._loggers:
            logger = logging.getLogger(logger_name)
            logger.setLevel(logging.INFO)
            
            # Transaction-specific file handler
            trans_log_path = Path(self.config.transaction_log_directory) / "transactions.log"
            handler = logging.handlers.RotatingFileHandler(
                trans_log_path,
                maxBytes=self.config.max_file_size,
                backupCount=self.config.backup_count
            )
            
            formatter = logging.Formatter(
                "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            
            # Prevent propagation to root logger to avoid duplicate logs
            logger.propagate = False
            
            self._loggers[logger_name] = logger
        
        return self._loggers[logger_name]
    
    def get_api_logger(self) -> logging.Logger:
        """
        Get logger for API requests and responses.
        
        Returns:
            logging.Logger: API logger
        """
        if not self.config.api_log_enabled:
            return logging.getLogger("api.disabled")
        
        logger_name = "api"
        if logger_name not in self._loggers:
            logger = logging.getLogger(logger_name)
            logger.setLevel(logging.INFO)
            
            # API-specific file handler
            api_log_path = Path(self.config.log_directory) / "api.log"
            handler = logging.handlers.RotatingFileHandler(
                api_log_path,
                maxBytes=self.config.max_file_size,
                backupCount=self.config.backup_count
            )
            
            formatter = logging.Formatter(
                "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            
            logger.propagate = False
            self._loggers[logger_name] = logger
        
        return self._loggers[logger_name]
    
    def get_audit_logger(self) -> logging.Logger:
        """
        Get logger for audit operations.
        
        Returns:
            logging.Logger: Audit logger
        """
        if not self.config.audit_log_enabled:
            return logging.getLogger("audit.disabled")
        
        logger_name = "audit"
        if logger_name not in self._loggers:
            logger = logging.getLogger(logger_name)
            logger.setLevel(logging.INFO)
            
            # Audit-specific file handler
            audit_log_path = Path(self.config.log_directory) / "audit.log"
            handler = logging.handlers.RotatingFileHandler(
                audit_log_path,
                maxBytes=self.config.max_file_size,
                backupCount=self.config.backup_count
            )
            
            formatter = logging.Formatter(
                "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            
            logger.propagate = False
            self._loggers[logger_name] = logger
        
        return self._loggers[logger_name]
    
    def get_performance_logger(self) -> logging.Logger:
        """
        Get logger for performance monitoring.
        
        Returns:
            logging.Logger: Performance logger
        """
        logger_name = "performance"
        if logger_name not in self._loggers:
            logger = logging.getLogger(logger_name)
            logger.setLevel(logging.INFO)
            
            # Performance-specific file handler
            perf_log_path = Path(self.config.log_directory) / "performance.log"
            handler = logging.handlers.RotatingFileHandler(
                perf_log_path,
                maxBytes=self.config.max_file_size,
                backupCount=self.config.backup_count
            )
            
            formatter = logging.Formatter(
                "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            
            logger.propagate = False
            self._loggers[logger_name] = logger
        
        return self._loggers[logger_name]
    
    def log_sql_query(self, query: str, params: Any, duration: float) -> None:
        """
        Log SQL query if enabled and above threshold.
        
        Args:
            query: SQL query string
            params: Query parameters
            duration: Query execution time in seconds
        """
        if not self.config.log_sql_queries and duration < self.config.slow_query_threshold:
            return
        
        logger = self.get_performance_logger()
        
        if duration >= self.config.slow_query_threshold:
            logger.warning(
                f"Slow query detected: {duration:.3f}s - Query: {query[:200]}{'...' if len(query) > 200 else ''}"
            )
        elif self.config.log_sql_queries:
            logger.info(
                f"SQL Query ({duration:.3f}s): {query[:200]}{'...' if len(query) > 200 else ''}"
            )


# Global logging manager instance
logging_manager = LoggingManager()

# Convenience functions for getting loggers
def get_logger(name: str) -> logging.Logger:
    """Get application logger."""
    return logging_manager.get_logger(name)

def get_transaction_logger() -> logging.Logger:
    """Get transaction logger."""
    return logging_manager.get_transaction_logger()

def get_api_logger() -> logging.Logger:
    """Get API logger."""
    return logging_manager.get_api_logger()

def get_audit_logger() -> logging.Logger:
    """Get audit logger."""
    return logging_manager.get_audit_logger()

def get_performance_logger() -> logging.Logger:
    """Get performance logger."""
    return logging_manager.get_performance_logger()

def log_sql_query(query: str, params: Any, duration: float) -> None:
    """Log SQL query."""
    logging_manager.log_sql_query(query, params, duration)