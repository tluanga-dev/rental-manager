from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.contact_person import ContactPersonRepository
from app.models.contact_person import ContactPerson
from app.schemas.contact_person import (
    ContactPersonCreate, 
    ContactPersonUpdate, 
    ContactPersonResponse,
    ContactPersonSearch,
    ContactPersonStats
)
from app.core.errors import ValidationError, NotFoundError, ConflictError


class ContactPersonService:
    """Contact person service layer."""
    
    def __init__(self, session: AsyncSession):
        """Initialize service with database session."""
        self.session = session
        self.repository = ContactPersonRepository(session)
    
    async def create_contact_person(
        self, 
        contact_data: ContactPersonCreate,
        created_by: Optional[str] = None
    ) -> ContactPersonResponse:
        """Create a new contact person."""
        # Check if email already exists
        if contact_data.email:
            existing_contact = await self.repository.get_by_email(contact_data.email)
            if existing_contact:
                raise ConflictError(f"Contact person with email '{contact_data.email}' already exists")
        
        # Prepare data for creation
        contact_dict = contact_data.model_dump()
        
        # Compute full name
        full_name = f"{contact_dict['first_name']} {contact_dict['last_name']}".strip()
        contact_dict['full_name'] = full_name
        
        # Add audit information
        if created_by:
            contact_dict['created_by'] = created_by
        
        # Create contact person
        contact_person = await self.repository.create(contact_dict)
        
        return self._to_response(contact_person)
    
    async def get_contact_person(self, contact_id: UUID) -> Optional[ContactPersonResponse]:
        """Get contact person by ID."""
        contact_person = await self.repository.get_by_id(contact_id)
        if not contact_person:
            return None
        
        return self._to_response(contact_person)
    
    async def get_contact_person_by_email(self, email: str) -> Optional[ContactPersonResponse]:
        """Get contact person by email."""
        contact_person = await self.repository.get_by_email(email)
        if not contact_person:
            return None
        
        return self._to_response(contact_person)
    
    async def update_contact_person(
        self, 
        contact_id: UUID, 
        update_data: ContactPersonUpdate,
        updated_by: Optional[str] = None
    ) -> ContactPersonResponse:
        """Update contact person information."""
        # Check if contact exists
        existing_contact = await self.repository.get_by_id(contact_id)
        if not existing_contact:
            raise NotFoundError("Contact person not found")
        
        # Prepare update data
        update_dict = update_data.model_dump(exclude_unset=True)
        
        # Check email uniqueness if updating email
        if 'email' in update_dict and update_dict['email']:
            existing_email_contact = await self.repository.get_by_email(update_dict['email'])
            if existing_email_contact and existing_email_contact.id != contact_id:
                raise ConflictError(f"Contact person with email '{update_dict['email']}' already exists")
        
        # Add audit information
        if updated_by:
            update_dict['updated_by'] = updated_by
        
        # Update contact person
        updated_contact = await self.repository.update(contact_id, update_dict)
        if not updated_contact:
            raise NotFoundError("Contact person not found")
        
        return self._to_response(updated_contact)
    
    async def delete_contact_person(self, contact_id: UUID, deleted_by: Optional[str] = None) -> bool:
        """Delete contact person (soft delete)."""
        # Check if contact exists
        existing_contact = await self.repository.get_by_id(contact_id)
        if not existing_contact:
            raise NotFoundError("Contact person not found")
        
        # Perform soft delete with audit information
        if deleted_by:
            await self.repository.update(contact_id, {
                'deleted_by': deleted_by,
                'is_active': False
            })
        
        return await self.repository.delete(contact_id)
    
    async def list_contact_persons(
        self,
        skip: int = 0,
        limit: int = 100,
        active_only: bool = True
    ) -> List[ContactPersonResponse]:
        """List contact persons with pagination."""
        contacts = await self.repository.get_all(
            skip=skip,
            limit=limit,
            active_only=active_only
        )
        
        return [self._to_response(contact) for contact in contacts]
    
    async def search_contact_persons(self, search_params: ContactPersonSearch) -> List[ContactPersonResponse]:
        """Search contact persons with advanced filtering."""
        contacts = await self.repository.search(search_params)
        return [self._to_response(contact) for contact in contacts]
    
    async def get_contact_persons_by_company(
        self,
        company: str,
        skip: int = 0,
        limit: int = 100,
        active_only: bool = True
    ) -> List[ContactPersonResponse]:
        """Get contact persons by company."""
        contacts = await self.repository.get_by_company(
            company=company,
            skip=skip,
            limit=limit,
            active_only=active_only
        )
        
        return [self._to_response(contact) for contact in contacts]
    
    async def get_primary_contacts(
        self,
        skip: int = 0,
        limit: int = 100,
        active_only: bool = True
    ) -> List[ContactPersonResponse]:
        """Get all primary contact persons."""
        contacts = await self.repository.get_primary_contacts(
            skip=skip,
            limit=limit,
            active_only=active_only
        )
        
        return [self._to_response(contact) for contact in contacts]
    
    async def count_contact_persons(
        self,
        company: Optional[str] = None,
        is_primary: Optional[bool] = None,
        active_only: bool = True
    ) -> int:
        """Count contact persons with filtering."""
        return await self.repository.count_all(
            company=company,
            is_primary=is_primary,
            active_only=active_only
        )
    
    async def get_contact_person_statistics(self) -> ContactPersonStats:
        """Get contact person statistics."""
        stats_data = await self.repository.get_statistics()
        return ContactPersonStats(**stats_data)
    
    async def get_recent_contacts(self, limit: int = 10) -> List[ContactPersonResponse]:
        """Get recently created contacts."""
        contacts = await self.repository.get_recent_contacts(limit=limit)
        return [self._to_response(contact) for contact in contacts]
    
    async def validate_contact_data(self, contact_data: ContactPersonCreate) -> None:
        """Validate contact person data for business rules."""
        # Check for required fields
        if not contact_data.first_name or not contact_data.last_name:
            raise ValidationError("First name and last name are required")
        
        # Check if at least one contact method is provided
        if not contact_data.email and not contact_data.phone and not contact_data.mobile:
            raise ValidationError("At least one contact method (email, phone, or mobile) is required")
        
        # Check email format if provided
        if contact_data.email and '@' not in contact_data.email:
            raise ValidationError("Invalid email format")
        
        # Check for duplicate email
        if contact_data.email:
            existing_contact = await self.repository.get_by_email(contact_data.email)
            if existing_contact:
                raise ValidationError(f"Contact person with email '{contact_data.email}' already exists")
    
    async def set_primary_contact(
        self, 
        contact_id: UUID, 
        company: Optional[str] = None,
        updated_by: Optional[str] = None
    ) -> ContactPersonResponse:
        """Set a contact as primary for their company."""
        contact = await self.repository.get_by_id(contact_id)
        if not contact:
            raise NotFoundError("Contact person not found")
        
        # If company is specified, unset other primary contacts for that company
        if company or contact.company:
            target_company = company or contact.company
            # Note: In a more complex implementation, you might want to
            # unset other primary contacts for the same company
        
        # Set this contact as primary
        update_data = {'is_primary': True}
        if updated_by:
            update_data['updated_by'] = updated_by
        
        updated_contact = await self.repository.update(contact_id, update_data)
        if not updated_contact:
            raise NotFoundError("Contact person not found")
        
        return self._to_response(updated_contact)
    
    async def bulk_update_company(self, old_company: str, new_company: str) -> int:
        """Bulk update company name for all contacts."""
        if not old_company or not new_company:
            raise ValidationError("Both old and new company names are required")
        
        return await self.repository.bulk_update_company(old_company, new_company)
    
    def _to_response(self, contact: ContactPerson) -> ContactPersonResponse:
        """Convert ContactPerson model to response schema."""
        return ContactPersonResponse(
            id=contact.id,
            first_name=contact.first_name,
            last_name=contact.last_name,
            full_name=contact.full_name,
            email=contact.email,
            phone=contact.phone,
            mobile=contact.mobile,
            title=contact.title,
            department=contact.department,
            company=contact.company,
            address=contact.address,
            city=contact.city,
            state=contact.state,
            country=contact.country,
            postal_code=contact.postal_code,
            notes=contact.notes,
            is_primary=contact.is_primary,
            is_active=contact.is_active,
            created_at=contact.created_at,
            updated_at=contact.updated_at,
            created_by=contact.created_by,
            updated_by=contact.updated_by,
        )