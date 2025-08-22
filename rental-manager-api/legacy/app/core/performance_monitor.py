"""
Performance Monitoring Module
Tracks query execution times and API response times
"""

import time
import asyncio
from typing import Dict, Any, Callable, Optional
from functools import wraps
from datetime import datetime, timedelta
from collections import deque, defaultdict
import logging
from fastapi import Request, Response
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.pool import Pool

logger = logging.getLogger(__name__)


class PerformanceMonitor:
    """Tracks and reports on application performance metrics"""
    
    def __init__(self, window_size: int = 1000):
        self.window_size = window_size
        self.query_times = deque(maxlen=window_size)
        self.api_times = deque(maxlen=window_size)
        self.slow_queries = deque(maxlen=100)
        self.endpoint_stats = defaultdict(lambda: {"count": 0, "total_time": 0, "errors": 0})
        self.query_counts = defaultdict(int)
        self.start_time = datetime.utcnow()
        
    def record_query(self, query: str, duration: float, params: Optional[Dict] = None):
        """Record a database query execution"""
        self.query_times.append(duration)
        self.query_counts[self._normalize_query(query)] += 1
        
        # Track slow queries (> 100ms)
        if duration > 0.1:
            self.slow_queries.append({
                "query": query[:500],  # Truncate long queries
                "duration": duration,
                "params": params,
                "timestamp": datetime.utcnow()
            })
            logger.warning(f"Slow query detected ({duration:.3f}s): {query[:100]}...")
    
    def record_api_call(self, endpoint: str, duration: float, status_code: int):
        """Record an API call"""
        self.api_times.append(duration)
        self.endpoint_stats[endpoint]["count"] += 1
        self.endpoint_stats[endpoint]["total_time"] += duration
        
        if status_code >= 400:
            self.endpoint_stats[endpoint]["errors"] += 1
        
        # Log slow API calls (> 1 second)
        if duration > 1.0:
            logger.warning(f"Slow API call: {endpoint} took {duration:.3f}s")
    
    def _normalize_query(self, query: str) -> str:
        """Normalize query for grouping similar queries"""
        # Remove specific values to group similar queries
        import re
        normalized = re.sub(r'\d+', 'N', query)
        normalized = re.sub(r"'[^']*'", "'?'", normalized)
        normalized = re.sub(r'\s+', ' ', normalized)
        return normalized[:200]  # Truncate for storage
    
    def get_stats(self) -> Dict[str, Any]:
        """Get current performance statistics"""
        uptime = (datetime.utcnow() - self.start_time).total_seconds()
        
        query_stats = {}
        if self.query_times:
            query_stats = {
                "count": len(self.query_times),
                "avg_ms": sum(self.query_times) / len(self.query_times) * 1000,
                "max_ms": max(self.query_times) * 1000,
                "min_ms": min(self.query_times) * 1000,
                "slow_count": len(self.slow_queries)
            }
        
        api_stats = {}
        if self.api_times:
            api_stats = {
                "count": len(self.api_times),
                "avg_ms": sum(self.api_times) / len(self.api_times) * 1000,
                "max_ms": max(self.api_times) * 1000,
                "min_ms": min(self.api_times) * 1000
            }
        
        # Get top endpoints by call count
        top_endpoints = sorted(
            self.endpoint_stats.items(),
            key=lambda x: x[1]["count"],
            reverse=True
        )[:10]
        
        # Get slowest endpoints by average time
        slowest_endpoints = sorted(
            [(k, v["total_time"] / v["count"] if v["count"] > 0 else 0, v["count"]) 
             for k, v in self.endpoint_stats.items()],
            key=lambda x: x[1],
            reverse=True
        )[:10]
        
        return {
            "uptime_seconds": uptime,
            "query_stats": query_stats,
            "api_stats": api_stats,
            "top_endpoints": [
                {"endpoint": ep, "count": stats["count"], "errors": stats["errors"]}
                for ep, stats in top_endpoints
            ],
            "slowest_endpoints": [
                {"endpoint": ep, "avg_ms": avg_time * 1000, "count": count}
                for ep, avg_time, count in slowest_endpoints
            ],
            "recent_slow_queries": list(self.slow_queries)[-10:],
            "most_frequent_queries": [
                {"query": q[:100], "count": c}
                for q, c in sorted(self.query_counts.items(), key=lambda x: x[1], reverse=True)[:10]
            ]
        }
    
    def reset_stats(self):
        """Reset all statistics"""
        self.query_times.clear()
        self.api_times.clear()
        self.slow_queries.clear()
        self.endpoint_stats.clear()
        self.query_counts.clear()
        self.start_time = datetime.utcnow()


# Global monitor instance
monitor = PerformanceMonitor()


def monitor_performance(func: Callable) -> Callable:
    """Decorator to monitor async function performance"""
    @wraps(func)
    async def async_wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = await func(*args, **kwargs)
            return result
        finally:
            duration = time.time() - start_time
            func_name = f"{func.__module__}.{func.__name__}"
            if duration > 0.5:  # Log functions taking > 500ms
                logger.info(f"Function {func_name} took {duration:.3f}s")
    
    @wraps(func)
    def sync_wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = func(*args, **kwargs)
            return result
        finally:
            duration = time.time() - start_time
            func_name = f"{func.__module__}.{func.__name__}"
            if duration > 0.5:
                logger.info(f"Function {func_name} took {duration:.3f}s")
    
    if asyncio.iscoroutinefunction(func):
        return async_wrapper
    else:
        return sync_wrapper


class DatabaseQueryLogger:
    """Logs database queries for monitoring"""
    
    @staticmethod
    def setup_listeners(engine: Engine):
        """Setup SQLAlchemy event listeners for query monitoring"""
        
        @event.listens_for(Engine, "before_cursor_execute")
        def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            conn.info.setdefault('query_start_time', []).append(time.time())
        
        @event.listens_for(Engine, "after_cursor_execute")
        def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            total = time.time() - conn.info['query_start_time'].pop(-1)
            monitor.record_query(statement, total, parameters)
        
        @event.listens_for(Pool, "connect")
        def receive_connect(dbapi_conn, connection_record):
            connection_record.info['connect_time'] = time.time()
        
        @event.listens_for(Pool, "checkout")
        def receive_checkout(dbapi_conn, connection_record, connection_proxy):
            checkout_time = time.time() - connection_record.info.get('connect_time', time.time())
            if checkout_time > 1.0:
                logger.warning(f"Slow connection checkout: {checkout_time:.3f}s")


async def add_performance_middleware(app):
    """Add middleware to track API performance"""
    
    @app.middleware("http")
    async def performance_middleware(request: Request, call_next):
        start_time = time.time()
        
        # Skip monitoring for static files and health checks
        if request.url.path in ["/health", "/metrics", "/docs", "/openapi.json"]:
            return await call_next(request)
        
        try:
            response: Response = await call_next(request)
            duration = time.time() - start_time
            
            # Record the API call
            monitor.record_api_call(
                endpoint=f"{request.method} {request.url.path}",
                duration=duration,
                status_code=response.status_code
            )
            
            # Add performance headers
            response.headers["X-Process-Time"] = f"{duration:.3f}"
            response.headers["X-Query-Count"] = str(len(monitor.query_times))
            
            return response
            
        except Exception as e:
            duration = time.time() - start_time
            monitor.record_api_call(
                endpoint=f"{request.method} {request.url.path}",
                duration=duration,
                status_code=500
            )
            raise e


def create_performance_endpoints(app):
    """Create endpoints for monitoring performance"""
    
    @app.get("/api/metrics/performance")
    async def get_performance_metrics():
        """Get current performance metrics"""
        return monitor.get_stats()
    
    @app.post("/api/metrics/reset")
    async def reset_performance_metrics():
        """Reset performance metrics"""
        monitor.reset_stats()
        return {"message": "Performance metrics reset successfully"}
    
    @app.get("/api/metrics/health")
    async def health_check():
        """Basic health check endpoint"""
        stats = monitor.get_stats()
        
        # Define health criteria
        is_healthy = True
        issues = []
        
        if stats.get("query_stats", {}).get("avg_ms", 0) > 100:
            issues.append("High average query time")
            is_healthy = False
        
        if stats.get("api_stats", {}).get("avg_ms", 0) > 500:
            issues.append("High average API response time")
            is_healthy = False
        
        error_rate = sum(
            ep.get("errors", 0) for ep in stats.get("top_endpoints", [])
        ) / max(sum(ep.get("count", 0) for ep in stats.get("top_endpoints", [])), 1)
        
        if error_rate > 0.05:  # 5% error rate
            issues.append(f"High error rate: {error_rate:.1%}")
            is_healthy = False
        
        return {
            "status": "healthy" if is_healthy else "degraded",
            "issues": issues,
            "uptime_seconds": stats.get("uptime_seconds", 0),
            "metrics": {
                "avg_query_ms": stats.get("query_stats", {}).get("avg_ms", 0),
                "avg_api_ms": stats.get("api_stats", {}).get("avg_ms", 0),
                "error_rate": error_rate
            }
        }