from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.supplier import SupplierRepository
from app.models.supplier import Supplier, SupplierType, SupplierStatus
from app.schemas.supplier import (
    SupplierCreate, SupplierUpdate, SupplierResponse, SupplierStatusUpdate
)
from app.core.errors import ValidationError, NotFoundError, ConflictError


class SupplierService:
    """Supplier service."""
    
    def __init__(self, session: AsyncSession):
        """Initialize service with database session."""
        self.session = session
        self.repository = SupplierRepository(session)
    
    async def create_supplier(self, supplier_data: SupplierCreate) -> SupplierResponse:
        """Create a new supplier."""
        # Check if supplier code already exists
        existing_supplier = await self.repository.get_by_code(supplier_data.supplier_code)
        if existing_supplier:
            raise ConflictError(f"Supplier with code '{supplier_data.supplier_code}' already exists")
        
        # Create supplier
        supplier_dict = supplier_data.model_dump()
        supplier = await self.repository.create(supplier_dict)
        
        return SupplierResponse.model_validate(supplier)
    
    async def get_supplier(self, supplier_id: UUID) -> Optional[SupplierResponse]:
        """Get supplier by ID."""
        supplier = await self.repository.get_by_id(supplier_id)
        if not supplier:
            return None
        
        return SupplierResponse.model_validate(supplier)
    
    async def get_supplier_by_code(self, supplier_code: str) -> Optional[SupplierResponse]:
        """Get supplier by code."""
        supplier = await self.repository.get_by_code(supplier_code)
        if not supplier:
            return None
        
        return SupplierResponse.model_validate(supplier)
    
    async def update_supplier(self, supplier_id: UUID, update_data: SupplierUpdate) -> SupplierResponse:
        """Update supplier information."""
        supplier = await self.repository.get_by_id(supplier_id)
        if not supplier:
            raise NotFoundError("Supplier not found")
        
        # Update supplier
        update_dict = update_data.model_dump(exclude_unset=True)
        updated_supplier = await self.repository.update(supplier_id, update_dict)
        
        return SupplierResponse.model_validate(updated_supplier)
    
    async def delete_supplier(self, supplier_id: UUID) -> bool:
        """Delete supplier."""
        return await self.repository.delete(supplier_id)
    
    async def list_suppliers(
        self,
        skip: int = 0,
        limit: int = 100,
        supplier_type: Optional[SupplierType] = None,
        status: Optional[SupplierStatus] = None,
        active_only: bool = True
    ) -> List[SupplierResponse]:
        """List suppliers with filtering."""
        suppliers = await self.repository.get_all(
            skip=skip,
            limit=limit,
            supplier_type=supplier_type,
            status=status,
            active_only=active_only
        )
        
        return [SupplierResponse.model_validate(supplier) for supplier in suppliers]
    
    async def search_suppliers(
        self,
        search_term: str,
        skip: int = 0,
        limit: int = 100,
        active_only: bool = True
    ) -> List[SupplierResponse]:
        """Search suppliers."""
        suppliers = await self.repository.search(
            search_term=search_term,
            skip=skip,
            limit=limit,
            active_only=active_only
        )
        
        return [SupplierResponse.model_validate(supplier) for supplier in suppliers]
    
    async def count_suppliers(
        self,
        supplier_type: Optional[SupplierType] = None,
        status: Optional[SupplierStatus] = None,
        active_only: bool = True
    ) -> int:
        """Count suppliers with filtering."""
        return await self.repository.count_all(
            supplier_type=supplier_type,
            status=status,
            active_only=active_only
        )
    
    async def update_supplier_status(self, supplier_id: UUID, status_update: SupplierStatusUpdate) -> SupplierResponse:
        """Update supplier status."""
        supplier = await self.repository.get_by_id(supplier_id)
        if not supplier:
            raise NotFoundError("Supplier not found")
        
        update_dict = {
            "status": status_update.status,
            "notes": status_update.notes
        }
        
        updated_supplier = await self.repository.update(supplier_id, update_dict)
        return SupplierResponse.model_validate(updated_supplier)
    
    async def get_supplier_statistics(self) -> Dict[str, Any]:
        """Get supplier statistics."""
        # Get basic counts
        total_suppliers = await self.repository.count_all(active_only=False)
        active_suppliers = await self.repository.count_all(active_only=True)
        
        # Get suppliers by type
        inventory_suppliers = await self.repository.count_all(
            supplier_type=SupplierType.INVENTORY, active_only=True
        )
        service_suppliers = await self.repository.count_all(
            supplier_type=SupplierType.SERVICE, active_only=True
        )
        
        # Get suppliers by status
        approved_suppliers = await self.repository.count_all(
            status=SupplierStatus.APPROVED, active_only=True
        )
        pending_suppliers = await self.repository.count_all(
            status=SupplierStatus.PENDING, active_only=True
        )
        suspended_suppliers = await self.repository.count_all(
            status=SupplierStatus.SUSPENDED, active_only=True
        )
        blacklisted_suppliers = await self.repository.count_all(
            status=SupplierStatus.BLACKLISTED, active_only=True
        )
        
        # Get recent suppliers
        recent_suppliers = await self.repository.get_recent_suppliers(limit=10, active_only=True)
        
        # Get top suppliers
        top_suppliers_by_orders = await self.repository.get_top_suppliers_by_orders(limit=5, active_only=True)
        top_suppliers_by_spend = await self.repository.get_top_suppliers_by_spend(limit=5, active_only=True)
        
        # Get contracts expiring soon
        contract_expiring_soon = await self.repository.get_suppliers_with_expiring_contracts(days=30, active_only=True)
        
        # Get statistics from repository
        stats = await self.repository.get_statistics()
        
        return {
            "total_suppliers": total_suppliers,
            "active_suppliers": active_suppliers,
            "inactive_suppliers": total_suppliers - active_suppliers,
            "inventory_suppliers": inventory_suppliers,
            "service_suppliers": service_suppliers,
            "approved_suppliers": approved_suppliers,
            "pending_suppliers": pending_suppliers,
            "suspended_suppliers": suspended_suppliers,
            "blacklisted_suppliers": blacklisted_suppliers,
            "average_quality_rating": float(stats["average_ratings"][0] or 0) if stats["average_ratings"][0] else 0.0,
            "average_delivery_rating": float(stats["average_ratings"][1] or 0) if stats["average_ratings"][1] else 0.0,
            "suppliers_by_type": stats["suppliers_by_type"],
            "suppliers_by_tier": stats["suppliers_by_tier"],
            "suppliers_by_status": stats["suppliers_by_status"],
            "suppliers_by_country": stats["suppliers_by_country"],
            "top_suppliers_by_orders": [
                {
                    "id": str(supplier.id),
                    "company_name": supplier.company_name,
                    "supplier_code": supplier.supplier_code,
                    "total_orders": supplier.total_orders
                }
                for supplier in top_suppliers_by_orders
            ],
            "top_suppliers_by_spend": [
                {
                    "id": str(supplier.id),
                    "company_name": supplier.company_name,
                    "supplier_code": supplier.supplier_code,
                    "total_spend": float(supplier.total_spend)
                }
                for supplier in top_suppliers_by_spend
            ],
            "contract_expiring_soon": [
                {
                    "id": str(supplier.id),
                    "company_name": supplier.company_name,
                    "supplier_code": supplier.supplier_code,
                    "contract_end_date": supplier.contract_end_date.isoformat() if supplier.contract_end_date else None
                }
                for supplier in contract_expiring_soon
            ],
            "recent_suppliers": [SupplierResponse.model_validate(supplier) for supplier in recent_suppliers]
        }