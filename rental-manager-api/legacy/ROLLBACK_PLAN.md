# Rental Module Rollback Plan

## Overview
This document provides detailed procedures for rolling back the rental module changes in case of critical issues in production. The plan ensures minimal downtime and data integrity during rollback operations.

## Rollback Triggers

### Immediate Rollback Required
The following conditions require immediate rollback:
1. **Error rate > 5%** - System experiencing high failure rate
2. **Response time > 5 seconds** - Severe performance degradation
3. **Database connection failures** - Unable to connect to database
4. **Critical business logic failure** - Core rental operations failing
5. **Data corruption detected** - Integrity issues found
6. **Security breach detected** - Unauthorized access or data exposure

### Rollback Decision Matrix

| Severity | Error Rate | Response Time | Action | Timeframe |
|----------|------------|---------------|--------|-----------|
| Critical | > 5% | > 5s | Immediate Rollback | < 5 minutes |
| High | 3-5% | 3-5s | Monitor & Assess | 15 minutes |
| Medium | 1-3% | 1-3s | Investigate | 30 minutes |
| Low | < 1% | < 1s | Log & Continue | N/A |

---

## Pre-Rollback Checklist

### Before initiating rollback:
- [ ] Confirm the issue severity and scope
- [ ] Document current error patterns
- [ ] Take screenshot of monitoring dashboard
- [ ] Preserve error logs
- [ ] Notify stakeholders
- [ ] Prepare rollback command sequence
- [ ] Verify backup availability
- [ ] Check database state

---

## Rollback Procedures

### Method 1: Docker/Kubernetes Rollback (Recommended)

#### For Kubernetes Deployment:
```bash
# 1. Check current deployment status
kubectl get deployments -n production
kubectl describe deployment rental-api -n production

# 2. View rollout history
kubectl rollout history deployment/rental-api -n production

# 3. Rollback to previous version
kubectl rollout undo deployment/rental-api -n production

# OR rollback to specific revision
kubectl rollback undo deployment/rental-api -n production --to-revision=2

# 4. Monitor rollback status
kubectl rollout status deployment/rental-api -n production

# 5. Verify pods are running
kubectl get pods -n production
kubectl logs -f deployment/rental-api -n production
```

#### For Docker Deployment:
```bash
# 1. Stop current container
docker stop rental-api-prod
docker rm rental-api-prod

# 2. Run previous version
docker run -d \
  --name rental-api-prod \
  -p 8000:8000 \
  -e DATABASE_URL=$DATABASE_URL \
  -e REDIS_URL=$REDIS_URL \
  rental-api:previous-version

# 3. Verify container is running
docker ps
docker logs -f rental-api-prod
```

### Method 2: Git Revert Rollback

```bash
# 1. Navigate to backend directory
cd /path/to/rental-manager-backend

# 2. Fetch latest changes
git fetch origin

# 3. Create rollback branch
git checkout -b rollback/rental-module-$(date +%Y%m%d-%H%M%S)

# 4. Revert the rental module refactoring commit
git revert 31779dc  # Replace with actual commit hash

# 5. Push rollback branch
git push origin rollback/rental-module-$(date +%Y%m%d-%H%M%S)

# 6. Create and merge emergency PR
# OR directly push to main if emergency bypass is enabled
git checkout main
git merge rollback/rental-module-$(date +%Y%m%d-%H%M%S)
git push origin main

# 7. Trigger deployment
./deploy.sh production
```

### Method 3: Manual File Restoration

```bash
# 1. Backup current (problematic) state
tar -czf rental-module-backup-$(date +%Y%m%d-%H%M%S).tar.gz \
  app/modules/transactions/rentals/

# 2. Restore from backup
cd app/modules/transactions/
rm -rf rentals/
tar -xzf /backups/rentals-module-pre-refactor.tar.gz

# 3. Restart application
supervisorctl restart rental-api
# OR
systemctl restart rental-api
# OR
pm2 restart rental-api
```

---

## Database Rollback (if needed)

### Check if database changes need rollback:
```sql
-- Check for any schema changes
SELECT * FROM alembic_version;

-- If database migration was applied, rollback
```

### Rollback database migrations:
```bash
# 1. Check current migration
alembic current

# 2. Rollback to previous migration
alembic downgrade -1

# OR rollback to specific revision
alembic downgrade abc123def456

# 3. Verify rollback
alembic current
```

### Database integrity check:
```sql
-- Verify critical tables
SELECT COUNT(*) FROM transaction_headers WHERE created_at > NOW() - INTERVAL '1 hour';
SELECT COUNT(*) FROM rental_lifecycles WHERE created_at > NOW() - INTERVAL '1 hour';

-- Check for orphaned records
SELECT * FROM transaction_lines 
WHERE header_id NOT IN (SELECT id FROM transaction_headers);

-- Verify foreign key constraints
SELECT conname, conrelid::regclass, confrelid::regclass 
FROM pg_constraint 
WHERE contype = 'f' AND connamespace = 'public'::regnamespace;
```

---

## Post-Rollback Verification

### Step 1: Health Checks
```bash
# Run health check script
./scripts/production_health_check.sh

# Check specific endpoints
curl -X GET https://api.production.com/api/health
curl -X GET https://api.production.com/api/transactions/rentals/
```

### Step 2: Functional Verification
```bash
# Test core functionality
python3 tests/production/test_rental_core_production.py

# Quick smoke test
curl -X GET https://api.production.com/api/transactions/rentals/active \
  -H "Authorization: Bearer $API_KEY"
```

### Step 3: Performance Verification
```bash
# Check response times
for i in {1..10}; do
  time curl -s -o /dev/null https://api.production.com/api/transactions/rentals/
done
```

### Step 4: Monitor Metrics
- Error rate should drop below 0.1%
- Response time should be < 500ms
- Database connections should be stable
- Memory usage should normalize

---

## Communication Plan

### During Rollback:
1. **T+0 minutes**: Detect issue, initiate rollback
2. **T+2 minutes**: Send initial notification
   ```
   Subject: [URGENT] Rental Module Rollback In Progress
   Status: Rollback initiated due to [ISSUE]
   Impact: Rental operations may be temporarily unavailable
   ETA: 15 minutes
   ```

3. **T+5 minutes**: Update on rollback progress
4. **T+10 minutes**: Verification in progress
5. **T+15 minutes**: Final status update

### Stakeholder Notification List:
- Engineering Team: engineering@company.com
- Operations: ops@company.com
- Product Team: product@company.com
- Customer Support: support@company.com
- Executive Team: executives@company.com (if critical)

### Communication Templates:

#### Initial Alert:
```
🔴 PRODUCTION ISSUE DETECTED

System: Rental Module
Severity: Critical
Issue: [Description]
Action: Initiating rollback
Started: [Timestamp]
ETA: 15 minutes

Updates will follow every 5 minutes.
```

#### Progress Update:
```
🟡 ROLLBACK IN PROGRESS

System: Rental Module
Progress: [X]% complete
Current Step: [Description]
ETA: [X] minutes remaining
```

#### Completion Notice:
```
🟢 ROLLBACK COMPLETE

System: Rental Module
Status: Operational
Rollback Duration: [X] minutes
Issue Resolution: [Description]
Next Steps: [Post-mortem scheduled]
```

---

## Recovery Procedures

### After Successful Rollback:

1. **Stabilization Period** (30 minutes)
   - Monitor all metrics closely
   - No new deployments
   - Gather diagnostic data

2. **Root Cause Analysis** (2-4 hours)
   - Review error logs
   - Analyze code changes
   - Identify failure point
   - Document findings

3. **Fix Development** (varies)
   - Develop fix for identified issues
   - Enhanced testing
   - Staging validation

4. **Re-deployment Planning**
   - Schedule maintenance window
   - Prepare enhanced monitoring
   - Create deployment checklist
   - Notify stakeholders

---

## Rollback Testing

### Test rollback procedures regularly:
```bash
# Monthly rollback drill in staging
./scripts/rollback_drill.sh staging

# Quarterly production simulation
./scripts/rollback_simulation.sh
```

### Rollback Time Targets:
- Detection to Decision: < 2 minutes
- Decision to Initiation: < 1 minute
- Rollback Execution: < 10 minutes
- Verification: < 5 minutes
- **Total Target: < 18 minutes**

---

## Automated Rollback Script

Create `/scripts/emergency_rollback.sh`:
```bash
#!/bin/bash
set -e

ENVIRONMENT=$1
REASON=$2

if [ -z "$ENVIRONMENT" ] || [ -z "$REASON" ]; then
    echo "Usage: ./emergency_rollback.sh [production|staging] 'reason'"
    exit 1
fi

echo "🔴 EMERGENCY ROLLBACK INITIATED"
echo "Environment: $ENVIRONMENT"
echo "Reason: $REASON"
echo "Timestamp: $(date)"

# Log rollback initiation
echo "$(date): Rollback initiated - $REASON" >> /var/log/rollbacks.log

# Kubernetes rollback
if [ "$ENVIRONMENT" = "production" ]; then
    kubectl rollout undo deployment/rental-api -n production
    kubectl rollout status deployment/rental-api -n production
    
    # Run health check
    sleep 30
    ./scripts/production_health_check.sh
    
    # Send notifications
    ./scripts/notify_rollback.sh "$REASON"
fi

echo "✅ Rollback complete"
```

---

## Lessons Learned Log

### Previous Rollback Incidents:
| Date | Issue | Root Cause | Resolution | Time to Recover |
|------|-------|------------|------------|-----------------|
| Example | High error rate | Memory leak | Rollback + Fix | 15 minutes |

### Improvements Implemented:
1. Automated health checks
2. Faster rollback procedures
3. Enhanced monitoring
4. Better communication templates

---

## Appendix

### A. Emergency Contacts
- On-Call Engineer: +1-XXX-XXX-XXXX
- Database Admin: +1-XXX-XXX-XXXX
- DevOps Lead: +1-XXX-XXX-XXXX
- VP Engineering: +1-XXX-XXX-XXXX

### B. Critical System Dependencies
- PostgreSQL Database
- Redis Cache
- External Payment Gateway
- Email Service
- SMS Service

### C. Rollback Checklist Template
```
[ ] Issue confirmed and documented
[ ] Stakeholders notified
[ ] Rollback method selected
[ ] Backup created
[ ] Rollback executed
[ ] Health checks passed
[ ] Performance verified
[ ] Monitoring active
[ ] Post-mortem scheduled
[ ] Documentation updated
```

### D. Post-Mortem Template
1. **Incident Summary**
2. **Timeline of Events**
3. **Root Cause Analysis**
4. **Impact Assessment**
5. **What Went Well**
6. **What Could Be Improved**
7. **Action Items**
8. **Lessons Learned**

---

## Document Version
- **Version**: 1.0
- **Last Updated**: 2024-01-09
- **Next Review**: 2024-02-09
- **Owner**: DevOps Team
- **Approved By**: Engineering Leadership