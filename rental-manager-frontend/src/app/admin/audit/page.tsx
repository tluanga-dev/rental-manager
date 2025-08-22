'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { securityApi, SecurityAuditLog } from '@/services/api/security';
import { toast } from 'react-hot-toast';
import { 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Eye,
  Calendar,
  User,
  Shield,
  Activity,
  AlertCircle,
  Clock,
  Database,
  FileText,
  TrendingUp,
  Users
} from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, subHours } from 'date-fns';

export default function AuditPage() {
  const [logs, setLogs] = useState<SecurityAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<SecurityAuditLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [dateRange, setDateRange] = useState<'today' | '24h' | '7d' | '30d' | 'custom'>('24h');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'security' | 'data' | 'system'>('all');
  
  // Filters
  const [filters, setFilters] = useState({
    user_id: '',
    action: 'all',
    resource: 'all',
    success_only: false,
    limit: 100,
  });

  // Statistics
  const [stats, setStats] = useState({
    totalEvents: 0,
    successRate: 0,
    uniqueUsers: 0,
    topActions: [] as { action: string; count: number }[],
    recentFailures: 0,
    criticalEvents: 0,
  });

  // Load logs on component mount and filter changes
  useEffect(() => {
    loadLogs();
  }, [filters, dateRange, customStartDate, customEndDate]);

  // Calculate statistics when logs change
  useEffect(() => {
    calculateStats();
  }, [logs]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      // Clean up filters - remove 'all' values
      const cleanFilters = {
        ...filters,
        action: filters.action === 'all' ? '' : filters.action,
        resource: filters.resource === 'all' ? '' : filters.resource,
      };
      const data = await securityApi.getAuditLogs(cleanFilters);
      
      // Apply date filtering on client side if needed
      let filteredData = data;
      if (dateRange !== 'custom') {
        const now = new Date();
        let startDate: Date;
        
        switch (dateRange) {
          case 'today':
            startDate = startOfDay(now);
            break;
          case '24h':
            startDate = subHours(now, 24);
            break;
          case '7d':
            startDate = subDays(now, 7);
            break;
          case '30d':
            startDate = subDays(now, 30);
            break;
          default:
            startDate = subHours(now, 24);
        }
        
        filteredData = data.filter(log => 
          new Date(log.timestamp) >= startDate
        );
      } else if (customStartDate && customEndDate) {
        const start = new Date(customStartDate);
        const end = endOfDay(new Date(customEndDate));
        filteredData = data.filter(log => {
          const logDate = new Date(log.timestamp);
          return logDate >= start && logDate <= end;
        });
      }
      
      // Apply search filter
      if (searchTerm) {
        filteredData = filteredData.filter(log =>
          log.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (log.resource_id && log.resource_id.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      }
      
      // Apply tab filter
      if (activeTab !== 'all') {
        filteredData = filteredData.filter(log => {
          switch (activeTab) {
            case 'security':
              return ['auth', 'users', 'roles', 'permissions'].includes(log.resource);
            case 'data':
              return ['customers', 'suppliers', 'inventory', 'rentals', 'transactions'].includes(log.resource);
            case 'system':
              return ['system', 'backup', 'config', 'audit'].includes(log.resource);
            default:
              return true;
          }
        });
      }
      
      setLogs(filteredData);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    if (logs.length === 0) {
      setStats({
        totalEvents: 0,
        successRate: 0,
        uniqueUsers: 0,
        topActions: [],
        recentFailures: 0,
        criticalEvents: 0,
      });
      return;
    }

    const successCount = logs.filter(log => log.success).length;
    const uniqueUsers = new Set(logs.map(log => log.user_id)).size;
    
    // Calculate top actions
    const actionCounts: Record<string, number> = {};
    logs.forEach(log => {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    });
    const topActions = Object.entries(actionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([action, count]) => ({ action, count }));
    
    // Count recent failures (last 24h)
    const last24h = subHours(new Date(), 24);
    const recentFailures = logs.filter(log => 
      !log.success && new Date(log.timestamp) >= last24h
    ).length;
    
    // Count critical events
    const criticalActions = ['DELETE', 'ROLE_DELETED', 'USER_DELETED', 'PERMISSION_REVOKED'];
    const criticalEvents = logs.filter(log =>
      criticalActions.some(action => log.action.includes(action))
    ).length;
    
    setStats({
      totalEvents: logs.length,
      successRate: logs.length > 0 ? (successCount / logs.length) * 100 : 0,
      uniqueUsers,
      topActions,
      recentFailures,
      criticalEvents,
    });
  };

  const formatTimestamp = (timestamp: string) => {
    return format(new Date(timestamp), 'MMM dd, yyyy HH:mm:ss');
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('CREATE')) return 'bg-green-100 text-green-800';
    if (action.includes('UPDATE')) return 'bg-blue-100 text-blue-800';
    if (action.includes('DELETE')) return 'bg-red-100 text-red-800';
    if (action.includes('LOGIN')) return 'bg-purple-100 text-purple-800';
    if (action.includes('EXPORT')) return 'bg-yellow-100 text-yellow-800';
    if (action.includes('FAILED')) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getResourceIcon = (resource: string) => {
    const icons: Record<string, React.ReactNode> = {
      auth: <Shield className="h-4 w-4" />,
      users: <Users className="h-4 w-4" />,
      system: <Database className="h-4 w-4" />,
      audit: <FileText className="h-4 w-4" />,
    };
    return icons[resource] || <Activity className="h-4 w-4" />;
  };

  const exportLogs = (format: 'csv' | 'json') => {
    if (format === 'csv') {
      const csv = [
        ['Timestamp', 'User', 'Action', 'Resource', 'Resource ID', 'Success', 'IP Address', 'Error Message'],
        ...logs.map(log => [
          log.timestamp,
          log.user_name,
          log.action,
          log.resource,
          log.resource_id || '',
          log.success ? 'Yes' : 'No',
          log.ip_address || '',
          log.error_message || '',
        ]),
      ].map(row => row.join(',')).join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
    } else {
      const json = JSON.stringify(logs, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.json`;
      a.click();
    }
    
    toast.success(`Audit logs exported as ${format.toUpperCase()}`);
  };

  const viewLogDetails = (log: SecurityAuditLog) => {
    setSelectedLog(log);
    setShowDetails(true);
  };

  const clearFilters = () => {
    setFilters({
      user_id: '',
      action: 'all',
      resource: 'all',
      success_only: false,
      limit: 100,
    });
    setSearchTerm('');
    setDateRange('24h');
    setActiveTab('all');
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              Security Audit Logs
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitor and analyze all security events across the system
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={loadLogs} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <div className="flex items-center gap-1">
              <Button onClick={() => exportLogs('csv')} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button onClick={() => exportLogs('json')} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                JSON
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEvents}</div>
            <p className="text-xs text-muted-foreground">In selected period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.successRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.totalEvents > 0 ? `${logs.filter(l => l.success).length} successful` : 'No events'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueUsers}</div>
            <p className="text-xs text-muted-foreground">Unique users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Failures
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.recentFailures}
            </div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Critical Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats.criticalEvents}
            </div>
            <p className="text-xs text-muted-foreground">Delete operations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Top Action
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">
              {stats.topActions[0]?.action || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.topActions[0]?.count || 0} times
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Filters</CardTitle>
            <Button onClick={clearFilters} variant="ghost" size="sm">
              Clear All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Date Range Filter */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
            <div className="md:col-span-2">
              <Label htmlFor="date-range">Date Range</Label>
              <Select
                value={dateRange}
                onValueChange={(value: typeof dateRange) => setDateRange(value)}
              >
                <SelectTrigger id="date-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {dateRange === 'custom' && (
              <>
                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </>
            )}
            
            <div className="md:col-span-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search user, action, resource..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          {/* Additional Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="action-filter">Action</Label>
              <Select
                value={filters.action}
                onValueChange={(value) => setFilters({ ...filters, action: value })}
              >
                <SelectTrigger id="action-filter">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  <SelectItem value="LOGIN_SUCCESS">Login Success</SelectItem>
                  <SelectItem value="LOGIN_FAILED">Login Failed</SelectItem>
                  <SelectItem value="LOGOUT">Logout</SelectItem>
                  <SelectItem value="CREATE">Create Operations</SelectItem>
                  <SelectItem value="UPDATE">Update Operations</SelectItem>
                  <SelectItem value="DELETE">Delete Operations</SelectItem>
                  <SelectItem value="EXPORT">Export Operations</SelectItem>
                  <SelectItem value="ROLE_ASSIGNED">Role Assigned</SelectItem>
                  <SelectItem value="ROLE_REMOVED">Role Removed</SelectItem>
                  <SelectItem value="PERMISSION_GRANTED">Permission Granted</SelectItem>
                  <SelectItem value="PERMISSION_REVOKED">Permission Revoked</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="resource-filter">Resource</Label>
              <Select
                value={filters.resource}
                onValueChange={(value) => setFilters({ ...filters, resource: value })}
              >
                <SelectTrigger id="resource-filter">
                  <SelectValue placeholder="All resources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All resources</SelectItem>
                  <SelectItem value="auth">Authentication</SelectItem>
                  <SelectItem value="users">Users</SelectItem>
                  <SelectItem value="roles">Roles</SelectItem>
                  <SelectItem value="permissions">Permissions</SelectItem>
                  <SelectItem value="customers">Customers</SelectItem>
                  <SelectItem value="suppliers">Suppliers</SelectItem>
                  <SelectItem value="inventory">Inventory</SelectItem>
                  <SelectItem value="rentals">Rentals</SelectItem>
                  <SelectItem value="transactions">Transactions</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="backup">Backup</SelectItem>
                  <SelectItem value="audit">Audit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="limit-filter">Limit</Label>
              <Select
                value={filters.limit.toString()}
                onValueChange={(value) => setFilters({ ...filters, limit: parseInt(value) })}
              >
                <SelectTrigger id="limit-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 logs</SelectItem>
                  <SelectItem value="100">100 logs</SelectItem>
                  <SelectItem value="250">250 logs</SelectItem>
                  <SelectItem value="500">500 logs</SelectItem>
                  <SelectItem value="1000">1000 logs</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant={filters.success_only ? 'default' : 'outline'}
                onClick={() => setFilters({ ...filters, success_only: !filters.success_only })}
                className="w-full"
              >
                {filters.success_only ? 'Success Only' : 'All Results'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Tabs */}
      <Card>
        <CardHeader>
          <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">
                All Events ({logs.length})
              </TabsTrigger>
              <TabsTrigger value="security">
                Security ({logs.filter(l => ['auth', 'users', 'roles', 'permissions'].includes(l.resource)).length})
              </TabsTrigger>
              <TabsTrigger value="data">
                Data ({logs.filter(l => ['customers', 'suppliers', 'inventory', 'rentals', 'transactions'].includes(l.resource)).length})
              </TabsTrigger>
              <TabsTrigger value="system">
                System ({logs.filter(l => ['system', 'backup', 'config', 'audit'].includes(l.resource)).length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {formatTimestamp(log.timestamp)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{log.user_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getActionBadgeColor(log.action)}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getResourceIcon(log.resource)}
                          <span>{log.resource}</span>
                          {log.resource_id && (
                            <span className="text-xs text-muted-foreground">
                              ({log.resource_id.substring(0, 8)}...)
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.success ? (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-xs text-green-600">Success</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <XCircle className="h-4 w-4 text-red-600" />
                            <span className="text-xs text-red-600">Failed</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.ip_address || '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewLogDetails(log)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                        No audit logs found for the selected filters
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
            <DialogDescription>
              Complete information about this security event
            </DialogDescription>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Event ID</Label>
                  <div className="font-mono text-sm">{selectedLog.id}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Timestamp</Label>
                  <div className="font-medium">{formatTimestamp(selectedLog.timestamp)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">User</Label>
                  <div className="font-medium">{selectedLog.user_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    ID: {selectedLog.user_id}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Action</Label>
                  <div>
                    <Badge className={getActionBadgeColor(selectedLog.action)}>
                      {selectedLog.action}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Resource</Label>
                  <div className="flex items-center gap-2">
                    {getResourceIcon(selectedLog.resource)}
                    <span className="font-medium">{selectedLog.resource}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Resource ID</Label>
                  <div className="font-mono text-sm">
                    {selectedLog.resource_id || 'N/A'}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="flex items-center gap-2">
                    {selectedLog.success ? (
                      <>
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="text-green-600 font-medium">Success</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 text-red-600" />
                        <span className="text-red-600 font-medium">Failed</span>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">IP Address</Label>
                  <div className="font-mono text-sm">{selectedLog.ip_address || 'N/A'}</div>
                </div>
              </div>
              
              {selectedLog.user_agent && (
                <div>
                  <Label className="text-muted-foreground">User Agent</Label>
                  <div className="mt-1 p-2 bg-muted rounded text-xs font-mono break-all">
                    {selectedLog.user_agent}
                  </div>
                </div>
              )}
              
              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Additional Details</Label>
                  <div className="mt-2 p-3 bg-muted rounded-lg">
                    <pre className="text-sm overflow-x-auto">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
              
              {selectedLog.error_message && (
                <div>
                  <Label className="text-muted-foreground">Error Message</Label>
                  <div className="mt-2 p-3 bg-red-50 rounded-lg text-red-700">
                    {selectedLog.error_message}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}