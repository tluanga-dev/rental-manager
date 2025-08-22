# 🔄 Migration Workflows - Visual Guide

## 📊 Overview: How Migrations Work

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Your Models   │────▶│   Migration     │────▶│    Database     │
│   (Python)      │     │   Files         │     │    (PostgreSQL) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        ▲                        ▲                        ▲
        │                        │                        │
    You edit              Alembic creates          Alembic applies
```

---

## 🚀 Workflow 1: Automatic Migration (Development)

```
┌────────────────────────────────────────────────────────────┐
│                    AUTO-MIGRATION WORKFLOW                  │
└────────────────────────────────────────────────────────────┘

     YOU                    SYSTEM                   DATABASE
      │                        │                         │
      │                        │                         │
1. Edit│model.py              │                         │
      ├──────────────────────▶│                         │
      │                        │                         │
      │                   2. Detect                     │
      │                    change                       │
      │                    (5 sec)                      │
      │                        │                         │
      │                   3. Generate                   │
      │                    migration                    │
      │                     file                        │
      │                        │                         │
      │                   4. Create                     │
      │                    backup                       │
      │                        ├────────────────────────▶│
      │                        │                         │
      │                   5. Apply                      │
      │                    migration                    │
      │                        ├────────────────────────▶│
      │                        │                         │
      │                   6. Notify                     │
      │◀───────────────────────┤                         │
      │  "✓ Migration applied" │                         │
      │                        │                         │
      ▼                        ▼                         ▼
```

**Config Required:**
```yaml
MIGRATION_WATCHER: true
AUTO_GENERATE: true
AUTO_APPLY: true
```

---

## 🔧 Workflow 2: Manual Migration (Controlled)

```
┌────────────────────────────────────────────────────────────┐
│                    MANUAL MIGRATION WORKFLOW                │
└────────────────────────────────────────────────────────────┘

     YOU                    ALEMBIC                  DATABASE
      │                        │                         │
      │                        │                         │
1. Edit│model.py              │                         │
      │                        │                         │
      │                        │                         │
2. Run│generate command       │                         │
      ├──────────────────────▶│                         │
      │                        │                         │
      │                   3. Scan models                │
      │                    vs database                  │
      │                        ├────────────────────────▶│
      │                        │◀────────────────────────┤
      │                        │                         │
      │                   4. Create                     │
      │◀───────────────────────┤migration file          │
      │                        │                         │
5. Review migration file       │                         │
      │                        │                         │
      │                        │                         │
6. Run│upgrade command        │                         │
      ├──────────────────────▶│                         │
      │                        │                         │
      │                   7. Apply changes              │
      │                        ├────────────────────────▶│
      │                        │                         │
      │                   8. Success!                   │
      │◀───────────────────────┤                         │
      │                        │                         │
      ▼                        ▼                         ▼
```

**Commands:**
```bash
./scripts/quick_migrate.sh "Description"
# OR
python manage.py migrate generate "Description"
python manage.py migrate upgrade
```

---

## 🚢 Workflow 3: Production Deployment (Railway)

```
┌────────────────────────────────────────────────────────────┐
│                 PRODUCTION DEPLOYMENT WORKFLOW              │
└────────────────────────────────────────────────────────────┘

   DEVELOPER              GITHUB              RAILWAY           DATABASE
      │                     │                    │                 │
      │                     │                    │                 │
1. git│push                │                    │                 │
      ├────────────────────▶│                    │                 │
      │                     │                    │                 │
      │                 2. Webhook               │                 │
      │                     ├───────────────────▶│                 │
      │                     │                    │                 │
      │                     │              3. Build               │
      │                     │                Docker               │
      │                     │                image               │
      │                     │                    │                 │
      │                     │              4. Check               │
      │                     │              migrations             │
      │                     │                    ├────────────────▶│
      │                     │                    │◀────────────────┤
      │                     │                    │                 │
      │                     │              5. Backup              │
      │                     │              database              │
      │                     │                    ├────────────────▶│
      │                     │                    │                 │
      │                     │              6. Apply               │
      │                     │              migrations             │
      │                     │                    ├────────────────▶│
      │                     │                    │                 │
      │                     │              7. Health              │
      │                     │                check               │
      │                     │                    ├────────────────▶│
      │                     │                    │◀────────────────┤
      │                     │                    │                 │
      │                     │              8. Start               │
      │                     │                 app                │
      │                     │                    │                 │
      │                 9. Success               │                 │
      │                     │◀───────────────────┤                 │
      │◀────────────────────┤                    │                 │
      │  "Deployed!"        │                    │                 │
      ▼                     ▼                    ▼                 ▼
```

---

## ↩️ Workflow 4: Rollback Process

```
┌────────────────────────────────────────────────────────────┐
│                      ROLLBACK WORKFLOW                      │
└────────────────────────────────────────────────────────────┘

                    PROBLEM DETECTED!
                           │
                           ▼
                  ┌─────────────────┐
                  │ Migration Failed │
                  └─────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Backup    │
                    │  Available? │
                    └─────────────┘
                      ╱         ╲
                    YES          NO
                    ╱              ╲
                   ▼                ▼
          ┌──────────────┐    ┌──────────────┐
          │   Restore    │    │   Rollback   │
          │  from backup │    │  migration   │
          └──────────────┘    └──────────────┘
                   │                  │
                   │                  ▼
                   │          ┌──────────────┐
                   │          │  Downgrade   │
                   │          │   by steps   │
                   │          └──────────────┘
                   │                  │
                   ▼                  ▼
          ┌──────────────────────────────┐
          │      Fix the problem         │
          └──────────────────────────────┘
                           │
                           ▼
          ┌──────────────────────────────┐
          │    Generate new migration    │
          └──────────────────────────────┘
                           │
                           ▼
          ┌──────────────────────────────┐
          │      Apply migration         │
          └──────────────────────────────┘
                           │
                           ▼
                     ✅ FIXED!
```

**Commands:**
```bash
# Option 1: Restore from backup
python manage.py db restore backups/latest.sql

# Option 2: Rollback migration
python manage.py migrate downgrade --steps 1
```

---

## 🔍 Workflow 5: Development Cycle

```
┌─────────────────────────────────────────────────────┐
│              TYPICAL DEVELOPMENT DAY                 │
└─────────────────────────────────────────────────────┘

 MORNING                CODING               EVENING
    │                     │                     │
    ▼                     ▼                     ▼
┌────────┐          ┌──────────┐          ┌────────┐
│ Start  │          │  Write   │          │ Commit │
│ Docker │          │  Code    │          │ & Push │
└────────┘          └──────────┘          └────────┘
    │                     │                     │
    ▼                     ▼                     ▼
┌────────┐          ┌──────────┐          ┌────────┐
│ Check  │          │  Models  │          │ Deploy │
│ Status │          │ Changed? │          │  to    │
└────────┘          └──────────┘          │Railway │
    │                  ╱    ╲              └────────┘
    ▼                YES     NO                │
┌────────┐            │       │                ▼
│  All   │            ▼       ▼           ┌────────┐
│  Good  │     ┌──────────┐  Continue    │  Auto  │
└────────┘     │   Auto   │   coding     │Deploy! │
               │ Migration│               └────────┘
               └──────────┘
                     │
                     ▼
               ┌──────────┐
               │ Continue │
               │  coding  │
               └──────────┘
```

---

## 🎯 Decision Tree: Which Workflow to Use?

```
                     START
                       │
                       ▼
              ┌─────────────────┐
              │  Environment?   │
              └─────────────────┘
                   ╱       ╲
            Development   Production
                ╱              ╲
               ▼                ▼
        ┌──────────┐      ┌──────────┐
        │Frequency?│      │  Deploy  │
        └──────────┘      │    via   │
           ╱    ╲         │  Railway │
      Often    Rarely     └──────────┘
         ╱        ╲
        ▼          ▼
┌──────────┐  ┌──────────┐
│   Auto   │  │  Manual  │
│Migration │  │Migration │
└──────────┘  └──────────┘

RESULT:
• Development + Frequent changes = Auto-migration
• Development + Rare changes = Manual migration  
• Production = Always via deployment pipeline
```

---

## 📋 Migration States Diagram

```
┌────────────────────────────────────────────────────┐
│                 MIGRATION STATES                    │
└────────────────────────────────────────────────────┘

    [No Database]
         │
         ▼
    [Empty Database] ──────┐
         │                 │
         ▼                 ▼
    [Initial Migration]   [Import Existing]
         │                 │
         └────────┬────────┘
                  ▼
            [Base State]
                  │
                  ▼
         [Applied Migrations]
                  │
        ┌─────────┼─────────┐
        ▼         ▼         ▼
    [Current] [Pending] [Conflict]
        │         │         │
        │         ▼         ▼
        │    [Apply]   [Resolve]
        │         │         │
        └─────────┼─────────┘
                  ▼
             [Up to Date]
```

---

## 🔗 Quick Reference: File Flow

```
Your Changes Flow Through These Files:

1. app/modules/*/models.py     (You edit here)
           ↓
2. alembic/versions/*.py       (Migration created here)
           ↓
3. alembic_version table       (Version tracked here)
           ↓
4. Database tables             (Changes applied here)


Backup Flow:

Database ──────▶ backups/backup_timestamp.sql
   ▲                          │
   │                          ▼
   └───────── Restore ────────┘
```

---

## 📊 Monitoring Dashboard (What to Watch)

```
┌─────────────────────────────────────────────┐
│           MIGRATION DASHBOARD                │
├─────────────────────────────────────────────┤
│                                               │
│  Status: ● UP TO DATE                        │
│                                               │
│  Current Version:  3f4a5b6c7d8e              │
│  Head Version:     3f4a5b6c7d8e              │
│  Pending:          0 migrations              │
│                                               │
│  Auto-Migration:   ✓ Enabled                 │
│  Auto-Generate:    ✓ Enabled                 │
│  Auto-Apply:       ✓ Enabled                 │
│  Backups:          ✓ Enabled                 │
│                                               │
│  Last Migration:   2024-08-19 14:30:22       │
│  Last Backup:      2024-08-19 14:30:20       │
│                                               │
│  Health Checks:                              │
│    Database:       ✓ Connected               │
│    Tables:         ✓ 47 tables               │
│    Migrations:     ✓ Valid                   │
│                                               │
└─────────────────────────────────────────────┘

Check with: python manage.py migrate status
```

---

## 🎓 Key Takeaways

1. **Development** = Let auto-migration handle it
2. **Production** = Railway handles it automatically
3. **Problems** = Always have backups
4. **Rollback** = Easy with one command
5. **Monitor** = Check status regularly

**Remember:** The system is designed to be safe and automatic. Trust the process! 🚀