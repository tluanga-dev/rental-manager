'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useAppStore } from '@/stores/app-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Wifi, 
  WifiOff, 
  User, 
  Shield, 
  Bell, 
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { healthApi } from '@/services/api/health';

export function ConnectionStatusDemo() {
  const { 
    isAuthenticated, 
    isBackendOnline, 
    lastBackendCheck,
    checkBackendHealth,
    user,
    logout
  } = useAuthStore();
  const { addNotification } = useAppStore();
  
  const [isChecking, setIsChecking] = useState(false);
  const [healthData, setHealthData] = useState<any>(null);

  const handleHealthCheck = async () => {
    setIsChecking(true);
    try {
      const health = await healthApi.checkHealth();
      setHealthData(health);
      addNotification({
        type: 'success',
        title: 'Health Check Complete',
        message: `Backend status: ${health.status}`,
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Health Check Failed',
        message: 'Unable to retrieve health information',
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleConnectivityCheck = async () => {
    setIsChecking(true);
    const isOnline = await checkBackendHealth();
    addNotification({
      type: isOnline ? 'success' : 'error',
      title: 'Connectivity Check',
      message: isOnline ? 'Backend is online' : 'Backend is offline',
    });
    setIsChecking(false);
  };

  const handleTestNotification = () => {
    addNotification({
      type: 'info',
      title: 'Test Notification',
      message: 'This is a test notification to verify the system is working.',
    });
  };

  const handleLogout = () => {
    logout();
    addNotification({
      type: 'success',
      title: 'Logged Out',
      message: 'You have been successfully logged out.',
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Authentication & Connectivity Demo
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Test the authentication and backend connectivity monitoring system
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Authentication Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Authentication</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {isAuthenticated ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <Badge variant={isAuthenticated ? "default" : "destructive"}>
                {isAuthenticated ? "Authenticated" : "Not Authenticated"}
              </Badge>
            </div>
            {user && (
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {user.firstName} {user.lastName}
                <br />
                <span className="text-xs">{user.email}</span>
              </div>
            )}
            <Button 
              onClick={handleLogout} 
              variant="outline" 
              size="sm" 
              className="mt-2 w-full"
              disabled={!isAuthenticated}
            >
              Test Logout
            </Button>
          </CardContent>
        </Card>

        {/* Backend Connectivity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Backend Status</CardTitle>
            {isBackendOnline ? (
              <Wifi className="h-4 w-4 text-green-600" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Badge variant={isBackendOnline ? "default" : "destructive"}>
                {isBackendOnline ? "Online" : "Offline"}
              </Badge>
            </div>
            {lastBackendCheck && (
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                Last checked: {lastBackendCheck.toLocaleTimeString()}
              </div>
            )}
            <Button 
              onClick={handleConnectivityCheck} 
              variant="outline" 
              size="sm" 
              className="mt-2 w-full"
              disabled={isChecking}
            >
              {isChecking ? (
                <RefreshCw className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Check Connection
            </Button>
          </CardContent>
        </Card>

        {/* Health Check */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Check</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {healthData ? (
                <Badge variant={healthData.status === 'healthy' ? "default" : "destructive"}>
                  {healthData.status}
                </Badge>
              ) : (
                <Badge variant="secondary">Not Checked</Badge>
              )}
            </div>
            {healthData && (
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                {healthData.timestamp && (
                  <div>Time: {new Date(healthData.timestamp).toLocaleTimeString()}</div>
                )}
                {healthData.version && (
                  <div>Version: {healthData.version}</div>
                )}
              </div>
            )}
            <Button 
              onClick={handleHealthCheck} 
              variant="outline" 
              size="sm" 
              className="mt-2 w-full"
              disabled={isChecking || !isBackendOnline}
            >
              {isChecking ? (
                <RefreshCw className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Shield className="h-3 w-3 mr-1" />
              )}
              Health Check
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5" />
            <span>System Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This demo shows the authentication and connectivity monitoring features.
              The system automatically checks backend connectivity every 30 seconds and
              shows the connection status in the top navigation bar. When offline, you'll
              see a red "Connection Lost" indicator that you can click to retry.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Features Demonstrated:</h4>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Real-time backend connectivity monitoring</li>
                <li>• Authentication status checking</li>
                <li>• Automatic health checks every 30 seconds</li>
                <li>• Connection status in top navigation bar</li>
                <li>• Automatic logout after 5 minutes offline</li>
                <li>• Manual retry functionality</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Test Actions:</h4>
              <div className="space-y-2">
                <Button 
                  onClick={handleTestNotification} 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                >
                  <Bell className="h-3 w-3 mr-1" />
                  Test Notification
                </Button>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Try stopping your backend server to see the offline behavior,
                  or test logout to see authentication flow.
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
