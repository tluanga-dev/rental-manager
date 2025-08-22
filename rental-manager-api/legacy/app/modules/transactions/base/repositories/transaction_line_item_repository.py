# app/repositories/transaction_line_repository.py
from typing import Optional, List, Dict, Any
from uuid import UUID
from decimal import Decimal

from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.modules.transactions.base.models.transaction_headers import TransactionStatus
from app.modules.transactions.base.models.transaction_lines import TransactionLine




class TransactionLineRepository:
    """
    CRUD operations for TransactionLine.
    """

    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------
    def create(self, obj_in: Dict[str, Any]) -> TransactionLine:
        db_obj = TransactionLine(**obj_in)
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    def bulk_create(self, objs_in: List[Dict[str, Any]]) -> List[TransactionLine]:
        db_objs = [TransactionLine(**obj) for obj in objs_in]
        self.db.add_all(db_objs)
        self.db.commit()
        for obj in db_objs:
            self.db.refresh(obj)
        return db_objs

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------
    def get_by_id(self, line_id: UUID) -> Optional[TransactionLine]:
        return (
            self.db.query(TransactionLine)
            .filter(TransactionLine.id == line_id)
            .first()
        )

    def list_by_transaction(
        self,
        transaction_id: UUID,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> List[TransactionLine]:
        return (
            self.db.query(TransactionLine)
            .filter(TransactionLine.transaction_id == transaction_id)
            .order_by(TransactionLine.line_number)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def list_by_item(
        self,
        item_id: UUID,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> List[TransactionLine]:
        return (
            self.db.query(TransactionLine)
            .filter(TransactionLine.item_id == item_id)
            .order_by(TransactionLine.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    # ------------------------------------------------------------------
    # Update
    # ------------------------------------------------------------------
    def update(
        self,
        db_obj: TransactionLine,
        obj_in: Dict[str, Any],
    ) -> TransactionLine:
        for field, value in obj_in.items():
            setattr(db_obj, field, value)
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------
    def delete(self, db_obj: TransactionLine) -> None:
        self.db.delete(db_obj)
        self.db.commit()

    # ------------------------------------------------------------------
    # Rental-specific helpers
    # ------------------------------------------------------------------
    def list_rental_lines_due_on(
        self,
        due_date: Any,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> List[TransactionLine]:
        """
        Lines whose rental_end_date falls on the given date
        and whose transaction is still open.
        """
        return (
            self.db.query(TransactionLine)
            .join(TransactionLine.transaction)
            .filter(
                and_(
                    TransactionLine.rental_end_date == due_date,
                    TransactionLine.transaction.has(
                        TransactionStatus.IN_PROGRESS
                    ),
                )
            )
            .order_by(TransactionLine.rental_end_date)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def sum_rental_deposits_by_item(
        self,
        item_id: UUID,
    ) -> Decimal:
        """
        Total deposits currently held for a given item
        (rentals that are still active).
        """
        from sqlalchemy import func
        result = (
            self.db.query(func.coalesce(func.sum(TransactionLine.deposit_amount), 0))
            .join(TransactionLine.transaction)
            .filter(
                and_(
                    TransactionLine.item_id == item_id,
                    TransactionLine.deposit_amount.is_not(None),
                    TransactionLine.transaction.has(
                        TransactionStatus.IN_PROGRESS
                    ),
                )
            )
            .scalar()
        )
        return Decimal(result or 0)
    
    