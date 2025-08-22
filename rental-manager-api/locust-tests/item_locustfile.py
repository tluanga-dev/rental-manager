"""
Locust load testing file for Item API endpoints.

This file tests the performance of item-related endpoints under load,
simulating realistic usage patterns for a rental management system.
"""

import json
import random
from locust import HttpUser, task, between
from typing import List, Dict, Any


class ItemAPIUser(HttpUser):
    """Locust user class for testing Item API performance."""
    
    # Wait between 1-5 seconds between requests
    wait_time = between(1, 5)
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.auth_token = None
        self.created_items: List[Dict] = []
        self.sample_item_ids: List[str] = []
        self.sample_brand_ids: List[str] = []
        self.sample_category_ids: List[str] = []
    
    def on_start(self):
        """Called when a user starts - authenticate and get initial data."""
        self.authenticate()
        self.load_sample_data()
    
    def authenticate(self):
        """Authenticate user and get access token."""
        auth_data = {
            "username": "testadmin",
            "password": "TestAdmin123!"
        }
        
        with self.client.post(
            "/api/auth/login",
            json=auth_data,
            catch_response=True,
            name="Authentication"
        ) as response:
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("access_token")
                response.success()
            else:
                response.failure(f"Authentication failed: {response.status_code}")
    
    @property
    def auth_headers(self) -> Dict[str, str]:
        """Get authentication headers."""
        if self.auth_token:
            return {"Authorization": f"Bearer {self.auth_token}"}
        return {}
    
    def load_sample_data(self):
        """Load sample data for testing."""
        # Get sample items for testing
        with self.client.get(
            "/api/items/",
            params={"page_size": 50},
            headers=self.auth_headers,
            catch_response=True,
            name="Load Sample Items"
        ) as response:
            if response.status_code == 200:
                data = response.json()
                items = data.get("items", [])
                self.sample_item_ids = [item["id"] for item in items]
                self.sample_brand_ids = list(set([item.get("brand_id") for item in items if item.get("brand_id")]))
                self.sample_category_ids = list(set([item.get("category_id") for item in items if item.get("category_id")]))
                response.success()
            else:
                response.failure(f"Failed to load sample data: {response.status_code}")
        
        # Get brands
        with self.client.get(
            "/api/brands/",
            params={"page_size": 20},
            headers=self.auth_headers,
            catch_response=True,
            name="Load Sample Brands"
        ) as response:
            if response.status_code == 200:
                data = response.json()
                brands = data.get("items", [])
                if brands:
                    self.sample_brand_ids.extend([brand["id"] for brand in brands])
                response.success()
        
        # Get categories
        with self.client.get(
            "/api/categories/",
            params={"page_size": 30},
            headers=self.auth_headers,
            catch_response=True,
            name="Load Sample Categories"
        ) as response:
            if response.status_code == 200:
                data = response.json()
                categories = data.get("items", [])
                if categories:
                    self.sample_category_ids.extend([cat["id"] for cat in categories])
                response.success()
    
    @task(10)
    def list_items(self):
        """Test listing items with various filters - most common operation."""
        params = {"page_size": random.randint(10, 50)}
        
        # Add random filters
        if random.random() < 0.3 and self.sample_brand_ids:
            params["brand_id"] = random.choice(self.sample_brand_ids)
        
        if random.random() < 0.3 and self.sample_category_ids:
            params["category_id"] = random.choice(self.sample_category_ids)
        
        if random.random() < 0.2:
            params["is_rentable"] = random.choice([True, False])
        
        if random.random() < 0.2:
            params["search"] = random.choice(["table", "chair", "light", "sound", "tent"])
        
        with self.client.get(
            "/api/items/",
            params=params,
            headers=self.auth_headers,
            catch_response=True,
            name="List Items"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"List items failed: {response.status_code}")
    
    @task(8)
    def get_item_by_id(self):
        """Test getting individual items by ID."""
        if not self.sample_item_ids:
            return
        
        item_id = random.choice(self.sample_item_ids)
        
        with self.client.get(
            f"/api/items/{item_id}",
            headers=self.auth_headers,
            catch_response=True,
            name="Get Item by ID"
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 404:
                response.failure("Item not found")
            else:
                response.failure(f"Get item failed: {response.status_code}")
    
    @task(5)
    def search_items(self):
        """Test item search functionality."""
        search_terms = [
            "table", "chair", "speaker", "microphone", "tent", "light",
            "professional", "audio", "stage", "event", "wedding", "party"
        ]
        
        search_term = random.choice(search_terms)
        
        with self.client.get(
            f"/api/items/search/{search_term}",
            params={"limit": random.randint(5, 20)},
            headers=self.auth_headers,
            catch_response=True,
            name="Search Items"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Search failed: {response.status_code}")
    
    @task(3)
    def create_item(self):
        """Test creating new items."""
        item_data = self.generate_test_item_data()
        
        with self.client.post(
            "/api/items/",
            json=item_data,
            headers=self.auth_headers,
            catch_response=True,
            name="Create Item"
        ) as response:
            if response.status_code == 201:
                created_item = response.json()
                self.created_items.append(created_item)
                self.sample_item_ids.append(created_item["id"])
                response.success()
            else:
                response.failure(f"Create item failed: {response.status_code}")
    
    @task(2)
    def update_item(self):
        """Test updating existing items."""
        if not self.created_items:
            return
        
        item = random.choice(self.created_items)
        
        update_data = {
            "notes": f"Updated by load test at {random.randint(1000, 9999)}",
            "status": random.choice(["ACTIVE", "INACTIVE"]),
            "reorder_level": random.randint(1, 10)
        }
        
        with self.client.put(
            f"/api/items/{item['id']}",
            json=update_data,
            headers=self.auth_headers,
            catch_response=True,
            name="Update Item"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Update item failed: {response.status_code}")
    
    @task(4)
    def get_rentable_items(self):
        """Test getting rentable items."""
        with self.client.get(
            "/api/items/rentable/",
            params={"limit": random.randint(10, 30)},
            headers=self.auth_headers,
            catch_response=True,
            name="Get Rentable Items"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Get rentable items failed: {response.status_code}")
    
    @task(2)
    def check_item_availability(self):
        """Test checking item availability."""
        if not self.sample_item_ids:
            return
        
        item_id = random.choice(self.sample_item_ids)
        
        with self.client.get(
            f"/api/items/{item_id}/availability",
            params={"quantity_needed": random.randint(1, 5)},
            headers=self.auth_headers,
            catch_response=True,
            name="Check Item Availability"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Check availability failed: {response.status_code}")
    
    @task(1)
    def toggle_rental_status(self):
        """Test toggling rental status."""
        if not self.created_items:
            return
        
        item = random.choice(self.created_items)
        
        status_data = {
            "is_rental_blocked": random.choice([True, False]),
            "remarks": f"Load test block/unblock {random.randint(1000, 9999)}"
        }
        
        with self.client.post(
            f"/api/items/{item['id']}/rental-status",
            json=status_data,
            headers=self.auth_headers,
            catch_response=True,
            name="Toggle Rental Status"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Toggle rental status failed: {response.status_code}")
    
    @task(2)
    def get_item_statistics(self):
        """Test getting item statistics."""
        with self.client.get(
            "/api/items/statistics/",
            headers=self.auth_headers,
            catch_response=True,
            name="Get Item Statistics"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Get statistics failed: {response.status_code}")
    
    @task(1)
    def generate_sku(self):
        """Test SKU generation."""
        params = {}
        
        if self.sample_category_ids and random.random() < 0.5:
            params["category_id"] = random.choice(self.sample_category_ids)
        
        with self.client.post(
            "/api/items/generate-sku/",
            params=params,
            headers=self.auth_headers,
            catch_response=True,
            name="Generate SKU"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Generate SKU failed: {response.status_code}")
    
    @task(1)
    def bulk_operation(self):
        """Test bulk operations on items."""
        if len(self.created_items) < 3:
            return
        
        # Select random items for bulk operation
        items_for_bulk = random.sample(self.created_items, min(3, len(self.created_items)))
        item_ids = [item["id"] for item in items_for_bulk]
        
        bulk_data = {
            "item_ids": item_ids,
            "operation": random.choice(["activate", "deactivate", "update_status"]),
            "status": "ACTIVE"
        }
        
        with self.client.post(
            "/api/items/bulk-operation",
            json=bulk_data,
            headers=self.auth_headers,
            catch_response=True,
            name="Bulk Operation"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Bulk operation failed: {response.status_code}")
    
    def generate_test_item_data(self) -> Dict[str, Any]:
        """Generate test data for creating items."""
        test_number = random.randint(1000, 9999)
        
        item_data = {
            "item_name": f"Load Test Item #{test_number}",
            "sku": f"LT-{test_number}",
            "description": f"Test item created during load testing - {test_number}",
            "short_description": "Load test item for performance testing",
            "is_rentable": random.choice([True, True, False]),  # 2/3 chance of being rentable
            "is_salable": random.choice([True, False]),
            "cost_price": round(random.uniform(10, 500), 2),
            "sale_price": round(random.uniform(50, 1000), 2),
            "rental_rate_per_day": round(random.uniform(5, 100), 2),
            "security_deposit": round(random.uniform(20, 200), 2),
            "weight": round(random.uniform(0.5, 50), 2),
            "color": random.choice(["Black", "White", "Silver", "Blue", "Red"]),
            "material": random.choice(["Metal", "Plastic", "Wood", "Composite"]),
            "status": "ACTIVE",
            "reorder_level": random.randint(1, 10),
            "maximum_stock_level": random.randint(20, 100),
            "notes": f"Load test item created at {test_number}",
            "tags": f"load-test,performance,test-{test_number}"
        }
        
        # Add brand and category if available
        if self.sample_brand_ids:
            item_data["brand_id"] = random.choice(self.sample_brand_ids)
        
        if self.sample_category_ids:
            item_data["category_id"] = random.choice(self.sample_category_ids)
        
        return item_data


class ItemAPIHeavyUser(HttpUser):
    """Heavy user that performs more intensive operations."""
    
    wait_time = between(2, 8)
    weight = 3  # This user type will be 3 times more likely to be chosen
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.auth_token = None
        self.item_ids = []
    
    def on_start(self):
        """Authenticate and load data."""
        self.authenticate()
        self.load_item_ids()
    
    def authenticate(self):
        """Authenticate user."""
        auth_data = {
            "username": "testadmin",
            "password": "TestAdmin123!"
        }
        
        with self.client.post("/api/auth/login", json=auth_data, name="Heavy Auth") as response:
            if response.status_code == 200:
                self.auth_token = response.json().get("access_token")
    
    def load_item_ids(self):
        """Load item IDs for testing."""
        if not self.auth_token:
            return
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        with self.client.get(
            "/api/items/",
            params={"page_size": 100},
            headers=headers,
            name="Heavy Load Items"
        ) as response:
            if response.status_code == 200:
                data = response.json()
                self.item_ids = [item["id"] for item in data.get("items", [])]
    
    @task(5)
    def intensive_search(self):
        """Perform intensive search operations."""
        if not self.auth_token:
            return
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        # Perform multiple searches in sequence
        search_terms = ["professional", "audio", "video", "lighting", "furniture"]
        
        for term in random.sample(search_terms, 3):
            with self.client.get(
                f"/api/items/search/{term}",
                params={"limit": 50},
                headers=headers,
                name="Intensive Search"
            ):
                pass  # Just perform the request
    
    @task(3)
    def bulk_data_operations(self):
        """Perform bulk operations on large datasets."""
        if not self.auth_token or len(self.item_ids) < 10:
            return
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        # Select many items for bulk operation
        selected_items = random.sample(self.item_ids, min(10, len(self.item_ids)))
        
        bulk_data = {
            "item_ids": selected_items,
            "operation": "activate"
        }
        
        with self.client.post(
            "/api/items/bulk-operation",
            json=bulk_data,
            headers=headers,
            name="Heavy Bulk Operation"
        ):
            pass
    
    @task(2)
    def complex_filtering(self):
        """Perform complex filtering operations."""
        if not self.auth_token:
            return
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        # Complex query with multiple filters
        params = {
            "page_size": 50,
            "is_rentable": True,
            "is_active": True,
            "min_sale_price": random.randint(50, 200),
            "max_sale_price": random.randint(300, 800),
            "search": random.choice(["professional", "premium", "standard"]),
            "sort_field": random.choice(["item_name", "sale_price", "created_at"]),
            "sort_direction": random.choice(["asc", "desc"])
        }
        
        with self.client.get(
            "/api/items/",
            params=params,
            headers=headers,
            name="Complex Filtering"
        ):
            pass


# Configure the test users
class ItemPerformanceTest(HttpUser):
    """Main test user class with mixed workload."""
    
    # Mix of user types for realistic load
    tasks = {
        ItemAPIUser: 7,  # 70% normal users
        ItemAPIHeavyUser: 3  # 30% heavy users
    }
    
    wait_time = between(1, 3)  # Faster pace for performance testing