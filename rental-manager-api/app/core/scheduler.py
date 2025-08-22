"""
Task Scheduler Service for FastAPI Application

Integrates APScheduler with FastAPI to provide background task scheduling
for rental status updates and other maintenance tasks.
"""

import asyncio
import logging
from datetime import datetime, time
from typing import Optional, Dict, Any, Callable, List
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)

# APScheduler imports (optional - will be installed when needed)
try:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.jobstores.memory import MemoryJobStore
    from apscheduler.executors.asyncio import AsyncIOExecutor
    from apscheduler.triggers.cron import CronTrigger
    from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR
    SCHEDULER_AVAILABLE = True
except ImportError:
    logger.warning("APScheduler not available. Task scheduling disabled.")
    SCHEDULER_AVAILABLE = False


class TaskScheduler:
    """
    Application task scheduler using APScheduler.
    
    Provides background task scheduling capabilities for:
    - Daily rental status checks
    - System maintenance tasks
    - Data cleanup operations
    - Custom scheduled tasks
    """
    
    def __init__(self):
        self.scheduler: Optional[AsyncIOScheduler] = None
        self._running = False
        self._enabled = SCHEDULER_AVAILABLE
    
    async def initialize(self):
        """Initialize the scheduler with configuration."""
        if not self._enabled:
            logger.info("Task scheduler disabled (APScheduler not available)")
            return
            
        if self.scheduler is not None:
            return
        
        # Configure APScheduler
        jobstores = {
            'default': MemoryJobStore()
        }
        
        executors = {
            'default': AsyncIOExecutor()
        }
        
        job_defaults = {
            'coalesce': False,
            'max_instances': 1,
            'misfire_grace_time': 300  # 5 minutes
        }
        
        self.scheduler = AsyncIOScheduler(
            jobstores=jobstores,
            executors=executors,
            job_defaults=job_defaults,
            timezone='UTC'
        )
        
        # Add event listeners
        self.scheduler.add_listener(self._job_executed, EVENT_JOB_EXECUTED)
        self.scheduler.add_listener(self._job_error, EVENT_JOB_ERROR)
        
        logger.info("Task scheduler initialized")
    
    async def start(self):
        """Start the scheduler and register default jobs."""
        if not self._enabled:
            return
            
        if not self.scheduler:
            await self.initialize()
        
        if self._running:
            return
        
        # Register default jobs
        await self._register_default_jobs()
        
        # Start the scheduler
        self.scheduler.start()
        self._running = True
        
        logger.info("Task scheduler started")
    
    async def stop(self):
        """Stop the scheduler gracefully."""
        if not self._enabled:
            return
            
        if self.scheduler and self._running:
            self.scheduler.shutdown(wait=True)
            self._running = False
            logger.info("Task scheduler stopped")
    
    async def _register_default_jobs(self):
        """Register default scheduled jobs."""
        if not self.scheduler:
            return
        
        try:
            # Add daily rental status check job (example)
            # TODO: Implement when rental system is available
            # self.scheduler.add_job(
            #     func=self._rental_status_check_job,
            #     trigger=CronTrigger(hour=0, minute=0),  # Daily at midnight
            #     id='daily_rental_status_check',
            #     name='Daily Rental Status Check',
            #     replace_existing=True
            # )
            
            # Add weekly cleanup job (example)
            # self.scheduler.add_job(
            #     func=self._weekly_cleanup_job,
            #     trigger=CronTrigger(day_of_week=0, hour=2, minute=0),  # Sunday 2 AM
            #     id='weekly_cleanup',
            #     name='Weekly Cleanup',
            #     replace_existing=True
            # )
            
            logger.info("Default scheduled jobs registered")
            
        except Exception as e:
            logger.error(f"Failed to register default jobs: {e}")
    
    def _job_executed(self, event):
        """Handle job execution event."""
        logger.info(f"Job {event.job_id} executed successfully")
    
    def _job_error(self, event):
        """Handle job error event."""
        logger.error(f"Job {event.job_id} failed: {event.exception}")
    
    # Example job functions (to be implemented when modules are available)
    async def _rental_status_check_job(self):
        """Daily rental status check job."""
        logger.info("Executing daily rental status check")
        try:
            # TODO: Implement rental status checking
            # from app.modules.rentals.service import RentalService
            # 
            # async with get_db() as session:
            #     rental_service = RentalService(session)
            #     await rental_service.update_overdue_rentals()
            #     logger.info("Rental status check completed")
            
            logger.info("Rental status check completed (placeholder)")
        except Exception as e:
            logger.error(f"Rental status check failed: {e}")
    
    async def _weekly_cleanup_job(self):
        """Weekly cleanup job."""
        logger.info("Executing weekly cleanup")
        try:
            # TODO: Implement cleanup logic
            # - Clean up old logs
            # - Archive completed transactions
            # - Clean up temporary files
            
            logger.info("Weekly cleanup completed (placeholder)")
        except Exception as e:
            logger.error(f"Weekly cleanup failed: {e}")
    
    def add_job(
        self,
        func: Callable,
        trigger,
        job_id: str,
        name: str = None,
        **kwargs
    ):
        """Add a custom job to the scheduler."""
        if not self._enabled or not self.scheduler:
            logger.warning(f"Cannot add job {job_id}: scheduler not available")
            return
        
        try:
            self.scheduler.add_job(
                func=func,
                trigger=trigger,
                id=job_id,
                name=name or job_id,
                replace_existing=True,
                **kwargs
            )
            logger.info(f"Added job: {job_id}")
        except Exception as e:
            logger.error(f"Failed to add job {job_id}: {e}")
    
    def remove_job(self, job_id: str):
        """Remove a job from the scheduler."""
        if not self._enabled or not self.scheduler:
            return
        
        try:
            self.scheduler.remove_job(job_id)
            logger.info(f"Removed job: {job_id}")
        except Exception as e:
            logger.error(f"Failed to remove job {job_id}: {e}")
    
    def get_jobs(self) -> List[Dict[str, Any]]:
        """Get list of all scheduled jobs."""
        if not self._enabled or not self.scheduler:
            return []
        
        jobs = []
        for job in self.scheduler.get_jobs():
            jobs.append({
                'id': job.id,
                'name': job.name,
                'next_run_time': str(job.next_run_time) if job.next_run_time else None,
                'trigger': str(job.trigger)
            })
        
        return jobs


# Global scheduler instance
task_scheduler = TaskScheduler()

# Convenience functions
async def start_scheduler():
    """Start the global task scheduler."""
    await task_scheduler.start()

async def stop_scheduler():
    """Stop the global task scheduler."""
    await task_scheduler.stop()

def add_scheduled_job(func: Callable, trigger, job_id: str, name: str = None, **kwargs):
    """Add a job to the global scheduler."""
    task_scheduler.add_job(func, trigger, job_id, name, **kwargs)

def remove_scheduled_job(job_id: str):
    """Remove a job from the global scheduler."""
    task_scheduler.remove_job(job_id)

def get_scheduled_jobs():
    """Get all scheduled jobs."""
    return task_scheduler.get_jobs()

# Context manager for scheduler lifecycle
@asynccontextmanager
async def scheduler_lifespan():
    """Context manager for scheduler lifecycle in FastAPI app."""
    try:
        await start_scheduler()
        yield
    finally:
        await stop_scheduler()