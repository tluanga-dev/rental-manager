#!/usr/bin/env python3
"""
Unit Tests for Contact Person Module
Tests models, schemas, repository, and service logic
"""

import pytest
import asyncio
from typing import AsyncGenerator
from unittest.mock import Mock, AsyncMock
from uuid import uuid4, UUID
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import RentalManagerBaseModel
from app.models.contact_person import ContactPerson
from app.schemas.contact_person import (
    ContactPersonCreate,
    ContactPersonUpdate,
    ContactPersonResponse,
    ContactPersonSearch
)
from app.crud.contact_person import ContactPersonRepository
from app.services.contact_person import ContactPersonService
from app.core.errors import ValidationError, NotFoundError, ConflictError


class TestContactPersonModel:
    """Test ContactPerson model validation and methods."""
    
    def test_contact_person_creation(self):
        """Test basic contact person creation."""
        contact = ContactPerson(
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            phone="+1-555-123-4567",
            company="Test Company"
        )
        
        assert contact.first_name == "John"
        assert contact.last_name == "Doe"
        assert contact.full_name == "John Doe"
        assert contact.email == "john.doe@example.com"
        assert contact.phone == "+1-555-123-4567"
        assert contact.company == "Test Company"
        assert contact.is_primary is False
    
    def test_full_name_computation(self):
        """Test automatic full name computation."""
        contact = ContactPerson(first_name="Jane", last_name="Smith")
        assert contact.full_name == "Jane Smith"
        
        # Test with spaces
        contact2 = ContactPerson(first_name="  John  ", last_name="  Doe  ")
        assert contact2.full_name == "  John     Doe  "  # Constructor doesn't strip
    
    def test_display_name_property(self):
        """Test display name with and without title."""
        contact = ContactPerson(first_name="John", last_name="Doe")
        assert contact.display_name == "John Doe"
        
        contact.title = "CEO"
        assert contact.display_name == "John Doe (CEO)"
    
    def test_primary_contact_property(self):
        """Test primary contact method selection."""
        contact = ContactPerson(first_name="John", last_name="Doe")
        assert contact.primary_contact == "No contact info"
        
        contact.email = "john@example.com"
        assert contact.primary_contact == "john@example.com"
        
        contact.phone = "+1-555-1234"
        assert contact.primary_contact == "john@example.com"  # Email takes precedence
        
        contact.email = None
        assert contact.primary_contact == "+1-555-1234"
        
        contact.mobile = "+1-555-5678"
        assert contact.primary_contact == "+1-555-1234"  # Phone takes precedence over mobile
    
    def test_full_address_property(self):
        """Test full address formatting."""
        contact = ContactPerson(first_name="John", last_name="Doe")
        assert contact.full_address == ""
        
        contact.address = "123 Main St"
        assert contact.full_address == "123 Main St"
        
        contact.city = "New York"
        contact.state = "NY"
        contact.postal_code = "10001"
        contact.country = "USA"
        assert contact.full_address == "123 Main St, New York, NY, 10001, USA"
    
    def test_email_validation(self):
        """Test email validation."""
        contact = ContactPerson(first_name="John", last_name="Doe")
        
        # Valid email
        contact.email = "john@example.com"
        assert contact.email == "john@example.com"
        
        # Invalid email should raise ValueError
        with pytest.raises(ValueError, match="Invalid email format"):
            contact.email = "invalid-email"
    
    def test_phone_validation(self):
        """Test phone number validation."""
        contact = ContactPerson(first_name="John", last_name="Doe")
        
        # Valid phone numbers
        valid_phones = ["+1-555-123-4567", "+1 555 123 4567", "+15551234567", "5551234567"]
        for phone in valid_phones:
            contact.phone = phone
            assert contact.phone == phone
        
        # Invalid phone should raise ValueError
        with pytest.raises(ValueError, match="Invalid phone format"):
            contact.phone = "invalid-phone"
    
    def test_name_validation(self):
        """Test name field validation."""
        # Empty names should raise ValueError
        with pytest.raises(ValueError, match="first_name cannot be empty"):
            ContactPerson(first_name="", last_name="Doe")
        
        with pytest.raises(ValueError, match="last_name cannot be empty"):
            ContactPerson(first_name="John", last_name="")
    
    def test_postal_code_validation(self):
        """Test postal code validation."""
        contact = ContactPerson(first_name="John", last_name="Doe")
        
        # Valid postal codes
        contact.postal_code = "12345"
        assert contact.postal_code == "12345"
        
        contact.postal_code = "ABC 123"
        assert contact.postal_code == "ABC 123"
        
        # Invalid postal code
        with pytest.raises(ValueError, match="Invalid postal code format"):
            contact.postal_code = "AB"  # Too short
    
    def test_update_full_name(self):
        """Test update_full_name method."""
        contact = ContactPerson(first_name="John", last_name="Doe")
        assert contact.full_name == "John Doe"
        
        contact.first_name = "Jane"
        contact.update_full_name()
        assert contact.full_name == "Jane Doe"


class TestContactPersonSchemas:
    """Test Pydantic schemas for contact persons."""
    
    def test_contact_person_create_schema(self):
        """Test ContactPersonCreate schema validation."""
        data = {
            "first_name": "John",
            "last_name": "Doe",
            "email": "john@example.com",
            "phone": "+1-555-1234",
            "company": "Test Corp"
        }
        
        schema = ContactPersonCreate(**data)
        assert schema.first_name == "John"
        assert schema.last_name == "Doe"
        assert schema.email == "john@example.com"
        assert schema.is_primary is False
    
    def test_contact_person_create_validation(self):
        """Test validation in create schema."""
        # Invalid email
        with pytest.raises(ValueError, match="Invalid email format"):
            ContactPersonCreate(
                first_name="John",
                last_name="Doe",
                email="invalid-email"
            )
        
        # Empty names
        with pytest.raises(ValueError, match="Name cannot be empty"):
            ContactPersonCreate(first_name="", last_name="Doe")
    
    def test_contact_person_update_schema(self):
        """Test ContactPersonUpdate schema."""
        data = {"first_name": "Jane", "email": "jane@example.com"}
        schema = ContactPersonUpdate(**data)
        
        assert schema.first_name == "Jane"
        assert schema.email == "jane@example.com"
        assert schema.last_name is None  # Not provided
    
    def test_contact_person_search_schema(self):
        """Test ContactPersonSearch schema."""
        search = ContactPersonSearch(
            search_term="john",
            company="Test Corp",
            skip=10,
            limit=25
        )
        
        assert search.search_term == "john"
        assert search.company == "Test Corp"
        assert search.skip == 10
        assert search.limit == 25
        assert search.active_only is True


@pytest.fixture
async def async_session() -> AsyncGenerator[AsyncSession, None]:
    """Create async test database session."""
    # Use in-memory SQLite for testing
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False}
    )
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(RentalManagerBaseModel.metadata.create_all)
    
    # Create session
    async_session_maker = sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    
    async with async_session_maker() as session:
        yield session
    
    await engine.dispose()


class TestContactPersonRepository:
    """Test ContactPersonRepository methods."""
    
    @pytest.mark.asyncio
    async def test_create_contact(self, async_session: AsyncSession):
        """Test creating a contact person."""
        repo = ContactPersonRepository(async_session)
        
        contact_data = {
            "first_name": "John",
            "last_name": "Doe",
            "full_name": "John Doe",
            "email": "john@example.com",
            "company": "Test Corp"
        }
        
        contact = await repo.create(contact_data)
        
        assert contact.id is not None
        assert contact.first_name == "John"
        assert contact.last_name == "Doe"
        assert contact.email == "john@example.com"
        assert contact.is_active is True
    
    @pytest.mark.asyncio
    async def test_get_by_id(self, async_session: AsyncSession):
        """Test getting contact by ID."""
        repo = ContactPersonRepository(async_session)
        
        # Create contact
        contact_data = {
            "first_name": "Jane",
            "last_name": "Smith",
            "full_name": "Jane Smith",
            "email": "jane@example.com"
        }
        created_contact = await repo.create(contact_data)
        
        # Get by ID
        retrieved_contact = await repo.get_by_id(created_contact.id)
        
        assert retrieved_contact is not None
        assert retrieved_contact.id == created_contact.id
        assert retrieved_contact.first_name == "Jane"
    
    @pytest.mark.asyncio
    async def test_get_by_email(self, async_session: AsyncSession):
        """Test getting contact by email."""
        repo = ContactPersonRepository(async_session)
        
        contact_data = {
            "first_name": "Bob",
            "last_name": "Wilson",
            "full_name": "Bob Wilson",
            "email": "bob@example.com"
        }
        await repo.create(contact_data)
        
        # Get by email
        contact = await repo.get_by_email("bob@example.com")
        assert contact is not None
        assert contact.email == "bob@example.com"
        
        # Test case insensitive
        contact_upper = await repo.get_by_email("BOB@EXAMPLE.COM")
        assert contact_upper is None  # Our validation converts to lowercase
    
    @pytest.mark.asyncio
    async def test_search_contacts(self, async_session: AsyncSession):
        """Test searching contacts."""
        repo = ContactPersonRepository(async_session)
        
        # Create test contacts
        contacts_data = [
            {
                "first_name": "John", "last_name": "Doe", "full_name": "John Doe",
                "email": "john@techcorp.com", "company": "TechCorp"
            },
            {
                "first_name": "Jane", "last_name": "Smith", "full_name": "Jane Smith",
                "email": "jane@techcorp.com", "company": "TechCorp"
            },
            {
                "first_name": "Bob", "last_name": "Johnson", "full_name": "Bob Johnson",
                "email": "bob@othercorp.com", "company": "OtherCorp"
            }
        ]
        
        for data in contacts_data:
            await repo.create(data)
        
        # Search by company
        search_params = ContactPersonSearch(company="TechCorp")
        results = await repo.search(search_params)
        assert len(results) == 2
        
        # Search by name
        search_params = ContactPersonSearch(search_term="John")
        results = await repo.search(search_params)
        assert len(results) >= 1
        assert any(contact.first_name == "John" for contact in results)
    
    @pytest.mark.asyncio
    async def test_update_contact(self, async_session: AsyncSession):
        """Test updating a contact."""
        repo = ContactPersonRepository(async_session)
        
        # Create contact
        contact_data = {
            "first_name": "Alice",
            "last_name": "Brown",
            "full_name": "Alice Brown",
            "email": "alice@example.com"
        }
        contact = await repo.create(contact_data)
        
        # Update contact
        update_data = {"title": "Manager", "department": "Sales"}
        updated_contact = await repo.update(contact.id, update_data)
        
        assert updated_contact is not None
        assert updated_contact.title == "Manager"
        assert updated_contact.department == "Sales"
        assert updated_contact.first_name == "Alice"  # Unchanged
    
    @pytest.mark.asyncio
    async def test_soft_delete(self, async_session: AsyncSession):
        """Test soft delete functionality."""
        repo = ContactPersonRepository(async_session)
        
        # Create contact
        contact_data = {
            "first_name": "Charlie",
            "last_name": "Davis",
            "full_name": "Charlie Davis",
            "email": "charlie@example.com"
        }
        contact = await repo.create(contact_data)
        contact_id = contact.id
        
        # Delete contact
        success = await repo.delete(contact_id)
        assert success is True
        
        # Verify soft delete
        deleted_contact = await repo.get_by_id(contact_id)
        assert deleted_contact.is_active is False
    
    @pytest.mark.asyncio
    async def test_count_contacts(self, async_session: AsyncSession):
        """Test counting contacts."""
        repo = ContactPersonRepository(async_session)
        
        # Create test contacts
        for i in range(5):
            contact_data = {
                "first_name": f"User{i}",
                "last_name": "Test",
                "full_name": f"User{i} Test",
                "email": f"user{i}@example.com",
                "company": "TestCorp" if i < 3 else "OtherCorp"
            }
            await repo.create(contact_data)
        
        # Count all
        total = await repo.count_all()
        assert total == 5
        
        # Count by company
        tech_count = await repo.count_all(company="TestCorp")
        assert tech_count == 3


class TestContactPersonService:
    """Test ContactPersonService business logic."""
    
    @pytest.mark.asyncio
    async def test_create_contact_person_success(self):
        """Test successful contact person creation."""
        # Mock session and repository
        mock_session = Mock(spec=AsyncSession)
        mock_repo = Mock(spec=ContactPersonRepository)
        
        # Setup mocks
        mock_repo.get_by_email = AsyncMock(return_value=None)  # No existing contact
        mock_repo.create = AsyncMock()
        
        # Create mock contact
        mock_contact = Mock()
        mock_contact.id = uuid4()
        mock_contact.first_name = "John"
        mock_contact.last_name = "Doe"
        mock_contact.full_name = "John Doe"
        mock_contact.email = "john@example.com"
        mock_contact.phone = None
        mock_contact.mobile = None
        mock_contact.title = None
        mock_contact.department = None
        mock_contact.company = "Test Corp"
        mock_contact.address = None
        mock_contact.city = None
        mock_contact.state = None
        mock_contact.country = None
        mock_contact.postal_code = None
        mock_contact.notes = None
        mock_contact.is_primary = False
        mock_contact.is_active = True
        mock_contact.created_at = datetime.now()
        mock_contact.updated_at = datetime.now()
        mock_contact.created_by = None
        mock_contact.updated_by = None
        
        mock_repo.create.return_value = mock_contact
        
        # Create service with mocked dependencies
        service = ContactPersonService(mock_session)
        service.repository = mock_repo
        
        # Test data
        contact_data = ContactPersonCreate(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            company="Test Corp"
        )
        
        # Execute
        result = await service.create_contact_person(contact_data)
        
        # Verify
        assert isinstance(result, ContactPersonResponse)
        assert result.first_name == "John"
        assert result.last_name == "Doe"
        assert result.email == "john@example.com"
        
        # Verify repository was called
        mock_repo.get_by_email.assert_called_once_with("john@example.com")
        mock_repo.create.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_create_contact_person_duplicate_email(self):
        """Test creating contact with duplicate email."""
        # Mock session and repository
        mock_session = Mock(spec=AsyncSession)
        mock_repo = Mock(spec=ContactPersonRepository)
        
        # Setup mocks - existing contact found
        existing_contact = Mock()
        existing_contact.email = "existing@example.com"
        mock_repo.get_by_email = AsyncMock(return_value=existing_contact)
        
        # Create service
        service = ContactPersonService(mock_session)
        service.repository = mock_repo
        
        # Test data
        contact_data = ContactPersonCreate(
            first_name="John",
            last_name="Doe",
            email="existing@example.com"
        )
        
        # Execute and verify exception
        with pytest.raises(ConflictError, match="already exists"):
            await service.create_contact_person(contact_data)
    
    @pytest.mark.asyncio
    async def test_validate_contact_data(self):
        """Test contact data validation."""
        mock_session = Mock(spec=AsyncSession)
        mock_repo = Mock(spec=ContactPersonRepository)
        mock_repo.get_by_email = AsyncMock(return_value=None)
        
        service = ContactPersonService(mock_session)
        service.repository = mock_repo
        
        # Valid data should not raise exception
        valid_data = ContactPersonCreate(
            first_name="John",
            last_name="Doe",
            email="john@example.com"
        )
        await service.validate_contact_data(valid_data)  # Should not raise
        
        # Invalid data - no contact methods
        invalid_data = ContactPersonCreate(
            first_name="John",
            last_name="Doe"
        )
        with pytest.raises(ValidationError, match="At least one contact method"):
            await service.validate_contact_data(invalid_data)
    
    @pytest.mark.asyncio
    async def test_get_contact_person_not_found(self):
        """Test getting non-existent contact person."""
        mock_session = Mock(spec=AsyncSession)
        mock_repo = Mock(spec=ContactPersonRepository)
        mock_repo.get_by_id = AsyncMock(return_value=None)
        
        service = ContactPersonService(mock_session)
        service.repository = mock_repo
        
        result = await service.get_contact_person(uuid4())
        assert result is None
    
    @pytest.mark.asyncio
    async def test_update_contact_person_not_found(self):
        """Test updating non-existent contact person."""
        mock_session = Mock(spec=AsyncSession)
        mock_repo = Mock(spec=ContactPersonRepository)
        mock_repo.get_by_id = AsyncMock(return_value=None)
        
        service = ContactPersonService(mock_session)
        service.repository = mock_repo
        
        update_data = ContactPersonUpdate(first_name="Jane")
        
        with pytest.raises(NotFoundError, match="Contact person not found"):
            await service.update_contact_person(uuid4(), update_data)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])