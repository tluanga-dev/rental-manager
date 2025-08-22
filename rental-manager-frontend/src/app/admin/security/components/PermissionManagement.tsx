'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { securityApi, Permission, PermissionCategory } from '@/services/api/security';
import { toast } from 'react-hot-toast';
import { Search, Key, Shield, AlertTriangle, Info } from 'lucide-react';

export default function PermissionManagement() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [categories, setCategories] = useState<PermissionCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [permsData, categoriesData] = await Promise.all([
        securityApi.getAllPermissions(),
        securityApi.getPermissionCategories(),
      ]);
      setPermissions(permsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Failed to load permissions:', error);
      toast.error('Failed to load permissions data');
    } finally {
      setLoading(false);
    }
  };

  const filteredPermissions = permissions.filter(permission => {
    const matchesSearch = searchTerm === '' || 
      permission.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      permission.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      permission.resource.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = !selectedCategory || permission.resource === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'HIGH':
        return <Shield className="h-4 w-4 text-orange-600" />;
      case 'MEDIUM':
        return <Info className="h-4 w-4 text-yellow-600" />;
      default:
        return <Key className="h-4 w-4 text-green-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Permission Management</CardTitle>
              <CardDescription>
                View and understand all system permissions
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search permissions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Permission Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Permissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{permissions.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Critical Permissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {permissions.filter(p => p.risk_level === 'CRITICAL').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              System Permissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {permissions.filter(p => p.is_system_permission).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Permissions by Category */}
      <Card>
        <CardHeader>
          <CardTitle>Permissions by Category</CardTitle>
          <CardDescription>
            Browse permissions organized by resource category
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={categories[0]?.resource} onValueChange={setSelectedCategory}>
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value={null} onClick={() => setSelectedCategory(null)}>
                All ({permissions.length})
              </TabsTrigger>
              {categories.map((category) => (
                <TabsTrigger key={category.resource} value={category.resource}>
                  <span className="mr-1">{securityApi.getResourceIcon(category.resource)}</span>
                  {category.name} ({category.total_permissions})
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredPermissions.map((permission) => (
                  <div
                    key={permission.id}
                    className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getRiskIcon(permission.risk_level)}
                        <div className="font-medium">{permission.name}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {permission.is_system_permission && (
                          <Badge variant="secondary" className="text-xs">
                            System
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={securityApi.getRiskLevelColor(permission.risk_level)}
                        >
                          {permission.risk_level}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="text-sm text-muted-foreground mb-2">
                      {permission.description}
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Resource:</span>
                        {permission.resource}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Action:</span>
                        {permission.action}
                      </div>
                      {permission.usage_count !== undefined && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Used in:</span>
                          {permission.usage_count} roles
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {filteredPermissions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No permissions found matching your criteria
                </div>
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Permission Risk Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Permission Risk Distribution</CardTitle>
          <CardDescription>
            Overview of permission risk levels across the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((level) => {
              const count = permissions.filter(p => p.risk_level === level).length;
              const percentage = permissions.length > 0 ? (count / permissions.length) * 100 : 0;
              
              return (
                <div key={level} className="flex items-center gap-4">
                  <div className="w-24">
                    <Badge
                      variant="outline"
                      className={`${securityApi.getRiskLevelColor(level)} w-full justify-center`}
                    >
                      {level}
                    </Badge>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            level === 'LOW' ? 'bg-green-500' :
                            level === 'MEDIUM' ? 'bg-yellow-500' :
                            level === 'HIGH' ? 'bg-orange-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground min-w-[80px] text-right">
                        {count} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}