"""Locust load testing for Unit of Measurement API."""

from locust import HttpUser, task, between
import random
import string
import json


class UnitOfMeasurementUser(HttpUser):
    """Simulated user for Unit of Measurement operations."""
    
    wait_time = between(1, 3)
    
    def on_start(self):
        """Authenticate and set up session."""
        # Login to get token
        response = self.client.post(
            "/api/v1/auth/login",
            data={
                "username": "admin",
                "password": "Admin123!"
            }
        )
        
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            print(f"Authentication failed: {response.status_code}")
            self.headers = {}
        
        # Store created unit IDs for update/delete operations
        self.created_units = []
    
    @task(10)
    def list_units(self):
        """List units with pagination."""
        page = random.randint(1, 10)
        page_size = random.choice([10, 20, 50])
        
        self.client.get(
            "/api/v1/unit-of-measurement/",
            params={
                "page": page,
                "page_size": page_size
            },
            headers=self.headers,
            name="/unit-of-measurement/ (list)"
        )
    
    @task(8)
    def search_units(self):
        """Search for units."""
        search_terms = ["meter", "gram", "piece", "liter", "hour", "dollar", "watt"]
        search_term = random.choice(search_terms)
        
        self.client.get(
            "/api/v1/unit-of-measurement/search/",
            params={
                "q": search_term,
                "limit": 20
            },
            headers=self.headers,
            name="/unit-of-measurement/search/ (search)"
        )
    
    @task(5)
    def filter_units(self):
        """Filter units by various criteria."""
        filters = [
            {"name": "meter"},
            {"code": "KG"},
            {"is_active": True},
            {"search": "weight"}
        ]
        
        filter_params = random.choice(filters)
        
        self.client.get(
            "/api/v1/unit-of-measurement/",
            params=filter_params,
            headers=self.headers,
            name="/unit-of-measurement/ (filter)"
        )
    
    @task(3)
    def create_unit(self):
        """Create a new unit."""
        suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        
        unit_data = {
            "name": f"Test Unit {suffix}",
            "code": suffix[:3],
            "description": f"Load test unit {suffix}"
        }
        
        response = self.client.post(
            "/api/v1/unit-of-measurement/",
            json=unit_data,
            headers=self.headers,
            name="/unit-of-measurement/ (create)"
        )
        
        if response.status_code == 201:
            unit = response.json()
            self.created_units.append(unit["id"])
            # Keep list manageable
            if len(self.created_units) > 50:
                self.created_units = self.created_units[-50:]
    
    @task(2)
    def get_unit(self):
        """Get a specific unit."""
        if self.created_units:
            unit_id = random.choice(self.created_units)
            
            self.client.get(
                f"/api/v1/unit-of-measurement/{unit_id}",
                headers=self.headers,
                name="/unit-of-measurement/{id} (get)"
            )
    
    @task(2)
    def update_unit(self):
        """Update an existing unit."""
        if self.created_units:
            unit_id = random.choice(self.created_units)
            
            update_data = {
                "description": f"Updated at {random.randint(1000, 9999)}"
            }
            
            self.client.put(
                f"/api/v1/unit-of-measurement/{unit_id}",
                json=update_data,
                headers=self.headers,
                name="/unit-of-measurement/{id} (update)"
            )
    
    @task(1)
    def delete_unit(self):
        """Delete (deactivate) a unit."""
        if self.created_units:
            unit_id = random.choice(self.created_units)
            
            response = self.client.delete(
                f"/api/v1/unit-of-measurement/{unit_id}",
                headers=self.headers,
                name="/unit-of-measurement/{id} (delete)"
            )
            
            if response.status_code == 204:
                self.created_units.remove(unit_id)
    
    @task(4)
    def get_active_units(self):
        """Get all active units."""
        self.client.get(
            "/api/v1/unit-of-measurement/active/",
            headers=self.headers,
            name="/unit-of-measurement/active/ (get)"
        )
    
    @task(2)
    def get_statistics(self):
        """Get unit statistics."""
        self.client.get(
            "/api/v1/unit-of-measurement/stats/",
            headers=self.headers,
            name="/unit-of-measurement/stats/ (get)"
        )
    
    @task(1)
    def bulk_operation(self):
        """Perform bulk operations."""
        if len(self.created_units) >= 5:
            selected_units = random.sample(self.created_units, 5)
            operation = random.choice(["activate", "deactivate"])
            
            self.client.post(
                "/api/v1/unit-of-measurement/bulk-operation",
                json={
                    "unit_ids": selected_units,
                    "operation": operation
                },
                headers=self.headers,
                name="/unit-of-measurement/bulk-operation (post)"
            )


class AdminUser(HttpUser):
    """Simulated admin user for management operations."""
    
    wait_time = between(5, 10)
    
    def on_start(self):
        """Authenticate as admin."""
        response = self.client.post(
            "/api/v1/auth/login",
            data={
                "username": "admin",
                "password": "Admin123!"
            }
        )
        
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            self.headers = {}
    
    @task(3)
    def export_units(self):
        """Export all units."""
        self.client.get(
            "/api/v1/unit-of-measurement/export/",
            params={"include_inactive": False},
            headers=self.headers,
            name="/unit-of-measurement/export/ (get)"
        )
    
    @task(1)
    def import_units(self):
        """Import units."""
        import_data = []
        for i in range(random.randint(2, 5)):
            suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
            import_data.append({
                "name": f"Import Unit {suffix}",
                "code": f"I{suffix[:3]}",
                "description": f"Imported unit {suffix}",
                "is_active": True
            })
        
        self.client.post(
            "/api/v1/unit-of-measurement/import/",
            json=import_data,
            headers=self.headers,
            name="/unit-of-measurement/import/ (post)"
        )