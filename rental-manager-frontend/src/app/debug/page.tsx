'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Server,
  Database,
  Cpu,
  HardDrive,
  Activity
} from 'lucide-react';
import { apiClient } from '@/lib/axios';

interface HealthCheck {
  status: string;
  message: string;
  all_columns?: string[];
}

interface HealthData {
  timestamp: string;
  service: string;
  version: string;
  status: string;
  checks: Record<string, HealthCheck>;
  system_info: {
    python_version: string;
    platform: string;
    architecture: string[];
    hostname: string;
  };
  configuration: {
    debug_mode: boolean;
    database_echo: boolean;
    cors_origins: number;
    use_whitelist: boolean;
  };
  import_status: Record<string, HealthCheck>;
}

export default function DebugPage() {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealthData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<HealthData>('/health/detailed');
      setHealthData(response.data.data || response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch health data');
      console.error('Health check failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'success':
        return 'bg-green-500';
      case 'degraded':
      case 'unhealthy':
        return 'bg-yellow-500';
      case 'failed':
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'degraded':
      case 'unhealthy':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'failed':
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading system health data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Debug Dashboard Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700 mb-4">{error}</p>
            <Button onClick={fetchHealthData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Debug Dashboard</h1>
          <p className="text-muted-foreground">System health and diagnostic information</p>
        </div>
        <Button onClick={fetchHealthData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {healthData && (
        <>
          {/* Overall Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Server className="h-5 w-5" />
                System Status
                <Badge className={`${getStatusColor(healthData.status)} text-white`}>
                  {healthData.status.toUpperCase()}
                </Badge>
              </CardTitle>
              <CardDescription>
                {healthData.service} v{healthData.version} - Last updated: {new Date(healthData.timestamp).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">System Information</h4>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">Python:</span> {healthData.system_info.python_version.split(' ')[0]}</p>
                    <p><span className="font-medium">Platform:</span> {healthData.system_info.platform}</p>
                    <p><span className="font-medium">Architecture:</span> {healthData.system_info.architecture.join(', ')}</p>
                    <p><span className="font-medium">Hostname:</span> {healthData.system_info.hostname}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Configuration</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Debug Mode:</span>
                      {healthData.configuration.debug_mode ? (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Enabled</Badge>
                      ) : (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </div>
                    <p><span className="font-medium">CORS Origins:</span> {healthData.configuration.cors_origins}</p>
                    <p><span className="font-medium">Whitelist Enabled:</span> {healthData.configuration.use_whitelist ? 'Yes' : 'No'}</p>
                    <p><span className="font-medium">Database Echo:</span> {healthData.configuration.database_echo ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service Health Checks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Activity className="h-5 w-5" />
                Service Health Checks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(healthData.checks).map(([service, check]) => (
                  <div key={service} className="flex items-start gap-3 p-3 border rounded-lg">
                    {getStatusIcon(check.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold capitalize">{service}</span>
                        <Badge className={`${getStatusColor(check.status)} text-white`}>
                          {check.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{check.message}</p>
                      {check.all_columns && (
                        <details className="mt-2">
                          <summary className="text-xs cursor-pointer hover:text-blue-600">
                            Show database columns
                          </summary>
                          <div className="mt-1 p-2 bg-gray-50 rounded text-xs">
                            <p><strong>Available columns:</strong></p>
                            <div className="grid grid-cols-3 gap-2 mt-1">
                              {check.all_columns.map((col, idx) => (
                                <span key={idx} className="font-mono text-xs">{col}</span>
                              ))}
                            </div>
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Import Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <HardDrive className="h-5 w-5" />
                Import Status
              </CardTitle>
              <CardDescription>
                Status of critical module imports that may cause runtime errors
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(healthData.import_status).map(([module, status]) => (
                  <div key={module} className="flex items-center gap-3 p-3 border rounded-lg">
                    {getStatusIcon(status.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                          {module}
                        </code>
                        <Badge className={`${getStatusColor(status.status)} text-white`}>
                          {status.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{status.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Common debugging and diagnostic actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    console.group('🔍 Complete System Health Data');
                    console.log('Health Data:', healthData);
                    console.groupEnd();
                  }}
                >
                  Log Health Data to Console
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const data = JSON.stringify(healthData, null, 2);
                    navigator.clipboard.writeText(data);
                  }}
                >
                  Copy Health Data
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open('/api/docs', '_blank')}
                >
                  Open API Docs
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    console.clear();
                    console.log('Console cleared for debugging');
                  }}
                >
                  Clear Console
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}