from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.modules.transactions.rentals.rental_core.repository import RentalsRepository
from app.modules.transactions.rentals.rental_core.schemas import NewRentalRequest
from app.modules.transactions.base.models.transaction_headers import TransactionHeader, TransactionType
from app.modules.transactions.base.models.transaction_lines import TransactionLine




class RentalsService:
    def __init__(self, repo: RentalsRepository | None = None) -> None:
        self.repo = repo or RentalsRepository()

    async def create_rental(
        self, session: AsyncSession, dto: NewRentalRequest
    ) -> dict:
        try:
            result = await self.repo.create_transaction(session, dto)
            
            # Ensure we always have a transaction_id
            transaction_id_str = result.get("tx_id") or result.get("id")
            transaction_number = result.get("tx_number") or result.get("transaction_number")
            
            if not transaction_id_str:
                raise ValueError("Transaction creation succeeded but no transaction ID was returned")
            
            # Create a proper data structure for the response
            rental_data = {
                "id": transaction_id_str,
                "transaction_id": transaction_id_str,
                "transaction_number": transaction_number,
                "customer_id": str(dto.customer_id),
                "location_id": str(dto.location_id) if dto.location_id else None,
                "transaction_date": str(dto.transaction_date),
                "payment_method": dto.payment_method,
                "notes": dto.notes or "",
                "created_at": datetime.now().isoformat(),
                "status": "COMPLETED"
            }
            
            # Return a dictionary with the transaction data
            response = {
                "success": True,
                "message": "Rental created successfully",
                "data": rental_data,
                "transaction_id": transaction_id_str,
                "transaction_number": transaction_number,
            }
            
            return response
            
        except Exception as e:
            # Log the error and re-raise
            import traceback
            tb = traceback.format_exc()
            error_message = f"Rental creation failed: {str(e)}"
            print(f"RENTAL CREATION ERROR: {error_message}\nTraceback: {tb}")
            
            # Raise the exception to be handled by the route
            raise ValueError(error_message)

    async def get_all_rentals(
        self, 
        session: AsyncSession, 
        skip: int = 0, 
        limit: int = 100,
        search: str = None,
        customer_id: str = None,
        location_id: str = None,
        status: str = None,
        rental_status: str = None,
        payment_status: str = None,
        start_date = None,
        end_date = None,
        rental_start_date = None,
        rental_end_date = None,
        item_id: str = None,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> dict:
        """Get all rental transactions with pagination, search, and sorting."""
        rentals = await self.repo.get_all_rentals(
            session=session,
            skip=skip,
            limit=limit,
            search=search,
            customer_id=customer_id,
            location_id=location_id,
            status=status,
            rental_status=rental_status,
            payment_status=payment_status,
            start_date=start_date,
            end_date=end_date,
            rental_start_date=rental_start_date,
            rental_end_date=rental_end_date,
            item_id=item_id,
            sort_by=sort_by,
            sort_order=sort_order
        )
        
        # Build filters_applied object for response
        filters_applied = {}
        if search:
            filters_applied["search"] = search
        if customer_id:
            filters_applied["customer_id"] = customer_id
        if location_id:
            filters_applied["location_id"] = location_id
        if status:
            filters_applied["status"] = status
        if rental_status:
            filters_applied["rental_status"] = rental_status
        if payment_status:
            filters_applied["payment_status"] = payment_status
        if start_date:
            filters_applied["start_date"] = start_date.isoformat() if hasattr(start_date, 'isoformat') else str(start_date)
        if end_date:
            filters_applied["end_date"] = end_date.isoformat() if hasattr(end_date, 'isoformat') else str(end_date)
        if rental_start_date:
            filters_applied["rental_start_date"] = rental_start_date.isoformat() if hasattr(rental_start_date, 'isoformat') else str(rental_start_date)
        if rental_end_date:
            filters_applied["rental_end_date"] = rental_end_date.isoformat() if hasattr(rental_end_date, 'isoformat') else str(rental_end_date)
        if item_id:
            filters_applied["item_id"] = item_id
        if sort_by != "created_at":
            filters_applied["sort_by"] = sort_by
        if sort_order != "desc":
            filters_applied["sort_order"] = sort_order
        
        return {
            "success": True,
            "message": "Rentals retrieved successfully",
            "data": rentals,
            "total": len(rentals),
            "pagination": {
                "skip": skip,
                "limit": limit,
                "total": len(rentals)
            },
            "filters_applied": filters_applied,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    async def get_rental_by_id(self, session: AsyncSession, rental_id: str) -> dict:
        """
        Get comprehensive rental data including original transaction, return history, and returnable items.
        This unified method returns all data needed for rental detail views.
        """
        from datetime import datetime
        
        # Get the original rental transaction
        rental = await self.repo.get_rental_by_id(session, rental_id)
        if not rental:
            return None
            
        # Query for all return transactions that reference this rental
        return_query = select(TransactionHeader).where(
            TransactionHeader.reference_transaction_id == rental_id,
            TransactionHeader.transaction_type == TransactionType.RETURN
        ).order_by(TransactionHeader.created_at)
        
        result = await session.execute(return_query)
        return_transactions = result.scalars().unique().all()
        
        # Convert return transactions to dictionaries (renamed to return_history)
        return_history = []
        for return_tx in return_transactions:
            return_data = {
                "id": str(return_tx.id),
                "transaction_number": return_tx.transaction_number,
                "transaction_type": return_tx.transaction_type.value,
                "transaction_date": return_tx.transaction_date.isoformat() if return_tx.transaction_date else None,
                "reference_transaction_id": str(return_tx.reference_transaction_id) if return_tx.reference_transaction_id else None,
                "status": return_tx.status.value if return_tx.status else None,
                "total_amount": float(return_tx.total_amount) if return_tx.total_amount else 0.0,
                "notes": return_tx.notes,
                "created_at": return_tx.created_at.isoformat() if return_tx.created_at else None,
                "updated_at": return_tx.updated_at.isoformat() if return_tx.updated_at else None,
                "processed_by": return_tx.processed_by,
                "return_workflow_state": return_tx.return_workflow_state,
                "items": []
            }
            
            # Get transaction line items with separate query
            lines_query = select(TransactionLine).where(
                TransactionLine.transaction_header_id == return_tx.id
            ).order_by(TransactionLine.line_number)
            
            lines_result = await session.execute(lines_query)
            transaction_lines = lines_result.scalars().all()
            
            for line in transaction_lines:
                # Get item details if needed
                item_name = "Unknown Item"
                item_sku = "N/A"
                
                if line.item_id:
                    from app.modules.master_data.item_master.models import Item
                    item_query = select(Item.item_name, Item.sku).where(Item.id == line.item_id)
                    item_result = await session.execute(item_query)
                    item_row = item_result.first()
                    if item_row:
                        item_name = item_row.item_name
                        item_sku = item_row.sku
                
                line_data = {
                    "id": str(line.id),
                    "line_number": line.line_number,
                    "item_id": str(line.item_id) if line.item_id else None,
                    "item_name": item_name,
                    "sku": item_sku,
                    "quantity": float(line.quantity) if line.quantity else 0.0,
                    "unit_price": float(line.unit_price) if line.unit_price else 0.0,
                    "line_total": float(line.line_total) if line.line_total else 0.0,
                    "notes": getattr(line, 'notes', None),
                    "current_rental_status": line.current_rental_status.value if line.current_rental_status else None
                }
                return_data["items"].append(line_data)
                
            return_history.append(return_data)
        
        # Build returnable items list
        current_date = datetime.now().date()
        returnable_items = []
        
        for item in rental.get("items", []):
            if item.get("current_rental_status") in ["RENTAL_INPROGRESS", "RENTAL_LATE", "RENTAL_EXTENDED"]:
                # Calculate overdue status
                item_end_date = None
                if item.get("rental_end_date"):
                    try:
                        item_end_date = datetime.fromisoformat(item["rental_end_date"]).date()
                    except:
                        pass
                
                item_is_overdue = item_end_date and current_date > item_end_date
                item_days_overdue = (current_date - item_end_date).days if item_is_overdue else 0
                
                returnable_item = {
                    **item,
                    "return_options": {
                        "can_partial_return": item.get("quantity", 1) > 1,
                        "max_returnable_quantity": item.get("quantity", 1),
                        "is_overdue": item_is_overdue,
                        "days_overdue": item_days_overdue,
                        "estimated_late_fee": item_days_overdue * 5.0 if item_is_overdue else 0.0
                    }
                }
                returnable_items.append(returnable_item)
        
        # Calculate return summary
        total_items = len(rental.get("items", []))
        total_returnable = len(returnable_items)
        total_returned = total_items - total_returnable
        
        return_summary = {
            "total_items": total_items,
            "returned_items": total_returned,
            "returnable_items": total_returnable,
            "return_completion_percentage": round((total_returned / total_items * 100) if total_items > 0 else 0, 2),
            "has_returns": len(return_history) > 0,
            "last_return_date": return_history[0]["transaction_date"] if return_history else None
        }
        
        # Add the comprehensive data to the rental object
        rental["return_history"] = return_history
        rental["returnable_items"] = returnable_items
        rental["return_summary"] = return_summary
        
        return {
            "success": True,
            "message": "Rental retrieved successfully",
            "data": rental
        }

    async def get_rental_with_returns(self, session: AsyncSession, rental_id: str) -> dict:
        """Get a rental transaction with all its associated return transactions."""
        
        # Get the original rental transaction 
        rental = await self.repo.get_rental_by_id(session, rental_id)
        if not rental:
            return None
            
        # Query for all return transactions that reference this rental
        # Note: Don't use joinedload for now to avoid relationship issues
        return_query = select(TransactionHeader).where(
            TransactionHeader.reference_transaction_id == rental_id,
            TransactionHeader.transaction_type == TransactionType.RETURN
        ).order_by(TransactionHeader.created_at)
        
        result = await session.execute(return_query)
        return_transactions = result.scalars().unique().all()
        
        # Convert return transactions to dictionaries
        returns_data = []
        for return_tx in return_transactions:
            return_data = {
                "id": str(return_tx.id),
                "transaction_number": return_tx.transaction_number,
                "transaction_type": return_tx.transaction_type.value,
                "transaction_date": return_tx.transaction_date.isoformat() if return_tx.transaction_date else None,
                "reference_transaction_id": str(return_tx.reference_transaction_id) if return_tx.reference_transaction_id else None,
                "status": return_tx.status.value if return_tx.status else None,
                "total_amount": float(return_tx.total_amount) if return_tx.total_amount else 0.0,
                "notes": return_tx.notes,
                "created_at": return_tx.created_at.isoformat() if return_tx.created_at else None,
                "updated_at": return_tx.updated_at.isoformat() if return_tx.updated_at else None,
                "processed_by": return_tx.processed_by,
                "return_workflow_state": return_tx.return_workflow_state,
                "items": []
            }
            
            # Get transaction line items with separate query
            lines_query = select(TransactionLine).where(
                TransactionLine.transaction_header_id == return_tx.id
            ).order_by(TransactionLine.line_number)
            
            lines_result = await session.execute(lines_query)
            transaction_lines = lines_result.scalars().all()
            
            for line in transaction_lines:
                # Get item details if needed
                item_name = "Unknown Item"
                item_sku = "N/A"
                
                if line.item_id:
                    from app.modules.master_data.item_master.models import Item
                    item_query = select(Item.item_name, Item.sku).where(Item.id == line.item_id)
                    item_result = await session.execute(item_query)
                    item_row = item_result.first()
                    if item_row:
                        item_name = item_row.item_name
                        item_sku = item_row.sku
                
                line_data = {
                    "id": str(line.id),
                    "line_number": line.line_number,
                    "item_id": str(line.item_id) if line.item_id else None,
                    "item_name": item_name,
                    "sku": item_sku,
                    "quantity": float(line.quantity) if line.quantity else 0.0,
                    "unit_price": float(line.unit_price) if line.unit_price else 0.0,
                    "line_total": float(line.line_total) if line.line_total else 0.0,
                    "notes": getattr(line, 'notes', None),
                    "current_rental_status": line.current_rental_status.value if line.current_rental_status else None
                }
                return_data["items"].append(line_data)
                
            returns_data.append(return_data)
        
        return {
            "success": True,
            "message": "Rental with returns retrieved successfully",
            "data": {
                "original_rental": rental,
                "return_transactions": returns_data,
                "total_returns": len(returns_data)
            }
        }

    async def get_active_rentals(
        self, 
        session: AsyncSession, 
        skip: int = 0, 
        limit: int = 100,
        status_filter: str = None,
        location_id: str = None,
        customer_id: str = None,
        show_overdue_only: bool = False
    ) -> dict:
        """Get all active rental transactions with summary statistics."""
        rentals = await self.repo.get_active_rentals(
            session, 
            skip, 
            limit,
            location_id=location_id,
            customer_id=customer_id
        )
        
        # Debug logging to understand the data
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Active rentals count: {len(rentals)}")
        for rental in rentals:
            logger.info(f"Rental {rental.get('transaction_number')}: is_overdue={rental.get('is_overdue')}, days_overdue={rental.get('days_overdue')}, rental_end_date={rental.get('rental_end_date')}")
        
        # Apply additional filtering based on status_filter or show_overdue_only
        if show_overdue_only:
            rentals = [rental for rental in rentals if rental.get("is_overdue", False)]
        elif status_filter:
            # Filter based on aggregated status groups
            if status_filter == "in_progress":
                rentals = [rental for rental in rentals if rental.get("rental_status") == "RENTAL_INPROGRESS"]
            elif status_filter == "overdue":
                rentals = [rental for rental in rentals if rental.get("rental_status") in ["RENTAL_LATE", "RENTAL_LATE_PARTIAL_RETURN"]]
            elif status_filter == "extended":
                rentals = [rental for rental in rentals if rental.get("rental_status") == "RENTAL_EXTENDED"]
            elif status_filter == "partial_return":
                rentals = [rental for rental in rentals if rental.get("rental_status") in ["RENTAL_PARTIAL_RETURN", "RENTAL_LATE_PARTIAL_RETURN"]]
        
        # Calculate summary statistics based on filtered rentals
        total_rentals = len(rentals)
        total_value = sum(rental["total_amount"] for rental in rentals)
        overdue_count = sum(1 for rental in rentals if rental.get("is_overdue", False))
        
        # Group by location
        locations = {}
        for rental in rentals:
            loc_id = rental["location_id"]
            if loc_id not in locations:
                locations[loc_id] = {
                    "location_id": loc_id,
                    "location_name": rental["location_name"],
                    "rental_count": 0,
                    "total_value": 0.0
                }
            locations[loc_id]["rental_count"] += 1
            locations[loc_id]["total_value"] += rental["total_amount"]
        
        # Group by status (keep original for backward compatibility)
        status_breakdown = {}
        for rental in rentals:
            status = rental["rental_status"]
            if status:
                status_breakdown[status] = status_breakdown.get(status, 0) + 1
        
        # Calculate aggregated statistics for frontend cards
        # Count in_progress rentals that are NOT overdue
        in_progress_count = sum(
            1 for rental in rentals 
            if rental.get("rental_status") == "RENTAL_INPROGRESS" and not rental.get("is_overdue", False)
        )
        
        aggregated_stats = {
            "in_progress": in_progress_count,  # Only count non-overdue RENTAL_INPROGRESS
            "overdue": overdue_count,  # Use the is_overdue flag count instead of status
            "extended": status_breakdown.get("RENTAL_EXTENDED", 0),
            "partial_return": (
                status_breakdown.get("RENTAL_PARTIAL_RETURN", 0) + 
                status_breakdown.get("RENTAL_LATE_PARTIAL_RETURN", 0)
            )
        }
        
        # Calculate additional rental metrics
        rental_metrics = {
            "total_active_rentals": total_rentals,
            "total_active_value": total_value,
            "overdue_rentals_count": overdue_count,
            "overdue_rentals_value": sum(
                rental["total_amount"] for rental in rentals 
                if rental.get("is_overdue", False)
            ),
            "average_days_overdue": (
                sum(rental.get("days_overdue", 0) for rental in rentals if rental.get("is_overdue", False)) / 
                max(overdue_count, 1)
            ) if overdue_count > 0 else 0,
            "items_at_risk": sum(
                rental.get("items_count", 0) for rental in rentals 
                if rental.get("is_overdue", False)
            )
        }
        
        return {
            "success": True,
            "message": "Active rentals retrieved successfully",
            "data": rentals,
            "summary": {
                "total_rentals": total_rentals,
                "total_value": total_value,
                "overdue_count": overdue_count,
                "locations": list(locations.values()),
                "status_breakdown": status_breakdown,
                "aggregated_stats": aggregated_stats,
                "rental_metrics": rental_metrics
            },
            "pagination": {
                "skip": skip,
                "limit": limit,
                "total": total_rentals
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    async def get_rentable_items(
        self, 
        session: AsyncSession, 
        location_id: str = None,
        search_name: str = None,
        category_id: str = None
    ) -> list[dict]:
        """
        Get all rentable items with their stock information.
        
        Args:
            session: Database session
            location_id: Optional location filter
            search_name: Optional search term to filter items by name
            category_id: Optional category ID to filter items by category
            
        Returns:
            List of dictionaries with rentable items and stock info
        """
        return await self.repo.get_rentable_items_with_stock(
            session, location_id, search_name, category_id
        )

    async def get_due_today_rentals(
        self,
        session: AsyncSession,
        location_id: str = None,
        search: str = None,
        status: str = None,
    ) -> dict:
        """
        Get all rental transactions that are due today with summary statistics.
        
        Args:
            session: Database session
            location_id: Optional location filter
            search: Optional search term for customer name or transaction number
            status: Optional status filter
            
        Returns:
            Dictionary with due today rentals data and summary statistics
        """
        from datetime import datetime, timezone
        from decimal import Decimal
        from collections import defaultdict
        
        # Get due today rentals from repository
        rentals_data = await self.repo.get_due_today_rentals(
            session, location_id, search, status
        )
        
        # Calculate summary statistics
        total_rentals = len(rentals_data)
        total_value = Decimal("0.00")
        overdue_count = 0
        location_stats = defaultdict(lambda: {"rental_count": 0, "total_value": Decimal("0.00")})
        status_breakdown = defaultdict(int)
        
        for rental in rentals_data:
            # Add to total value
            total_value += Decimal(str(rental["total_amount"]))
            
            # Count overdue rentals
            if rental["is_overdue"]:
                overdue_count += 1
            
            # Location statistics
            loc_id = rental["location_id"]
            loc_name = rental["location_name"]
            location_stats[loc_id]["location_id"] = loc_id
            location_stats[loc_id]["location_name"] = loc_name
            location_stats[loc_id]["rental_count"] += 1
            location_stats[loc_id]["total_value"] += Decimal(str(rental["total_amount"]))
            
            # Status breakdown
            status_breakdown[rental["status"]] += 1
        
        # Convert location stats to list
        locations_summary = [
            {
                "location_id": stats["location_id"],
                "location_name": stats["location_name"],
                "rental_count": stats["rental_count"],
                "total_value": float(stats["total_value"]),
            }
            for stats in location_stats.values()
        ]
        
        # Build summary
        summary = {
            "total_rentals": total_rentals,
            "total_value": float(total_value),
            "overdue_count": overdue_count,
            "locations": locations_summary,
            "status_breakdown": dict(status_breakdown),
        }
        
        # Build filters applied
        filters_applied = {}
        if location_id:
            filters_applied["location_id"] = location_id
        if search:
            filters_applied["search"] = search
        if status:
            filters_applied["status"] = status
        
        return {
            "success": True,
            "message": "Due today rentals retrieved successfully",
            "data": rentals_data,
            "summary": summary,
            "filters_applied": filters_applied,
            "timestamp": datetime.now(timezone.utc),
        }