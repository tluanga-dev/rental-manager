"""
Booking Module Repository

Data access layer for booking operations.
"""

from typing import List, Optional, Dict, Any, Tuple
from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import UUID
import logging

from sqlalchemy import select, func, and_, or_, desc, asc
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.repository import BaseRepository
from app.modules.inventory.models import StockLevel
from app.modules.master_data.item_master.models import Item
from .models import BookingHeader, BookingLine
from .enums import BookingStatus

logger = logging.getLogger(__name__)


class BookingRepository(BaseRepository[BookingHeader]):
    """Repository for booking operations"""
    
    def __init__(self, session: AsyncSession):
        super().__init__(BookingHeader, session)
        self.line_model = BookingLine
    
    async def create_booking_with_lines(
        self, 
        header_data: Dict[str, Any], 
        lines_data: List[Dict[str, Any]]
    ) -> BookingHeader:
        """
        Create a new booking with line items.
        
        Args:
            header_data: Booking header data
            lines_data: List of line item data
            
        Returns:
            Created booking with lines
        """
        try:
            # Generate booking reference if not provided
            if 'booking_reference' not in header_data:
                header_data['booking_reference'] = await self._generate_booking_reference()
            
            # Create header
            booking_header = BookingHeader(**header_data)
            self.session.add(booking_header)
            await self.session.flush()
            
            # Create lines
            for idx, line_data in enumerate(lines_data, 1):
                line_data['booking_header_id'] = booking_header.id
                line_data['line_number'] = idx
                booking_line = BookingLine(**line_data)
                self.session.add(booking_line)
            
            await self.session.flush()
            
            # Load relationships
            await self.session.refresh(booking_header, ['lines', 'customer', 'location'])
            
            return booking_header
            
        except Exception as e:
            logger.error(f"Error creating booking: {str(e)}")
            await self.session.rollback()
            raise
    
    async def get_booking_with_details(self, booking_id: UUID) -> Optional[BookingHeader]:
        """
        Get a booking with all related data.
        
        Args:
            booking_id: Booking UUID
            
        Returns:
            Booking with all details or None
        """
        query = (
            select(BookingHeader)
            .options(
                selectinload(BookingHeader.lines).selectinload(BookingLine.item),
                selectinload(BookingHeader.customer),
                selectinload(BookingHeader.location)
            )
            .where(BookingHeader.id == booking_id)
        )
        
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def get_booking_by_reference(self, reference: str) -> Optional[BookingHeader]:
        """
        Get a booking by its reference number.
        
        Args:
            reference: Booking reference
            
        Returns:
            Booking or None
        """
        query = (
            select(BookingHeader)
            .options(
                selectinload(BookingHeader.lines).selectinload(BookingLine.item),
                selectinload(BookingHeader.customer),
                selectinload(BookingHeader.location)
            )
            .where(BookingHeader.booking_reference == reference)
        )
        
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def list_bookings(
        self,
        customer_id: Optional[UUID] = None,
        location_id: Optional[UUID] = None,
        status: Optional[BookingStatus] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        skip: int = 0,
        limit: int = 20,
        sort_by: str = "booking_date",
        sort_order: str = "desc"
    ) -> Tuple[List[BookingHeader], int]:
        """
        List bookings with filters and pagination.
        
        Returns:
            Tuple of (bookings list, total count)
        """
        # Base query
        query = select(BookingHeader).options(
            selectinload(BookingHeader.lines),
            selectinload(BookingHeader.customer),
            selectinload(BookingHeader.location)
        )
        
        # Apply filters
        filters = []
        if customer_id:
            filters.append(BookingHeader.customer_id == customer_id)
        if location_id:
            filters.append(BookingHeader.location_id == location_id)
        if status:
            filters.append(BookingHeader.booking_status == status)
        if date_from:
            filters.append(BookingHeader.start_date >= date_from)
        if date_to:
            filters.append(BookingHeader.end_date <= date_to)
        
        if filters:
            query = query.where(and_(*filters))
        
        # Count total
        count_query = select(func.count()).select_from(BookingHeader)
        if filters:
            count_query = count_query.where(and_(*filters))
        total_result = await self.session.execute(count_query)
        total = total_result.scalar_one()
        
        # Apply sorting
        order_column = getattr(BookingHeader, sort_by, BookingHeader.booking_date)
        if sort_order == "asc":
            query = query.order_by(asc(order_column))
        else:
            query = query.order_by(desc(order_column))
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        
        # Execute query
        result = await self.session.execute(query)
        bookings = result.scalars().unique().all()
        
        return bookings, total
    
    async def check_items_availability(
        self,
        items: List[Dict[str, Any]],
        start_date: date,
        end_date: date,
        location_id: UUID,
        exclude_booking_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Check availability for multiple items.
        
        Returns:
            Availability information
        """
        availability_results = []
        all_available = True
        
        for item_request in items:
            item_id = UUID(item_request['item_id'])
            requested_qty = Decimal(str(item_request['quantity']))
            
            # Get stock level
            stock_query = (
                select(StockLevel)
                .where(
                    and_(
                        StockLevel.item_id == item_id,
                        StockLevel.location_id == location_id
                    )
                )
            )
            stock_result = await self.session.execute(stock_query)
            stock_level = stock_result.scalar_one_or_none()
            
            if not stock_level:
                availability_results.append({
                    'item_id': str(item_id),
                    'requested_quantity': float(requested_qty),
                    'available_quantity': 0,
                    'is_available': False,
                    'reason': 'Item not stocked at this location'
                })
                all_available = False
                continue
            
            # Check existing bookings
            booking_query = (
                select(func.sum(BookingLine.quantity_reserved))
                .join(BookingHeader)
                .where(
                    and_(
                        BookingLine.item_id == item_id,
                        BookingHeader.location_id == location_id,
                        BookingHeader.booking_status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING]),
                        or_(
                            and_(
                                BookingHeader.start_date <= end_date,
                                BookingHeader.end_date >= start_date
                            )
                        )
                    )
                )
            )
            
            if exclude_booking_id:
                booking_query = booking_query.where(BookingHeader.id != exclude_booking_id)
            
            booked_result = await self.session.execute(booking_query)
            booked_quantity = booked_result.scalar_one() or Decimal('0')
            
            available_qty = stock_level.available_quantity - booked_quantity
            is_available = available_qty >= requested_qty
            
            availability_results.append({
                'item_id': str(item_id),
                'requested_quantity': float(requested_qty),
                'available_quantity': float(available_qty),
                'booked_quantity': float(booked_quantity),
                'is_available': is_available,
                'reason': None if is_available else f'Only {available_qty} available'
            })
            
            if not is_available:
                all_available = False
        
        return {
            'all_available': all_available,
            'items': availability_results,
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat()
        }
    
    async def update_booking_status(
        self, 
        booking_id: UUID, 
        status: BookingStatus,
        user_id: Optional[UUID] = None,
        reason: Optional[str] = None
    ) -> BookingHeader:
        """
        Update booking status with tracking.
        
        Returns:
            Updated booking
        """
        booking = await self.get_booking_with_details(booking_id)
        if not booking:
            raise ValueError(f"Booking {booking_id} not found")
        
        booking.booking_status = status
        
        # Track status-specific fields
        if status == BookingStatus.CANCELLED:
            booking.cancelled_at = datetime.utcnow()
            booking.cancelled_by = user_id
            booking.cancelled_reason = reason
        
        await self.session.flush()
        await self.session.refresh(booking)
        
        return booking
    
    async def _generate_booking_reference(self) -> str:
        """
        Generate a unique booking reference.
        
        Returns:
            Unique booking reference string
        """
        # Get the last booking reference
        query = (
            select(BookingHeader.booking_reference)
            .order_by(desc(BookingHeader.created_at))
            .limit(1)
        )
        result = await self.session.execute(query)
        last_reference = result.scalar_one_or_none()
        
        # Generate new reference
        if last_reference:
            # Extract number from last reference (e.g., "BK-2024-00001")
            parts = last_reference.split('-')
            if len(parts) >= 3:
                last_number = int(parts[-1])
                new_number = last_number + 1
            else:
                new_number = 1
        else:
            new_number = 1
        
        # Format: BK-YYYY-NNNNN
        year = datetime.utcnow().year
        reference = f"BK-{year}-{new_number:05d}"
        
        return reference