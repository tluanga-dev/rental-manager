from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy import and_, or_, func, select, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact_person import ContactPerson
from app.schemas.contact_person import ContactPersonSearch


class ContactPersonRepository:
    """Repository for ContactPerson operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_by_id(self, contact_id: UUID) -> Optional[ContactPerson]:
        """Get contact person by ID."""
        query = select(ContactPerson).where(ContactPerson.id == contact_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def get_by_email(self, email: str) -> Optional[ContactPerson]:
        """Get contact person by email address."""
        query = select(ContactPerson).where(
            and_(
                ContactPerson.email == email.lower(),
                ContactPerson.is_active == True
            )
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def get_by_phone(self, phone: str) -> Optional[ContactPerson]:
        """Get contact person by phone number."""
        query = select(ContactPerson).where(
            and_(
                or_(
                    ContactPerson.phone == phone,
                    ContactPerson.mobile == phone
                ),
                ContactPerson.is_active == True
            )
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def get_by_full_name(self, full_name: str) -> List[ContactPerson]:
        """Get contact persons by full name (may return multiple)."""
        query = select(ContactPerson).where(
            and_(
                ContactPerson.full_name.ilike(f"%{full_name}%"),
                ContactPerson.is_active == True
            )
        ).order_by(asc(ContactPerson.full_name))
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_all(
        self, 
        skip: int = 0, 
        limit: int = 100,
        active_only: bool = True
    ) -> List[ContactPerson]:
        """Get all contact persons with pagination."""
        query = select(ContactPerson)
        
        if active_only:
            query = query.where(ContactPerson.is_active == True)
        
        query = query.order_by(asc(ContactPerson.full_name)).offset(skip).limit(limit)
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def search(self, search_params: ContactPersonSearch) -> List[ContactPerson]:
        """Search contact persons with advanced filtering."""
        query = select(ContactPerson)
        conditions = []
        
        # Active filter
        if search_params.active_only:
            conditions.append(ContactPerson.is_active == True)
        
        # Text search across multiple fields
        if search_params.search_term:
            search_term = search_params.search_term.strip()
            text_conditions = or_(
                ContactPerson.first_name.ilike(f"%{search_term}%"),
                ContactPerson.last_name.ilike(f"%{search_term}%"),
                ContactPerson.full_name.ilike(f"%{search_term}%"),
                ContactPerson.email.ilike(f"%{search_term}%"),
                ContactPerson.phone.ilike(f"%{search_term}%"),
                ContactPerson.mobile.ilike(f"%{search_term}%"),
                ContactPerson.company.ilike(f"%{search_term}%"),
                ContactPerson.title.ilike(f"%{search_term}%")
            )
            conditions.append(text_conditions)
        
        # Company filter
        if search_params.company:
            conditions.append(ContactPerson.company.ilike(f"%{search_params.company}%"))
        
        # Primary contact filter
        if search_params.is_primary is not None:
            conditions.append(ContactPerson.is_primary == search_params.is_primary)
        
        # Location filters
        if search_params.city:
            conditions.append(ContactPerson.city.ilike(f"%{search_params.city}%"))
        
        if search_params.state:
            conditions.append(ContactPerson.state.ilike(f"%{search_params.state}%"))
        
        if search_params.country:
            conditions.append(ContactPerson.country.ilike(f"%{search_params.country}%"))
        
        # Apply all conditions
        if conditions:
            query = query.where(and_(*conditions))
        
        # Order and paginate
        query = (
            query.order_by(asc(ContactPerson.full_name))
            .offset(search_params.skip)
            .limit(search_params.limit)
        )
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_by_company(
        self,
        company: str,
        skip: int = 0,
        limit: int = 100,
        active_only: bool = True
    ) -> List[ContactPerson]:
        """Get contact persons by company."""
        conditions = [ContactPerson.company.ilike(f"%{company}%")]
        
        if active_only:
            conditions.append(ContactPerson.is_active == True)
        
        query = (
            select(ContactPerson)
            .where(and_(*conditions))
            .order_by(asc(ContactPerson.full_name))
            .offset(skip)
            .limit(limit)
        )
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_primary_contacts(
        self,
        skip: int = 0,
        limit: int = 100,
        active_only: bool = True
    ) -> List[ContactPerson]:
        """Get all primary contact persons."""
        conditions = [ContactPerson.is_primary == True]
        
        if active_only:
            conditions.append(ContactPerson.is_active == True)
        
        query = (
            select(ContactPerson)
            .where(and_(*conditions))
            .order_by(asc(ContactPerson.full_name))
            .offset(skip)
            .limit(limit)
        )
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def create(self, contact_data: dict) -> ContactPerson:
        """Create a new contact person."""
        # Ensure full_name is computed
        if 'first_name' in contact_data and 'last_name' in contact_data:
            contact_data['full_name'] = f"{contact_data['first_name']} {contact_data['last_name']}".strip()
        
        contact = ContactPerson(**contact_data)
        self.session.add(contact)
        await self.session.commit()
        await self.session.refresh(contact)
        return contact
    
    async def update(self, contact_id: UUID, contact_data: dict) -> Optional[ContactPerson]:
        """Update a contact person."""
        query = select(ContactPerson).where(ContactPerson.id == contact_id)
        result = await self.session.execute(query)
        contact = result.scalar_one_or_none()
        
        if not contact:
            return None
        
        # Update fields
        for field, value in contact_data.items():
            if hasattr(contact, field):
                setattr(contact, field, value)
        
        # Update full name if first_name or last_name changed
        if 'first_name' in contact_data or 'last_name' in contact_data:
            contact.update_full_name()
        
        await self.session.commit()
        await self.session.refresh(contact)
        return contact
    
    async def delete(self, contact_id: UUID) -> bool:
        """Soft delete a contact person."""
        query = select(ContactPerson).where(ContactPerson.id == contact_id)
        result = await self.session.execute(query)
        contact = result.scalar_one_or_none()
        
        if not contact:
            return False
        
        contact.soft_delete()
        await self.session.commit()
        return True
    
    async def count_all(
        self,
        company: Optional[str] = None,
        is_primary: Optional[bool] = None,
        active_only: bool = True
    ) -> int:
        """Count contact persons with optional filtering."""
        conditions = []
        
        if active_only:
            conditions.append(ContactPerson.is_active == True)
        
        if company:
            conditions.append(ContactPerson.company.ilike(f"%{company}%"))
        
        if is_primary is not None:
            conditions.append(ContactPerson.is_primary == is_primary)
        
        query = select(func.count(ContactPerson.id))
        if conditions:
            query = query.where(and_(*conditions))
        
        result = await self.session.execute(query)
        return result.scalar()
    
    async def check_email_exists(self, email: str, exclude_id: Optional[UUID] = None) -> bool:
        """Check if email exists."""
        query = select(ContactPerson.id).where(
            and_(
                ContactPerson.email == email.lower(),
                ContactPerson.is_active == True
            )
        )
        if exclude_id:
            query = query.where(ContactPerson.id != exclude_id)
        
        result = await self.session.execute(query)
        return result.scalar_one_or_none() is not None
    
    async def get_statistics(self) -> Dict[str, Any]:
        """Get contact person statistics."""
        # Total counts
        total_contacts = await self.count_all(active_only=False)
        active_contacts = await self.count_all(active_only=True)
        primary_contacts = await self.count_all(is_primary=True, active_only=True)
        
        # Count unique companies
        companies_query = select(func.count(func.distinct(ContactPerson.company))).where(
            and_(
                ContactPerson.company.isnot(None),
                ContactPerson.is_active == True
            )
        )
        companies_result = await self.session.execute(companies_query)
        companies_count = companies_result.scalar()
        
        # Count contacts with email
        email_query = select(func.count(ContactPerson.id)).where(
            and_(
                ContactPerson.email.isnot(None),
                ContactPerson.is_active == True
            )
        )
        email_result = await self.session.execute(email_query)
        with_email = email_result.scalar()
        
        # Count contacts with phone
        phone_query = select(func.count(ContactPerson.id)).where(
            and_(
                or_(
                    ContactPerson.phone.isnot(None),
                    ContactPerson.mobile.isnot(None)
                ),
                ContactPerson.is_active == True
            )
        )
        phone_result = await self.session.execute(phone_query)
        with_phone = phone_result.scalar()
        
        return {
            "total_contacts": total_contacts,
            "active_contacts": active_contacts,
            "inactive_contacts": total_contacts - active_contacts,
            "primary_contacts": primary_contacts,
            "companies_count": companies_count,
            "with_email": with_email,
            "with_phone": with_phone,
        }
    
    async def get_recent_contacts(self, limit: int = 10) -> List[ContactPerson]:
        """Get recently created contacts."""
        query = (
            select(ContactPerson)
            .where(ContactPerson.is_active == True)
            .order_by(desc(ContactPerson.created_at))
            .limit(limit)
        )
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def bulk_update_company(self, old_company: str, new_company: str) -> int:
        """Bulk update company name for all contacts."""
        from sqlalchemy import update
        
        query = (
            update(ContactPerson)
            .where(
                and_(
                    ContactPerson.company == old_company,
                    ContactPerson.is_active == True
                )
            )
            .values(company=new_company)
        )
        
        result = await self.session.execute(query)
        await self.session.commit()
        return result.rowcount