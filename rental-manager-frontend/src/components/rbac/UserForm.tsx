'use client';

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Key, Users, MapPin, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { userCreateSchema, type UserCreateFormData } from '@/lib/validations';
import { usersApi } from '@/services/api/users';
import { rolesApi } from '@/services/api/roles';
import { locationsApi } from '@/services/api/locations';
import { UserType, UserRole } from '@/types/auth';
import { Location } from '@/types/location';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface UserFormProps {
  onSuccess?: (user: any) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function UserForm({ onSuccess, onCancel, isLoading: externalLoading }: UserFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<UserCreateFormData>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      name: '',
      userType: 'USER',
      roleId: '',
      locationId: '',
      password: '',
      confirmPassword: '',
      directPermissions: [],
      generatePassword: false,
    },
  });

  const { watch, setValue, control, formState: { errors } } = form;
  const watchedFirstName = watch('firstName');
  const watchedLastName = watch('lastName');
  const watchedGeneratePassword = watch('generatePassword');

  // Auto-generate full name when first/last name changes
  useEffect(() => {
    if (watchedFirstName && watchedLastName) {
      setValue('name', `${watchedFirstName} ${watchedLastName}`);
    }
  }, [watchedFirstName, watchedLastName, setValue]);

  // Load roles data
  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesApi.getRoles({ includeSystem: true, limit: 100 }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Load locations data
  const { data: locationsData, isLoading: locationsLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsApi.getActive(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: (userData: UserCreateFormData) => {
      // Transform form data to match API expectations
      const payload = {
        email: userData.email,
        full_name: userData.name || `${userData.firstName} ${userData.lastName}`,
        firstName: userData.firstName,
        lastName: userData.lastName,
        userType: userData.userType,
        roleId: userData.roleId === 'none' || !userData.roleId ? undefined : userData.roleId,
        locationId: userData.locationId === 'none' || !userData.locationId ? undefined : userData.locationId,
        directPermissions: userData.directPermissions || [],
        password: userData.generatePassword ? generateRandomPassword() : userData.password,
      };
      return usersApi.createUser(payload);
    },
    onSuccess: (data) => {
      toast.success('User created successfully!');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onSuccess?.(data);
      form.reset();
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to create user';
      toast.error(errorMessage);
    },
  });

  // Generate random password
  const generateRandomPassword = (): string => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  const handleSubmit = (data: UserCreateFormData) => {
    createUserMutation.mutate(data);
  };

  const isLoading = externalLoading || createUserMutation.isPending;
  const roles = rolesData?.roles || [];
  const locations = locationsData || [];

  const userTypeOptions: { value: UserType; label: string; description: string }[] = [
    { value: 'USER', label: 'User', description: 'Regular system user with assigned permissions' },
    { value: 'ADMIN', label: 'Administrator', description: 'Full system access with user management capabilities' },
    { value: 'CUSTOMER', label: 'Customer', description: 'Limited access to customer portal features' },
    { value: 'SUPERADMIN', label: 'Super Administrator', description: 'Complete system control and configuration access' },
  ];

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Create New User
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  {...form.register('firstName')}
                  placeholder="John"
                  className={errors.firstName ? 'border-red-500' : ''}
                />
                {errors.firstName && (
                  <p className="text-sm text-red-500 mt-1">{errors.firstName.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  {...form.register('lastName')}
                  placeholder="Doe"
                  className={errors.lastName ? 'border-red-500' : ''}
                />
                {errors.lastName && (
                  <p className="text-sm text-red-500 mt-1">{errors.lastName.message}</p>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                {...form.register('email')}
                placeholder="john.doe@example.com"
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && (
                <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="name">Full Name (Display Name)</Label>
              <Input
                id="name"
                {...form.register('name')}
                placeholder="Auto-generated from first and last name"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
              )}
              <p className="text-sm text-gray-500 mt-1">
                This will be automatically generated if left empty
              </p>
            </div>
          </div>

          <Separator />

          {/* User Type and Role */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Access Control
            </h3>
            <div>
              <Label htmlFor="userType">User Type</Label>
              <Controller
                name="userType"
                control={control}
                defaultValue="USER"
                render={({ field: { onChange, value, ...field } }) => (
                  <Select
                    onValueChange={onChange}
                    value={value}
                    defaultValue={value}
                    {...field}
                  >
                    <SelectTrigger className={errors.userType ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select user type" />
                    </SelectTrigger>
                    <SelectContent>
                      {userTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex flex-col">
                            <span className="font-medium">{option.label}</span>
                            <span className="text-sm text-gray-500">{option.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.userType && (
                <p className="text-sm text-red-500 mt-1">{errors.userType.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="roleId">Role (Optional)</Label>
              <Controller
                name="roleId"
                control={control}
                defaultValue=""
                render={({ field: { onChange, value, ...field } }) => (
                  <Select
                    onValueChange={(val) => onChange(val === 'none' ? '' : val)}
                    value={value || 'none'}
                    disabled={rolesLoading}
                    {...field}
                  >
                    <SelectTrigger className={errors.roleId ? 'border-red-500' : ''}>
                      <SelectValue placeholder={rolesLoading ? "Loading roles..." : "Select role (optional)"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No role assigned</SelectItem>
                      {roles.map((role: UserRole) => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{role.name}</span>
                            {role.isSystem && <Badge variant="secondary" className="ml-2">System</Badge>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.roleId && (
                <p className="text-sm text-red-500 mt-1">{errors.roleId.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="locationId">Location (Optional)</Label>
              <Controller
                name="locationId"
                control={control}
                defaultValue=""
                render={({ field: { onChange, value, ...field } }) => (
                  <Select
                    onValueChange={(val) => onChange(val === 'none' ? '' : val)}
                    value={value || 'none'}
                    disabled={locationsLoading}
                    {...field}
                  >
                    <SelectTrigger className={errors.locationId ? 'border-red-500' : ''}>
                      <SelectValue placeholder={locationsLoading ? "Loading locations..." : "Select location (optional)"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No location assigned</SelectItem>
                      {locations.map((location: Location) => (
                        <SelectItem key={location.id} value={location.id}>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>{location.location_name}</span>
                            <Badge variant="outline">{location.location_type}</Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.locationId && (
                <p className="text-sm text-red-500 mt-1">{errors.locationId.message}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Password Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Key className="h-5 w-5" />
              Password Settings
            </h3>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="generatePassword"
                checked={watchedGeneratePassword}
                onCheckedChange={(checked) => setValue('generatePassword', !!checked)}
              />
              <Label htmlFor="generatePassword">Generate random password</Label>
            </div>

            {watchedGeneratePassword && (
              <Alert>
                <AlertDescription>
                  A secure random password will be generated for this user. Make sure to securely share it with them.
                </AlertDescription>
              </Alert>
            )}

            {!watchedGeneratePassword && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      {...form.register('password')}
                      placeholder="Enter password"
                      className={errors.password ? 'border-red-500' : ''}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      {...form.register('confirmPassword')}
                      placeholder="Confirm password"
                      className={errors.confirmPassword ? 'border-red-500' : ''}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-500 mt-1">{errors.confirmPassword.message}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default UserForm;