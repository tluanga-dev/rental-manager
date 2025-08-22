#!/usr/bin/env python3
"""
Migrate suppliers from JSON to database
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

async def migrate_suppliers():
    """Migrate suppliers from JSON file to database with proper data handling"""
    print("🚀 Starting supplier migration...")
    
    # Load suppliers data
    try:
        with open('dummy_data/suppliers.json', 'r', encoding='utf-8') as f:
            suppliers_data = json.load(f)
        print(f"📄 Loaded {len(suppliers_data)} suppliers from JSON")
    except Exception as e:
        print(f"❌ Error loading JSON: {e}")
        return False
    
    async with AsyncSessionLocal() as session:
        try:
            # Check if suppliers table exists
            result = await session.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'suppliers'
                );
            """))
            table_exists = result.scalar()
            
            if not table_exists:
                print("❌ Suppliers table does not exist. Please run migrations first:")
                print("   alembic upgrade head")
                return False
            
            # Check existing data
            result = await session.execute(text("SELECT COUNT(*) FROM suppliers"))
            existing_count = result.scalar()
            
            # Clear existing suppliers
            if existing_count > 0:
                print(f"🧹 Clearing {existing_count} existing suppliers...")
                await session.execute(text("DELETE FROM suppliers"))
                print("✅ Existing suppliers cleared")
            else:
                print("ℹ️  No existing suppliers to clear")
            
            # Insert suppliers one by one
            created_count = 0
            for supplier_data in suppliers_data:
                # Create a savepoint for each supplier
                savepoint = await session.begin_nested()
                try:
                    # Generate UUID for the supplier
                    supplier_id = uuid.uuid4()
                    
                    # Parse dates properly (remove timezone info)
                    last_order_date = None
                    contract_start_date = None
                    contract_end_date = None
                    insurance_expiry = None
                    
                    if supplier_data.get('last_order_date'):
                        date_str = supplier_data['last_order_date'].replace('Z', '')
                        last_order_date = datetime.fromisoformat(date_str)
                    
                    if supplier_data.get('contract_start_date'):
                        date_str = supplier_data['contract_start_date'].replace('Z', '')
                        contract_start_date = datetime.fromisoformat(date_str)
                    
                    if supplier_data.get('contract_end_date'):
                        date_str = supplier_data['contract_end_date'].replace('Z', '')
                        contract_end_date = datetime.fromisoformat(date_str)
                    
                    if supplier_data.get('insurance_expiry'):
                        date_str = supplier_data['insurance_expiry'].replace('Z', '')
                        insurance_expiry = datetime.fromisoformat(date_str)
                    
                    # Insert supplier with proper data types
                    insert_query = text("""
                        INSERT INTO suppliers (
                            id, supplier_code, company_name, supplier_type, contact_person,
                            email, phone, mobile, address_line1, address_line2, city, state,
                            postal_code, country, tax_id, payment_terms, credit_limit,
                            supplier_tier, status, quality_rating, delivery_rating,
                            average_delivery_days, total_orders, total_spend,
                            last_order_date, contract_start_date, contract_end_date,
                            notes, website, account_manager, preferred_payment_method,
                            insurance_expiry, certifications, is_active
                        ) VALUES (
                            :id, :supplier_code, :company_name, :supplier_type, :contact_person,
                            :email, :phone, :mobile, :address_line1, :address_line2, :city, :state,
                            :postal_code, :country, :tax_id, :payment_terms, :credit_limit,
                            :supplier_tier, :status, :quality_rating, :delivery_rating,
                            :average_delivery_days, :total_orders, :total_spend,
                            :last_order_date, :contract_start_date, :contract_end_date,
                            :notes, :website, :account_manager, :preferred_payment_method,
                            :insurance_expiry, :certifications, :is_active
                        )
                    """)
                    
                    await session.execute(insert_query, {
                        'id': supplier_id,
                        'supplier_code': supplier_data['supplier_code'],
                        'company_name': supplier_data['company_name'],
                        'supplier_type': supplier_data['supplier_type'],
                        'contact_person': supplier_data.get('contact_person'),
                        'email': supplier_data.get('email'),
                        'phone': supplier_data.get('phone'),
                        'mobile': supplier_data.get('mobile'),
                        'address_line1': supplier_data.get('address_line1'),
                        'address_line2': supplier_data.get('address_line2'),
                        'city': supplier_data.get('city'),
                        'state': supplier_data.get('state'),
                        'postal_code': supplier_data.get('postal_code'),
                        'country': supplier_data.get('country'),
                        'tax_id': supplier_data.get('tax_id'),
                        'payment_terms': supplier_data.get('payment_terms', 'NET30'),
                        'credit_limit': Decimal(str(supplier_data.get('credit_limit', 0))),
                        'supplier_tier': supplier_data.get('supplier_tier', 'STANDARD'),
                        'status': supplier_data.get('status', 'ACTIVE'),
                        'quality_rating': Decimal(str(supplier_data.get('quality_rating', 0))),
                        'delivery_rating': Decimal(str(supplier_data.get('delivery_rating', 0))),
                        'average_delivery_days': supplier_data.get('average_delivery_days', 0),
                        'total_orders': supplier_data.get('total_orders', 0),
                        'total_spend': Decimal(str(supplier_data.get('total_spend', 0))),
                        'last_order_date': last_order_date,
                        'contract_start_date': contract_start_date,
                        'contract_end_date': contract_end_date,
                        'notes': supplier_data.get('notes'),
                        'website': supplier_data.get('website'),
                        'account_manager': supplier_data.get('account_manager'),
                        'preferred_payment_method': supplier_data.get('preferred_payment_method'),
                        'insurance_expiry': insurance_expiry,
                        'certifications': supplier_data.get('certifications'),
                        'is_active': True
                    })
                    
                    await savepoint.commit()
                    created_count += 1
                    
                    # Create display name
                    display_name = f"{supplier_data['company_name']} ({supplier_data['supplier_code']})"
                    print(f"✅ Created supplier: {display_name}")
                    
                except Exception as e:
                    await savepoint.rollback()
                    print(f"❌ Error creating supplier {supplier_data.get('supplier_code', 'Unknown')}: {e}")
                    continue
            
            # Commit all changes
            await session.commit()
            print(f"\n🎉 Successfully migrated {created_count} suppliers to database!")
            
            # Show summary statistics
            print(f"\n📊 Migration Summary:")
            print(f"   • Total suppliers processed: {len(suppliers_data)}")
            print(f"   • Successfully created: {created_count}")
            print(f"   • Failed: {len(suppliers_data) - created_count}")
            
            # Show supplier type breakdown
            supplier_types = {}
            for supplier in suppliers_data:
                supplier_type = supplier.get('supplier_type', 'UNKNOWN')
                supplier_types[supplier_type] = supplier_types.get(supplier_type, 0) + 1
            
            print(f"\n📈 Supplier Types:")
            for supplier_type, count in sorted(supplier_types.items()):
                print(f"   • {supplier_type}: {count}")
            
            return True
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Migration failed: {e}")
            return False

async def verify_migration():
    """Verify the migration was successful"""
    print("\n🔍 Verifying migration...")
    
    async with AsyncSessionLocal() as session:
        try:
            # Count total suppliers
            result = await session.execute(text("SELECT COUNT(*) FROM suppliers WHERE is_active = true"))
            total_count = result.scalar()
            print(f"✅ Total active suppliers in database: {total_count}")
            
            # Check supplier types
            result = await session.execute(text("""
                SELECT supplier_type, COUNT(*) as count 
                FROM suppliers 
                WHERE is_active = true 
                GROUP BY supplier_type 
                ORDER BY count DESC
            """))
            
            print(f"\n📊 Supplier Types in Database:")
            for row in result:
                print(f"   • {row.supplier_type}: {row.count}")
            
            # Check supplier tiers
            result = await session.execute(text("""
                SELECT supplier_tier, COUNT(*) as count 
                FROM suppliers 
                WHERE is_active = true 
                GROUP BY supplier_tier 
                ORDER BY count DESC
            """))
            
            print(f"\n🏆 Supplier Tiers:")
            for row in result:
                print(f"   • {row.supplier_tier}: {row.count}")
            
            # Show top 5 suppliers by credit limit
            result = await session.execute(text("""
                SELECT supplier_code, company_name, credit_limit 
                FROM suppliers 
                WHERE is_active = true 
                ORDER BY credit_limit DESC 
                LIMIT 5
            """))
            
            print(f"\n💰 Top 5 Suppliers by Credit Limit:")
            for row in result:
                print(f"   • {row.supplier_code}: {row.company_name} - ${row.credit_limit:,.2f}")
            
        except Exception as e:
            print(f"❌ Verification failed: {e}")

if __name__ == "__main__":
    async def main():
        success = await migrate_suppliers()
        if success:
            await verify_migration()
            print("\n✅ Supplier migration completed successfully!")
        else:
            print("\n❌ Supplier migration failed!")
    
    asyncio.run(main())