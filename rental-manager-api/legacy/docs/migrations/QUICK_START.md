# 🚀 Migration Quick Start Guide

> **Time to get started:** 5 minutes  
> **Difficulty:** Beginner  
> **Prerequisites:** Docker installed

## 🎯 What You'll Learn
- How to make database changes safely
- How to apply changes automatically
- How to undo changes if something goes wrong

---

## 🏃 Fastest Way to Start (Docker)

### Step 1: Start Everything
```bash
cd rental-manager-backend
docker-compose up -d
```
✅ **Done!** Migrations are now automatic.

### Step 2: Make Your Model Changes
Edit any model file in `app/modules/*/models.py`

Example - Add a field to User model:
```python
# app/modules/users/models.py
class User(Base):
    # ... existing fields ...
    phone_number = Column(String(20), nullable=True)  # New field!
```

### Step 3: Migration Happens Automatically! 
If auto-migration is enabled (default in development), just wait 5 seconds.

**Not automatic?** Run this:
```bash
docker-compose exec backend ./scripts/quick_migrate.sh "Added phone number to user"
```

---

## 💻 Local Development (No Docker)

### Step 1: Check Everything is OK
```bash
python manage.py migrate status
```

You should see:
```
✅ Database Connected: True
✅ Current Revision: abc123...
✅ Up to Date: True
```

### Step 2: Make Your Model Changes
Edit your model file, then:

```bash
# Quick way - does everything for you
./scripts/quick_migrate.sh "Description of what you changed"
```

**OR** Step by step:
```bash
# 1. Generate migration file
python manage.py migrate generate "Added phone field"

# 2. Apply it
python manage.py migrate upgrade
```

### Step 3: Verify It Worked
```bash
python manage.py migrate status
```

---

## 🔄 Common Tasks

### See What Migrations Exist
```bash
python manage.py migrate history
```

### Undo Last Change (Rollback)
```bash
python manage.py migrate downgrade --steps 1
```

### Start Fresh (Nuclear Option ☢️)
```bash
# WARNING: Deletes ALL data!
./scripts/reset_migrations.sh
```

---

## 🚨 Something Went Wrong?

### Migration Failed?
```bash
# 1. Check what happened
python manage.py migrate status

# 2. Rollback the failed migration
python manage.py migrate downgrade --steps 1

# 3. Fix your model

# 4. Try again
./scripts/quick_migrate.sh "Fixed version"
```

### Database Out of Sync?
```bash
# This fixes most problems
python manage.py migrate repair
```

---

## 🎓 Next Steps

**Ready for more?** Check out:
- [Step-by-Step Tutorial](STEP_BY_STEP_TUTORIAL.md) - 15 minute deep dive
- [Command Cheat Sheet](CHEAT_SHEET.md) - All commands at a glance
- [Troubleshooting Guide](TROUBLESHOOTING.md) - When things go wrong

---

## 📝 Remember These 3 Commands

That's 90% of what you need:

1. **Make a change:** `./scripts/quick_migrate.sh "what changed"`
2. **Check status:** `python manage.py migrate status`
3. **Undo if needed:** `python manage.py migrate downgrade --steps 1`

**You're ready to go! 🎉**