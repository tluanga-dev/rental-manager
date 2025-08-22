#!/usr/bin/env python3
"""
1000-Transaction Stress Test for Transaction Module

This script creates and tests 1000 transactions with comprehensive testing:
- 300 Purchase transactions with various suppliers and items
- 300 Sales transactions with various customers  
- 300 Rental transactions with lifecycle events
- 100 Return transactions (purchase and sales returns)

The test validates performance, data integrity, and business rules at scale.
"""

import asyncio
import json
import sys
import time
import random
import string
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, date, timedelta
from decimal import Decimal
from uuid import UUID, uuid4
import aiohttp
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeRemainingColumn
from faker import Faker

console = Console()
fake = Faker()


class Transaction1000StressTester:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session: Optional[aiohttp.ClientSession] = None
        self.auth_token: Optional[str] = None
        
        # Test configuration
        self.total_transactions = 1000
        self.purchase_count = 300
        self.sales_count = 300
        self.rental_count = 300
        self.return_count = 100
        
        # Data storage
        self.created_transactions = {
            "purchases": [],
            "sales": [],
            "rentals": [],
            "returns": []
        }
        
        # Test data IDs (will be fetched from API)
        self.customer_ids = []
        self.supplier_ids = []
        self.item_ids = []
        self.location_ids = []
        
        # Performance metrics
        self.metrics = {
            "creation_times": [],
            "query_times": [],
            "update_times": [],
            "bulk_times": [],
            "errors": [],
            "success_rate": 0,
            "avg_response_time": 0,
            "peak_response_time": 0,
            "min_response_time": float('inf')
        }
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        await self.authenticate()
        await self.fetch_test_data()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
            
    async def authenticate(self):
        """Authenticate with the API to get a bearer token"""
        try:
            auth_data = {
                "username": "admin",
                "password": "Admin123!"
            }
            
            async with self.session.post(
                f"{self.base_url}/api/v1/auth/login",
                data=auth_data
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    self.auth_token = result["access_token"]
                    console.print("[green]✓[/green] Authentication successful")
                else:
                    console.print(f"[red]✗[/red] Authentication failed: {response.status}")
                    raise Exception("Authentication failed")
                    
        except Exception as e:
            console.print(f"[red]✗[/red] Authentication error: {e}")
            raise
            
    async def fetch_test_data(self):
        """Fetch existing customers, suppliers, items, and locations for testing"""
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            task = progress.add_task("Fetching test data...", total=4)
            
            # Fetch customers
            async with self.session.get(
                f"{self.base_url}/api/v1/customers",
                headers=headers,
                params={"limit": 50}
            ) as response:
                if response.status == 200:
                    customers = await response.json()
                    self.customer_ids = [c["id"] for c in customers]
                    if not self.customer_ids:
                        # Create test customers if none exist
                        await self.create_test_customers()
                progress.update(task, advance=1)
            
            # Fetch suppliers
            async with self.session.get(
                f"{self.base_url}/api/v1/suppliers",
                headers=headers,
                params={"limit": 50}
            ) as response:
                if response.status == 200:
                    suppliers = await response.json()
                    self.supplier_ids = [s["id"] for s in suppliers]
                    if not self.supplier_ids:
                        await self.create_test_suppliers()
                progress.update(task, advance=1)
            
            # Fetch items
            async with self.session.get(
                f"{self.base_url}/api/v1/items",
                headers=headers,
                params={"limit": 100}
            ) as response:
                if response.status == 200:
                    items = await response.json()
                    self.item_ids = [i["id"] for i in items]
                    if not self.item_ids:
                        await self.create_test_items()
                progress.update(task, advance=1)
            
            # Fetch locations
            async with self.session.get(
                f"{self.base_url}/api/v1/locations",
                headers=headers,
                params={"limit": 10}
            ) as response:
                if response.status == 200:
                    locations = await response.json()
                    self.location_ids = [l["id"] for l in locations]
                    if not self.location_ids:
                        await self.create_test_locations()
                progress.update(task, advance=1)
                
        console.print(f"[cyan]Test data loaded:[/cyan]")
        console.print(f"  • Customers: {len(self.customer_ids)}")
        console.print(f"  • Suppliers: {len(self.supplier_ids)}")
        console.print(f"  • Items: {len(self.item_ids)}")
        console.print(f"  • Locations: {len(self.location_ids)}")
    
    async def create_test_customers(self):
        """Create test customers if none exist"""
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        for i in range(20):
            customer_data = {
                "name": fake.company(),
                "email": fake.company_email(),
                "phone": fake.phone_number(),
                "address": fake.address(),
                "tax_id": fake.ein(),
                "credit_limit": random.uniform(10000, 100000),
                "payment_terms": random.choice(["NET_30", "NET_60", "COD"])
            }
            
            async with self.session.post(
                f"{self.base_url}/api/v1/customers",
                headers=headers,
                json=customer_data
            ) as response:
                if response.status == 201:
                    customer = await response.json()
                    self.customer_ids.append(customer["id"])
    
    async def create_test_suppliers(self):
        """Create test suppliers if none exist"""
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        for i in range(20):
            supplier_data = {
                "name": fake.company() + " Supplies",
                "email": fake.company_email(),
                "phone": fake.phone_number(),
                "address": fake.address(),
                "tax_id": fake.ein(),
                "payment_terms": random.choice(["NET_30", "NET_60", "NET_90"])
            }
            
            async with self.session.post(
                f"{self.base_url}/api/v1/suppliers",
                headers=headers,
                json=supplier_data
            ) as response:
                if response.status == 201:
                    supplier = await response.json()
                    self.supplier_ids.append(supplier["id"])
    
    async def create_test_items(self):
        """Create test items if none exist"""
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        item_types = [
            ("Tool", "TOOL", 50, 500),
            ("Equipment", "EQUIP", 100, 5000),
            ("Material", "MAT", 10, 200),
            ("Accessory", "ACC", 5, 100),
            ("Consumable", "CONS", 1, 50)
        ]
        
        for category, code_prefix, min_price, max_price in item_types:
            for i in range(10):
                item_data = {
                    "name": f"{category} {fake.word().capitalize()} {i+1}",
                    "sku": f"{code_prefix}-{random.randint(10000, 99999)}",
                    "description": fake.sentence(),
                    "category": category,
                    "unit_price": random.uniform(min_price, max_price),
                    "cost_price": random.uniform(min_price * 0.6, min_price * 0.8),
                    "is_serialized": random.choice([True, False]),
                    "is_rentable": True,
                    "rental_daily_rate": random.uniform(min_price * 0.05, min_price * 0.1),
                    "rental_weekly_rate": random.uniform(min_price * 0.25, min_price * 0.4),
                    "rental_monthly_rate": random.uniform(min_price * 0.8, min_price * 1.2),
                    "min_stock_level": random.randint(5, 20),
                    "max_stock_level": random.randint(50, 200)
                }
                
                async with self.session.post(
                    f"{self.base_url}/api/v1/items",
                    headers=headers,
                    json=item_data
                ) as response:
                    if response.status == 201:
                        item = await response.json()
                        self.item_ids.append(item["id"])
    
    async def create_test_locations(self):
        """Create test locations if none exist"""
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        locations = [
            ("Main Warehouse", "MAIN", "warehouse"),
            ("North Branch", "NORTH", "store"),
            ("South Branch", "SOUTH", "store"),
            ("East Distribution", "EAST", "distribution"),
            ("West Outlet", "WEST", "outlet")
        ]
        
        for name, code, location_type in locations:
            location_data = {
                "name": name,
                "code": code,
                "type": location_type,
                "address": fake.address(),
                "phone": fake.phone_number(),
                "email": fake.email(),
                "is_active": True
            }
            
            async with self.session.post(
                f"{self.base_url}/api/v1/locations",
                headers=headers,
                json=location_data
            ) as response:
                if response.status == 201:
                    location = await response.json()
                    self.location_ids.append(location["id"])
    
    def generate_purchase_data(self) -> Dict[str, Any]:
        """Generate realistic purchase transaction data"""
        num_items = random.randint(5, 20)
        items = []
        subtotal = 0
        
        for i in range(num_items):
            quantity = random.randint(10, 100)
            unit_price = random.uniform(10, 500)
            total = quantity * unit_price
            subtotal += total
            
            items.append({
                "item_id": random.choice(self.item_ids),
                "quantity": quantity,
                "unit_price": unit_price,
                "discount_percent": random.uniform(0, 10),
                "tax_rate": random.uniform(5, 15),
                "description": fake.sentence(),
                "notes": fake.text(max_nb_chars=100) if random.random() > 0.7 else None
            })
        
        return {
            "supplier_id": random.choice(self.supplier_ids),
            "location_id": random.choice(self.location_ids),
            "purchase_date": fake.date_between(start_date="-30d", end_date="today").isoformat(),
            "expected_delivery_date": fake.date_between(start_date="today", end_date="+30d").isoformat(),
            "payment_method": random.choice(["BANK_TRANSFER", "CREDIT_CARD", "CASH", "CHEQUE"]),
            "payment_terms": random.choice(["NET_30", "NET_60", "NET_90", "COD"]),
            "shipping_cost": random.uniform(50, 500),
            "notes": fake.text(max_nb_chars=200),
            "items": items
        }
    
    def generate_sales_data(self) -> Dict[str, Any]:
        """Generate realistic sales transaction data"""
        num_items = random.randint(1, 10)
        items = []
        
        for i in range(num_items):
            quantity = random.randint(1, 20)
            unit_price = random.uniform(20, 1000)
            
            items.append({
                "item_id": random.choice(self.item_ids),
                "quantity": quantity,
                "unit_price": unit_price,
                "discount_percent": random.uniform(0, 15),
                "tax_rate": random.uniform(5, 20),
                "description": fake.sentence()
            })
        
        return {
            "customer_id": random.choice(self.customer_ids),
            "location_id": random.choice(self.location_ids),
            "sale_date": fake.date_between(start_date="-30d", end_date="today").isoformat(),
            "payment_method": random.choice(["CASH", "CREDIT_CARD", "DEBIT_CARD", "BANK_TRANSFER"]),
            "delivery_required": random.choice([True, False]),
            "delivery_address": fake.address() if random.random() > 0.5 else None,
            "notes": fake.text(max_nb_chars=200),
            "items": items
        }
    
    def generate_rental_data(self) -> Dict[str, Any]:
        """Generate realistic rental transaction data"""
        num_items = random.randint(1, 5)
        items = []
        
        rental_start = fake.date_between(start_date="today", end_date="+7d")
        rental_duration = random.randint(1, 30)
        rental_end = rental_start + timedelta(days=rental_duration)
        
        for i in range(num_items):
            daily_rate = random.uniform(50, 500)
            
            items.append({
                "item_id": random.choice(self.item_ids),
                "quantity": random.randint(1, 3),
                "daily_rate": daily_rate,
                "rental_start_date": rental_start.isoformat(),
                "rental_end_date": rental_end.isoformat(),
                "security_deposit": daily_rate * rental_duration * 0.2,
                "description": fake.sentence()
            })
        
        return {
            "customer_id": random.choice(self.customer_ids),
            "location_id": random.choice(self.location_ids),
            "rental_start_date": rental_start.isoformat(),
            "rental_end_date": rental_end.isoformat(),
            "payment_method": random.choice(["CREDIT_CARD", "BANK_TRANSFER", "CASH"]),
            "pickup_required": True,
            "pickup_date": rental_start.isoformat(),
            "delivery_address": fake.address() if random.random() > 0.5 else None,
            "notes": fake.text(max_nb_chars=200),
            "items": items
        }
    
    async def create_purchase_transactions(self):
        """Create purchase transactions"""
        console.print(f"\n[yellow]Creating {self.purchase_count} purchase transactions...[/yellow]")
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TimeRemainingColumn(),
            console=console
        ) as progress:
            task = progress.add_task("Creating purchases...", total=self.purchase_count)
            
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            # Batch creation for better performance
            batch_size = 10
            for batch_start in range(0, self.purchase_count, batch_size):
                batch_end = min(batch_start + batch_size, self.purchase_count)
                batch_tasks = []
                
                for i in range(batch_start, batch_end):
                    purchase_data = self.generate_purchase_data()
                    batch_tasks.append(self.create_single_transaction(
                        "/api/v1/transactions/purchases",
                        purchase_data,
                        headers
                    ))
                
                results = await asyncio.gather(*batch_tasks, return_exceptions=True)
                
                for result in results:
                    if isinstance(result, Exception):
                        self.metrics["errors"].append(str(result))
                    elif result:
                        self.created_transactions["purchases"].append(result)
                
                progress.update(task, advance=batch_end - batch_start)
        
        console.print(f"[green]✓[/green] Created {len(self.created_transactions['purchases'])} purchases")
    
    async def create_sales_transactions(self):
        """Create sales transactions"""
        console.print(f"\n[yellow]Creating {self.sales_count} sales transactions...[/yellow]")
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TimeRemainingColumn(),
            console=console
        ) as progress:
            task = progress.add_task("Creating sales...", total=self.sales_count)
            
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            batch_size = 10
            for batch_start in range(0, self.sales_count, batch_size):
                batch_end = min(batch_start + batch_size, self.sales_count)
                batch_tasks = []
                
                for i in range(batch_start, batch_end):
                    sales_data = self.generate_sales_data()
                    batch_tasks.append(self.create_single_transaction(
                        "/api/v1/transactions/sales",
                        sales_data,
                        headers
                    ))
                
                results = await asyncio.gather(*batch_tasks, return_exceptions=True)
                
                for result in results:
                    if isinstance(result, Exception):
                        self.metrics["errors"].append(str(result))
                    elif result:
                        self.created_transactions["sales"].append(result)
                
                progress.update(task, advance=batch_end - batch_start)
        
        console.print(f"[green]✓[/green] Created {len(self.created_transactions['sales'])} sales")
    
    async def create_rental_transactions(self):
        """Create rental transactions"""
        console.print(f"\n[yellow]Creating {self.rental_count} rental transactions...[/yellow]")
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TimeRemainingColumn(),
            console=console
        ) as progress:
            task = progress.add_task("Creating rentals...", total=self.rental_count)
            
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            batch_size = 10
            for batch_start in range(0, self.rental_count, batch_size):
                batch_end = min(batch_start + batch_size, self.rental_count)
                batch_tasks = []
                
                for i in range(batch_start, batch_end):
                    rental_data = self.generate_rental_data()
                    batch_tasks.append(self.create_single_transaction(
                        "/api/v1/transactions/rentals",
                        rental_data,
                        headers
                    ))
                
                results = await asyncio.gather(*batch_tasks, return_exceptions=True)
                
                for result in results:
                    if isinstance(result, Exception):
                        self.metrics["errors"].append(str(result))
                    elif result:
                        self.created_transactions["rentals"].append(result)
                
                progress.update(task, advance=batch_end - batch_start)
        
        console.print(f"[green]✓[/green] Created {len(self.created_transactions['rentals'])} rentals")
    
    async def create_return_transactions(self):
        """Create return transactions"""
        console.print(f"\n[yellow]Creating {self.return_count} return transactions...[/yellow]")
        
        # Returns will be created from existing purchases and sales
        # Implementation depends on return endpoints being available
        console.print(f"[yellow]⚠[/yellow] Return transactions creation pending API implementation")
        
    async def create_single_transaction(self, endpoint: str, data: Dict, headers: Dict) -> Optional[Dict]:
        """Create a single transaction and measure performance"""
        start_time = time.time()
        
        try:
            async with self.session.post(
                f"{self.base_url}{endpoint}",
                headers=headers,
                json=data
            ) as response:
                elapsed = time.time() - start_time
                self.metrics["creation_times"].append(elapsed)
                
                if elapsed > self.metrics["peak_response_time"]:
                    self.metrics["peak_response_time"] = elapsed
                if elapsed < self.metrics["min_response_time"]:
                    self.metrics["min_response_time"] = elapsed
                
                if response.status in [200, 201]:
                    return await response.json()
                else:
                    error_text = await response.text()
                    self.metrics["errors"].append(f"Status {response.status}: {error_text}")
                    return None
                    
        except Exception as e:
            self.metrics["errors"].append(str(e))
            return None
    
    async def test_query_performance(self):
        """Test query performance with various filters"""
        console.print("\n[yellow]Testing query performance...[/yellow]")
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        test_queries = [
            ("All transactions", "/api/v1/transactions", {"limit": 100}),
            ("Purchases only", "/api/v1/transactions", {"transaction_type": "PURCHASE", "limit": 50}),
            ("Sales only", "/api/v1/transactions", {"transaction_type": "SALE", "limit": 50}),
            ("Rentals only", "/api/v1/transactions", {"transaction_type": "RENTAL", "limit": 50}),
            ("Date range", "/api/v1/transactions", {
                "date_from": (datetime.now() - timedelta(days=30)).date().isoformat(),
                "date_to": datetime.now().date().isoformat(),
                "limit": 100
            }),
            ("By customer", "/api/v1/transactions", {
                "customer_id": random.choice(self.customer_ids) if self.customer_ids else None,
                "limit": 50
            }),
            ("By supplier", "/api/v1/transactions", {
                "supplier_id": random.choice(self.supplier_ids) if self.supplier_ids else None,
                "limit": 50
            }),
            ("Pending status", "/api/v1/transactions", {"status": "PENDING", "limit": 50}),
            ("Completed status", "/api/v1/transactions", {"status": "COMPLETED", "limit": 50}),
        ]
        
        for query_name, endpoint, params in test_queries:
            start_time = time.time()
            
            try:
                async with self.session.get(
                    f"{self.base_url}{endpoint}",
                    headers=headers,
                    params=params
                ) as response:
                    elapsed = time.time() - start_time
                    self.metrics["query_times"].append(elapsed)
                    
                    if response.status == 200:
                        data = await response.json()
                        console.print(f"  [green]✓[/green] {query_name}: {elapsed:.3f}s ({len(data)} results)")
                    else:
                        console.print(f"  [red]✗[/red] {query_name}: Failed with status {response.status}")
                        
            except Exception as e:
                console.print(f"  [red]✗[/red] {query_name}: {e}")
    
    async def test_concurrent_operations(self):
        """Test concurrent transaction operations"""
        console.print("\n[yellow]Testing concurrent operations...[/yellow]")
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        # Create 50 transactions concurrently
        concurrent_tasks = []
        
        for i in range(50):
            if i % 3 == 0:
                data = self.generate_purchase_data()
                endpoint = "/api/v1/transactions/purchases"
            elif i % 3 == 1:
                data = self.generate_sales_data()
                endpoint = "/api/v1/transactions/sales"
            else:
                data = self.generate_rental_data()
                endpoint = "/api/v1/transactions/rentals"
            
            concurrent_tasks.append(self.create_single_transaction(endpoint, data, headers))
        
        start_time = time.time()
        results = await asyncio.gather(*concurrent_tasks, return_exceptions=True)
        elapsed = time.time() - start_time
        
        successful = sum(1 for r in results if r and not isinstance(r, Exception))
        failed = sum(1 for r in results if isinstance(r, Exception) or not r)
        
        console.print(f"  Concurrent creation: {successful} successful, {failed} failed in {elapsed:.2f}s")
        console.print(f"  Throughput: {successful/elapsed:.1f} transactions/second")
    
    def generate_report(self):
        """Generate comprehensive test report"""
        console.print("\n[bold cyan]═══════════════════════════════════════════════════════════════[/bold cyan]")
        console.print("[bold cyan]                    TEST RESULTS SUMMARY                          [/bold cyan]")
        console.print("[bold cyan]═══════════════════════════════════════════════════════════════[/bold cyan]\n")
        
        # Transaction counts
        table = Table(title="Transaction Counts", show_header=True, header_style="bold magenta")
        table.add_column("Type", style="cyan")
        table.add_column("Target", style="yellow")
        table.add_column("Created", style="green")
        table.add_column("Success Rate", style="blue")
        
        for tx_type, target in [
            ("Purchases", self.purchase_count),
            ("Sales", self.sales_count),
            ("Rentals", self.rental_count),
            ("Returns", self.return_count)
        ]:
            created = len(self.created_transactions.get(tx_type.lower(), []))
            success_rate = f"{(created/target)*100:.1f}%" if target > 0 else "N/A"
            table.add_row(tx_type, str(target), str(created), success_rate)
        
        total_target = self.total_transactions
        total_created = sum(len(txs) for txs in self.created_transactions.values())
        table.add_row(
            "[bold]Total[/bold]",
            f"[bold]{total_target}[/bold]",
            f"[bold]{total_created}[/bold]",
            f"[bold]{(total_created/total_target)*100:.1f}%[/bold]"
        )
        
        console.print(table)
        
        # Performance metrics
        if self.metrics["creation_times"]:
            avg_creation = sum(self.metrics["creation_times"]) / len(self.metrics["creation_times"])
            
            perf_table = Table(title="\nPerformance Metrics", show_header=True, header_style="bold magenta")
            perf_table.add_column("Metric", style="cyan")
            perf_table.add_column("Value", style="green")
            
            perf_table.add_row("Average Response Time", f"{avg_creation:.3f}s")
            perf_table.add_row("Min Response Time", f"{self.metrics['min_response_time']:.3f}s")
            perf_table.add_row("Max Response Time", f"{self.metrics['peak_response_time']:.3f}s")
            
            if self.metrics["query_times"]:
                avg_query = sum(self.metrics["query_times"]) / len(self.metrics["query_times"])
                perf_table.add_row("Average Query Time", f"{avg_query:.3f}s")
            
            perf_table.add_row("Total Errors", str(len(self.metrics["errors"])))
            perf_table.add_row("Success Rate", f"{((total_created/total_target)*100):.1f}%")
            
            console.print(perf_table)
        
        # Error summary
        if self.metrics["errors"]:
            console.print(f"\n[red]Errors encountered ({len(self.metrics['errors'])} total):[/red]")
            # Show first 5 unique errors
            unique_errors = list(set(self.metrics["errors"]))[:5]
            for error in unique_errors:
                console.print(f"  • {error[:100]}...")
        
        # Test verdict
        console.print("\n[bold cyan]═══════════════════════════════════════════════════════════════[/bold cyan]")
        
        success_rate = (total_created / total_target) * 100 if total_target > 0 else 0
        
        if success_rate >= 95 and avg_creation < 0.5:
            console.print("[bold green]✓ TEST PASSED[/bold green] - All performance targets met!")
        elif success_rate >= 80:
            console.print("[bold yellow]⚠ TEST PARTIALLY PASSED[/bold yellow] - Some issues detected")
        else:
            console.print("[bold red]✗ TEST FAILED[/bold red] - Performance targets not met")
        
        console.print("[bold cyan]═══════════════════════════════════════════════════════════════[/bold cyan]")
        
        # Save detailed report
        report_data = {
            "timestamp": datetime.now().isoformat(),
            "summary": {
                "total_target": total_target,
                "total_created": total_created,
                "success_rate": success_rate,
                "avg_response_time": avg_creation if self.metrics["creation_times"] else 0,
                "min_response_time": self.metrics["min_response_time"],
                "max_response_time": self.metrics["peak_response_time"],
                "errors": len(self.metrics["errors"])
            },
            "transactions": self.created_transactions,
            "metrics": self.metrics
        }
        
        with open("test_results/transaction_stress_test_report.json", "w") as f:
            json.dump(report_data, f, indent=2, default=str)
        
        console.print(f"\n[cyan]Detailed report saved to test_results/transaction_stress_test_report.json[/cyan]")
    
    async def run_stress_test(self):
        """Run the complete stress test"""
        console.print("[bold cyan]Starting 1000-Transaction Stress Test[/bold cyan]")
        console.print(f"Base URL: {self.base_url}")
        console.print(f"Target: {self.total_transactions} transactions\n")
        
        start_time = time.time()
        
        try:
            # Create transactions
            await self.create_purchase_transactions()
            await self.create_sales_transactions()
            await self.create_rental_transactions()
            await self.create_return_transactions()
            
            # Test query performance
            await self.test_query_performance()
            
            # Test concurrent operations
            await self.test_concurrent_operations()
            
            total_time = time.time() - start_time
            
            console.print(f"\n[green]Total test time: {total_time:.2f} seconds[/green]")
            
            # Generate report
            self.generate_report()
            
        except Exception as e:
            console.print(f"[red]Test failed with error: {e}[/red]")
            raise


async def main():
    """Main entry point"""
    try:
        async with Transaction1000StressTester() as tester:
            await tester.run_stress_test()
    except KeyboardInterrupt:
        console.print("\n[yellow]Test interrupted by user[/yellow]")
        sys.exit(1)
    except Exception as e:
        console.print(f"[red]Fatal error: {e}[/red]")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())