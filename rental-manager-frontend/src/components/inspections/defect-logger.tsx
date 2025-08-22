'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AlertTriangle, 
  Camera,
  Package,
  Clock,
  Wrench,
  Scale,
  FileText,
  Plus,
  Trash2,
  Save,
  Calculator,
  Eye,
  MapPin
} from 'lucide-react';
import { 
  InspectionDefect, 
  DefectType, 
  DefectSeverity,
  ServiceType
} from '@/types/inspections';

interface DefectLoggerProps {
  itemId: string;
  itemName: string;
  skuCode: string;
  itemValue: number;
  onDefectsUpdate: (defects: InspectionDefect[]) => void;
  onClose: () => void;
  existingDefects?: InspectionDefect[];
}

const defectTypeDetails = {
  COSMETIC_DAMAGE: {
    label: 'Cosmetic Damage',
    description: 'Visible damage that doesn\'t affect function',
    baseMultiplier: 0.05,
    examples: ['Scratches', 'Dents', 'Discoloration', 'Worn surfaces'],
    urgency: 'low',
  },
  FUNCTIONAL_DAMAGE: {
    label: 'Functional Damage',
    description: 'Damage affecting item operation',
    baseMultiplier: 0.15,
    examples: ['Buttons not working', 'Reduced performance', 'Intermittent issues'],
    urgency: 'high',
  },
  MISSING_PARTS: {
    label: 'Missing Parts',
    description: 'Essential components are missing',
    baseMultiplier: 0.25,
    examples: ['Battery cover', 'Lens cap', 'Control knobs', 'Essential cables'],
    urgency: 'high',
  },
  MISSING_ACCESSORIES: {
    label: 'Missing Accessories',
    description: 'Non-essential accessories missing',
    baseMultiplier: 0.10,
    examples: ['Charger', 'Manual', 'Carry case', 'Extra batteries'],
    urgency: 'medium',
  },
  EXCESSIVE_WEAR: {
    label: 'Excessive Wear',
    description: 'Wear beyond normal use',
    baseMultiplier: 0.08,
    examples: ['Heavily worn surfaces', 'Faded text', 'Loose components'],
    urgency: 'medium',
  },
  TOTAL_FAILURE: {
    label: 'Total Failure',
    description: 'Item is completely non-functional',
    baseMultiplier: 0.80,
    examples: ['Won\'t turn on', 'Completely broken', 'Beyond repair'],
    urgency: 'critical',
  },
  WATER_DAMAGE: {
    label: 'Water Damage',
    description: 'Damage from liquid exposure',
    baseMultiplier: 0.40,
    examples: ['Water stains', 'Corrosion', 'Liquid damage indicators'],
    urgency: 'critical',
  },
  PHYSICAL_DAMAGE: {
    label: 'Physical Damage',
    description: 'Structural damage from impact',
    baseMultiplier: 0.30,
    examples: ['Cracked screen', 'Broken housing', 'Bent components'],
    urgency: 'high',
  },
};

const severityMultipliers = {
  MINOR: { multiplier: 1.0, label: 'Minor', color: 'bg-slate-100 text-slate-800', repairTime: 0.5 },
  MODERATE: { multiplier: 2.0, label: 'Moderate', color: 'bg-yellow-100 text-yellow-800', repairTime: 2 },
  MAJOR: { multiplier: 3.5, label: 'Major', color: 'bg-orange-100 text-orange-800', repairTime: 8 },
  CRITICAL: { multiplier: 5.0, label: 'Critical', color: 'bg-red-100 text-red-800', repairTime: 24 },
};

export function DefectLogger({
  itemId,
  itemName,
  skuCode,
  itemValue,
  onDefectsUpdate,
  onClose,
  existingDefects = []
}: DefectLoggerProps) {
  const [defects, setDefects] = useState<InspectionDefect[]>(existingDefects);
  const [currentDefect, setCurrentDefect] = useState<Partial<InspectionDefect>>({
    type: 'COSMETIC_DAMAGE',
    severity: 'MINOR',
    location_on_item: '',
    description: '',
    customer_fault: false,
    repair_required: true,
    estimated_repair_cost: 0,
    estimated_repair_time: 0,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const calculateEstimatedCost = (type: DefectType, severity: DefectSeverity) => {
    const typeDetails = defectTypeDetails[type];
    const severityDetails = severityMultipliers[severity];
    
    const baseCost = itemValue * typeDetails.baseMultiplier;
    const finalCost = baseCost * severityDetails.multiplier;
    
    return Math.round(finalCost);
  };

  const calculateEstimatedTime = (type: DefectType, severity: DefectSeverity) => {
    const severityDetails = severityMultipliers[severity];
    const typeComplexity = type === 'TOTAL_FAILURE' || type === 'WATER_DAMAGE' ? 2 : 1;
    
    return severityDetails.repairTime * typeComplexity;
  };

  useEffect(() => {
    if (currentDefect.type && currentDefect.severity) {
      const estimatedCost = calculateEstimatedCost(currentDefect.type, currentDefect.severity);
      const estimatedTime = calculateEstimatedTime(currentDefect.type, currentDefect.severity);
      
      setCurrentDefect(prev => ({
        ...prev,
        estimated_repair_cost: estimatedCost,
        estimated_repair_time: estimatedTime,
      }));
    }
  }, [currentDefect.type, currentDefect.severity, itemValue]);

  const addDefect = () => {
    if (!currentDefect.description?.trim() || !currentDefect.location_on_item?.trim()) {
      alert('Please provide both description and location for the defect.');
      return;
    }

    const newDefect: InspectionDefect = {
      id: Date.now().toString(),
      type: currentDefect.type!,
      severity: currentDefect.severity!,
      location_on_item: currentDefect.location_on_item!,
      description: currentDefect.description!,
      customer_fault: currentDefect.customer_fault!,
      repair_required: currentDefect.repair_required!,
      estimated_repair_cost: currentDefect.estimated_repair_cost!,
      estimated_repair_time: currentDefect.estimated_repair_time!,
      photos: [],
      created_at: new Date().toISOString(),
    };

    const updatedDefects = [...defects, newDefect];
    setDefects(updatedDefects);
    
    // Reset form
    setCurrentDefect({
      type: 'COSMETIC_DAMAGE',
      severity: 'MINOR',
      location_on_item: '',
      description: '',
      customer_fault: false,
      repair_required: true,
      estimated_repair_cost: 0,
      estimated_repair_time: 0,
    });
  };

  const removeDefect = (defectId: string) => {
    const updatedDefects = defects.filter(d => d.id !== defectId);
    setDefects(updatedDefects);
  };

  const updateDefect = (defectId: string, updates: Partial<InspectionDefect>) => {
    const updatedDefects = defects.map(d => 
      d.id === defectId ? { ...d, ...updates } : d
    );
    setDefects(updatedDefects);
  };

  const getTotalRepairCost = () => {
    return defects.reduce((sum, defect) => sum + defect.estimated_repair_cost, 0);
  };

  const getTotalRepairTime = () => {
    return defects.reduce((sum, defect) => sum + defect.estimated_repair_time, 0);
  };

  const getCustomerFaultCost = () => {
    return defects
      .filter(defect => defect.customer_fault)
      .reduce((sum, defect) => sum + defect.estimated_repair_cost, 0);
  };

  const handleSave = () => {
    onDefectsUpdate(defects);
    onClose();
  };

  const typeDetails = currentDefect.type ? defectTypeDetails[currentDefect.type] : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Defect Logger</h2>
              <p className="text-muted-foreground">
                {itemName} ({skuCode}) - Value: {formatCurrency(itemValue)}
              </p>
            </div>
            <Badge variant="outline">{defects.length} defects logged</Badge>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add New Defect */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Plus className="h-5 w-5" />
                <span>Add New Defect</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Defect Type */}
              <div className="space-y-2">
                <Label>Defect Type</Label>
                <Select
                  value={currentDefect.type}
                  onValueChange={(value) => setCurrentDefect(prev => ({ ...prev, type: value as DefectType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(defectTypeDetails).map(([type, details]) => (
                      <SelectItem key={type} value={type}>
                        {details.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {typeDetails && (
                  <div className="p-3 bg-gray-50 rounded-lg text-sm">
                    <div className="font-medium mb-1">{typeDetails.label}</div>
                    <div className="text-muted-foreground mb-2">{typeDetails.description}</div>
                    <div className="space-y-1">
                      <div className="text-xs font-medium">Examples:</div>
                      <div className="text-xs text-muted-foreground">
                        {typeDetails.examples.join(', ')}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Severity */}
              <div className="space-y-2">
                <Label>Severity Level</Label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(severityMultipliers).map(([severity, details]) => (
                    <div
                      key={severity}
                      className={`p-3 border rounded-lg cursor-pointer text-center transition-all ${
                        currentDefect.severity === severity
                          ? 'border-slate-500 bg-slate-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setCurrentDefect(prev => ({ ...prev, severity: severity as DefectSeverity }))}
                    >
                      <div className={`text-xs font-medium mb-1 ${details.color.replace('bg-', '').replace('text-', '')}`}>
                        {details.label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {details.repairTime}h repair
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="location">Location on Item</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="location"
                    value={currentDefect.location_on_item}
                    onChange={(e) => setCurrentDefect(prev => ({ ...prev, location_on_item: e.target.value }))}
                    placeholder="e.g., Front left corner, Back panel, Screen"
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Detailed Description</Label>
                <Textarea
                  id="description"
                  value={currentDefect.description}
                  onChange={(e) => setCurrentDefect(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the defect in detail..."
                  rows={3}
                />
              </div>

              {/* Cost and Time Estimates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Estimated Repair Cost</Label>
                  <div className="relative">
                    <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      value={currentDefect.estimated_repair_cost}
                      onChange={(e) => setCurrentDefect(prev => ({ ...prev, estimated_repair_cost: Number(e.target.value) }))}
                      className="pl-10"
                      min="0"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Auto-calculated: {formatCurrency(calculateEstimatedCost(currentDefect.type!, currentDefect.severity!))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Repair Time (Hours)</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      value={currentDefect.estimated_repair_time}
                      onChange={(e) => setCurrentDefect(prev => ({ ...prev, estimated_repair_time: Number(e.target.value) }))}
                      className="pl-10"
                      min="0"
                      step="0.5"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Estimated: {calculateEstimatedTime(currentDefect.type!, currentDefect.severity!)}h
                  </div>
                </div>
              </div>

              {/* Fault and Repair Options */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="customer_fault"
                    checked={currentDefect.customer_fault}
                    onChange={(e) => setCurrentDefect(prev => ({ ...prev, customer_fault: e.target.checked }))}
                    className="rounded"
                  />
                  <Label htmlFor="customer_fault" className="flex items-center space-x-2">
                    <Scale className="h-4 w-4" />
                    <span>Customer is responsible for this defect</span>
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="repair_required"
                    checked={currentDefect.repair_required}
                    onChange={(e) => setCurrentDefect(prev => ({ ...prev, repair_required: e.target.checked }))}
                    className="rounded"
                  />
                  <Label htmlFor="repair_required" className="flex items-center space-x-2">
                    <Wrench className="h-4 w-4" />
                    <span>Repair required before re-rental</span>
                  </Label>
                </div>
              </div>

              {/* Photo Documentation */}
              <div className="space-y-2">
                <Label>Photo Documentation</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <Camera className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Take photos of the defect
                  </p>
                  <Button variant="outline" size="sm">
                    <Camera className="h-4 w-4 mr-2" />
                    Add Photos
                  </Button>
                </div>
              </div>

              <Button 
                onClick={addDefect} 
                className="w-full"
                disabled={!currentDefect.description?.trim() || !currentDefect.location_on_item?.trim()}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Defect
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Logged Defects */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Logged Defects</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {defects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No defects logged yet</p>
                  <p className="text-sm">Add defects using the form on the left</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {defects.map((defect) => (
                    <Card key={defect.id} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="text-xs">
                              {defectTypeDetails[defect.type].label}
                            </Badge>
                            <Badge className={severityMultipliers[defect.severity].color}>
                              {defect.severity}
                            </Badge>
                            {defect.customer_fault && (
                              <Badge variant="destructive" className="text-xs">Customer Fault</Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDefect(defect.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm">
                            <span className="font-medium">Location:</span> {defect.location_on_item}
                          </div>
                          <p className="text-sm">{defect.description}</p>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Repair Cost:</span>
                              <span className="font-medium ml-1">{formatCurrency(defect.estimated_repair_cost)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Repair Time:</span>
                              <span className="font-medium ml-1">{defect.estimated_repair_time}h</span>
                            </div>
                          </div>

                          {defect.customer_fault && (
                            <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700">
                              Customer will be charged {formatCurrency(defect.estimated_repair_cost)}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          {defects.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calculator className="h-5 w-5" />
                  <span>Defects Summary</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Total Defects</div>
                    <div className="text-2xl font-bold">{defects.length}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Customer Fault</div>
                    <div className="text-2xl font-bold text-red-600">
                      {defects.filter(d => d.customer_fault).length}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-t pt-3">
                  <div className="flex justify-between">
                    <span>Total Repair Cost:</span>
                    <span className="font-medium">{formatCurrency(getTotalRepairCost())}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Customer Liable Amount:</span>
                    <span className="font-bold text-red-600">{formatCurrency(getCustomerFaultCost())}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Repair Time:</span>
                    <span className="font-medium">{getTotalRepairTime()} hours</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="text-sm text-slate-800">
                    <div className="font-medium">Service Queue Impact</div>
                    <div>
                      Estimated completion: {Math.ceil(getTotalRepairTime() / 8)} business days
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Save Defects
        </Button>
      </div>
    </div>
  );
}