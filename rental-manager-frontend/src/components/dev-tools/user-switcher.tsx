'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { USER_PERSONAS, getUserPersonaById, createCustomPersona, type UserPersona } from '@/lib/dev-user-personas';
import { DevAuthLogger } from '@/lib/dev-auth-logger';
import { ChevronDown, Users, Plus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserSwitcherProps {
  className?: string;
}

export function UserSwitcher({ className = '' }: UserSwitcherProps) {
  const { 
    user,
    isDevelopmentMode, 
    isAuthDisabled,
    bypassAuthentication,
    setUser,
    setTokens,
    updatePermissions
  } = useAuthStore();
  
  const [isCustomDialogOpen, setIsCustomDialogOpen] = useState(false);
  const [customUser, setCustomUser] = useState({
    id: '',
    name: '',
    description: '',
    userType: 'CUSTOM',
    permissions: ''
  });

  // Only show in development mode with auth disabled
  if (!isDevelopmentMode || !isAuthDisabled) {
    return null;
  }

  const currentPersona = USER_PERSONAS.find(p => p.user.id === user?.id) || USER_PERSONAS[0];

  const switchToPersona = (persona: UserPersona) => {
    const currentUser = user;
    
    // Update auth store with new persona
    setUser(persona.user);
    setTokens('dev-access-token', 'dev-refresh-token');
    
    // Log user switch
    DevAuthLogger.logUserSwitch(currentUser, persona.user);
    
    // Store the selection in localStorage for persistence
    localStorage.setItem('dev-selected-persona', persona.id);
  };

  const handleCustomUserCreate = () => {
    if (!customUser.id || !customUser.name) return;
    
    const permissions = customUser.permissions
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    const customPersona = createCustomPersona(
      customUser.id,
      customUser.name,
      customUser.description,
      permissions,
      customUser.userType
    );
    
    switchToPersona(customPersona);
    setIsCustomDialogOpen(false);
    
    // Reset form
    setCustomUser({
      id: '',
      name: '',
      description: '',
      userType: 'CUSTOM',
      permissions: ''
    });
  };

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className="flex items-center gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 ${currentPersona.color} rounded-full flex items-center justify-center text-xs`}>
                {currentPersona.icon}
              </div>
              <span className="hidden sm:inline font-medium">{currentPersona.name}</span>
              <span className="sm:hidden font-medium">
                {currentPersona.user.userType}
              </span>
            </div>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Switch Development User
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {USER_PERSONAS.map((persona) => (
            <DropdownMenuItem
              key={persona.id}
              onClick={() => switchToPersona(persona)}
              className="flex items-center gap-3 p-3 cursor-pointer"
            >
              <div className={`w-8 h-8 ${persona.color} rounded-full flex items-center justify-center text-sm`}>
                {persona.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{persona.name}</span>
                  {persona.user.id === user?.id && (
                    <Check className="h-4 w-4 text-green-600" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {persona.description}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {persona.user.userType}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {persona.user.effectivePermissions?.all_permissions.length || 0} permissions
                  </Badge>
                  {persona.user.is_superuser && (
                    <Badge variant="destructive" className="text-xs">
                      Superuser
                    </Badge>
                  )}
                </div>
              </div>
            </DropdownMenuItem>
          ))}
          
          <DropdownMenuSeparator />
          
          <Dialog open={isCustomDialogOpen} onOpenChange={setIsCustomDialogOpen}>
            <DialogTrigger asChild>
              <DropdownMenuItem 
                onSelect={(e) => {
                  e.preventDefault();
                  setIsCustomDialogOpen(true);
                }}
                className="flex items-center gap-2 p-3 cursor-pointer"
              >
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-sm">
                  <Plus className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="font-medium">Create Custom User</div>
                  <div className="text-xs text-muted-foreground">
                    Test with specific permissions
                  </div>
                </div>
              </DropdownMenuItem>
            </DialogTrigger>
            
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Custom Development User</DialogTitle>
                <DialogDescription>
                  Create a custom user persona with specific permissions for testing
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="custom-id">User ID</Label>
                    <Input
                      id="custom-id"
                      placeholder="e.g., manager"
                      value={customUser.id}
                      onChange={(e) => setCustomUser(prev => ({ ...prev, id: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custom-type">User Type</Label>
                    <Select 
                      value={customUser.userType} 
                      onValueChange={(value) => setCustomUser(prev => ({ ...prev, userType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CUSTOM">Custom</SelectItem>
                        <SelectItem value="MANAGER">Manager</SelectItem>
                        <SelectItem value="STAFF">Staff</SelectItem>
                        <SelectItem value="GUEST">Guest</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="custom-name">Display Name</Label>
                  <Input
                    id="custom-name"
                    placeholder="e.g., Property Manager"
                    value={customUser.name}
                    onChange={(e) => setCustomUser(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="custom-description">Description</Label>
                  <Input
                    id="custom-description"
                    placeholder="e.g., Manages properties and tenants"
                    value={customUser.description}
                    onChange={(e) => setCustomUser(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="custom-permissions">Permissions (comma-separated)</Label>
                  <Textarea
                    id="custom-permissions"
                    placeholder="e.g., CUSTOMER_VIEW, RENTAL_CREATE, REPORT_VIEW"
                    value={customUser.permissions}
                    onChange={(e) => setCustomUser(prev => ({ ...prev, permissions: e.target.value }))}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter permissions separated by commas. Common permissions include:
                    CUSTOMER_VIEW, RENTAL_CREATE, INVENTORY_VIEW, etc.
                  </p>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsCustomDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCustomUserCreate}
                    disabled={!customUser.id || !customUser.name}
                  >
                    Create & Switch
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default UserSwitcher;