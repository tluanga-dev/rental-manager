#!/usr/bin/env python3
"""
Fixed migration script for customers from JSON to database
"""
import asyncio
import json
import uuid
import sys
import os
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from sqlalchemy import text

# Add the project root directory to the path so we can import the app modules
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Change to project root directory for relative paths to work
if not os.getcwd().endswith('rental-manager-backend'):
    os.chdir(project_root)

from app.core.database import AsyncSessionLocal

async def migrate_customers():
    """Migrate customers from JSON file to database with proper timezone handling"""
    print("🚀 Starting customer migration...")
    
    # Load customers data
    try:
        with open('dummy_data/customers.json', 'r', encoding='utf-8') as f:
            customers_data = json.load(f)
        print(f"📄 Loaded {len(customers_data)} customers from JSON")
    except Exception as e:
        print(f"❌ Error loading JSON: {e}")
        return False
    
    async with AsyncSessionLocal() as session:
        try:
            # Check existing data
            result = await session.execute(text("SELECT COUNT(*) FROM customers"))
            existing_count = result.scalar()
            
            # Clear existing customers
            if existing_count > 0:
                print(f"🧹 Clearing {existing_count} existing customers...")
                await session.execute(text("DELETE FROM customers"))
                print("✅ Existing customers cleared")
            else:
                print("ℹ️  No existing customers to clear")
            
            # Insert customers one by one
            created_count = 0
            for customer_data in customers_data:
                # Create a savepoint for each customer
                savepoint = await session.begin_nested()
                try:
                    # Parse dates properly (remove timezone info)
                    last_transaction_date = None
                    last_rental_date = None
                    
                    if customer_data.get('last_transaction_date'):
                        # Parse ISO date and remove timezone
                        date_str = customer_data['last_transaction_date'].replace('Z', '')
                        last_transaction_date = datetime.fromisoformat(date_str)
                    
                    if customer_data.get('last_rental_date'):
                        # Parse ISO date and remove timezone
                        date_str = customer_data['last_rental_date'].replace('Z', '')
                        last_rental_date = datetime.fromisoformat(date_str)
                    
                    # Generate UUID for the customer
                    customer_id = uuid.uuid4()
                    
                    # Insert customer with proper data types
                    insert_query = text("""
                        INSERT INTO customers (
                            id, customer_code, customer_type, business_name, first_name, last_name,
                            email, phone, mobile, address_line1, address_line2, city, state,
                            country, postal_code, tax_number, payment_terms, customer_tier,
                            credit_limit, status, blacklist_status, credit_rating,
                            total_rentals, total_spent, lifetime_value,
                            last_transaction_date, last_rental_date, notes, is_active
                        ) VALUES (
                            :id, :customer_code, :customer_type, :business_name, :first_name, :last_name,
                            :email, :phone, :mobile, :address_line1, :address_line2, :city, :state,
                            :country, :postal_code, :tax_number, :payment_terms, :customer_tier,
                            :credit_limit, :status, :blacklist_status, :credit_rating,
                            :total_rentals, :total_spent, :lifetime_value,
                            :last_transaction_date, :last_rental_date, :notes, :is_active
                        )
                    """)
                    
                    await session.execute(insert_query, {
                        'id': customer_id,
                        'customer_code': customer_data['customer_code'],
                        'customer_type': customer_data['customer_type'],
                        'business_name': customer_data.get('business_name'),
                        'first_name': customer_data.get('first_name'),
                        'last_name': customer_data.get('last_name'),
                        'email': customer_data.get('email'),
                        'phone': customer_data.get('phone'),
                        'mobile': customer_data.get('mobile'),
                        'address_line1': customer_data.get('address_line1'),
                        'address_line2': customer_data.get('address_line2'),
                        'city': customer_data.get('city'),
                        'state': customer_data.get('state'),
                        'country': customer_data.get('country'),
                        'postal_code': customer_data.get('postal_code'),
                        'tax_number': customer_data.get('tax_number'),
                        'payment_terms': customer_data.get('payment_terms'),
                        'customer_tier': customer_data['customer_tier'],
                        'credit_limit': Decimal(str(customer_data['credit_limit'])),
                        'status': customer_data['status'],
                        'blacklist_status': customer_data['blacklist_status'],
                        'credit_rating': customer_data['credit_rating'],
                        'total_rentals': Decimal(str(customer_data['total_rentals'])),
                        'total_spent': Decimal(str(customer_data['total_spent'])),
                        'lifetime_value': Decimal(str(customer_data['lifetime_value'])),
                        'last_transaction_date': last_transaction_date,
                        'last_rental_date': last_rental_date,
                        'notes': customer_data.get('notes'),
                        'is_active': True
                    })
                    
                    await savepoint.commit()
                    created_count += 1
                    # Create display name
                    display_name = customer_data.get('business_name')
                    if not display_name:
                        first_name = customer_data.get('first_name', '')
                        last_name = customer_data.get('last_name', '')
                        display_name = f"{first_name} {last_name}".strip()
                    
                    print(f"✅ Created customer: {customer_data['customer_code']} - {display_name}")
                    
                except Exception as e:
                    await savepoint.rollback()
                    print(f"❌ Error creating customer {customer_data.get('customer_code', 'Unknown')}: {e}")
                    continue
            
            # Commit all changes
            await session.commit()
            print(f"\n🎉 Successfully migrated {created_count} customers to database!")
            return True
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Migration failed: {e}")
            return False

if __name__ == "__main__":
    asyncio.run(migrate_customers())