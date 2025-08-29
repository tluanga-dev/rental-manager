'use client';

import React from 'react';
import { InventoryAlert } from '@/services/api/inventory-alerts';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  TrendingDown, 
  Package, 
  Wrench, 
  Shield, 
  Clock,
  CheckCircle
} from 'lucide-react';

interface AlertsSummaryProps {
  alerts: InventoryAlert[];
}

interface SummaryCardProps {
  title: string;
  count: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  description?: string;
}

function SummaryCard({ title, count, icon, color, bgColor, borderColor, description }: SummaryCardProps) {
  return (
    <div className={`${bgColor} ${borderColor} rounded-lg border p-6`}>
      <div className="flex items-center gap-4">
        <div className={`p-3 ${bgColor === 'bg-white' ? 'bg-gray-100' : 'bg-white bg-opacity-80'} rounded-lg`}>
          <div className={color}>
            {icon}
          </div>
        </div>
        <div className="flex-1">
          <p className={`text-sm font-medium ${color.replace('text-', 'text-').replace('-500', '-600')}`}>
            {title}
          </p>
          <p className={`text-2xl font-bold ${color.replace('text-', 'text-').replace('-500', '-700')}`}>
            {count}
          </p>
          {description && (
            <p className={`text-xs ${color.replace('text-', 'text-').replace('-500', '-600')} mt-1`}>
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function AlertsSummary({ alerts }: AlertsSummaryProps) {
  // Calculate summary statistics
  const stats = React.useMemo(() => {
    const totalAlerts = alerts.length;
    
    // By severity
    const highSeverity = alerts.filter(a => a.severity === 'high').length;
    const mediumSeverity = alerts.filter(a => a.severity === 'medium').length;
    const lowSeverity = alerts.filter(a => a.severity === 'low').length;
    
    // By type
    const lowStock = alerts.filter(a => a.alert_type === 'LOW_STOCK').length;
    const outOfStock = alerts.filter(a => a.alert_type === 'OUT_OF_STOCK').length;
    const maintenanceDue = alerts.filter(a => a.alert_type === 'MAINTENANCE_DUE').length;
    const warrantyExpiring = alerts.filter(a => a.alert_type === 'WARRANTY_EXPIRING').length;
    const damageReported = alerts.filter(a => a.alert_type === 'DAMAGE_REPORTED').length;
    const inspectionDue = alerts.filter(a => a.alert_type === 'INSPECTION_DUE').length;
    
    // Recent alerts (within last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAlerts = alerts.filter(a => new Date(a.created_at) > oneDayAgo).length;
    
    return {
      totalAlerts,
      highSeverity,
      mediumSeverity,
      lowSeverity,
      lowStock,
      outOfStock,
      maintenanceDue,
      warrantyExpiring,
      damageReported,
      inspectionDue,
      recentAlerts,
      stockAlerts: lowStock + outOfStock,
      maintenanceAlerts: maintenanceDue + inspectionDue,
    };
  }, [alerts]);

  if (stats.totalAlerts === 0) {
    return (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200 p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 bg-green-100 rounded-full">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-green-800">All Clear!</h3>
            <p className="text-green-700 mt-2">
              No inventory alerts require attention at this time. Your inventory is in good shape.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* High Level Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Alerts"
          count={stats.totalAlerts}
          icon={<AlertCircle className="h-6 w-6" />}
          color="text-gray-600"
          bgColor="bg-white"
          borderColor="border-gray-200"
          description="Active issues"
        />
        
        <SummaryCard
          title="High Priority"
          count={stats.highSeverity}
          icon={<AlertTriangle className="h-6 w-6" />}
          color="text-red-500"
          bgColor="bg-red-50"
          borderColor="border-red-200"
          description="Urgent attention needed"
        />
        
        <SummaryCard
          title="Stock Issues"
          count={stats.stockAlerts}
          icon={<Package className="h-6 w-6" />}
          color="text-yellow-500"
          bgColor="bg-yellow-50"
          borderColor="border-yellow-200"
          description="Low/out of stock"
        />
        
        <SummaryCard
          title="Recent Alerts"
          count={stats.recentAlerts}
          icon={<Clock className="h-6 w-6" />}
          color="text-blue-500"
          bgColor="bg-blue-50"
          borderColor="border-blue-200"
          description="Last 24 hours"
        />
      </div>

      {/* Detailed Breakdown */}
      <div className="bg-white rounded-lg border p-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Alert Breakdown</h4>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* By Severity */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">By Severity</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  High
                </span>
                <span className="font-medium">{stats.highSeverity}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  Medium
                </span>
                <span className="font-medium">{stats.mediumSeverity}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Low
                </span>
                <span className="font-medium">{stats.lowSeverity}</span>
              </div>
            </div>
          </div>

          {/* Stock Alerts */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Stock Alerts</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-yellow-500" />
                  Low Stock
                </span>
                <span className="font-medium">{stats.lowStock}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1">
                  <Package className="h-3 w-3 text-red-500" />
                  Out of Stock
                </span>
                <span className="font-medium">{stats.outOfStock}</span>
              </div>
            </div>
          </div>

          {/* Maintenance Alerts */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Maintenance</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1">
                  <Wrench className="h-3 w-3 text-blue-500" />
                  Due
                </span>
                <span className="font-medium">{stats.maintenanceDue}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1">
                  <Info className="h-3 w-3 text-cyan-500" />
                  Inspection
                </span>
                <span className="font-medium">{stats.inspectionDue}</span>
              </div>
            </div>
          </div>

          {/* Other Alerts */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Other Issues</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1">
                  <Shield className="h-3 w-3 text-purple-500" />
                  Warranty
                </span>
                <span className="font-medium">{stats.warrantyExpiring}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-orange-500" />
                  Damage
                </span>
                <span className="font-medium">{stats.damageReported}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-2 col-span-2">
            <p className="text-sm font-medium text-gray-700">Quick Actions</p>
            <div className="space-y-2">
              <button className="w-full text-left px-3 py-2 text-xs bg-red-50 hover:bg-red-100 rounded-md border border-red-200 text-red-700">
                View High Priority ({stats.highSeverity})
              </button>
              <button className="w-full text-left px-3 py-2 text-xs bg-yellow-50 hover:bg-yellow-100 rounded-md border border-yellow-200 text-yellow-700">
                Check Stock Alerts ({stats.stockAlerts})
              </button>
              <button className="w-full text-left px-3 py-2 text-xs bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 text-blue-700">
                Schedule Maintenance ({stats.maintenanceAlerts})
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}