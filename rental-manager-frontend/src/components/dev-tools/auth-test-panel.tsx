'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { 
  TestTube, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Code,
  Play,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PermissionType } from '@/types/auth';

interface AuthTestPanelProps {
  className?: string;
}

interface ComponentTest {
  id: string;
  name: string;
  description: string;
  requiredPermissions: PermissionType[];
  component: React.ReactNode;
  code: string;
}

export function AuthTestPanel({ className = '' }: AuthTestPanelProps) {
  const { 
    isDevelopmentMode, 
    isAuthDisabled, 
    hasPermission,
    user
  } = useAuthStore();

  const [selectedTest, setSelectedTest] = useState<string>('');
  const [showCode, setShowCode] = useState<Record<string, boolean>>({});

  // Only show in development mode with auth disabled
  if (!isDevelopmentMode || !isAuthDisabled) {
    return null;
  }

  // Test components that would normally be protected
  const componentTests: ComponentTest[] = [
    {
      id: 'customer-create-button',
      name: 'Customer Create Button',
      description: 'Button that should only be visible to users with CUSTOMER_CREATE permission',
      requiredPermissions: ['CUSTOMER_CREATE'],
      component: (
        <Button 
          variant="outline" 
          disabled={!hasPermission('CUSTOMER_CREATE')}
          className={cn(!hasPermission('CUSTOMER_CREATE') && 'opacity-50')}
        >
          {hasPermission('CUSTOMER_CREATE') ? 'Create Customer' : 'No Permission'}
        </Button>
      ),
      code: `<Button 
  variant="outline" 
  disabled={!hasPermission('CUSTOMER_CREATE')}
>
  {hasPermission('CUSTOMER_CREATE') ? 'Create Customer' : 'No Permission'}
</Button>`
    },
    {
      id: 'admin-panel-access',
      name: 'Admin Panel Access',
      description: 'Panel that should only render for admin users',
      requiredPermissions: ['USER_VIEW', 'SYSTEM_CONFIG'],
      component: (
        <Card className="w-full max-w-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Admin Panel</CardTitle>
            <CardDescription className="text-xs">System administration</CardDescription>
          </CardHeader>
          <CardContent>
            {hasPermission(['USER_VIEW', 'SYSTEM_CONFIG']) ? (
              <div className="space-y-2">
                <Button size="sm" className="w-full">Manage Users</Button>
                <Button size="sm" variant="outline" className="w-full">System Config</Button>
              </div>
            ) : (
              <div className="text-center text-muted-foreground text-sm p-4">
                Access Denied
              </div>
            )}
          </CardContent>
        </Card>
      ),
      code: `{hasPermission(['USER_VIEW', 'SYSTEM_CONFIG']) ? (
  <AdminPanel />
) : (
  <div>Access Denied</div>
)}`
    },
    {
      id: 'inventory-actions',
      name: 'Inventory Actions',
      description: 'Action buttons with different permission requirements',
      requiredPermissions: ['INVENTORY_VIEW', 'INVENTORY_CREATE', 'INVENTORY_UPDATE', 'INVENTORY_DELETE'],
      component: (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline"
              disabled={!hasPermission('INVENTORY_VIEW')}
            >
              <Eye className="h-3 w-3 mr-1" />
              View
            </Button>
            <Button 
              size="sm" 
              disabled={!hasPermission('INVENTORY_CREATE')}
            >
              Create
            </Button>
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="secondary"
              disabled={!hasPermission('INVENTORY_UPDATE')}
            >
              Update
            </Button>
            <Button 
              size="sm" 
              variant="destructive"
              disabled={!hasPermission('INVENTORY_DELETE')}
            >
              Delete
            </Button>
          </div>
        </div>
      ),
      code: `<Button disabled={!hasPermission('INVENTORY_CREATE')}>
  Create
</Button>
<Button 
  variant="destructive"
  disabled={!hasPermission('INVENTORY_DELETE')}
>
  Delete
</Button>`
    },
    {
      id: 'conditional-menu',
      name: 'Conditional Menu Items',
      description: 'Menu items that appear/disappear based on permissions',
      requiredPermissions: ['RENTAL_CREATE', 'SALE_CREATE', 'REPORT_VIEW'],
      component: (
        <Card className="w-full max-w-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Navigation Menu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {hasPermission('RENTAL_CREATE') && (
              <Button variant="ghost" size="sm" className="w-full justify-start">
                New Rental
              </Button>
            )}
            {hasPermission('SALE_CREATE') && (
              <Button variant="ghost" size="sm" className="w-full justify-start">
                New Sale
              </Button>
            )}
            {hasPermission('REPORT_VIEW') && (
              <Button variant="ghost" size="sm" className="w-full justify-start">
                View Reports
              </Button>
            )}
            {!hasPermission(['RENTAL_CREATE', 'SALE_CREATE', 'REPORT_VIEW']) && (
              <div className="text-center text-muted-foreground text-sm p-2">
                No available actions
              </div>
            )}
          </CardContent>
        </Card>
      ),
      code: `{hasPermission('RENTAL_CREATE') && (
  <MenuItem>New Rental</MenuItem>
)}
{hasPermission('SALE_CREATE') && (
  <MenuItem>New Sale</MenuItem>
)}
{hasPermission('REPORT_VIEW') && (
  <MenuItem>View Reports</MenuItem>
)}`
    }
  ];

  const toggleCodeView = (testId: string) => {
    setShowCode(prev => ({
      ...prev,
      [testId]: !prev[testId]
    }));
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  const getPermissionStatus = (permissions: PermissionType[]) => {
    const results = permissions.map(p => ({
      permission: p,
      hasAccess: hasPermission(p)
    }));
    
    const granted = results.filter(r => r.hasAccess).length;
    const total = results.length;
    
    return { results, granted, total };
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className={cn("flex items-center gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20", className)}
        >
          <TestTube className="h-4 w-4" />
          <span className="hidden sm:inline">Auth Tests</span>
        </Button>
      </SheetTrigger>
      
      <SheetContent className="w-[90vw] sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Authentication UI Testing
          </SheetTitle>
          <SheetDescription>
            Test how UI components behave with different permission levels
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          {/* Current User Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Current Test User</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{user?.full_name || user?.username}</div>
                  <div className="text-sm text-muted-foreground">{user?.userType}</div>
                </div>
                <Badge variant={user?.is_superuser ? 'default' : 'secondary'}>
                  {user?.is_superuser ? 'Superuser' : 'Regular User'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Component Tests */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Component Tests</h3>
            
            {componentTests.map((test) => {
              const { results, granted, total } = getPermissionStatus(test.requiredPermissions);
              
              return (
                <Card key={test.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-sm">{test.name}</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {test.description}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={granted === total ? 'default' : granted > 0 ? 'secondary' : 'destructive'}
                          className="text-xs"
                        >
                          {granted}/{total} permissions
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleCodeView(test.id)}
                        >
                          {showCode[test.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Required Permissions */}
                    <div>
                      <Label className="text-xs font-medium">Required Permissions:</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {results.map(({ permission, hasAccess }) => (
                          <Badge 
                            key={permission}
                            variant={hasAccess ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {hasAccess ? <CheckCircle className="h-2 w-2 mr-1" /> : <XCircle className="h-2 w-2 mr-1" />}
                            {permission}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Component Preview */}
                    <div>
                      <Label className="text-xs font-medium">Component Preview:</Label>
                      <div className="mt-2 p-4 bg-muted/50 rounded-lg border">
                        {test.component}
                      </div>
                    </div>

                    {/* Code Example */}
                    {showCode[test.id] && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-xs font-medium">Code Example:</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyCode(test.code)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="relative">
                          <pre className="bg-black text-green-400 p-3 rounded text-xs overflow-x-auto">
                            <code>{test.code}</code>
                          </pre>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Testing Tips */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Testing Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>• Use the User Switcher to test different permission levels</p>
              <p>• Create custom users with specific permissions to test edge cases</p>
              <p>• Check that disabled buttons have appropriate visual feedback</p>
              <p>• Verify that unauthorized content is completely hidden, not just disabled</p>
              <p>• Test with both individual permissions and permission arrays</p>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default AuthTestPanel;