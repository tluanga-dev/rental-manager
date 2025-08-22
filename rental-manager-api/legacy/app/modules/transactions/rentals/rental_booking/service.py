"""
Booking Module Service

Business logic layer for booking operations.
Handles both single-item and multi-item bookings through a unified interface.
"""

from typing import List, Optional, Dict, Any
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.exceptions import NotFoundError, ValidationError
from app.modules.customers.models import Customer
from app.modules.master_data.locations.models import Location
from app.modules.master_data.item_master.models import Item
from app.modules.transactions.base.models import (
    TransactionHeader, TransactionLine, TransactionType, 
    TransactionStatus, RentalStatus, LineItemType
)
from .repository import BookingRepository
from .models import BookingHeader, BookingLine
from .enums import BookingStatus
from .schemas import (
    BookingCreateRequest, BookingUpdateRequest, BookingHeaderResponse,
    AvailabilityCheckRequest, AvailabilityCheckResponse,
    BookingConfirmResponse, BookingCancelResponse, ConvertToRentalResponse
)

logger = logging.getLogger(__name__)


class BookingService:
    """Unified service for all booking operations"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repository = BookingRepository(session)
    
    async def create_booking(
        self, 
        request: BookingCreateRequest,
        user_id: Optional[UUID] = None
    ) -> BookingHeaderResponse:
        """
        Create a new booking (single or multi-item).
        
        Args:
            request: Booking creation request
            user_id: User creating the booking
            
        Returns:
            Created booking response
        """
        try:
            # Validate customer
            customer = await self.session.get(Customer, UUID(request.customer_id))
            if not customer or not customer.is_active:
                raise ValidationError(f"Customer {request.customer_id} not found or inactive")
            
            # Validate location
            location = await self.session.get(Location, UUID(request.location_id))
            if not location or not location.is_active:
                raise ValidationError(f"Location {request.location_id} not found or inactive")
            
            # Check availability for all items
            availability = await self.repository.check_items_availability(
                items=[{'item_id': item.item_id, 'quantity': item.quantity} for item in request.items],
                start_date=request.start_date,
                end_date=request.end_date,
                location_id=UUID(request.location_id)
            )
            
            if not availability['all_available']:
                unavailable = [item for item in availability['items'] if not item['is_available']]
                raise ValidationError(
                    f"Some items are not available: {', '.join([item['reason'] for item in unavailable])}"
                )
            
            # Calculate financial totals
            financial_data = await self._calculate_financials(request)
            
            # Prepare header data
            header_data = {
                'customer_id': UUID(request.customer_id),
                'location_id': UUID(request.location_id),
                'booking_date': date.today(),
                'start_date': request.start_date,
                'end_date': request.end_date,
                'booking_status': BookingStatus.PENDING,
                'total_items': len(request.items),
                'estimated_subtotal': financial_data['subtotal'],
                'estimated_tax': financial_data['tax_amount'],
                'estimated_total': financial_data['total'],
                'deposit_required': financial_data['deposit_required'],
                'deposit_paid': request.deposit_paid,
                'notes': request.notes,
                'created_by': user_id,
                'updated_by': user_id
            }
            
            # Prepare line items data
            lines_data = []
            for item_request in request.items:
                item = await self.session.get(Item, UUID(item_request.item_id))
                if not item:
                    raise ValidationError(f"Item {item_request.item_id} not found")
                
                # Calculate line totals
                line_total = item_request.unit_rate * item_request.quantity * item_request.rental_period
                if item_request.discount_amount:
                    line_total -= item_request.discount_amount
                
                line_data = {
                    'item_id': UUID(item_request.item_id),
                    'quantity_reserved': Decimal(str(item_request.quantity)),
                    'rental_period': item_request.rental_period,
                    'rental_period_unit': item_request.rental_period_unit,
                    'unit_rate': item_request.unit_rate,
                    'discount_amount': item_request.discount_amount or Decimal('0'),
                    'line_total': line_total,
                    'notes': item_request.notes
                }
                lines_data.append(line_data)
            
            # Create booking with lines
            booking = await self.repository.create_booking_with_lines(header_data, lines_data)
            
            # Commit transaction
            await self.session.commit()
            
            # Return response
            return BookingHeaderResponse.model_validate(booking)
            
        except ValidationError:
            await self.session.rollback()
            raise
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error creating booking: {str(e)}")
            raise ValidationError(f"Failed to create booking: {str(e)}")
    
    async def get_booking(self, booking_id: str) -> BookingHeaderResponse:
        """Get a booking by ID."""
        booking = await self.repository.get_booking_with_details(UUID(booking_id))
        if not booking:
            raise NotFoundError(f"Booking {booking_id} not found")
        
        return BookingHeaderResponse.model_validate(booking)
    
    async def get_booking_by_reference(self, reference: str) -> BookingHeaderResponse:
        """Get a booking by reference number."""
        booking = await self.repository.get_booking_by_reference(reference)
        if not booking:
            raise NotFoundError(f"Booking with reference {reference} not found")
        
        return BookingHeaderResponse.model_validate(booking)
    
    async def list_bookings(
        self,
        customer_id: Optional[str] = None,
        location_id: Optional[str] = None,
        status: Optional[BookingStatus] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: str = "booking_date",
        sort_order: str = "desc"
    ) -> Dict[str, Any]:
        """List bookings with filters and pagination."""
        skip = (page - 1) * page_size
        
        bookings, total = await self.repository.list_bookings(
            customer_id=UUID(customer_id) if customer_id else None,
            location_id=UUID(location_id) if location_id else None,
            status=status,
            date_from=date_from,
            date_to=date_to,
            skip=skip,
            limit=page_size,
            sort_by=sort_by,
            sort_order=sort_order
        )
        
        total_pages = (total + page_size - 1) // page_size
        
        return {
            'bookings': [BookingHeaderResponse.model_validate(b) for b in bookings],
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': total_pages
        }
    
    async def update_booking(
        self,
        booking_id: str,
        request: BookingUpdateRequest,
        user_id: Optional[UUID] = None
    ) -> BookingHeaderResponse:
        """Update an existing booking."""
        booking = await self.repository.get_booking_with_details(UUID(booking_id))
        if not booking:
            raise NotFoundError(f"Booking {booking_id} not found")
        
        # Only allow updates for pending bookings
        if booking.booking_status != BookingStatus.PENDING:
            raise ValidationError(f"Cannot update booking in {booking.booking_status.value} status")
        
        # Update fields
        if request.start_date:
            booking.start_date = request.start_date
        if request.end_date:
            booking.end_date = request.end_date
        if request.notes is not None:
            booking.notes = request.notes
        if request.deposit_paid is not None:
            booking.deposit_paid = request.deposit_paid
        
        booking.updated_by = user_id
        booking.updated_at = datetime.utcnow()
        
        await self.session.commit()
        await self.session.refresh(booking)
        
        return BookingHeaderResponse.model_validate(booking)
    
    async def confirm_booking(
        self,
        booking_id: str,
        user_id: Optional[UUID] = None
    ) -> BookingConfirmResponse:
        """Confirm a pending booking."""
        booking = await self.repository.update_booking_status(
            UUID(booking_id),
            BookingStatus.CONFIRMED,
            user_id
        )
        
        await self.session.commit()
        
        return BookingConfirmResponse(
            success=True,
            message=f"Booking {booking.booking_reference} confirmed successfully",
            booking=BookingHeaderResponse.model_validate(booking)
        )
    
    async def cancel_booking(
        self,
        booking_id: str,
        reason: str,
        user_id: Optional[UUID] = None
    ) -> BookingCancelResponse:
        """Cancel a booking."""
        booking = await self.repository.update_booking_status(
            UUID(booking_id),
            BookingStatus.CANCELLED,
            user_id,
            reason
        )
        
        # Calculate refund if deposit was paid
        refund_amount = booking.deposit_required if booking.deposit_paid else None
        
        await self.session.commit()
        
        return BookingCancelResponse(
            success=True,
            message=f"Booking {booking.booking_reference} cancelled",
            booking_id=booking.id,
            refund_amount=refund_amount
        )
    
    async def convert_to_rental(
        self,
        booking_id: str,
        user_id: Optional[UUID] = None
    ) -> ConvertToRentalResponse:
        """Convert a confirmed booking to a rental transaction."""
        booking = await self.repository.get_booking_with_details(UUID(booking_id))
        if not booking:
            raise NotFoundError(f"Booking {booking_id} not found")
        
        if booking.booking_status != BookingStatus.CONFIRMED:
            raise ValidationError(f"Only confirmed bookings can be converted to rentals")
        
        # Generate rental number
        rental_number = f"RNT-{datetime.utcnow().year}-{booking.id.hex[:8].upper()}"
        
        # Create transaction header
        transaction_header = TransactionHeader(
            transaction_number=rental_number,
            transaction_type=TransactionType.RENTAL,
            status=TransactionStatus.IN_PROGRESS,
            transaction_date=datetime.utcnow(),
            party_id=booking.customer_id,
            location_id=booking.location_id,
            rental_start_date=booking.start_date,
            rental_end_date=booking.end_date,
            subtotal_amount=booking.estimated_subtotal,
            tax_amount=booking.estimated_tax,
            total_amount=booking.estimated_total,
            deposit_amount=booking.deposit_required if booking.deposit_paid else Decimal('0'),
            notes=booking.notes,
            created_by=user_id,
            updated_by=user_id
        )
        
        self.session.add(transaction_header)
        await self.session.flush()
        
        # Create transaction lines from booking lines
        for booking_line in booking.lines:
            item = await self.session.get(Item, booking_line.item_id)
            
            transaction_line = TransactionLine(
                transaction_header_id=transaction_header.id,
                line_number=booking_line.line_number,
                line_type=LineItemType.PRODUCT,
                item_id=booking_line.item_id,
                sku=item.sku if item else None,
                description=item.item_name if item else f"Item {booking_line.item_id}",
                quantity=booking_line.quantity_reserved,
                unit_price=booking_line.unit_rate,
                total_price=booking_line.line_total,
                discount_amount=booking_line.discount_amount,
                line_total=booking_line.line_total,
                rental_start_date=booking.start_date,
                rental_end_date=booking.end_date,
                rental_period=booking_line.rental_period,
                rental_period_unit=booking_line.rental_period_unit,
                current_rental_status=RentalStatus.RENTAL_INPROGRESS,
                location_id=booking.location_id
            )
            self.session.add(transaction_line)
        
        # Update booking status
        booking.booking_status = BookingStatus.CONVERTED
        booking.converted_rental_id = transaction_header.id
        
        await self.session.commit()
        
        return ConvertToRentalResponse(
            success=True,
            message=f"Booking {booking.booking_reference} converted to rental {rental_number}",
            booking_id=booking.id,
            rental_id=transaction_header.id,
            rental_number=rental_number
        )
    
    async def check_availability(
        self,
        request: AvailabilityCheckRequest
    ) -> AvailabilityCheckResponse:
        """Check availability for multiple items."""
        availability = await self.repository.check_items_availability(
            items=request.items,
            start_date=request.start_date,
            end_date=request.end_date,
            location_id=UUID(request.location_id),
            exclude_booking_id=UUID(request.exclude_booking_id) if request.exclude_booking_id else None
        )
        
        unavailable = [item for item in availability['items'] if not item['is_available']]
        partially_available = [
            item for item in availability['items'] 
            if item['is_available'] and item['available_quantity'] < item['requested_quantity']
        ]
        
        return AvailabilityCheckResponse(
            all_available=availability['all_available'],
            items=availability['items'],
            unavailable_items=unavailable,
            partially_available_items=partially_available
        )
    
    async def _calculate_financials(
        self,
        request: BookingCreateRequest
    ) -> Dict[str, Decimal]:
        """Calculate financial totals for a booking."""
        subtotal = Decimal('0')
        total_discount = Decimal('0')
        
        for item in request.items:
            # Calculate line subtotal
            line_amount = item.unit_rate * item.quantity * item.rental_period
            subtotal += line_amount
            
            # Add discount
            if item.discount_amount:
                total_discount += item.discount_amount
        
        # Apply discount
        subtotal_after_discount = subtotal - total_discount
        
        # Calculate tax (10% default)
        tax_rate = Decimal('10')
        tax_amount = (subtotal_after_discount * tax_rate / 100).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        
        # Calculate total
        total = subtotal_after_discount + tax_amount
        
        # Calculate deposit (20% of total)
        deposit_required = (total * Decimal('0.20')).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        
        return {
            'subtotal': subtotal_after_discount,
            'tax_amount': tax_amount,
            'total': total,
            'deposit_required': deposit_required
        }