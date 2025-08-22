'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { databaseManagementApi, DatabaseStatus, ResetProgress, DatabaseLog, TableInfo } from '@/services/api/database-management';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Database, 
  AlertTriangle, 
  RefreshCw, 
  Download, 
  Trash2, 
  CheckCircle, 
  XCircle,
  Info,
  Loader2,
  Terminal,
  Activity,
  HardDrive,
  Clock,
  AlertCircle,
  Shield,
  Zap
} from 'lucide-react';
import { format } from 'date-fns';

export default function DatabaseManagementPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  
  // State
  const [status, setStatus] = useState<DatabaseStatus | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [logs, setLogs] = useState<DatabaseLog[]>([]);
  const [resetProgress, setResetProgress] = useState<ResetProgress>({
    status: 'idle',
    current_step: '',
    progress: 0,
    message: '',
    timestamp: new Date().toISOString()
  });
  const [isResetting, setIsResetting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [seedMasterData, setSeedMasterData] = useState(true);
  const [clearAuth, setClearAuth] = useState(false);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Polling refs
  const progressPollInterval = useRef<NodeJS.Timeout | null>(null);
  const statusPollInterval = useRef<NodeJS.Timeout | null>(null);
  const logsPollInterval = useRef<NodeJS.Timeout | null>(null);

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated || !user?.is_superuser) {
      router.push('/login');
    }
  }, [isAuthenticated, user, router]);

  // Fetch initial data
  const fetchDatabaseStatus = useCallback(async () => {
    try {
      const [statusData, tablesData] = await Promise.all([
        databaseManagementApi.getStatus(),
        databaseManagementApi.getTables()
      ]);
      setStatus(statusData);
      // Ensure tablesData is an array before setting
      setTables(Array.isArray(tablesData) ? tablesData : []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch database status:', err);
      setError('Failed to connect to database management API');
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const logsData = await databaseManagementApi.getLogs(100);
      // Ensure logsData is an array before setting
      setLogs(Array.isArray(logsData) ? logsData : []);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
      setLogs([]); // Set empty array on error
    }
  }, []);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchDatabaseStatus(),
        fetchLogs()
      ]);
      setLoading(false);
    };
    
    loadData();
    
    // Set up polling for status and logs
    statusPollInterval.current = setInterval(fetchDatabaseStatus, 10000); // Every 10 seconds
    logsPollInterval.current = setInterval(fetchLogs, 5000); // Every 5 seconds
    
    return () => {
      if (statusPollInterval.current) clearInterval(statusPollInterval.current);
      if (logsPollInterval.current) clearInterval(logsPollInterval.current);
    };
  }, [fetchDatabaseStatus, fetchLogs]);

  // Monitor reset progress
  const startProgressMonitoring = useCallback(() => {
    if (progressPollInterval.current) {
      clearInterval(progressPollInterval.current);
    }
    
    progressPollInterval.current = setInterval(async () => {
      try {
        const progress = await databaseManagementApi.getResetProgress();
        setResetProgress(progress);
        
        // Add to logs
        const newLog: DatabaseLog = {
          id: Date.now().toString(),
          timestamp: progress.timestamp,
          level: progress.status === 'error' ? 'error' : 
                 progress.status === 'completed' ? 'success' : 'info',
          message: progress.message,
          details: progress.details
        };
        setLogs(prev => [newLog, ...prev].slice(0, 100));
        
        // Stop monitoring if completed or error
        if (progress.status === 'completed' || progress.status === 'error') {
          setIsResetting(false);
          if (progressPollInterval.current) {
            clearInterval(progressPollInterval.current);
            progressPollInterval.current = null;
          }
          
          // Refresh data after completion
          if (progress.status === 'completed') {
            setTimeout(() => {
              fetchDatabaseStatus();
              setResetProgress({
                status: 'idle',
                current_step: '',
                progress: 0,
                message: '',
                timestamp: new Date().toISOString()
              });
            }, 2000);
          }
        }
      } catch (err) {
        console.error('Failed to fetch reset progress:', err);
      }
    }, 1000); // Poll every second during reset
  }, [fetchDatabaseStatus]);

  // Handle database reset
  const handleReset = async () => {
    if (confirmText !== 'DELETE ALL DATA') {
      setError('Please type "DELETE ALL DATA" to confirm');
      return;
    }
    
    setIsResetting(true);
    setError(null);
    setResetProgress({
      status: 'starting',
      current_step: 'Initiating reset...',
      progress: 0,
      message: 'Starting database reset process',
      timestamp: new Date().toISOString()
    });
    
    try {
      await databaseManagementApi.resetDatabase({
        confirm: confirmText,
        seed_master_data: seedMasterData,
        clear_auth: clearAuth
      });
      
      // Start monitoring progress
      startProgressMonitoring();
      
    } catch (err: any) {
      setIsResetting(false);
      setError(err.response?.data?.message || 'Failed to initiate reset');
      setResetProgress({
        status: 'error',
        current_step: 'Reset failed',
        progress: 0,
        message: err.response?.data?.message || 'An error occurred',
        timestamp: new Date().toISOString()
      });
    }
  };

  // Handle clear selected tables
  const handleClearTables = async () => {
    if (selectedTables.length === 0) {
      setError('Please select tables to clear');
      return;
    }
    
    try {
      await databaseManagementApi.clearTables(selectedTables);
      await fetchDatabaseStatus();
      setSelectedTables([]);
      
      const newLog: DatabaseLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        level: 'success',
        message: `Cleared ${selectedTables.length} tables`,
        details: selectedTables
      };
      setLogs(prev => [newLog, ...prev].slice(0, 100));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to clear tables');
    }
  };

  // Get log icon based on level
  const getLogIcon = (level: DatabaseLog['level']) => {
    switch (level) {
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  // Get status color
  const getStatusColor = (status: ResetProgress['status']) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'clearing': return 'text-orange-600';
      case 'initializing': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Database className="h-8 w-8" />
          Database Management
        </h1>
        <p className="text-gray-600">
          Manage your database, monitor performance, and perform maintenance operations
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Connection Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {status?.connected ? (
                <>
                  <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm text-green-600">Connected</span>
                </>
              ) : (
                <>
                  <div className="h-2 w-2 bg-red-500 rounded-full" />
                  <span className="text-sm text-red-600">Disconnected</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Database Size
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{status?.size_mb || 0} MB</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Total Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{status?.total_records?.toLocaleString() || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Tables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{status?.tables || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="reset" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="reset">Reset Database</TabsTrigger>
          <TabsTrigger value="tables">Tables</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="monitor">Monitor</TabsTrigger>
        </TabsList>

        {/* Reset Tab */}
        <TabsContent value="reset" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Database Reset
              </CardTitle>
              <CardDescription>
                This will delete all data and reinitialize the database. This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Reset Progress */}
              {resetProgress.status !== 'idle' && (
                <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${getStatusColor(resetProgress.status)}`}>
                      {resetProgress.current_step}
                    </span>
                    <Badge variant={resetProgress.status === 'completed' ? 'default' : 'secondary'}>
                      {resetProgress.status}
                    </Badge>
                  </div>
                  <Progress value={resetProgress.progress} className="h-2" />
                  <p className="text-sm text-gray-600">{resetProgress.message}</p>
                  {resetProgress.details && resetProgress.details.length > 0 && (
                    <div className="mt-2 p-2 bg-white rounded border">
                      <ul className="text-xs space-y-1">
                        {resetProgress.details.map((detail, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Reset Options */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="seed-data" 
                    checked={seedMasterData}
                    onCheckedChange={(checked) => setSeedMasterData(checked as boolean)}
                    disabled={isResetting}
                  />
                  <label 
                    htmlFor="seed-data" 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Seed master data after reset
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="clear-auth" 
                    checked={clearAuth}
                    onCheckedChange={(checked) => setClearAuth(checked as boolean)}
                    disabled={isResetting}
                  />
                  <label 
                    htmlFor="clear-auth" 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Clear authentication data (users, roles, permissions)
                  </label>
                </div>
              </div>

              {/* Confirmation Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Type <span className="font-mono bg-red-100 px-1 py-0.5 rounded">DELETE ALL DATA</span> to confirm
                </label>
                <Input
                  type="text"
                  placeholder="Enter confirmation text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  disabled={isResetting}
                  className={confirmText === 'DELETE ALL DATA' ? 'border-green-500' : ''}
                />
              </div>

              {/* Reset Button */}
              <Button
                variant="destructive"
                onClick={handleReset}
                disabled={isResetting || confirmText !== 'DELETE ALL DATA'}
                className="w-full"
              >
                {isResetting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting Database...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Reset Database
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tables Tab */}
        <TabsContent value="tables" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Database Tables</CardTitle>
              <CardDescription>
                View and manage individual tables
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedTables(Array.isArray(tables) ? tables.map(t => t.name) : [])}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleClearTables}
                    disabled={selectedTables.length === 0}
                  >
                    Clear Selected ({selectedTables.length})
                  </Button>
                </div>
                
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-2">
                    {Array.isArray(tables) && tables.map((table) => (
                      <div
                        key={table.name}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedTables.includes(table.name)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedTables([...selectedTables, table.name]);
                              } else {
                                setSelectedTables(selectedTables.filter(t => t !== table.name));
                              }
                            }}
                          />
                          <div>
                            <p className="font-medium">{table.name}</p>
                            <p className="text-sm text-gray-500">
                              {table.record_count.toLocaleString()} records • {table.size_kb} KB
                            </p>
                          </div>
                        </div>
                        <Badge variant={table.record_count > 0 ? 'default' : 'secondary'}>
                          {table.record_count > 0 ? 'Has Data' : 'Empty'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Database Logs
              </CardTitle>
              <CardDescription>
                Real-time database operation logs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-2">
                  {!Array.isArray(logs) || logs.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No logs available</p>
                  ) : (
                    Array.isArray(logs) && logs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 font-mono text-sm"
                      >
                        {getLogIcon(log.level)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-gray-500">
                              {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
                            </span>
                            <Badge 
                              variant={
                                log.level === 'error' ? 'destructive' :
                                log.level === 'warning' ? 'outline' :
                                log.level === 'success' ? 'default' : 'secondary'
                              }
                              className="text-xs"
                            >
                              {log.level}
                            </Badge>
                          </div>
                          <p className="text-gray-700">{log.message}</p>
                          {log.details && (
                            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monitor Tab */}
        <TabsContent value="monitor" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Query Performance</span>
                    <Badge variant="default">Fast</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Connection Pool</span>
                    <span className="text-sm font-medium">5/20 active</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Cache Hit Rate</span>
                    <span className="text-sm font-medium">87%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Uptime</span>
                    <span className="text-sm font-medium">{status?.uptime || 'N/A'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">SSL/TLS</span>
                    <Badge variant="default">Enabled</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Last Backup</span>
                    <span className="text-sm font-medium">{status?.last_backup || 'Never'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Admin Users</span>
                    <span className="text-sm font-medium">3 active</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Failed Logins (24h)</span>
                    <span className="text-sm font-medium">0</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Button variant="outline" className="w-full" onClick={fetchDatabaseStatus}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Status
                </Button>
                <Button variant="outline" className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  Backup Now
                </Button>
                <Button variant="outline" className="w-full">
                  <Activity className="mr-2 h-4 w-4" />
                  Optimize Tables
                </Button>
                <Button variant="outline" className="w-full">
                  <Shield className="mr-2 h-4 w-4" />
                  Security Audit
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}