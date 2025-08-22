# Authentication and Backend Connectivity System

This document describes the implementation of the authentication and backend connectivity checking system for the Rental Manager frontend.

## Features

### 1. Authentication Management
- **Automatic Login Checks**: Verifies user authentication status on protected routes
- **Automatic Redirects**: Redirects unauthenticated users to the login page
- **Session Management**: Handles token refresh and session expiration
- **Loading States**: Shows appropriate loading indicators during authentication checks

### 2. Backend Connectivity Monitoring
- **Real-time Health Checks**: Monitors backend server status every 30 seconds
- **Connection Status Indicator**: Shows online/offline status in the top navigation bar
- **Offline Notifications**: Shows notifications when connection is lost/restored
- **Auto-logout on Extended Downtime**: Logs out users after 5 minutes of backend downtime
- **Manual Retry**: Allows users to manually retry connections via top bar

### 3. User Notifications
- **Connection Status Changes**: Notifies users when backend comes online/offline
- **Authentication Alerts**: Informs users about authentication requirements
- **Error Handling**: Provides clear feedback for network and authentication errors

## Components

### AuthConnectionGuard
The main component that handles both authentication and connectivity checking.

```tsx
import { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';

// For pages that require authentication
<AuthConnectionGuard requireAuth={true} showOfflineAlert={true}>
  <YourPageContent />
</AuthConnectionGuard>

// For public pages that still need connectivity monitoring
<AuthConnectionGuard requireAuth={false} showOfflineAlert={true}>
  <YourPublicContent />
</AuthConnectionGuard>
```

#### Props
- `requireAuth` (boolean): Whether authentication is required for this page/component
- `showOfflineAlert` (boolean): Whether to show offline alerts and banners
- `children` (ReactNode): The content to render when checks pass

### ProtectedRoute
A simpler component for pages that only need authentication checking (without connectivity monitoring).

```tsx
import { ProtectedRoute } from '@/components/auth/protected-route';

<ProtectedRoute requireAuth={true} redirectTo="/login">
  <YourProtectedContent />
</ProtectedRoute>
```

## Store Integration

### Auth Store Extensions
The auth store has been extended with backend connectivity methods:

```typescript
// New state properties
isBackendOnline: boolean;
lastBackendCheck: Date | null;

// New methods
setBackendStatus: (isOnline: boolean) => void;
checkBackendHealth: () => Promise<boolean>;
```

### Usage in Components
```tsx
import { useAuthStore } from '@/stores/auth-store';

function MyComponent() {
  const { 
    isAuthenticated, 
    isBackendOnline, 
    checkBackendHealth 
  } = useAuthStore();

  const handleRetryConnection = async () => {
    const isOnline = await checkBackendHealth();
    if (isOnline) {
      // Handle successful reconnection
    }
  };

  return (
    <div>
      <span>Backend: {isBackendOnline ? 'Online' : 'Offline'}</span>
      <button onClick={handleRetryConnection}>Retry Connection</button>
    </div>
  );
}
```

## Axios Interceptor Updates

The axios client now includes:

### Response Interceptor
- Updates backend status on successful responses
- Handles network errors (no response = backend offline)
- Manages authentication errors with automatic token refresh

### Request Interceptor
- Adds correlation IDs for request tracking
- Includes authentication tokens automatically

## Implementation in Layout

### Main Layout
The `MainLayout` component now wraps all content with `AuthConnectionGuard`:

```tsx
export function MainLayout({ children }: MainLayoutProps) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return (
      <AuthConnectionGuard requireAuth={false} showOfflineAlert={true}>
        {children}
      </AuthConnectionGuard>
    );
  }

  return (
    <AuthConnectionGuard requireAuth={true} showOfflineAlert={true}>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        {/* Layout content */}
      </div>
    </AuthConnectionGuard>
  );
}
```

### Top Bar
The top bar now includes a connection status indicator:

```tsx
<button
  onClick={handleCheckConnection}
  className={cn(
    "flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs border",
    isBackendOnline
      ? "text-green-600 border-green-200 hover:bg-green-50"
      : "text-red-600 border-red-200 bg-red-50 font-medium"
  )}
>
  {isBackendOnline ? <Wifi /> : <WifiOff />}
  <span>{isBackendOnline ? "Server Online" : "Connection Lost - Click to retry"}</span>
</button>
```

## Health Check API

A dedicated health check API is available for testing connectivity:

```typescript
import { healthApi } from '@/services/api/health';

// Basic health check
const health = await healthApi.checkHealth();

// Detailed health check (includes database, services)
const detailedHealth = await healthApi.checkDetailedHealth();

// Check specific service
const isServiceUp = await healthApi.checkServiceHealth('database');
```

## Configuration

### Environment Variables
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### Timeouts and Intervals
- **Health Check Interval**: 30 seconds
- **Health Check Timeout**: 5 seconds
- **Auto-logout Delay**: 5 minutes of backend downtime
- **Axios Request Timeout**: 10 seconds

## Usage Examples

### Protected Page with Full Monitoring
```tsx
'use client';

import { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';
import { ProtectedRoute } from '@/components/auth/protected-route';

export default function CustomersPage() {
  return (
    <AuthConnectionGuard requireAuth={true} showOfflineAlert={true}>
      <ProtectedRoute>
        <CustomersContent />
      </ProtectedRoute>
    </AuthConnectionGuard>
  );
}
```

### Public Page with Connectivity Monitoring
```tsx
'use client';

import { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';

export default function LoginPage() {
  return (
    <AuthConnectionGuard requireAuth={false} showOfflineAlert={true}>
      <LoginForm />
    </AuthConnectionGuard>
  );
}
```

### Component-Level Usage
```tsx
import { useAuthStore } from '@/stores/auth-store';
import { useAppStore } from '@/stores/app-store';

function DataComponent() {
  const { isAuthenticated, isBackendOnline } = useAuthStore();
  const { addNotification } = useAppStore();

  useEffect(() => {
    if (!isAuthenticated) {
      addNotification({
        type: 'warning',
        title: 'Authentication Required',
        message: 'Please log in to view this data.',
      });
      return;
    }

    if (!isBackendOnline) {
      addNotification({
        type: 'error',
        title: 'Connection Lost',
        message: 'Unable to load data due to connectivity issues.',
      });
      return;
    }

    // Load data when both authenticated and connected
    loadData();
  }, [isAuthenticated, isBackendOnline]);

  // Component implementation...
}
```

## Error Handling

### Network Errors
- Automatically detected via axios interceptors
- Backend status updated immediately
- User notifications triggered
- Fallback responses provided for API calls

### Authentication Errors
- 401 responses trigger token refresh attempts
- Failed refresh redirects to login page
- User session cleared on authentication failure
- Clear error messages provided to users

### Graceful Degradation
- API calls return fallback data when backend is offline
- UI shows appropriate loading/error states
- Users can continue using cached data where possible
- Manual retry options always available

## Best Practices

1. **Always wrap authenticated pages** with `AuthConnectionGuard`
2. **Use the existing `ProtectedRoute`** for additional permission checks
3. **Check `isBackendOnline`** before making non-critical API calls
4. **Provide fallback UI** for offline scenarios
5. **Show loading states** during authentication and connectivity checks
6. **Use notifications** to keep users informed of status changes

## Testing

To test the connectivity features:

1. **Backend Offline**: Stop the backend server and observe the offline banner
2. **Authentication Required**: Access protected routes without authentication
3. **Connection Recovery**: Restart the backend and verify reconnection notifications
4. **Extended Downtime**: Leave backend offline for 5+ minutes to test auto-logout

The system provides comprehensive monitoring and graceful handling of both authentication and connectivity issues, ensuring a robust user experience even in adverse network conditions.
