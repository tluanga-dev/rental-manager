#!/usr/bin/env python3
"""
Real-time monitoring dashboard for rental module in production
Provides live metrics and alerts for all rental submodules
"""

import asyncio
import aiohttp
import json
import os
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from collections import deque
import statistics
import sys

# Configuration
PRODUCTION_URL = os.getenv("PRODUCTION_API_URL", "https://api.production.com")
STAGING_URL = os.getenv("STAGING_API_URL", "http://localhost:8000")
API_KEY = os.getenv("API_KEY", "")
TEST_MODE = os.getenv("TEST_MODE", "staging")
REFRESH_INTERVAL = int(os.getenv("REFRESH_INTERVAL", "30"))  # seconds

# Use appropriate URL
BASE_URL = PRODUCTION_URL if TEST_MODE == "production" else STAGING_URL

# Console colors
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'


@dataclass
class MetricData:
    """Store metric data with history"""
    name: str
    value: Any
    unit: str = ""
    history: deque = field(default_factory=lambda: deque(maxlen=100))
    threshold_warning: Optional[float] = None
    threshold_critical: Optional[float] = None
    
    def add_value(self, value):
        """Add value to history"""
        self.value = value
        self.history.append({
            'timestamp': datetime.now(),
            'value': value
        })
    
    def get_average(self, last_n: int = 10) -> float:
        """Get average of last n values"""
        if not self.history:
            return 0
        recent = list(self.history)[-last_n:]
        values = [item['value'] for item in recent if isinstance(item['value'], (int, float))]
        return statistics.mean(values) if values else 0
    
    def get_trend(self) -> str:
        """Get trend direction"""
        if len(self.history) < 2:
            return "→"
        
        recent = list(self.history)[-10:]
        if len(recent) < 2:
            return "→"
        
        values = [item['value'] for item in recent if isinstance(item['value'], (int, float))]
        if not values or len(values) < 2:
            return "→"
        
        if values[-1] > values[0]:
            return "↑"
        elif values[-1] < values[0]:
            return "↓"
        else:
            return "→"
    
    def get_status_color(self) -> str:
        """Get color based on thresholds"""
        if not isinstance(self.value, (int, float)):
            return Colors.GREEN
        
        if self.threshold_critical and self.value >= self.threshold_critical:
            return Colors.RED
        elif self.threshold_warning and self.value >= self.threshold_warning:
            return Colors.YELLOW
        else:
            return Colors.GREEN


class RentalMonitoringDashboard:
    """Real-time monitoring dashboard for rental modules"""
    
    def __init__(self):
        self.base_url = BASE_URL
        self.headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        }
        self.metrics: Dict[str, MetricData] = {}
        self.alerts: deque = deque(maxlen=50)
        self.last_update = None
        self.running = True
        
        # Initialize metrics
        self.init_metrics()
    
    def init_metrics(self):
        """Initialize metric definitions"""
        self.metrics = {
            # System metrics
            "api_health": MetricData("API Health", "Unknown", ""),
            "response_time": MetricData("Avg Response Time", 0, "ms", threshold_warning=500, threshold_critical=1000),
            "error_rate": MetricData("Error Rate", 0, "%", threshold_warning=1, threshold_critical=5),
            
            # Rental core metrics
            "total_rentals": MetricData("Total Rentals", 0, ""),
            "active_rentals": MetricData("Active Rentals", 0, ""),
            "overdue_rentals": MetricData("Overdue Rentals", 0, "", threshold_warning=10, threshold_critical=50),
            "rentals_today": MetricData("Rentals Today", 0, ""),
            
            # Booking metrics
            "pending_bookings": MetricData("Pending Bookings", 0, ""),
            "confirmed_bookings": MetricData("Confirmed Bookings", 0, ""),
            "booking_conversion": MetricData("Booking Conversion", 0, "%"),
            
            # Extension metrics
            "pending_extensions": MetricData("Pending Extensions", 0, ""),
            "approved_extensions": MetricData("Approved Extensions", 0, ""),
            
            # Return metrics
            "pending_returns": MetricData("Pending Returns", 0, ""),
            "completed_returns": MetricData("Completed Returns Today", 0, ""),
            "damaged_returns": MetricData("Damaged Returns", 0, "", threshold_warning=5, threshold_critical=10),
            
            # Financial metrics
            "revenue_today": MetricData("Revenue Today", 0, "$"),
            "outstanding_amount": MetricData("Outstanding Amount", 0, "$", threshold_warning=10000, threshold_critical=50000),
            "late_fees_collected": MetricData("Late Fees Collected", 0, "$"),
        }
    
    def clear_screen(self):
        """Clear console screen"""
        os.system('cls' if os.name == 'nt' else 'clear')
    
    def print_header(self):
        """Print dashboard header"""
        self.clear_screen()
        print(f"{Colors.BOLD}{Colors.HEADER}{'='*80}{Colors.ENDC}")
        print(f"{Colors.BOLD}{Colors.HEADER}    RENTAL MODULE MONITORING DASHBOARD - {TEST_MODE.upper()}{Colors.ENDC}")
        print(f"{Colors.BOLD}{Colors.HEADER}{'='*80}{Colors.ENDC}")
        
        if self.last_update:
            print(f"{Colors.CYAN}Last Update: {self.last_update.strftime('%Y-%m-%d %H:%M:%S')}{Colors.ENDC}")
        print()
    
    def print_metric_box(self, title: str, metrics: List[str], width: int = 38):
        """Print a box with metrics"""
        print(f"{Colors.BLUE}┌{'─' * width}┐{Colors.ENDC}")
        print(f"{Colors.BLUE}│{Colors.BOLD} {title:<{width-2}} {Colors.BLUE}│{Colors.ENDC}")
        print(f"{Colors.BLUE}├{'─' * width}┤{Colors.ENDC}")
        
        for metric_key in metrics:
            if metric_key in self.metrics:
                metric = self.metrics[metric_key]
                color = metric.get_status_color()
                trend = metric.get_trend()
                
                value_str = f"{metric.value}{metric.unit}"
                line = f" {metric.name}: {value_str} {trend}"
                
                print(f"{Colors.BLUE}│{color}{line:<{width-2}}{Colors.BLUE}│{Colors.ENDC}")
        
        print(f"{Colors.BLUE}└{'─' * width}┘{Colors.ENDC}")
    
    def print_alerts(self):
        """Print recent alerts"""
        print(f"\n{Colors.YELLOW}📢 Recent Alerts:{Colors.ENDC}")
        
        if not self.alerts:
            print(f"  {Colors.GREEN}No alerts{Colors.ENDC}")
        else:
            for alert in list(self.alerts)[-5:]:
                timestamp = alert['timestamp'].strftime('%H:%M:%S')
                level = alert['level']
                message = alert['message']
                
                if level == 'critical':
                    color = Colors.RED
                    icon = "🔴"
                elif level == 'warning':
                    color = Colors.YELLOW
                    icon = "🟡"
                else:
                    color = Colors.CYAN
                    icon = "🔵"
                
                print(f"  {icon} [{timestamp}] {color}{message}{Colors.ENDC}")
    
    def add_alert(self, level: str, message: str):
        """Add alert to queue"""
        self.alerts.append({
            'timestamp': datetime.now(),
            'level': level,
            'message': message
        })
    
    async def fetch_metric_data(self, session: aiohttp.ClientSession):
        """Fetch all metric data from API"""
        try:
            # Check API health
            start_time = time.time()
            async with session.get(f"{self.base_url}/api/health", headers=self.headers) as response:
                response_time = (time.time() - start_time) * 1000
                self.metrics["response_time"].add_value(round(response_time, 2))
                
                if response.status == 200:
                    self.metrics["api_health"].add_value("Healthy")
                else:
                    self.metrics["api_health"].add_value("Unhealthy")
                    self.add_alert("critical", f"API health check failed: {response.status}")
            
            # Fetch rental metrics
            async with session.get(
                f"{self.base_url}/api/transactions/rentals/",
                headers=self.headers,
                params={"limit": 1000}
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    rentals = data.get("data", [])
                    self.metrics["total_rentals"].add_value(len(rentals))
                    
                    # Count rentals by status
                    today = datetime.now().date()
                    rentals_today = sum(1 for r in rentals 
                                      if datetime.fromisoformat(r.get("created_at", "")).date() == today)
                    self.metrics["rentals_today"].add_value(rentals_today)
            
            # Fetch active rentals
            async with session.get(
                f"{self.base_url}/api/transactions/rentals/active",
                headers=self.headers
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    active = data.get("data", [])
                    self.metrics["active_rentals"].add_value(len(active))
            
            # Fetch overdue rentals
            async with session.get(
                f"{self.base_url}/api/transactions/rentals/overdue",
                headers=self.headers
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    overdue = data.get("data", [])
                    overdue_count = len(overdue)
                    self.metrics["overdue_rentals"].add_value(overdue_count)
                    
                    # Check threshold and alert
                    if overdue_count >= self.metrics["overdue_rentals"].threshold_critical:
                        self.add_alert("critical", f"High number of overdue rentals: {overdue_count}")
                    elif overdue_count >= self.metrics["overdue_rentals"].threshold_warning:
                        self.add_alert("warning", f"Overdue rentals increasing: {overdue_count}")
            
            # Calculate error rate (mock for now - would need actual error logs)
            error_rate = 0.1  # Mock value
            self.metrics["error_rate"].add_value(error_rate)
            
            if error_rate >= self.metrics["error_rate"].threshold_critical:
                self.add_alert("critical", f"High error rate: {error_rate}%")
            
        except Exception as e:
            self.add_alert("critical", f"Failed to fetch metrics: {str(e)}")
    
    def render_dashboard(self):
        """Render the dashboard"""
        self.print_header()
        
        # Create two columns
        print(f"{Colors.BOLD}System Health{Colors.ENDC}")
        print()
        
        # Row 1: System metrics and Rental Core
        print(f"{' '*2}", end='')
        self.print_metric_box("System Metrics", [
            "api_health",
            "response_time",
            "error_rate"
        ])
        
        print()
        print(f"{' '*2}", end='')
        self.print_metric_box("Rental Core", [
            "total_rentals",
            "active_rentals",
            "overdue_rentals",
            "rentals_today"
        ])
        
        print()
        print(f"{' '*2}", end='')
        self.print_metric_box("Bookings", [
            "pending_bookings",
            "confirmed_bookings",
            "booking_conversion"
        ])
        
        print()
        print(f"{' '*2}", end='')
        self.print_metric_box("Returns & Extensions", [
            "pending_returns",
            "completed_returns",
            "damaged_returns",
            "pending_extensions"
        ])
        
        print()
        print(f"{' '*2}", end='')
        self.print_metric_box("Financial", [
            "revenue_today",
            "outstanding_amount",
            "late_fees_collected"
        ])
        
        # Print alerts
        self.print_alerts()
        
        # Print footer
        print(f"\n{Colors.CYAN}Press Ctrl+C to exit | Refreshing every {REFRESH_INTERVAL}s{Colors.ENDC}")
    
    async def run(self):
        """Run the monitoring dashboard"""
        print(f"{Colors.GREEN}Starting monitoring dashboard...{Colors.ENDC}")
        
        async with aiohttp.ClientSession() as session:
            try:
                while self.running:
                    # Fetch metrics
                    await self.fetch_metric_data(session)
                    self.last_update = datetime.now()
                    
                    # Render dashboard
                    self.render_dashboard()
                    
                    # Wait for next refresh
                    await asyncio.sleep(REFRESH_INTERVAL)
                    
            except KeyboardInterrupt:
                print(f"\n{Colors.YELLOW}Dashboard stopped by user{Colors.ENDC}")
            except Exception as e:
                print(f"\n{Colors.RED}Error: {str(e)}{Colors.ENDC}")
    
    def export_metrics(self, filename: str = None):
        """Export metrics to JSON file"""
        if not filename:
            filename = f"metrics_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        export_data = {
            "timestamp": datetime.now().isoformat(),
            "environment": TEST_MODE,
            "metrics": {}
        }
        
        for key, metric in self.metrics.items():
            export_data["metrics"][key] = {
                "name": metric.name,
                "value": metric.value,
                "unit": metric.unit,
                "average": metric.get_average(),
                "trend": metric.get_trend()
            }
        
        with open(filename, 'w') as f:
            json.dump(export_data, f, indent=2, default=str)
        
        print(f"{Colors.GREEN}Metrics exported to {filename}{Colors.ENDC}")


async def main():
    """Main entry point"""
    dashboard = RentalMonitoringDashboard()
    await dashboard.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Monitoring stopped{Colors.ENDC}")
        sys.exit(0)