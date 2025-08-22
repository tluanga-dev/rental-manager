'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AlertTriangle, 
  Wrench, 
  Eye, 
  Camera, 
  Package,
  Scale,
  FileText,
  CheckCircle,
  X
} from 'lucide-react';
import { 
  ItemDefect, 
  DefectType, 
  DefectSeverity, 
  ConditionGrade,
  RETURN_BUSINESS_RULES 
} from '@/types/returns';

interface DamageClassificationProps {
  itemName: string;
  skuCode: string;
  itemValue: number;
  preRentalCondition: ConditionGrade;
  currentCondition: ConditionGrade;
  existingDefects: ItemDefect[];
  onDefectsUpdate: (defects: ItemDefect[]) => void;
  onClose: () => void;
}

const defectTypeDetails = {
  COSMETIC_DAMAGE: {
    label: 'Cosmetic Damage',
    description: 'Scratches, dents, discoloration that don\'t affect function',
    icon: Eye,
    examples: ['Scratches on surface', 'Small dents', 'Worn paint', 'Discoloration'],
  },
  FUNCTIONAL_DAMAGE: {
    label: 'Functional Damage',
    description: 'Damage that affects the item\'s operation or performance',
    icon: Wrench,
    examples: ['Buttons not working', 'Reduced performance', 'Intermittent issues'],
  },
  MISSING_PARTS: {
    label: 'Missing Parts',
    description: 'Essential components that are part of the item are missing',
    icon: AlertTriangle,
    examples: ['Missing battery cover', 'Missing lens cap', 'Missing cables'],
  },
  MISSING_ACCESSORIES: {
    label: 'Missing Accessories',
    description: 'Additional items that come with the rental are missing',
    icon: AlertTriangle,
    examples: ['Missing charger', 'Missing manual', 'Missing carry case'],
  },
  EXCESSIVE_WEAR: {
    label: 'Excessive Wear',
    description: 'Wear beyond normal use for the rental period',
    icon: AlertTriangle,
    examples: ['Heavily worn surfaces', 'Faded text/labels', 'Loose components'],
  },
  TOTAL_FAILURE: {
    label: 'Total Failure',
    description: 'Item is completely non-functional',
    icon: X,
    examples: ['Won\'t turn on', 'Completely broken', 'Beyond repair'],
  },
  WATER_DAMAGE: {
    label: 'Water Damage',
    description: 'Damage caused by water or other liquids',
    icon: AlertTriangle,
    examples: ['Water stains', 'Corrosion', 'Liquid damage indicators triggered'],
  },
  PHYSICAL_DAMAGE: {
    label: 'Physical Damage',
    description: 'Structural damage from impact or mishandling',
    icon: AlertTriangle,
    examples: ['Cracked screen', 'Broken housing', 'Bent components'],
  },
};

const severityDetails = {
  MINOR: {
    label: 'Minor',
    description: 'Minimal impact, easily repairable',
    color: 'bg-slate-100 text-slate-800',
    costMultiplier: RETURN_BUSINESS_RULES.DAMAGE_COST_MULTIPLIERS.MINOR,
  },
  MODERATE: {
    label: 'Moderate',
    description: 'Noticeable impact, requires professional repair',
    color: 'bg-yellow-100 text-yellow-800',
    costMultiplier: RETURN_BUSINESS_RULES.DAMAGE_COST_MULTIPLIERS.MODERATE,
  },
  MAJOR: {
    label: 'Major',
    description: 'Significant impact, expensive to repair',
    color: 'bg-orange-100 text-orange-800',
    costMultiplier: RETURN_BUSINESS_RULES.DAMAGE_COST_MULTIPLIERS.MAJOR,
  },
  CRITICAL: {
    label: 'Critical',
    description: 'Item unusable, may require replacement',
    color: 'bg-red-100 text-red-800',
    costMultiplier: RETURN_BUSINESS_RULES.DAMAGE_COST_MULTIPLIERS.CRITICAL,
  },
};

export function DamageClassification({
  itemName,
  skuCode,
  itemValue,
  preRentalCondition,
  currentCondition,
  existingDefects,
  onDefectsUpdate,
  onClose,
}: DamageClassificationProps) {
  const [defects, setDefects] = useState<ItemDefect[]>(existingDefects);
  const [activeDefect, setActiveDefect] = useState<Partial<ItemDefect>>({
    defect_type: 'COSMETIC_DAMAGE',
    severity: 'MINOR',
    customer_fault: true,
    description: '',
    repair_cost: 0,
    replacement_cost: 0,
  });
  const [selectedDefectType, setSelectedDefectType] = useState<DefectType>('COSMETIC_DAMAGE');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const calculateSuggestedCost = (severity: DefectSeverity) => {
    const multiplier = severityDetails[severity].costMultiplier;
    return itemValue * multiplier;
  };

  const updateActiveDefect = (updates: Partial<ItemDefect>) => {
    setActiveDefect(prev => ({ ...prev, ...updates }));
  };

  const addDefect = () => {
    if (!activeDefect.description?.trim()) return;

    const newDefect: ItemDefect = {
      id: Date.now().toString(),
      defect_type: activeDefect.defect_type!,
      severity: activeDefect.severity!,
      description: activeDefect.description!,
      customer_fault: activeDefect.customer_fault!,
      repair_cost: activeDefect.repair_cost!,
      replacement_cost: activeDefect.replacement_cost!,
      photos: [],
      created_at: new Date().toISOString(),
    };

    const updatedDefects = [...defects, newDefect];
    setDefects(updatedDefects);
    
    // Reset form
    setActiveDefect({
      defect_type: 'COSMETIC_DAMAGE',
      severity: 'MINOR',
      customer_fault: true,
      description: '',
      repair_cost: 0,
      replacement_cost: 0,
    });
  };

  const removeDefect = (defectId: string) => {
    const updatedDefects = defects.filter(d => d.id !== defectId);
    setDefects(updatedDefects);
  };

  const updateDefect = (defectId: string, updates: Partial<ItemDefect>) => {
    const updatedDefects = defects.map(d => 
      d.id === defectId ? { ...d, ...updates } : d
    );
    setDefects(updatedDefects);
  };

  const handleSave = () => {
    onDefectsUpdate(defects);
    onClose();
  };

  const getTotalDamageCost = () => {
    return defects.reduce((sum, defect) => sum + defect.repair_cost, 0);
  };

  const getCustomerFaultCost = () => {
    return defects
      .filter(defect => defect.customer_fault)
      .reduce((sum, defect) => sum + defect.repair_cost, 0);
  };

  const typeDetail = defectTypeDetails[selectedDefectType];
  const TypeIcon = typeDetail.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Damage Classification</h2>
              <p className="text-muted-foreground">
                {itemName} ({skuCode}) - Value: {formatCurrency(itemValue)}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className={severityDetails[preRentalCondition as keyof typeof severityDetails]?.color || 'bg-gray-100 text-gray-800'}>
                Pre: Grade {preRentalCondition}
              </Badge>
              <Badge className={severityDetails[currentCondition as keyof typeof severityDetails]?.color || 'bg-gray-100 text-gray-800'}>
                Current: Grade {currentCondition}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Defect Type Selection */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Defect Types</h3>
          <div className="space-y-2">
            {Object.entries(defectTypeDetails).map(([type, details]) => {
              const Icon = details.icon;
              const isSelected = selectedDefectType === type;
              
              return (
                <div
                  key={type}
                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                    isSelected ? 'border-slate-500 bg-slate-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => {
                    setSelectedDefectType(type as DefectType);
                    updateActiveDefect({ defect_type: type as DefectType });
                  }}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`h-5 w-5 ${isSelected ? 'text-slate-600' : 'text-gray-600'}`} />
                    <div className="flex-1">
                      <div className={`font-medium ${isSelected ? 'text-slate-900' : 'text-gray-900'}`}>
                        {details.label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {details.description}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Defect Configuration */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TypeIcon className="h-5 w-5" />
                <span>{typeDetail.label}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{typeDetail.description}</p>
              
              {/* Examples */}
              <div>
                <h4 className="text-sm font-medium mb-2">Common Examples:</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {typeDetail.examples.map((example, index) => (
                    <li key={index} className="flex items-center space-x-2">
                      <div className="w-1 h-1 bg-gray-400 rounded-full" />
                      <span>{example}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Severity Selection */}
              <div className="space-y-2">
                <Label>Severity Level</Label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(severityDetails).map(([severity, details]) => (
                    <div
                      key={severity}
                      className={`p-3 border rounded-lg cursor-pointer text-center transition-all ${
                        activeDefect.severity === severity
                          ? 'border-slate-500 bg-slate-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => {
                        updateActiveDefect({ 
                          severity: severity as DefectSeverity,
                          repair_cost: calculateSuggestedCost(severity as DefectSeverity)
                        });
                      }}
                    >
                      <div className={`text-xs font-medium mb-1 ${details.color.replace('bg-', '').replace('text-', '')}`}>
                        {details.label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(details.costMultiplier * 100).toFixed(0)}% of value
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Detailed Description</Label>
                <Textarea
                  id="description"
                  value={activeDefect.description}
                  onChange={(e) => updateActiveDefect({ description: e.target.value })}
                  placeholder="Describe the defect in detail..."
                  rows={3}
                />
              </div>

              {/* Cost Input */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Repair Cost</Label>
                  <div className="relative">
                    <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={activeDefect.repair_cost}
                      onChange={(e) => updateActiveDefect({ repair_cost: Number(e.target.value) })}
                      className="pl-10"
                      placeholder="0.00"
                    />
                  </div>
                  {activeDefect.severity && (
                    <div className="text-xs text-muted-foreground">
                      Suggested: {formatCurrency(calculateSuggestedCost(activeDefect.severity))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Replacement Cost</Label>
                  <div className="relative">
                    <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={activeDefect.replacement_cost}
                      onChange={(e) => updateActiveDefect({ replacement_cost: Number(e.target.value) })}
                      className="pl-10"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Customer Fault */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="customer_fault"
                    checked={activeDefect.customer_fault}
                    onChange={(e) => updateActiveDefect({ customer_fault: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="customer_fault" className="flex items-center space-x-2">
                    <Scale className="h-4 w-4" />
                    <span>Customer is responsible for this damage</span>
                  </Label>
                </div>
                <div className="text-xs text-muted-foreground ml-6">
                  Uncheck if damage is due to normal wear, manufacturing defect, or company fault
                </div>
              </div>

              {/* Photo Documentation */}
              <div className="space-y-2">
                <Label>Photo Documentation</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <Camera className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-muted-foreground">
                    Take photos of the damage
                  </p>
                  <Button variant="outline" size="sm" className="mt-2">
                    <Camera className="h-4 w-4 mr-2" />
                    Add Photos
                  </Button>
                </div>
              </div>

              <Button 
                onClick={addDefect} 
                disabled={!activeDefect.description?.trim()}
                className="w-full"
              >
                Add Defect
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Documented Defects */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Documented Defects</h3>
            <Badge variant="outline">{defects.length} total</Badge>
          </div>

          {defects.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-muted-foreground">No defects documented yet</p>
                <p className="text-sm text-muted-foreground">Add defects using the form on the left</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {defects.map((defect) => (
                <Card key={defect.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">
                          {defectTypeDetails[defect.defect_type].label}
                        </Badge>
                        <Badge className={severityDetails[defect.severity].color}>
                          {defect.severity}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDefect(defect.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <p className="text-sm mb-3">{defect.description}</p>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>Repair Cost:</span>
                        <span className="font-medium">{formatCurrency(defect.repair_cost)}</span>
                      </div>
                      {defect.replacement_cost > 0 && (
                        <div className="flex justify-between text-xs">
                          <span>Replacement Cost:</span>
                          <span className="font-medium">{formatCurrency(defect.replacement_cost)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs">
                        <span>Customer Fault:</span>
                        <span className={`font-medium ${defect.customer_fault ? 'text-red-600' : 'text-green-600'}`}>
                          {defect.customer_fault ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>

                    {defect.customer_fault && (
                      <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700">
                        Customer will be charged {formatCurrency(defect.repair_cost)}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Summary */}
          {defects.length > 0 && (
            <Card className="bg-gray-50">
              <CardContent className="p-4">
                <h4 className="font-medium mb-3">Damage Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total Defects:</span>
                    <span>{defects.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Customer Fault Defects:</span>
                    <span>{defects.filter(d => d.customer_fault).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Damage Cost:</span>
                    <span className="font-medium">{formatCurrency(getTotalDamageCost())}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span>Customer Liable Amount:</span>
                    <span className="font-bold text-red-600">{formatCurrency(getCustomerFaultCost())}</span>
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
          <CheckCircle className="h-4 w-4 mr-2" />
          Save Classification
        </Button>
      </div>
    </div>
  );
}