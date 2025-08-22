"""
Purchase returns schemas for request/response validation.
Includes schemas for vendor returns, defective items, and credit processing.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator
from typing_extensions import Annotated

from app.models.transaction.enums import (
    TransactionStatus,
    ReturnType,
    ReturnStatus,
    ItemDisposition,
    ConditionRating,
    DamageSeverity,
)


class PurchaseReturnItemCreate(BaseModel):
    """Schema for creating a purchase return line item."""
    
    purchase_line_id: UUID
    item_id: UUID
    quantity: Annotated[int, Field(gt=0)]
    unit_cost: Annotated[Decimal, Field(ge=0, decimal_places=2)]
    return_reason: ReturnType
    condition_rating: ConditionRating
    defect_description: Optional[str] = Field(None, max_length=1000)
    serial_numbers: Optional[List[str]] = None
    batch_numbers: Optional[List[str]] = None
    notes: Optional[str] = Field(None, max_length=1000)
    
    @model_validator(mode="after")
    def validate_defect_info(self) -> "PurchaseReturnItemCreate":
        """Validate defect information for defective returns."""
        if self.return_reason == ReturnType.DEFECTIVE and not self.defect_description:
            raise ValueError("Defect description required for defective returns")
        if self.return_reason == ReturnType.DEFECTIVE and self.condition_rating == ConditionRating.EXCELLENT:
            raise ValueError("Defective items cannot have excellent condition rating")
        return self


class PurchaseReturnItemResponse(BaseModel):
    """Response schema for a purchase return line item."""
    
    id: UUID
    return_id: UUID
    purchase_line_id: UUID
    item_id: UUID
    item_name: str
    item_sku: str
    quantity: int
    unit_cost: Decimal
    total_cost: Decimal
    return_reason: ReturnType
    condition_rating: ConditionRating
    defect_description: Optional[str] = None
    serial_numbers: Optional[List[str]] = None
    batch_numbers: Optional[List[str]] = None
    disposition: Optional[ItemDisposition] = None
    inspection_notes: Optional[str] = None
    credit_amount: Decimal
    restocking_fee: Decimal = Decimal("0.00")
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class PurchaseReturnCreate(BaseModel):
    """Schema for creating a purchase return."""
    
    purchase_id: UUID
    supplier_id: UUID
    location_id: UUID
    reference_number: str = Field(..., min_length=1, max_length=100)
    return_date: datetime = Field(default_factory=datetime.utcnow)
    return_type: ReturnType
    rma_number: Optional[str] = Field(None, max_length=100)
    items: List[PurchaseReturnItemCreate] = Field(..., min_length=1)
    shipping_method: Optional[str] = Field(None, max_length=100)
    tracking_number: Optional[str] = Field(None, max_length=100)
    return_shipping_cost: Annotated[Decimal, Field(ge=0, decimal_places=2)] = Decimal("0.00")
    restocking_fee_percent: Annotated[Decimal, Field(ge=0, le=100)] = Decimal("0.00")
    notes: Optional[str] = Field(None, max_length=2000)
    require_inspection: bool = True
    metadata: Optional[Dict[str, Any]] = None
    
    @model_validator(mode="after")
    def validate_rma_for_warranty(self) -> "PurchaseReturnCreate":
        """Validate RMA number for warranty returns."""
        if self.return_type == ReturnType.WARRANTY_CLAIM and not self.rma_number:
            raise ValueError("RMA number required for warranty claims")
        return self


class PurchaseReturnUpdate(BaseModel):
    """Schema for updating a purchase return."""
    
    status: Optional[ReturnStatus] = None
    rma_number: Optional[str] = Field(None, max_length=100)
    tracking_number: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=2000)
    metadata: Optional[Dict[str, Any]] = None


class PurchaseReturnInspection(BaseModel):
    """Schema for purchase return inspection."""
    
    return_line_id: UUID
    condition_verified: bool
    condition_rating: ConditionRating
    damage_severity: Optional[DamageSeverity] = None
    disposition: ItemDisposition
    inspection_notes: str = Field(..., min_length=1, max_length=1000)
    repair_cost_estimate: Optional[Annotated[Decimal, Field(ge=0, decimal_places=2)]] = None
    salvage_value: Optional[Annotated[Decimal, Field(ge=0, decimal_places=2)]] = None
    photos: Optional[List[str]] = None
    inspector_id: UUID
    
    @model_validator(mode="after")
    def validate_disposition(self) -> "PurchaseReturnInspection":
        """Validate disposition requirements."""
        if self.disposition == ItemDisposition.REPAIR and not self.repair_cost_estimate:
            raise ValueError("Repair cost estimate required for items marked for repair")
        if self.disposition == ItemDisposition.SALVAGE and not self.salvage_value:
            raise ValueError("Salvage value required for items marked for salvage")
        return self


class VendorCreditRequest(BaseModel):
    """Schema for requesting vendor credit."""
    
    return_id: UUID
    credit_amount: Annotated[Decimal, Field(gt=0, decimal_places=2)]
    credit_type: str = Field(..., pattern="^(refund|credit_note|replacement)$")
    credit_reference: Optional[str] = Field(None, max_length=100)
    expected_date: Optional[datetime] = None
    notes: Optional[str] = Field(None, max_length=500)


class VendorCreditResponse(BaseModel):
    """Response schema for vendor credit."""
    
    return_id: UUID
    credit_amount: Decimal
    credit_type: str
    credit_reference: Optional[str] = None
    credit_status: str
    approved_amount: Optional[Decimal] = None
    approval_date: Optional[datetime] = None
    expected_date: Optional[datetime] = None
    notes: Optional[str] = None
    
    class Config:
        from_attributes = True


class PurchaseReturnApproval(BaseModel):
    """Schema for purchase return approval."""
    
    approved: bool
    approval_notes: Optional[str] = Field(None, max_length=500)
    approved_credit_amount: Optional[Annotated[Decimal, Field(ge=0, decimal_places=2)]] = None
    require_vendor_approval: bool = False
    vendor_contact_required: bool = False
    
    @model_validator(mode="after")
    def validate_approval(self) -> "PurchaseReturnApproval":
        """Validate approval requirements."""
        if self.approved and not self.approved_credit_amount:
            raise ValueError("Approved credit amount required for approved returns")
        if not self.approved and not self.approval_notes:
            raise ValueError("Approval notes required when return is not approved")
        return self


class PurchaseReturnResponse(BaseModel):
    """Response schema for a purchase return."""
    
    id: UUID
    return_number: str
    purchase_id: UUID
    purchase_number: str
    supplier_id: UUID
    supplier_name: str
    location_id: UUID
    location_name: str
    reference_number: str
    return_date: datetime
    return_type: ReturnType
    status: ReturnStatus
    rma_number: Optional[str] = None
    items: List[PurchaseReturnItemResponse]
    subtotal_amount: Decimal
    restocking_fee: Decimal
    shipping_cost: Decimal
    total_return_amount: Decimal
    approved_credit_amount: Optional[Decimal] = None
    credit_received: Optional[Decimal] = None
    shipping_method: Optional[str] = None
    tracking_number: Optional[str] = None
    inspection_required: bool
    inspection_completed: bool = False
    inspection_date: Optional[datetime] = None
    approval_status: Optional[str] = None
    approval_date: Optional[datetime] = None
    approved_by: Optional[UUID] = None
    notes: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    created_by: UUID
    updated_by: Optional[UUID] = None
    
    class Config:
        from_attributes = True


class PurchaseReturnSummary(BaseModel):
    """Summary schema for purchase return listing."""
    
    id: UUID
    return_number: str
    supplier_name: str
    return_date: datetime
    return_type: ReturnType
    status: ReturnStatus
    total_amount: Decimal
    approved_credit: Optional[Decimal] = None
    item_count: int
    inspection_pending: bool
    
    class Config:
        from_attributes = True


class PurchaseReturnFilter(BaseModel):
    """Filter schema for purchase return queries."""
    
    supplier_id: Optional[UUID] = None
    location_id: Optional[UUID] = None
    return_type: Optional[ReturnType] = None
    status: Optional[ReturnStatus] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    min_amount: Optional[Decimal] = None
    max_amount: Optional[Decimal] = None
    rma_number: Optional[str] = None
    inspection_pending: Optional[bool] = None
    approval_pending: Optional[bool] = None


class ReturnMetrics(BaseModel):
    """Schema for return metrics and analytics."""
    
    period_start: datetime
    period_end: datetime
    total_returns: int
    total_return_value: Decimal
    approved_credit: Decimal
    pending_credit: Decimal
    average_return_value: Decimal
    average_processing_time: float
    return_rate: float
    defect_rate: float
    returns_by_type: Dict[ReturnType, int]
    returns_by_status: Dict[ReturnStatus, int]
    top_return_reasons: List[Dict[str, Any]]
    top_suppliers: List[Dict[str, Any]]
    top_returned_items: List[Dict[str, Any]]
    monthly_trend: List[Dict[str, Any]]


class DefectAnalysis(BaseModel):
    """Schema for defect analysis report."""
    
    period_start: datetime
    period_end: datetime
    total_defective_items: int
    total_defect_cost: Decimal
    defect_categories: Dict[str, int]
    defect_severity_breakdown: Dict[DamageSeverity, int]
    supplier_defect_rates: List[Dict[str, Any]]
    item_defect_rates: List[Dict[str, Any]]
    batch_analysis: List[Dict[str, Any]]
    quality_trends: List[Dict[str, Any]]
    recommended_actions: List[str]


class PurchaseReturnValidationError(BaseModel):
    """Schema for purchase return validation errors."""
    
    field: str
    message: str
    code: str
    value: Optional[Any] = None


class ReturnReason(BaseModel):
    """Schema for return reason details."""
    
    reason_code: str
    description: str
    requires_approval: bool = False
    auto_refund_eligible: bool = False


class ReturnApprovalStatus(BaseModel):
    """Schema for return approval status."""
    
    status: str
    approved_by: Optional[UUID] = None
    approval_date: Optional[datetime] = None
    approval_notes: Optional[str] = None


class VendorCreditNote(BaseModel):
    """Schema for vendor credit note."""
    
    credit_note_number: str
    return_id: UUID
    supplier_id: UUID
    credit_amount: Decimal
    issue_date: datetime
    reference_number: Optional[str] = None
    notes: Optional[str] = None


class PurchaseReturnReport(BaseModel):
    """Schema for purchase return reports."""
    
    report_type: str
    period_start: datetime
    period_end: datetime
    total_returns: int
    total_return_value: Decimal
    approved_returns: int
    rejected_returns: int
    pending_returns: int
    data: Dict[str, Any]
    generated_at: datetime = Field(default_factory=datetime.utcnow)