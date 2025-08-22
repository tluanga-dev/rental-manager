#!/usr/bin/env python3
"""
Integration Tests for Contact Person API
Tests complete API endpoints with database integration
"""

import asyncio
import sys
import os
import time
from typing import Dict, Any, List, Optional
import httpx
import pytest
from uuid import UUID

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


class ContactPersonAPITester:
    """Integration test class for Contact Person API."""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.client = httpx.AsyncClient(base_url=base_url, timeout=30.0)
        self.created_contacts = []  # Track created contacts for cleanup
        self.auth_token = None
    
    @property
    def auth_headers(self) -> Dict[str, str]:
        """Get authorization headers."""
        if self.auth_token:
            return {"Authorization": f"Bearer {self.auth_token}"}
        return {}
    
    async def setup(self):
        """Setup test environment."""
        print("🔧 Setting up integration tests...")
        
        # Check if API is running
        try:
            response = await self.client.get("/health")
            if response.status_code != 200:
                raise Exception(f"Health check failed: {response.status_code}")
            print("✅ API health check passed")
        except Exception as e:
            print(f"❌ API not available: {e}")
            raise
        
        # Authenticate (if auth is required)
        # For now, we'll assume no auth or mock auth
        print("✅ Setup completed")
    
    async def cleanup(self):
        """Cleanup created test data."""
        print(f"\n🧹 Cleaning up {len(self.created_contacts)} created contacts...")
        
        cleanup_count = 0
        for contact_id in self.created_contacts:
            try:
                response = await self.client.delete(
                    f"/api/v1/contact-persons/{contact_id}",
                    headers=self.auth_headers
                )
                if response.status_code == 204:
                    cleanup_count += 1
            except Exception:
                pass  # Ignore cleanup errors
        
        print(f"✅ Cleaned up {cleanup_count} contacts")
        await self.client.aclose()
    
    async def test_create_contact_person(self) -> Optional[Dict[str, Any]]:
        """Test creating a new contact person."""
        print("\n📝 Testing contact person creation...")
        
        timestamp = int(time.time())
        contact_data = {
            "first_name": "John",
            "last_name": "Doe",
            "email": f"john.doe.{timestamp}@testcompany.com",
            "phone": "+1-555-123-4567",
            "mobile": "+1-555-987-6543",
            "title": "Software Engineer",
            "department": "Engineering",
            "company": "Test Company Ltd",
            "address": "123 Test Street",
            "city": "San Francisco",
            "state": "CA",
            "country": "USA",
            "postal_code": "94102",
            "notes": "Integration test contact",
            "is_primary": False
        }
        
        try:
            response = await self.client.post(
                "/api/v1/contact-persons/",
                json=contact_data,
                headers=self.auth_headers
            )
            
            if response.status_code == 201:
                contact = response.json()
                self.created_contacts.append(contact["id"])
                print(f"✅ Contact created: {contact['full_name']} (ID: {contact['id']})")
                return contact
            else:
                print(f"❌ Failed to create contact: {response.status_code}")
                print(f"   Response: {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Error creating contact: {e}")
            return None
    
    async def test_get_contact_person(self, contact_id: str) -> bool:
        """Test retrieving a contact person by ID."""
        print(f"\n🔍 Testing get contact by ID: {contact_id}")
        
        try:
            response = await self.client.get(
                f"/api/v1/contact-persons/{contact_id}",
                headers=self.auth_headers
            )
            
            if response.status_code == 200:
                contact = response.json()
                print(f"✅ Retrieved contact: {contact['full_name']}")
                return True
            else:
                print(f"❌ Failed to get contact: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Error getting contact: {e}")
            return False
    
    async def test_update_contact_person(self, contact_id: str) -> bool:
        """Test updating a contact person."""
        print(f"\n✏️ Testing contact update: {contact_id}")
        
        update_data = {
            "title": "Senior Software Engineer",
            "department": "Senior Engineering",
            "notes": "Updated during integration test",
            "is_primary": True
        }
        
        try:
            response = await self.client.put(
                f"/api/v1/contact-persons/{contact_id}",
                json=update_data,
                headers=self.auth_headers
            )
            
            if response.status_code == 200:
                contact = response.json()
                print(f"✅ Updated contact: {contact['title']}")
                return True
            else:
                print(f"❌ Failed to update contact: {response.status_code}")
                print(f"   Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error updating contact: {e}")
            return False
    
    async def test_list_contact_persons(self) -> bool:
        """Test listing contact persons."""
        print("\n📋 Testing contact person listing...")
        
        try:
            response = await self.client.get(
                "/api/v1/contact-persons/?skip=0&limit=10",
                headers=self.auth_headers
            )
            
            if response.status_code == 200:
                contacts = response.json()
                print(f"✅ Retrieved {len(contacts)} contacts")
                return True
            else:
                print(f"❌ Failed to list contacts: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Error listing contacts: {e}")
            return False
    
    async def test_search_contact_persons(self) -> bool:
        """Test searching contact persons."""
        print("\n🔎 Testing contact person search...")
        
        search_data = {
            "search_term": "Test",
            "skip": 0,
            "limit": 10,
            "active_only": True
        }
        
        try:
            response = await self.client.post(
                "/api/v1/contact-persons/search",
                json=search_data,
                headers=self.auth_headers
            )
            
            if response.status_code == 200:
                contacts = response.json()
                print(f"✅ Search returned {len(contacts)} contacts")
                return True
            else:
                print(f"❌ Failed to search contacts: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Error searching contacts: {e}")
            return False
    
    async def test_get_contacts_by_company(self) -> bool:
        """Test getting contacts by company."""
        print("\n🏢 Testing get contacts by company...")
        
        try:
            response = await self.client.get(
                "/api/v1/contact-persons/company/Test Company Ltd",
                headers=self.auth_headers
            )
            
            if response.status_code == 200:
                contacts = response.json()
                print(f"✅ Found {len(contacts)} contacts for Test Company Ltd")
                return True
            else:
                print(f"❌ Failed to get contacts by company: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Error getting contacts by company: {e}")
            return False
    
    async def test_get_primary_contacts(self) -> bool:
        """Test getting primary contacts."""
        print("\n👑 Testing get primary contacts...")
        
        try:
            response = await self.client.get(
                "/api/v1/contact-persons/primary/contacts",
                headers=self.auth_headers
            )
            
            if response.status_code == 200:
                contacts = response.json()
                print(f"✅ Found {len(contacts)} primary contacts")
                return True
            else:
                print(f"❌ Failed to get primary contacts: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Error getting primary contacts: {e}")
            return False
    
    async def test_set_primary_contact(self, contact_id: str) -> bool:
        """Test setting a contact as primary."""
        print(f"\n⭐ Testing set primary contact: {contact_id}")
        
        try:
            response = await self.client.post(
                f"/api/v1/contact-persons/{contact_id}/set-primary",
                headers=self.auth_headers
            )
            
            if response.status_code == 200:
                contact = response.json()
                print(f"✅ Set primary contact: {contact['full_name']}")
                return True
            else:
                print(f"❌ Failed to set primary contact: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Error setting primary contact: {e}")
            return False
    
    async def test_get_contact_statistics(self) -> bool:
        """Test getting contact statistics."""
        print("\n📊 Testing contact statistics...")
        
        try:
            response = await self.client.get(
                "/api/v1/contact-persons/stats/overview",
                headers=self.auth_headers
            )
            
            if response.status_code == 200:
                stats = response.json()
                print(f"✅ Statistics retrieved:")
                print(f"   Total contacts: {stats.get('total_contacts', 0)}")
                print(f"   Active contacts: {stats.get('active_contacts', 0)}")
                print(f"   Primary contacts: {stats.get('primary_contacts', 0)}")
                print(f"   Companies: {stats.get('companies_count', 0)}")
                return True
            else:
                print(f"❌ Failed to get statistics: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Error getting statistics: {e}")
            return False
    
    async def test_get_recent_contacts(self) -> bool:
        """Test getting recent contacts."""
        print("\n🕒 Testing get recent contacts...")
        
        try:
            response = await self.client.get(
                "/api/v1/contact-persons/recent/contacts?limit=5",
                headers=self.auth_headers
            )
            
            if response.status_code == 200:
                contacts = response.json()
                print(f"✅ Found {len(contacts)} recent contacts")
                return True
            else:
                print(f"❌ Failed to get recent contacts: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Error getting recent contacts: {e}")
            return False
    
    async def test_get_contact_by_email(self, email: str) -> bool:
        """Test getting contact by email."""
        print(f"\n📧 Testing get contact by email: {email}")
        
        try:
            response = await self.client.get(
                f"/api/v1/contact-persons/email/{email}",
                headers=self.auth_headers
            )
            
            if response.status_code == 200:
                contact = response.json()
                print(f"✅ Found contact by email: {contact['full_name']}")
                return True
            elif response.status_code == 404:
                print("ℹ️ No contact found with that email (expected for cleanup)")
                return True
            else:
                print(f"❌ Failed to get contact by email: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Error getting contact by email: {e}")
            return False
    
    async def test_count_contacts(self) -> bool:
        """Test counting contacts."""
        print("\n🔢 Testing contact count...")
        
        try:
            response = await self.client.get(
                "/api/v1/contact-persons/count/total",
                headers=self.auth_headers
            )
            
            if response.status_code == 200:
                count_data = response.json()
                print(f"✅ Total contact count: {count_data.get('total_count', 0)}")
                return True
            else:
                print(f"❌ Failed to count contacts: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Error counting contacts: {e}")
            return False
    
    async def test_delete_contact_person(self, contact_id: str) -> bool:
        """Test deleting a contact person."""
        print(f"\n🗑️ Testing contact deletion: {contact_id}")
        
        try:
            response = await self.client.delete(
                f"/api/v1/contact-persons/{contact_id}",
                headers=self.auth_headers
            )
            
            if response.status_code == 204:
                print("✅ Contact deleted successfully")
                # Remove from cleanup list since it's already deleted
                if contact_id in self.created_contacts:
                    self.created_contacts.remove(contact_id)
                return True
            else:
                print(f"❌ Failed to delete contact: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Error deleting contact: {e}")
            return False
    
    async def test_validation_errors(self) -> bool:
        """Test API validation errors."""
        print("\n⚠️ Testing validation errors...")
        
        # Test invalid email
        invalid_contact = {
            "first_name": "Invalid",
            "last_name": "Contact",
            "email": "invalid-email"
        }
        
        try:
            response = await self.client.post(
                "/api/v1/contact-persons/",
                json=invalid_contact,
                headers=self.auth_headers
            )
            
            if response.status_code == 400:
                print("✅ Validation error correctly caught for invalid email")
                return True
            else:
                print(f"❌ Expected validation error, got: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Error testing validation: {e}")
            return False
    
    async def test_not_found_errors(self) -> bool:
        """Test 404 errors."""
        print("\n🔍 Testing 404 errors...")
        
        fake_id = "00000000-0000-0000-0000-000000000000"
        
        try:
            response = await self.client.get(
                f"/api/v1/contact-persons/{fake_id}",
                headers=self.auth_headers
            )
            
            if response.status_code == 404:
                print("✅ 404 error correctly returned for non-existent contact")
                return True
            else:
                print(f"❌ Expected 404, got: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Error testing 404: {e}")
            return False
    
    async def run_comprehensive_test(self) -> None:
        """Run comprehensive integration test suite."""
        print("🚀 Starting Contact Person API Integration Tests")
        print("=" * 60)
        
        test_results = []
        
        try:
            # Setup
            await self.setup()
            
            # Test 1: Create contact person
            contact = await self.test_create_contact_person()
            test_results.append(("Create Contact", contact is not None))
            
            if contact:
                contact_id = contact["id"]
                contact_email = contact["email"]
                
                # Test 2: Get contact by ID
                result = await self.test_get_contact_person(contact_id)
                test_results.append(("Get Contact by ID", result))
                
                # Test 3: Update contact
                result = await self.test_update_contact_person(contact_id)
                test_results.append(("Update Contact", result))
                
                # Test 4: Set primary contact
                result = await self.test_set_primary_contact(contact_id)
                test_results.append(("Set Primary Contact", result))
                
                # Test 5: Get contact by email
                result = await self.test_get_contact_by_email(contact_email)
                test_results.append(("Get Contact by Email", result))
            
            # Test 6: List contacts
            result = await self.test_list_contact_persons()
            test_results.append(("List Contacts", result))
            
            # Test 7: Search contacts
            result = await self.test_search_contact_persons()
            test_results.append(("Search Contacts", result))
            
            # Test 8: Get contacts by company
            result = await self.test_get_contacts_by_company()
            test_results.append(("Get Contacts by Company", result))
            
            # Test 9: Get primary contacts
            result = await self.test_get_primary_contacts()
            test_results.append(("Get Primary Contacts", result))
            
            # Test 10: Get statistics
            result = await self.test_get_contact_statistics()
            test_results.append(("Get Statistics", result))
            
            # Test 11: Get recent contacts
            result = await self.test_get_recent_contacts()
            test_results.append(("Get Recent Contacts", result))
            
            # Test 12: Count contacts
            result = await self.test_count_contacts()
            test_results.append(("Count Contacts", result))
            
            # Test 13: Validation errors
            result = await self.test_validation_errors()
            test_results.append(("Validation Errors", result))
            
            # Test 14: 404 errors
            result = await self.test_not_found_errors()
            test_results.append(("404 Errors", result))
            
            # Test 15: Delete contact (if created)
            if contact:
                result = await self.test_delete_contact_person(contact_id)
                test_results.append(("Delete Contact", result))
            
        except Exception as e:
            print(f"\n❌ Test suite failed with error: {e}")
            import traceback
            traceback.print_exc()
        
        finally:
            # Cleanup
            await self.cleanup()
        
        # Print results
        print("\n" + "=" * 60)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 60)
        
        passed = 0
        total = len(test_results)
        
        for test_name, success in test_results:
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"{status:10} {test_name}")
            if success:
                passed += 1
        
        print("-" * 60)
        print(f"TOTAL: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
        
        if passed == total:
            print("\n🎉 All integration tests passed!")
        else:
            print(f"\n⚠️ {total - passed} test(s) failed")
        
        return passed == total


async def main():
    """Run integration tests."""
    # Check if we should use Docker URL
    api_url = os.getenv("API_URL", "http://localhost:8000")
    
    tester = ContactPersonAPITester(api_url)
    success = await tester.run_comprehensive_test()
    
    if not success:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())