"""
Models for rental return inspections and purchase credit memos.
"""
from typing import List, Dict, Any, Optional
from decimal import Decimal
from datetime import datetime
from uuid import UUID, uuid4
from sqlalchemy import Column, String, Text, Boolean, DateTime, Numeric, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.db.base import RentalManagerBaseModel, UUIDType


class RentalInspection(RentalManagerBaseModel):
    """Rental return inspection results."""
    
    __tablename__ = "rental_inspections"
    
    # id inherited from RentalManagerBaseModel
    return_id = Column(UUIDType(), ForeignKey("transaction_headers.id"), nullable=False)
    inspector_id = Column(UUIDType(), nullable=False)  # Removed FK constraint temporarily
    inspection_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # Overall assessment
    overall_condition = Column(String(20), nullable=False)  # EXCELLENT, GOOD, FAIR, POOR
    inspection_passed = Column(Boolean, nullable=False)
    
    # Financial calculations
    total_repair_cost = Column(Numeric(10, 2), nullable=False, default=0)
    total_cleaning_cost = Column(Numeric(10, 2), nullable=False, default=0)
    total_deductions = Column(Numeric(10, 2), nullable=False, default=0)
    deposit_refund_amount = Column(Numeric(10, 2), nullable=False, default=0)
    
    # Additional information
    general_notes = Column(Text)
    customer_notification_required = Column(Boolean, nullable=False, default=False)
    follow_up_actions = Column(JSON)  # List of follow-up actions
    
    # Line item inspections stored as JSON for flexibility
    line_inspections = Column(JSON, nullable=False)
    
    # Relationships
    return_transaction = relationship("TransactionHeader", foreign_keys=[return_id])
    # inspector = relationship("User", foreign_keys=[inspector_id])  # Disabled temporarily
    
    def __init__(
        self,
        return_id: str | UUID,
        inspector_id: str | UUID,
        overall_condition: str,
        inspection_passed: bool,
        line_inspections: List[Dict[str, Any]],
        inspection_date: Optional[datetime] = None,
        total_repair_cost: Decimal = Decimal("0.00"),
        total_cleaning_cost: Decimal = Decimal("0.00"),
        total_deductions: Decimal = Decimal("0.00"),
        deposit_refund_amount: Decimal = Decimal("0.00"),
        general_notes: Optional[str] = None,
        customer_notification_required: bool = False,
        follow_up_actions: Optional[List[Dict[str, Any]]] = None,
        **kwargs
    ):
        """
        Initialize a Rental Inspection.
        
        Args:
            return_id: Return transaction ID
            inspector_id: Inspector user ID
            overall_condition: Overall condition assessment
            inspection_passed: Whether inspection passed
            line_inspections: Line item inspections
            inspection_date: Inspection date
            total_repair_cost: Total repair cost
            total_cleaning_cost: Total cleaning cost
            total_deductions: Total deductions
            deposit_refund_amount: Deposit refund amount
            general_notes: General notes
            customer_notification_required: Whether customer notification is required
            follow_up_actions: List of follow-up actions
            **kwargs: Additional BaseModel fields
        """
        super().__init__(**kwargs)
        self.return_id = return_id
        self.inspector_id = inspector_id
        self.inspection_date = inspection_date or datetime.now(timezone.utc)
        self.overall_condition = overall_condition
        self.inspection_passed = inspection_passed
        self.total_repair_cost = total_repair_cost
        self.total_cleaning_cost = total_cleaning_cost
        self.total_deductions = total_deductions
        self.deposit_refund_amount = deposit_refund_amount
        self.general_notes = general_notes
        self.customer_notification_required = customer_notification_required
        self.follow_up_actions = follow_up_actions or []
        self.line_inspections = line_inspections
        self._validate()
    
    def _validate(self):
        """Validate inspection data."""
        if not self.return_id:
            raise ValueError("Return ID is required")
        
        if not self.inspector_id:
            raise ValueError("Inspector ID is required")
        
        if not self.overall_condition or not self.overall_condition.strip():
            raise ValueError("Overall condition cannot be empty")
        
        if self.overall_condition not in ["EXCELLENT", "GOOD", "FAIR", "POOR"]:
            raise ValueError("Overall condition must be EXCELLENT, GOOD, FAIR, or POOR")
        
        if self.total_repair_cost < 0:
            raise ValueError("Total repair cost cannot be negative")
        
        if self.total_cleaning_cost < 0:
            raise ValueError("Total cleaning cost cannot be negative")
        
        if self.total_deductions < 0:
            raise ValueError("Total deductions cannot be negative")
        
        if self.deposit_refund_amount < 0:
            raise ValueError("Deposit refund amount cannot be negative")
        
        if not isinstance(self.line_inspections, list):
            raise ValueError("Line inspections must be a list")


class PurchaseCreditMemo(RentalManagerBaseModel):
    """Purchase return credit memo tracking."""
    
    __tablename__ = "purchase_credit_memos"
    
    # id inherited from RentalManagerBaseModel
    return_id = Column(UUIDType(), ForeignKey("transaction_headers.id"), nullable=False)
    credit_memo_number = Column(String(100), nullable=False, unique=True)
    credit_date = Column(DateTime, nullable=False)
    credit_amount = Column(Numeric(10, 2), nullable=False)
    
    # Credit details
    credit_type = Column(String(20), nullable=False)  # FULL_REFUND, PARTIAL_REFUND, etc.
    currency = Column(String(3), nullable=False, default="USD")
    exchange_rate = Column(Numeric(10, 6), nullable=False, default=1.0)
    
    # Line item breakdown (optional)
    line_credits = Column(JSON)
    
    # Additional information
    credit_terms = Column(String(500))
    supplier_notes = Column(Text)
    received_by = Column(UUIDType(), nullable=False)  # Removed FK constraint temporarily
    
    # Relationships
    return_transaction = relationship("TransactionHeader", foreign_keys=[return_id])
    # received_by_user = relationship("User", foreign_keys=[received_by])  # Disabled temporarily
    
    def __init__(
        self,
        return_id: str | UUID,
        credit_memo_number: str,
        credit_date: datetime,
        credit_amount: Decimal,
        credit_type: str,
        received_by: str | UUID,
        currency: str = "USD",
        exchange_rate: Decimal = Decimal("1.0"),
        line_credits: Optional[List[Dict[str, Any]]] = None,
        credit_terms: Optional[str] = None,
        supplier_notes: Optional[str] = None,
        **kwargs
    ):
        """
        Initialize a Purchase Credit Memo.
        
        Args:
            return_id: Return transaction ID
            credit_memo_number: Credit memo number
            credit_date: Credit date
            credit_amount: Credit amount
            credit_type: Credit type
            received_by: User who received the credit
            currency: Currency code
            exchange_rate: Exchange rate
            line_credits: Line item breakdown
            credit_terms: Credit terms
            supplier_notes: Supplier notes
            **kwargs: Additional BaseModel fields
        """
        super().__init__(**kwargs)
        self.return_id = return_id
        self.credit_memo_number = credit_memo_number
        self.credit_date = credit_date
        self.credit_amount = credit_amount
        self.credit_type = credit_type
        self.currency = currency
        self.exchange_rate = exchange_rate
        self.line_credits = line_credits or []
        self.credit_terms = credit_terms
        self.supplier_notes = supplier_notes
        self.received_by = received_by
        self._validate()
    
    def _validate(self):
        """Validate credit memo data."""
        if not self.return_id:
            raise ValueError("Return ID is required")
        
        if not self.credit_memo_number or not self.credit_memo_number.strip():
            raise ValueError("Credit memo number cannot be empty")
        
        if self.credit_amount < 0:
            raise ValueError("Credit amount cannot be negative")
        
        if not self.credit_type or not self.credit_type.strip():
            raise ValueError("Credit type cannot be empty")
        
        if not self.received_by:
            raise ValueError("Received by user ID is required")
        
        if len(self.currency) != 3:
            raise ValueError("Currency code must be 3 characters")
        
        if self.exchange_rate <= 0:
            raise ValueError("Exchange rate must be positive")