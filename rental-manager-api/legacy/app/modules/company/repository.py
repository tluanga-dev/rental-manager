from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy import select, func, or_, and_, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Company
from app.shared.repository import BaseRepository


class CompanyRepository(BaseRepository[Company]):
    """Repository for company data access operations."""
    
    def __init__(self, session: AsyncSession):
        """Initialize repository with database session."""
        super().__init__(Company, session)
    
    # Methods inherited from BaseRepository:
    # - create(obj_data: Dict[str, Any]) -> Company
    # - get_by_id(id: UUID) -> Optional[Company]
    # - get_all(...) -> List[Company]
    # - update(id: UUID, obj_data: Dict[str, Any]) -> Optional[Company]
    # - delete(id: UUID) -> bool  (soft delete)
    # - count_all(...) -> int
    # - exists(id: UUID) -> bool
    # - search(...) -> List[Company]
    # - get_paginated(...) -> Dict[str, Any]
    
    # Company-specific methods
    
    async def count(self, filters: Optional[Dict[str, Any]] = None, include_inactive: bool = False) -> int:
        """Count companies with optional filtering."""
        active_only = not include_inactive
        filter_dict = filters or {}
        return await self.count_all(active_only=active_only, **filter_dict)
    
    async def get_by_name(self, company_name: str) -> Optional[Company]:
        """Get company by name."""
        return await self.get_by_field("company_name", company_name)
    
    async def get_by_gst_no(self, gst_no: str) -> Optional[Company]:
        """Get company by GST number."""
        return await self.get_by_field("gst_no", gst_no)
    
    async def get_by_registration_number(self, registration_number: str) -> Optional[Company]:
        """Get company by registration number."""
        return await self.get_by_field("registration_number", registration_number)
    
    async def get_active_company(self) -> Optional[Company]:
        """Get the active company (for single company mode)."""
        query = select(Company).where(Company.is_active == True).limit(1)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def update(self, company_id: UUID, update_data: dict) -> Optional[Company]:
        """Update existing company.
        
        Overrides base implementation to use model's update_info method.
        """
        company = await self.get_by_id(company_id)
        if not company:
            return None
        
        # Update fields using the model's update method
        company.update_info(**update_data)
        
        await self.session.commit()
        await self.session.refresh(company)
        
        return company
    
    async def activate(self, company_id: UUID) -> Optional[Company]:
        """Activate a company and deactivate all others (single company mode)."""
        # First deactivate all companies
        all_companies_query = select(Company)
        result = await self.session.execute(all_companies_query)
        all_companies = result.scalars().all()
        
        for comp in all_companies:
            comp.is_active = False
        
        # Then activate the specified company
        company = await self.get_by_id(company_id)
        if not company:
            return None
        
        company.is_active = True
        await self.session.commit()
        await self.session.refresh(company)
        
        return company
    
    async def exists_by_name(self, company_name: str, exclude_id: Optional[UUID] = None) -> bool:
        """Check if a company with the given name exists."""
        query = select(func.count()).select_from(Company).where(
            Company.company_name == company_name
        )
        
        if exclude_id:
            query = query.where(Company.id != exclude_id)
        
        result = await self.session.execute(query)
        count = result.scalar_one()
        
        return count > 0
    
    async def exists_by_gst_no(self, gst_no: str, exclude_id: Optional[UUID] = None) -> bool:
        """Check if a company with the given GST number exists."""
        query = select(func.count()).select_from(Company).where(
            Company.gst_no == gst_no
        )
        
        if exclude_id:
            query = query.where(Company.id != exclude_id)
        
        result = await self.session.execute(query)
        count = result.scalar_one()
        
        return count > 0
    
    async def exists_by_registration_number(self, registration_number: str, exclude_id: Optional[UUID] = None) -> bool:
        """Check if a company with the given registration number exists."""
        query = select(func.count()).select_from(Company).where(
            Company.registration_number == registration_number
        )
        
        if exclude_id:
            query = query.where(Company.id != exclude_id)
        
        result = await self.session.execute(query)
        count = result.scalar_one()
        
        return count > 0
    
    async def search(
        self,
        search_term: str,
        limit: int = 10,
        include_inactive: bool = False
    ) -> List[Company]:
        """Search companies by name, email, GST or registration number.
        
        Overrides base search to search specific Company fields.
        """
        search_fields = ["company_name", "email", "gst_no", "registration_number"]
        return await super().search(
            search_term=search_term,
            search_fields=search_fields,
            limit=limit,
            active_only=not include_inactive
        )