"""
Test suite for transaction module performance and boundary conditions.

This module provides comprehensive performance and boundary testing for:
- High-volume transaction processing
- Large dataset operations  
- Memory usage under stress
- Database query optimization
- Concurrent transaction handling
- Resource limitations
- Timeout scenarios
- Scalability limits
"""

import asyncio
import time
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List
import pytest
from unittest.mock import AsyncMock, Mock, patch
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction.transaction_header import TransactionHeader, TransactionType, TransactionStatus
from app.models.transaction.transaction_line import TransactionLine
from app.crud.transaction.transaction_header_crud import transaction_header_crud
from app.crud.transaction.transaction_line_crud import transaction_line_crud
from app.services.transaction.rental_service import RentalService
from app.services.transaction.sales_service import SalesService
from app.services.transaction.purchase_service import PurchaseService
from app.schemas.transaction.transaction_header import TransactionHeaderCreate
from app.schemas.transaction.transaction_line import TransactionLineCreate


class TestTransactionPerformance:
    """Test transaction performance under various load conditions."""

    @pytest.mark.asyncio
    @pytest.mark.performance
    async def test_bulk_transaction_creation_performance(self, db_session: AsyncSession):
        """Test performance of creating large numbers of transactions."""
        transaction_count = 1000
        batch_size = 50
        
        start_time = time.time()
        
        # Create transactions in batches for better performance
        for batch_start in range(0, transaction_count, batch_size):
            batch_transactions = []
            
            for i in range(batch_start, min(batch_start + batch_size, transaction_count)):
                transaction_data = {
                    "transaction_type": TransactionType.SALE,
                    "customer_id": 1,
                    "company_id": 1,
                    "total_amount": Decimal("100.00"),
                    "status": TransactionStatus.COMPLETED,
                    "transaction_date": datetime.utcnow(),
                    "reference_number": f"BULK-{i:06d}"
                }
                
                transaction = TransactionHeader(**transaction_data)
                batch_transactions.append(transaction)
            
            db_session.add_all(batch_transactions)
            await db_session.commit()
        
        end_time = time.time()
        execution_time = end_time - start_time
        
        # Verify all transactions were created
        result = await db_session.execute(
            text("SELECT COUNT(*) FROM transaction_headers WHERE reference_number LIKE 'BULK-%'")
        )
        count = result.scalar()
        
        assert count == transaction_count
        assert execution_time < 30.0  # Should complete within 30 seconds
        
        # Performance metrics
        transactions_per_second = transaction_count / execution_time
        assert transactions_per_second > 30  # Minimum 30 transactions/second

    @pytest.mark.asyncio
    @pytest.mark.performance
    async def test_bulk_transaction_line_creation_performance(self, db_session: AsyncSession):
        """Test performance of creating transaction lines in bulk."""
        # Create a single transaction header first
        header_data = {
            "transaction_type": TransactionType.SALE,
            "customer_id": 1,
            "company_id": 1,
            "total_amount": Decimal("0.00"),
            "status": TransactionStatus.PENDING,
            "transaction_date": datetime.utcnow(),
            "reference_number": "BULK-LINES-001"
        }
        
        header = TransactionHeader(**header_data)
        db_session.add(header)
        await db_session.commit()
        await db_session.refresh(header)
        
        line_count = 5000
        batch_size = 100
        
        start_time = time.time()
        
        # Create transaction lines in batches
        for batch_start in range(0, line_count, batch_size):
            batch_lines = []
            
            for i in range(batch_start, min(batch_start + batch_size, line_count)):
                line_data = {
                    "transaction_header_id": header.id,
                    "item_id": (i % 100) + 1,  # Cycle through item IDs
                    "quantity": Decimal("1.00"),
                    "unit_price": Decimal("10.00"),
                    "line_total": Decimal("10.00"),
                    "line_number": i + 1
                }
                
                line = TransactionLine(**line_data)
                batch_lines.append(line)
            
            db_session.add_all(batch_lines)
            await db_session.commit()
        
        end_time = time.time()
        execution_time = end_time - start_time
        
        # Verify all lines were created
        result = await db_session.execute(
            text("SELECT COUNT(*) FROM transaction_lines WHERE transaction_header_id = :header_id"),
            {"header_id": header.id}
        )
        count = result.scalar()
        
        assert count == line_count
        assert execution_time < 60.0  # Should complete within 60 seconds
        
        lines_per_second = line_count / execution_time
        assert lines_per_second > 80  # Minimum 80 lines/second

    @pytest.mark.asyncio
    @pytest.mark.performance
    async def test_concurrent_transaction_processing_performance(self, db_session: AsyncSession):
        """Test performance under concurrent transaction processing."""
        concurrent_transactions = 50
        
        async def create_transaction(session: AsyncSession, transaction_id: int):
            """Create a single transaction."""
            transaction_data = {
                "transaction_type": TransactionType.SALE,
                "customer_id": 1,
                "company_id": 1,
                "total_amount": Decimal("50.00"),
                "status": TransactionStatus.COMPLETED,
                "transaction_date": datetime.utcnow(),
                "reference_number": f"CONCURRENT-{transaction_id:03d}"
            }
            
            transaction = TransactionHeader(**transaction_data)
            session.add(transaction)
            await session.commit()
            return transaction
        
        start_time = time.time()
        
        # Create concurrent tasks
        tasks = []
        for i in range(concurrent_transactions):
            # Each task needs its own session for true concurrency
            task = create_transaction(db_session, i)
            tasks.append(task)
        
        # Execute all tasks concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        end_time = time.time()
        execution_time = end_time - start_time
        
        # Count successful transactions (not exceptions)
        successful_count = sum(1 for result in results if not isinstance(result, Exception))
        
        assert successful_count >= concurrent_transactions * 0.9  # 90% success rate minimum
        assert execution_time < 20.0  # Should complete within 20 seconds

    @pytest.mark.asyncio
    @pytest.mark.performance
    async def test_large_transaction_query_performance(self, db_session: AsyncSession):
        """Test query performance with large transaction datasets."""
        # Create test data
        transaction_count = 2000
        
        # Batch insert for faster setup
        transactions = []
        for i in range(transaction_count):
            transaction_data = {
                "transaction_type": TransactionType.SALE if i % 2 == 0 else TransactionType.PURCHASE,
                "customer_id": (i % 20) + 1,
                "company_id": 1,
                "total_amount": Decimal(str(10.00 + (i % 100))),
                "status": TransactionStatus.COMPLETED,
                "transaction_date": datetime.utcnow() - timedelta(days=i % 365),
                "reference_number": f"QUERY-TEST-{i:06d}"
            }
            transactions.append(TransactionHeader(**transaction_data))
        
        db_session.add_all(transactions)
        await db_session.commit()
        
        # Test various query patterns
        start_time = time.time()
        
        # 1. Simple filter query
        result = await transaction_header_crud.get_by_type(
            db_session, transaction_type=TransactionType.SALE
        )
        query1_time = time.time()
        
        # 2. Date range query
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)
        
        date_filtered = await transaction_header_crud.get_by_date_range(
            db_session, start_date=start_date, end_date=end_date
        )
        query2_time = time.time()
        
        # 3. Complex aggregation query
        result = await db_session.execute(
            text("""
                SELECT 
                    transaction_type,
                    COUNT(*) as transaction_count,
                    SUM(total_amount) as total_amount,
                    AVG(total_amount) as avg_amount
                FROM transaction_headers 
                WHERE reference_number LIKE 'QUERY-TEST-%'
                GROUP BY transaction_type
            """)
        )
        aggregation_result = result.fetchall()
        query3_time = time.time()
        
        # Performance assertions
        simple_query_time = query1_time - start_time
        date_query_time = query2_time - query1_time
        aggregation_time = query3_time - query2_time
        
        assert simple_query_time < 2.0  # Simple queries should be fast
        assert date_query_time < 3.0    # Date range queries
        assert aggregation_time < 5.0   # Complex aggregations
        
        # Verify results
        assert len(aggregation_result) == 2  # SALE and PURCHASE types
        assert all(row[1] > 0 for row in aggregation_result)  # All counts > 0

    @pytest.mark.asyncio
    @pytest.mark.performance
    async def test_memory_usage_large_transactions(self, db_session: AsyncSession):
        """Test memory usage when processing large transactions."""
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss
        
        # Create a transaction with many lines
        header_data = {
            "transaction_type": TransactionType.SALE,
            "customer_id": 1,
            "company_id": 1,
            "total_amount": Decimal("0.00"),
            "status": TransactionStatus.PENDING,
            "transaction_date": datetime.utcnow(),
            "reference_number": "MEMORY-TEST-001"
        }
        
        header = TransactionHeader(**header_data)
        db_session.add(header)
        await db_session.commit()
        await db_session.refresh(header)
        
        # Process large number of lines in chunks to manage memory
        total_lines = 10000
        chunk_size = 500
        
        for chunk_start in range(0, total_lines, chunk_size):
            chunk_lines = []
            
            for i in range(chunk_start, min(chunk_start + chunk_size, total_lines)):
                line_data = {
                    "transaction_header_id": header.id,
                    "item_id": (i % 100) + 1,
                    "quantity": Decimal("1.00"),
                    "unit_price": Decimal("5.00"),
                    "line_total": Decimal("5.00"),
                    "line_number": i + 1
                }
                chunk_lines.append(TransactionLine(**line_data))
            
            db_session.add_all(chunk_lines)
            await db_session.commit()
            
            # Clear chunk from memory
            chunk_lines.clear()
        
        final_memory = process.memory_info().rss
        memory_increase = final_memory - initial_memory
        
        # Memory increase should be reasonable (less than 100MB)
        assert memory_increase < 100 * 1024 * 1024  # 100MB limit
        
        # Verify all lines were created
        result = await db_session.execute(
            text("SELECT COUNT(*) FROM transaction_lines WHERE transaction_header_id = :header_id"),
            {"header_id": header.id}
        )
        count = result.scalar()
        assert count == total_lines

    @pytest.mark.asyncio
    @pytest.mark.performance
    async def test_service_layer_performance_under_load(self):
        """Test service layer performance under simulated load."""
        mock_db = AsyncMock()
        mock_crud = AsyncMock()
        
        sales_service = SalesService()
        
        # Mock successful responses
        mock_header = Mock()
        mock_header.id = 1
        mock_header.status = TransactionStatus.COMPLETED
        mock_header.total_amount = Decimal("100.00")
        
        mock_crud.create.return_value = mock_header
        mock_crud.get.return_value = mock_header
        mock_crud.update.return_value = mock_header
        
        # Simulate high load
        operation_count = 1000
        start_time = time.time()
        
        with patch.object(sales_service, 'transaction_crud', mock_crud):
            tasks = []
            for i in range(operation_count):
                # Mix of different operations
                if i % 3 == 0:
                    task = sales_service.create_sales_transaction(
                        mock_db, 
                        transaction_data={
                            "customer_id": 1,
                            "total_amount": Decimal("50.00"),
                            "lines": []
                        },
                        current_user_id=1
                    )
                elif i % 3 == 1:
                    task = sales_service.get_sales_transaction(mock_db, transaction_id=1)
                else:
                    task = sales_service.update_transaction_status(
                        mock_db, 
                        transaction_id=1, 
                        status=TransactionStatus.COMPLETED
                    )
                
                tasks.append(task)
            
            # Execute all operations
            results = await asyncio.gather(*tasks, return_exceptions=True)
        
        end_time = time.time()
        execution_time = end_time - start_time
        
        # Performance metrics
        operations_per_second = operation_count / execution_time
        successful_operations = sum(1 for r in results if not isinstance(r, Exception))
        
        assert operations_per_second > 100  # Minimum 100 ops/second
        assert successful_operations >= operation_count * 0.95  # 95% success rate


class TestTransactionBoundaryConditions:
    """Test transaction boundary conditions and edge cases."""

    @pytest.mark.asyncio
    async def test_maximum_decimal_precision_handling(self, db_session: AsyncSession):
        """Test handling of maximum decimal precision in transactions."""
        # Test with maximum precision values
        max_precision_amount = Decimal("999999999999999.99")
        
        transaction_data = {
            "transaction_type": TransactionType.SALE,
            "customer_id": 1,
            "company_id": 1,
            "total_amount": max_precision_amount,
            "status": TransactionStatus.COMPLETED,
            "transaction_date": datetime.utcnow(),
            "reference_number": "MAX-PRECISION-001"
        }
        
        transaction = TransactionHeader(**transaction_data)
        db_session.add(transaction)
        await db_session.commit()
        await db_session.refresh(transaction)
        
        assert transaction.total_amount == max_precision_amount
        
        # Test line with high precision calculations
        line_data = {
            "transaction_header_id": transaction.id,
            "item_id": 1,
            "quantity": Decimal("999999.999"),
            "unit_price": Decimal("999999.99"),
            "tax_rate": Decimal("0.99999"),
            "discount_amount": Decimal("999999.99"),
            "line_number": 1
        }
        
        line = TransactionLine(**line_data)
        # Calculate total manually to verify precision
        expected_total = (line_data["quantity"] * line_data["unit_price"]) - line_data["discount_amount"]
        expected_total_with_tax = expected_total * (Decimal("1") + line_data["tax_rate"])
        
        line.line_total = expected_total_with_tax
        
        db_session.add(line)
        await db_session.commit()
        await db_session.refresh(line)
        
        # Verify precision is maintained
        assert line.quantity == line_data["quantity"]
        assert line.unit_price == line_data["unit_price"]
        assert line.line_total == expected_total_with_tax

    @pytest.mark.asyncio
    async def test_extreme_transaction_line_counts(self, db_session: AsyncSession):
        """Test transactions with extreme numbers of lines."""
        # Create transaction with maximum reasonable line count
        header_data = {
            "transaction_type": TransactionType.SALE,
            "customer_id": 1,
            "company_id": 1,
            "total_amount": Decimal("0.00"),
            "status": TransactionStatus.PENDING,
            "transaction_date": datetime.utcnow(),
            "reference_number": "EXTREME-LINES-001"
        }
        
        header = TransactionHeader(**header_data)
        db_session.add(header)
        await db_session.commit()
        await db_session.refresh(header)
        
        # Test with 50,000 lines (extreme but possible scenario)
        extreme_line_count = 50000
        batch_size = 1000
        
        start_time = time.time()
        
        for batch_start in range(0, extreme_line_count, batch_size):
            batch_lines = []
            
            for i in range(batch_start, min(batch_start + batch_size, extreme_line_count)):
                line_data = {
                    "transaction_header_id": header.id,
                    "item_id": (i % 1000) + 1,  # Cycle through item IDs
                    "quantity": Decimal("1.00"),
                    "unit_price": Decimal("1.00"),
                    "line_total": Decimal("1.00"),
                    "line_number": i + 1
                }
                batch_lines.append(TransactionLine(**line_data))
            
            db_session.add_all(batch_lines)
            await db_session.commit()
            
            # Progress check - should not take too long per batch
            elapsed = time.time() - start_time
            expected_batches = (batch_start // batch_size) + 1
            avg_time_per_batch = elapsed / expected_batches
            assert avg_time_per_batch < 5.0  # Max 5 seconds per batch
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # Verify all lines were created
        result = await db_session.execute(
            text("SELECT COUNT(*) FROM transaction_lines WHERE transaction_header_id = :header_id"),
            {"header_id": header.id}
        )
        count = result.scalar()
        
        assert count == extreme_line_count
        assert total_time < 300.0  # Should complete within 5 minutes

    @pytest.mark.asyncio
    async def test_date_boundary_conditions(self, db_session: AsyncSession):
        """Test transactions with boundary date conditions."""
        # Test with various edge case dates
        test_dates = [
            datetime(1900, 1, 1),  # Very old date
            datetime(2000, 2, 29), # Leap year date
            datetime(2100, 12, 31), # Future date
            datetime.utcnow() + timedelta(days=36500),  # 100 years in future
            datetime(1970, 1, 1),  # Unix epoch
        ]
        
        for i, test_date in enumerate(test_dates):
            transaction_data = {
                "transaction_type": TransactionType.SALE,
                "customer_id": 1,
                "company_id": 1,
                "total_amount": Decimal("100.00"),
                "status": TransactionStatus.COMPLETED,
                "transaction_date": test_date,
                "reference_number": f"DATE-BOUNDARY-{i:03d}"
            }
            
            transaction = TransactionHeader(**transaction_data)
            db_session.add(transaction)
            await db_session.commit()
            await db_session.refresh(transaction)
            
            # Verify date was stored correctly
            assert transaction.transaction_date == test_date

    @pytest.mark.asyncio
    async def test_transaction_timeout_scenarios(self, db_session: AsyncSession):
        """Test transaction behavior under timeout scenarios."""
        
        async def slow_operation():
            """Simulate a slow database operation."""
            await asyncio.sleep(2.0)  # 2-second delay
            return "completed"
        
        # Test timeout handling
        start_time = time.time()
        
        try:
            # Set a short timeout
            result = await asyncio.wait_for(slow_operation(), timeout=1.0)
            assert False, "Should have timed out"
        except asyncio.TimeoutError:
            # Expected timeout
            elapsed = time.time() - start_time
            assert 0.9 < elapsed < 1.5  # Should timeout around 1 second
        
        # Test successful operation within timeout
        start_time = time.time()
        result = await asyncio.wait_for(slow_operation(), timeout=3.0)
        elapsed = time.time() - start_time
        
        assert result == "completed"
        assert 1.8 < elapsed < 2.5  # Should complete around 2 seconds

    @pytest.mark.asyncio
    async def test_resource_exhaustion_scenarios(self, db_session: AsyncSession):
        """Test behavior under resource exhaustion scenarios."""
        
        # Test with limited connection pool
        connection_limit = 5
        concurrent_operations = 20
        
        async def db_operation(operation_id: int):
            """Simulate database operation that holds connection."""
            try:
                # Simulate work that holds DB connection
                await asyncio.sleep(0.1)
                
                transaction_data = {
                    "transaction_type": TransactionType.SALE,
                    "customer_id": 1,
                    "company_id": 1,
                    "total_amount": Decimal("10.00"),
                    "status": TransactionStatus.COMPLETED,
                    "transaction_date": datetime.utcnow(),
                    "reference_number": f"RESOURCE-{operation_id:03d}"
                }
                
                transaction = TransactionHeader(**transaction_data)
                db_session.add(transaction)
                await db_session.commit()
                
                return operation_id
            except Exception as e:
                return f"Error-{operation_id}: {str(e)}"
        
        # Execute operations that may exceed connection pool
        tasks = [db_operation(i) for i in range(concurrent_operations)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # At least some operations should succeed
        successful = [r for r in results if isinstance(r, int)]
        failed = [r for r in results if not isinstance(r, int)]
        
        assert len(successful) > 0, "At least some operations should succeed"
        
        # In a real scenario with connection limits, some might fail
        # but the system should handle this gracefully
        print(f"Successful operations: {len(successful)}")
        print(f"Failed operations: {len(failed)}")

    @pytest.mark.asyncio
    async def test_scalability_limits(self, db_session: AsyncSession):
        """Test system behavior at scalability limits."""
        
        # Test pagination performance with large datasets
        large_dataset_size = 100000
        page_size = 1000
        
        # Create large dataset (in production, this would be existing data)
        print(f"Creating {large_dataset_size} transactions for scalability test...")
        
        # Use efficient bulk insert
        batch_size = 5000
        for batch_start in range(0, large_dataset_size, batch_size):
            batch_transactions = []
            
            for i in range(batch_start, min(batch_start + batch_size, large_dataset_size)):
                transaction_data = {
                    "transaction_type": TransactionType.SALE if i % 2 == 0 else TransactionType.PURCHASE,
                    "customer_id": (i % 100) + 1,
                    "company_id": 1,
                    "total_amount": Decimal(str(10.00 + (i % 1000))),
                    "status": TransactionStatus.COMPLETED,
                    "transaction_date": datetime.utcnow() - timedelta(minutes=i % 525600),  # Spread over a year
                    "reference_number": f"SCALE-{i:08d}"
                }
                batch_transactions.append(TransactionHeader(**transaction_data))
            
            db_session.add_all(batch_transactions)
            await db_session.commit()
            
            print(f"Created batch {batch_start // batch_size + 1}/{(large_dataset_size - 1) // batch_size + 1}")
        
        print("Testing pagination performance...")
        
        # Test pagination performance across different pages
        pages_to_test = [1, 50, 100, 150]  # Test various page positions
        
        for page_num in pages_to_test:
            offset = (page_num - 1) * page_size
            
            start_time = time.time()
            
            result = await db_session.execute(
                text("""
                    SELECT * FROM transaction_headers 
                    WHERE reference_number LIKE 'SCALE-%'
                    ORDER BY created_at DESC
                    LIMIT :limit OFFSET :offset
                """),
                {"limit": page_size, "offset": offset}
            )
            
            transactions = result.fetchall()
            query_time = time.time() - start_time
            
            # Even deep pagination should be reasonably fast
            assert query_time < 2.0, f"Page {page_num} took {query_time:.2f}s (too slow)"
            assert len(transactions) == page_size, f"Page {page_num} returned {len(transactions)} records"
            
            print(f"Page {page_num}: {query_time:.3f}s for {len(transactions)} records")

    @pytest.mark.asyncio
    async def test_system_recovery_scenarios(self, db_session: AsyncSession):
        """Test system recovery from various failure scenarios."""
        
        # Test partial transaction recovery
        header_data = {
            "transaction_type": TransactionType.SALE,
            "customer_id": 1,
            "company_id": 1,
            "total_amount": Decimal("0.00"),
            "status": TransactionStatus.PENDING,
            "transaction_date": datetime.utcnow(),
            "reference_number": "RECOVERY-TEST-001"
        }
        
        header = TransactionHeader(**header_data)
        db_session.add(header)
        await db_session.commit()
        await db_session.refresh(header)
        
        # Simulate partial line creation (some succeed, some fail)
        lines_to_create = 100
        successful_lines = []
        failed_lines = []
        
        for i in range(lines_to_create):
            try:
                line_data = {
                    "transaction_header_id": header.id,
                    "item_id": i + 1,
                    "quantity": Decimal("1.00"),
                    "unit_price": Decimal("10.00"),
                    "line_total": Decimal("10.00"),
                    "line_number": i + 1
                }
                
                # Simulate occasional failures (e.g., constraint violations)
                if i % 20 == 19:  # Fail every 20th line
                    raise Exception(f"Simulated failure for line {i}")
                
                line = TransactionLine(**line_data)
                db_session.add(line)
                await db_session.flush()  # Flush to detect issues early
                
                successful_lines.append(i)
                
            except Exception as e:
                failed_lines.append(i)
                await db_session.rollback()
                continue
        
        await db_session.commit()
        
        # Verify recovery state
        result = await db_session.execute(
            text("SELECT COUNT(*) FROM transaction_lines WHERE transaction_header_id = :header_id"),
            {"header_id": header.id}
        )
        created_count = result.scalar()
        
        assert created_count == len(successful_lines)
        assert len(failed_lines) > 0  # Some failures should have occurred
        assert created_count + len(failed_lines) == lines_to_create
        
        print(f"Recovery test: {created_count} successful, {len(failed_lines)} failed lines")