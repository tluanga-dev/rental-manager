"""
Unified Booking Module for Rental System

This module provides a complete booking system that handles both single-item 
and multi-item bookings through a unified architecture. All bookings use the 
header-detail pattern for consistency and scalability.
"""

import logging

logger = logging.getLogger(__name__)

try:
    from .routes import router as booking_router
    from .service import BookingService
    from .repository import BookingRepository
    from .models import BookingHeader, BookingLine
    from .enums import BookingStatus
    
    logger.info("✅ Booking module initialized successfully")
except ImportError as e:
    logger.error(f"❌ Failed to initialize booking module: {e}", exc_info=True)
    raise

__all__ = [
    "booking_router",
    "BookingService",
    "BookingRepository", 
    "BookingHeader",
    "BookingLine",
    "BookingStatus"
]