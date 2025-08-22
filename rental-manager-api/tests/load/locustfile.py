"""
Load testing scenarios for Brand API using Locust
"""

import random
import json
from locust import HttpUser, task, between
from locust.exception import RescheduleTask


class BrandAPIUser(HttpUser):
    """Simulates a user interacting with the Brand API."""
    
    wait_time = between(1, 3)  # Wait 1-3 seconds between tasks
    
    def on_start(self):
        """Called when a user starts."""
        self.brand_ids = []
        self.search_terms = [
            "Construction", "Power", "Equipment", "Tool", "Industrial",
            "Professional", "Heavy", "Compact", "Advanced", "Premium",
            "Audio", "Kitchen", "Event", "Safety", "Transportation"
        ]
        
        # Populate brand_ids by fetching some brands
        try:
            response = self.client.get("/api/v1/brands/?page=1&page_size=50")
            if response.status_code == 200:
                data = response.json()
                self.brand_ids = [item["id"] for item in data["items"]]
        except Exception:
            pass  # Continue without brand_ids if this fails
    
    @task(30)
    def list_brands(self):
        """Test listing brands with pagination."""
        page = random.randint(1, 10)
        page_size = random.choice([10, 20, 50, 100])
        
        params = {
            "page": page,
            "page_size": page_size
        }
        
        # Sometimes add filters
        if random.random() < 0.3:
            params["is_active"] = random.choice([True, False])
        
        if random.random() < 0.2:
            params["name"] = random.choice(["Pro", "Max", "Elite", "Power"])
        
        with self.client.get("/api/v1/brands/", params=params, catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                if len(data["items"]) > 0:
                    response.success()
                else:
                    response.failure("No brands returned")
            else:
                response.failure(f"Status code: {response.status_code}")
    
    @task(20)
    def search_brands(self):
        """Test searching brands."""
        search_term = random.choice(self.search_terms)
        limit = random.choice([10, 25, 50])
        
        params = {
            "q": search_term,
            "limit": limit,
            "include_inactive": random.choice([True, False])
        }
        
        with self.client.get("/api/v1/brands/search/", params=params, catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                response.success()
            else:
                response.failure(f"Search failed: {response.status_code}")
    
    @task(15)
    def get_brand_by_id(self):
        """Test getting a specific brand by ID."""
        if not self.brand_ids:
            raise RescheduleTask()
        
        brand_id = random.choice(self.brand_ids)
        
        with self.client.get(f"/api/v1/brands/{brand_id}", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 404:
                # Brand might have been deleted, remove from our list
                if brand_id in self.brand_ids:
                    self.brand_ids.remove(brand_id)
                response.failure("Brand not found")
            else:
                response.failure(f"Unexpected status: {response.status_code}")
    
    @task(10)
    def create_brand(self):
        """Test creating a new brand."""
        brand_name = f"Load Test Brand {random.randint(1000, 9999)}"
        brand_code = f"LT{random.randint(100, 999)}"
        
        brand_data = {
            "name": brand_name,
            "code": brand_code,
            "description": f"Load test brand created at {random.randint(1000, 9999)}",
            "is_active": True
        }
        
        with self.client.post("/api/v1/brands/", json=brand_data, catch_response=True) as response:
            if response.status_code == 201:
                data = response.json()
                # Add new brand ID to our list
                self.brand_ids.append(data["id"])
                response.success()
            elif response.status_code == 409:
                # Conflict - brand already exists
                response.failure("Brand conflict")
            else:
                response.failure(f"Creation failed: {response.status_code}")
    
    @task(8)
    def update_brand(self):
        """Test updating a brand."""
        if not self.brand_ids:
            raise RescheduleTask()
        
        brand_id = random.choice(self.brand_ids)
        
        update_data = {
            "description": f"Updated description at {random.randint(1000, 9999)}"
        }
        
        # Sometimes update other fields
        if random.random() < 0.3:
            update_data["name"] = f"Updated Brand {random.randint(1000, 9999)}"
        
        with self.client.put(f"/api/v1/brands/{brand_id}", json=update_data, catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 404:
                # Brand not found, remove from list
                if brand_id in self.brand_ids:
                    self.brand_ids.remove(brand_id)
                response.failure("Brand not found")
            else:
                response.failure(f"Update failed: {response.status_code}")
    
    @task(5)
    def get_active_brands(self):
        """Test getting active brands."""
        with self.client.get("/api/v1/brands/active/", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Failed to get active brands: {response.status_code}")
    
    @task(3)
    def get_brand_statistics(self):
        """Test getting brand statistics."""
        with self.client.get("/api/v1/brands/stats/", catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                if "total_brands" in data:
                    response.success()
                else:
                    response.failure("Invalid statistics response")
            else:
                response.failure(f"Statistics failed: {response.status_code}")
    
    @task(2)
    def activate_deactivate_brand(self):
        """Test activating/deactivating brands."""
        if not self.brand_ids:
            raise RescheduleTask()
        
        brand_id = random.choice(self.brand_ids)
        action = random.choice(["activate", "deactivate"])
        
        with self.client.post(f"/api/v1/brands/{brand_id}/{action}", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 404:
                if brand_id in self.brand_ids:
                    self.brand_ids.remove(brand_id)
                response.failure("Brand not found")
            else:
                response.failure(f"{action} failed: {response.status_code}")
    
    @task(1)
    def bulk_operations(self):
        """Test bulk operations."""
        if len(self.brand_ids) < 5:
            raise RescheduleTask()
        
        # Select a subset of brand IDs for bulk operation
        selected_ids = random.sample(self.brand_ids, min(5, len(self.brand_ids)))
        operation = random.choice(["activate", "deactivate"])
        
        bulk_data = {
            "brand_ids": selected_ids,
            "operation": operation
        }
        
        with self.client.post("/api/v1/brands/bulk", json=bulk_data, catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                if data.get("success_count", 0) > 0:
                    response.success()
                else:
                    response.failure("No successful bulk operations")
            else:
                response.failure(f"Bulk operation failed: {response.status_code}")


class HeavyBrandUser(HttpUser):
    """Heavy user that performs more intensive operations."""
    
    wait_time = between(2, 5)
    weight = 1  # Lower weight = fewer of these users
    
    @task(40)
    def export_brands(self):
        """Test exporting brands."""
        params = {
            "include_inactive": random.choice([True, False])
        }
        
        with self.client.get("/api/v1/brands/export/", params=params, catch_response=True) as response:
            if response.status_code == 200:
                # Check response size
                content_length = len(response.content)
                if content_length > 1000:  # Expect substantial data
                    response.success()
                else:
                    response.failure("Export too small")
            else:
                response.failure(f"Export failed: {response.status_code}")
    
    @task(30)
    def large_pagination(self):
        """Test large pagination requests."""
        page = random.randint(1, 100)
        page_size = random.choice([100, 200])  # Larger page sizes
        
        params = {
            "page": page,
            "page_size": page_size,
            "sort_field": random.choice(["name", "created_at", "updated_at"]),
            "sort_direction": random.choice(["asc", "desc"])
        }
        
        with self.client.get("/api/v1/brands/", params=params, catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Large pagination failed: {response.status_code}")
    
    @task(20)
    def complex_search(self):
        """Test complex search operations."""
        # Combine multiple search criteria
        search_term = random.choice(["Equipment", "Tool", "System", "Machine"])
        
        params = {
            "page": 1,
            "page_size": 100,
            "search": search_term,
            "is_active": True,
            "sort_field": "name",
            "sort_direction": "asc"
        }
        
        with self.client.get("/api/v1/brands/", params=params, catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                response.success()
            else:
                response.failure(f"Complex search failed: {response.status_code}")
    
    @task(10)
    def import_brands(self):
        """Test importing brands."""
        import_data = []
        
        for i in range(random.randint(3, 10)):
            import_data.append({
                "name": f"Import Brand {random.randint(10000, 99999)}",
                "code": f"IMP{random.randint(1000, 9999)}",
                "description": f"Imported brand {i}",
                "is_active": random.choice([True, False])
            })
        
        with self.client.post("/api/v1/brands/import", json=import_data, catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                if data.get("successful_imports", 0) > 0:
                    response.success()
                else:
                    response.failure("No successful imports")
            else:
                response.failure(f"Import failed: {response.status_code}")


class ReadOnlyUser(HttpUser):
    """User that only performs read operations."""
    
    wait_time = between(0.5, 2)
    weight = 3  # Higher weight = more of these users
    
    def on_start(self):
        """Initialize read-only user."""
        self.search_terms = [
            "Construction", "Power", "Equipment", "Tool", "Industrial",
            "Audio", "Kitchen", "Event", "Safety", "Transportation"
        ]
    
    @task(50)
    def browse_brands(self):
        """Browse brands with different pagination."""
        page = random.randint(1, 50)
        page_size = random.choice([20, 50])
        
        with self.client.get(f"/api/v1/brands/?page={page}&page_size={page_size}"):
            pass
    
    @task(30)
    def search_browse(self):
        """Search and browse results."""
        search_term = random.choice(self.search_terms)
        
        with self.client.get(f"/api/v1/brands/search/?q={search_term}&limit=25"):
            pass
    
    @task(15)
    def view_statistics(self):
        """View brand statistics."""
        with self.client.get("/api/v1/brands/stats/"):
            pass
    
    @task(5)
    def view_active_brands(self):
        """View active brands."""
        with self.client.get("/api/v1/brands/active/"):
            pass