from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy import select, func, or_, and_, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company


class CompanyRepository:
    """Repository for company data access operations."""
    
    def __init__(self, session: AsyncSession):
        """Initialize repository with database session."""
        self.session = session
    
    async def create(self, company_data: Dict[str, Any]) -> Company:
        """Create a new company."""
        company = Company(**company_data)
        self.session.add(company)
        await self.session.commit()
        await self.session.refresh(company)
        return company
    
    async def get_by_id(self, company_id: UUID) -> Optional[Company]:
        """Get company by ID."""
        query = select(Company).where(Company.id == company_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Company]:
        """Get company by a specific field."""
        query = select(Company).where(getattr(Company, field_name) == field_value)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def get_all(self, active_only: bool = True) -> List[Company]:
        """Get all companies."""
        query = select(Company)
        if active_only:
            query = query.where(Company.is_active == True)
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def count(self, filters: Optional[Dict[str, Any]] = None, include_inactive: bool = False) -> int:
        """Count companies with optional filtering."""
        query = select(func.count()).select_from(Company)
        
        if not include_inactive:
            query = query.where(Company.is_active == True)
        
        if filters:
            for field, value in filters.items():
                if hasattr(Company, field) and value is not None:
                    if isinstance(value, str):
                        query = query.where(getattr(Company, field).ilike(f"%{value}%"))
                    else:
                        query = query.where(getattr(Company, field) == value)
        
        result = await self.session.execute(query)
        return result.scalar_one()
    
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
        """Update existing company."""
        company = await self.get_by_id(company_id)
        if not company:
            return None
        
        # Update fields using the model's update method
        company.update_info(**update_data)
        
        await self.session.commit()
        await self.session.refresh(company)
        
        return company
    
    async def delete(self, company_id: UUID) -> bool:
        """Soft delete a company."""
        company = await self.get_by_id(company_id)
        if not company:
            return False
        
        company.is_active = False
        await self.session.commit()
        return True
    
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
        """Search companies by name, email, GST or registration number."""
        query = select(Company).where(
            or_(
                Company.company_name.ilike(f"%{search_term}%"),
                Company.email.ilike(f"%{search_term}%"),
                Company.gst_no.ilike(f"%{search_term}%"),
                Company.registration_number.ilike(f"%{search_term}%")
            )
        )
        
        if not include_inactive:
            query = query.where(Company.is_active == True)
        
        query = query.limit(limit)
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_paginated(
        self,
        page: int = 1,
        page_size: int = 20,
        active_only: bool = True,
        **filters
    ) -> Dict[str, Any]:
        """Get paginated list of companies with filters."""
        # Base query
        query = select(Company)
        
        # Apply active filter
        if active_only:
            query = query.where(Company.is_active == True)
        
        # Apply filters
        for field, value in filters.items():
            if hasattr(Company, field) and value is not None:
                if field == 'search':
                    # Special handling for search field
                    query = query.where(
                        or_(
                            Company.company_name.ilike(f"%{value}%"),
                            Company.email.ilike(f"%{value}%"),
                            Company.gst_no.ilike(f"%{value}%"),
                            Company.registration_number.ilike(f"%{value}%")
                        )
                    )
                elif isinstance(value, str):
                    query = query.where(getattr(Company, field).ilike(f"%{value}%"))
                else:
                    query = query.where(getattr(Company, field) == value)
        
        # Count total before pagination
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.session.execute(count_query)
        total = total_result.scalar_one()
        
        # Apply pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        
        # Order by company name
        query = query.order_by(Company.company_name)
        
        # Execute query
        result = await self.session.execute(query)
        companies = result.scalars().all()
        
        # Calculate pagination info
        total_pages = (total + page_size - 1) // page_size
        has_next = page < total_pages
        has_previous = page > 1
        
        return {
            "items": companies,
            "total": total,
            "total_pages": total_pages,
            "has_next": has_next,
            "has_previous": has_previous
        }