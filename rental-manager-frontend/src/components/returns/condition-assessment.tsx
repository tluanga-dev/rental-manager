'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Camera, 
  Compare, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Eye, 
  Package,
  Wrench,
  X,
  Plus
} from 'lucide-react';
import { 
  ReturnInspection, 
  ConditionGrade, 
  PackagingCondition, 
  RecommendedAction,
  ItemDefect,
  DefectType,
  DefectSeverity
} from '@/types/returns';

interface ConditionAssessmentProps {
  itemId: string;
  itemName: string;
  skuCode: string;
  preRentalPhotos: string[];
  preRentalCondition: ConditionGrade;
  onInspectionComplete: (inspection: ReturnInspection) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const conditionGrades = [
  { grade: 'A' as ConditionGrade, label: 'Excellent', description: 'Like new, no visible wear', color: 'bg-green-100 text-green-800' },
  { grade: 'B' as ConditionGrade, label: 'Good', description: 'Minor cosmetic wear, fully functional', color: 'bg-slate-100 text-slate-800' },
  { grade: 'C' as ConditionGrade, label: 'Fair', description: 'Noticeable wear, may need cleaning', color: 'bg-yellow-100 text-yellow-800' },
  { grade: 'D' as ConditionGrade, label: 'Poor', description: 'Significant damage or missing parts', color: 'bg-red-100 text-red-800' },
];

const packagingConditions = [
  { condition: 'EXCELLENT' as PackagingCondition, label: 'Excellent', description: 'Original packaging, pristine' },
  { condition: 'GOOD' as PackagingCondition, label: 'Good', description: 'Minor wear on packaging' },
  { condition: 'FAIR' as PackagingCondition, label: 'Fair', description: 'Packaging damaged but usable' },
  { condition: 'POOR' as PackagingCondition, label: 'Poor', description: 'Packaging severely damaged' },
  { condition: 'MISSING' as PackagingCondition, label: 'Missing', description: 'No original packaging' },
];

const recommendedActions = [
  { action: 'RETURN_TO_INVENTORY' as RecommendedAction, label: 'Return to Inventory', icon: Package, color: 'text-green-600' },
  { action: 'MINOR_CLEANING' as RecommendedAction, label: 'Minor Cleaning', icon: Wrench, color: 'text-slate-600' },
  { action: 'DEEP_CLEANING' as RecommendedAction, label: 'Deep Cleaning', icon: Wrench, color: 'text-yellow-600' },
  { action: 'MINOR_REPAIR' as RecommendedAction, label: 'Minor Repair', icon: Wrench, color: 'text-orange-600' },
  { action: 'MAJOR_REPAIR' as RecommendedAction, label: 'Major Repair', icon: Wrench, color: 'text-red-600' },
  { action: 'QUARANTINE' as RecommendedAction, label: 'Quarantine', icon: AlertTriangle, color: 'text-red-700' },
  { action: 'WRITE_OFF' as RecommendedAction, label: 'Write Off', icon: X, color: 'text-gray-600' },
];

const defectTypes = [
  'COSMETIC_DAMAGE',
  'FUNCTIONAL_DAMAGE',
  'MISSING_PARTS',
  'MISSING_ACCESSORIES',
  'EXCESSIVE_WEAR',
  'TOTAL_FAILURE',
  'WATER_DAMAGE',
  'PHYSICAL_DAMAGE',
] as DefectType[];

const defectSeverities = [
  { severity: 'MINOR' as DefectSeverity, label: 'Minor', description: 'Minimal impact on function or appearance' },
  { severity: 'MODERATE' as DefectSeverity, label: 'Moderate', description: 'Noticeable but doesn\'t affect core function' },
  { severity: 'MAJOR' as DefectSeverity, label: 'Major', description: 'Significantly affects function or appearance' },
  { severity: 'CRITICAL' as DefectSeverity, label: 'Critical', description: 'Makes item unusable or unsafe' },
];

export function ConditionAssessment({
  itemId,
  itemName,
  skuCode,
  preRentalPhotos,
  preRentalCondition,
  onInspectionComplete,
  onCancel,
  isLoading,
}: ConditionAssessmentProps) {
  const [currentTab, setCurrentTab] = useState<'overview' | 'photos' | 'defects' | 'summary'>('overview');
  const [inspection, setInspection] = useState<Partial<ReturnInspection>>({
    overall_condition: 'B',
    functional_check_passed: true,
    cosmetic_check_passed: true,
    accessories_complete: true,
    packaging_condition: 'GOOD',
    recommended_action: 'RETURN_TO_INVENTORY',
    customer_acknowledgment: false,
    dispute_raised: false,
    comparison_notes: '',
    pre_rental_photos: preRentalPhotos,
    post_rental_photos: [],
  });
  const [defects, setDefects] = useState<ItemDefect[]>([]);
  const [newDefect, setNewDefect] = useState<Partial<ItemDefect>>({
    defect_type: 'COSMETIC_DAMAGE',
    severity: 'MINOR',
    customer_fault: false,
    description: '',
    repair_cost: 0,
    replacement_cost: 0,
  });

  const updateInspection = (updates: Partial<ReturnInspection>) => {
    setInspection(prev => ({ ...prev, ...updates }));
  };

  const addDefect = () => {
    if (!newDefect.description?.trim()) return;
    
    const defect: ItemDefect = {
      id: Date.now().toString(),
      defect_type: newDefect.defect_type!,
      severity: newDefect.severity!,
      description: newDefect.description!,
      customer_fault: newDefect.customer_fault!,
      repair_cost: newDefect.repair_cost!,
      replacement_cost: newDefect.replacement_cost!,
      photos: [],
      created_at: new Date().toISOString(),
    };
    
    setDefects(prev => [...prev, defect]);
    setNewDefect({
      defect_type: 'COSMETIC_DAMAGE',
      severity: 'MINOR',
      customer_fault: false,
      description: '',
      repair_cost: 0,
      replacement_cost: 0,
    });
  };

  const removeDefect = (defectId: string) => {
    setDefects(prev => prev.filter(d => d.id !== defectId));
  };

  const handleComplete = () => {
    const completeInspection: ReturnInspection = {
      id: Date.now().toString(),
      return_line_id: itemId,
      inspector_id: 'current_user', // Should come from auth context
      inspection_date: new Date().toISOString(),
      pre_rental_photos: preRentalPhotos,
      post_rental_photos: inspection.post_rental_photos || [],
      comparison_notes: inspection.comparison_notes || '',
      overall_condition: inspection.overall_condition!,
      functional_check_passed: inspection.functional_check_passed!,
      cosmetic_check_passed: inspection.cosmetic_check_passed!,
      accessories_complete: inspection.accessories_complete!,
      packaging_condition: inspection.packaging_condition!,
      recommended_action: inspection.recommended_action!,
      customer_acknowledgment: inspection.customer_acknowledgment!,
      customer_signature: inspection.customer_signature,
      dispute_raised: inspection.dispute_raised!,
      dispute_notes: inspection.dispute_notes,
    };
    
    onInspectionComplete(completeInspection);
  };

  const getConditionDowngrade = () => {
    const gradeOrder = ['A', 'B', 'C', 'D'];
    const preIndex = gradeOrder.indexOf(preRentalCondition);
    const postIndex = gradeOrder.indexOf(inspection.overall_condition!);
    return postIndex > preIndex;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getRecommendedActionByCondition = () => {
    const condition = inspection.overall_condition;
    const hasDefects = defects.length > 0;
    const hasCriticalDefects = defects.some(d => d.severity === 'CRITICAL');
    
    if (hasCriticalDefects) return 'QUARANTINE';
    if (condition === 'D') return 'MAJOR_REPAIR';
    if (condition === 'C') return hasDefects ? 'MINOR_REPAIR' : 'DEEP_CLEANING';
    if (condition === 'B') return 'MINOR_CLEANING';
    return 'RETURN_TO_INVENTORY';
  };

  // Auto-update recommended action based on condition and defects
  const suggestedAction = getRecommendedActionByCondition();
  if (inspection.recommended_action !== suggestedAction) {
    updateInspection({ recommended_action: suggestedAction });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Condition Assessment</h2>
              <p className="text-muted-foreground">
                {itemName} ({skuCode})
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className={conditionGrades.find(g => g.grade === preRentalCondition)?.color}>
                Pre-rental: Grade {preRentalCondition}
              </Badge>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Assessment Tabs */}
      <Card>
        <CardContent className="p-0">
          <Tabs value={currentTab} onValueChange={(value) => setCurrentTab(value as any)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="photos">Photos</TabsTrigger>
              <TabsTrigger value="defects">Defects</TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
            </TabsList>

            <div className="p-6">
              <TabsContent value="overview" className="space-y-6 mt-0">
                {/* Condition Assessment */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Current Condition</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {conditionGrades.map((grade) => (
                      <div
                        key={grade.grade}
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          inspection.overall_condition === grade.grade
                            ? 'border-slate-500 bg-slate-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => updateInspection({ overall_condition: grade.grade })}
                      >
                        <div className="text-center">
                          <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold mb-2 ${grade.color}`}>
                            {grade.grade}
                          </div>
                          <div className="font-medium">{grade.label}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {grade.description}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Functional Checks */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Functional Checks</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span>Functional Check</span>
                      <Button
                        variant={inspection.functional_check_passed ? 'default' : 'destructive'}
                        size="sm"
                        onClick={() => updateInspection({ functional_check_passed: !inspection.functional_check_passed })}
                      >
                        {inspection.functional_check_passed ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Pass
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 mr-1" />
                            Fail
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span>Cosmetic Check</span>
                      <Button
                        variant={inspection.cosmetic_check_passed ? 'default' : 'destructive'}
                        size="sm"
                        onClick={() => updateInspection({ cosmetic_check_passed: !inspection.cosmetic_check_passed })}
                      >
                        {inspection.cosmetic_check_passed ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Pass
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 mr-1" />
                            Fail
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span>Accessories Complete</span>
                      <Button
                        variant={inspection.accessories_complete ? 'default' : 'destructive'}
                        size="sm"
                        onClick={() => updateInspection({ accessories_complete: !inspection.accessories_complete })}
                      >
                        {inspection.accessories_complete ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Complete
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 mr-1" />
                            Missing
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Packaging Condition */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Packaging Condition</h3>
                  <Select
                    value={inspection.packaging_condition}
                    onValueChange={(value) => updateInspection({ packaging_condition: value as PackagingCondition })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {packagingConditions.map((pkg) => (
                        <SelectItem key={pkg.condition} value={pkg.condition}>
                          {pkg.label} - {pkg.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Comparison Notes */}
                <div className="space-y-2">
                  <Label htmlFor="comparison_notes">Comparison Notes</Label>
                  <Textarea
                    id="comparison_notes"
                    value={inspection.comparison_notes}
                    onChange={(e) => updateInspection({ comparison_notes: e.target.value })}
                    placeholder="Compare current condition with pre-rental photos and note any changes..."
                    rows={4}
                  />
                </div>
              </TabsContent>

              <TabsContent value="photos" className="space-y-6 mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Pre-rental Photos */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Pre-rental Photos</h3>
                    {preRentalPhotos.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        {preRentalPhotos.map((photo, index) => (
                          <div key={index} className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                            <Camera className="h-8 w-8 text-gray-400" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No pre-rental photos available</p>
                      </div>
                    )}
                  </div>

                  {/* Post-rental Photos */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Post-rental Photos</h3>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <Camera className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-muted-foreground mb-4">
                        Take photos of current condition
                      </p>
                      <Button variant="outline">
                        <Camera className="h-4 w-4 mr-2" />
                        Take Photos
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Photo Comparison */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center space-x-2">
                    <Compare className="h-5 w-5" />
                    <span>Side-by-Side Comparison</span>
                  </h3>
                  <div className="p-6 border rounded-lg bg-gray-50 text-center text-muted-foreground">
                    Photo comparison tool would appear here
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="defects" className="space-y-6 mt-0">
                {/* Add New Defect */}
                <Card>
                  <CardHeader>
                    <CardTitle>Add Defect</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Defect Type</Label>
                        <Select
                          value={newDefect.defect_type}
                          onValueChange={(value) => setNewDefect(prev => ({ ...prev, defect_type: value as DefectType }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {defectTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Severity</Label>
                        <Select
                          value={newDefect.severity}
                          onValueChange={(value) => setNewDefect(prev => ({ ...prev, severity: value as DefectSeverity }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {defectSeverities.map((severity) => (
                              <SelectItem key={severity.severity} value={severity.severity}>
                                {severity.label} - {severity.description}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={newDefect.description}
                        onChange={(e) => setNewDefect(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe the defect in detail..."
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Repair Cost</Label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newDefect.repair_cost}
                          onChange={(e) => setNewDefect(prev => ({ ...prev, repair_cost: Number(e.target.value) }))}
                          className="w-full px-3 py-2 border rounded-md"
                          placeholder="0.00"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Replacement Cost</Label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newDefect.replacement_cost}
                          onChange={(e) => setNewDefect(prev => ({ ...prev, replacement_cost: Number(e.target.value) }))}
                          className="w-full px-3 py-2 border rounded-md"
                          placeholder="0.00"
                        />
                      </div>

                      <div className="flex items-center space-x-2 pt-6">
                        <input
                          type="checkbox"
                          id="customer_fault"
                          checked={newDefect.customer_fault}
                          onChange={(e) => setNewDefect(prev => ({ ...prev, customer_fault: e.target.checked }))}
                          className="rounded"
                        />
                        <Label htmlFor="customer_fault">Customer Fault</Label>
                      </div>
                    </div>

                    <Button onClick={addDefect} disabled={!newDefect.description?.trim()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Defect
                    </Button>
                  </CardContent>
                </Card>

                {/* Defects List */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Documented Defects ({defects.length})</h3>
                  {defects.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No defects documented</p>
                      <p className="text-sm">Add defects above if any issues are found</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {defects.map((defect) => (
                        <Card key={defect.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2">
                                  <Badge variant="outline">
                                    {defect.defect_type.replace('_', ' ')}
                                  </Badge>
                                  <Badge className={
                                    defect.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                                    defect.severity === 'MAJOR' ? 'bg-orange-100 text-orange-800' :
                                    defect.severity === 'MODERATE' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-slate-100 text-slate-800'
                                  }>
                                    {defect.severity}
                                  </Badge>
                                  {defect.customer_fault && (
                                    <Badge variant="destructive">Customer Fault</Badge>
                                  )}
                                </div>
                                <p className="text-sm mb-2">{defect.description}</p>
                                <div className="text-xs text-muted-foreground">
                                  Repair: {formatCurrency(defect.repair_cost)} | 
                                  Replacement: {formatCurrency(defect.replacement_cost)}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeDefect(defect.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="summary" className="space-y-6 mt-0">
                {/* Condition Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle>Assessment Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Condition Grade</div>
                        <div className="flex items-center space-x-2">
                          <Badge className={conditionGrades.find(g => g.grade === preRentalCondition)?.color}>
                            Pre: {preRentalCondition}
                          </Badge>
                          <span>→</span>
                          <Badge className={conditionGrades.find(g => g.grade === inspection.overall_condition)?.color}>
                            Post: {inspection.overall_condition}
                          </Badge>
                          {getConditionDowngrade() && (
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm text-muted-foreground">Recommended Action</div>
                        <div className="flex items-center space-x-2">
                          {(() => {
                            const action = recommendedActions.find(a => a.action === inspection.recommended_action);
                            const Icon = action?.icon || Package;
                            return (
                              <>
                                <Icon className={`h-4 w-4 ${action?.color}`} />
                                <span>{action?.label}</span>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-sm text-muted-foreground">Functional</div>
                        <div className={`font-medium ${inspection.functional_check_passed ? 'text-green-600' : 'text-red-600'}`}>
                          {inspection.functional_check_passed ? 'Pass' : 'Fail'}
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-sm text-muted-foreground">Cosmetic</div>
                        <div className={`font-medium ${inspection.cosmetic_check_passed ? 'text-green-600' : 'text-red-600'}`}>
                          {inspection.cosmetic_check_passed ? 'Pass' : 'Fail'}
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-sm text-muted-foreground">Accessories</div>
                        <div className={`font-medium ${inspection.accessories_complete ? 'text-green-600' : 'text-red-600'}`}>
                          {inspection.accessories_complete ? 'Complete' : 'Missing'}
                        </div>
                      </div>
                    </div>

                    {defects.length > 0 && (
                      <div>
                        <div className="text-sm text-muted-foreground mb-2">Defects Summary</div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Total Defects:</span>
                            <span>{defects.length}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Customer Fault:</span>
                            <span>{defects.filter(d => d.customer_fault).length}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Total Repair Cost:</span>
                            <span>{formatCurrency(defects.reduce((sum, d) => sum + d.repair_cost, 0))}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Customer Acknowledgment */}
                <Card>
                  <CardHeader>
                    <CardTitle>Customer Acknowledgment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="customer_ack"
                        checked={inspection.customer_acknowledgment}
                        onChange={(e) => updateInspection({ customer_acknowledgment: e.target.checked })}
                        className="rounded"
                      />
                      <Label htmlFor="customer_ack">
                        Customer acknowledges the assessed condition and agrees to any applicable charges
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="dispute"
                        checked={inspection.dispute_raised}
                        onChange={(e) => updateInspection({ dispute_raised: e.target.checked })}
                        className="rounded"
                      />
                      <Label htmlFor="dispute">Customer disputes the assessment</Label>
                    </div>

                    {inspection.dispute_raised && (
                      <div className="space-y-2">
                        <Label htmlFor="dispute_notes">Dispute Notes</Label>
                        <Textarea
                          id="dispute_notes"
                          value={inspection.dispute_notes || ''}
                          onChange={(e) => updateInspection({ dispute_notes: e.target.value })}
                          placeholder="Record customer's dispute details..."
                          rows={3}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end space-x-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          onClick={handleComplete}
          disabled={!inspection.customer_acknowledgment && !inspection.dispute_raised}
        >
          Complete Assessment
        </Button>
      </div>
    </div>
  );
}