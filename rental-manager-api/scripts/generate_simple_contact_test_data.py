#!/usr/bin/env python3
"""
Simple Contact Persons Test Data Generator (no external dependencies)
Generates contact persons with 4-tier categorization for comprehensive testing
"""

import asyncio
import sys
import os
from typing import List, Dict, Any
import random
from datetime import datetime

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_async_session_direct
from app.services.contact_person import ContactPersonService
from app.schemas.contact_person import ContactPersonCreate


class SimpleContactPersonDataGenerator:
    """Generate contact person test data without external dependencies."""
    
    def __init__(self):
        # 4-tier categorization system
        self.contact_tiers = {
            "Primary": {
                "weight": 15,  # 15% of contacts
                "titles": ["CEO", "President", "Director", "VP", "General Manager", "Owner"],
                "is_primary": True,
                "departments": ["Executive", "Management", "Administration"]
            },
            "Secondary": {
                "weight": 25,  # 25% of contacts
                "titles": ["Manager", "Supervisor", "Team Lead", "Senior Analyst", "Coordinator"],
                "is_primary": False,
                "departments": ["Operations", "Sales", "Marketing", "Finance", "HR"]
            },
            "Emergency": {
                "weight": 20,  # 20% of contacts
                "titles": ["Emergency Contact", "After Hours Contact", "Security", "Facility Manager"],
                "is_primary": False,
                "departments": ["Security", "Facilities", "Emergency Response", "Maintenance"]
            },
            "Other": {
                "weight": 40,  # 40% of contacts
                "titles": ["Assistant", "Clerk", "Technician", "Specialist", "Representative"],
                "is_primary": False,
                "departments": ["IT", "Customer Service", "Support", "Technical", "Admin"]
            }
        }
        
        # Sample data
        self.first_names = [
            "John", "Jane", "Michael", "Sarah", "David", "Emily", "Chris", "Anna",
            "Robert", "Lisa", "Mark", "Jennifer", "Paul", "Susan", "Kevin", "Laura",
            "James", "Mary", "William", "Patricia", "Richard", "Linda", "Joseph", "Barbara",
            "Thomas", "Elizabeth", "Charles", "Helen", "Daniel", "Nancy", "Matthew", "Betty"
        ]
        
        self.last_names = [
            "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
            "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
            "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
            "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez"
        ]
        
        self.companies = [
            "TechCorp Solutions Inc", "Global Industries LLC", "Innovation Labs Co", 
            "Digital Dynamics Corp", "Future Systems Ltd", "Alpha Technologies Inc",
            "Beta Enterprises LLC", "Gamma Networks Corp", "Delta Services Inc", "Omega Corp Ltd",
            "Prime Tech Solutions", "Advanced Systems Corp", "Elite Technologies Inc",
            "Superior Networks LLC", "Optimal Solutions Corp", "Dynamic Enterprises Inc"
        ]
        
        self.cities = [
            "San Francisco", "New York", "Los Angeles", "Chicago", "Austin", "Seattle",
            "Boston", "Denver", "Portland", "Atlanta", "Miami", "Phoenix", "Dallas",
            "Houston", "Philadelphia", "San Diego", "Las Vegas", "Minneapolis"
        ]
        
        self.states = ["CA", "NY", "TX", "IL", "WA", "MA", "CO", "OR", "GA", "FL", "AZ", "PA", "NV", "MN"]
        
        self.generated_emails = set()  # Track generated emails to ensure uniqueness
    
    def generate_unique_email(self, first_name: str, last_name: str, company: str, index: int) -> str:
        """Generate a unique email address."""
        # Simple email generation
        company_domain = company.lower().replace(" ", "").replace(",", "").replace(".", "")
        for suffix in ["inc", "llc", "corp", "ltd", "co"]:
            company_domain = company_domain.replace(suffix, "")
        
        email_formats = [
            f"{first_name.lower()}.{last_name.lower()}",
            f"{first_name.lower()}{last_name.lower()}",
            f"{first_name[0].lower()}{last_name.lower()}",
            f"{first_name.lower()}.{last_name[0].lower()}",
            f"{first_name.lower()}{index}"
        ]
        
        for email_format in email_formats:
            email = f"{email_format}@{company_domain}.com"
            if email not in self.generated_emails:
                self.generated_emails.add(email)
                return email
        
        # Fallback
        email = f"{first_name.lower()}{last_name.lower()}{index}@{company_domain}.com"
        self.generated_emails.add(email)
        return email
    
    def determine_contact_tier(self) -> str:
        """Randomly determine contact tier based on weights."""
        rand = random.randint(1, 100)
        
        cumulative = 0
        for tier, config in self.contact_tiers.items():
            cumulative += config["weight"]
            if rand <= cumulative:
                return tier
        
        return "Other"  # Fallback
    
    def generate_phone_number(self) -> str:
        """Generate a realistic phone number."""
        return f"+1-{random.randint(200, 999)}-{random.randint(200, 999)}-{random.randint(1000, 9999)}"
    
    def generate_postal_code(self) -> str:
        """Generate a postal code."""
        return f"{random.randint(10000, 99999)}"
    
    def generate_contact_person(self, index: int) -> ContactPersonCreate:
        """Generate a single realistic contact person."""
        # Determine tier and get config
        tier = self.determine_contact_tier()
        tier_config = self.contact_tiers[tier]
        
        # Basic information
        first_name = random.choice(self.first_names)
        last_name = random.choice(self.last_names)
        company = random.choice(self.companies)
        
        # Professional information
        title = random.choice(tier_config["titles"])
        department = random.choice(tier_config["departments"])
        
        # Contact information
        city = random.choice(self.cities)
        state = random.choice(self.states)
        
        # Generate unique email
        email = self.generate_unique_email(first_name, last_name, company, index)
        
        # Phone numbers (85% have phone, 70% have mobile)
        phone = self.generate_phone_number() if random.random() < 0.85 else None
        mobile = self.generate_phone_number() if random.random() < 0.70 else None
        
        # Address information
        address = f"{random.randint(100, 9999)} {random.choice(['Main St', 'Oak Ave', 'First St', 'Park Blvd'])}"
        postal_code = self.generate_postal_code()
        
        # Additional information
        notes = None
        if random.random() < 0.30:  # 30% have notes
            note_templates = [
                f"Preferred contact hours: {random.choice(['9-5', '10-6', '8-4', 'flexible'])}",
                f"Best reached via: {random.choice(['email', 'phone', 'mobile', 'any method'])}",
                f"Role focus: {random.choice(['procurement', 'technical decisions', 'billing', 'operations'])}",
                "Primary decision maker for technical purchases",
                "Escalation contact for urgent matters"
            ]
            notes = random.choice(note_templates)
        
        return ContactPersonCreate(
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone=phone,
            mobile=mobile,
            title=title,
            department=department,
            company=company,
            address=address,
            city=city,
            state=state,
            country="USA",
            postal_code=postal_code,
            notes=notes,
            is_primary=tier_config["is_primary"] and random.random() < 0.3  # Only some primary tier contacts are actually primary
        )
    
    async def generate_all_contacts(self, total_contacts: int = 1000) -> List[ContactPersonCreate]:
        """Generate all contact persons with proper distribution."""
        print(f"🎲 Generating {total_contacts} contact persons with 4-tier categorization...")
        
        contacts = []
        
        # Track tier distribution for reporting
        tier_counts = {tier: 0 for tier in self.contact_tiers.keys()}
        
        for i in range(total_contacts):
            if i % 100 == 0:
                print(f"   Generated {i}/{total_contacts} contacts...")
            
            contact = self.generate_contact_person(i)
            contacts.append(contact)
            
            # Track tier for the report (approximate)
            tier = self.determine_contact_tier()
            tier_counts[tier] += 1
        
        # Print distribution report
        print("\n📈 Contact Distribution by Tier:")
        for tier, count in tier_counts.items():
            percentage = (count / total_contacts) * 100
            print(f"   {tier}: {count} contacts ({percentage:.1f}%)")
        
        print(f"\n✅ Generated {total_contacts} unique contact persons across {len(self.companies)} companies")
        return contacts


async def main():
    """Main function to generate and insert test data."""
    print("🚀 Starting Contact Persons Test Data Generation")
    print("=" * 60)
    
    try:
        # Initialize generator
        generator = SimpleContactPersonDataGenerator()
        
        # Generate contact data
        contacts_data = await generator.generate_all_contacts(1000)
        
        # Get database session
        print("\n💾 Connecting to database...")
        async for session in get_async_session_direct():
            service = ContactPersonService(session)
            
            # Insert contacts in batches for better performance
            batch_size = 50
            total_created = 0
            errors = 0
            
            print(f"\n🔄 Inserting contacts in batches of {batch_size}...")
            
            for i in range(0, len(contacts_data), batch_size):
                batch = contacts_data[i:i + batch_size]
                batch_num = (i // batch_size) + 1
                total_batches = (len(contacts_data) + batch_size - 1) // batch_size
                
                print(f"   Processing batch {batch_num}/{total_batches}...")
                
                for contact_data in batch:
                    try:
                        await service.create_contact_person(contact_data)
                        total_created += 1
                    except Exception as e:
                        errors += 1
                        if errors <= 10:  # Only show first 10 errors
                            print(f"   ⚠️ Error creating contact {contact_data.first_name} {contact_data.last_name}: {e}")
            
            # Get final statistics
            stats = await service.get_contact_person_statistics()
            
            print("\n" + "=" * 60)
            print("📊 FINAL STATISTICS")
            print("=" * 60)
            print(f"✅ Successfully created: {total_created} contacts")
            print(f"❌ Errors encountered: {errors} contacts")
            print(f"📈 Total active contacts: {stats.total_contacts}")
            print(f"🏢 Unique companies: {stats.companies_count}")
            print(f"👑 Primary contacts: {stats.primary_contacts}")
            print(f"📧 Contacts with email: {stats.with_email}")
            print(f"📱 Contacts with phone: {stats.with_phone}")
            
            # Test search functionality
            print("\n🔍 Testing search functionality...")
            
            # Test company search
            from app.schemas.contact_person import ContactPersonSearch
            search_results = await service.search_contact_persons(
                ContactPersonSearch(search_term="Tech", limit=5)
            )
            print(f"   Search for 'Tech': {len(search_results)} results")
            
            # Test primary contacts
            primary_contacts = await service.get_primary_contacts(limit=10)
            print(f"   Primary contacts: {len(primary_contacts)} found")
            
            # Test recent contacts
            recent_contacts = await service.get_recent_contacts(limit=5)
            print(f"   Recent contacts: {len(recent_contacts)} found")
            
            print("\n🎉 Contact persons test data generation completed successfully!")
            print("   Ready for comprehensive testing and load testing!")
            
            break  # Only process one session
    
    except Exception as e:
        print(f"\n❌ Error during test data generation: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())