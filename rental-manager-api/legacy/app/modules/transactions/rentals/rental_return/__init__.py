"""
Rental Return Module

Handles rental return operations including item inspections and fee calculations.
"""

from .schemas import *
from .service import RentalReturnService

__all__ = [
    # Service
    "RentalReturnService",
]