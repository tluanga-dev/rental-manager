'use client';

// Damage Management Dashboard - Overview of all damaged items and repair status
import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Tool,
  XCircle,
  CheckCircle,
  Clock,
  IndianRupee,
  Package,
  TrendingUp,
  TrendingDown,
  RefreshCw
} from 'lucide-react';
import { useDamageManagement } from '../../hooks/useDamageManagement';
import { DamageSummary, RepairOrder, DamageAssessment } from '../../types/rental-return-enhanced';

export default function DamageDashboard() {
  const {
    summary,
    repairQueue,
    recentAssessments,
    loading,
    error,
    refreshData
  } = useDamageManagement();

  const [activeTab, setActiveTab] = useState<'overview' | 'assessments' | 'repairs' | 'writeoffs'>('overview');

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, [refreshData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">Error loading damage data: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Damage Management Dashboard</h1>
        <button
          onClick={refreshData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Damaged */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Damaged Items</p>
              <p className="text-2xl font-bold text-gray-900">
                {summary?.total_damaged || 0}
              </p>
            </div>
            <AlertTriangle className="w-10 h-10 text-orange-500" />
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="w-4 h-4 text-red-500 mr-1" />
            <span className="text-red-600">+12% from last month</span>
          </div>
        </div>

        {/* Under Repair */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Under Repair</p>
              <p className="text-2xl font-bold text-gray-900">
                {repairQueue?.filter(r => r.repair_status === 'IN_PROGRESS').length || 0}
              </p>
            </div>
            <Tool className="w-10 h-10 text-blue-500" />
          </div>
          <div className="mt-4 flex items-center text-sm">
            <Clock className="w-4 h-4 text-gray-500 mr-1" />
            <span className="text-gray-600">Avg. 5 days turnaround</span>
          </div>
        </div>

        {/* Beyond Repair */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Beyond Repair</p>
              <p className="text-2xl font-bold text-gray-900">
                {summary?.by_severity?.BEYOND_REPAIR || 0}
              </p>
            </div>
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-gray-600">Awaiting write-off approval</span>
          </div>
        </div>

        {/* Total Repair Cost */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Est. Repair Cost</p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{summary?.total_repair_cost?.toFixed(2) || '0.00'}
              </p>
            </div>
            <IndianRupee className="w-10 h-10 text-green-500" />
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingDown className="w-4 h-4 text-green-500 mr-1" />
            <span className="text-green-600">-8% from last month</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'assessments', label: 'Assessments' },
            { id: 'repairs', label: 'Repair Queue' },
            { id: 'writeoffs', label: 'Write-offs' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow">
        {activeTab === 'overview' && (
          <div className="p-6">
            <h2 className="text-lg font-medium mb-4">Damage by Severity</h2>
            <div className="space-y-4">
              {Object.entries(summary?.by_severity || {}).map(([severity, count]) => (
                <div key={severity} className="flex items-center">
                  <span className="w-32 text-sm font-medium text-gray-600">
                    {severity.replace('_', ' ')}
                  </span>
                  <div className="flex-1 ml-4">
                    <div className="bg-gray-200 rounded-full h-6">
                      <div
                        className={`h-6 rounded-full flex items-center justify-end pr-2 text-xs text-white
                          ${severity === 'MINOR' ? 'bg-yellow-500' :
                            severity === 'MODERATE' ? 'bg-orange-500' :
                            severity === 'SEVERE' ? 'bg-red-500' :
                            'bg-gray-800'}
                        `}
                        style={{ width: `${(count as number / (summary?.total_damaged || 1)) * 100}%` }}
                      >
                        {count}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <h2 className="text-lg font-medium mt-8 mb-4">Top Damaged Items</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Est. Cost</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {summary?.items?.slice(0, 5).map((item, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.item_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                          ${item.severity === 'MINOR' ? 'bg-yellow-100 text-yellow-800' :
                            item.severity === 'MODERATE' ? 'bg-orange-100 text-orange-800' :
                            item.severity === 'SEVERE' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'}
                        `}>
                          {item.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${item.repair_cost.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'assessments' && (
          <div className="p-6">
            <h2 className="text-lg font-medium mb-4">Recent Damage Assessments</h2>
            <div className="space-y-4">
              {recentAssessments?.map((assessment) => (
                <div key={assessment.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">{assessment.item_name}</h3>
                      <p className="text-sm text-gray-500">
                        {assessment.damage_type} - {assessment.damage_description}
                      </p>
                      <div className="mt-2 flex items-center space-x-4 text-sm">
                        <span className="text-gray-500">
                          Qty: {assessment.quantity}
                        </span>
                        <span className="text-gray-500">
                          Est. Cost: ${assessment.estimated_repair_cost?.toFixed(2) || 'N/A'}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs
                          ${assessment.repair_feasible ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                        `}>
                          {assessment.repair_feasible ? 'Repairable' : 'Not Repairable'}
                        </span>
                      </div>
                    </div>
                    <button className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'repairs' && (
          <div className="p-6">
            <h2 className="text-lg font-medium mb-4">Repair Queue</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Damage</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Started</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Est. Cost</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {repairQueue?.map((repair) => (
                    <tr key={repair.repair_order_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {repair.item_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {repair.damage_type} ({repair.damage_severity})
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                          ${repair.repair_status === 'PENDING' ? 'bg-gray-100 text-gray-800' :
                            repair.repair_status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                            repair.repair_status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'}
                        `}>
                          {repair.repair_status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {repair.start_date || 'Not started'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${repair.estimated_cost?.toFixed(2) || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {repair.repair_status === 'COMPLETED' && !repair.quality_check_status && (
                          <button className="text-blue-600 hover:text-blue-900">
                            Quality Check
                          </button>
                        )}
                        {repair.repair_status === 'PENDING' && (
                          <button className="text-green-600 hover:text-green-900">
                            Start Repair
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'writeoffs' && (
          <div className="p-6">
            <h2 className="text-lg font-medium mb-4">Items Pending Write-off</h2>
            <p className="text-gray-500 mb-4">
              Items marked as beyond repair that need to be written off from inventory.
            </p>
            <div className="space-y-4">
              {summary?.items?.filter(item => item.severity === 'BEYOND_REPAIR').map((item, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium text-gray-900">{item.item_name}</h3>
                      <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                    </div>
                    <button className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                      Write Off
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}