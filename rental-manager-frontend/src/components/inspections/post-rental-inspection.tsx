'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Camera, 
  // Compare, 
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Package,
  Clock,
  User,
  ZoomIn,
  RotateCcw,
  Plus,
  Minus
} from 'lucide-react';
import { 
  InspectionPhoto, 
  InspectionDefect,
  ChecklistItem,
  ConditionGrade,
  DefectType,
  DefectSeverity
} from '@/types/inspections';

interface PostRentalInspectionProps {
  itemId: string;
  itemName: string;
  skuCode: string;
  serialNumber?: string;
  preRentalPhotos: InspectionPhoto[];
  preRentalCondition: ConditionGrade;
  rentalPeriod: {
    start: string;
    end: string;
    daysOverdue: number;
  };
  onComplete: (inspection: PostRentalInspectionData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

interface PostRentalInspectionData {
  overall_condition: ConditionGrade;
  condition_changed: boolean;
  photos: InspectionPhoto[];
  defects: InspectionDefect[];
  comparison_notes: string;
  customer_signature?: string;
  recommended_action: string;
}

const conditionGrades = [
  { grade: 'A' as ConditionGrade, label: 'Excellent', description: 'Like new, no visible wear', color: 'bg-green-100 text-green-800' },
  { grade: 'B' as ConditionGrade, label: 'Good', description: 'Minor cosmetic wear, fully functional', color: 'bg-slate-100 text-slate-800' },
  { grade: 'C' as ConditionGrade, label: 'Fair', description: 'Noticeable wear, may need cleaning', color: 'bg-yellow-100 text-yellow-800' },
  { grade: 'D' as ConditionGrade, label: 'Poor', description: 'Significant damage or missing parts', color: 'bg-red-100 text-red-800' },
];

const defectTypes: { type: DefectType; label: string; severity: DefectSeverity[] }[] = [
  { type: 'COSMETIC_DAMAGE', label: 'Cosmetic Damage', severity: ['MINOR', 'MODERATE', 'MAJOR'] },
  { type: 'FUNCTIONAL_DAMAGE', label: 'Functional Damage', severity: ['MODERATE', 'MAJOR', 'CRITICAL'] },
  { type: 'MISSING_PARTS', label: 'Missing Parts', severity: ['MAJOR', 'CRITICAL'] },
  { type: 'MISSING_ACCESSORIES', label: 'Missing Accessories', severity: ['MINOR', 'MODERATE', 'MAJOR'] },
  { type: 'EXCESSIVE_WEAR', label: 'Excessive Wear', severity: ['MINOR', 'MODERATE', 'MAJOR'] },
  { type: 'WATER_DAMAGE', label: 'Water Damage', severity: ['MAJOR', 'CRITICAL'] },
  { type: 'PHYSICAL_DAMAGE', label: 'Physical Damage', severity: ['MODERATE', 'MAJOR', 'CRITICAL'] },
];

export function PostRentalInspection({
  itemId,
  itemName,
  skuCode,
  serialNumber,
  preRentalPhotos,
  preRentalCondition,
  rentalPeriod,
  onComplete,
  onCancel,
  isLoading
}: PostRentalInspectionProps) {
  const [currentCondition, setCurrentCondition] = useState<ConditionGrade>('B');
  const [postRentalPhotos, setPostRentalPhotos] = useState<InspectionPhoto[]>([]);
  const [defects, setDefects] = useState<InspectionDefect[]>([]);
  const [comparisonNotes, setComparisonNotes] = useState('');
  const [selectedPrePhoto, setSelectedPrePhoto] = useState<InspectionPhoto | null>(null);
  const [selectedPostPhoto, setSelectedPostPhoto] = useState<InspectionPhoto | null>(null);
  const [currentTab, setCurrentTab] = useState<'comparison' | 'condition' | 'defects' | 'summary'>('comparison');
  const [zoomLevel, setZoomLevel] = useState(1);

  const getConditionDowngrade = () => {
    const gradeOrder = ['A', 'B', 'C', 'D'];
    const preIndex = gradeOrder.indexOf(preRentalCondition);
    const postIndex = gradeOrder.indexOf(currentCondition);
    return postIndex > preIndex;
  };

  const addDefect = () => {
    const newDefect: InspectionDefect = {
      id: Date.now().toString(),
      type: 'COSMETIC_DAMAGE',
      severity: 'MINOR',
      location_on_item: '',
      description: '',
      customer_fault: true,
      repair_required: false,
      estimated_repair_cost: 0,
      estimated_repair_time: 0,
      photos: [],
      created_at: new Date().toISOString(),
    };
    setDefects(prev => [...prev, newDefect]);
  };

  const updateDefect = (defectId: string, updates: Partial<InspectionDefect>) => {
    setDefects(prev => 
      prev.map(defect => 
        defect.id === defectId ? { ...defect, ...updates } : defect
      )
    );
  };

  const removeDefect = (defectId: string) => {
    setDefects(prev => prev.filter(defect => defect.id !== defectId));
  };

  const mockCapturePhoto = (angle: string) => {
    const photo: InspectionPhoto = {
      id: Date.now().toString(),
      photo_url: `/api/placeholder/400/300?text=${angle}`,
      angle: angle as any,
      description: `Post-rental ${angle} view`,
      required: true,
      timestamp: new Date().toISOString(),
    };
    setPostRentalPhotos(prev => [...prev, photo]);
  };

  const getRecommendedAction = () => {
    const hasDefects = defects.length > 0;
    const hasCriticalDefects = defects.some(d => d.severity === 'CRITICAL');
    const conditionDowngraded = getConditionDowngrade();
    
    if (hasCriticalDefects) return 'QUARANTINE';
    if (currentCondition === 'D') return 'MAJOR_REPAIR';
    if (currentCondition === 'C' || conditionDowngraded) return 'DEEP_CLEANING';
    if (hasDefects) return 'MINOR_CLEANING';
    return 'RETURN_TO_INVENTORY';
  };

  const canComplete = () => {
    return postRentalPhotos.length >= 3; // Minimum required photos
  };

  const handleComplete = () => {
    const inspectionData: PostRentalInspectionData = {
      overall_condition: currentCondition,
      condition_changed: getConditionDowngrade(),
      photos: postRentalPhotos,
      defects,
      comparison_notes: comparisonNotes,
      recommended_action: getRecommendedAction(),
    };
    onComplete(inspectionData);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Post-Rental Inspection</h2>
              <p className="text-muted-foreground">
                {itemName} ({skuCode}) {serialNumber && `- SN: ${serialNumber}`}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className={conditionGrades.find(g => g.grade === preRentalCondition)?.color}>
                Pre: Grade {preRentalCondition}
              </Badge>
              {rentalPeriod.daysOverdue > 0 && (
                <Badge variant="destructive">
                  {rentalPeriod.daysOverdue} days overdue
                </Badge>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-sm mt-4">
            <div>
              <div className="text-muted-foreground">Rental Start</div>
              <div className="font-medium">{formatDate(rentalPeriod.start)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Expected Return</div>
              <div className="font-medium">{formatDate(rentalPeriod.end)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Actual Return</div>
              <div className="font-medium">{formatDate(new Date().toISOString())}</div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Inspection Interface */}
      <Card>
        <CardContent className="p-0">
          <Tabs value={currentTab} onValueChange={(value) => setCurrentTab(value as any)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="comparison">Photo Comparison</TabsTrigger>
              <TabsTrigger value="condition">Condition Assessment</TabsTrigger>
              <TabsTrigger value="defects">Defects ({defects.length})</TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
            </TabsList>

            <div className="p-6">
              <TabsContent value="comparison" className="space-y-6 mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Pre-Rental Photos */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center space-x-2">
                      <Eye className="h-5 w-5" />
                      <span>Pre-Rental Condition</span>
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-3">
                      {preRentalPhotos.map((photo) => (
                        <div
                          key={photo.id}
                          className={`aspect-square border-2 rounded-lg cursor-pointer transition-all ${
                            selectedPrePhoto?.id === photo.id ? 'border-slate-500' : 'border-gray-200'
                          }`}
                          onClick={() => setSelectedPrePhoto(photo)}
                        >
                          <div className="w-full h-full bg-gray-100 rounded flex items-center justify-center">
                            <Camera className="h-8 w-8 text-gray-400" />
                            <span className="sr-only">{photo.description}</span>
                          </div>
                          <div className="text-xs text-center mt-1 px-1">
                            {photo.angle?.replace('_', ' ')}
                          </div>
                        </div>
                      ))}
                    </div>

                    {selectedPrePhoto && (
                      <Card className="p-4">
                        <div className="text-sm">
                          <div className="font-medium">{selectedPrePhoto.description}</div>
                          <div className="text-muted-foreground">
                            Taken: {formatDate(selectedPrePhoto.timestamp)}
                          </div>
                        </div>
                      </Card>
                    )}
                  </div>

                  {/* Post-Rental Photos */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold flex items-center space-x-2">
                        <Camera className="h-5 w-5" />
                        <span>Current Condition</span>
                      </h3>
                      <Button onClick={() => mockCapturePhoto('FRONT')} size="sm">
                        <Camera className="h-4 w-4 mr-2" />
                        Take Photo
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {postRentalPhotos.map((photo) => (
                        <div
                          key={photo.id}
                          className={`aspect-square border-2 rounded-lg cursor-pointer transition-all ${
                            selectedPostPhoto?.id === photo.id ? 'border-slate-500' : 'border-gray-200'
                          }`}
                          onClick={() => setSelectedPostPhoto(photo)}
                        >
                          <div className="w-full h-full bg-gray-100 rounded flex items-center justify-center">
                            <Camera className="h-8 w-8 text-gray-400" />
                            <span className="sr-only">{photo.description}</span>
                          </div>
                          <div className="text-xs text-center mt-1 px-1">
                            {photo.angle?.replace('_', ' ')}
                          </div>
                        </div>
                      ))}
                      
                      {/* Add Photo Placeholder */}
                      <div
                        className="aspect-square border-2 border-dashed border-gray-300 rounded-lg cursor-pointer flex flex-col items-center justify-center hover:border-gray-400 transition-colors"
                        onClick={() => mockCapturePhoto('NEW')}
                      >
                        <Plus className="h-8 w-8 text-gray-400" />
                        <span className="text-xs text-gray-500 mt-1">Add Photo</span>
                      </div>
                    </div>

                    {selectedPostPhoto && (
                      <Card className="p-4">
                        <div className="text-sm">
                          <div className="font-medium">{selectedPostPhoto.description}</div>
                          <div className="text-muted-foreground">
                            Taken: {formatDate(selectedPostPhoto.timestamp)}
                          </div>
                        </div>
                      </Card>
                    )}
                  </div>
                </div>

                {/* Side-by-Side Comparison */}
                {selectedPrePhoto && selectedPostPhoto && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Eye className="h-5 w-5" />
                        <span>Side-by-Side Comparison</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <h4 className="font-medium">Before (Pre-Rental)</h4>
                          <div className="aspect-video bg-gray-100 rounded flex items-center justify-center">
                            <Camera className="h-12 w-12 text-gray-400" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-medium">After (Post-Rental)</h4>
                          <div className="aspect-video bg-gray-100 rounded flex items-center justify-center">
                            <Camera className="h-12 w-12 text-gray-400" />
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4 flex items-center justify-center space-x-2">
                        <Button variant="outline" size="sm" onClick={() => setZoomLevel(prev => Math.max(1, prev - 0.5))}>
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="text-sm px-2">Zoom: {zoomLevel}x</span>
                        <Button variant="outline" size="sm" onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.5))}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Comparison Notes */}
                <Card>
                  <CardHeader>
                    <CardTitle>Comparison Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={comparisonNotes}
                      onChange={(e) => setComparisonNotes(e.target.value)}
                      placeholder="Describe any changes noticed between pre and post rental photos..."
                      rows={4}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="condition" className="space-y-6 mt-0">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Current Condition Assessment</h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {conditionGrades.map((grade) => (
                      <div
                        key={grade.grade}
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          currentCondition === grade.grade
                            ? 'border-slate-500 bg-slate-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setCurrentCondition(grade.grade)}
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

                  {getConditionDowngrade() && (
                    <Card className="border-orange-300 bg-orange-50">
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-2">
                          <AlertTriangle className="h-5 w-5 text-orange-600" />
                          <div>
                            <h4 className="font-medium text-orange-800">Condition Downgrade Detected</h4>
                            <p className="text-sm text-orange-700">
                              Item condition has decreased from Grade {preRentalCondition} to Grade {currentCondition}.
                              Additional cleaning or repair may be required.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="defects" className="space-y-6 mt-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Defects and Issues</h3>
                  <Button onClick={addDefect}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Defect
                  </Button>
                </div>

                {defects.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                      <h4 className="font-medium mb-2">No Defects Found</h4>
                      <p className="text-muted-foreground">
                        Item appears to be in good condition with no visible defects.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {defects.map((defect) => (
                      <Card key={defect.id}>
                        <CardContent className="p-4">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">Defect #{defect.id}</h4>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeDefect(defect.id)}
                              >
                                Remove
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <label className="text-sm font-medium">Type</label>
                                <select
                                  value={defect.type}
                                  onChange={(e) => updateDefect(defect.id, { type: e.target.value as DefectType })}
                                  className="w-full mt-1 px-3 py-2 border rounded-md"
                                >
                                  {defectTypes.map((type) => (
                                    <option key={type.type} value={type.type}>
                                      {type.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="text-sm font-medium">Severity</label>
                                <select
                                  value={defect.severity}
                                  onChange={(e) => updateDefect(defect.id, { severity: e.target.value as DefectSeverity })}
                                  className="w-full mt-1 px-3 py-2 border rounded-md"
                                >
                                  {['MINOR', 'MODERATE', 'MAJOR', 'CRITICAL'].map((severity) => (
                                    <option key={severity} value={severity}>
                                      {severity}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="text-sm font-medium">Location on Item</label>
                                <input
                                  type="text"
                                  value={defect.location_on_item}
                                  onChange={(e) => updateDefect(defect.id, { location_on_item: e.target.value })}
                                  placeholder="e.g., Front left corner"
                                  className="w-full mt-1 px-3 py-2 border rounded-md"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-sm font-medium">Description</label>
                              <Textarea
                                value={defect.description}
                                onChange={(e) => updateDefect(defect.id, { description: e.target.value })}
                                placeholder="Describe the defect in detail..."
                                rows={3}
                                className="mt-1"
                              />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={defect.customer_fault}
                                  onChange={(e) => updateDefect(defect.id, { customer_fault: e.target.checked })}
                                  className="rounded"
                                />
                                <label className="text-sm">Customer fault</label>
                              </div>

                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={defect.repair_required}
                                  onChange={(e) => updateDefect(defect.id, { repair_required: e.target.checked })}
                                  className="rounded"
                                />
                                <label className="text-sm">Repair required</label>
                              </div>

                              <div>
                                <label className="text-sm font-medium">Repair Cost (₹)</label>
                                <input
                                  type="number"
                                  value={defect.estimated_repair_cost}
                                  onChange={(e) => updateDefect(defect.id, { estimated_repair_cost: Number(e.target.value) })}
                                  className="w-full mt-1 px-3 py-2 border rounded-md"
                                  min="0"
                                />
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="summary" className="space-y-6 mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle>Inspection Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Condition Grade</div>
                        <div className="flex items-center space-x-2">
                          <Badge className={conditionGrades.find(g => g.grade === preRentalCondition)?.color}>
                            {preRentalCondition}
                          </Badge>
                          <ArrowRight className="h-4 w-4" />
                          <Badge className={conditionGrades.find(g => g.grade === currentCondition)?.color}>
                            {currentCondition}
                          </Badge>
                        </div>
                      </div>

                      <div>
                        <div className="text-sm text-muted-foreground">Photos Captured</div>
                        <div className="font-medium">{postRentalPhotos.length}</div>
                      </div>

                      <div>
                        <div className="text-sm text-muted-foreground">Defects Found</div>
                        <div className="font-medium">{defects.length}</div>
                      </div>

                      <div>
                        <div className="text-sm text-muted-foreground">Recommended Action</div>
                        <Badge variant="outline">{getRecommendedAction().replace('_', ' ')}</Badge>
                      </div>
                    </div>

                    {defects.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Defects Summary</h4>
                        <div className="space-y-2">
                          {defects.map((defect) => (
                            <div key={defect.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                              <span>{defect.type.replace('_', ' ')} - {defect.severity}</span>
                              <span>₹{defect.estimated_repair_cost}</span>
                            </div>
                          ))}
                          <div className="flex justify-between font-medium pt-2 border-t">
                            <span>Total Estimated Repair Cost:</span>
                            <span>₹{defects.reduce((sum, d) => sum + d.estimated_repair_cost, 0)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {getConditionDowngrade() && (
                      <Card className="border-orange-300 bg-orange-50">
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <AlertTriangle className="h-5 w-5 text-orange-600" />
                            <div>
                              <h4 className="font-medium text-orange-800">Action Required</h4>
                              <p className="text-sm text-orange-700">
                                Condition has degraded. Item requires {getRecommendedAction().toLowerCase().replace('_', ' ')} before being returned to inventory.
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
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
          disabled={!canComplete() || isLoading}
        >
          {isLoading ? 'Saving...' : 'Complete Inspection'}
        </Button>
      </div>
    </div>
  );
}