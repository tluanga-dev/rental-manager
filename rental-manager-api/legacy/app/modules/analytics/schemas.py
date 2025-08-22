"""
Analytics schemas for rental dashboard and metrics
"""

from typing import List, Optional, Dict, Any
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class DashboardSummary(BaseModel):
    """Basic dashboard summary metrics"""
    total_rentals: int = Field(description="Total number of active rentals")
    total_revenue: Decimal = Field(description="Total revenue from active rentals")
    average_rental_value: Decimal = Field(description="Average value per rental")
    unique_customers: int = Field(description="Number of unique customers with active rentals")


class TopItem(BaseModel):
    """Top performing item data"""
    item_id: str
    item_name: str
    sku: Optional[str] = None
    rental_count: int
    revenue: Decimal


class LocationMetrics(BaseModel):
    """Location-specific metrics"""
    location_id: str
    location_name: str
    rental_count: int
    total_value: Decimal


class StatusBreakdown(BaseModel):
    """Breakdown of rentals by status"""
    status: str
    count: int


class RentalDashboardResponse(BaseModel):
    """Complete dashboard response"""
    success: bool = True
    message: str = "Dashboard data retrieved successfully"
    data: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class FinancialSummary(BaseModel):
    """Financial summary metrics"""
    total_revenue: Decimal = Field(description="Total revenue for the period")
    total_transactions: int = Field(description="Total number of transactions")
    avg_transaction_value: Decimal = Field(description="Average transaction value")
    outstanding_amount: Decimal = Field(description="Outstanding payment amount")
    outstanding_count: int = Field(description="Number of outstanding payments")
    active_rental_value: Decimal = Field(description="Total value of active rentals")
    active_rental_count: int = Field(description="Number of active rentals")


class RevenueByType(BaseModel):
    """Revenue breakdown by transaction type"""
    transaction_type: str
    revenue: Decimal
    count: int


class MonthlyRevenue(BaseModel):
    """Monthly revenue data"""
    year: int
    month: int
    revenue: Decimal
    transaction_count: int


class RevenueTrend(BaseModel):
    """Revenue trend data point"""
    revenue: Decimal
    transaction_count: int
    avg_transaction_value: Decimal
    year: Optional[int] = None
    month: Optional[int] = None
    day: Optional[int] = None
    week: Optional[int] = None


class CashFlowSummary(BaseModel):
    """Cash flow summary"""
    total_inflows: Decimal
    total_outflows: Decimal
    net_cash_flow: Decimal


class CashFlowByType(BaseModel):
    """Cash flow by transaction type"""
    transaction_type: str
    amount: Decimal
    count: int


class MonthlyCashFlow(BaseModel):
    """Monthly cash flow data"""
    year: int
    month: int
    transaction_type: str
    amount: Decimal


class FinancialDashboardData(BaseModel):
    """Financial dashboard data structure"""
    summary: FinancialSummary
    revenue_by_type: List[RevenueByType]
    monthly_revenue: List[MonthlyRevenue]


class FinancialDashboardResponse(BaseModel):
    """Financial dashboard response"""
    success: bool = True
    message: str = "Financial dashboard data retrieved successfully"
    data: FinancialDashboardData
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class RevenueTrendsResponse(BaseModel):
    """Revenue trends response"""
    success: bool = True
    message: str = "Revenue trends retrieved successfully"
    data: List[RevenueTrend]
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class CashFlowData(BaseModel):
    """Cash flow analysis data structure"""
    summary: CashFlowSummary
    inflows_by_type: List[CashFlowByType]
    outflows_by_type: List[CashFlowByType]
    monthly_cashflow: List[MonthlyCashFlow]


class CashFlowAnalysisResponse(BaseModel):
    """Cash flow analysis response"""
    success: bool = True
    message: str = "Cash flow analysis retrieved successfully"
    data: CashFlowData
    timestamp: datetime = Field(default_factory=datetime.utcnow)