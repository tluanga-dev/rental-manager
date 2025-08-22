"""
Purchase Returns Service

Business logic layer for purchase return operations.
"""

from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.transactions.base.models.transaction_headers import TransactionHeader, TransactionType, TransactionStatus
from app.modules.transactions.base.models.transaction_lines import TransactionLine
from app.modules.transactions.base.models.metadata import TransactionMetadata
from app.modules.inventory.service import InventoryService
from app.core.errors import NotFoundError, ValidationError, ConflictError
import random
import string
from .repository import PurchaseReturnRepository
from .schemas import (
    PurchaseReturnCreate,
    PurchaseReturnUpdate,
    PurchaseReturnResponse,
    PurchaseReturnListResponse,
    PurchaseReturnFilters,
    PurchaseReturnValidation,
    PurchaseReturnAnalytics,
    ReturnStatus,
    PaymentStatus,
    SupplierSummary,
    ItemSummary,
    PurchaseSummary,
    PurchaseReturnItemResponse
)


class PurchaseReturnService:
    """Service for managing purchase returns"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repository = PurchaseReturnRepository(session)
        self.inventory_service = InventoryService(session)
    
    async def create_purchase_return(
        self,
        data: PurchaseReturnCreate,
        user_id: Optional[UUID] = None
    ) -> PurchaseReturnResponse:
        """
        Create a new purchase return.
        
        Args:
            data: Purchase return data
            user_id: ID of user creating the return
            
        Returns:
            Created purchase return
            
        Raises:
            ValidationError: If return data is invalid
            NotFoundError: If original purchase not found
        """
        # Validate the return
        validation = await self.validate_purchase_return(
            data.original_purchase_id,
            [{"item_id": str(item.item_id), "quantity": item.quantity} for item in data.items]
        )
        
        if not validation["is_valid"]:
            raise ValidationError(f"Invalid return: {', '.join(validation['errors'])}")
        
        # Get original purchase
        original_purchase = await self.repository.get_original_purchase(data.original_purchase_id)
        if not original_purchase:
            raise NotFoundError(f"Original purchase {data.original_purchase_id} not found")
        
        # Generate transaction number
        rand_suffix = ''.join(random.choices(string.digits, k=6))
        transaction_number = f"RTN-{datetime.now().strftime('%Y%m%d')}-{rand_suffix}"
        
        # Create transaction header
        return_header = TransactionHeader(
            id=uuid4(),
            transaction_number=transaction_number,
            transaction_type=TransactionType.RETURN,
            status=self._map_return_status(data.status),
            transaction_date=datetime.combine(data.return_date, datetime.min.time()),
            supplier_id=data.supplier_id,
            reference_number=data.return_authorization,
            notes=data.notes,
            subtotal=Decimal(0),
            total_amount=Decimal(0),
            created_by=str(user_id) if user_id else None,
            updated_by=str(user_id) if user_id else None
        )
        
        # Add metadata
        metadata = TransactionMetadata(
            id=uuid4(),
            transaction_id=return_header.id,
            key="original_purchase_id",
            value=str(data.original_purchase_id)
        )
        return_header.metadata_entries.append(metadata)
        
        payment_status_meta = TransactionMetadata(
            id=uuid4(),
            transaction_id=return_header.id,
            key="payment_status",
            value=data.payment_status.value
        )
        return_header.metadata_entries.append(payment_status_meta)
        
        # Create transaction lines
        total_refund = Decimal(0)
        for item_data in data.items:
            line = TransactionLine(
                id=uuid4(),
                transaction_id=return_header.id,
                item_id=item_data.item_id,
                quantity=item_data.quantity,
                unit_price=item_data.unit_cost,
                total_price=item_data.unit_cost * item_data.quantity,
                notes=item_data.notes
            )
            
            # Store return reason in metadata
            reason_meta = TransactionMetadata(
                id=uuid4(),
                transaction_id=return_header.id,
                key=f"return_reason_{item_data.item_id}",
                value=item_data.return_reason.value
            )
            return_header.metadata_entries.append(reason_meta)
            
            if item_data.condition:
                condition_meta = TransactionMetadata(
                    id=uuid4(),
                    transaction_id=return_header.id,
                    key=f"condition_{item_data.item_id}",
                    value=item_data.condition.value
                )
                return_header.metadata_entries.append(condition_meta)
            
            return_header.transaction_lines.append(line)
            total_refund += line.total_price
        
        # Update totals
        return_header.subtotal = total_refund
        return_header.total_amount = total_refund
        
        # Save to database
        self.session.add(return_header)
        
        # Update inventory if return is completed
        if data.status == ReturnStatus.COMPLETED:
            await self._update_inventory_for_return(return_header, reverse=False)
        
        await self.session.commit()
        await self.session.refresh(return_header)
        
        return await self._format_return_response(return_header)
    
    async def get_purchase_returns(
        self,
        filters: PurchaseReturnFilters
    ) -> PurchaseReturnListResponse:
        """
        Get purchase returns with filtering and pagination.
        
        Args:
            filters: Filter parameters
            
        Returns:
            List of purchase returns
        """
        returns, total = await self.repository.get_purchase_returns(filters)
        
        formatted_returns = []
        for return_txn in returns:
            formatted_returns.append(await self._format_return_response(return_txn))
        
        return PurchaseReturnListResponse(
            items=formatted_returns,
            total=total,
            skip=filters.skip,
            limit=filters.limit
        )
    
    async def get_purchase_return_by_id(self, return_id: UUID) -> PurchaseReturnResponse:
        """
        Get a single purchase return by ID.
        
        Args:
            return_id: Return ID
            
        Returns:
            Purchase return
            
        Raises:
            NotFoundError: If return not found
        """
        return_txn = await self.repository.get_purchase_return_by_id(return_id)
        if not return_txn:
            raise NotFoundError(f"Purchase return {return_id} not found")
        
        return await self._format_return_response(return_txn)
    
    async def update_purchase_return(
        self,
        return_id: UUID,
        data: PurchaseReturnUpdate,
        user_id: Optional[UUID] = None
    ) -> PurchaseReturnResponse:
        """
        Update a purchase return.
        
        Args:
            return_id: Return ID
            data: Update data
            user_id: ID of user updating the return
            
        Returns:
            Updated purchase return
            
        Raises:
            NotFoundError: If return not found
        """
        return_txn = await self.repository.get_purchase_return_by_id(return_id)
        if not return_txn:
            raise NotFoundError(f"Purchase return {return_id} not found")
        
        # Check if status is changing to completed
        old_status = return_txn.status
        
        # Update fields
        if data.status is not None:
            return_txn.status = self._map_return_status(data.status)
        
        if data.return_authorization is not None:
            return_txn.reference_number = data.return_authorization
        
        if data.notes is not None:
            return_txn.notes = data.notes
        
        if data.payment_status is not None:
            # Update payment status in metadata
            for meta in return_txn.metadata_entries:
                if meta.key == "payment_status":
                    meta.value = data.payment_status.value
                    break
            else:
                # Add if not exists
                payment_meta = TransactionMetadata(
                    id=uuid4(),
                    transaction_id=return_txn.id,
                    key="payment_status",
                    value=data.payment_status.value
                )
                return_txn.metadata_entries.append(payment_meta)
        
        return_txn.updated_at = datetime.utcnow()
        return_txn.updated_by = str(user_id) if user_id else None
        
        # Update inventory if status changed to completed
        if data.status == ReturnStatus.COMPLETED and old_status != TransactionStatus.COMPLETED:
            await self._update_inventory_for_return(return_txn, reverse=False)
        elif old_status == TransactionStatus.COMPLETED and data.status == ReturnStatus.CANCELLED:
            # Reverse inventory update if cancelling
            await self._update_inventory_for_return(return_txn, reverse=True)
        
        await self.session.commit()
        await self.session.refresh(return_txn)
        
        return await self._format_return_response(return_txn)
    
    async def delete_purchase_return(self, return_id: UUID) -> bool:
        """
        Cancel/delete a purchase return.
        
        Args:
            return_id: Return ID
            
        Returns:
            True if successful
            
        Raises:
            NotFoundError: If return not found
            ConflictError: If return cannot be cancelled
        """
        return_txn = await self.repository.get_purchase_return_by_id(return_id)
        if not return_txn:
            raise NotFoundError(f"Purchase return {return_id} not found")
        
        if return_txn.status == TransactionStatus.COMPLETED:
            raise ConflictError("Cannot delete a completed return")
        
        # Mark as cancelled instead of deleting
        return_txn.status = TransactionStatus.CANCELLED
        return_txn.updated_at = datetime.utcnow()
        
        await self.session.commit()
        return True
    
    async def validate_purchase_return(
        self,
        purchase_id: UUID,
        items: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Validate a purchase return.
        
        Args:
            purchase_id: Original purchase ID
            items: Items to return
            
        Returns:
            Validation result
        """
        validation = await self.repository.validate_return_quantities(purchase_id, items)
        return PurchaseReturnValidation(**validation).model_dump()
    
    async def get_purchase_return_analytics(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        supplier_id: Optional[UUID] = None
    ) -> PurchaseReturnAnalytics:
        """
        Get purchase return analytics.
        
        Args:
            start_date: Start date
            end_date: End date
            supplier_id: Supplier filter
            
        Returns:
            Analytics data
        """
        analytics = await self.repository.get_return_analytics(
            start_date, end_date, supplier_id
        )
        return PurchaseReturnAnalytics(**analytics)
    
    async def _update_inventory_for_return(
        self,
        return_txn: TransactionHeader,
        reverse: bool = False
    ):
        """
        Update inventory for a return transaction.
        
        Args:
            return_txn: Return transaction
            reverse: Whether to reverse the update (for cancellation)
        """
        for line in return_txn.transaction_lines:
            # For returns, we add back to inventory
            quantity = -line.quantity if reverse else line.quantity
            
            # Get location from original purchase if available
            location_id = None  # Would need to get from original purchase
            
            if location_id:
                await self.inventory_service.adjust_stock(
                    item_id=line.item_id,
                    location_id=location_id,
                    quantity_change=quantity,
                    reason="PURCHASE_RETURN",
                    reference_id=str(return_txn.id)
                )
    
    def _map_return_status(self, status: ReturnStatus) -> TransactionStatus:
        """Map ReturnStatus to TransactionStatus"""
        status_map = {
            ReturnStatus.PENDING: TransactionStatus.PENDING,
            ReturnStatus.PROCESSING: TransactionStatus.IN_PROGRESS,
            ReturnStatus.COMPLETED: TransactionStatus.COMPLETED,
            ReturnStatus.CANCELLED: TransactionStatus.CANCELLED
        }
        return status_map.get(status, TransactionStatus.PENDING)
    
    def _reverse_map_status(self, status: TransactionStatus) -> ReturnStatus:
        """Map TransactionStatus to ReturnStatus"""
        status_map = {
            TransactionStatus.PENDING: ReturnStatus.PENDING,
            TransactionStatus.IN_PROGRESS: ReturnStatus.PROCESSING,
            TransactionStatus.COMPLETED: ReturnStatus.COMPLETED,
            TransactionStatus.CANCELLED: ReturnStatus.CANCELLED
        }
        return status_map.get(status, ReturnStatus.PENDING)
    
    async def _format_return_response(self, return_txn: TransactionHeader) -> PurchaseReturnResponse:
        """
        Format a return transaction for response.
        
        Args:
            return_txn: Return transaction
            
        Returns:
            Formatted response
        """
        # Get metadata values
        original_purchase_id = None
        payment_status = PaymentStatus.PENDING
        
        for meta in return_txn.metadata_entries:
            if meta.key == "original_purchase_id":
                original_purchase_id = UUID(meta.value)
            elif meta.key == "payment_status":
                payment_status = PaymentStatus(meta.value)
        
        # Format supplier
        supplier_summary = None
        if return_txn.supplier:
            supplier_summary = SupplierSummary(
                id=return_txn.supplier.id,
                name=return_txn.supplier.name,
                supplier_code=return_txn.supplier.supplier_code,
                contact_person=return_txn.supplier.contact_person
            )
        
        # Format original purchase
        purchase_summary = None
        if original_purchase_id:
            original_purchase = await self.repository.get_original_purchase(original_purchase_id)
            if original_purchase:
                purchase_summary = PurchaseSummary(
                    id=original_purchase.id,
                    transaction_number=original_purchase.transaction_number,
                    transaction_date=original_purchase.transaction_date,
                    total_amount=original_purchase.total_amount,
                    supplier_name=original_purchase.supplier.name if original_purchase.supplier else None
                )
        
        # Format line items
        items = []
        for line in return_txn.transaction_lines:
            # Get return reason from metadata
            return_reason = None
            condition = None
            
            for meta in return_txn.metadata_entries:
                if meta.key == f"return_reason_{line.item_id}":
                    return_reason = meta.value
                elif meta.key == f"condition_{line.item_id}":
                    condition = meta.value
            
            item_summary = None
            if line.item:
                item_summary = ItemSummary(
                    id=line.item.id,
                    item_name=line.item.item_name,
                    sku=line.item.sku,
                    brand_name=line.item.brand.name if line.item.brand else None,
                    category_name=line.item.category.name if line.item.category else None
                )
            
            items.append(PurchaseReturnItemResponse(
                id=line.id,
                item_id=line.item_id,
                item=item_summary,
                quantity=line.quantity,
                unit_cost=line.unit_price,
                total_cost=line.total_price,
                return_reason=return_reason,
                condition=condition,
                notes=line.notes,
                serial_numbers=[],
                created_at=line.created_at
            ))
        
        # Calculate totals
        total_items = sum(item.quantity for item in items)
        
        return PurchaseReturnResponse(
            id=return_txn.id,
            transaction_number=return_txn.transaction_number,
            supplier_id=return_txn.supplier_id,
            supplier=supplier_summary,
            original_purchase_id=original_purchase_id,
            original_purchase=purchase_summary,
            return_date=return_txn.transaction_date.date(),
            return_authorization=return_txn.reference_number,
            notes=return_txn.notes,
            status=self._reverse_map_status(return_txn.status),
            payment_status=payment_status,
            total_items=total_items,
            refund_amount=return_txn.total_amount,
            items=items,
            created_at=return_txn.created_at,
            updated_at=return_txn.updated_at,
            created_by=return_txn.created_by,
            updated_by=return_txn.updated_by
        )