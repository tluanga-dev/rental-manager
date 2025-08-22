'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Camera,
  Package,
  Settings,
  Shield,
  FileText,
  Clock,
  User,
  Check,
  X,
  MinusCircle
} from 'lucide-react';
import { 
  ChecklistItem, 
  ChecklistCategory, 
  ChecklistStatus,
  InspectionType,
  CHECKLIST_TEMPLATES
} from '@/types/inspections';

interface PreRentalChecklistProps {
  itemId: string;
  itemName: string;
  skuCode: string;
  category: string;
  inspectionType: InspectionType;
  onComplete: (checklist: ChecklistItem[], notes: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const categoryIcons = {
  PHYSICAL_CONDITION: Package,
  FUNCTIONAL_TEST: Settings,
  ACCESSORIES: Package,
  PACKAGING: Package,
  DOCUMENTATION: FileText,
  SAFETY_CHECK: Shield,
  CLEANLINESS: AlertTriangle,
  SERIAL_VERIFICATION: FileText,
};

const categoryColors = {
  PHYSICAL_CONDITION: 'text-slate-600',
  FUNCTIONAL_TEST: 'text-green-600',
  ACCESSORIES: 'text-purple-600',
  PACKAGING: 'text-orange-600',
  DOCUMENTATION: 'text-gray-600',
  SAFETY_CHECK: 'text-red-600',
  CLEANLINESS: 'text-yellow-600',
  SERIAL_VERIFICATION: 'text-indigo-600',
};

export function PreRentalChecklist({
  itemId,
  itemName,
  skuCode,
  category,
  inspectionType,
  onComplete,
  onCancel,
  isLoading
}: PreRentalChecklistProps) {
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [notes, setNotes] = useState('');
  const [currentCategory, setCurrentCategory] = useState<ChecklistCategory | 'ALL'>('ALL');
  const [startTime] = useState(new Date());

  useEffect(() => {
    // Initialize checklist based on item category
    const template = CHECKLIST_TEMPLATES[category.toUpperCase()] || CHECKLIST_TEMPLATES.ELECTRONICS;
    
    const items: ChecklistItem[] = template.map((templateItem, index) => ({
      id: `item_${index + 1}`,
      category: templateItem.category,
      item: templateItem.item,
      required: templateItem.required,
      status: 'PENDING' as ChecklistStatus,
      photo_required: templateItem.photo_required || false,
      notes: '',
    }));

    setChecklistItems(items);
  }, [category]);

  const updateChecklistItem = (itemId: string, status: ChecklistStatus, itemNotes?: string) => {
    setChecklistItems(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { ...item, status, notes: itemNotes || item.notes }
          : item
      )
    );
  };

  const getProgress = () => {
    const completedItems = checklistItems.filter(item => 
      item.status === 'PASS' || item.status === 'FAIL' || item.status === 'NOT_APPLICABLE'
    ).length;
    return checklistItems.length > 0 ? (completedItems / checklistItems.length) * 100 : 0;
  };

  const getRequiredItemsStatus = () => {
    const requiredItems = checklistItems.filter(item => item.required);
    const passedRequired = requiredItems.filter(item => item.status === 'PASS').length;
    const failedRequired = requiredItems.filter(item => item.status === 'FAIL').length;
    
    return {
      total: requiredItems.length,
      passed: passedRequired,
      failed: failedRequired,
      pending: requiredItems.length - passedRequired - failedRequired
    };
  };

  const canComplete = () => {
    const requiredItems = checklistItems.filter(item => item.required);
    return requiredItems.every(item => 
      item.status === 'PASS' || item.status === 'FAIL' || item.status === 'NOT_APPLICABLE'
    );
  };

  const getFilteredItems = () => {
    if (currentCategory === 'ALL') return checklistItems;
    return checklistItems.filter(item => item.category === currentCategory);
  };

  const getCategories = () => {
    const categories = Array.from(new Set(checklistItems.map(item => item.category)));
    return categories;
  };

  const getCategoryStatus = (cat: ChecklistCategory) => {
    const categoryItems = checklistItems.filter(item => item.category === cat);
    const completed = categoryItems.filter(item => 
      item.status === 'PASS' || item.status === 'FAIL' || item.status === 'NOT_APPLICABLE'
    ).length;
    
    if (completed === categoryItems.length) return 'complete';
    if (completed > 0) return 'partial';
    return 'pending';
  };

  const handleComplete = () => {
    onComplete(checklistItems, notes);
  };

  const getDuration = () => {
    const now = new Date();
    const diffMs = now.getTime() - startTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    return diffMins;
  };

  const requiredStatus = getRequiredItemsStatus();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Pre-Rental Inspection Checklist</h2>
              <p className="text-muted-foreground">
                {itemName} ({skuCode})
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline">
                {inspectionType.replace('_', ' ')}
              </Badge>
              <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{getDuration()} min</span>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Progress Overview */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-muted-foreground">
                {Math.round(getProgress())}% Complete
              </span>
            </div>
            <Progress value={getProgress()} className="h-2" />
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-2xl font-bold text-slate-600">{requiredStatus.total}</div>
                <div className="text-xs text-slate-600">Total Required</div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{requiredStatus.passed}</div>
                <div className="text-xs text-green-600">Passed</div>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{requiredStatus.failed}</div>
                <div className="text-xs text-red-600">Failed</div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">{requiredStatus.pending}</div>
                <div className="text-xs text-gray-600">Pending</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={currentCategory === 'ALL' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentCategory('ALL')}
            >
              All Categories ({checklistItems.length})
            </Button>
            {getCategories().map((cat) => {
              const Icon = categoryIcons[cat];
              const status = getCategoryStatus(cat);
              const count = checklistItems.filter(item => item.category === cat).length;
              
              return (
                <Button
                  key={cat}
                  variant={currentCategory === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentCategory(cat)}
                  className="flex items-center space-x-1"
                >
                  <Icon className={`h-4 w-4 ${categoryColors[cat]}`} />
                  <span>{cat.replace('_', ' ')} ({count})</span>
                  {status === 'complete' && <CheckCircle className="h-3 w-3 text-green-500" />}
                  {status === 'partial' && <AlertTriangle className="h-3 w-3 text-yellow-500" />}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Checklist Items */}
      <div className="space-y-4">
        {getFilteredItems().map((item) => {
          const Icon = categoryIcons[item.category];
          
          return (
            <Card key={item.id} className={`${
              item.required && item.status === 'FAIL' ? 'border-red-300 bg-red-50' :
              item.status === 'PASS' ? 'border-green-300 bg-green-50' :
              'border-gray-200'
            }`}>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Icon className={`h-4 w-4 ${categoryColors[item.category]}`} />
                        <Badge variant="outline" className="text-xs">
                          {item.category.replace('_', ' ')}
                        </Badge>
                        {item.required && (
                          <Badge variant="destructive" className="text-xs">
                            Required
                          </Badge>
                        )}
                        {item.photo_required && (
                          <Badge variant="secondary" className="text-xs">
                            <Camera className="h-3 w-3 mr-1" />
                            Photo
                          </Badge>
                        )}
                      </div>
                      
                      <h4 className="font-medium">{item.item}</h4>
                      
                      {item.status !== 'PENDING' && (
                        <div className="mt-2">
                          <Badge 
                            className={
                              item.status === 'PASS' ? 'bg-green-100 text-green-800' :
                              item.status === 'FAIL' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }
                          >
                            {item.status === 'PASS' ? 'PASSED' :
                             item.status === 'FAIL' ? 'FAILED' :
                             'NOT APPLICABLE'}
                          </Badge>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button
                        variant={item.status === 'PASS' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateChecklistItem(item.id, 'PASS')}
                        className={item.status === 'PASS' ? 'bg-green-600 hover:bg-green-700' : ''}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        variant={item.status === 'FAIL' ? 'destructive' : 'outline'}
                        size="sm"
                        onClick={() => updateChecklistItem(item.id, 'FAIL')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        variant={item.status === 'NOT_APPLICABLE' ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => updateChecklistItem(item.id, 'NOT_APPLICABLE')}
                      >
                        <MinusCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {(item.status === 'FAIL' || item.notes) && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        {item.status === 'FAIL' ? 'Issue Description' : 'Notes'}
                      </label>
                      <Textarea
                        value={item.notes || ''}
                        onChange={(e) => updateChecklistItem(item.id, item.status, e.target.value)}
                        placeholder={
                          item.status === 'FAIL' 
                            ? 'Describe the issue in detail...' 
                            : 'Add any additional notes...'
                        }
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                  )}

                  {item.photo_required && (
                    <div className="p-3 border-2 border-dashed border-gray-300 rounded-lg text-center">
                      <Camera className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-muted-foreground">
                        Photo documentation required for this item
                      </p>
                      <Button variant="outline" size="sm" className="mt-2">
                        <Camera className="h-4 w-4 mr-2" />
                        Take Photo
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Additional Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Inspector Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any general observations, concerns, or recommendations about this item..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Summary Alert */}
      {requiredStatus.failed > 0 && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <h4 className="font-medium text-red-800">Critical Issues Found</h4>
                <p className="text-sm text-red-700">
                  {requiredStatus.failed} required item(s) failed inspection. 
                  This item may not be suitable for rental until issues are resolved.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end space-x-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          onClick={handleComplete}
          disabled={!canComplete() || isLoading}
          className={requiredStatus.failed > 0 ? 'bg-red-600 hover:bg-red-700' : ''}
        >
          {isLoading ? 'Saving...' : requiredStatus.failed > 0 ? 'Complete with Issues' : 'Complete Checklist'}
        </Button>
      </div>
    </div>
  );
}