from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.customer import CustomerRepository
from app.models.customer import Customer, CustomerType, CustomerStatus, BlacklistStatus, CreditRating
from app.schemas.customer import (
    CustomerCreate, CustomerUpdate, CustomerResponse, CustomerStatusUpdate,
    CustomerBlacklistUpdate, CustomerCreditUpdate, CustomerSearchRequest,
    CustomerStatsResponse, CustomerAddressCreate, CustomerAddressResponse,
    CustomerContactCreate, CustomerContactResponse, CustomerDetailResponse
)
from app.core.errors import ValidationError, NotFoundError, ConflictError
from app.shared.pagination import Page


class CustomerService:
    """Customer service."""
    
    def __init__(self, session: AsyncSession):
        """Initialize service with database session."""
        self.session = session
        self.repository = CustomerRepository(session)
    
    async def create_customer(self, customer_data: CustomerCreate) -> CustomerResponse:
        """Create a new customer."""
        # Check if customer code already exists
        if await self.repository.check_customer_code_exists(customer_data.customer_code):
            raise ConflictError(f"Customer with code '{customer_data.customer_code}' already exists")
        
        # Check if email already exists
        if await self.repository.check_email_exists(customer_data.email):
            raise ConflictError(f"Customer with email '{customer_data.email}' already exists")
        
        # Create customer data
        customer_dict = {
            "customer_code": customer_data.customer_code.upper(),
            "customer_type": customer_data.customer_type,
            "business_name": customer_data.business_name,
            "first_name": customer_data.first_name,
            "last_name": customer_data.last_name,
            "email": customer_data.email.lower(),
            "phone": customer_data.phone,
            "mobile": customer_data.mobile,
            "address_line1": customer_data.address_line1,
            "address_line2": customer_data.address_line2,
            "city": customer_data.city,
            "state": customer_data.state,
            "postal_code": customer_data.postal_code,
            "country": customer_data.country,
            "tax_number": customer_data.tax_number,
            "credit_limit": customer_data.credit_limit or 0.0,
            "payment_terms": customer_data.payment_terms or "NET_30",
            "notes": customer_data.notes,
            "status": CustomerStatus.ACTIVE,
            "blacklist_status": BlacklistStatus.CLEAR,
            "credit_rating": CreditRating.GOOD,
            "total_rentals": 0,
            "total_spent": 0.0,
            "lifetime_value": 0.0,
            "is_active": True
        }
        
        # Create customer
        customer = await self.repository.create(customer_dict)
        
        return CustomerResponse.model_validate(customer)
    
    async def get_customer(self, customer_id: UUID) -> Optional[CustomerResponse]:
        """Get customer by ID."""
        customer = await self.repository.get_by_id(customer_id)
        if not customer:
            return None
        
        return CustomerResponse.model_validate(customer)
    
    async def get_customer_by_code(self, customer_code: str) -> Optional[CustomerResponse]:
        """Get customer by code."""
        customer = await self.repository.get_by_code(customer_code.upper())
        if not customer:
            return None
        
        return CustomerResponse.model_validate(customer)
    
    async def update_customer(self, customer_id: UUID, update_data: CustomerUpdate) -> CustomerResponse:
        """Update customer information."""
        customer = await self.repository.get_by_id(customer_id)
        if not customer:
            raise NotFoundError("Customer not found")
        
        # Check if email is being updated and already exists
        if update_data.email and update_data.email.lower() != customer.email:
            if await self.repository.check_email_exists(update_data.email, exclude_id=customer_id):
                raise ConflictError(f"Customer with email '{update_data.email}' already exists")
        
        # Build update dictionary
        update_dict = {}
        update_fields = [
            'customer_type', 'business_name', 'first_name', 'last_name', 'email',
            'phone', 'mobile', 'address_line1', 'address_line2', 'city', 'state',
            'postal_code', 'country', 'tax_number', 'credit_limit', 'payment_terms', 'notes'
        ]
        
        for field in update_fields:
            value = getattr(update_data, field, None)
            if value is not None:
                if field == 'email':
                    value = value.lower()
                update_dict[field] = value
        
        updated_customer = await self.repository.update(customer_id, update_dict)
        
        return CustomerResponse.model_validate(updated_customer)
    
    async def delete_customer(self, customer_id: UUID) -> bool:
        """Delete customer."""
        return await self.repository.delete(customer_id)
    
    async def list_customers(
        self,
        skip: int = 0,
        limit: int = 100,
        customer_type: Optional[CustomerType] = None,
        status: Optional[CustomerStatus] = None,
        blacklist_status: Optional[BlacklistStatus] = None,
        active_only: bool = True
    ) -> List[CustomerResponse]:
        """List customers with filtering."""
        customers = await self.repository.get_all(
            skip=skip,
            limit=limit,
            customer_type=customer_type,
            customer_status=status,
            blacklist_status=blacklist_status,
            active_only=active_only
        )
        
        return [CustomerResponse.model_validate(customer) for customer in customers]
    
    async def search_customers(
        self,
        search_term: str,
        skip: int = 0,
        limit: int = 100,
        active_only: bool = True
    ) -> List[CustomerResponse]:
        """Search customers."""
        if len(search_term) < 2:
            raise ValidationError("Search term must be at least 2 characters long")
        
        customers = await self.repository.search(
            search_term=search_term,
            skip=skip,
            limit=limit,
            active_only=active_only
        )
        
        return [CustomerResponse.model_validate(customer) for customer in customers]
    
    async def count_customers(
        self,
        customer_type: Optional[CustomerType] = None,
        status: Optional[CustomerStatus] = None,
        blacklist_status: Optional[BlacklistStatus] = None,
        active_only: bool = True
    ) -> int:
        """Count customers with filtering."""
        return await self.repository.count_all(
            customer_type=customer_type,
            customer_status=status,
            blacklist_status=blacklist_status,
            active_only=active_only
        )
    
    async def update_customer_status(self, customer_id: UUID, status_update: CustomerStatusUpdate) -> CustomerResponse:
        """Update customer status."""
        customer = await self.repository.get_by_id(customer_id)
        if not customer:
            raise NotFoundError("Customer not found")
        
        update_dict = {
            "status": status_update.status
        }
        
        if status_update.notes:
            update_dict["notes"] = status_update.notes
        
        updated_customer = await self.repository.update(customer_id, update_dict)
        return CustomerResponse.model_validate(updated_customer)
    
    async def update_blacklist_status(self, customer_id: UUID, blacklist_update: CustomerBlacklistUpdate) -> CustomerResponse:
        """Update customer blacklist status."""
        customer = await self.repository.get_by_id(customer_id)
        if not customer:
            raise NotFoundError("Customer not found")
        
        # Use the model's blacklist methods for business logic
        if blacklist_update.blacklist_status == BlacklistStatus.BLACKLISTED:
            customer.blacklist(
                reason=blacklist_update.blacklist_reason or "No reason provided",
                by_user=None  # TODO: Get from current user context
            )
        elif blacklist_update.blacklist_status == BlacklistStatus.CLEAR:
            customer.clear_blacklist(by_user=None)  # TODO: Get from current user context
        else:
            # Warning status
            customer.blacklist_status = BlacklistStatus.WARNING
            customer.blacklist_reason = blacklist_update.blacklist_reason
        
        if blacklist_update.notes:
            customer.notes = blacklist_update.notes
        
        await self.session.commit()
        await self.session.refresh(customer)
        
        return CustomerResponse.model_validate(customer)
    
    async def update_credit_info(self, customer_id: UUID, credit_update: CustomerCreditUpdate) -> CustomerResponse:
        """Update customer credit information."""
        customer = await self.repository.get_by_id(customer_id)
        if not customer:
            raise NotFoundError("Customer not found")
        
        update_dict = {}
        if credit_update.credit_limit is not None:
            update_dict["credit_limit"] = credit_update.credit_limit
        if credit_update.credit_rating is not None:
            update_dict["credit_rating"] = credit_update.credit_rating
        if credit_update.payment_terms is not None:
            update_dict["payment_terms"] = credit_update.payment_terms
        if credit_update.notes is not None:
            update_dict["notes"] = credit_update.notes
        
        updated_customer = await self.repository.update(customer_id, update_dict)
        return CustomerResponse.model_validate(updated_customer)
    
    async def get_customers_by_location(
        self,
        city: Optional[str] = None,
        state: Optional[str] = None,
        country: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[CustomerResponse]:
        """Get customers by location."""
        customers = await self.repository.get_by_location(
            city=city,
            state=state,
            country=country,
            skip=skip,
            limit=limit
        )
        
        return [CustomerResponse.model_validate(customer) for customer in customers]
    
    async def get_customer_statistics(self) -> Dict[str, Any]:
        """Get customer statistics."""
        # Get basic statistics
        basic_stats = await self.repository.get_statistics()
        
        # Get top customers
        top_by_spending = await self.repository.get_top_customers_by_spending(limit=10)
        top_by_rentals = await self.repository.get_top_customers_by_rentals(limit=10)
        
        # Get recent customers
        recent_customers = await self.repository.get_all(skip=0, limit=10, active_only=True)
        
        return {
            **basic_stats,
            "customers_by_credit_rating": {},  # TODO: Implement credit rating breakdown
            "customers_by_state": {},  # TODO: Implement state breakdown
            "top_customers_by_rentals": [
                {
                    "id": str(c.id),
                    "customer_code": c.customer_code,
                    "display_name": c.display_name,
                    "total_rentals": int(c.total_rentals)
                }
                for c in top_by_rentals
            ],
            "top_customers_by_spending": [
                {
                    "id": str(c.id),
                    "customer_code": c.customer_code,
                    "display_name": c.display_name,
                    "total_spent": float(c.total_spent)
                }
                for c in top_by_spending
            ],
            "recent_customers": [CustomerResponse.model_validate(customer) for customer in recent_customers]
        }
    
    async def validate_customer_code(self, customer_code: str, exclude_id: Optional[UUID] = None) -> bool:
        """Validate if customer code is available."""
        return not await self.repository.check_customer_code_exists(customer_code.upper(), exclude_id)
    
    async def validate_email(self, email: str, exclude_id: Optional[UUID] = None) -> bool:
        """Validate if email is available."""
        return not await self.repository.check_email_exists(email.lower(), exclude_id)