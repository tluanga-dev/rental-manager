'use client';

import React, { useState, useRef } from 'react';
import {
  Camera,
  X,
  AlertTriangle,
  Plus,
  Trash2,
  Check,
  Upload,
  DollarSign,
  FileText,
  Image as ImageIcon
} from 'lucide-react';

interface DamageType {
  id: string;
  name: string;
  severity: 'minor' | 'moderate' | 'severe' | 'total_loss';
  defaultFee: number;
}

interface DamagePhoto {
  id: string;
  file: File | null;
  preview: string;
  description: string;
}

interface DamageAssessment {
  itemId: string;
  itemName: string;
  damageType: DamageType | null;
  customFee: number;
  photos: DamagePhoto[];
  description: string;
  assessedBy: string;
  assessmentDate: string;
}

interface DamageAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (assessment: DamageAssessment) => void;
  item: {
    id: string;
    name: string;
    sku: string;
    quantity: number;
    rental_price: number;
  };
  existingAssessment?: DamageAssessment;
}

const DAMAGE_TYPES: DamageType[] = [
  { id: 'scratch', name: 'Scratch/Scuff', severity: 'minor', defaultFee: 50 },
  { id: 'dent', name: 'Dent', severity: 'minor', defaultFee: 100 },
  { id: 'crack', name: 'Crack', severity: 'moderate', defaultFee: 200 },
  { id: 'broken_part', name: 'Broken Part', severity: 'moderate', defaultFee: 300 },
  { id: 'malfunction', name: 'Malfunction', severity: 'severe', defaultFee: 500 },
  { id: 'major_damage', name: 'Major Damage', severity: 'severe', defaultFee: 1000 },
  { id: 'beyond_repair', name: 'Beyond Repair', severity: 'total_loss', defaultFee: 0 },
  { id: 'lost', name: 'Lost/Missing', severity: 'total_loss', defaultFee: 0 }
];

export function DamageAssessmentModal({
  isOpen,
  onClose,
  onSave,
  item,
  existingAssessment
}: DamageAssessmentModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedDamageType, setSelectedDamageType] = useState<DamageType | null>(
    existingAssessment?.damageType || null
  );
  const [customFee, setCustomFee] = useState<number>(
    existingAssessment?.customFee || 0
  );
  const [photos, setPhotos] = useState<DamagePhoto[]>(
    existingAssessment?.photos || []
  );
  const [description, setDescription] = useState(
    existingAssessment?.description || ''
  );
  const [autoCalculateFee, setAutoCalculateFee] = useState(true);

  if (!isOpen) return null;

  const handleDamageTypeSelect = (damageType: DamageType) => {
    setSelectedDamageType(damageType);
    
    if (autoCalculateFee) {
      // For total loss, calculate based on item value
      if (damageType.severity === 'total_loss') {
        setCustomFee(item.rental_price * 10); // Assume 10x rental price as replacement cost
      } else {
        setCustomFee(damageType.defaultFee);
      }
    }
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newPhotos: DamagePhoto[] = [];
    
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const photo: DamagePhoto = {
          id: `photo-${Date.now()}-${Math.random()}`,
          file: file,
          preview: reader.result as string,
          description: ''
        };
        setPhotos(prev => [...prev, photo]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (photoId: string) => {
    setPhotos(photos.filter(p => p.id !== photoId));
  };

  const updatePhotoDescription = (photoId: string, description: string) => {
    setPhotos(photos.map(p => 
      p.id === photoId ? { ...p, description } : p
    ));
  };

  const handleSave = () => {
    if (!selectedDamageType) {
      alert('Please select a damage type');
      return;
    }

    const assessment: DamageAssessment = {
      itemId: item.id,
      itemName: item.name,
      damageType: selectedDamageType,
      customFee: customFee,
      photos: photos,
      description: description,
      assessedBy: 'current_user', // This should come from auth context
      assessmentDate: new Date().toISOString()
    };

    onSave(assessment);
    onClose();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'minor': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'moderate': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'severe': return 'bg-red-100 text-red-800 border-red-300';
      case 'total_loss': return 'bg-gray-900 text-white border-gray-700';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'minor': return '⚠️';
      case 'moderate': return '🔶';
      case 'severe': return '🔴';
      case 'total_loss': return '💀';
      default: return '❓';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6" />
              <h2 className="text-xl font-bold">Damage Assessment</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Item Info */}
          <div className="p-6 bg-gray-50 border-b">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">{item.name}</h3>
                <p className="text-sm text-gray-600">SKU: {item.sku}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Rental Price</p>
                <p className="text-lg font-semibold">₹{item.rental_price}/day</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Damage Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Damage Type
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {DAMAGE_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => handleDamageTypeSelect(type)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedDamageType?.id === type.id
                        ? 'ring-2 ring-offset-2 ring-orange-500'
                        : 'hover:shadow-md'
                    } ${getSeverityColor(type.severity)}`}
                  >
                    <div className="text-2xl mb-1">{getSeverityIcon(type.severity)}</div>
                    <div className="font-medium text-sm">{type.name}</div>
                    <div className="text-xs mt-1">
                      Default: ₹{type.defaultFee || 'Market Value'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Damage Fee */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Damage Fee
              </label>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="number"
                      value={customFee}
                      onChange={(e) => {
                        setCustomFee(Number(e.target.value));
                        setAutoCalculateFee(false);
                      }}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      placeholder="Enter damage fee"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoCalculateFee}
                    onChange={(e) => setAutoCalculateFee(e.target.checked)}
                    className="rounded text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-600">Auto-calculate</span>
                </label>
              </div>
              {selectedDamageType?.severity === 'total_loss' && (
                <p className="mt-2 text-sm text-gray-600">
                  💡 Total loss fee is calculated as replacement cost (10x rental price)
                </p>
              )}
            </div>

            {/* Photo Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Damage Photos
              </label>
              
              <div className="grid grid-cols-3 gap-4">
                {/* Upload Button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square border-2 border-dashed border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-colors flex flex-col items-center justify-center gap-2"
                >
                  <Camera className="w-8 h-8 text-gray-400" />
                  <span className="text-sm text-gray-600">Add Photos</span>
                </button>
                
                {/* Photo Previews */}
                {photos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <img
                      src={photo.preview}
                      alt="Damage"
                      className="w-full aspect-square object-cover rounded-lg"
                    />
                    <button
                      onClick={() => removePhoto(photo.id)}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <input
                      type="text"
                      placeholder="Description..."
                      value={photo.description}
                      onChange={(e) => updatePhotoDescription(photo.id, e.target.value)}
                      className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/50 text-white text-xs placeholder-gray-300 focus:bg-black/70 outline-none"
                    />
                  </div>
                ))}
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Damage Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Describe the damage in detail..."
              />
            </div>

            {/* Assessment Summary */}
            {selectedDamageType && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="font-semibold text-orange-900 mb-2">Assessment Summary</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Damage Type:</span>
                    <span className="font-medium">{selectedDamageType.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Severity:</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(selectedDamageType.severity)}`}>
                      {selectedDamageType.severity.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Damage Fee:</span>
                    <span className="font-bold text-orange-900">₹{customFee}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Photos:</span>
                    <span className="font-medium">{photos.length} attached</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {selectedDamageType ? (
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  Assessment ready to save
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  Please select damage type
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!selectedDamageType}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedDamageType
                    ? 'bg-orange-600 text-white hover:bg-orange-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Save Assessment
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}