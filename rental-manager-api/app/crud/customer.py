from typing import Optional, List, Dict, Any
from uuid import UUID
from decimal import Decimal
from datetime import datetime, date
from sqlalchemy import and_, or_, func, select, update, delete, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from app.models.customer import Customer, CustomerType, CustomerTier, BlacklistStatus, CustomerStatus


class CustomerRepository:
    """Repository for Customer operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_by_id(self, customer_id: UUID) -> Optional[Customer]:
        """Get customer by ID."""
        query = select(Customer).where(Customer.id == customer_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def get_by_code(self, customer_code: str) -> Optional[Customer]:
        """Get customer by code."""
        query = select(Customer).where(Customer.customer_code == customer_code)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def get_by_email(self, email: str) -> Optional[Customer]:
        """Get customer by email."""
        query = select(Customer).where(Customer.email == email.lower())
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def get_all(
        self, 
        skip: int = 0, 
        limit: int = 100,
        customer_type: Optional[CustomerType] = None,
        customer_status: Optional[CustomerStatus] = None,
        customer_tier: Optional[CustomerTier] = None,
        blacklist_status: Optional[BlacklistStatus] = None,
        active_only: bool = True
    ) -> List[Customer]:
        """Get all customers with optional filtering."""
        query = select(Customer)
        
        # Apply filters
        conditions = []
        if active_only:
            conditions.append(Customer.is_active == True)
        if customer_type:
            conditions.append(Customer.customer_type == customer_type.value)
        if customer_status:
            conditions.append(Customer.status == customer_status.value)
        if customer_tier:
            conditions.append(Customer.customer_tier == customer_tier.value)
        if blacklist_status:
            conditions.append(Customer.blacklist_status == blacklist_status.value)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        query = query.order_by(asc(Customer.customer_code)).offset(skip).limit(limit)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def search(
        self, 
        search_term: str, 
        skip: int = 0, 
        limit: int = 100,
        active_only: bool = True
    ) -> List[Customer]:
        """Search customers by name, code, or email."""
        query = select(Customer).where(
            or_(
                Customer.customer_code.ilike(f"%{search_term}%"),
                Customer.business_name.ilike(f"%{search_term}%"),
                Customer.first_name.ilike(f"%{search_term}%"),
                Customer.last_name.ilike(f"%{search_term}%"),
                Customer.email.ilike(f"%{search_term}%")
            )
        )
        
        if active_only:
            query = query.where(Customer.is_active == True)
        
        query = query.order_by(asc(Customer.customer_code)).offset(skip).limit(limit)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def count_all(
        self,
        customer_type: Optional[CustomerType] = None,
        customer_status: Optional[CustomerStatus] = None,
        customer_tier: Optional[CustomerTier] = None,
        blacklist_status: Optional[BlacklistStatus] = None,
        active_only: bool = True
    ) -> int:
        """Count all customers with optional filtering."""
        query = select(func.count(Customer.id))
        
        # Apply filters
        conditions = []
        if active_only:
            conditions.append(Customer.is_active == True)
        if customer_type:
            conditions.append(Customer.customer_type == customer_type.value)
        if customer_status:
            conditions.append(Customer.status == customer_status.value)
        if customer_tier:
            conditions.append(Customer.customer_tier == customer_tier.value)
        if blacklist_status:
            conditions.append(Customer.blacklist_status == blacklist_status.value)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        result = await self.session.execute(query)
        return result.scalar()
    
    async def create(self, customer_data: dict) -> Customer:
        """Create a new customer."""
        customer = Customer(**customer_data)
        self.session.add(customer)
        await self.session.commit()
        await self.session.refresh(customer)
        return customer
    
    async def update(self, customer_id: UUID, customer_data: dict) -> Optional[Customer]:
        """Update a customer."""
        query = select(Customer).where(Customer.id == customer_id)
        result = await self.session.execute(query)
        customer = result.scalar_one_or_none()
        
        if not customer:
            return None
        
        # Update fields
        for field, value in customer_data.items():
            if hasattr(customer, field):
                setattr(customer, field, value)
        
        await self.session.commit()
        await self.session.refresh(customer)
        return customer
    
    async def delete(self, customer_id: UUID) -> bool:
        """Soft delete a customer."""
        query = select(Customer).where(Customer.id == customer_id)
        result = await self.session.execute(query)
        customer = result.scalar_one_or_none()
        
        if not customer:
            return False
        
        customer.soft_delete()
        await self.session.commit()
        return True
    
    async def get_by_location(
        self, 
        city: Optional[str] = None,
        state: Optional[str] = None,
        country: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Customer]:
        """Get customers by location."""
        query = select(Customer)
        conditions = [Customer.is_active == True]
        
        if city:
            conditions.append(Customer.city.ilike(f"%{city}%"))
        if state:
            conditions.append(Customer.state.ilike(f"%{state}%"))
        if country:
            conditions.append(Customer.country.ilike(f"%{country}%"))
        
        query = query.where(and_(*conditions)).order_by(asc(Customer.customer_code)).offset(skip).limit(limit)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_top_customers_by_spending(self, limit: int = 10) -> List[Customer]:
        """Get top customers by total spending."""
        query = select(Customer).where(
            Customer.is_active == True
        ).order_by(desc(Customer.total_spent)).limit(limit)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_top_customers_by_rentals(self, limit: int = 10) -> List[Customer]:
        """Get top customers by total rentals."""
        query = select(Customer).where(
            Customer.is_active == True
        ).order_by(desc(Customer.total_rentals)).limit(limit)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_statistics(self) -> Dict[str, Any]:
        """Get customer statistics."""
        # Count by status
        total_customers = await self.count_all(active_only=False)
        active_customers = await self.count_all(active_only=True)
        
        # Count by type
        individual_customers = await self.count_all(customer_type=CustomerType.INDIVIDUAL, active_only=True)
        business_customers = await self.count_all(customer_type=CustomerType.BUSINESS, active_only=True)
        
        # Count by blacklist status
        blacklisted_customers = await self.count_all(blacklist_status=BlacklistStatus.BLACKLISTED, active_only=True)
        
        return {
            "total_customers": total_customers,
            "active_customers": active_customers,
            "inactive_customers": total_customers - active_customers,
            "individual_customers": individual_customers,
            "business_customers": business_customers,
            "blacklisted_customers": blacklisted_customers,
        }
    
    async def check_customer_code_exists(self, customer_code: str, exclude_id: Optional[UUID] = None) -> bool:
        """Check if customer code exists."""
        query = select(Customer.id).where(Customer.customer_code == customer_code)
        if exclude_id:
            query = query.where(Customer.id != exclude_id)
        
        result = await self.session.execute(query)
        return result.scalar_one_or_none() is not None
    
    async def check_email_exists(self, email: str, exclude_id: Optional[UUID] = None) -> bool:
        """Check if email exists."""
        query = select(Customer.id).where(Customer.email == email.lower())
        if exclude_id:
            query = query.where(Customer.id != exclude_id)
        
        result = await self.session.execute(query)
        return result.scalar_one_or_none() is not None