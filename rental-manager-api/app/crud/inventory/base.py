"""
Base CRUD class for inventory operations.

Provides common functionality for all inventory CRUD operations.
"""

from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union
from uuid import UUID
from datetime import datetime

from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlalchemy import and_, select, func, or_, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.base import RentalManagerBaseModel as DBBaseModel

ModelType = TypeVar("ModelType", bound=DBBaseModel)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """
    Base CRUD operations with async support.
    
    Provides standard CRUD operations that can be inherited by specific
    inventory CRUD classes.
    """
    
    def __init__(self, model: Type[ModelType]):
        """
        Initialize CRUD object with model class.
        
        Args:
            model: SQLAlchemy model class
        """
        self.model = model
    
    async def get(
        self,
        db: AsyncSession,
        id: UUID,
        *,
        include_deleted: bool = False
    ) -> Optional[ModelType]:
        """
        Get a single record by ID.
        
        Args:
            db: Database session
            id: Record ID
            include_deleted: Include soft-deleted records
            
        Returns:
            Model instance or None
        """
        query = select(self.model).where(self.model.id == id)
        
        if hasattr(self.model, 'is_active') and not include_deleted:
            query = query.where(self.model.is_active == True)
        
        result = await db.execute(query)
        return result.scalar_one_or_none()
    
    async def get_multi(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        include_deleted: bool = False
    ) -> List[ModelType]:
        """
        Get multiple records with pagination.
        
        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum number of records to return
            include_deleted: Include soft-deleted records
            
        Returns:
            List of model instances
        """
        query = select(self.model)
        
        if hasattr(self.model, 'is_active') and not include_deleted:
            query = query.where(self.model.is_active == True)
        
        query = query.offset(skip).limit(limit)
        
        if hasattr(self.model, 'created_at'):
            query = query.order_by(desc(self.model.created_at))
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def create(
        self,
        db: AsyncSession,
        *,
        obj_in: CreateSchemaType,
        created_by: Optional[UUID] = None
    ) -> ModelType:
        """
        Create a new record.
        
        Args:
            db: Database session
            obj_in: Create schema
            created_by: User ID who created the record
            
        Returns:
            Created model instance
        """
        obj_in_data = jsonable_encoder(obj_in)
        
        if created_by and hasattr(self.model, 'created_by'):
            obj_in_data['created_by'] = created_by
            obj_in_data['updated_by'] = created_by
        
        db_obj = self.model(**obj_in_data)
        
        # Validate if model has validate method
        if hasattr(db_obj, 'validate'):
            db_obj.validate()
        
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj
    
    async def update(
        self,
        db: AsyncSession,
        *,
        db_obj: ModelType,
        obj_in: Union[UpdateSchemaType, Dict[str, Any]],
        updated_by: Optional[UUID] = None
    ) -> ModelType:
        """
        Update an existing record.
        
        Args:
            db: Database session
            db_obj: Existing model instance
            obj_in: Update schema or dictionary
            updated_by: User ID who updated the record
            
        Returns:
            Updated model instance
        """
        obj_data = jsonable_encoder(db_obj)
        
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)
        
        # Update fields
        for field in obj_data:
            if field in update_data:
                setattr(db_obj, field, update_data[field])
        
        # Update audit fields
        if updated_by and hasattr(db_obj, 'updated_by'):
            db_obj.updated_by = updated_by
        
        if hasattr(db_obj, 'updated_at'):
            db_obj.updated_at = datetime.utcnow()
        
        # Increment version for optimistic locking
        if hasattr(db_obj, 'version'):
            db_obj.version += 1
        
        # Validate if model has validate method
        if hasattr(db_obj, 'validate'):
            db_obj.validate()
        
        await db.flush()
        await db.refresh(db_obj)
        return db_obj
    
    async def remove(
        self,
        db: AsyncSession,
        *,
        id: UUID,
        soft_delete: bool = True,
        deleted_by: Optional[UUID] = None
    ) -> Optional[ModelType]:
        """
        Delete a record (soft or hard delete).
        
        Args:
            db: Database session
            id: Record ID
            soft_delete: Use soft delete if available
            deleted_by: User ID who deleted the record
            
        Returns:
            Deleted model instance or None
        """
        obj = await self.get(db, id=id, include_deleted=True)
        
        if not obj:
            return None
        
        if soft_delete and hasattr(obj, 'is_active'):
            # Soft delete
            obj.is_active = False
            
            if hasattr(obj, 'deleted_at'):
                obj.deleted_at = datetime.utcnow()
            
            if deleted_by and hasattr(obj, 'deleted_by'):
                obj.deleted_by = deleted_by
            
            await db.flush()
            await db.refresh(obj)
        else:
            # Hard delete
            await db.delete(obj)
            await db.flush()
        
        return obj
    
    async def count(
        self,
        db: AsyncSession,
        *,
        include_deleted: bool = False
    ) -> int:
        """
        Count total records.
        
        Args:
            db: Database session
            include_deleted: Include soft-deleted records
            
        Returns:
            Total count
        """
        query = select(func.count()).select_from(self.model)
        
        if hasattr(self.model, 'is_active') and not include_deleted:
            query = query.where(self.model.is_active == True)
        
        result = await db.execute(query)
        return result.scalar()
    
    async def exists(
        self,
        db: AsyncSession,
        *,
        id: UUID,
        include_deleted: bool = False
    ) -> bool:
        """
        Check if a record exists.
        
        Args:
            db: Database session
            id: Record ID
            include_deleted: Include soft-deleted records
            
        Returns:
            True if exists, False otherwise
        """
        query = select(func.count()).select_from(self.model).where(self.model.id == id)
        
        if hasattr(self.model, 'is_active') and not include_deleted:
            query = query.where(self.model.is_active == True)
        
        result = await db.execute(query)
        return result.scalar() > 0
    
    async def get_by_field(
        self,
        db: AsyncSession,
        *,
        field_name: str,
        field_value: Any,
        include_deleted: bool = False
    ) -> Optional[ModelType]:
        """
        Get a record by a specific field value.
        
        Args:
            db: Database session
            field_name: Field name to search by
            field_value: Value to search for
            include_deleted: Include soft-deleted records
            
        Returns:
            Model instance or None
        """
        query = select(self.model).where(
            getattr(self.model, field_name) == field_value
        )
        
        if hasattr(self.model, 'is_active') and not include_deleted:
            query = query.where(self.model.is_active == True)
        
        result = await db.execute(query)
        return result.scalar_one_or_none()
    
    async def get_multi_by_field(
        self,
        db: AsyncSession,
        *,
        field_name: str,
        field_value: Any,
        skip: int = 0,
        limit: int = 100,
        include_deleted: bool = False
    ) -> List[ModelType]:
        """
        Get multiple records by a specific field value.
        
        Args:
            db: Database session
            field_name: Field name to search by
            field_value: Value to search for
            skip: Number of records to skip
            limit: Maximum number of records to return
            include_deleted: Include soft-deleted records
            
        Returns:
            List of model instances
        """
        query = select(self.model).where(
            getattr(self.model, field_name) == field_value
        )
        
        if hasattr(self.model, 'is_active') and not include_deleted:
            query = query.where(self.model.is_active == True)
        
        query = query.offset(skip).limit(limit)
        
        if hasattr(self.model, 'created_at'):
            query = query.order_by(desc(self.model.created_at))
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def bulk_create(
        self,
        db: AsyncSession,
        *,
        objs_in: List[CreateSchemaType],
        created_by: Optional[UUID] = None
    ) -> List[ModelType]:
        """
        Create multiple records in bulk.
        
        Args:
            db: Database session
            objs_in: List of create schemas
            created_by: User ID who created the records
            
        Returns:
            List of created model instances
        """
        db_objs = []
        
        for obj_in in objs_in:
            obj_in_data = jsonable_encoder(obj_in)
            
            if created_by and hasattr(self.model, 'created_by'):
                obj_in_data['created_by'] = created_by
                obj_in_data['updated_by'] = created_by
            
            db_obj = self.model(**obj_in_data)
            
            # Validate if model has validate method
            if hasattr(db_obj, 'validate'):
                db_obj.validate()
            
            db.add(db_obj)
            db_objs.append(db_obj)
        
        await db.flush()
        
        # Refresh all objects
        for db_obj in db_objs:
            await db.refresh(db_obj)
        
        return db_objs
    
    async def search(
        self,
        db: AsyncSession,
        *,
        search_term: str,
        search_fields: List[str],
        skip: int = 0,
        limit: int = 100,
        include_deleted: bool = False
    ) -> List[ModelType]:
        """
        Search records by multiple fields.
        
        Args:
            db: Database session
            search_term: Search term
            search_fields: List of field names to search in
            skip: Number of records to skip
            limit: Maximum number of records to return
            include_deleted: Include soft-deleted records
            
        Returns:
            List of matching model instances
        """
        conditions = []
        for field_name in search_fields:
            if hasattr(self.model, field_name):
                field = getattr(self.model, field_name)
                conditions.append(field.ilike(f"%{search_term}%"))
        
        if not conditions:
            return []
        
        query = select(self.model).where(or_(*conditions))
        
        if hasattr(self.model, 'is_active') and not include_deleted:
            query = query.where(self.model.is_active == True)
        
        query = query.offset(skip).limit(limit)
        
        if hasattr(self.model, 'created_at'):
            query = query.order_by(desc(self.model.created_at))
        
        result = await db.execute(query)
        return result.scalars().all()