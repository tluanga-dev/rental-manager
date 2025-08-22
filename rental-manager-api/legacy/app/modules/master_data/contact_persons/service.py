from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from .repository import ContactPersonRepository
from .models import ContactPerson
from .schemas import ContactPersonCreate, ContactPersonUpdate, ContactPersonResponse
from app.core.errors import ValidationError, NotFoundError, ConflictError


class ContactPersonService:
    """Contact person service."""
    
    def __init__(self, session: AsyncSession):
        """Initialize service with database session."""
        self.session = session
        self.repository = ContactPersonRepository(session)
    
    async def create_contact_person(self, contact_data: ContactPersonCreate) -> ContactPersonResponse:
        """Create a new contact person."""
        # Check if email already exists
        if contact_data.email:
            existing_contact = await self.repository.get_by_email(contact_data.email)
            if existing_contact:
                raise ConflictError(f"Contact person with email '{contact_data.email}' already exists")
        
        # Create contact person
        contact_dict = contact_data.model_dump()
        
        # Compute full name
        full_name = f"{contact_dict['first_name']} {contact_dict['last_name']}".strip()
        contact_dict['full_name'] = full_name
        
        contact_person = await self.repository.create(contact_dict)
        
        # Convert to response schema
        response_data = {
            'id': contact_person.id,
            'first_name': contact_person.first_name,
            'last_name': contact_person.last_name,
            'full_name': contact_person.full_name,
            'email': contact_person.email,
            'phone': contact_person.phone,
            'mobile': contact_person.mobile,
            'title': contact_person.title,
            'department': contact_person.department,
            'company': contact_person.company,
            'address': contact_person.address,
            'city': contact_person.city,
            'state': contact_person.state,
            'country': contact_person.country,
            'postal_code': contact_person.postal_code,
            'notes': contact_person.notes,
            'is_primary': contact_person.is_primary,
            'is_active': contact_person.is_active if hasattr(contact_person, 'is_active') else True,
            'created_at': contact_person.created_at,
            'updated_at': contact_person.updated_at,
        }
        return ContactPersonResponse(**response_data)
    
    async def get_contact_person(self, contact_id: UUID) -> Optional[ContactPersonResponse]:
        """Get contact person by ID."""
        contact_person = await self.repository.get_by_id(contact_id)
        if not contact_person:
            return None
        
        response_data = {
            'id': contact_person.id,
            'first_name': contact_person.first_name,
            'last_name': contact_person.last_name,
            'full_name': contact_person.full_name,
            'email': contact_person.email,
            'phone': contact_person.phone,
            'mobile': contact_person.mobile,
            'title': contact_person.title,
            'department': contact_person.department,
            'company': contact_person.company,
            'address': contact_person.address,
            'city': contact_person.city,
            'state': contact_person.state,
            'country': contact_person.country,
            'postal_code': contact_person.postal_code,
            'notes': contact_person.notes,
            'is_primary': contact_person.is_primary,
            'is_active': contact_person.is_active if hasattr(contact_person, 'is_active') else True,
            'created_at': contact_person.created_at,
            'updated_at': contact_person.updated_at,
        }
        return ContactPersonResponse(**response_data)
    
    async def get_contact_person_by_email(self, email: str) -> Optional[ContactPersonResponse]:
        """Get contact person by email."""
        contact_person = await self.repository.get_by_email(email)
        if not contact_person:
            return None
        
        response_data = {
            'id': contact_person.id,
            'first_name': contact_person.first_name,
            'last_name': contact_person.last_name,
            'full_name': contact_person.full_name,
            'email': contact_person.email,
            'phone': contact_person.phone,
            'mobile': contact_person.mobile,
            'title': contact_person.title,
            'department': contact_person.department,
            'company': contact_person.company,
            'address': contact_person.address,
            'city': contact_person.city,
            'state': contact_person.state,
            'country': contact_person.country,
            'postal_code': contact_person.postal_code,
            'notes': contact_person.notes,
            'is_primary': contact_person.is_primary,
            'is_active': contact_person.is_active if hasattr(contact_person, 'is_active') else True,
            'created_at': contact_person.created_at,
            'updated_at': contact_person.updated_at,
        }
        return ContactPersonResponse(**response_data)
    
    async def update_contact_person(self, contact_id: UUID, update_data: ContactPersonUpdate) -> ContactPersonResponse:
        """Update contact person information."""
        contact_person = await self.repository.get_by_id(contact_id)
        if not contact_person:
            raise NotFoundError("Contact person not found")
        
        # Check email uniqueness if updating email
        update_dict = update_data.model_dump(exclude_unset=True)
        if 'email' in update_dict and update_dict['email']:
            existing_contact = await self.repository.get_by_email(update_dict['email'])
            if existing_contact and existing_contact.id != contact_id:
                raise ConflictError(f"Contact person with email '{update_dict['email']}' already exists")
        
        # Update full name if first_name or last_name changed
        if 'first_name' in update_dict or 'last_name' in update_dict:
            first_name = update_dict.get('first_name', contact_person.first_name)
            last_name = update_dict.get('last_name', contact_person.last_name)
            update_dict['full_name'] = f"{first_name} {last_name}".strip()
        
        updated_contact = await self.repository.update(contact_id, update_dict)
        
        response_data = {
            'id': updated_contact.id,
            'first_name': updated_contact.first_name,
            'last_name': updated_contact.last_name,
            'full_name': updated_contact.full_name,
            'email': updated_contact.email,
            'phone': updated_contact.phone,
            'mobile': updated_contact.mobile,
            'title': updated_contact.title,
            'department': updated_contact.department,
            'company': updated_contact.company,
            'address': updated_contact.address,
            'city': updated_contact.city,
            'state': updated_contact.state,
            'country': updated_contact.country,
            'postal_code': updated_contact.postal_code,
            'notes': updated_contact.notes,
            'is_primary': updated_contact.is_primary,
            'is_active': updated_contact.is_active if hasattr(updated_contact, 'is_active') else True,
            'created_at': updated_contact.created_at,
            'updated_at': updated_contact.updated_at,
        }
        return ContactPersonResponse(**response_data)
    
    async def delete_contact_person(self, contact_id: UUID) -> bool:
        """Delete contact person."""
        return await self.repository.delete(contact_id)
    
    async def list_contact_persons(
        self,
        skip: int = 0,
        limit: int = 100,
        company: Optional[str] = None,
        active_only: bool = True
    ) -> List[ContactPersonResponse]:
        """List contact persons with filtering."""
        if company:
            contacts = await self.repository.get_by_company(
                company=company,
                skip=skip,
                limit=limit,
                active_only=active_only
            )
        else:
            contacts = await self.repository.get_all(
                skip=skip,
                limit=limit,
                active_only=active_only
            )
        
        result = []
        for contact in contacts:
            response_data = {
                'id': contact.id,
                'first_name': contact.first_name,
                'last_name': contact.last_name,
                'full_name': contact.full_name,
                'email': contact.email,
                'phone': contact.phone,
                'mobile': contact.mobile,
                'title': contact.title,
                'department': contact.department,
                'company': contact.company,
                'address': contact.address,
                'city': contact.city,
                'state': contact.state,
                'country': contact.country,
                'postal_code': contact.postal_code,
                'notes': contact.notes,
                'is_primary': contact.is_primary,
                'is_active': contact.is_active if hasattr(contact, 'is_active') else True,
                'created_at': contact.created_at,
                'updated_at': contact.updated_at,
            }
            result.append(ContactPersonResponse(**response_data))
        
        return result
    
    async def search_contact_persons(
        self,
        search_term: str,
        skip: int = 0,
        limit: int = 100,
        active_only: bool = True
    ) -> List[ContactPersonResponse]:
        """Search contact persons."""
        contacts = await self.repository.search(
            search_term=search_term,
            skip=skip,
            limit=limit,
            active_only=active_only
        )
        
        result = []
        for contact in contacts:
            response_data = {
                'id': contact.id,
                'first_name': contact.first_name,
                'last_name': contact.last_name,
                'full_name': contact.full_name,
                'email': contact.email,
                'phone': contact.phone,
                'mobile': contact.mobile,
                'title': contact.title,
                'department': contact.department,
                'company': contact.company,
                'address': contact.address,
                'city': contact.city,
                'state': contact.state,
                'country': contact.country,
                'postal_code': contact.postal_code,
                'notes': contact.notes,
                'is_primary': contact.is_primary,
                'is_active': contact.is_active if hasattr(contact, 'is_active') else True,
                'created_at': contact.created_at,
                'updated_at': contact.updated_at,
            }
            result.append(ContactPersonResponse(**response_data))
        
        return result
    
    async def count_contact_persons(
        self,
        company: Optional[str] = None,
        active_only: bool = True
    ) -> int:
        """Count contact persons with filtering."""
        return await self.repository.count_all(
            company=company,
            active_only=active_only
        )
