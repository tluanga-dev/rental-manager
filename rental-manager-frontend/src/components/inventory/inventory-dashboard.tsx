'use client';

import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Package, 
  MapPin, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Wrench, 
  Eye,
  RefreshCw,
  BarChart3,
  PieChart,
  Activity,
  AlertCircle
} from 'lucide-react';
import { inventoryDashboardApi, inventoryUnitsApi } from '@/services/api/inventory';
import { useInventoryStore } from '@/stores/inventory-store';
import type { 
  InventoryStatus, 
  ConditionGrade,
  InventoryAlert 
} from '@/types/inventory';

const statusIcons = {
  AVAILABLE: CheckCircle,
  RESERVED: Clock,
  RENTED: Package,
  IN_TRANSIT: RefreshCw,
  MAINTENANCE: Wrench,
  INSPECTION: Eye,
  DAMAGED: AlertTriangle,
  LOST: AlertTriangle,
  SOLD: Package,
};

const statusColors = {
  AVAILABLE: 'text-green-500',
  RESERVED: 'text-slate-500',
  RENTED: 'text-purple-500',
  IN_TRANSIT: 'text-orange-500',
  MAINTENANCE: 'text-yellow-500',
  INSPECTION: 'text-cyan-500',
  DAMAGED: 'text-red-500',
  LOST: 'text-red-600',
  SOLD: 'text-gray-500',
};

const conditionColors = {
  A: 'bg-green-100 text-green-800',
  B: 'bg-slate-100 text-slate-800',
  C: 'bg-yellow-100 text-yellow-800',
  D: 'bg-red-100 text-red-800',
};

const alertSeverityColors = {
  LOW: 'bg-gray-100 text-gray-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
};

interface InventoryDashboardProps {
  onViewLocation?: (locationId: string) => void;
  onViewAlert?: (alert: InventoryAlert) => void;
  onAcknowledgeAlert?: (alertId: string) => void;
}

export function InventoryDashboard({
  onViewLocation,
  onViewAlert,
  onAcknowledgeAlert,
}: InventoryDashboardProps = {}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'movements'>('overview');
  
  const {
    selectedLocation,
    setDashboardSummary,
    setStatusCounts,
    setConditionCounts,
    setLoadingState,
  } = useInventoryStore();

  // Fetch dashboard summary
  const { data: summary, isLoading, refetch } = useQuery({
    queryKey: ['inventory-dashboard', selectedLocation],
    queryFn: () => inventoryDashboardApi.getSummary(selectedLocation || undefined),
  });

  // Fetch status counts
  const { data: statusCounts } = useQuery({
    queryKey: ['inventory-status-counts', selectedLocation],
    queryFn: () => inventoryUnitsApi.getStatusCount(selectedLocation || undefined),
  });

  // Fetch condition counts
  const { data: conditionCounts } = useQuery({
    queryKey: ['inventory-condition-counts', selectedLocation],
    queryFn: () => inventoryUnitsApi.getConditionCount(selectedLocation || undefined),
  });

  // Update store with fetched data
  useEffect(() => {
    if (summary) {
      setDashboardSummary(summary);
    }
  }, [summary, setDashboardSummary]);

  useEffect(() => {
    if (statusCounts) {
      setStatusCounts(statusCounts);
    }
  }, [statusCounts, setStatusCounts]);

  useEffect(() => {
    if (conditionCounts) {
      setConditionCounts(conditionCounts);
    }
  }, [conditionCounts, setConditionCounts]);

  useEffect(() => {
    setLoadingState('dashboard', isLoading);
  }, [isLoading, setLoadingState]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN');
  };

  const getStatusIcon = (status: InventoryStatus) => {
    const Icon = statusIcons[status];
    return <Icon className={`h-4 w-4 ${statusColors[status]}`} />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!summary) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No Data</AlertTitle>
        <AlertDescription>
          Unable to load inventory dashboard data. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  const unacknowledgedAlerts = summary.alerts.filter(alert => !alert.is_acknowledged);
  const criticalAlerts = unacknowledgedAlerts.filter(alert => alert.severity === 'CRITICAL');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Inventory Dashboard</h2>
          <p className="text-muted-foreground">
            Real-time inventory status and analytics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {criticalAlerts.length > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {criticalAlerts.length} Critical Alert{criticalAlerts.length !== 1 ? 's' : ''}
            </Badge>
          )}
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="h-8 w-8 text-slate-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Units</p>
                <p className="text-2xl font-bold">{summary.total_units.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.total_value)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Utilization Rate</p>
                <p className="text-2xl font-bold">{summary.utilization_rate.toFixed(1)}%</p>
              </div>
            </div>
            <Progress value={summary.utilization_rate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Active Alerts</p>
                <p className="text-2xl font-bold">{unacknowledgedAlerts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Location Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MapPin className="h-5 w-5" />
            <span>Locations Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {summary.locations.map((location) => (
              <Card key={location.location_id} className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => onViewLocation?.(location.location_id)}>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{location.location_name}</h4>
                      <Badge variant="outline">{location.total_units} units</Badge>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Available:</span>
                        <span className="font-medium">{location.available_units}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Utilization:</span>
                        <span className="font-medium">{location.utilization_rate.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Value:</span>
                        <span className="font-medium">{formatCurrency(location.total_value)}</span>
                      </div>
                    </div>
                    
                    <Progress value={location.utilization_rate} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs for detailed views */}
      <div className="space-y-4">
        <div className="flex space-x-1 border-b">
          {[
            { id: 'overview', label: 'Status Overview', icon: PieChart },
            { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
            { id: 'movements', label: 'Recent Movements', icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? 'default' : 'ghost'}
                onClick={() => setActiveTab(tab.id as any)}
                className="flex items-center space-x-2"
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.id === 'alerts' && unacknowledgedAlerts.length > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {unacknowledgedAlerts.length}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Inventory Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summary.status_breakdown.map((status) => (
                    <div key={status.status} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(status.status)}
                        <span className="capitalize">{status.status.toLowerCase().replace('_', ' ')}</span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="font-medium">{status.count}</span>
                        <span className="text-sm text-muted-foreground">
                          {status.percentage.toFixed(1)}%
                        </span>
                        <span className="text-sm font-medium">
                          {formatCurrency(status.value)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Condition Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Condition Grades</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summary.condition_breakdown.map((condition) => (
                    <div key={condition.grade} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge className={conditionColors[condition.grade]}>
                          Grade {condition.grade}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="font-medium">{condition.count}</span>
                        <span className="text-sm text-muted-foreground">
                          {condition.percentage.toFixed(1)}%
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {condition.avg_age_days}d avg
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'alerts' && (
          <Card>
            <CardHeader>
              <CardTitle>Active Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              {unacknowledgedAlerts.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active alerts</p>
                  <p className="text-sm">All systems running smoothly</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alert</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unacknowledgedAlerts.map((alert) => (
                      <TableRow key={alert.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{alert.title}</div>
                            <div className="text-sm text-muted-foreground">
                              {alert.message}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={alertSeverityColors[alert.severity]}>
                            {alert.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{formatDate(alert.created_at)}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onViewAlert?.(alert)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onAcknowledgeAlert?.(alert.id)}
                            >
                              Acknowledge
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'movements' && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Inventory Movements</CardTitle>
            </CardHeader>
            <CardContent>
              {summary.recent_movements.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No recent movements</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Status Change</TableHead>
                      <TableHead>Moved By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.recent_movements.map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {movement.movement_type.toLowerCase().replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(movement.from_status)}
                            <span className="text-sm">→</span>
                            {getStatusIcon(movement.to_status)}
                          </div>
                        </TableCell>
                        <TableCell>{movement.moved_by}</TableCell>
                        <TableCell>
                          <div className="text-sm">{formatDate(movement.moved_at)}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {movement.notes || 'No notes'}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}