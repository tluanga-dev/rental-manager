# Audit Logging System Documentation

## Overview
The Rental Manager application includes a comprehensive audit logging system that tracks all security-related events and user activities across the platform.

## Architecture

### Database Schema

#### Security Audit Logs Table
```sql
security_audit_logs
├── id (UUID) - Primary key
├── user_id (UUID) - User who performed the action
├── user_name (VARCHAR) - Username for quick reference
├── action (VARCHAR) - Type of action performed
├── resource (VARCHAR) - Resource being accessed
├── resource_id (VARCHAR) - Specific resource identifier
├── details (JSONB) - Additional context data
├── ip_address (VARCHAR) - Client IP address
├── user_agent (TEXT) - Browser/client information
├── success (BOOLEAN) - Whether action succeeded
├── error_message (TEXT) - Error details if failed
├── timestamp (TIMESTAMP) - When event occurred
└── Standard audit fields (created_at, updated_at, etc.)
```

#### Supporting Tables
- `session_tokens` - Tracks active user sessions
- `ip_whitelist` - Manages allowed IP addresses

### Backend Implementation

#### Service Layer (`app/modules/security/services.py`)
```python
class SecurityService:
    async def log_security_event(
        user_id: str,
        user_name: str,
        action: str,
        resource: str,
        **kwargs
    ) -> None
```

#### Repository Layer (`app/modules/security/repository.py`)
```python
class SecurityRepository:
    async def get_recent_logs(limit, filters)
    async def log_security_event(event_data)
```

#### API Endpoints
- `GET /api/security/audit-logs` - Retrieve audit logs with filters
- `GET /api/security/stats` - Security statistics dashboard

### Frontend Implementation

#### Audit Page Location
- **URL**: `/admin/audit`
- **File**: `src/app/admin/audit/page.tsx`

#### Key Features
1. **Real-time Dashboard**
   - Total events counter
   - Success rate percentage
   - Active users count
   - Recent failures alert
   - Critical events tracking

2. **Advanced Filtering**
   - Date range selection (Today, 24h, 7d, 30d, Custom)
   - Action type filtering
   - Resource filtering
   - Success/failure toggle
   - Full-text search

3. **Data Export**
   - CSV format export
   - JSON format export
   - Timestamped filenames

4. **Categorization**
   - Security events (auth, users, roles, permissions)
   - Data events (customers, inventory, rentals)
   - System events (backup, config, audit)

## Event Types

### Authentication Events
- `LOGIN_SUCCESS` - Successful user login
- `LOGIN_FAILED` - Failed login attempt
- `LOGOUT` - User logout
- `TOKEN_REFRESH` - JWT token refreshed
- `PASSWORD_CHANGED` - Password modification

### User Management
- `USER_CREATED` - New user account created
- `USER_UPDATED` - User details modified
- `USER_DELETED` - User account removed
- `USER_ACTIVATED` - Account activated
- `USER_DEACTIVATED` - Account deactivated

### Role & Permission Events
- `ROLE_CREATED` - New role defined
- `ROLE_UPDATED` - Role modified
- `ROLE_DELETED` - Role removed
- `ROLE_ASSIGNED` - Role assigned to user
- `ROLE_REMOVED` - Role removed from user
- `PERMISSION_GRANTED` - Permission added
- `PERMISSION_REVOKED` - Permission removed

### Data Operations
- `CREATE` - Record creation
- `UPDATE` - Record modification
- `DELETE` - Record deletion
- `EXPORT` - Data export operation
- `IMPORT` - Data import operation

### System Events
- `BACKUP_CREATED` - System backup performed
- `BACKUP_RESTORED` - Backup restoration
- `CONFIG_CHANGED` - Configuration modified
- `MAINTENANCE_MODE` - Maintenance status change

## Usage Examples

### Logging an Event (Backend)

```python
# In any service or route
from app.modules.security.services import SecurityService

async def create_user(user_data, current_user, db):
    service = SecurityService(db)
    
    # Create user logic...
    
    # Log the event
    await service.log_security_event(
        user_id=str(current_user.id),
        user_name=current_user.username,
        action="USER_CREATED",
        resource="users",
        resource_id=str(new_user.id),
        details={
            "new_username": new_user.username,
            "role": new_user.role
        },
        ip_address=request.client.host,
        success=True
    )
```

### Querying Audit Logs (API)

```bash
# Get recent audit logs
curl -X GET "https://api.example.com/api/security/audit-logs?limit=100" \
  -H "Authorization: Bearer <token>"

# Filter by action
curl -X GET "https://api.example.com/api/security/audit-logs?action=LOGIN_FAILED&limit=50" \
  -H "Authorization: Bearer <token>"

# Filter by resource
curl -X GET "https://api.example.com/api/security/audit-logs?resource=users&limit=100" \
  -H "Authorization: Bearer <token>"
```

### Frontend Integration

```typescript
// Using the security API service
import { securityApi } from '@/services/api/security';

// Fetch audit logs
const logs = await securityApi.getAuditLogs({
  limit: 100,
  action: 'LOGIN_FAILED',
  success_only: false
});

// Export logs
const exportLogs = (format: 'csv' | 'json') => {
  // Implementation in audit page
};
```

## Security Considerations

### Access Control
- Only users with `admin` or `superuser` roles can access audit logs
- API endpoints protected by JWT authentication
- Role-based permission checks

### Data Retention
- Consider implementing automatic archival of old logs
- Define retention policies based on compliance requirements
- Regular backup of audit data

### Performance
- Indexed columns for fast querying:
  - `action`, `resource`, `timestamp`
  - Composite indexes for common query patterns
- Consider partitioning for large datasets
- Implement pagination for API responses

### Privacy
- Avoid logging sensitive data in details field
- Implement data masking for PII
- Follow GDPR/compliance requirements

## Monitoring & Alerts

### Key Metrics to Monitor
1. **Failed Login Attempts**
   - Threshold: >5 attempts in 5 minutes
   - Action: Account lockout consideration

2. **Delete Operations**
   - Monitor frequency of DELETE actions
   - Alert on bulk deletions

3. **Permission Changes**
   - Track role and permission modifications
   - Alert on critical permission grants

4. **Unusual Activity**
   - Off-hours access patterns
   - Unusual IP addresses
   - Rapid API calls

### Setting Up Alerts

```python
# Example alert check
async def check_failed_logins(db):
    service = SecurityService(db)
    
    # Get failed logins in last 5 minutes
    recent_failures = await service.get_audit_logs(
        action="LOGIN_FAILED",
        since=datetime.now() - timedelta(minutes=5)
    )
    
    # Group by user
    failures_by_user = {}
    for log in recent_failures:
        user = log.user_name
        failures_by_user[user] = failures_by_user.get(user, 0) + 1
    
    # Alert if threshold exceeded
    for user, count in failures_by_user.items():
        if count > 5:
            # Send alert
            await send_security_alert(f"User {user} has {count} failed login attempts")
```

## Testing

### Test Script
A test script is provided at `test_audit_logging.py` to verify the audit system:

```bash
python test_audit_logging.py
```

This script:
- Verifies table existence
- Inserts test audit logs
- Tests various query patterns
- Validates data integrity

### Manual Testing Checklist
- [ ] Login and verify LOGIN_SUCCESS event
- [ ] Failed login and verify LOGIN_FAILED event
- [ ] Create a user and verify USER_CREATED event
- [ ] Modify roles and verify ROLE events
- [ ] Test filtering by date range
- [ ] Test search functionality
- [ ] Export data in CSV format
- [ ] Export data in JSON format
- [ ] Verify real-time updates

## Troubleshooting

### Common Issues

1. **No audit logs appearing**
   - Check if migrations have run: `alembic current`
   - Verify table exists: Check `security_audit_logs` table
   - Check API connectivity

2. **Performance issues**
   - Review indexes: `\d security_audit_logs` in psql
   - Consider implementing pagination
   - Archive old logs

3. **Export not working**
   - Check browser console for errors
   - Verify CORS settings
   - Check file download permissions

### Debug Queries

```sql
-- Check total audit logs
SELECT COUNT(*) FROM security_audit_logs;

-- Recent failed events
SELECT * FROM security_audit_logs 
WHERE success = false 
ORDER BY timestamp DESC 
LIMIT 10;

-- Events by resource
SELECT resource, COUNT(*) as count 
FROM security_audit_logs 
GROUP BY resource 
ORDER BY count DESC;

-- User activity summary
SELECT user_name, 
       COUNT(*) as total_events,
       SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
       SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed
FROM security_audit_logs 
GROUP BY user_name;
```

## Future Enhancements

### Planned Features
1. **Real-time notifications** - WebSocket integration for live updates
2. **Advanced analytics** - Machine learning for anomaly detection
3. **Compliance reports** - Automated compliance reporting
4. **Integration with SIEM** - Export to security information systems
5. **Session replay** - Reconstruct user sessions from audit logs

### Performance Optimizations
1. **Elasticsearch integration** - For full-text search
2. **Data archival** - Automatic archival of old logs
3. **Caching layer** - Redis caching for frequent queries
4. **Batch processing** - Async log processing queue

## Compliance & Standards

### Supported Standards
- **GDPR** - Data protection and privacy
- **SOC 2** - Security controls
- **ISO 27001** - Information security
- **PCI DSS** - Payment card security (if applicable)

### Audit Requirements
- Immutable log records
- Tamper-evident storage
- Time synchronization (NTP)
- Regular audit reviews
- Access logging for audit logs themselves

## Contact & Support

For questions or issues related to the audit logging system:
- Technical Lead: [Your Name]
- Documentation: This guide
- Issue Tracking: GitHub Issues
- Security Concerns: security@yourcompany.com

---

*Last Updated: August 2025*
*Version: 1.0.0*