'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  Settings,
  Clock,
  Database,
  Save,
  RotateCcw,
  AlertCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';

import { systemApi } from '@/services/api/system';
import { useAuthStore } from '@/stores/auth-store';

interface RentalStatusSettingsProps {
  className?: string;
}

interface RentalStatusSettingsData {
  enabled: boolean;
  checkTime: string;
  retentionDays: number;
  timezone: string;
}

const RentalStatusSettings: React.FC<RentalStatusSettingsProps> = ({ className }) => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<RentalStatusSettingsData>({
    enabled: false,
    checkTime: '00:00',
    retentionDays: 365,
    timezone: 'UTC',
  });
  const [originalSettings, setOriginalSettings] = useState<RentalStatusSettingsData | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Load settings on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await systemApi.getRentalStatusSettings();
      
      const loadedSettings = {
        enabled: data.rental_status_check_enabled === 'true',
        checkTime: data.rental_status_check_time,
        retentionDays: parseInt(data.rental_status_log_retention_days),
        timezone: data.task_scheduler_timezone,
      };
      
      setSettings(loadedSettings);
      setOriginalSettings(loadedSettings);
    } catch (error) {
      console.error('Failed to load rental status settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const validateSettings = (settingsToValidate: RentalStatusSettingsData): boolean => {
    const validation = systemApi.validateRentalStatusSettings(settingsToValidate);
    setValidationErrors(validation.errors);
    return validation.isValid;
  };

  const handleSave = async () => {
    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    if (!validateSettings(settings)) {
      toast.error('Please fix validation errors before saving');
      return;
    }

    try {
      setSaving(true);
      await systemApi.updateRentalStatusSettings(settings, user.id);
      setOriginalSettings({ ...settings });
      toast.success('Rental status settings updated successfully');
    } catch (error) {
      console.error('Failed to update rental status settings:', error);
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (originalSettings) {
      setSettings({ ...originalSettings });
      setValidationErrors([]);
      toast.info('Settings reset to last saved values');
    }
  };

  const hasChanges = originalSettings && JSON.stringify(settings) !== JSON.stringify(originalSettings);

  const timezones = systemApi.getAvailableTimezones();

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading rental status settings...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Rental Status Configuration
        </CardTitle>
        <CardDescription>
          Configure automated rental status checking behavior and scheduling
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {validationErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Enable/Disable Automated Checks */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Enable Automated Status Checks</Label>
              <p className="text-sm text-muted-foreground">
                Automatically update overdue rental statuses daily at the scheduled time
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, enabled: checked }))
              }
            />
          </div>

          <Separator />

          {/* Check Time Configuration */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Daily Status Check Time
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Time (24-hour format)</Label>
                <Input
                  type="time"
                  value={settings.checkTime}
                  onChange={(e) => 
                    setSettings(prev => ({ ...prev, checkTime: e.target.value }))
                  }
                  disabled={!settings.enabled}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Timezone</Label>
                <Select
                  value={settings.timezone}
                  onValueChange={(value) =>
                    setSettings(prev => ({ ...prev, timezone: value }))
                  }
                  disabled={!settings.enabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map(tz => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Daily time when the system will check for overdue rentals and update statuses
            </p>
          </div>

          <Separator />

          {/* Log Retention Configuration */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Status History Retention
            </Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                value={settings.retentionDays}
                onChange={(e) =>
                  setSettings(prev => ({ 
                    ...prev, 
                    retentionDays: parseInt(e.target.value) || 365 
                  }))
                }
                min={30}
                max={3650}
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
            <p className="text-xs text-muted-foreground">
              How long to keep rental status change history (minimum 30 days, maximum 10 years)
            </p>
          </div>
        </div>

        {/* Current Configuration Summary */}
        <div className="p-4 bg-muted/50 rounded-lg space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Current Configuration
          </h4>
          <div className="text-sm space-y-1">
            <p>
              <span className="font-medium">Status:</span>{' '}
              {settings.enabled ? (
                <span className="text-green-600">Enabled</span>
              ) : (
                <span className="text-orange-600">Disabled</span>
              )}
            </p>
            {settings.enabled && (
              <>
                <p>
                  <span className="font-medium">Check Time:</span>{' '}
                  {settings.checkTime} ({settings.timezone})
                </p>
                <p>
                  <span className="font-medium">History Retention:</span>{' '}
                  {settings.retentionDays} days
                </p>
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges || saving}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset Changes
          </Button>
          
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving || validationErrors.length > 0}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default RentalStatusSettings;