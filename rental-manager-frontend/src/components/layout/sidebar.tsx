'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useAppStore } from '@/stores/app-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Package,
  ShoppingCart,
  RefreshCw,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Building2,
  Boxes,
  ClipboardCheck,
  BarChart3,
  Bell,
  LogOut,
  Menu,
  Grid3X3,
  Tag,
  RotateCcw,
  Eye,
  Calculator,
  TrendingUp,
  Shield,
  UserCog,
  Activity,
  Crown,
  Lock,
  History,
  PackagePlus,
  Wand2,
  Calendar,
  Plus,
  List,
  Clock,
  ArrowRightLeft,
  Database,
} from 'lucide-react';
import { MenuItem, getUserTypeDisplayName } from '@/types/auth';

const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'LayoutDashboard',
    path: '/dashboard',
    permissions: ['SALE_VIEW', 'RENTAL_VIEW'],
    children: [
      {
        id: 'business-dashboard',
        label: 'Business Intelligence',
        icon: 'BarChart3',
        path: '/dashboard/main',
        permissions: ['SALE_VIEW', 'RENTAL_VIEW'],
      },
      {
        id: 'main-dashboard',
        label: 'Overview',
        icon: 'LayoutDashboard',
        path: '/dashboard',
        permissions: ['SALE_VIEW', 'RENTAL_VIEW'],
      },
      {
        id: 'financial-dashboard',
        label: 'Financial Analytics',
        icon: 'TrendingUp',
        path: '/dashboard/financial',
        permissions: ['SALE_VIEW', 'RENTAL_VIEW'],
      },
    ],
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: 'Users',
    path: '/customers',
    permissions: ['CUSTOMER_VIEW'],
    children: [
      {
        id: 'all-customers',
        label: 'All Customers',
        icon: 'Users',
        path: '/customers',
        permissions: ['CUSTOMER_VIEW'],
      },
      {
        id: 'new-customer',
        label: 'Add Customer',
        icon: 'UserPlus',
        path: '/customers/new',
        permissions: ['CUSTOMER_CREATE'],
      },
      {
        id: 'customer-analytics',
        label: 'Analytics',
        icon: 'BarChart3',
        path: '/customers/analytics',
        permissions: ['CUSTOMER_VIEW'],
      },
    ],
  },
  {
    id: 'products',
    label: 'Products',
    icon: 'Package',
    path: '/products',
    permissions: ['INVENTORY_VIEW'],
    children: [
      {
        id: 'categories',
        label: 'Categories',
        icon: 'Grid3X3',
        path: '/products/categories',
        permissions: ['INVENTORY_VIEW'],
      },
      {
        id: 'brands',
        label: 'Brands',
        icon: 'Tag',
        path: '/products/brands',
        permissions: ['INVENTORY_VIEW'],
      },
      {
        id: 'units-of-measurement',
        label: 'Units of Measurement',
        icon: 'Calculator',
        path: '/products/units-of-measurement',
        permissions: ['INVENTORY_VIEW'],
      },
      {
        id: 'product-items',
        label: 'Products',
        icon: 'Package',
        path: '/products/items',
        permissions: ['INVENTORY_VIEW'],
      },
     
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: 'Boxes',
    path: '/inventory',
    permissions: ['INVENTORY_VIEW'],
    children: [
      {
        id: 'inventory-stock',
        label: 'Stock Overview',
        icon: 'Boxes',
        path: '/inventory',
        permissions: ['INVENTORY_VIEW'],
      },
      {
        id: 'inventory-locations',
        label: 'Locations',
        icon: 'Building2',
        path: '/inventory/locations',
        permissions: ['INVENTORY_VIEW'],
      },
      {
        id: 'inventory-items',
        label: 'Inventory Items',
        icon: 'Database',
        path: '/inventory/items',
        permissions: ['INVENTORY_VIEW'],
      },
      {
        id: 'batch-tracking',
        label: 'Batch Tracking',
        icon: 'Package',
        path: '/inventory/batch-tracking',
        permissions: ['INVENTORY_VIEW'],
      },
      {
        id: 'inventory-stock-levels',
        label: 'Stock Levels',
        icon: 'BarChart3',
        path: '/inventory/stock-levels',
        permissions: ['INVENTORY_VIEW'],
      },
      {
        id: 'inventory-alerts',
        label: 'Inventory Alerts',
        icon: 'Bell',
        path: '/inventory/alerts',
        permissions: ['INVENTORY_VIEW'],
      },
      {
        id: 'inventory-movements',
        label: 'Stock Movements',
        icon: 'Activity',
        path: '/inventory/movements',
        permissions: ['INVENTORY_VIEW'],
      },
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    icon: 'ShoppingCart',
    path: '/sales',
    permissions: ['SALE_VIEW', 'SALE_CREATE'],
    children: [
      {
        id: 'sales-dashboard',
        label: 'Sales Dashboard',
        icon: 'LayoutDashboard',
        path: '/sales',
        permissions: ['SALE_VIEW'],
      },
      {
        id: 'new-sale',
        label: 'New Sale',
        icon: 'ShoppingCart',
        path: '/sales/new',
        permissions: ['SALE_CREATE'],
      },
      {
        id: 'sales-history',
        label: 'Sales History',
        icon: 'FileText',
        path: '/sales/history',
        permissions: ['SALE_VIEW'],
      },
      {
        id: 'sales-returns',
        label: 'Sales Returns',
        icon: 'RotateCcw',
        path: '/sales/returns',
        permissions: ['SALE_VIEW'],
      },
      {
        id: 'sales-receipts',
        label: 'Receipts & Invoices',
        icon: 'FileText',
        path: '/sales/receipts',
        permissions: ['SALE_VIEW'],
      },
      {
        id: 'sales-analytics',
        label: 'Sales Analytics',
        icon: 'BarChart3',
        path: '/sales/analytics',
        permissions: ['SALE_VIEW'],
      },
      {
        id: 'customer-sales',
        label: 'Sales by Customer',
        icon: 'Users',
        path: '/sales/customers',
        permissions: ['SALE_VIEW', 'CUSTOMER_VIEW'],
      },
      {
        id: 'sale-transitions',
        label: 'Sale Transitions',
        icon: 'ArrowRightLeft',
        path: '/sales/transitions',
        permissions: ['SALE_VIEW', 'INVENTORY_VIEW'],
      },
    ],
  },
  {
    id: 'rentals',
    label: 'Rentals',
    icon: 'RefreshCw',
    path: '/rentals',
    permissions: ['RENTAL_VIEW', 'RENTAL_CREATE'],
    children: [
      {
        id: 'rental-dashboard',
        label: 'Dashboard',
        icon: 'LayoutDashboard',
        path: '/rentals',
        permissions: ['RENTAL_VIEW'],
      },
      {
        id: 'new-rental',
        label: 'New Rental',
        icon: 'RefreshCw',
        path: '/rentals/create-compact',
        permissions: ['RENTAL_CREATE'],
      },
      {
        id: 'due-today',
        label: 'Due Today',
        icon: 'Bell',
        path: '/rentals/due-today',
        permissions: ['RENTAL_VIEW'],
      },
      {
        id: 'active-rentals',
        label: 'Active Rentals',
        icon: 'FileText',
        path: '/rentals/active',
        permissions: ['RENTAL_VIEW'],
      },
      {
        id: 'rental-history',
        label: 'Rental History',
        icon: 'FileText',
        path: '/rentals/history',
        permissions: ['RENTAL_VIEW'],
      },
      {
        id: 'rental-analytics',
        label: 'Analytics',
        icon: 'BarChart3',
        path: '/rentals/analytics',
        permissions: ['RENTAL_VIEW'],
      },
      {
        id: 'rental-bookings',
        label: 'Bookings',
        icon: 'Calendar',
        path: '/bookings',
        permissions: [], // No permissions required - accessible to all authenticated users
        children: [
          {
            id: 'bookings-dashboard',
            label: 'Dashboard',
            icon: 'LayoutDashboard',
            path: '/bookings',
            permissions: [],
          },
          {
            id: 'new-booking',
            label: 'New Booking',
            icon: 'Plus',
            path: '/bookings/create',
            permissions: [],
          },
          {
            id: 'bookings-calendar',
            label: 'Calendar View',
            icon: 'Calendar',
            path: '/bookings/calendar',
            permissions: [],
          },
          {
            id: 'bookings-list',
            label: 'All Bookings',
            icon: 'List',
            path: '/bookings/list',
            permissions: [],
          },
          {
            id: 'pending-bookings',
            label: 'Pending Confirmations',
            icon: 'Clock',
            path: '/bookings/pending',
            permissions: [],
          },
        ],
      },
    ],
  },
  {
    id: 'purchases',
    label: 'Purchases',
    icon: 'Package',
    path: '/purchases',
    permissions: ['INVENTORY_VIEW'],
    children: [
      {
        id: 'record-purchase',
        label: 'Record Purchase',
        icon: 'Package',
        path: '/purchases/record',
        permissions: ['INVENTORY_CREATE'],
      },
      {
        id: 'purchase-history',
        label: 'Purchase History',
        icon: 'FileText',
        path: '/purchases/history',
        permissions: ['INVENTORY_VIEW'],
      },
      {
        id: 'purchase-returns',
        label: 'Purchase Returns',
        icon: 'RotateCcw',
        path: '/purchases/returns',
        permissions: ['INVENTORY_VIEW'],
      },
      {
        id: 'suppliers',
        label: 'Suppliers',
        icon: 'Users',
        path: '/purchases/suppliers',
        permissions: ['INVENTORY_VIEW'],
      },
      {
        id: 'supplier-analytics',
        label: 'Supplier Analytics',
        icon: 'BarChart3',
        path: '/purchases/suppliers/analytics',
        permissions: ['INVENTORY_VIEW'],
      },
    ],
  },

  {
    id: 'reports',
    label: 'Reports',
    icon: 'BarChart3',
    path: '/reports',
    permissions: ['REPORT_VIEW'],
  },
  {
    id: 'admin',
    label: 'Administration',
    icon: 'Crown',
    path: '/admin',
    permissions: ['USER_VIEW', 'ROLE_VIEW', 'AUDIT_VIEW'],
    children: [
      {
        id: 'user-management',
        label: 'User Management',
        icon: 'UserCog',
        path: '/admin/users',
        permissions: ['USER_VIEW'],
      },
      {
        id: 'role-management',
        label: 'Role Management',
        icon: 'Shield',
        path: '/admin/roles',
        permissions: ['ROLE_VIEW'],
      },
      {
        id: 'audit-logs',
        label: 'Audit Logs',
        icon: 'History',
        path: '/admin/audit',
        permissions: ['AUDIT_VIEW'],
      },
      {
        id: 'security-monitor',
        label: 'Security Monitor',
        icon: 'Activity',
        path: '/admin/security',
        permissions: ['AUDIT_VIEW'],
      },
      {
        id: 'system-settings',
        label: 'System Settings',
        icon: 'Lock',
        path: '/admin/settings',
        permissions: ['SYSTEM_CONFIG'],
      },
      {
        id: 'database-management',
        label: 'Database Management',
        icon: 'Database',
        path: '/admin/database',
        permissions: ['SYSTEM_CONFIG'],
      },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'Settings',
    path: '/settings',
    permissions: ['SYSTEM_CONFIG'],
  },
];

const iconMap = {
  LayoutDashboard,
  Users,
  UserPlus,
  Package,
  ShoppingCart,
  RefreshCw,
  FileText,
  Settings,
  Building2,
  Boxes,
  ClipboardCheck,
  BarChart3,
  Bell,
  Grid3X3,
  Tag,
  RotateCcw,
  Eye,
  Calculator,
  TrendingUp,
  Shield,
  UserCog,
  Activity,
  Crown,
  Lock,
  History,
  PackagePlus,
  Wand2,
  Calendar,
  Plus,
  List,
  Clock,
  Database,
};

export function Sidebar() {
  const pathname = usePathname();
  const { hasPermission, user, logout } = useAuthStore();
  const { sidebarCollapsed, setSidebarCollapsed, unreadCount } = useAppStore();
  
  // Initialize expanded items with rentals if on a rental page
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    const initialExpanded: string[] = [];
    
    // If we're on a rental page on initial load, expand rentals
    if (typeof window !== 'undefined' && window.location.pathname?.startsWith('/rental')) {
      initialExpanded.push('rentals');
      console.log('Initial state: expanding rentals for pathname:', window.location.pathname);
    }
    
    return initialExpanded;
  });

  // Auto-expand parent menu when a child route is active
  useEffect(() => {
    if (pathname && user) {
      const itemsToExpand: string[] = [];
      
      menuItems.forEach(item => {
        if (item.children && hasItemPermission(item)) {
          const hasActiveChild = item.children.some(child => 
            hasItemPermission(child) && (
              pathname === child.path || 
              pathname.startsWith(child.path + '/') ||
              (child.path !== '/rentals' && pathname.startsWith(child.path))
            )
          );
          
          if (hasActiveChild) {
            itemsToExpand.push(item.id);
          }
        }
      });
      
      // Debug logging
      if (itemsToExpand.length > 0) {
        console.log('Auto-expanding items:', itemsToExpand, 'for pathname:', pathname);
      }
      
      if (itemsToExpand.length > 0) {
        setExpandedItems(prev => {
          const newExpanded = [...prev];
          itemsToExpand.forEach(id => {
            if (!newExpanded.includes(id)) {
              newExpanded.push(id);
            }
          });
          return newExpanded;
        });
      }
    }
  }, [pathname, user]);

  // Also expand Rentals by default if user has rental permissions or on rental pages
  useEffect(() => {
    if (user && (user.isSuperuser || user.userType === 'SUPERADMIN' || pathname?.startsWith('/rental'))) {
      // Auto-expand Rentals menu for admin users or when on rental pages
      setExpandedItems(prev => {
        if (!prev.includes('rentals')) {
          console.log('Force expanding rentals menu for user:', user?.username, 'pathname:', pathname);
          return [...prev, 'rentals'];
        }
        return prev;
      });
    }
  }, [user, pathname]);

  // Mount effect - ensure rentals is expanded on mount if needed
  useEffect(() => {
    console.log('Sidebar mounted with pathname:', pathname, 'user:', user?.username);
    
    if (pathname?.startsWith('/rental') && user) {
      console.log('Mount effect: forcing rentals expansion');
      setExpandedItems(prev => {
        if (!prev.includes('rentals')) {
          return [...prev, 'rentals'];
        }
        return prev;
      });
    }
  }, []); // Run only on mount

  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  const hasItemPermission = (item: MenuItem) => {
    // Special case: Always show Bookings menu to all authenticated users
    if (item.id === 'rental-bookings') {
      return !!user; // Any authenticated user can access bookings
    }
    
    // Superusers and superadmins have access to everything
    if (user?.isSuperuser || user?.userType === 'SUPERADMIN') {
      return true;
    }
    
    // If no permissions required, allow access
    if (!item.permissions || item.permissions.length === 0) {
      return true;
    }
    
    // Check permissions using auth store
    return hasPermission(item.permissions as any);
  };

  const renderMenuItem = (item: MenuItem, depth = 0) => {
    if (!hasItemPermission(item)) return null;

    const Icon = iconMap[item.icon as keyof typeof iconMap];
    // Check if any children have permissions (for showing expand/collapse)
    const visibleChildren = item.children?.filter(child => hasItemPermission(child)) || [];
    const hasChildren = visibleChildren.length > 0;
    
    // Removed debug logging for cleaner console output
    const isExpanded = expandedItems.includes(item.id);
    const itemIsActive = isActive(item.path);

    const menuItemContent = (
      <div
        className={cn(
          'flex items-center w-full px-3 py-2 text-sm rounded-md transition-colors',
          'hover:bg-gray-100 dark:hover:bg-gray-800',
          itemIsActive && 'bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
          depth > 0 && 'ml-6',
          sidebarCollapsed && depth === 0 && 'justify-center px-2'
        )}
      >
        {Icon && (
          <Icon 
            className={cn(
              'h-5 w-5 flex-shrink-0',
              !sidebarCollapsed && 'mr-3',
              itemIsActive && 'text-slate-600 dark:text-slate-400'
            )} 
          />
        )}
        {!sidebarCollapsed && (
          <>
            <span className="flex-1">{item.label}</span>
            {item.id === 'notifications' && unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
            {hasChildren && (
              <ChevronRight 
                className={cn(
                  'h-4 w-4 transition-transform',
                  isExpanded && 'rotate-90'
                )}
              />
            )}
          </>
        )}
      </div>
    );

    return (
      <div key={item.id}>
        {hasChildren ? (
          <button
            onClick={() => toggleExpanded(item.id)}
            className="w-full text-left"
          >
            {menuItemContent}
          </button>
        ) : (
          <Link href={item.path}>
            {menuItemContent}
          </Link>
        )}
        
        {hasChildren && isExpanded && !sidebarCollapsed && (
          <div className="ml-2 mt-1 space-y-1">
            {visibleChildren.map(child => renderMenuItem(child, depth + 1))}
          </div>
        )}
        
        {/* Special fallback for Bookings menu - force render if missing */}
        {item.id === 'rentals' && 
         isExpanded && 
         !sidebarCollapsed && 
         user && 
         !visibleChildren.some(child => child.id === 'rental-bookings') && (
          <div className="ml-2 mt-1 space-y-1">
            <div className="text-xs text-orange-600 mb-1 px-3">Missing menu fallback:</div>
            <Link 
              href="/bookings" 
              className="flex items-center px-3 py-2 text-sm rounded hover:bg-gray-100 ml-6 text-orange-700"
            >
              <Calendar className="h-4 w-4 mr-2" />
              <span>Bookings (Fallback)</span>
            </Link>
          </div>
        )}
        
        {/* Fallback for rentals menu - force show for superusers if children exist but not showing */}
        {item.id === 'rentals' && 
         user?.isSuperuser && 
         item.children && 
         item.children.length > 0 && 
         (!hasChildren || !isExpanded) && 
         !sidebarCollapsed && (
          <div className="ml-2 mt-1 space-y-1 border-l-2 border-blue-300 pl-2">
            <div className="text-xs text-blue-600 mb-1">Fallback Menu:</div>
            {item.children.map(child => {
              // Force render rental children for superusers
              const ChildIcon = iconMap[child.icon as keyof typeof iconMap];
              return (
                <Link key={child.id} href={child.path} className="flex items-center px-3 py-1 text-sm rounded hover:bg-gray-100 ml-6">
                  {ChildIcon && <ChildIcon className="h-4 w-4 mr-2" />}
                  <span>{child.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn(
      'bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300',
      sidebarCollapsed ? 'w-16' : 'w-64'
    )}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          {!sidebarCollapsed && (
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Rental Manager
            </h2>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="p-2"
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {menuItems.map(item => renderMenuItem(item))}
        </nav>

        {/* User section */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          {!sidebarCollapsed && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {user?.name || `${user?.firstName} ${user?.lastName}`}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user?.userType ? getUserTypeDisplayName(user.userType) : user?.role?.name || 'User'}
              </p>
              {user?.isSuperuser && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                  Superuser
                </p>
              )}
            </div>
          )}
          
          <Button
            variant="ghost"
            onClick={logout}
            className={cn(
              'w-full justify-start',
              sidebarCollapsed && 'justify-center px-2'
            )}
          >
            <LogOut className={cn('h-4 w-4', !sidebarCollapsed && 'mr-2')} />
            {!sidebarCollapsed && 'Logout'}
          </Button>
        </div>
      </div>
    </div>
  );
}