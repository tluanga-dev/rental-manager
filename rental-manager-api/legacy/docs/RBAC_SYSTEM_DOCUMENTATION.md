# Role-Based Access Control (RBAC) System Documentation

## Overview

The Rental Manager application implements a comprehensive Role-Based Access Control (RBAC) system that provides fine-grained permission management across all system modules. This document describes the architecture, implementation, and usage of the RBAC system.

## Architecture

### Core Components

#### 1. **Permissions**
- Atomic units of authorization
- Resource-based with specific actions
- Risk levels: LOW, MEDIUM, HIGH, CRITICAL
- System and custom permissions supported

#### 2. **Roles**
- Collections of permissions
- System roles (protected) and custom roles
- Template-based for common use cases
- Hierarchical permission inheritance

#### 3. **Users**
- Can have multiple roles
- Effective permissions calculated from all assigned roles
- Superuser bypass for system administration

### Database Schema

```sql
-- Core RBAC Tables
users
├── id (UUID, PK)
├── username
├── email
├── is_superuser
└── roles (M2M via user_roles)

roles
├── id (UUID, PK)
├── name
├── description
├── template
├── is_system_role
├── can_be_deleted
├── is_active
└── permissions (M2M via role_permissions)

permissions
├── id (UUID, PK)
├── name
├── resource
├── action
├── description
├── risk_level
├── is_system_permission
└── is_active

-- Association Tables
user_roles
├── user_id (FK)
├── role_id (FK)
├── assigned_by
├── assigned_at
├── expires_at
└── is_active

role_permissions
├── role_id (FK)
├── permission_id (FK)
├── granted_by
└── granted_at
```

## Implementation Details

### Backend Implementation

#### Permission Enforcement

The system uses decorator-based permission enforcement at the route level:

```python
# Using the enhanced permission system
from app.core.permissions_enhanced import CustomerPermissions

@router.post("/", 
    dependencies=[CustomerPermissions.CREATE])
async def create_customer(...):
    """Requires CUSTOMER_CREATE permission"""
    pass

@router.get("/", 
    dependencies=[CustomerPermissions.VIEW])
async def list_customers(...):
    """Requires CUSTOMER_VIEW permission"""
    pass
```

#### Permission Checker Classes

1. **PermissionChecker**: Validates specific permissions
2. **RoleChecker**: Validates role assignments
3. **ResourceOwnerChecker**: Validates resource ownership

#### Module-Specific Permission Classes

Each business module has dedicated permission dependencies:
- `CustomerPermissions`
- `SupplierPermissions`
- `InventoryPermissions`
- `RentalPermissions`
- `PurchasePermissions`
- `SalesPermissions`
- `UserPermissions`
- `RolePermissions`
- `SystemPermissions`

### Frontend Implementation

#### Role Management UI

Located at `/admin/roles`:
- List all roles with filtering
- Create new roles with permission assignment
- Edit existing roles (non-system only)
- Delete custom roles
- View role details and assigned users

#### Permission Assignment Interface

- Visual permission selector grouped by resource
- Risk level indicators (color-coded)
- Bulk selection per resource
- Search and filter capabilities
- Template-based role creation

#### API Integration

Frontend uses the comprehensive RBAC API client:

```typescript
import { rbacApi } from '@/services/api/rbac';

// Role operations
await rbacApi.roles.list(filters);
await rbacApi.roles.create(roleData);
await rbacApi.roles.update(id, data);
await rbacApi.roles.delete(id);

// Permission operations
await rbacApi.permissions.list(filters);
await rbacApi.roles.assignPermissions(data);

// User role management
await rbacApi.userRoles.assign(data);
await rbacApi.userRoles.revoke(id);
```

## System Roles

### Pre-defined Roles

#### 1. **SUPER_ADMIN**
- Full system access
- All permissions granted
- Cannot be modified or deleted
- Template: `system`

#### 2. **ADMIN**
- Extensive system access
- All LOW, MEDIUM, HIGH risk permissions
- Excludes CRITICAL operations
- Template: `system`

#### 3. **MANAGER**
- Business management permissions
- Full access to customers, suppliers, inventory
- Reporting and analytics access
- Template: `management`

#### 4. **SUPERVISOR**
- Team management permissions
- Limited administrative access
- Operational oversight
- Template: `supervisor`

#### 5. **STAFF**
- Operational permissions
- Basic CRUD for business entities
- No administrative access
- Template: `operational`

#### 6. **ACCOUNTANT**
- Financial permissions
- Transaction management
- Reporting access
- Template: `financial`

#### 7. **WAREHOUSE**
- Inventory management
- Stock operations
- Location transfers
- Template: `warehouse`

#### 8. **CUSTOMER_SERVICE**
- Customer interaction
- Rental management
- Basic sales operations
- Template: `service`

#### 9. **AUDITOR**
- Read-only access to all modules
- Export capabilities
- Audit log access
- Template: `audit`

#### 10. **GUEST**
- Minimal view permissions
- Public information only
- Template: `guest`

## Permission Categories

### User Management
- `USER_VIEW`: View user information
- `USER_CREATE`: Create new users
- `USER_UPDATE`: Update user details
- `USER_DELETE`: Delete users
- `USER_ACTIVATE`: Activate/deactivate users
- `USER_RESET_PASSWORD`: Reset user passwords
- `USER_ASSIGN_ROLE`: Assign roles to users
- `USER_VIEW_PERMISSIONS`: View user permissions
- `USER_EXPORT`: Export user data

### Customer Management
- `CUSTOMER_VIEW`: View customers
- `CUSTOMER_CREATE`: Create customers
- `CUSTOMER_UPDATE`: Update customer information
- `CUSTOMER_DELETE`: Delete customers
- `CUSTOMER_BLACKLIST`: Blacklist customers
- `CUSTOMER_VIEW_TRANSACTIONS`: View customer transactions
- `CUSTOMER_VIEW_RENTALS`: View customer rentals
- `CUSTOMER_UPDATE_CREDIT`: Update customer credit
- `CUSTOMER_EXPORT`: Export customer data

### Inventory Management
- `INVENTORY_VIEW`: View inventory
- `INVENTORY_CREATE`: Create inventory items
- `INVENTORY_UPDATE`: Update inventory
- `INVENTORY_DELETE`: Delete inventory
- `INVENTORY_ADJUST`: Adjust inventory levels
- `INVENTORY_TRANSFER`: Transfer between locations
- `INVENTORY_VIEW_HISTORY`: View inventory history
- `INVENTORY_STOCK_TAKE`: Perform stock take
- `INVENTORY_EXPORT`: Export inventory data

### Rental Management
- `RENTAL_VIEW`: View rentals
- `RENTAL_CREATE`: Create rentals
- `RENTAL_UPDATE`: Update rentals
- `RENTAL_DELETE`: Delete rentals
- `RENTAL_RETURN`: Process returns
- `RENTAL_EXTEND`: Extend rental periods
- `RENTAL_CANCEL`: Cancel rentals
- `RENTAL_VIEW_HISTORY`: View rental history
- `RENTAL_APPLY_PENALTY`: Apply penalties
- `RENTAL_WAIVE_PENALTY`: Waive penalties
- `RENTAL_EXPORT`: Export rental data

### System Administration
- `SYSTEM_CONFIG`: Configure system settings
- `SYSTEM_VIEW_LOGS`: View system logs
- `SYSTEM_CLEAR_CACHE`: Clear system cache
- `SYSTEM_MAINTENANCE`: Perform maintenance
- `SYSTEM_BACKUP`: Create backups
- `SYSTEM_RESTORE`: Restore from backup

## Risk Levels

### LOW
- Read-only operations
- Basic data viewing
- Public information access
- Minimal security impact

### MEDIUM
- Standard CRUD operations
- User data modifications
- Business transactions
- Moderate security impact

### HIGH
- Sensitive operations
- Financial transactions
- Permission management
- Significant security impact

### CRITICAL
- System configuration
- User authentication
- Data deletion
- Maximum security impact

## Usage Examples

### Backend: Adding Permission Check to Route

```python
from app.core.permissions_enhanced import RequirePermissions

@router.post("/critical-operation",
    dependencies=[RequirePermissions("SYSTEM_CONFIG", "SYSTEM_MAINTENANCE")])
async def critical_operation(
    current_user: User = Depends(get_current_user)
):
    # User must have both permissions
    pass

@router.get("/reports",
    dependencies=[RequireAnyPermission("REPORT_VIEW", "ANALYTICS_VIEW")])
async def view_reports():
    # User needs at least one permission
    pass
```

### Frontend: Check User Permissions

```typescript
// In React component
import { useAuthStore } from '@/stores/auth';

function AdminPanel() {
  const { user, hasPermission } = useAuthStore();
  
  if (!hasPermission('SYSTEM_CONFIG')) {
    return <div>Access Denied</div>;
  }
  
  return <div>Admin Panel Content</div>;
}
```

### Seeding Permissions

Run the comprehensive seeding script:

```bash
cd rental-manager-backend
python scripts/seed_comprehensive_rbac.py
```

This will:
1. Create all system permissions (100+ permissions)
2. Create system roles with appropriate permissions
3. Assign roles to existing admin users
4. Display summary of configuration

## Security Best Practices

### 1. Principle of Least Privilege
- Grant minimal permissions required
- Use role templates as starting points
- Regularly review permission assignments

### 2. Separation of Duties
- Separate administrative and operational roles
- Implement approval workflows for critical operations
- Use different roles for different responsibilities

### 3. Regular Audits
- Review role assignments periodically
- Monitor permission usage
- Check for orphaned permissions
- Validate role templates

### 4. Permission Lifecycle
- Mark deprecated permissions as inactive
- Clean up unused custom roles
- Document permission changes
- Maintain audit logs

### 5. Testing
- Test permission enforcement at route level
- Validate frontend permission checks
- Ensure proper error handling
- Test role inheritance

## API Endpoints

### Role Management
- `GET /api/auth/roles` - List roles
- `POST /api/auth/roles` - Create role
- `GET /api/auth/roles/{id}` - Get role details
- `PUT /api/auth/roles/{id}` - Update role
- `DELETE /api/auth/roles/{id}` - Delete role
- `POST /api/auth/roles/{id}/permissions` - Assign permissions
- `DELETE /api/auth/roles/{id}/permissions` - Remove permissions

### Permission Management
- `GET /api/auth/permissions` - List permissions
- `POST /api/auth/permissions` - Create permission
- `GET /api/auth/permissions/{id}` - Get permission details
- `PUT /api/auth/permissions/{id}` - Update permission
- `DELETE /api/auth/permissions/{id}` - Delete permission

### User Role Assignment
- `GET /api/auth/user-roles` - List user role assignments
- `POST /api/auth/user-roles` - Assign role to user
- `DELETE /api/auth/user-roles/{id}` - Revoke role from user
- `GET /api/users/{id}/roles` - Get user's roles
- `GET /api/users/{id}/permissions` - Get user's effective permissions

## Troubleshooting

### Common Issues

#### 1. Permission Denied Errors
- Check user role assignments
- Verify permission exists in database
- Ensure route has correct permission decorator
- Check if user session is valid

#### 2. Role Not Found
- Run seeding script to create system roles
- Check role name spelling
- Verify role is active

#### 3. Permission Not Enforced
- Ensure decorator is properly applied
- Check dependency injection
- Verify current_user dependency

#### 4. Frontend Permission Check Fails
- Sync frontend permission names with backend
- Clear browser cache
- Refresh user session

## Migration Guide

### Adding New Permissions

1. Update `COMPREHENSIVE_PERMISSIONS` in seeding script
2. Run seeding script to add to database
3. Update relevant module permission class
4. Add permission check to routes
5. Update frontend permission types if needed

### Creating Custom Roles

1. Use admin UI at `/admin/roles/new`
2. Or use API: `POST /api/auth/roles`
3. Select appropriate permissions
4. Assign to users as needed

### Updating Existing Routes

```python
# Before (no permission check)
@router.post("/items")
async def create_item(current_user: User = Depends(get_current_user)):
    pass

# After (with permission check)
@router.post("/items", dependencies=[ItemPermissions.CREATE])
async def create_item(current_user: User = Depends(get_current_user)):
    pass
```

## Testing

### Backend Testing

```python
# Test permission enforcement
@pytest.mark.asyncio
async def test_permission_required():
    # Create user without permission
    user = await create_test_user()
    
    # Attempt to access protected endpoint
    response = await client.post("/customers", 
                                headers={"Authorization": f"Bearer {user.token}"})
    
    assert response.status_code == 403
    assert "Permission denied" in response.json()["detail"]
```

### Frontend Testing

```typescript
// Test permission-based rendering
describe('Permission-based UI', () => {
  it('should hide create button without permission', () => {
    const user = { permissions: ['CUSTOMER_VIEW'] };
    render(<CustomerList user={user} />);
    
    expect(screen.queryByText('Create Customer')).not.toBeInTheDocument();
  });
});
```

## Maintenance

### Regular Tasks

1. **Weekly**
   - Review failed permission checks in logs
   - Check for unusual permission usage patterns

2. **Monthly**
   - Audit user role assignments
   - Review and clean up custom roles
   - Update role templates if needed

3. **Quarterly**
   - Full permission audit
   - Review risk level assignments
   - Update documentation

## Support

For RBAC-related issues:
1. Check this documentation
2. Review error logs for permission details
3. Verify database state
4. Contact system administrator

## Appendix

### Permission Matrix

Full permission matrix available in:
- Backend: `scripts/seed_comprehensive_rbac.py`
- Frontend: `src/types/rbac.ts`
- Database: Query `permissions` table

### Role Templates

Templates provide pre-configured permission sets:
- `system`: System administration
- `management`: Business management
- `operational`: Day-to-day operations
- `financial`: Financial management
- `warehouse`: Inventory management
- `service`: Customer service
- `audit`: Auditing and compliance
- `guest`: Minimal access

### Integration Points

RBAC integrates with:
- Authentication system
- Audit logging
- API gateway
- Frontend routing
- Report generation
- Data export