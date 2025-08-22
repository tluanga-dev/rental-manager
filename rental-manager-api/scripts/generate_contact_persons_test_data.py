#!/usr/bin/env python3
"""
Contact Persons Test Data Generator
Generates 1000 contact persons with 4-tier categorization for comprehensive testing
"""

import asyncio
import sys
import os
from typing import List, Dict, Any
from faker import Faker
import random
from datetime import datetime, timedelta

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_async_session_direct
from app.services.contact_person import ContactPersonService
from app.schemas.contact_person import ContactPersonCreate


class ContactPersonDataGenerator:
    """Generate realistic contact person test data."""
    
    def __init__(self):
        self.fake = Faker()
        
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
        
        # Realistic company types and names
        self.company_types = [
            "Tech Startups", "Manufacturing", "Healthcare", "Finance", "Retail",
            "Construction", "Education", "Government", "Non-Profit", "Consulting"
        ]
        
        self.company_suffixes = ["Corp", "Inc", "LLC", "Ltd", "Co", "Group", "Solutions", "Systems"]
        
        # Countries with appropriate postal code patterns
        self.countries_data = {
            "USA": {"cities": ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix"], "postal_pattern": "zip"},
            "Canada": {"cities": ["Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa"], "postal_pattern": "postal"},
            "UK": {"cities": ["London", "Manchester", "Birmingham", "Liverpool", "Leeds"], "postal_pattern": "postal"},
            "Australia": {"cities": ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide"], "postal_pattern": "zip"},
            "India": {"cities": ["Mumbai", "Delhi", "Bangalore", "Chennai", "Kolkata"], "postal_pattern": "zip"}
        }
        
        # Generated companies for consistency
        self.companies = []
        self.generated_emails = set()  # Track generated emails to ensure uniqueness
    
    def generate_companies(self, count: int = 200) -> List[str]:
        """Generate realistic company names."""
        companies = []
        
        for _ in range(count):
            # Mix of realistic and generated company names
            if random.choice([True, False]):
                # Use Faker company
                company_name = self.fake.company()
            else:
                # Generate custom company
                prefix = random.choice([
                    "Advanced", "Global", "Premier", "Elite", "Dynamic", "Innovative",
                    "Strategic", "Superior", "Optimal", "Alpha", "Apex", "Titan"
                ])
                industry = random.choice([
                    "Technologies", "Solutions", "Services", "Systems", "Consulting",
                    "Manufacturing", "Industries", "Enterprises", "Logistics", "Networks"
                ])
                suffix = random.choice(self.company_suffixes)
                company_name = f"{prefix} {industry} {suffix}"
            
            companies.append(company_name)
        
        self.companies = companies
        return companies
    
    def generate_unique_email(self, first_name: str, last_name: str, company: str) -> str:
        """Generate a unique email address."""
        base_email_formats = [
            f"{first_name.lower()}.{last_name.lower()}",
            f"{first_name.lower()}{last_name.lower()}",
            f"{first_name[0].lower()}{last_name.lower()}",
            f"{first_name.lower()}.{last_name[0].lower()}",
            f"{first_name.lower()}{random.randint(1, 999)}"
        ]
        
        # Generate company domain
        company_domain = company.lower().replace(" ", "").replace(",", "").replace(".", "")
        for suffix in self.company_suffixes:
            company_domain = company_domain.replace(suffix.lower(), "")
        
        domain_endings = ["com", "org", "net", "biz", "co"]
        
        for email_format in base_email_formats:
            email = f"{email_format}@{company_domain}.{random.choice(domain_endings)}"
            if email not in self.generated_emails:
                self.generated_emails.add(email)
                return email
        
        # Fallback with timestamp if all formats are taken
        timestamp = datetime.now().strftime("%H%M%S")
        email = f"{first_name.lower()}{timestamp}@{company_domain}.com"
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
    
    def generate_phone_number(self, country: str = "USA") -> str:
        """Generate realistic phone numbers by country."""
        if country == "USA":
            return f"+1-{random.randint(200,999)}-{random.randint(200,999)}-{random.randint(1000,9999)}"
        elif country == "Canada":
            return f"+1-{random.randint(200,999)}-{random.randint(200,999)}-{random.randint(1000,9999)}"
        elif country == "UK":
            return f"+44-{random.randint(1000,9999)}-{random.randint(100000,999999)}"
        elif country == "Australia":
            return f"+61-{random.randint(2,9)}-{random.randint(1000,9999)}-{random.randint(1000,9999)}"
        elif country == "India":
            return f"+91-{random.randint(70000,99999)}-{random.randint(10000,99999)}"
        else:
            return self.fake.phone_number()
    
    def generate_postal_code(self, country: str) -> str:
        """Generate appropriate postal codes by country."""
        if country == "USA":
            return f"{random.randint(10000, 99999)}"
        elif country == "Canada":
            letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
            return f"{random.choice(letters)}{random.randint(0,9)}{random.choice(letters)} {random.randint(0,9)}{random.choice(letters)}{random.randint(0,9)}"
        elif country == "UK":
            return f"{random.choice(['SW', 'NW', 'SE', 'NE', 'EC', 'WC'])}{random.randint(1,9)} {random.randint(1,9)}{random.choice(['AA', 'BB', 'CC', 'DD'])}"
        elif country == "Australia":
            return f"{random.randint(1000, 9999)}"
        elif country == "India":
            return f"{random.randint(100000, 999999)}"
        else:
            return self.fake.postcode()
    
    def generate_contact_person(self, company: str) -> ContactPersonCreate:
        """Generate a single realistic contact person."""
        # Determine tier and get config
        tier = self.determine_contact_tier()
        tier_config = self.contact_tiers[tier]
        
        # Basic information
        first_name = self.fake.first_name()
        last_name = self.fake.last_name()
        
        # Professional information
        title = random.choice(tier_config["titles"])
        department = random.choice(tier_config["departments"])
        
        # Contact information
        country = random.choice(list(self.countries_data.keys()))
        country_data = self.countries_data[country]
        city = random.choice(country_data["cities"])
        
        # Generate unique email
        email = self.generate_unique_email(first_name, last_name, company)
        
        # Phone numbers (85% have phone, 70% have mobile)
        phone = self.generate_phone_number(country) if random.random() < 0.85 else None
        mobile = self.generate_phone_number(country) if random.random() < 0.70 else None
        
        # Address information
        address = self.fake.street_address()
        state = self.fake.state() if country in ["USA", "Canada", "Australia"] else self.fake.county()
        postal_code = self.generate_postal_code(country)
        
        # Additional information
        notes = None
        if random.random() < 0.30:  # 30% have notes
            note_templates = [
                f"Preferred contact hours: {random.choice(['9-5', '10-6', '8-4', 'flexible'])}",
                f"Languages: {random.choice(['English', 'English/Spanish', 'English/French', 'Multilingual'])}",
                f"Best reached via: {random.choice(['email', 'phone', 'mobile', 'any method'])}",
                f"Role focus: {random.choice(['procurement', 'technical decisions', 'billing', 'operations'])}",
                "Backup contact available during business hours",
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
            country=country,
            postal_code=postal_code,
            notes=notes,
            is_primary=tier_config["is_primary"] and random.random() < 0.3  # Only some primary tier contacts are actually primary
        )
    
    async def generate_all_contacts(self, total_contacts: int = 1000) -> List[ContactPersonCreate]:
        """Generate all contact persons with proper distribution."""
        print(f"🎲 Generating {total_contacts} contact persons with 4-tier categorization...")
        
        # Generate companies first
        print("📊 Generating realistic companies...")
        companies = self.generate_companies(200)  # 200 companies for 1000 contacts (avg 5 contacts per company)
        
        contacts = []
        
        # Track tier distribution for reporting
        tier_counts = {tier: 0 for tier in self.contact_tiers.keys()}
        
        for i in range(total_contacts):
            if i % 100 == 0:
                print(f"   Generated {i}/{total_contacts} contacts...")
            
            # Select company (some companies have more contacts than others)
            if i < 500:
                # First 500 contacts distributed across top 50 companies (more contacts per company)
                company = random.choice(companies[:50])
            else:
                # Remaining 500 contacts distributed across all companies
                company = random.choice(companies)
            
            contact = self.generate_contact_person(company)
            contacts.append(contact)
            
            # Track tier for the report
            tier = self.determine_contact_tier()
            tier_counts[tier] += 1
        
        # Print distribution report
        print("\n📈 Contact Distribution by Tier:")
        for tier, count in tier_counts.items():
            percentage = (count / total_contacts) * 100
            print(f"   {tier}: {count} contacts ({percentage:.1f}%)")
        
        print(f"\n✅ Generated {total_contacts} unique contact persons across {len(companies)} companies")
        return contacts


async def main():
    """Main function to generate and insert test data."""
    print("🚀 Starting Contact Persons Test Data Generation")
    print("=" * 60)
    
    try:
        # Initialize generator
        generator = ContactPersonDataGenerator()
        
        # Generate contact data
        contacts_data = await generator.generate_all_contacts(1000)
        
        # Get database session
        print("\n💾 Connecting to database...")
        async with get_async_session_direct() as session:
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
    
    except Exception as e:
        print(f"\n❌ Error during test data generation: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())