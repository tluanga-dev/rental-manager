'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { loginSchema, type LoginFormData } from '@/lib/validations';
import { useAuthStore } from '@/stores/auth-store';
import { useAppStore } from '@/stores/app-store';
import { apiClient } from '@/lib/axios';
import { Loader2, AlertCircle } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const { login, setIsLoading } = useAuthStore();
  const { addNotification } = useAppStore();
  const [error, setError] = useState<string>('');

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setError('');
    setIsLoading(true);

    // Log the payload being sent to backend
    const loginPayload = {
      username: data.username, // Using username for authentication
      password: data.password,
    };
    
    console.log('🔐 Frontend Login Payload:', {
      ...loginPayload,
      password: '***HIDDEN***' // Don't log actual password
    });
    console.log('📤 Sending login request to:', `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/v1/auth/login`);

    try {
      // Real API call to backend
      const response = await apiClient.post('/v1/auth/login', loginPayload);

      const responseData = response.data.data || response.data;
      const { user, access_token, refresh_token } = responseData;
      
      // Update auth store
      login(user, access_token, refresh_token);
      
      // Add success notification
      addNotification({
        type: 'success',
        title: 'Login Successful',
        message: `Welcome back, ${user.first_name || user.name}!`,
      });

      // Redirect to dashboard/main page after successful login
      // Use setTimeout to ensure state updates are complete before navigation
      setTimeout(() => {
        router.push('/dashboard/main');
        // Fallback to window.location if router doesn't work
        setTimeout(() => {
          if (window.location.pathname === '/login') {
            window.location.href = '/dashboard/main';
          }
        }, 500);
      }, 100);
      
    } catch (error: unknown) {
      console.error('❌ Login failed with error:', error);
      
      let errorMessage = 'Login failed. Please try again.';
      
      if (error && typeof error === 'object' && 'response' in error) {
        const apiError = error as { response?: { data?: { detail?: string; message?: string }; status?: number; statusText?: string } };
        
        console.error('📥 Backend error response:', {
          status: apiError.response?.status,
          statusText: apiError.response?.statusText,
          data: apiError.response?.data
        });
        
        errorMessage = apiError.response?.data?.detail || apiError.response?.data?.message || errorMessage;
      }
      
      setError(errorMessage);
      
      addNotification({
        type: 'error',
        title: 'Login Failed',
        message: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Demo login functionality for development
  const handleDemoLogin = async (role: 'admin' | 'manager' | 'staff') => {
    console.log('🎭 Demo login attempt for role:', role);
    setIsLoading(true);
    setError('');
    
    try {
      const credentials = {
        admin: { username: 'admin', password: 'admin123' },
        manager: { username: 'manager', password: 'manager123' },
        staff: { username: 'staff', password: 'staff123' },
      };

      const { username, password } = credentials[role];
      
      const demoPayload = { username, password };
      
      console.log('🔐 Frontend Demo Login Payload:', {
        ...demoPayload,
        password: '***HIDDEN***' // Don't log actual password
      });
      console.log('📤 Making demo API call to:', `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/v1/auth/login`);
      
      // Use real API call
      const response = await apiClient.post('/v1/auth/login', demoPayload);

      console.log('✅ Demo API response status:', response.status);
      console.log('📥 Demo API response data:', response.data);

      const responseData = response.data.data || response.data;
      const { user, access_token, refresh_token } = responseData;
      
      // Update auth store
      login(user, access_token, refresh_token);
      
      addNotification({
        type: 'success',
        title: 'Demo Login Successful',
        message: `Logged in as ${user.role?.name || 'Admin'}`,
      });

      // Use setTimeout to ensure state updates are complete before navigation
      setTimeout(() => {
        router.push('/dashboard/main');
        // Fallback to window.location if router doesn't work
        setTimeout(() => {
          if (window.location.pathname === '/login') {
            window.location.href = '/dashboard/main';
          }
        }, 500);
      }, 100);
      
    } catch (error: unknown) {
      console.error('❌ Demo login failed with error:', error);
      
      let errorMessage = 'Demo login failed. Please try again.';
      
      if (error && typeof error === 'object' && 'response' in error) {
        const apiError = error as { response?: { data?: { detail?: string; message?: string }; status?: number; statusText?: string } };
        
        console.error('📥 Demo Backend error response:', {
          status: apiError.response?.status,
          statusText: apiError.response?.statusText,
          data: apiError.response?.data
        });
        
        errorMessage = apiError.response?.data?.detail || apiError.response?.data?.message || errorMessage;
      }
      
      setError(errorMessage);
      
      addNotification({
        type: 'error',
        title: 'Demo Login Failed',
        message: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isLoading = useAuthStore(state => state.isLoading);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl text-center">Login to Rental Manager</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username or Email</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter your username or email" 
                      type="text"
                      autoComplete="username"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder="Enter your password" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </Button>
          </form>
        </Form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or try demo</span>
          </div>
        </div>

        <div className="space-y-2">
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => handleDemoLogin('admin')}
            disabled={isLoading}
          >
            Demo as Administrator
          </Button>
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => handleDemoLogin('manager')}
            disabled={isLoading}
          >
            Demo as Manager
          </Button>
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => handleDemoLogin('staff')}
            disabled={isLoading}
          >
            Demo as Staff
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}