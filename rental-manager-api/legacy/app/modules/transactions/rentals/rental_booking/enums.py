"""
Booking Module Enumerations

Defines all enum types used in the booking system.
"""

from enum import Enum as PyEnum


class BookingStatus(PyEnum):
    """Status of a booking"""
    PENDING = "PENDING"          # Initial state, awaiting confirmation
    CONFIRMED = "CONFIRMED"      # Confirmed and inventory reserved  
    CANCELLED = "CANCELLED"      # Cancelled by user or system
    EXPIRED = "EXPIRED"          # Expired due to time limit
    CONVERTED = "CONVERTED"      # Converted to rental transaction


class BookingPriority(PyEnum):
    """Priority level for bookings"""
    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    URGENT = "URGENT"


class RentalPeriodUnit(PyEnum):
    """Units for rental period calculation"""
    HOURLY = "HOURLY"
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"


class PaymentStatus(PyEnum):
    """Payment status for booking deposits"""
    NOT_REQUIRED = "NOT_REQUIRED"
    PENDING = "PENDING"
    PARTIAL = "PARTIAL"
    PAID = "PAID"
    REFUNDED = "REFUNDED"