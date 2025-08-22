"""
Purchase Returns Service - Business logic for purchase return transactions.
Handles vendor returns with validation, inspection, and stock restoration.
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, date, timezone
from decimal import Decimal
import logging
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError

from app.models.transaction import (
    TransactionHeader, TransactionLine, TransactionEvent, TransactionInspection,
    TransactionType, TransactionStatus, PaymentStatus,
    LineItemType, InspectionStatus, ConditionRating, ItemDisposition
)
from app.models.supplier import Supplier
from app.models.location import Location
from app.models.item import Item

from app.crud.transaction import (
    TransactionHeaderRepository,
    TransactionLineRepository,
    TransactionEventRepository,
)
from app.crud.supplier import SupplierRepository
from app.crud.location import LocationCRUD
from app.crud.item import ItemRepository

from app.schemas.transaction.purchase_returns import (
    PurchaseReturnCreate, PurchaseReturnResponse, PurchaseReturnItemCreate,
    PurchaseReturnValidationError, ReturnReason, ReturnApprovalStatus,
    VendorCreditNote, PurchaseReturnReport
)

from app.core.errors import NotFoundError, ValidationError, ConflictError

logger = logging.getLogger(__name__)


class ReturnType(Enum):
    """Types of purchase returns."""
    DEFECTIVE = "DEFECTIVE"  # Product defect
    DAMAGED = "DAMAGED"      # Damaged in transit
    WRONG_ITEM = "WRONG_ITEM"  # Wrong item shipped
    EXCESS = "EXCESS"        # Excess inventory
    EXPIRED = "EXPIRED"      # Expired products
    RECALL = "RECALL"        # Product recall


class PurchaseReturnsService:
    """Service for handling purchase return transactions."""
    
    # Configuration constants
    RETURN_PERIOD_DAYS = 30  # Default return period
    RESTOCKING_FEE_PERCENT = Decimal("15.00")  # 15% restocking fee
    MIN_CONDITION_FOR_CREDIT = ConditionRating.C  # Minimum condition for vendor credit
    AUTO_APPROVE_THRESHOLD = Decimal("1000.00")  # Auto-approve returns below this amount
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.transaction_repo = TransactionHeaderRepository(session)
        self.line_repo = TransactionLineRepository(session)
        self.event_repo = TransactionEventRepository(session)
        self.supplier_repo = SupplierRepository(session)
        self.location_repo = LocationCRUD(session)
        self.item_repo = ItemRepository(session)
    
    async def create_purchase_return(
        self,
        return_data: PurchaseReturnCreate,
        created_by: Optional[str] = None
    ) -> PurchaseReturnResponse:
        """
        Create a new purchase return transaction.
        
        Args:
            return_data: Purchase return creation data
            created_by: User creating the return
            
        Returns:
            Created purchase return transaction
            
        Raises:
            ValidationError: If validation fails
            NotFoundError: If original purchase not found
            ConflictError: If return quantity exceeds available
        """
        try:
            start_time = datetime.now(timezone.utc)
            
            # Validate return against original purchase
            validation_errors = await self._validate_purchase_return(return_data)
            if validation_errors:
                raise ValidationError(
                    "Purchase return validation failed",
                    details={"errors": validation_errors}
                )
            
            # Get original purchase transaction
            original_purchase = await self.transaction_repo.get_by_id(
                return_data.original_purchase_id,
                include_lines=True
            )
            
            if not original_purchase:
                raise NotFoundError(f"Original purchase {return_data.original_purchase_id} not found")
            
            # Check return eligibility
            eligibility = await self._check_return_eligibility(
                original_purchase,
                return_data
            )
            if not eligibility["eligible"]:
                raise ValidationError(
                    "Purchase not eligible for return",
                    details=eligibility
                )
            
            # Generate transaction number
            transaction_number = await self._generate_transaction_number()
            
            # Calculate return amounts
            return_amounts = await self._calculate_return_amounts(
                original_purchase,
                return_data.items,
                return_data.return_reason
            )
            
            # Create return transaction header
            transaction = TransactionHeader(
                transaction_type=TransactionType.RETURN,
                transaction_number=transaction_number,
                status=TransactionStatus.PENDING,
                transaction_date=datetime.now(timezone.utc),
                supplier_id=original_purchase.supplier_id,
                location_id=return_data.location_id or original_purchase.location_id,
                reference_transaction_id=original_purchase.id,
                currency=original_purchase.currency,
                subtotal=-return_amounts["subtotal"],  # Negative for returns
                discount_amount=-return_amounts["discount_amount"],
                tax_amount=-return_amounts["tax_amount"],
                total_amount=-return_amounts["total_amount"],
                paid_amount=Decimal("0.00"),
                payment_status=PaymentStatus.PENDING,
                reference_number=return_data.rma_number,
                notes=f"Return for {original_purchase.transaction_number}\nReason: {return_data.return_reason.value}\n{return_data.notes or ''}",
                created_by=created_by,
                updated_by=created_by
            )
            
            self.session.add(transaction)
            await self.session.flush()
            
            # Create return lines with inspection requirements
            lines = await self._create_return_lines(
                transaction.id,
                original_purchase,
                return_data.items,
                created_by
            )
            
            # Create initial inspection records if required
            if return_data.requires_inspection:
                await self._create_inspection_records(lines, created_by)
            
            # Create return event
            await self.event_repo.create_transaction_event(
                transaction_id=transaction.id,
                event_type="PURCHASE_RETURN_CREATED",
                description=f"Purchase return {transaction_number} created",
                user_id=created_by,
                operation="create_purchase_return",
                duration_ms=int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000),
                event_data={
                    "original_purchase": str(original_purchase.id),
                    "return_reason": return_data.return_reason.value,
                    "total_items": len(return_data.items),
                    "return_value": str(return_amounts["total_amount"])
                }
            )
            
            # Auto-approve if below threshold and conditions met
            if await self._should_auto_approve(return_amounts["total_amount"], return_data.return_reason):
                await self._approve_return(transaction, created_by)
            
            # Update original purchase reference
            await self._update_original_purchase(original_purchase, return_data.items)
            
            await self.session.commit()
            
            # Reload with relationships
            transaction = await self.transaction_repo.get_by_id(
                transaction.id,
                include_lines=True
            )
            
            return PurchaseReturnResponse.from_transaction(transaction)
            
        except IntegrityError as e:
            await self.session.rollback()
            logger.error(f"Database integrity error: {e}")
            raise ConflictError("Purchase return creation failed due to data conflict")
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Purchase return creation failed: {e}")
            raise
    
    async def process_inspection(
        self,
        return_id: UUID,
        line_id: UUID,
        inspection_data: Dict[str, Any],
        inspector_id: Optional[str] = None
    ) -> PurchaseReturnResponse:
        """
        Process inspection for a return line item.
        
        Args:
            return_id: Return transaction ID
            line_id: Transaction line ID
            inspection_data: Inspection details
            inspector_id: Inspector user ID
            
        Returns:
            Updated return transaction
        """
        transaction = await self.transaction_repo.get_by_id(
            return_id,
            include_lines=True
        )
        
        if not transaction:
            raise NotFoundError(f"Return transaction {return_id} not found")
        
        if transaction.transaction_type != TransactionType.RETURN:
            raise ValidationError(f"Transaction {return_id} is not a return")
        
        # Get the specific line
        line = next((l for l in transaction.transaction_lines if l.id == line_id), None)
        if not line:
            raise NotFoundError(f"Line {line_id} not found in return {return_id}")
        
        # Update or create inspection
        if line.inspection:
            inspection = line.inspection
            inspection.condition_rating = ConditionRating[inspection_data["condition_rating"]]
            inspection.damage_description = inspection_data.get("damage_description")
            inspection.repair_cost_estimate = inspection_data.get("repair_cost", Decimal("0.00"))
            inspection.disposition = ItemDisposition[inspection_data["disposition"]]
            inspection.status = InspectionStatus.COMPLETED
            inspection.inspector_id = inspector_id
            inspection.updated_by = inspector_id
        else:
            inspection = TransactionInspection(
                transaction_line_id=line_id,
                condition_rating=ConditionRating[inspection_data["condition_rating"]],
                damage_description=inspection_data.get("damage_description"),
                repair_cost_estimate=inspection_data.get("repair_cost", Decimal("0.00")),
                disposition=ItemDisposition[inspection_data["disposition"]],
                status=InspectionStatus.COMPLETED,
                inspector_id=inspector_id,
                photos_taken=bool(inspection_data.get("photos")),
                photo_urls=inspection_data.get("photos"),
                inspection_notes=inspection_data.get("notes"),
                created_by=inspector_id
            )
            self.session.add(inspection)
        
        # Update line status based on inspection
        line.inspection_status = "COMPLETED"
        line.return_condition = inspection.condition_rating.value
        
        # Determine if item should be returned to vendor or stock
        if inspection.condition_rating.value <= self.MIN_CONDITION_FOR_CREDIT.value:
            line.return_to_stock = False  # Return to vendor for credit
        else:
            line.return_to_stock = inspection.disposition == ItemDisposition.RETURN_TO_STOCK
        
        await self.session.flush()
        
        # Create inspection event
        await self.event_repo.create_transaction_event(
            transaction_id=transaction.id,
            event_type="INSPECTION_COMPLETED",
            description=f"Inspection completed for line {line.line_number}",
            user_id=inspector_id,
            event_data={
                "line_id": str(line_id),
                "condition": inspection.condition_rating.value,
                "disposition": inspection.disposition.value,
                "repair_cost": str(inspection.repair_cost_estimate)
            }
        )
        
        # Check if all inspections are complete
        if await self._all_inspections_complete(transaction):
            await self._finalize_return(transaction, inspector_id)
        
        await self.session.commit()
        
        return PurchaseReturnResponse.from_transaction(transaction)
    
    async def approve_return(
        self,
        return_id: UUID,
        approval_data: Dict[str, Any],
        approved_by: Optional[str] = None
    ) -> PurchaseReturnResponse:
        """
        Approve a purchase return for processing.
        
        Args:
            return_id: Return transaction ID
            approval_data: Approval details
            approved_by: Approver user ID
            
        Returns:
            Updated return transaction
        """
        transaction = await self.transaction_repo.get_by_id(
            return_id,
            include_lines=True
        )
        
        if not transaction:
            raise NotFoundError(f"Return transaction {return_id} not found")
        
        if transaction.transaction_type != TransactionType.RETURN:
            raise ValidationError(f"Transaction {return_id} is not a return")
        
        if transaction.status != TransactionStatus.PENDING:
            raise ValidationError(f"Return {return_id} is not pending approval")
        
        # Approve the return
        await self._approve_return(transaction, approved_by, approval_data.get("notes"))
        
        await self.session.commit()
        
        return PurchaseReturnResponse.from_transaction(transaction)
    
    async def process_vendor_credit(
        self,
        return_id: UUID,
        credit_data: VendorCreditNote,
        processed_by: Optional[str] = None
    ) -> PurchaseReturnResponse:
        """
        Process vendor credit for approved return.
        
        Args:
            return_id: Return transaction ID
            credit_data: Vendor credit note details
            processed_by: User processing the credit
            
        Returns:
            Updated return transaction
        """
        transaction = await self.transaction_repo.get_by_id(
            return_id,
            include_lines=True
        )
        
        if not transaction:
            raise NotFoundError(f"Return transaction {return_id} not found")
        
        if transaction.status != TransactionStatus.PROCESSING:
            raise ValidationError(f"Return {return_id} is not ready for credit processing")
        
        # Update transaction with credit details
        transaction.payment_status = PaymentStatus.REFUNDED
        transaction.payment_reference = credit_data.credit_note_number
        transaction.paid_amount = -credit_data.credit_amount  # Negative for credit
        transaction.status = TransactionStatus.COMPLETED
        transaction.updated_by = processed_by
        
        # Update vendor account (would integrate with accounting)
        await self._update_vendor_account(
            transaction.supplier_id,
            credit_data.credit_amount,
            credit_data.credit_note_number
        )
        
        await self.session.flush()
        
        # Create credit event
        await self.event_repo.create_transaction_event(
            transaction_id=transaction.id,
            event_type="VENDOR_CREDIT_PROCESSED",
            description=f"Vendor credit of {credit_data.credit_amount} processed",
            user_id=processed_by,
            event_data={
                "credit_note": credit_data.credit_note_number,
                "amount": str(credit_data.credit_amount),
                "expiry_date": credit_data.expiry_date.isoformat() if credit_data.expiry_date else None
            }
        )
        
        await self.session.commit()
        
        return PurchaseReturnResponse.from_transaction(transaction)
    
    async def ship_to_vendor(
        self,
        return_id: UUID,
        shipping_data: Dict[str, Any],
        shipped_by: Optional[str] = None
    ) -> PurchaseReturnResponse:
        """
        Record shipment of returned items to vendor.
        
        Args:
            return_id: Return transaction ID
            shipping_data: Shipping details
            shipped_by: User recording shipment
            
        Returns:
            Updated return transaction
        """
        transaction = await self.transaction_repo.get_by_id(
            return_id,
            include_lines=True
        )
        
        if not transaction:
            raise NotFoundError(f"Return transaction {return_id} not found")
        
        if transaction.status != TransactionStatus.PROCESSING:
            raise ValidationError(f"Return {return_id} is not ready for shipping")
        
        # Update shipping information
        transaction.delivery_required = True
        transaction.delivery_date = shipping_data["ship_date"]
        transaction.reference_number = shipping_data.get("tracking_number")
        transaction.updated_by = shipped_by
        
        # Update line items
        for line in transaction.transaction_lines:
            if not line.return_to_stock:  # Items going back to vendor
                line.fulfillment_status = "SHIPPED"
        
        await self.session.flush()
        
        # Create shipping event
        await self.event_repo.create_transaction_event(
            transaction_id=transaction.id,
            event_type="RETURN_SHIPPED",
            description="Return items shipped to vendor",
            user_id=shipped_by,
            event_data={
                "carrier": shipping_data.get("carrier"),
                "tracking": shipping_data.get("tracking_number"),
                "ship_date": shipping_data["ship_date"].isoformat()
            }
        )
        
        await self.session.commit()
        
        return PurchaseReturnResponse.from_transaction(transaction)
    
    async def generate_return_report(
        self,
        date_from: date,
        date_to: date,
        supplier_id: Optional[UUID] = None,
        location_id: Optional[UUID] = None
    ) -> PurchaseReturnReport:
        """
        Generate purchase return report for a period.
        
        Args:
            date_from: Start date
            date_to: End date
            supplier_id: Optional supplier filter
            location_id: Optional location filter
            
        Returns:
            Purchase return report
        """
        # Get returns for period
        query = select(TransactionHeader).where(
            and_(
                TransactionHeader.transaction_type == TransactionType.RETURN,
                TransactionHeader.transaction_date >= datetime.combine(date_from, datetime.min.time()),
                TransactionHeader.transaction_date <= datetime.combine(date_to, datetime.max.time())
            )
        ).options(
            selectinload(TransactionHeader.transaction_lines),
            selectinload(TransactionHeader.reference_transaction)
        )
        
        if supplier_id:
            query = query.where(TransactionHeader.supplier_id == supplier_id)
        
        if location_id:
            query = query.where(TransactionHeader.location_id == location_id)
        
        result = await self.session.execute(query)
        returns = result.scalars().all()
        
        # Calculate report metrics
        total_returns = len(returns)
        total_value = sum(abs(r.total_amount) for r in returns)
        
        # Group by reason (from notes parsing - simplified)
        reason_breakdown = {}
        for return_tx in returns:
            # Parse reason from notes (would be structured in production)
            reason = self._extract_return_reason(return_tx.notes)
            if reason not in reason_breakdown:
                reason_breakdown[reason] = {
                    "count": 0,
                    "value": Decimal("0.00")
                }
            reason_breakdown[reason]["count"] += 1
            reason_breakdown[reason]["value"] += abs(return_tx.total_amount)
        
        # Status breakdown
        status_breakdown = {}
        for return_tx in returns:
            status = return_tx.status.value
            if status not in status_breakdown:
                status_breakdown[status] = {
                    "count": 0,
                    "value": Decimal("0.00")
                }
            status_breakdown[status]["count"] += 1
            status_breakdown[status]["value"] += abs(return_tx.total_amount)
        
        # Top returned items
        item_returns = {}
        for return_tx in returns:
            for line in return_tx.transaction_lines:
                if line.item_id:
                    item_id = str(line.item_id)
                    if item_id not in item_returns:
                        item_returns[item_id] = {
                            "item_name": line.description,
                            "quantity": Decimal("0.00"),
                            "value": Decimal("0.00"),
                            "return_count": 0
                        }
                    item_returns[item_id]["quantity"] += abs(line.quantity)
                    item_returns[item_id]["value"] += abs(line.line_total)
                    item_returns[item_id]["return_count"] += 1
        
        # Sort and get top 10 items by value
        top_items = sorted(
            item_returns.values(),
            key=lambda x: x["value"],
            reverse=True
        )[:10]
        
        # Calculate average processing time
        processing_times = []
        for return_tx in returns:
            if return_tx.status == TransactionStatus.COMPLETED:
                # Get completion time from events (simplified)
                processing_time = (return_tx.updated_at - return_tx.created_at).days
                processing_times.append(processing_time)
        
        avg_processing_days = (
            sum(processing_times) / len(processing_times)
            if processing_times else 0
        )
        
        return PurchaseReturnReport(
            period_start=date_from,
            period_end=date_to,
            total_returns=total_returns,
            total_value=total_value,
            reason_breakdown=reason_breakdown,
            status_breakdown=status_breakdown,
            top_returned_items=top_items,
            average_processing_days=avg_processing_days,
            supplier_id=supplier_id,
            location_id=location_id
        )
    
    # Private helper methods
    
    async def _validate_purchase_return(
        self,
        return_data: PurchaseReturnCreate
    ) -> List[PurchaseReturnValidationError]:
        """Validate purchase return data."""
        errors = []
        
        # Get original purchase
        original = await self.transaction_repo.get_by_id(
            return_data.original_purchase_id,
            include_lines=True
        )
        
        if not original:
            errors.append(PurchaseReturnValidationError(
                field="original_purchase_id",
                message="Original purchase not found",
                code="PURCHASE_NOT_FOUND"
            ))
            return errors
        
        if original.transaction_type != TransactionType.PURCHASE:
            errors.append(PurchaseReturnValidationError(
                field="original_purchase_id",
                message="Referenced transaction is not a purchase",
                code="NOT_A_PURCHASE"
            ))
        
        if original.status == TransactionStatus.CANCELLED:
            errors.append(PurchaseReturnValidationError(
                field="original_purchase_id",
                message="Cannot return cancelled purchase",
                code="PURCHASE_CANCELLED"
            ))
        
        # Validate return items
        original_items = {line.item_id: line for line in original.transaction_lines}
        
        for idx, item_data in enumerate(return_data.items):
            if item_data.item_id not in original_items:
                errors.append(PurchaseReturnValidationError(
                    field=f"items[{idx}].item_id",
                    message="Item not found in original purchase",
                    code="ITEM_NOT_IN_PURCHASE"
                ))
                continue
            
            original_line = original_items[item_data.item_id]
            
            # Check quantity
            already_returned = await self._get_returned_quantity(
                original.id,
                item_data.item_id
            )
            available_to_return = original_line.quantity - already_returned
            
            if item_data.quantity > available_to_return:
                errors.append(PurchaseReturnValidationError(
                    field=f"items[{idx}].quantity",
                    message=f"Can only return {available_to_return} units",
                    code="EXCESSIVE_QUANTITY",
                    details={
                        "original": original_line.quantity,
                        "already_returned": already_returned,
                        "available": available_to_return,
                        "requested": item_data.quantity
                    }
                ))
        
        return errors
    
    async def _check_return_eligibility(
        self,
        original_purchase: TransactionHeader,
        return_data: PurchaseReturnCreate
    ) -> Dict[str, Any]:
        """Check if purchase is eligible for return."""
        # Check return period
        days_since_purchase = (datetime.now(timezone.utc).date() - original_purchase.transaction_date.date()).days
        
        if days_since_purchase > self.RETURN_PERIOD_DAYS:
            # Check if special reason allows extended return
            if return_data.return_reason not in [ReturnType.DEFECTIVE, ReturnType.RECALL]:
                return {
                    "eligible": False,
                    "reason": "Return period expired",
                    "days_since_purchase": days_since_purchase,
                    "return_period": self.RETURN_PERIOD_DAYS
                }
        
        return {"eligible": True}
    
    async def _calculate_return_amounts(
        self,
        original_purchase: TransactionHeader,
        return_items: List[PurchaseReturnItemCreate],
        return_reason: ReturnType
    ) -> Dict[str, Decimal]:
        """Calculate return amounts including fees."""
        subtotal = Decimal("0.00")
        tax_amount = Decimal("0.00")
        discount_amount = Decimal("0.00")
        restocking_fee = Decimal("0.00")
        
        original_lines = {line.item_id: line for line in original_purchase.transaction_lines}
        
        for return_item in return_items:
            if return_item.item_id not in original_lines:
                continue
            
            original_line = original_lines[return_item.item_id]
            
            # Calculate proportional amounts
            return_ratio = return_item.quantity / original_line.quantity
            
            line_subtotal = original_line.total_price * return_ratio
            line_discount = original_line.discount_amount * return_ratio
            line_tax = original_line.tax_amount * return_ratio
            
            subtotal += line_subtotal
            discount_amount += line_discount
            tax_amount += line_tax
            
            # Apply restocking fee for certain reasons
            if return_reason in [ReturnType.EXCESS, ReturnType.WRONG_ITEM]:
                item_restocking = line_subtotal * self.RESTOCKING_FEE_PERCENT / 100
                restocking_fee += item_restocking
        
        total_amount = subtotal - discount_amount + tax_amount - restocking_fee
        
        return {
            "subtotal": subtotal,
            "discount_amount": discount_amount,
            "tax_amount": tax_amount,
            "restocking_fee": restocking_fee,
            "total_amount": total_amount
        }
    
    async def _create_return_lines(
        self,
        transaction_id: UUID,
        original_purchase: TransactionHeader,
        return_items: List[PurchaseReturnItemCreate],
        created_by: Optional[str] = None
    ) -> List[TransactionLine]:
        """Create return transaction lines."""
        lines = []
        original_lines = {line.item_id: line for line in original_purchase.transaction_lines}
        
        for idx, return_item in enumerate(return_items, 1):
            if return_item.item_id not in original_lines:
                continue
            
            original_line = original_lines[return_item.item_id]
            
            # Calculate proportional amounts
            return_ratio = return_item.quantity / original_line.quantity
            
            line = TransactionLine(
                transaction_header_id=transaction_id,
                line_number=idx,
                line_type=LineItemType.PRODUCT,
                item_id=return_item.item_id,
                sku=original_line.sku,
                description=original_line.description,
                category=original_line.category,
                quantity=-return_item.quantity,  # Negative for returns
                unit_of_measure=original_line.unit_of_measure,
                unit_price=original_line.unit_price,
                total_price=-(original_line.total_price * return_ratio),
                discount_percent=original_line.discount_percent,
                discount_amount=-(original_line.discount_amount * return_ratio),
                tax_rate=original_line.tax_rate,
                tax_amount=-(original_line.tax_amount * return_ratio),
                line_total=-(original_line.line_total * return_ratio),
                location_id=return_item.location_id or original_line.location_id,
                status="PENDING",
                fulfillment_status="PENDING",
                return_condition=return_item.condition,
                inspection_status="PENDING" if return_item.requires_inspection else None,
                notes=return_item.notes,
                created_by=created_by,
                updated_by=created_by
            )
            
            self.session.add(line)
            lines.append(line)
        
        await self.session.flush()
        return lines
    
    async def _create_inspection_records(
        self,
        lines: List[TransactionLine],
        created_by: Optional[str] = None
    ):
        """Create initial inspection records for return lines."""
        for line in lines:
            if line.inspection_status == "PENDING":
                inspection = TransactionInspection(
                    transaction_line_id=line.id,
                    status=InspectionStatus.PENDING,
                    condition_rating=ConditionRating.A,  # Default, to be updated
                    created_by=created_by
                )
                self.session.add(inspection)
        
        await self.session.flush()
    
    async def _should_auto_approve(
        self,
        return_amount: Decimal,
        return_reason: ReturnType
    ) -> bool:
        """Check if return should be auto-approved."""
        # Auto-approve for defects and recalls
        if return_reason in [ReturnType.DEFECTIVE, ReturnType.RECALL]:
            return True
        
        # Auto-approve if below threshold
        if return_amount <= self.AUTO_APPROVE_THRESHOLD:
            return True
        
        return False
    
    async def _approve_return(
        self,
        transaction: TransactionHeader,
        approved_by: Optional[str] = None,
        notes: Optional[str] = None
    ):
        """Approve a return for processing."""
        transaction.status = TransactionStatus.PROCESSING
        transaction.updated_by = approved_by
        
        if notes:
            transaction.notes = (transaction.notes or "") + f"\nApproval: {notes}"
        
        # Update line statuses
        for line in transaction.transaction_lines:
            line.status = "APPROVED"
        
        await self.session.flush()
        
        # Create approval event
        await self.event_repo.create_transaction_event(
            transaction_id=transaction.id,
            event_type="RETURN_APPROVED",
            description="Return approved for processing",
            user_id=approved_by
        )
    
    async def _update_original_purchase(
        self,
        original_purchase: TransactionHeader,
        return_items: List[PurchaseReturnItemCreate]
    ):
        """Update original purchase with return information."""
        # Add return reference to notes
        original_purchase.notes = (
            (original_purchase.notes or "") + 
            f"\nReturn initiated on {datetime.now(timezone.utc).date()}"
        )
        
        # Update line items with returned quantities
        original_lines = {line.item_id: line for line in original_purchase.transaction_lines}
        
        for return_item in return_items:
            if return_item.item_id in original_lines:
                line = original_lines[return_item.item_id]
                line.returned_quantity += return_item.quantity
        
        await self.session.flush()
    
    async def _all_inspections_complete(
        self,
        transaction: TransactionHeader
    ) -> bool:
        """Check if all required inspections are complete."""
        for line in transaction.transaction_lines:
            if line.inspection_status == "PENDING":
                return False
        return True
    
    async def _finalize_return(
        self,
        transaction: TransactionHeader,
        finalized_by: Optional[str] = None
    ):
        """Finalize return after all inspections."""
        # Determine final disposition
        all_to_vendor = all(
            not line.return_to_stock 
            for line in transaction.transaction_lines
        )
        
        if all_to_vendor:
            # Ready for vendor return
            transaction.notes = (transaction.notes or "") + "\nReady for vendor return"
        else:
            # Some items to stock, some to vendor
            transaction.notes = (transaction.notes or "") + "\nPartial stock restoration"
            
            # Restore stock for applicable items
            for line in transaction.transaction_lines:
                if line.return_to_stock:
                    await self._restore_stock(line)
        
        await self.session.flush()
        
        # Create finalization event
        await self.event_repo.create_transaction_event(
            transaction_id=transaction.id,
            event_type="RETURN_FINALIZED",
            description="Return processing finalized",
            user_id=finalized_by
        )
    
    async def _restore_stock(self, line: TransactionLine):
        """Restore item to stock after return."""
        # This would integrate with inventory service
        logger.info(
            f"Restoring {abs(line.quantity)} of item {line.item_id} "
            f"to location {line.location_id}"
        )
        # await inventory_service.restore_stock(...)
    
    async def _update_vendor_account(
        self,
        supplier_id: UUID,
        credit_amount: Decimal,
        credit_note: str
    ):
        """Update vendor account with credit."""
        # This would integrate with accounting system
        logger.info(
            f"Applying credit of {credit_amount} to supplier {supplier_id} "
            f"with credit note {credit_note}"
        )
    
    async def _get_returned_quantity(
        self,
        original_purchase_id: UUID,
        item_id: UUID
    ) -> Decimal:
        """Get quantity already returned for an item."""
        query = select(func.sum(func.abs(TransactionLine.quantity))).where(
            and_(
                TransactionLine.item_id == item_id,
                TransactionLine.transaction_header_id.in_(
                    select(TransactionHeader.id).where(
                        and_(
                            TransactionHeader.reference_transaction_id == original_purchase_id,
                            TransactionHeader.transaction_type == TransactionType.RETURN,
                            TransactionHeader.status != TransactionStatus.CANCELLED
                        )
                    )
                )
            )
        )
        result = await self.session.execute(query)
        return result.scalar() or Decimal("0.00")
    
    async def _generate_transaction_number(self) -> str:
        """Generate unique return transaction number."""
        now = datetime.now(timezone.utc)
        prefix = f"RET-{now.strftime('%Y%m%d')}"
        
        # Get count of returns today
        start_of_day = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        query = select(func.count(TransactionHeader.id)).where(
            and_(
                TransactionHeader.transaction_type == TransactionType.RETURN,
                TransactionHeader.transaction_date >= start_of_day
            )
        )
        result = await self.session.execute(query)
        count = result.scalar() or 0
        
        return f"{prefix}-{count + 1:04d}"
    
    def _extract_return_reason(self, notes: Optional[str]) -> str:
        """Extract return reason from notes (simplified)."""
        if not notes:
            return "UNKNOWN"
        
        # Simple keyword matching (would be more sophisticated in production)
        keywords = {
            "defective": "DEFECTIVE",
            "damaged": "DAMAGED",
            "wrong": "WRONG_ITEM",
            "excess": "EXCESS",
            "expired": "EXPIRED",
            "recall": "RECALL"
        }
        
        notes_lower = notes.lower()
        for keyword, reason in keywords.items():
            if keyword in notes_lower:
                return reason
        
        return "OTHER"