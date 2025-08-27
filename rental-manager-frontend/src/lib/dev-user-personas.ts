/**
 * Development User Personas
 * 
 * Predefined user personas for development testing with different roles and permissions
 */

import type { User } from '@/types/auth';

export interface UserPersona {
  id: string;
  name: string;
  description: string;
  user: User;
  color: string;
  icon: string;
}

// Define permission sets for different roles
const PERMISSION_SETS = {
  SUPERADMIN: [
    'read:all', 'write:all', 'delete:all', 'admin:all',
    'manage:users', 'manage:companies', 'manage:customers',
    'manage:suppliers', 'manage:inventory', 'manage:transactions',
    'manage:rentals', 'manage:analytics', 'view:dashboard',
    'export:data', 'SALE_VIEW', 'RENTAL_VIEW', 'DASHBOARD_VIEW',
    'ANALYTICS_VIEW', 'CUSTOMER_VIEW', 'CUSTOMER_CREATE',
    'CUSTOMER_UPDATE', 'CUSTOMER_DELETE', 'INVENTORY_VIEW',
    'INVENTORY_CREATE', 'INVENTORY_UPDATE', 'INVENTORY_DELETE',
    'SALE_CREATE', 'SALE_UPDATE', 'SALE_DELETE',
    'RENTAL_CREATE', 'RENTAL_UPDATE', 'RENTAL_DELETE',
    'REPORT_VIEW', 'REPORT_CREATE', 'USER_VIEW', 'USER_CREATE',
    'USER_UPDATE', 'USER_DELETE', 'ROLE_VIEW', 'ROLE_CREATE',
    'ROLE_UPDATE', 'ROLE_DELETE', 'AUDIT_VIEW', 'SYSTEM_CONFIG'
  ],

  ADMIN: [
    'SALE_VIEW', 'RENTAL_VIEW', 'DASHBOARD_VIEW', 'ANALYTICS_VIEW',
    'CUSTOMER_VIEW', 'CUSTOMER_CREATE', 'CUSTOMER_UPDATE', 'CUSTOMER_DELETE',
    'INVENTORY_VIEW', 'INVENTORY_CREATE', 'INVENTORY_UPDATE', 'INVENTORY_DELETE',
    'SALE_CREATE', 'SALE_UPDATE', 'SALE_DELETE',
    'RENTAL_CREATE', 'RENTAL_UPDATE', 'RENTAL_DELETE',
    'REPORT_VIEW', 'REPORT_CREATE',
    'USER_VIEW', 'USER_CREATE', 'USER_UPDATE', 'USER_DELETE',
    'ROLE_VIEW', 'AUDIT_VIEW', 'manage:companies', 'manage:customers',
    'manage:suppliers', 'manage:inventory', 'manage:transactions', 'manage:rentals'
  ],

  LANDLORD: [
    'SALE_VIEW', 'RENTAL_VIEW', 'CUSTOMER_VIEW', 'INVENTORY_VIEW',
    'RENTAL_CREATE', 'RENTAL_UPDATE', 'CUSTOMER_CREATE', 'REPORT_VIEW',
    'DASHBOARD_VIEW', 'manage:customers', 'manage:rentals', 'view:dashboard'
  ],

  TENANT: [
    'RENTAL_VIEW', 'DASHBOARD_VIEW', 'CUSTOMER_VIEW'
  ],

  MAINTENANCE: [
    'INVENTORY_VIEW', 'RENTAL_VIEW', 'CUSTOMER_VIEW', 'INVENTORY_UPDATE'
  ],

  VIEWER: [
    'DASHBOARD_VIEW', 'RENTAL_VIEW', 'SALE_VIEW', 'CUSTOMER_VIEW', 'INVENTORY_VIEW'
  ]
};

export const USER_PERSONAS: UserPersona[] = [
  {
    id: 'superadmin',
    name: 'Super Administrator',
    description: 'Full system access with all permissions',
    color: 'bg-purple-600',
    icon: '👑',
    user: {
      id: 'dev-superadmin-1',
      email: 'superadmin@dev.local',
      username: 'superadmin',
      full_name: 'Super Administrator',
      is_active: true,
      is_superuser: true,
      is_verified: true,
      role: { name: 'SUPERADMIN' },
      userType: 'SUPERADMIN',
      isSuperuser: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      effectivePermissions: {
        all_permissions: PERMISSION_SETS.SUPERADMIN,
        allPermissions: PERMISSION_SETS.SUPERADMIN
      }
    } as User
  },

  {
    id: 'admin',
    name: 'System Administrator',
    description: 'Administrative access with user management capabilities',
    color: 'bg-red-600',
    icon: '🛡️',
    user: {
      id: 'dev-admin-1',
      email: 'admin@dev.local',
      username: 'admin',
      full_name: 'System Administrator',
      is_active: true,
      is_superuser: false,
      is_verified: true,
      role: { name: 'ADMIN' },
      userType: 'ADMIN',
      isSuperuser: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      effectivePermissions: {
        all_permissions: PERMISSION_SETS.ADMIN,
        allPermissions: PERMISSION_SETS.ADMIN
      }
    } as User
  },

  {
    id: 'landlord',
    name: 'Landlord Manager',
    description: 'Property management with rental oversight',
    color: 'bg-blue-600',
    icon: '🏢',
    user: {
      id: 'dev-landlord-1',
      email: 'landlord@dev.local',
      username: 'landlord',
      full_name: 'Landlord Manager',
      is_active: true,
      is_superuser: false,
      is_verified: true,
      role: { name: 'LANDLORD' },
      userType: 'LANDLORD',
      isSuperuser: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      effectivePermissions: {
        all_permissions: PERMISSION_SETS.LANDLORD,
        allPermissions: PERMISSION_SETS.LANDLORD
      }
    } as User
  },

  {
    id: 'tenant',
    name: 'Tenant User',
    description: 'Basic tenant access with limited permissions',
    color: 'bg-green-600',
    icon: '🏠',
    user: {
      id: 'dev-tenant-1',
      email: 'tenant@dev.local',
      username: 'tenant',
      full_name: 'Tenant User',
      is_active: true,
      is_superuser: false,
      is_verified: true,
      role: { name: 'TENANT' },
      userType: 'TENANT',
      isSuperuser: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      effectivePermissions: {
        all_permissions: PERMISSION_SETS.TENANT,
        allPermissions: PERMISSION_SETS.TENANT
      }
    } as User
  },

  {
    id: 'maintenance',
    name: 'Maintenance Worker',
    description: 'Maintenance staff with inventory access',
    color: 'bg-orange-600',
    icon: '🔧',
    user: {
      id: 'dev-maintenance-1',
      email: 'maintenance@dev.local',
      username: 'maintenance',
      full_name: 'Maintenance Worker',
      is_active: true,
      is_superuser: false,
      is_verified: true,
      role: { name: 'MAINTENANCE' },
      userType: 'MAINTENANCE',
      isSuperuser: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      effectivePermissions: {
        all_permissions: PERMISSION_SETS.MAINTENANCE,
        allPermissions: PERMISSION_SETS.MAINTENANCE
      }
    } as User
  },

  {
    id: 'viewer',
    name: 'Read-Only Viewer',
    description: 'View-only access for reporting and dashboards',
    color: 'bg-gray-600',
    icon: '👁️',
    user: {
      id: 'dev-viewer-1',
      email: 'viewer@dev.local',
      username: 'viewer',
      full_name: 'Read-Only Viewer',
      is_active: true,
      is_superuser: false,
      is_verified: true,
      role: { name: 'VIEWER' },
      userType: 'VIEWER',
      isSuperuser: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      effectivePermissions: {
        all_permissions: PERMISSION_SETS.VIEWER,
        allPermissions: PERMISSION_SETS.VIEWER
      }
    } as User
  }
];

export function getUserPersonaById(id: string): UserPersona | null {
  return USER_PERSONAS.find(persona => persona.id === id) || null;
}

export function getDefaultPersona(): UserPersona {
  return USER_PERSONAS[0]; // Return superadmin as default
}

export function createCustomPersona(
  id: string,
  name: string,
  description: string,
  permissions: string[],
  userType: string = 'CUSTOM'
): UserPersona {
  return {
    id,
    name,
    description,
    color: 'bg-indigo-600',
    icon: '⚙️',
    user: {
      id: `dev-custom-${id}`,
      email: `${id}@dev.local`,
      username: id,
      full_name: name,
      is_active: true,
      is_superuser: false,
      is_verified: true,
      role: { name: userType },
      userType,
      isSuperuser: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      effectivePermissions: {
        all_permissions: permissions,
        allPermissions: permissions
      }
    } as User
  };
}

export default USER_PERSONAS;