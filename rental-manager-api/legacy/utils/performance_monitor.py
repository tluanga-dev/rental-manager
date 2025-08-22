#!/usr/bin/env python3
"""
PERFORMANCE MONITORING UTILITY

This utility monitors database and application performance during testing:
1. Database query execution times and counts
2. Memory usage tracking
3. Connection pool statistics
4. Transaction throughput metrics
5. Error rate monitoring
6. Response time distribution analysis

Usage:
    python utils/performance_monitor.py --test-type purchase --duration 300
"""

import asyncio
import sys
import os
import time
import json
import statistics
import psutil
import argparse
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from contextlib import asynccontextmanager

# Add the backend root directory to Python path
backend_root = Path(__file__).parent.parent
sys.path.insert(0, str(backend_root))

from sqlalchemy import text, event
from sqlalchemy.engine import Engine
from app.core.database import AsyncSessionLocal
from app.core.config import get_settings


@dataclass
class QueryMetric:
    """Represents a single query execution metric."""
    query_text: str
    execution_time: float
    timestamp: datetime
    result_count: int
    error: Optional[str] = None


@dataclass 
class SystemMetric:
    """Represents system-level performance metrics."""
    timestamp: datetime
    cpu_usage: float
    memory_usage: float
    memory_percent: float
    disk_io_read: int
    disk_io_write: int
    network_io_sent: int
    network_io_recv: int
    db_connections_active: int
    db_connections_total: int


@dataclass
class TransactionMetric:
    """Represents transaction-level performance metrics."""
    transaction_type: str
    start_time: datetime
    end_time: datetime
    duration: float
    success: bool
    error_message: Optional[str] = None
    items_count: int = 0
    total_amount: float = 0.0


class PerformanceMonitor:
    """Comprehensive performance monitoring system."""
    
    def __init__(self, output_dir: str = "performance_logs"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        self.query_metrics: List[QueryMetric] = []
        self.system_metrics: List[SystemMetric] = []
        self.transaction_metrics: List[TransactionMetric] = []
        
        self.monitoring = False
        self.start_time = None
        self.process = psutil.Process()
        
        # Setup query monitoring
        self._setup_query_monitoring()
    
    def _setup_query_monitoring(self):
        """Setup SQLAlchemy query event monitoring."""
        
        @event.listens_for(Engine, "before_cursor_execute")
        def receive_before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            context._query_start_time = time.time()
        
        @event.listens_for(Engine, "after_cursor_execute")
        def receive_after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            if hasattr(context, '_query_start_time'):
                execution_time = time.time() - context._query_start_time
                
                # Clean up query text for logging
                clean_query = ' '.join(statement.split())[:200]
                if len(statement) > 200:
                    clean_query += "..."
                
                metric = QueryMetric(
                    query_text=clean_query,
                    execution_time=execution_time,
                    timestamp=datetime.now(timezone.utc),
                    result_count=cursor.rowcount if cursor.rowcount > 0 else 0
                )
                
                if self.monitoring:
                    self.query_metrics.append(metric)
    
    async def start_monitoring(self, interval: float = 1.0):
        """Start performance monitoring with specified interval."""
        self.monitoring = True
        self.start_time = datetime.now(timezone.utc)
        
        print(f"🔍 Performance monitoring started at {self.start_time}")
        print(f"📊 Collecting metrics every {interval} seconds")
        
        try:
            while self.monitoring:
                await self._collect_system_metrics()
                await asyncio.sleep(interval)
        except asyncio.CancelledError:
            print("📊 Performance monitoring stopped")
            raise
    
    def stop_monitoring(self):
        """Stop performance monitoring."""
        self.monitoring = False
        end_time = datetime.now(timezone.utc)
        duration = (end_time - self.start_time).total_seconds() if self.start_time else 0
        
        print(f"⏹️ Performance monitoring stopped after {duration:.1f} seconds")
        print(f"📈 Collected {len(self.query_metrics)} query metrics")
        print(f"📊 Collected {len(self.system_metrics)} system metrics")
        print(f"💼 Collected {len(self.transaction_metrics)} transaction metrics")
    
    async def _collect_system_metrics(self):
        """Collect system-level performance metrics."""
        try:
            # CPU and Memory
            cpu_usage = self.process.cpu_percent()
            memory_info = self.process.memory_info()
            memory_percent = self.process.memory_percent()
            
            # Disk I/O
            disk_io = self.process.io_counters()
            
            # Network I/O (system-wide)
            net_io = psutil.net_io_counters()
            
            # Database connection info (approximate)
            db_connections = await self._get_db_connection_count()
            
            metric = SystemMetric(
                timestamp=datetime.now(timezone.utc),
                cpu_usage=cpu_usage,
                memory_usage=memory_info.rss / 1024 / 1024,  # MB
                memory_percent=memory_percent,
                disk_io_read=disk_io.read_bytes,
                disk_io_write=disk_io.write_bytes,
                network_io_sent=net_io.bytes_sent,
                network_io_recv=net_io.bytes_recv,
                db_connections_active=db_connections.get('active', 0),
                db_connections_total=db_connections.get('total', 0)
            )
            
            self.system_metrics.append(metric)
            
        except Exception as e:
            print(f"⚠️ Error collecting system metrics: {e}")
    
    async def _get_db_connection_count(self) -> Dict[str, int]:
        """Get database connection statistics."""
        try:
            async with AsyncSessionLocal() as session:
                # Query PostgreSQL connection stats
                result = await session.execute(text("""
                    SELECT 
                        COUNT(*) as total_connections,
                        COUNT(*) FILTER (WHERE state = 'active') as active_connections
                    FROM pg_stat_activity 
                    WHERE datname = current_database()
                """))
                
                row = result.fetchone()
                return {
                    'total': row.total_connections if row else 0,
                    'active': row.active_connections if row else 0
                }
        except Exception:
            return {'total': 0, 'active': 0}
    
    def record_transaction(self, metric: TransactionMetric):
        """Record a transaction metric."""
        self.transaction_metrics.append(metric)
    
    def generate_report(self) -> Dict[str, Any]:
        """Generate comprehensive performance report."""
        if not self.start_time:
            return {"error": "Monitoring was not started"}
        
        end_time = datetime.now(timezone.utc)
        total_duration = (end_time - self.start_time).total_seconds()
        
        report = {
            "monitoring_period": {
                "start_time": self.start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "duration_seconds": total_duration
            },
            "query_performance": self._analyze_query_performance(),
            "system_performance": self._analyze_system_performance(),
            "transaction_performance": self._analyze_transaction_performance(),
            "summary": self._generate_summary()
        }
        
        return report
    
    def _analyze_query_performance(self) -> Dict[str, Any]:
        """Analyze database query performance."""
        if not self.query_metrics:
            return {"message": "No query metrics collected"}
        
        execution_times = [m.execution_time for m in self.query_metrics]
        query_types = {}
        
        # Categorize queries by type
        for metric in self.query_metrics:
            query_type = self._categorize_query(metric.query_text)
            if query_type not in query_types:
                query_types[query_type] = []
            query_types[query_type].append(metric.execution_time)
        
        # Calculate statistics
        stats = {
            "total_queries": len(self.query_metrics),
            "execution_time_stats": {
                "min": min(execution_times),
                "max": max(execution_times),
                "avg": statistics.mean(execution_times),
                "median": statistics.median(execution_times),
                "p95": sorted(execution_times)[int(len(execution_times) * 0.95)],
                "p99": sorted(execution_times)[int(len(execution_times) * 0.99)],
                "std_dev": statistics.stdev(execution_times) if len(execution_times) > 1 else 0
            },
            "query_types": {},
            "slowest_queries": []
        }
        
        # Analyze by query type
        for query_type, times in query_types.items():
            if times:
                stats["query_types"][query_type] = {
                    "count": len(times),
                    "avg_time": statistics.mean(times),
                    "max_time": max(times),
                    "total_time": sum(times)
                }
        
        # Find slowest queries
        sorted_queries = sorted(self.query_metrics, key=lambda m: m.execution_time, reverse=True)
        stats["slowest_queries"] = [
            {
                "query": metric.query_text,
                "execution_time": metric.execution_time,
                "timestamp": metric.timestamp.isoformat()
            }
            for metric in sorted_queries[:10]
        ]
        
        return stats
    
    def _categorize_query(self, query_text: str) -> str:
        """Categorize query by type."""
        query_lower = query_text.lower().strip()
        
        if query_lower.startswith('select'):
            return 'SELECT'
        elif query_lower.startswith('insert'):
            return 'INSERT'
        elif query_lower.startswith('update'):
            return 'UPDATE'
        elif query_lower.startswith('delete'):
            return 'DELETE'
        elif 'transaction' in query_lower:
            return 'TRANSACTION'
        else:
            return 'OTHER'
    
    def _analyze_system_performance(self) -> Dict[str, Any]:
        """Analyze system-level performance."""
        if not self.system_metrics:
            return {"message": "No system metrics collected"}
        
        cpu_usage = [m.cpu_usage for m in self.system_metrics]
        memory_usage = [m.memory_usage for m in self.system_metrics]
        memory_percent = [m.memory_percent for m in self.system_metrics]
        
        return {
            "cpu_usage": {
                "min": min(cpu_usage),
                "max": max(cpu_usage),
                "avg": statistics.mean(cpu_usage),
                "median": statistics.median(cpu_usage)
            },
            "memory_usage_mb": {
                "min": min(memory_usage),
                "max": max(memory_usage),
                "avg": statistics.mean(memory_usage),
                "median": statistics.median(memory_usage)
            },
            "memory_percent": {
                "min": min(memory_percent),
                "max": max(memory_percent),
                "avg": statistics.mean(memory_percent),
                "median": statistics.median(memory_percent)
            },
            "database_connections": {
                "max_active": max(m.db_connections_active for m in self.system_metrics),
                "max_total": max(m.db_connections_total for m in self.system_metrics),
                "avg_active": statistics.mean(m.db_connections_active for m in self.system_metrics),
                "avg_total": statistics.mean(m.db_connections_total for m in self.system_metrics)
            }
        }
    
    def _analyze_transaction_performance(self) -> Dict[str, Any]:
        """Analyze transaction-level performance."""
        if not self.transaction_metrics:
            return {"message": "No transaction metrics collected"}
        
        durations = [m.duration for m in self.transaction_metrics]
        success_rate = sum(1 for m in self.transaction_metrics if m.success) / len(self.transaction_metrics) * 100
        
        # Group by transaction type
        by_type = {}
        for metric in self.transaction_metrics:
            if metric.transaction_type not in by_type:
                by_type[metric.transaction_type] = []
            by_type[metric.transaction_type].append(metric)
        
        type_stats = {}
        for tx_type, metrics in by_type.items():
            type_durations = [m.duration for m in metrics]
            type_success_rate = sum(1 for m in metrics if m.success) / len(metrics) * 100
            
            type_stats[tx_type] = {
                "count": len(metrics),
                "success_rate": type_success_rate,
                "avg_duration": statistics.mean(type_durations),
                "max_duration": max(type_durations),
                "min_duration": min(type_durations)
            }
        
        return {
            "total_transactions": len(self.transaction_metrics),
            "overall_success_rate": success_rate,
            "duration_stats": {
                "min": min(durations),
                "max": max(durations),
                "avg": statistics.mean(durations),
                "median": statistics.median(durations),
                "p95": sorted(durations)[int(len(durations) * 0.95)],
                "p99": sorted(durations)[int(len(durations) * 0.99)]
            },
            "by_transaction_type": type_stats
        }
    
    def _generate_summary(self) -> Dict[str, Any]:
        """Generate overall performance summary."""
        summary = {
            "status": "completed",
            "recommendations": [],
            "alerts": []
        }
        
        # Analyze query performance for recommendations
        if self.query_metrics:
            avg_query_time = statistics.mean(m.execution_time for m in self.query_metrics)
            if avg_query_time > 0.1:  # 100ms threshold
                summary["alerts"].append(f"Average query time {avg_query_time:.3f}s exceeds 100ms threshold")
            
            slow_queries = [m for m in self.query_metrics if m.execution_time > 1.0]
            if slow_queries:
                summary["alerts"].append(f"{len(slow_queries)} queries took longer than 1 second")
        
        # Analyze system performance
        if self.system_metrics:
            max_cpu = max(m.cpu_usage for m in self.system_metrics)
            max_memory = max(m.memory_percent for m in self.system_metrics)
            
            if max_cpu > 80:
                summary["alerts"].append(f"CPU usage peaked at {max_cpu:.1f}%")
            
            if max_memory > 80:
                summary["alerts"].append(f"Memory usage peaked at {max_memory:.1f}%")
        
        # Analyze transaction performance
        if self.transaction_metrics:
            success_rate = sum(1 for m in self.transaction_metrics if m.success) / len(self.transaction_metrics) * 100
            if success_rate < 95:
                summary["alerts"].append(f"Transaction success rate {success_rate:.1f}% below 95% threshold")
        
        # Generate recommendations
        if not summary["alerts"]:
            summary["recommendations"].append("Performance metrics are within acceptable ranges")
        else:
            summary["recommendations"].append("Review alerts and consider performance optimizations")
            
        return summary
    
    async def save_report(self, filename: Optional[str] = None):
        """Save performance report to file."""
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"performance_report_{timestamp}.json"
        
        filepath = self.output_dir / filename
        report = self.generate_report()
        
        with open(filepath, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        print(f"📄 Performance report saved to: {filepath}")
        
        # Also save detailed metrics
        detailed_filepath = self.output_dir / f"detailed_metrics_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        detailed_data = {
            "query_metrics": [asdict(m) for m in self.query_metrics],
            "system_metrics": [asdict(m) for m in self.system_metrics],
            "transaction_metrics": [asdict(m) for m in self.transaction_metrics]
        }
        
        with open(detailed_filepath, 'w') as f:
            json.dump(detailed_data, f, indent=2, default=str)
        
        print(f"📊 Detailed metrics saved to: {detailed_filepath}")
        
        return filepath


@asynccontextmanager
async def performance_monitoring(duration: float = 300, interval: float = 1.0):
    """Context manager for performance monitoring."""
    monitor = PerformanceMonitor()
    
    # Start monitoring in background
    monitor_task = asyncio.create_task(monitor.start_monitoring(interval))
    
    try:
        yield monitor
        
        # Wait for specified duration
        await asyncio.sleep(duration)
        
    finally:
        # Stop monitoring
        monitor.stop_monitoring()
        monitor_task.cancel()
        
        try:
            await monitor_task
        except asyncio.CancelledError:
            pass
        
        # Generate and save report
        await monitor.save_report()


async def main():
    """Main function for standalone monitoring."""
    parser = argparse.ArgumentParser(description="Performance monitoring utility")
    parser.add_argument("--duration", type=int, default=300, help="Monitoring duration in seconds")
    parser.add_argument("--interval", type=float, default=1.0, help="Metrics collection interval")
    parser.add_argument("--test-type", type=str, default="general", help="Type of test being monitored")
    
    args = parser.parse_args()
    
    print(f"🚀 Starting {args.test_type} performance monitoring")
    print(f"⏱️ Duration: {args.duration} seconds")
    print(f"📊 Collection interval: {args.interval} seconds")
    
    async with performance_monitoring(args.duration, args.interval) as monitor:
        print(f"🔍 Monitoring in progress...")
        print(f"💡 Run your tests in another terminal now")
        print(f"⏹️ Monitoring will automatically stop after {args.duration} seconds")
        
        # Keep the monitoring running
        await asyncio.sleep(args.duration)
    
    print(f"✅ Performance monitoring completed")


if __name__ == "__main__":
    asyncio.run(main())