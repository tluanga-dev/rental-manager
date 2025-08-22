# 📚 Step-by-Step Migration Tutorial

> **Time:** 15-20 minutes  
> **What you'll build:** A complete feature with database changes  
> **Skill level:** Beginner to Intermediate

---

## 🎯 What We're Building

We'll add a **"User Preferences"** feature to the application:
- Add preferences table
- Link it to users
- Add API endpoints
- Test everything

---

## 📋 Prerequisites

### Check Your Setup
Run these commands to make sure everything is ready:

```bash
# 1. Check Docker is running
docker --version
# Should show: Docker version 20.x.x or higher

# 2. Check you're in the right directory
pwd
# Should end with: /rental-manager/rental-manager-backend

# 3. Check database is running
docker-compose ps
# Should show: postgres and redis as "Up"
```

❌ **Something missing?** Run: `docker-compose up -d`

---

## 🚀 Part 1: Enable Auto-Migration (One-Time Setup)

### Step 1.1: Configure Docker Compose

Open `docker-compose.dev.yml` and find the backend service:

```yaml
backend:
  environment:
    # Find these lines and set to true:
    MIGRATION_WATCHER: true      # ← Change to true
    AUTO_GENERATE: true          # ← Change to true
    AUTO_APPLY: true            # ← Change to true
    BACKUP_BEFORE_MIGRATE: true # ← Keep as true
```

### Step 1.2: Restart Backend
```bash
docker-compose restart backend
```

### Step 1.3: Verify It's Working
```bash
docker-compose logs backend | grep "Migration watcher"
```

You should see:
```
✓ Migration watcher started (PID: 123)
```

✅ **Auto-migration is now active!**

---

## 🏗️ Part 2: Create the User Preferences Feature

### Step 2.1: Create the Model

Create a new file: `app/modules/users/preferences_model.py`

```python
from sqlalchemy import Column, String, JSON, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.shared.models import Base
import uuid

class UserPreference(Base):
    __tablename__ = "user_preferences"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), unique=True, nullable=False)
    
    # Preferences
    theme = Column(String(20), default="light")  # light/dark
    language = Column(String(10), default="en")  # en/es/fr
    notifications_enabled = Column(Boolean, default=True)
    email_digest = Column(String(20), default="weekly")  # daily/weekly/never
    
    # JSON field for flexible preferences
    settings = Column(JSON, default={})
    
    # Relationship
    user = relationship("User", back_populates="preferences")
```

### Step 2.2: Update User Model

Edit `app/modules/users/models.py`:

```python
class User(Base):
    # ... existing code ...
    
    # Add this relationship
    preferences = relationship(
        "UserPreference", 
        back_populates="user", 
        uselist=False,  # One-to-one
        cascade="all, delete-orphan"
    )
```

### Step 2.3: Watch the Magic! ✨

After saving the files, watch the logs:

```bash
docker-compose logs -f backend | grep -i migration
```

**You'll see:**
```
[INFO] Model change detected in /app/app/modules/users/preferences_model.py
[INFO] Generating migration: Auto-generated migration 20240819_143022
[INFO] Generated migration: 20240819_143022_auto_generated_migration.py
[INFO] Auto-applying generated migration...
[INFO] Migrations applied successfully
```

🎉 **The migration was created and applied automatically!**

---

## 🔍 Part 3: Verify the Migration

### Step 3.1: Check Migration Status
```bash
docker-compose exec backend python manage.py migrate status
```

**You should see:**
```
=== Migration Status ===
Database Connected: True
Migration Table: True
Current Revision: 3f4a5b6c7d8e (latest)
Head Revision: 3f4a5b6c7d8e
Up to Date: True ✅
Pending Migrations: 0
```

### Step 3.2: Check the Database

```bash
# Connect to database
docker-compose exec postgres psql -U rental_user -d rental_dev

# List tables
\dt user*

# You should see:
#  public | user_preferences | table | rental_user
#  public | users           | table | rental_user

# Check the new table structure
\d user_preferences

# Exit
\q
```

### Step 3.3: View the Generated Migration

```bash
# Find the latest migration
ls -la alembic/versions/ | tail -n 2

# View it
cat alembic/versions/*user_preferences*.py
```

---

## 🛠️ Part 4: Manual Migration (When Auto-Migration is Off)

Sometimes you want to control when migrations happen:

### Step 4.1: Turn Off Auto-Migration
```yaml
# docker-compose.dev.yml
MIGRATION_WATCHER: false
AUTO_GENERATE: false
AUTO_APPLY: false
```

### Step 4.2: Make a Model Change

Add a field to UserPreference:
```python
# Add this line to UserPreference class
timezone = Column(String(50), default="UTC")
```

### Step 4.3: Generate Migration Manually

```bash
# Option 1: Quick script (easiest)
docker-compose exec backend ./scripts/quick_migrate.sh "Added timezone to preferences"

# Option 2: Using manage.py
docker-compose exec backend python manage.py migrate generate "Added timezone field"
docker-compose exec backend python manage.py migrate upgrade

# Option 3: Using Alembic directly
docker-compose exec backend alembic revision --autogenerate -m "Added timezone"
docker-compose exec backend alembic upgrade head
```

---

## ↩️ Part 5: Rolling Back Changes

Made a mistake? No problem!

### Step 5.1: View Migration History
```bash
docker-compose exec backend python manage.py migrate history
```

**Output:**
```
3f4a5b6c7d8e: Added timezone field (current)
2e3d4c5b6a79: Added user preferences table
1a2b3c4d5e6f: Initial database schema
```

### Step 5.2: Rollback Last Migration
```bash
# Rollback one step
docker-compose exec backend python manage.py migrate downgrade --steps 1
```

**You'll see:**
```
Creating backup...
✓ Backup created: backups/backup_20240819_144530.sql
Rolling back 1 migration(s)...
✓ Rolled back 1 migration(s)
```

### Step 5.3: Fix and Reapply

1. Fix your model
2. Generate new migration
3. Apply it

```bash
docker-compose exec backend ./scripts/quick_migrate.sh "Fixed timezone field"
```

---

## 🚢 Part 6: Production Deployment

### Step 6.1: Test Locally First

```bash
# Reset your local database to match production
docker-compose exec backend ./scripts/reset_migrations.sh

# Apply all migrations fresh
docker-compose exec backend alembic upgrade head

# Run tests
docker-compose exec backend pytest
```

### Step 6.2: Commit Your Changes

```bash
git add -A
git commit -m "feat: Add user preferences with auto-migration"
git push origin main
```

### Step 6.3: Railway Auto-Deployment

Railway will automatically:
1. ✅ Detect new deployment
2. ✅ Check for migrations
3. ✅ Create backup
4. ✅ Apply migrations
5. ✅ Start application

### Step 6.4: Monitor Deployment

Check Railway logs:
```
[INFO] Found 1 pending migration(s)
[INFO] Creating database backup...
[SUCCESS] Database backup created: /app/backups/production/pre_migration_20240819.sql
[INFO] Applying pending migrations...
[SUCCESS] Migrations applied successfully
[INFO] New database version: 3f4a5b6c7d8e
[SUCCESS] Health checks: OK
[INFO] Starting application server...
```

---

## 🎓 Part 7: Advanced Tips

### Tip 1: Dry Run (See SQL Without Applying)
```bash
docker-compose exec backend python manage.py migrate upgrade --dry-run
```

### Tip 2: Create Empty Migration for Custom SQL
```bash
docker-compose exec backend alembic revision -m "Custom data migration"
# Then edit the file in alembic/versions/
```

### Tip 3: Merge Conflicting Migrations
```bash
docker-compose exec backend alembic merge -m "Merge branches" rev1 rev2
```

### Tip 4: Check for Model/Database Differences
```bash
docker-compose exec backend alembic check
```

---

## ✅ Summary - What You Learned

1. ✅ How to enable auto-migration
2. ✅ How to create models that trigger migrations
3. ✅ How to verify migrations worked
4. ✅ How to manually control migrations
5. ✅ How to rollback when needed
6. ✅ How to deploy to production safely

---

## 🤔 Common Questions

**Q: How often should I create migrations?**  
A: Every time you change a model! Small, frequent migrations are better than large ones.

**Q: What if I forget to create a migration?**  
A: The auto-watcher will catch it, or your tests will fail.

**Q: Can I edit a migration after it's created?**  
A: Yes, but only BEFORE applying it. Never edit applied migrations.

**Q: How do I handle data migrations?**  
A: Create a manual migration and add data manipulation in the `upgrade()` function.

---

## 📚 Next Steps

- Read the [Troubleshooting Guide](TROUBLESHOOTING.md) for common issues
- Check the [Command Cheat Sheet](CHEAT_SHEET.md) for quick reference
- Learn about [Best Practices](BEST_PRACTICES.md) for production

**Congratulations! You're now a migration expert! 🎉**