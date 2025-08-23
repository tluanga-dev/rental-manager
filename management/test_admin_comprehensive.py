#!/usr/bin/env python3
"""
Comprehensive Admin Creation Test Suite

Tests all aspects of admin user management including:
- Admin user creation
- Admin user validation
- Password management
- Error handling
- Edge cases
"""

import asyncio
import sys
import traceback
from pathlib import Path
from rich.console import Console
from rich.table import Table

# Add rental-manager-api to path
sys.path.insert(0, str(Path(__file__).parent.parent / "rental-manager-api"))

console = Console()

class AdminTestSuite:
    """Comprehensive test suite for admin management"""
    
    def __init__(self):
        self.results = []
        self.config = None
        self.admin_manager = None
    
    async def setup(self):
        """Initialize configuration and admin manager"""
        try:
            from config import config
            self.config = config
            
            # Test database connection
            db_success, db_message = await config.test_database_connection()
            if not db_success:
                raise Exception(f"Database connection failed: {db_message}")
            
            console.print("[green]✓ Database connection established[/green]")
            return True
        except Exception as e:
            console.print(f"[red]✗ Setup failed: {e}[/red]")
            return False
    
    def add_result(self, test_name: str, success: bool, message: str, details: str = ""):
        """Add test result"""
        self.results.append({
            'test': test_name,
            'success': success,
            'message': message,
            'details': details
        })
    
    async def test_admin_creation_new(self):
        """Test creating a completely new admin user"""
        console.print("\n[bold blue]🆕 Testing New Admin Creation[/bold blue]")
        
        try:
            async for session in self.config.get_session():
                from modules.admin_manager import AdminManager
                admin_manager = AdminManager(session, self.config.admin)
                
                # First, ensure no admin exists by trying to get one
                existing = await admin_manager.get_admin_by_username("test_admin_new")
                if existing:
                    # Cleanup previous test data
                    success, _ = await admin_manager.delete_admin_user("test_admin_new")
                
                # Create a test admin with different credentials
                original_username = self.config.admin.ADMIN_USERNAME
                original_email = self.config.admin.ADMIN_EMAIL
                
                self.config.admin.ADMIN_USERNAME = "test_admin_new"
                self.config.admin.ADMIN_EMAIL = "test_admin_new@test.com"
                
                success, message, user = await admin_manager.create_admin_user(force=False)
                
                # Restore original credentials
                self.config.admin.ADMIN_USERNAME = original_username
                self.config.admin.ADMIN_EMAIL = original_email
                
                if success and user:
                    self.add_result("New Admin Creation", True, message, f"Admin ID: {user.id}")
                    console.print(f"[green]✓ {message}[/green]")
                    
                    # Cleanup
                    await admin_manager.delete_admin_user("test_admin_new")
                else:
                    self.add_result("New Admin Creation", False, message)
                    console.print(f"[red]✗ {message}[/red]")
                
                break
                
        except Exception as e:
            self.add_result("New Admin Creation", False, str(e), traceback.format_exc())
            console.print(f"[red]✗ New admin creation failed: {e}[/red]")
    
    async def test_admin_creation_update(self):
        """Test updating existing admin user"""
        console.print("\n[bold blue]🔄 Testing Admin Update[/bold blue]")
        
        try:
            async for session in self.config.get_session():
                from modules.admin_manager import AdminManager
                admin_manager = AdminManager(session, self.config.admin)
                
                # Create admin first, then update
                success1, message1, user1 = await admin_manager.create_admin_user(force=True)
                
                if success1:
                    # Try updating again
                    success2, message2, user2 = await admin_manager.create_admin_user(force=True)
                    
                    if success2 and user2:
                        self.add_result("Admin Update", True, message2, f"Updated Admin ID: {user2.id}")
                        console.print(f"[green]✓ {message2}[/green]")
                    else:
                        self.add_result("Admin Update", False, message2)
                        console.print(f"[red]✗ {message2}[/red]")
                else:
                    self.add_result("Admin Update", False, "Could not create initial admin")
                    console.print("[red]✗ Could not create initial admin for update test[/red]")
                
                break
                
        except Exception as e:
            self.add_result("Admin Update", False, str(e), traceback.format_exc())
            console.print(f"[red]✗ Admin update test failed: {e}[/red]")
    
    async def test_admin_validation(self):
        """Test admin credential validation"""
        console.print("\n[bold blue]🔐 Testing Admin Validation[/bold blue]")
        
        try:
            async for session in self.config.get_session():
                from modules.admin_manager import AdminManager
                admin_manager = AdminManager(session, self.config.admin)
                
                # Ensure admin exists
                await admin_manager.create_admin_user(force=True)
                
                # Test valid credentials
                success1, message1, user1 = await admin_manager.validate_admin_credentials(
                    self.config.admin.ADMIN_USERNAME,
                    self.config.admin.ADMIN_PASSWORD
                )
                
                if success1 and user1:
                    console.print("[green]✓ Valid credentials accepted[/green]")
                    valid_result = True
                else:
                    console.print(f"[red]✗ Valid credentials rejected: {message1}[/red]")
                    valid_result = False
                
                # Test invalid credentials
                success2, message2, user2 = await admin_manager.validate_admin_credentials(
                    self.config.admin.ADMIN_USERNAME,
                    "wrong_password"
                )
                
                if not success2 and not user2:
                    console.print("[green]✓ Invalid credentials rejected[/green]")
                    invalid_result = True
                else:
                    console.print(f"[red]✗ Invalid credentials accepted: {message2}[/red]")
                    invalid_result = False
                
                overall_success = valid_result and invalid_result
                details = f"Valid: {'✓' if valid_result else '✗'}, Invalid: {'✓' if invalid_result else '✗'}"
                self.add_result("Admin Validation", overall_success, "Credential validation test", details)
                
                break
                
        except Exception as e:
            self.add_result("Admin Validation", False, str(e), traceback.format_exc())
            console.print(f"[red]✗ Admin validation test failed: {e}[/red]")
    
    async def test_admin_list(self):
        """Test listing admin users"""
        console.print("\n[bold blue]📋 Testing Admin List[/bold blue]")
        
        try:
            async for session in self.config.get_session():
                from modules.admin_manager import AdminManager
                admin_manager = AdminManager(session, self.config.admin)
                
                # Ensure at least one admin exists
                await admin_manager.create_admin_user(force=True)
                
                # Get admin list
                admins = await admin_manager.list_all_admins()
                
                if admins and len(admins) > 0:
                    console.print(f"[green]✓ Found {len(admins)} admin user(s)[/green]")
                    admin_details = f"{len(admins)} admin(s): " + ", ".join(a.username for a in admins)
                    self.add_result("Admin List", True, f"Retrieved {len(admins)} admin(s)", admin_details)
                else:
                    console.print("[red]✗ No admin users found[/red]")
                    self.add_result("Admin List", False, "No admin users found")
                
                break
                
        except Exception as e:
            self.add_result("Admin List", False, str(e), traceback.format_exc())
            console.print(f"[red]✗ Admin list test failed: {e}[/red]")
    
    async def test_password_reset(self):
        """Test password reset functionality"""
        console.print("\n[bold blue]🔑 Testing Password Reset[/bold blue]")
        
        try:
            async for session in self.config.get_session():
                from modules.admin_manager import AdminManager
                admin_manager = AdminManager(session, self.config.admin)
                
                # Ensure admin exists
                await admin_manager.create_admin_user(force=True)
                
                # Test password reset
                new_password = "NewTestPassword123!"
                success, message = await admin_manager.reset_admin_password(
                    self.config.admin.ADMIN_USERNAME,
                    new_password
                )
                
                if success:
                    console.print(f"[green]✓ Password reset successful: {message}[/green]")
                    
                    # Verify new password works
                    verify_success, verify_message, user = await admin_manager.validate_admin_credentials(
                        self.config.admin.ADMIN_USERNAME,
                        new_password
                    )
                    
                    if verify_success:
                        console.print("[green]✓ New password validation successful[/green]")
                        self.add_result("Password Reset", True, "Password reset and validation successful")
                        
                        # Reset back to original password
                        await admin_manager.reset_admin_password(
                            self.config.admin.ADMIN_USERNAME,
                            self.config.admin.ADMIN_PASSWORD
                        )
                    else:
                        console.print(f"[red]✗ New password validation failed: {verify_message}[/red]")
                        self.add_result("Password Reset", False, "Password reset succeeded but validation failed")
                else:
                    console.print(f"[red]✗ Password reset failed: {message}[/red]")
                    self.add_result("Password Reset", False, message)
                
                break
                
        except Exception as e:
            self.add_result("Password Reset", False, str(e), traceback.format_exc())
            console.print(f"[red]✗ Password reset test failed: {e}[/red]")
    
    async def test_configuration_validation(self):
        """Test configuration validation"""
        console.print("\n[bold blue]⚙️ Testing Configuration Validation[/bold blue]")
        
        try:
            # Test valid configuration
            valid_config, issues = self.config.validate_environment()
            
            if valid_config:
                console.print("[green]✓ Configuration validation passed[/green]")
                self.add_result("Configuration Validation", True, "All configuration valid")
            else:
                console.print(f"[yellow]⚠ Configuration issues found: {', '.join(issues)}[/yellow]")
                self.add_result("Configuration Validation", False, "Configuration issues", ', '.join(issues))
            
        except Exception as e:
            self.add_result("Configuration Validation", False, str(e), traceback.format_exc())
            console.print(f"[red]✗ Configuration validation test failed: {e}[/red]")
    
    async def test_edge_cases(self):
        """Test edge cases and error conditions"""
        console.print("\n[bold blue]🚨 Testing Edge Cases[/bold blue]")
        
        try:
            async for session in self.config.get_session():
                from modules.admin_manager import AdminManager
                admin_manager = AdminManager(session, self.config.admin)
                
                # Test duplicate prevention
                await admin_manager.create_admin_user(force=True)
                success, message, user = await admin_manager.create_admin_user(force=False)
                
                if not success and "already exists" in message.lower():
                    console.print("[green]✓ Duplicate admin prevention working[/green]")
                    duplicate_test = True
                else:
                    console.print(f"[red]✗ Duplicate prevention failed: {message}[/red]")
                    duplicate_test = False
                
                # Test non-existent user lookup
                non_existent = await admin_manager.get_admin_by_username("non_existent_user")
                if non_existent is None:
                    console.print("[green]✓ Non-existent user lookup returns None[/green]")
                    lookup_test = True
                else:
                    console.print("[red]✗ Non-existent user lookup returned a user[/red]")
                    lookup_test = False
                
                overall_success = duplicate_test and lookup_test
                details = f"Duplicate: {'✓' if duplicate_test else '✗'}, Lookup: {'✓' if lookup_test else '✗'}"
                self.add_result("Edge Cases", overall_success, "Edge case tests", details)
                
                break
                
        except Exception as e:
            self.add_result("Edge Cases", False, str(e), traceback.format_exc())
            console.print(f"[red]✗ Edge cases test failed: {e}[/red]")
    
    def display_results(self):
        """Display comprehensive test results"""
        console.print("\n" + "="*80)
        console.print("[bold cyan]📊 COMPREHENSIVE TEST RESULTS[/bold cyan]")
        console.print("="*80)
        
        # Create results table
        table = Table(title="Admin Management Test Results", show_header=True, header_style="bold magenta")
        
        table.add_column("Test", style="blue", width=25)
        table.add_column("Status", justify="center", width=10)
        table.add_column("Message", style="white", width=35)
        table.add_column("Details", style="dim", width=30)
        
        passed = 0
        failed = 0
        
        for result in self.results:
            status = "✅ PASS" if result['success'] else "❌ FAIL"
            if result['success']:
                passed += 1
            else:
                failed += 1
                
            table.add_row(
                result['test'],
                status,
                result['message'][:34] + "..." if len(result['message']) > 34 else result['message'],
                result['details'][:29] + "..." if len(result['details']) > 29 else result['details']
            )
        
        console.print(table)
        
        # Summary
        total = passed + failed
        success_rate = (passed / total * 100) if total > 0 else 0
        
        console.print(f"\n[bold]📈 Summary: {passed}/{total} tests passed ({success_rate:.1f}%)[/bold]")
        
        if failed == 0:
            console.print("\n[bold green]🎉 All admin management functionality working perfectly![/bold green]")
        else:
            console.print(f"\n[bold yellow]⚠️ {failed} test(s) need attention[/bold yellow]")
            
            # Show failed tests details
            console.print("\n[bold red]Failed Tests Details:[/bold red]")
            for result in self.results:
                if not result['success']:
                    console.print(f"[red]• {result['test']}: {result['message']}[/red]")
                    if result['details']:
                        console.print(f"[dim]  Details: {result['details']}[/dim]")
        
        return failed == 0

async def main():
    """Run comprehensive admin test suite"""
    console.print("[bold cyan]🧪 COMPREHENSIVE ADMIN MANAGEMENT TEST SUITE[/bold cyan]")
    console.print("="*80)
    
    test_suite = AdminTestSuite()
    
    # Setup
    if not await test_suite.setup():
        console.print("[red]❌ Setup failed - aborting tests[/red]")
        return False
    
    # Run all tests
    tests = [
        ("Admin Creation (New)", test_suite.test_admin_creation_new),
        ("Admin Creation (Update)", test_suite.test_admin_creation_update),
        ("Admin Validation", test_suite.test_admin_validation),
        ("Admin List", test_suite.test_admin_list),
        ("Password Reset", test_suite.test_password_reset),
        ("Configuration Validation", test_suite.test_configuration_validation),
        ("Edge Cases", test_suite.test_edge_cases),
    ]
    
    for test_name, test_func in tests:
        console.print(f"\n[yellow]Running {test_name}...[/yellow]")
        await test_func()
    
    # Display results
    return test_suite.display_results()

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)