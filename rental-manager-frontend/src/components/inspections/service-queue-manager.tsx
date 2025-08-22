'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Wrench, 
  Clock, 
  User, 
  AlertTriangle,
  CheckCircle,
  Pause,
  Play,
  Calendar,
  Package,
  Filter,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Settings,
  Eye,
  Plus,
  Search
} from 'lucide-react';
import { 
  ServiceQueueItem, 
  ServiceType, 
  ServicePriority, 
  ServiceStatus,
  InspectionDefect
} from '@/types/inspections';

interface ServiceQueueManagerProps {
  onClose?: () => void;
}

const serviceTypeDetails = {
  CLEANING: {
    label: 'Cleaning',
    icon: Package,
    color: 'bg-slate-100 text-slate-800',
    avgDuration: 2,
    avgCost: 200,
  },
  MINOR_REPAIR: {
    label: 'Minor Repair',
    icon: Wrench,
    color: 'bg-green-100 text-green-800',
    avgDuration: 4,
    avgCost: 500,
  },
  MAJOR_REPAIR: {
    label: 'Major Repair',
    icon: Settings,
    color: 'bg-orange-100 text-orange-800',
    avgDuration: 24,
    avgCost: 2000,
  },
  PART_REPLACEMENT: {
    label: 'Part Replacement',
    icon: Package,
    color: 'bg-purple-100 text-purple-800',
    avgDuration: 8,
    avgCost: 1500,
  },
  CALIBRATION: {
    label: 'Calibration',
    icon: Settings,
    color: 'bg-cyan-100 text-cyan-800',
    avgDuration: 3,
    avgCost: 300,
  },
  SOFTWARE_UPDATE: {
    label: 'Software Update',
    icon: Settings,
    color: 'bg-indigo-100 text-indigo-800',
    avgDuration: 1,
    avgCost: 100,
  },
  REFURBISHMENT: {
    label: 'Refurbishment',
    icon: RotateCcw,
    color: 'bg-yellow-100 text-yellow-800',
    avgDuration: 48,
    avgCost: 3000,
  },
  WRITE_OFF: {
    label: 'Write Off',
    icon: AlertTriangle,
    color: 'bg-red-100 text-red-800',
    avgDuration: 0,
    avgCost: 0,
  },
};

const priorityColors = {
  LOW: 'bg-gray-100 text-gray-800',
  MEDIUM: 'bg-slate-100 text-slate-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800',
};

const statusColors = {
  QUEUED: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-slate-100 text-slate-800',
  COMPLETED: 'bg-green-100 text-green-800',
  QUALITY_CHECK: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  ON_HOLD: 'bg-orange-100 text-orange-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
};

export function ServiceQueueManager({ onClose }: ServiceQueueManagerProps) {
  const [queueItems, setQueueItems] = useState<ServiceQueueItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ServiceQueueItem | null>(null);
  const [filterStatus, setFilterStatus] = useState<ServiceStatus | 'ALL'>('ALL');
  const [filterPriority, setFilterPriority] = useState<ServicePriority | 'ALL'>('ALL');
  const [filterServiceType, setFilterServiceType] = useState<ServiceType | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentView, setCurrentView] = useState<'queue' | 'details' | 'analytics'>('queue');

  // Mock data
  useEffect(() => {
    const mockItems: ServiceQueueItem[] = [
      {
        id: '1',
        sku_id: 'SKU001',
        sku_code: 'CAM-001',
        item_name: 'Professional Camera',
        serial_number: 'SN123456',
        service_type: 'CLEANING',
        priority: 'MEDIUM',
        estimated_duration: 2,
        estimated_cost: 200,
        assigned_to: 'John Doe',
        status: 'IN_PROGRESS',
        defects: [],
        notes: 'Minor dust cleaning required',
        scheduled_date: '2024-01-15',
        started_at: '2024-01-15T09:00:00Z',
      },
      {
        id: '2',
        sku_id: 'SKU002',
        sku_code: 'LENS-001',
        item_name: '85mm Prime Lens',
        serial_number: 'SN789012',
        service_type: 'MAJOR_REPAIR',
        priority: 'HIGH',
        estimated_duration: 24,
        estimated_cost: 2500,
        status: 'QUEUED',
        defects: [
          {
            id: 'd1',
            type: 'FUNCTIONAL_DAMAGE',
            severity: 'MAJOR',
            location_on_item: 'Focus ring',
            description: 'Focus ring stuck, requires disassembly',
            customer_fault: true,
            repair_required: true,
            estimated_repair_cost: 2500,
            estimated_repair_time: 24,
            photos: [],
            created_at: '2024-01-14T10:00:00Z',
          }
        ],
        notes: 'Customer fault - will be charged for repair',
        scheduled_date: '2024-01-16',
      },
      {
        id: '3',
        sku_id: 'SKU003',
        sku_code: 'LIGHT-001',
        item_name: 'LED Panel Light',
        service_type: 'MINOR_REPAIR',
        priority: 'LOW',
        estimated_duration: 4,
        estimated_cost: 500,
        status: 'COMPLETED',
        defects: [],
        notes: 'Power switch replacement completed',
        scheduled_date: '2024-01-14',
        started_at: '2024-01-14T14:00:00Z',
        completed_at: '2024-01-14T18:00:00Z',
        quality_check_passed: true,
      },
    ];
    setQueueItems(mockItems);
  }, []);

  const getFilteredItems = () => {
    return queueItems.filter(item => {
      const matchesStatus = filterStatus === 'ALL' || item.status === filterStatus;
      const matchesPriority = filterPriority === 'ALL' || item.priority === filterPriority;
      const matchesServiceType = filterServiceType === 'ALL' || item.service_type === filterServiceType;
      const matchesSearch = !searchTerm || 
        item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.serial_number && item.serial_number.toLowerCase().includes(searchTerm.toLowerCase()));
      
      return matchesStatus && matchesPriority && matchesServiceType && matchesSearch;
    });
  };

  const updateItemStatus = (itemId: string, status: ServiceStatus, notes?: string) => {
    setQueueItems(prev => 
      prev.map(item => {
        if (item.id === itemId) {
          const updates: Partial<ServiceQueueItem> = { status };
          
          if (status === 'IN_PROGRESS' && !item.started_at) {
            updates.started_at = new Date().toISOString();
          }
          
          if (status === 'COMPLETED' && !item.completed_at) {
            updates.completed_at = new Date().toISOString();
          }
          
          if (notes) {
            updates.notes = notes;
          }
          
          return { ...item, ...updates };
        }
        return item;
      })
    );
  };

  const assignTechnician = (itemId: string, technicianId: string) => {
    setQueueItems(prev => 
      prev.map(item => 
        item.id === itemId ? { ...item, assigned_to: technicianId } : item
      )
    );
  };

  const getQueueStats = () => {
    const totalItems = queueItems.length;
    const inProgress = queueItems.filter(item => item.status === 'IN_PROGRESS').length;
    const queued = queueItems.filter(item => item.status === 'QUEUED').length;
    const completed = queueItems.filter(item => item.status === 'COMPLETED').length;
    const urgent = queueItems.filter(item => item.priority === 'URGENT').length;
    
    const totalCost = queueItems.reduce((sum, item) => sum + item.estimated_cost, 0);
    const totalHours = queueItems.reduce((sum, item) => sum + item.estimated_duration, 0);
    
    return { totalItems, inProgress, queued, completed, urgent, totalCost, totalHours };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const stats = getQueueStats();
  const filteredItems = getFilteredItems();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Service Queue Manager</h2>
              <p className="text-muted-foreground">
                Manage repair and maintenance workflows
              </p>
            </div>
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      <Tabs value={currentView} onValueChange={(value) => setCurrentView(value as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="queue">Service Queue ({stats.totalItems})</TabsTrigger>
          <TabsTrigger value="details">Item Details</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-6 mt-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-slate-600">{stats.inProgress}</div>
                <div className="text-sm text-muted-foreground">In Progress</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.queued}</div>
                <div className="text-sm text-muted-foreground">Queued</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-red-600">{stats.urgent}</div>
                <div className="text-sm text-muted-foreground">Urgent</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search items..."
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Status</SelectItem>
                      {Object.keys(statusColors).map((status) => (
                        <SelectItem key={status} value={status}>
                          {status.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={filterPriority} onValueChange={(value) => setFilterPriority(value as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Priority</SelectItem>
                      {Object.keys(priorityColors).map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {priority}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Service Type</Label>
                  <Select value={filterServiceType} onValueChange={(value) => setFilterServiceType(value as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Types</SelectItem>
                      {Object.entries(serviceTypeDetails).map(([type, details]) => (
                        <SelectItem key={type} value={type}>
                          {details.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button variant="outline" className="w-full">
                    <Filter className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Queue Items */}
          <div className="space-y-4">
            {filteredItems.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <h4 className="font-medium mb-2">No Items Found</h4>
                  <p className="text-muted-foreground">
                    No service queue items match your current filters.
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredItems.map((item) => {
                const serviceType = serviceTypeDetails[item.service_type];
                const ServiceIcon = serviceType.icon;
                
                return (
                  <Card key={item.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <ServiceIcon className="h-5 w-5 text-gray-600" />
                            <h4 className="font-medium">{item.item_name}</h4>
                            <Badge variant="outline">{item.sku_code}</Badge>
                            {item.serial_number && (
                              <Badge variant="secondary" className="text-xs">
                                SN: {item.serial_number}
                              </Badge>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <Badge className={serviceType.color}>
                              {serviceType.label}
                            </Badge>
                            <Badge className={statusColors[item.status]}>
                              {item.status.replace('_', ' ')}
                            </Badge>
                            <Badge className={priorityColors[item.priority]}>
                              {item.priority}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground">Duration</div>
                              <div className="font-medium">{item.estimated_duration}h</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Cost</div>
                              <div className="font-medium">{formatCurrency(item.estimated_cost)}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Assigned To</div>
                              <div className="font-medium">{item.assigned_to || 'Unassigned'}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Scheduled</div>
                              <div className="font-medium">
                                {item.scheduled_date ? formatDate(item.scheduled_date) : 'Not scheduled'}
                              </div>
                            </div>
                          </div>

                          {item.notes && (
                            <div className="mt-3 p-2 bg-gray-50 rounded text-sm">
                              <strong>Notes:</strong> {item.notes}
                            </div>
                          )}

                          {item.defects.length > 0 && (
                            <div className="mt-3">
                              <div className="text-sm font-medium text-red-600">
                                {item.defects.length} defect(s) to address
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col space-y-2 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedItem(item)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Details
                          </Button>

                          {item.status === 'QUEUED' && (
                            <Button
                              size="sm"
                              onClick={() => updateItemStatus(item.id, 'IN_PROGRESS')}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Start
                            </Button>
                          )}

                          {item.status === 'IN_PROGRESS' && (
                            <Button
                              size="sm"
                              onClick={() => updateItemStatus(item.id, 'COMPLETED')}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Complete
                            </Button>
                          )}

                          {(item.status === 'QUEUED' || item.status === 'IN_PROGRESS') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateItemStatus(item.id, 'ON_HOLD')}
                            >
                              <Pause className="h-4 w-4 mr-2" />
                              Hold
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="details" className="space-y-6 mt-6">
          {selectedItem ? (
            <Card>
              <CardHeader>
                <CardTitle>{selectedItem.item_name} - Service Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">Item Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>SKU Code:</span>
                        <span className="font-medium">{selectedItem.sku_code}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Serial Number:</span>
                        <span className="font-medium">{selectedItem.serial_number || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Service Type:</span>
                        <Badge className={serviceTypeDetails[selectedItem.service_type].color}>
                          {serviceTypeDetails[selectedItem.service_type].label}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Priority:</span>
                        <Badge className={priorityColors[selectedItem.priority]}>
                          {selectedItem.priority}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Service Progress</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <Badge className={statusColors[selectedItem.status]}>
                          {selectedItem.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Assigned To:</span>
                        <span className="font-medium">{selectedItem.assigned_to || 'Unassigned'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Scheduled Date:</span>
                        <span className="font-medium">
                          {selectedItem.scheduled_date ? formatDate(selectedItem.scheduled_date) : 'Not scheduled'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Started:</span>
                        <span className="font-medium">
                          {selectedItem.started_at ? formatDate(selectedItem.started_at) : 'Not started'}
                        </span>
                      </div>
                      {selectedItem.completed_at && (
                        <div className="flex justify-between">
                          <span>Completed:</span>
                          <span className="font-medium">{formatDate(selectedItem.completed_at)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {selectedItem.defects.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-medium">Associated Defects</h4>
                    <div className="space-y-3">
                      {selectedItem.defects.map((defect) => (
                        <Card key={defect.id} className="border">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-2">
                              <Badge variant="outline">{defect.type.replace('_', ' ')}</Badge>
                              <Badge 
                                className={
                                  defect.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                                  defect.severity === 'MAJOR' ? 'bg-orange-100 text-orange-800' :
                                  defect.severity === 'MODERATE' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-slate-100 text-slate-800'
                                }
                              >
                                {defect.severity}
                              </Badge>
                            </div>
                            <p className="text-sm mb-2">{defect.description}</p>
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Location: {defect.location_on_item}</span>
                              <span>Cost: {formatCurrency(defect.estimated_repair_cost)}</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <h4 className="font-medium">Service Notes</h4>
                  <Textarea
                    value={selectedItem.notes || ''}
                    onChange={(e) => setSelectedItem(prev => 
                      prev ? { ...prev, notes: e.target.value } : null
                    )}
                    placeholder="Add service notes..."
                    rows={4}
                  />
                </div>

                <div className="flex space-x-4">
                  <Button>Update Service</Button>
                  <Button variant="outline" onClick={() => setSelectedItem(null)}>
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Eye className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h4 className="font-medium mb-2">No Item Selected</h4>
                <p className="text-muted-foreground">
                  Select an item from the queue to view detailed information.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Service Type Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(serviceTypeDetails).map(([type, details]) => {
                    const count = queueItems.filter(item => item.service_type === type).length;
                    const percentage = stats.totalItems > 0 ? (count / stats.totalItems) * 100 : 0;
                    
                    return (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <details.icon className="h-4 w-4" />
                          <span className="text-sm">{details.label}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="text-sm font-medium">{count}</div>
                          <div className="text-xs text-muted-foreground">({percentage.toFixed(0)}%)</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Queue Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Total Items in Queue:</span>
                    <span className="font-medium">{stats.totalItems}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Estimated Cost:</span>
                    <span className="font-medium">{formatCurrency(stats.totalCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Estimated Hours:</span>
                    <span className="font-medium">{stats.totalHours}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg. Cost per Item:</span>
                    <span className="font-medium">
                      {formatCurrency(stats.totalItems > 0 ? stats.totalCost / stats.totalItems : 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated Completion:</span>
                    <span className="font-medium">
                      {Math.ceil(stats.totalHours / 40)} weeks
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}