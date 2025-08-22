from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.errors import ValidationError, NotFoundError, ConflictError
from app.services.contact_person import ContactPersonService
from app.schemas.contact_person import (
    ContactPersonCreate,
    ContactPersonUpdate,
    ContactPersonResponse,
    ContactPersonSearch,
    ContactPersonStats
)
from app.schemas.common import PaginatedResponse

router = APIRouter()


def get_contact_person_service(session: AsyncSession = Depends(get_db)) -> ContactPersonService:
    """Dependency to get ContactPersonService."""
    return ContactPersonService(session)


@router.post("/", response_model=ContactPersonResponse, status_code=status.HTTP_201_CREATED)
async def create_contact_person(
    contact_data: ContactPersonCreate,
    service: ContactPersonService = Depends(get_contact_person_service)
):
    """
    Create a new contact person.
    
    - **first_name**: Required first name
    - **last_name**: Required last name  
    - **email**: Optional email address (must be unique)
    - **phone**: Optional phone number
    - **mobile**: Optional mobile number
    - **company**: Optional company name
    - **title**: Optional job title
    - **is_primary**: Whether this is a primary contact
    """
    try:
        # Validate contact data
        await service.validate_contact_data(contact_data)
        
        # Create contact person
        return await service.create_contact_person(contact_data)
    
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{contact_id}", response_model=ContactPersonResponse)
async def get_contact_person(
    contact_id: UUID,
    service: ContactPersonService = Depends(get_contact_person_service)
):
    """Get a contact person by ID."""
    contact = await service.get_contact_person(contact_id)
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact person not found")
    
    return contact


@router.put("/{contact_id}", response_model=ContactPersonResponse)
async def update_contact_person(
    contact_id: UUID,
    update_data: ContactPersonUpdate,
    service: ContactPersonService = Depends(get_contact_person_service)
):
    """Update a contact person."""
    try:
        return await service.update_contact_person(contact_id, update_data)
    
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact_person(
    contact_id: UUID,
    service: ContactPersonService = Depends(get_contact_person_service)
):
    """Delete a contact person (soft delete)."""
    try:
        success = await service.delete_contact_person(contact_id)
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact person not found")
    
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/", response_model=List[ContactPersonResponse])
async def list_contact_persons(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=1000, description="Number of records to return"),
    active_only: bool = Query(True, description="Only return active contacts"),
    service: ContactPersonService = Depends(get_contact_person_service)
):
    """
    List contact persons with pagination.
    
    - **skip**: Number of records to skip for pagination
    - **limit**: Maximum number of records to return (1-1000)
    - **active_only**: Whether to return only active contacts
    """
    try:
        return await service.list_contact_persons(
            skip=skip,
            limit=limit,
            active_only=active_only
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/search", response_model=List[ContactPersonResponse])
async def search_contact_persons(
    search_params: ContactPersonSearch,
    service: ContactPersonService = Depends(get_contact_person_service)
):
    """
    Search contact persons with advanced filtering.
    
    - **search_term**: Search by name, email, phone, or company
    - **company**: Filter by company name
    - **is_primary**: Filter by primary contact status
    - **city/state/country**: Filter by location
    - **skip/limit**: Pagination parameters
    - **active_only**: Only return active contacts
    """
    try:
        return await service.search_contact_persons(search_params)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/company/{company_name}", response_model=List[ContactPersonResponse])
async def get_contacts_by_company(
    company_name: str,
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=1000, description="Number of records to return"),
    active_only: bool = Query(True, description="Only return active contacts"),
    service: ContactPersonService = Depends(get_contact_person_service)
):
    """Get contact persons by company name."""
    try:
        return await service.get_contact_persons_by_company(
            company=company_name,
            skip=skip,
            limit=limit,
            active_only=active_only
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/primary/contacts", response_model=List[ContactPersonResponse])
async def get_primary_contacts(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=1000, description="Number of records to return"),
    active_only: bool = Query(True, description="Only return active contacts"),
    service: ContactPersonService = Depends(get_contact_person_service)
):
    """Get all primary contact persons."""
    try:
        return await service.get_primary_contacts(
            skip=skip,
            limit=limit,
            active_only=active_only
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/{contact_id}/set-primary", response_model=ContactPersonResponse)
async def set_primary_contact(
    contact_id: UUID,
    company: Optional[str] = Query(None, description="Company to set primary for"),
    service: ContactPersonService = Depends(get_contact_person_service)
):
    """Set a contact person as primary for their company."""
    try:
        return await service.set_primary_contact(contact_id, company)
    
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/stats/overview", response_model=ContactPersonStats)
async def get_contact_person_statistics(
    service: ContactPersonService = Depends(get_contact_person_service)
):
    """Get contact person statistics and overview."""
    try:
        return await service.get_contact_person_statistics()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/recent/contacts", response_model=List[ContactPersonResponse])
async def get_recent_contacts(
    limit: int = Query(10, ge=1, le=50, description="Number of recent contacts to return"),
    service: ContactPersonService = Depends(get_contact_person_service)
):
    """Get recently created contact persons."""
    try:
        return await service.get_recent_contacts(limit=limit)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/email/{email}", response_model=ContactPersonResponse)
async def get_contact_by_email(
    email: str,
    service: ContactPersonService = Depends(get_contact_person_service)
):
    """Get a contact person by email address."""
    try:
        contact = await service.get_contact_person_by_email(email)
        if not contact:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact person not found")
        
        return contact
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/bulk/update-company")
async def bulk_update_company(
    old_company: str = Query(..., description="Current company name"),
    new_company: str = Query(..., description="New company name"),
    service: ContactPersonService = Depends(get_contact_person_service)
):
    """Bulk update company name for all contacts."""
    try:
        updated_count = await service.bulk_update_company(old_company, new_company)
        return {
            "message": f"Successfully updated {updated_count} contact persons",
            "updated_count": updated_count,
            "old_company": old_company,
            "new_company": new_company
        }
    
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/count/total")
async def count_contact_persons(
    company: Optional[str] = Query(None, description="Filter by company"),
    is_primary: Optional[bool] = Query(None, description="Filter by primary status"),
    active_only: bool = Query(True, description="Only count active contacts"),
    service: ContactPersonService = Depends(get_contact_person_service)
):
    """Count contact persons with optional filtering."""
    try:
        count = await service.count_contact_persons(
            company=company,
            is_primary=is_primary,
            active_only=active_only
        )
        return {"total_count": count}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))