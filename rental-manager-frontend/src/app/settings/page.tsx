'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Settings,
  Building2,
  Package,
  Calendar,
  Bell,
  Shield,
  Plug,
  FileText,
  Server,
  Search,
  Plus,
  Database,
  Activity,
  HardDrive,
  Users,
  TrendingUp,
  Loader2,
} from 'lucide-react';

import { useSystemSettingsStore } from '@/stores/system-store';
import { useSystemInfoStore } from '@/stores/system-store';
import { SETTING_CATEGORIES } from '@/types/system';
import type { SettingCategory } from '@/types/system';
import RentalStatusSettings from '@/components/settings/RentalStatusSettings';

const categoryIcons = {
  GENERAL: Settings,
  BUSINESS: Building2,
  FINANCIAL: Package,
  INVENTORY: Package,
  RENTAL: Calendar,
  NOTIFICATION: Bell,
  SECURITY: Shield,
  INTEGRATION: Plug,
  REPORTING: FileText,
  SYSTEM: Server,
};

function SettingsContent() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  
  const {
    settings,
    currentCategory,
    loading: settingsLoading,
    error: settingsError,
    setCurrentCategory,
    setSearchTerm: setStoreSearchTerm,
    loadSettings,
    getFilteredSettings,
    clearError: clearSettingsError,
  } = useSystemSettingsStore();

  const {
    systemInfo,
    loading: systemLoading,
    error: systemError,
    loadSystemInfo,
    clearError: clearSystemError,
  } = useSystemInfoStore();

  useEffect(() => {
    loadSettings();
    loadSystemInfo();
  }, [loadSettings, loadSystemInfo]);

  useEffect(() => {
    setStoreSearchTerm(searchTerm);
  }, [searchTerm, setStoreSearchTerm]);

  const filteredSettings = getFilteredSettings();

  const handleCategoryChange = (category: string) => {
    setCurrentCategory(category as SettingCategory | 'ALL');
  };

  const getSettingsCountByCategory = (category: SettingCategory) => {
    return (settings || []).filter(s => s?.setting_category === category).length;
  };

  const quickActions = [
    {
      title: 'Company Information',
      description: 'Update company details and contact information',
      icon: Building2,
      action: () => router.push('/settings/company'),
      color: 'bg-slate-50 text-slate-600 border-slate-200',
    },
    {
      title: 'Rental Status Settings',
      description: 'Configure automated rental status checking',
      icon: Calendar,
      action: () => setCurrentCategory('RENTAL'),
      color: 'bg-blue-50 text-blue-600 border-blue-200',
    },
    {
      title: 'System Backups',
      description: 'Manage system backups and data recovery',
      icon: Database,
      action: () => router.push('/settings/backups'),
      color: 'bg-green-50 text-green-600 border-green-200',
    },
    {
      title: 'Audit Logs',
      description: 'View system activity and audit trails',
      icon: Activity,
      action: () => router.push('/settings/audit'),
      color: 'bg-orange-50 text-orange-600 border-orange-200',
    },
  ];

  const systemHealthColor = {
    healthy: 'text-green-600',
    warning: 'text-yellow-600',
    critical: 'text-red-600',
  };

  const systemHealthBg = {
    healthy: 'bg-green-50',
    warning: 'bg-yellow-50',
    critical: 'bg-red-50',
  };

  if (settingsLoading || systemLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-600">
            Manage system configuration, company information, and maintenance
          </p>
        </div>
        <Button onClick={() => router.push('/settings/company')}>
          <Plus className="mr-2 h-4 w-4" />
          Quick Setup
        </Button>
      </div>

      {/* System Health Overview */}
      {systemInfo && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className={`p-4 rounded-lg ${systemHealthBg[systemInfo.system_health.status]}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Status</p>
                    <p className={`text-2xl font-bold ${systemHealthColor[systemInfo.system_health.status]}`}>
                      {systemInfo.system_health.status}
                    </p>
                  </div>
                  <Server className={`h-8 w-8 ${systemHealthColor[systemInfo.system_health.status]}`} />
                </div>
              </div>
              
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Uptime</p>
                    <p className="text-2xl font-bold text-slate-600">{systemInfo.system_health.uptime}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-slate-600" />
                </div>
              </div>
              
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Response Time</p>
                    <p className="text-2xl font-bold text-slate-600">{systemInfo.system_health.response_time}</p>
                  </div>
                  <Activity className="h-8 w-8 text-slate-600" />
                </div>
              </div>
              
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Memory Usage</p>
                    <p className="text-2xl font-bold text-slate-600">{systemInfo.system_health.memory_usage}</p>
                  </div>
                  <HardDrive className="h-8 w-8 text-slate-600" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Card 
              key={action.title}
              className={`cursor-pointer hover:shadow-lg transition-all border-2 ${action.color}`}
              onClick={action.action}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Icon className="h-4 w-4" />
                  {action.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs opacity-80">{action.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Settings Management */}
      <Card>
        <CardHeader>
          <CardTitle>Settings Management</CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search settings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={currentCategory} onValueChange={handleCategoryChange}>
            <TabsList className="grid w-full grid-cols-5 lg:grid-cols-10">
              <TabsTrigger value="ALL" className="text-xs">
                All
                <Badge variant="secondary" className="ml-1 h-4 w-4 text-xs">
                  {settings.length}
                </Badge>
              </TabsTrigger>
              {SETTING_CATEGORIES.map((category) => {
                const Icon = categoryIcons[category.value];
                const count = getSettingsCountByCategory(category.value);
                return (
                  <TabsTrigger key={category.value} value={category.value} className="text-xs">
                    <Icon className="h-3 w-3 mr-1" />
                    {category.label}
                    <Badge variant="secondary" className="ml-1 h-4 w-4 text-xs">
                      {count}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value={currentCategory} className="mt-6">
              <div className="space-y-6">
                {/* Special handling for RENTAL category to show RentalStatusSettings */}
                {currentCategory === 'RENTAL' && (
                  <RentalStatusSettings />
                )}
                
                {/* Regular settings display */}
                <div className="space-y-4">
                  {filteredSettings.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      {searchTerm ? 'No settings found matching your search.' : 'No settings available in this category.'}
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {filteredSettings.map((setting) => (
                        <Card key={setting.id} className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-medium text-gray-900">{setting.setting_name}</h3>
                                {setting.is_system && (
                                  <Badge variant="outline" className="text-xs">System</Badge>
                                )}
                                {setting.is_sensitive && (
                                  <Badge variant="destructive" className="text-xs">Sensitive</Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{setting.description}</p>
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span>Key: {setting.setting_key}</span>
                                <span>Type: {setting.setting_type}</span>
                                <span>Category: {setting.setting_category}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => router.push(`/settings/${setting.setting_category.toLowerCase()}?key=${setting.setting_key}`)}
                              >
                                Edit
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* System Information */}
      {systemInfo && (
        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">System Version</p>
                <p className="text-lg font-semibold">{systemInfo.system_version}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">Settings Count</p>
                <p className="text-lg font-semibold">{systemInfo.settings_count}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">Backups</p>
                <p className="text-lg font-semibold">{systemInfo.backups_count}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">Timezone</p>
                <p className="text-lg font-semibold">{systemInfo.timezone}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedRoute requiredPermissions={['SYSTEM_CONFIG']}>
      <SettingsContent />
    </ProtectedRoute>
  );
}