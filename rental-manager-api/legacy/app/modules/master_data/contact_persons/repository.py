from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload

from .models import ContactPerson
from app.shared.repository import BaseRepository


class ContactPersonRepository(BaseRepository[ContactPerson]):
    """Repository for contact person operations."""
    
    def __init__(self, session: AsyncSession):
        super().__init__(ContactPerson, session)
    
    async def get_by_email(self, email: str) -> Optional[ContactPerson]:
        """Get contact person by email address."""
        stmt = select(self.model).where(
            and_(
                self.model.email == email,
                self.model.is_active == True
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def get_by_phone(self, phone: str) -> Optional[ContactPerson]:
        """Get contact person by phone number."""
        stmt = select(self.model).where(
            and_(
                or_(
                    self.model.phone == phone,
                    self.model.mobile == phone
                ),
                self.model.is_active == True
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def get_by_full_name(self, full_name: str) -> Optional[ContactPerson]:
        """Get contact person by full name."""
        stmt = select(self.model).where(
            and_(
                self.model.full_name.ilike(f"%{full_name}%"),
                self.model.is_active == True
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def search(
        self,
        search_term: str,
        skip: int = 0,
        limit: int = 100,
        active_only: bool = True
    ) -> List[ContactPerson]:
        """Search contact persons by name, email, or phone."""
        conditions = [
            or_(
                self.model.first_name.ilike(f"%{search_term}%"),
                self.model.last_name.ilike(f"%{search_term}%"),
                self.model.full_name.ilike(f"%{search_term}%"),
                self.model.email.ilike(f"%{search_term}%"),
                self.model.phone.ilike(f"%{search_term}%"),
                self.model.mobile.ilike(f"%{search_term}%"),
                self.model.company.ilike(f"%{search_term}%"),
                self.model.title.ilike(f"%{search_term}%")
            )
        ]
        
        if active_only:
            conditions.append(self.model.is_active == True)
        
        stmt = (
            select(self.model)
            .where(and_(*conditions))
            .order_by(self.model.full_name)
            .offset(skip)
            .limit(limit)
        )
        
        result = await self.session.execute(stmt)
        return result.scalars().all()
    
    async def get_by_company(
        self,
        company: str,
        skip: int = 0,
        limit: int = 100,
        active_only: bool = True
    ) -> List[ContactPerson]:
        """Get contact persons by company."""
        conditions = [self.model.company.ilike(f"%{company}%")]
        
        if active_only:
            conditions.append(self.model.is_active == True)
        
        stmt = (
            select(self.model)
            .where(and_(*conditions))
            .order_by(self.model.full_name)
            .offset(skip)
            .limit(limit)
        )
        
        result = await self.session.execute(stmt)
        return result.scalars().all()
    
    async def get_primary_contacts(
        self,
        skip: int = 0,
        limit: int = 100,
        active_only: bool = True
    ) -> List[ContactPerson]:
        """Get all primary contact persons."""
        conditions = [self.model.is_primary == True]
        
        if active_only:
            conditions.append(self.model.is_active == True)
        
        stmt = (
            select(self.model)
            .where(and_(*conditions))
            .order_by(self.model.full_name)
            .offset(skip)
            .limit(limit)
        )
        
        result = await self.session.execute(stmt)
        return result.scalars().all()
    
    async def count_all(
        self,
        company: Optional[str] = None,
        active_only: bool = True
    ) -> int:
        """Count contact persons with optional filtering."""
        conditions = []
        
        if company:
            conditions.append(self.model.company.ilike(f"%{company}%"))
        
        if active_only:
            conditions.append(self.model.is_active == True)
        
        if conditions:
            stmt = select(func.count(self.model.id)).where(and_(*conditions))
        else:
            stmt = select(func.count(self.model.id))
        
        result = await self.session.execute(stmt)
        return result.scalar()
