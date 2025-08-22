'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { 
  Camera, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Smartphone, 
  Wifi, 
  WifiOff,
  Upload,
  Download,
  AlertTriangle,
  Check,
  X,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';
import { 
  InspectionItem, 
  InspectionReport, 
  ChecklistItem, 
  InspectionPhoto, 
  MobileInspectionState,
  PhotoAngle,
  ChecklistStatus,
  InspectionType,
  INSPECTION_CONFIG
} from '@/types/inspections';

interface MobileInspectionAppProps {
  inspectionItem: InspectionItem;
  onComplete: (report: InspectionReport) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function MobileInspectionApp({
  inspectionItem,
  onComplete,
  onCancel,
  isLoading
}: MobileInspectionAppProps) {
  const [inspectionState, setInspectionState] = useState<MobileInspectionState>({
    current_inspection: inspectionItem,
    photos_captured: [],
    checklist_progress: {},
    defects_found: [],
    inspection_start_time: new Date().toISOString(),
    offline_mode: !navigator.onLine,
    sync_pending: false,
  });

  const [currentView, setCurrentView] = useState<'overview' | 'checklist' | 'photos' | 'defects' | 'review'>('overview');
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [selectedPhotoAngle, setSelectedPhotoAngle] = useState<PhotoAngle>('FRONT');

  // Timer functionality
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning]);

  // Online/offline status
  useEffect(() => {
    const handleOnline = () => setInspectionState(prev => ({ ...prev, offline_mode: false }));
    const handleOffline = () => setInspectionState(prev => ({ ...prev, offline_mode: true }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgress = () => {
    const requiredPhotos = (INSPECTION_CONFIG.REQUIRED_PHOTOS as any)[inspectionItem.inspection_type] || [];
    const photosProgress = (inspectionState.photos_captured.length / requiredPhotos.length) * 50;
    
    const checklistItems = getChecklistItems();
    const completedItems = Object.values(inspectionState.checklist_progress).filter(
      status => status === 'PASS' || status === 'FAIL'
    ).length;
    const checklistProgress = checklistItems.length > 0 ? (completedItems / checklistItems.length) * 50 : 50;
    
    return Math.min(photosProgress + checklistProgress, 100);
  };

  const getChecklistItems = (): ChecklistItem[] => {
    // Mock checklist based on inspection type
    const baseItems = [
      {
        id: '1',
        category: 'PHYSICAL_CONDITION' as const,
        item: 'No visible damage to housing',
        required: true,
        status: 'PENDING' as ChecklistStatus,
        photo_required: false,
      },
      {
        id: '2',
        category: 'FUNCTIONAL_TEST' as const,
        item: 'Powers on correctly',
        required: true,
        status: 'PENDING' as ChecklistStatus,
        photo_required: false,
      },
      {
        id: '3',
        category: 'ACCESSORIES' as const,
        item: 'All accessories present',
        required: true,
        status: 'PENDING' as ChecklistStatus,
        photo_required: true,
      },
      {
        id: '4',
        category: 'SERIAL_VERIFICATION' as const,
        item: 'Serial number matches records',
        required: true,
        status: 'PENDING' as ChecklistStatus,
        photo_required: true,
      },
    ];

    return baseItems.map(item => ({
      ...item,
      status: inspectionState.checklist_progress[item.id] || 'PENDING'
    }));
  };

  const updateChecklistItem = (itemId: string, status: ChecklistStatus, notes?: string) => {
    setInspectionState(prev => ({
      ...prev,
      checklist_progress: {
        ...prev.checklist_progress,
        [itemId]: status
      }
    }));
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Camera access denied. Please enable camera permissions.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const photo: InspectionPhoto = {
          id: Date.now().toString(),
          photo_url: URL.createObjectURL(blob),
          angle: selectedPhotoAngle,
          description: `${selectedPhotoAngle} view of ${inspectionItem.item_name}`,
          required: true,
          timestamp: new Date().toISOString(),
          metadata: {
            device_info: navigator.userAgent,
            file_size: blob.size,
            resolution: `${canvas.width}x${canvas.height}`,
          }
        };

        setInspectionState(prev => ({
          ...prev,
          photos_captured: [...prev.photos_captured, photo]
        }));

        stopCamera();
      }
    }, 'image/jpeg', 0.9);
  };

  const removePhoto = (photoId: string) => {
    setInspectionState(prev => ({
      ...prev,
      photos_captured: prev.photos_captured.filter(p => p.id !== photoId)
    }));
  };

  const handleComplete = () => {
    const report: InspectionReport = {
      id: Date.now().toString(),
      inspection_item_id: inspectionItem.id,
      inspector_id: 'current_user', // Should come from auth
      inspection_date: new Date().toISOString(),
      inspection_type: inspectionItem.inspection_type,
      overall_condition: 'B', // Would be determined from checklist
      checklist_items: getChecklistItems(),
      photos: inspectionState.photos_captured,
      defects: inspectionState.defects_found,
      recommended_actions: ['RETURN_TO_INVENTORY'],
      inspector_signature: 'digital_signature',
      completion_time: timer / 60, // Convert to minutes
      notes: '',
    };

    onComplete(report);
  };

  const canComplete = () => {
    const requiredPhotos = (INSPECTION_CONFIG.REQUIRED_PHOTOS as any)[inspectionItem.inspection_type] || [];
    const hasAllPhotos = requiredPhotos.every((angle: any) => 
      inspectionState.photos_captured.some((photo: any) => photo.angle === angle)
    );
    
    const checklistItems = getChecklistItems();
    const allChecklistComplete = checklistItems.every(item => 
      !item.required || inspectionState.checklist_progress[item.id]
    );

    return hasAllPhotos && allChecklistComplete;
  };

  const requiredPhotos = (INSPECTION_CONFIG.REQUIRED_PHOTOS as any)[inspectionItem.inspection_type] || [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Mobile Inspection</h1>
            <p className="text-sm text-muted-foreground">
              {inspectionItem.item_name} ({inspectionItem.sku_code})
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {inspectionState.offline_mode ? (
              <WifiOff className="h-5 w-5 text-red-500" />
            ) : (
              <Wifi className="h-5 w-5 text-green-500" />
            )}
            <Badge variant={inspectionState.offline_mode ? 'destructive' : 'default'}>
              {inspectionState.offline_mode ? 'Offline' : 'Online'}
            </Badge>
          </div>
        </div>

        {/* Progress and Timer */}
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress: {Math.round(getProgress())}%</span>
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>{formatTime(timer)}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsTimerRunning(!isTimerRunning)}
              >
                {isTimerRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <Progress value={getProgress()} className="h-2" />
        </div>

        {/* Navigation */}
        <div className="mt-4 flex space-x-2 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'checklist', label: 'Checklist' },
            { id: 'photos', label: 'Photos' },
            { id: 'defects', label: 'Defects' },
            { id: 'review', label: 'Review' },
          ].map((view) => (
            <Button
              key={view.id}
              variant={currentView === view.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentView(view.id as any)}
              className="whitespace-nowrap"
            >
              {view.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4">
        {currentView === 'overview' && (
          <Card>
            <CardHeader>
              <CardTitle>Inspection Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Type</div>
                  <div className="font-medium">{inspectionItem.inspection_type.replace('_', ' ')}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Priority</div>
                  <Badge variant={inspectionItem.priority === 'URGENT' ? 'destructive' : 'default'}>
                    {inspectionItem.priority}
                  </Badge>
                </div>
                <div>
                  <div className="text-muted-foreground">Location</div>
                  <div className="font-medium">{inspectionItem.location_id}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Serial Number</div>
                  <div className="font-medium">{inspectionItem.serial_number || 'N/A'}</div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Required Actions</h4>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Complete inspection checklist</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Camera className="h-4 w-4 text-slate-500" />
                    <span className="text-sm">Capture {requiredPhotos.length} required photos</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <span className="text-sm">Document any defects found</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-sm text-slate-800">
                  <strong>Mobile Tip:</strong> Ensure good lighting and stable hands for quality photos. 
                  You can work offline - data will sync when connection is restored.
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentView === 'checklist' && (
          <div className="space-y-4">
            {getChecklistItems().map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {item.category.replace('_', ' ')}
                        </Badge>
                        {item.required && (
                          <Badge variant="destructive" className="text-xs">Required</Badge>
                        )}
                      </div>
                      <p className="font-medium">{item.item}</p>
                      {item.photo_required && (
                        <p className="text-xs text-muted-foreground mt-1">
                          📷 Photo required
                        </p>
                      )}
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        variant={item.status === 'PASS' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateChecklistItem(item.id, 'PASS')}
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
                    </div>
                  </div>
                  
                  {item.status === 'FAIL' && (
                    <div className="mt-3">
                      <Textarea
                        placeholder="Describe the issue..."
                        className="text-sm"
                        rows={2}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {currentView === 'photos' && (
          <div className="space-y-4">
            {/* Camera View */}
            {isCameraActive && (
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    <div className="relative">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-64 object-cover rounded-lg bg-black"
                      />
                      <canvas ref={canvasRef} className="hidden" />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <select
                        value={selectedPhotoAngle}
                        onChange={(e) => setSelectedPhotoAngle(e.target.value as PhotoAngle)}
                        className="px-3 py-2 border rounded-md"
                      >
                        {requiredPhotos.map((angle: any) => (
                          <option key={angle} value={angle}>
                            {angle.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                      
                      <div className="flex space-x-2">
                        <Button variant="outline" onClick={stopCamera}>
                          Cancel
                        </Button>
                        <Button onClick={capturePhoto}>
                          <Camera className="h-4 w-4 mr-2" />
                          Capture
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Photo Requirements */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Required Photos ({inspectionState.photos_captured.length}/{requiredPhotos.length})
                  {!isCameraActive && (
                    <Button onClick={startCamera}>
                      <Camera className="h-4 w-4 mr-2" />
                      Start Camera
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {requiredPhotos.map((angle: any) => {
                    const photo = inspectionState.photos_captured.find(p => p.angle === angle);
                    return (
                      <div
                        key={angle}
                        className={`aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center p-2 ${
                          photo ? 'border-green-500 bg-green-50' : 'border-gray-300'
                        }`}
                      >
                        {photo ? (
                          <div className="relative w-full h-full">
                            <img
                              src={photo.photo_url}
                              alt={angle}
                              className="w-full h-full object-cover rounded"
                            />
                            <Button
                              variant="destructive"
                              size="sm"
                              className="absolute top-1 right-1"
                              onClick={() => removePhoto(photo.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Camera className="h-8 w-8 text-gray-400 mb-2" />
                            <span className="text-xs text-gray-600">
                              {angle.replace('_', ' ')}
                            </span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {currentView === 'defects' && (
          <Card>
            <CardHeader>
              <CardTitle>Defects Found ({inspectionState.defects_found.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {inspectionState.defects_found.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>No defects found</p>
                  <p className="text-sm">This item appears to be in good condition</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {inspectionState.defects_found.map((defect) => (
                    <div key={defect.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">{defect.type}</Badge>
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
                      <p className="text-sm">{defect.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {currentView === 'review' && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Inspection Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Duration</div>
                    <div className="font-medium">{formatTime(timer)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Photos Captured</div>
                    <div className="font-medium">{inspectionState.photos_captured.length}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Checklist Items</div>
                    <div className="font-medium">
                      {Object.values(inspectionState.checklist_progress).filter(s => s === 'PASS').length} Pass, {' '}
                      {Object.values(inspectionState.checklist_progress).filter(s => s === 'FAIL').length} Fail
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Defects Found</div>
                    <div className="font-medium">{inspectionState.defects_found.length}</div>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">Final Notes</h4>
                  <Textarea
                    placeholder="Add any additional notes about this inspection..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="bg-white border-t p-4 space-y-3">
        {inspectionState.offline_mode && (
          <div className="flex items-center space-x-2 text-sm text-orange-600">
            <WifiOff className="h-4 w-4" />
            <span>Working offline. Data will sync when online.</span>
          </div>
        )}
        
        <div className="flex space-x-3">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button 
            onClick={handleComplete} 
            disabled={!canComplete() || isLoading}
            className="flex-1"
          >
            {isLoading ? 'Saving...' : 'Complete Inspection'}
          </Button>
        </div>
      </div>
    </div>
  );
}