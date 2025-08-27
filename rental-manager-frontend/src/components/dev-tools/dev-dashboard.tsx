'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Shield, 
  User, 
  Settings, 
  Activity, 
  Database, 
  Network,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Refresh,
  Download
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PermissionType } from '@/types/auth';

interface DevDashboardProps {
  className?: string;
}

interface ApiLog {
  id: string;
  timestamp: Date;
  method: string;
  url: string;
  status?: number;
  hasAuth: boolean;
  authHeader?: string;
  duration?: number;
}

interface PermissionTest {
  permission: PermissionType;
  result: boolean;
  timestamp: Date;
  reason?: string;
}

export function DevDashboard({ className = '' }: DevDashboardProps) {
  const { 
    user,
    permissions,
    isAuthenticated,
    isDevelopmentMode, 
    isAuthDisabled,
    isBackendOnline,
    lastBackendCheck,
    hasPermission,
    isSuperuser
  } = useAuthStore();

  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
  const [permissionTests, setPermissionTests] = useState<PermissionTest[]>([]);
  const [testPermission, setTestPermission] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Only show in development mode with auth disabled
  if (!isDevelopmentMode || !isAuthDisabled) {
    return null;
  }

  // Mock API logs (in real implementation, this would come from interceptors)
  useEffect(() => {
    const mockLogs: ApiLog[] = [
      {
        id: '1',
        timestamp: new Date(Date.now() - 30000),
        method: 'GET',
        url: '/customers',
        status: 200,
        hasAuth: true,
        authHeader: 'Bearer dev-access-token',
        duration: 120
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 15000),
        method: 'POST',
        url: '/rentals',
        status: 201,
        hasAuth: true,
        authHeader: 'Bearer dev-access-token',
        duration: 350
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 5000),
        method: 'GET',
        url: '/inventory',
        status: 200,
        hasAuth: true,
        authHeader: 'Bearer dev-access-token',
        duration: 89
      }
    ];
    setApiLogs(mockLogs);
  }, []);

  const testPermissionCheck = () => {
    if (!testPermission.trim()) return;
    
    const permission = testPermission.trim() as PermissionType;
    const result = hasPermission(permission);
    
    const test: PermissionTest = {
      permission,
      result,
      timestamp: new Date(),
      reason: result ? 'Permission granted' : 'Permission denied'
    };
    
    setPermissionTests(prev => [test, ...prev.slice(0, 9)]); // Keep last 10 tests
    setTestPermission('');
  };

  const exportData = () => {
    const data = {
      timestamp: new Date().toISOString(),
      user: user,
      permissions: permissions,
      apiLogs: apiLogs,
      permissionTests: permissionTests,
      systemInfo: {
        isDevelopmentMode,
        isAuthDisabled,
        isBackendOnline,
        lastBackendCheck
      }
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dev-auth-data-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status?: number) => {
    if (!status) return <Clock className="h-4 w-4 text-gray-400" />;
    if (status >= 200 && status < 300) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status >= 400 && status < 500) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    if (status >= 500) return <XCircle className="h-4 w-4 text-red-500" />;
    return <Clock className="h-4 w-4 text-gray-400" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className={cn("flex items-center gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20", className)}
        >
          <Activity className="h-4 w-4" />
          <span className="hidden sm:inline">Dev Dashboard</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Development Authentication Dashboard
          </DialogTitle>
          <DialogDescription>
            Monitor authentication state, permissions, and API requests in development mode
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
            <TabsTrigger value="api-logs">API Logs</TabsTrigger>
            <TabsTrigger value="testing">Testing</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Auth Status */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Authentication Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Authenticated</span>
                    <Badge variant={isAuthenticated ? 'default' : 'destructive'}>
                      {isAuthenticated ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Auth Disabled</span>
                    <Badge variant={isAuthDisabled ? 'destructive' : 'default'}>
                      {isAuthDisabled ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Superuser</span>
                    <Badge variant={isSuperuser() ? 'default' : 'secondary'}>
                      {isSuperuser() ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* User Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Current User
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {user ? (
                    <>
                      <div className="text-sm">
                        <span className="font-medium">{user.full_name || user.username}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                      <div className="text-xs">
                        <Badge variant="outline">{user.userType || user.role?.name}</Badge>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">No user loaded</div>
                  )}
                </CardContent>
              </Card>

              {/* System Status */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Network className="h-4 w-4" />
                    System Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Backend</span>
                    <Badge variant={isBackendOnline ? 'default' : 'destructive'}>
                      {isBackendOnline ? 'Online' : 'Offline'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Environment</span>
                    <Badge variant="outline">{process.env.NODE_ENV}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Last Check</span>
                    <span className="text-xs text-muted-foreground">
                      {lastBackendCheck ? 
                        new Date(lastBackendCheck).toLocaleTimeString() : 
                        'Never'
                      }
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="permissions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Permission Summary</CardTitle>
                <CardDescription>
                  Current user has {permissions.length} permissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {permissions.map((permission, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <span className="text-sm font-mono">{permission}</span>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="api-logs" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium">API Request Logs</CardTitle>
                  <CardDescription>Recent API requests with authentication info</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => setApiLogs([])}>
                  Clear Logs
                </Button>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {apiLogs.map((log) => (
                      <div key={log.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded">
                        {getStatusIcon(log.status)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {log.method}
                            </Badge>
                            <span className="text-sm font-mono truncate">{log.url}</span>
                            {log.status && (
                              <Badge variant={log.status < 400 ? 'default' : 'destructive'} className="text-xs">
                                {log.status}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {log.timestamp.toLocaleTimeString()}
                            {log.duration && ` • ${log.duration}ms`}
                            {log.hasAuth && ' • Authenticated'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="testing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Permission Testing</CardTitle>
                <CardDescription>Test specific permissions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="test-permission">Permission to test</Label>
                    <Input
                      id="test-permission"
                      placeholder="e.g., CUSTOMER_VIEW, RENTAL_CREATE"
                      value={testPermission}
                      onChange={(e) => setTestPermission(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && testPermissionCheck()}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={testPermissionCheck} disabled={!testPermission.trim()}>
                      Test
                    </Button>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="text-sm font-medium mb-2">Recent Tests</h4>
                  <ScrollArea className="h-32">
                    <div className="space-y-2">
                      {permissionTests.map((test, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                          <div className="flex items-center gap-2">
                            {test.result ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="text-sm font-mono">{test.permission}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {test.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            Development mode only
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportData}>
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DevDashboard;