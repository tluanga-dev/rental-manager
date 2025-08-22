# app/repositories/transaction_header_repository.py
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.modules.transactions.base.models.transaction_headers import TransactionHeader, TransactionStatus, TransactionType




class TransactionHeaderRepository:
    """
    CRUD operations for TransactionHeader.
    """

    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------
    def create(self, obj_in: Dict[str, Any]) -> TransactionHeader:
        """
        Create a new TransactionHeader.
        obj_in: dict with column names as keys.
        """
        db_obj = TransactionHeader(**obj_in)
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------
    def get_by_id(self, transaction_id: UUID) -> Optional[TransactionHeader]:
        return (
            self.db.query(TransactionHeader)
            .filter(TransactionHeader.id == transaction_id)
            .first()
        )

    def get_by_number(self, transaction_number: str) -> Optional[TransactionHeader]:
        return (
            self.db.query(TransactionHeader)
            .filter(TransactionHeader.transaction_number == transaction_number)
            .first()
        )

    def list_by_customer(
        self,
        customer_id: str,
        *,
        skip: int = 0,
        limit: int = 100,
        transaction_type: Optional[TransactionType] = None,
    ) -> List[TransactionHeader]:
        q = self.db.query(TransactionHeader).filter(
            TransactionHeader.customer_id == customer_id
        )
        if transaction_type:
            q = q.filter(TransactionHeader.transaction_type == transaction_type)
        return q.offset(skip).limit(limit).all()

    def list_by_date_range(
        self,
        from_date: date,
        to_date: date,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> List[TransactionHeader]:
        return (
            self.db.query(TransactionHeader)
            .filter(
                and_(
                    TransactionHeader.transaction_date >= from_date,
                    TransactionHeader.transaction_date <= to_date,
                )
            )
            .order_by(TransactionHeader.transaction_date.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    # ------------------------------------------------------------------
    # Update
    # ------------------------------------------------------------------
    def update(
        self,
        db_obj: TransactionHeader,
        obj_in: Dict[str, Any],
    ) -> TransactionHeader:
        for field, value in obj_in.items():
            setattr(db_obj, field, value)
        db_obj.updated_at = datetime.now(timezone.utc)
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------
    def delete(self, db_obj: TransactionHeader) -> None:
        self.db.delete(db_obj)
        self.db.commit()

    # ------------------------------------------------------------------
    # Aggregates / Helpers
    # ------------------------------------------------------------------
    def count_by_status(self, status: TransactionStatus) -> int:
        return (
            self.db.query(TransactionHeader)
            .filter(TransactionHeader.status == status)
            .count()
        )

    def list_overdue_rentals(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> List[TransactionHeader]:
        """
        Quick filter for rentals that are marked as late.
        """
        return (
            self.db.query(TransactionHeader)
            .filter(
                and_(
                    TransactionHeader.transaction_type == TransactionType.RENTAL,
                    TransactionHeader.status != TransactionStatus.CANCELLED,
                    or_(
                        TransactionHeader.status == TransactionStatus.IN_PROGRESS,
                        TransactionHeader.status == TransactionStatus.ON_HOLD,
                    ),
                )
            )
            .order_by(TransactionHeader.rental_end_date.asc())
            .offset(skip)
            .limit(limit)
            .all()
        )