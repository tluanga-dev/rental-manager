#!/usr/bin/env python3
"""
Script to fix all indentation issues in main.py systematically
"""

def fix_handle_migration_manager():
    """Fix the indentation in the handle_migration_manager function"""
    
    with open('main.py', 'r') as f:
        lines = f.readlines()
    
    # Find the function start and end
    start_line = None
    end_line = None
    
    for i, line in enumerate(lines):
        if 'async def handle_migration_manager():' in line:
            start_line = i
        elif start_line is not None and line.strip() == 'except KeyboardInterrupt:' and not line.startswith('        '):
            end_line = i
            break
    
    if start_line is None or end_line is None:
        print("Could not find function boundaries")
        return
    
    print(f"Found function from line {start_line + 1} to {end_line + 1}")
    
    # Process lines within the function
    fixed_lines = lines[:start_line + 1]  # Keep everything before the function
    
    # Add the correct function content with proper indentation
    function_body = '''    """Handle database migration operations with enhanced features"""
    console.print("\\n[bold blue]🔄 Enhanced Migration Manager[/bold blue]")
    
    try:
        async with config.get_session() as session:
            # Import enhanced migration manager
            from modules.migration_manager_enhanced import EnhancedMigrationManager, MigrationMode, MigrationStrategy
            from modules.migration_manager import MigrationManager
            
            # Initialize both basic and enhanced managers
            basic_manager = MigrationManager(session, config.RENTAL_API_DIR)
            enhanced_manager = EnhancedMigrationManager(session, config.RENTAL_API_DIR, config)
            
            while True:
                console.print("\\n[dim]Enhanced Migration Manager Options:[/dim]")
                console.print("  [1] 🔬 Deep Model Analysis")
                console.print("  [2] 🚀 Generate Fresh Baseline Migration")
                console.print("  [3] ⬆️ Create Smart Upgrade Migration")
                console.print("  [4] 💾 Safe Migration with Auto-Backup")
                console.print("  [5] 🧪 Detect Schema Changes")
                console.print("  [6] 📊 Migration History & Status")
                console.print("  [7] 🛡️ Emergency Rollback")
                console.print("  [8] 🔧 Basic Migration Operations")
                console.print("  [0] Return to main menu")
                
                choice = Prompt.ask("\\n[bold]Select option", choices=["1", "2", "3", "4", "5", "6", "7", "8", "0"])
                
                if choice == "0":
                    break
                    
                elif choice == "1":
                    # Deep Model Analysis
                    try:
                        report = await enhanced_manager.analyze_models_deep()
                        
                        # Show detailed analysis options
                        while True:
                            console.print("\\n[dim]Analysis Options:[/dim]")
                            console.print("  [1] Show dependency graph")
                            console.print("  [2] Show model details")
                            console.print("  [3] Export analysis report")
                            console.print("  [0] Back to migration menu")
                            
                            analysis_choice = Prompt.ask("Select option", choices=["1", "2", "3", "0"])
                            
                            if analysis_choice == "0":
                                break
                            elif analysis_choice == "1":
                                enhanced_manager.model_analyzer.display_dependency_graph(report)
                            elif analysis_choice == "2":
                                model_name = Prompt.ask("Enter model name to analyze")
                                enhanced_manager.model_analyzer.display_model_details(model_name, report)
                            elif analysis_choice == "3":
                                # Export analysis report
                                output_file = Prompt.ask("Enter output file name", default="model_analysis_report.json")
                                output_path = config.BASE_DIR / output_file
                                
                                report_data = {
                                    "analysis_timestamp": report.analysis_timestamp.isoformat(),
                                    "total_models": report.total_models,
                                    "total_tables": report.total_tables,
                                    "total_relationships": report.total_relationships,
                                    "circular_dependencies": report.circular_dependencies,
                                    "orphaned_models": report.orphaned_models,
                                    "base_model_inconsistencies": report.base_model_inconsistencies,
                                    "dependency_order": report.dependency_order
                                }
                                
                                import json
                                with open(output_path, 'w') as f:
                                    json.dump(report_data, f, indent=2, default=str)
                                
                                console.print(f"[green]✅ Analysis report exported to {output_path}[/green]")
                        
                    except Exception as e:
                        console.print(f"[red]❌ Model analysis failed: {e}[/red]")
                
                elif choice == "2":
                    # Generate Fresh Baseline Migration
                    try:
                        # Create migration plan
                        plan = await enhanced_manager.create_migration_plan(
                            MigrationMode.FRESH_BASELINE,
                            MigrationStrategy.STANDARD
                        )
                        
                        # Display plan and get confirmation
                        if enhanced_manager.confirm_migration_execution(plan):
                            result = await enhanced_manager.execute_migration_plan(plan)
                            
                            if result.success:
                                console.print("\\n[bold green]🎉 Fresh baseline migration completed successfully![/bold green]")
                            else:
                                console.print("\\n[bold red]❌ Fresh baseline migration failed![/bold red]")
                    
                    except Exception as e:
                        console.print(f"[red]❌ Fresh baseline migration failed: {e}[/red]")
                
                elif choice == "3":
                    # Create Smart Upgrade Migration
                    try:
                        # Choose strategy
                        console.print("\\n[bold blue]Select Migration Strategy:[/bold blue]")
                        console.print("  [1] Conservative (Maximum safety)")
                        console.print("  [2] Standard (Balanced)")
                        console.print("  [3] Aggressive (Fast execution)")
                        
                        strategy_choice = Prompt.ask("Select strategy", choices=["1", "2", "3"], default="2")
                        strategy_map = {
                            "1": MigrationStrategy.CONSERVATIVE,
                            "2": MigrationStrategy.STANDARD,
                            "3": MigrationStrategy.AGGRESSIVE
                        }
                        strategy = strategy_map[strategy_choice]
                        
                        # Create migration plan
                        plan = await enhanced_manager.create_migration_plan(
                            MigrationMode.INCREMENTAL,
                            strategy
                        )
                        
                        # Display plan and get confirmation
                        if enhanced_manager.confirm_migration_execution(plan):
                            result = await enhanced_manager.execute_migration_plan(plan)
                            
                            if result.success:
                                console.print("\\n[bold green]🎉 Smart upgrade migration completed successfully![/bold green]")
                            else:
                                console.print("\\n[bold red]❌ Smart upgrade migration failed![/bold red]")
                    
                    except Exception as e:
                        console.print(f"[red]❌ Smart upgrade migration failed: {e}[/red]")
                
                elif choice == "4":
                    # Safe Migration with Auto-Backup
                    try:
                        # Create safe upgrade plan
                        plan = await enhanced_manager.create_migration_plan(
                            MigrationMode.INCREMENTAL,
                            MigrationStrategy.CONSERVATIVE
                        )
                        
                        # Show backup options
                        console.print("\\n[yellow]🛡️ This operation will create an automatic backup[/yellow]")
                        if Confirm.ask("Proceed with safe migration?", default=True):
                            result = await enhanced_manager.execute_migration_plan(plan)
                            
                            if result.success:
                                console.print("\\n[bold green]🎉 Safe migration completed successfully![/bold green]")
                            else:
                                console.print("\\n[bold red]❌ Safe migration failed![/bold red]")
                    
                    except Exception as e:
                        console.print(f"[red]❌ Safe migration failed: {e}[/red]")
                
                elif choice == "5":
                    # Detect Schema Changes
                    try:
                        console.print("\\n[yellow]🧪 Analyzing schema changes...[/yellow]")
                        changes = await enhanced_manager.detect_schema_changes()
                        
                        if changes:
                            console.print(f"\\n[bold yellow]📋 Found {len(changes)} schema changes:[/bold yellow]")
                            for change in changes[:10]:  # Show first 10
                                console.print(f"  • {change}")
                            if len(changes) > 10:
                                console.print(f"  ... and {len(changes) - 10} more changes")
                        else:
                            console.print("\\n[green]✅ No schema changes detected[/green]")
                    
                    except Exception as e:
                        console.print(f"[red]❌ Schema change detection failed: {e}[/red]")
                
                elif choice == "6":
                    # Migration History & Status
                    try:
                        # Show comprehensive migration status
                        current_rev = await basic_manager.get_current_revision()
                        history = basic_manager.get_migration_history()
                        schema_info = await basic_manager.get_database_schema_version()
                        
                        basic_manager.display_schema_info(schema_info)
                        basic_manager.display_migration_status(history, current_rev)
                        
                        # Show pending migrations
                        pending = basic_manager.get_pending_migrations()
                        if pending:
                            console.print(f"\\n[yellow]📋 Pending migrations: {len(pending)}[/yellow]")
                        else:
                            console.print("\\n[green]✅ No pending migrations[/green]")
                    
                    except Exception as e:
                        console.print(f"[red]❌ Migration status failed: {e}[/red]")
                
                elif choice == "7":
                    # Emergency Rollback
                    try:
                        console.print("\\n[bold red]🚨 Emergency Rollback[/bold red]")
                        console.print("[yellow]This will rollback the last migration[/yellow]")
                        
                        if Confirm.ask("Are you sure you want to rollback?", default=False):
                            success, message = basic_manager.rollback_migration()
                            if success:
                                console.print(f"[green]✅ {message}[/green]")
                            else:
                                console.print(f"[red]❌ {message}[/red]")
                    
                    except Exception as e:
                        console.print(f"[red]❌ Emergency rollback failed: {e}[/red]")
                
                elif choice == "8":
                    # Basic Migration Operations
                    while True:
                        console.print("\\n[dim]Basic Migration Operations:[/dim]")
                        console.print("  [1] Show migration status")
                        console.print("  [2] Apply migrations")
                        console.print("  [3] Rollback migration")
                        console.print("  [4] Generate migration")
                        console.print("  [5] Show migration SQL")
                        console.print("  [6] Validate migration integrity")
                        console.print("  [0] Back to enhanced menu")
                        
                        basic_choice = Prompt.ask("Select option", choices=["1", "2", "3", "4", "5", "6", "0"])
                        
                        if basic_choice == "0":
                            break
                        elif basic_choice == "1":
                            # Show migration status
                            current_rev = await basic_manager.get_current_revision()
                            history = basic_manager.get_migration_history()
                            basic_manager.display_migration_status(history, current_rev)
                        
                        elif basic_choice == "2":
                            # Apply migrations
                            target = Prompt.ask("Target revision", default="head")
                            
                            if basic_manager.confirm_migration_operation("Apply Migrations", f"Target: {target}"):
                                success, message = basic_manager.apply_migrations(target)
                                if success:
                                    console.print(f"[green]✓ {message}[/green]")
                                else:
                                    console.print(f"[red]✗ {message}[/red]")
                        
                        elif basic_choice == "3":
                            # Rollback migration
                            target = Prompt.ask("Target revision", default="-1")
                            
                            if basic_manager.confirm_migration_operation("Rollback Migration", f"Target: {target}"):
                                success, message = basic_manager.rollback_migration(target)
                                if success:
                                    console.print(f"[green]✓ {message}[/green]")
                                else:
                                    console.print(f"[red]✗ {message}[/red]")
                        
                        elif basic_choice == "4":
                            # Generate migration
                            message = Prompt.ask("Migration message")
                            autogenerate = Confirm.ask("Auto-generate from model changes?", default=True)
                            
                            success, result_message, migration_file = basic_manager.generate_migration(message, autogenerate)
                            
                            if success:
                                console.print(f"[green]✓ {result_message}[/green]")
                                if migration_file:
                                    console.print(f"[blue]Migration file: {migration_file}[/blue]")
                            else:
                                console.print(f"[red]✗ {result_message}[/red]")
                        
                        elif basic_choice == "5":
                            # Show migration SQL
                            from_rev = Prompt.ask("From revision (optional)", default="")
                            to_rev = Prompt.ask("To revision", default="head")
                            
                            success, sql = basic_manager.get_migration_sql(
                                from_revision=from_rev if from_rev else None,
                                to_revision=to_rev
                            )
                            
                            if success:
                                basic_manager.display_migration_sql(sql)
                            else:
                                console.print(f"[red]✗ {sql}[/red]")
                        
                        elif basic_choice == "6":
                            # Validate migration integrity
                            valid, issues = basic_manager.validate_migration_integrity()
                            
                            if valid:
                                console.print("[green]✓ Migration integrity check passed[/green]")
                            else:
                                console.print("[red]✗ Migration integrity issues found:[/red]")
                                for issue in issues:
                                    console.print(f"  • {issue}")
            
            # Add some spacing for better readability
            console.print()
    
    except KeyboardInterrupt:
        console.print("\\n[yellow]⚠️ Migration manager interrupted[/yellow]")
    except Exception as e:
        console.print(f"[red]❌ Unexpected error in migration manager: {e}[/red]")
        import traceback
        console.print(f"[dim]{traceback.format_exc()}[/dim]")

'''
    
    # Convert the string to lines
    function_lines = function_body.split('\n')
    for line in function_lines:
        fixed_lines.append(line + '\n')
    
    # Add the rest of the file
    fixed_lines.extend(lines[end_line:])
    
    # Write the fixed file
    with open('main.py', 'w') as f:
        f.writelines(fixed_lines)
    
    print("✅ Fixed handle_migration_manager function indentation")

if __name__ == '__main__':
    fix_handle_migration_manager()
    print("🎉 main.py indentation fixed!")