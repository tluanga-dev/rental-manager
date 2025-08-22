'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Database,
  Plus,
  ArrowLeft,
  Loader2,
  Download,
  Play,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
  Search,
} from 'lucide-react';

import { useBackupStore } from '@/stores/system-store';
import { useAuthStore } from '@/stores/auth-store';
import { BACKUP_TYPES, BACKUP_STATUSES } from '@/types/system';
import type { BackupType, BackupStatus } from '@/types/system';

const createBackupSchema = z.object({
  backup_name: z.string().min(1, 'Backup name is required').max(255, 'Backup name is too long'),
  backup_type: z.enum(['FULL', 'INCREMENTAL', 'DIFFERENTIAL']),
  description: z.string().optional(),
  retention_days: z.string().min(1, 'Retention period is required'),
});

type CreateBackupForm = z.infer<typeof createBackupSchema>;

const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  RUNNING: 'bg-slate-100 text-slate-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
};

const statusIcons = {
  PENDING: Clock,
  RUNNING: Loader2,
  COMPLETED: CheckCircle,
  FAILED: XCircle,
  CANCELLED: AlertCircle,
};

function BackupManagementContent() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<BackupStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<BackupType | 'ALL'>('ALL');

  const {
    backups,
    loading,
    error,
    filters,
    setFilters,
    loadBackups,
    createBackup,
    startBackup,
    clearError,
  } = useBackupStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<CreateBackupForm>({
    resolver: zodResolver(createBackupSchema),
    defaultValues: {
      backup_name: '',
      backup_type: 'FULL',
      description: '',
      retention_days: '30',
    },
  });

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  useEffect(() => {
    if (error) {
      toast({
        title: 'Error',
        description: error,
        variant: 'destructive',
      });
      clearError();
    }
  }, [error, toast, clearError]);

  const filteredBackups = (backups || []).filter(backup => {
    const matchesSearch = backup?.backup_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         backup?.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || backup?.backup_status === statusFilter;
    const matchesType = typeFilter === 'ALL' || backup?.backup_type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const onSubmit = async (data: CreateBackupForm) => {
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'User not authenticated',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createBackup(data, user.id);
      toast({
        title: 'Success',
        description: 'Backup created successfully',
      });
      setShowCreateDialog(false);
      reset();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create backup',
        variant: 'destructive',
      });
    }
  };

  const handleStartBackup = async (backupId: string) => {
    try {
      await startBackup(backupId);
      toast({
        title: 'Success',
        description: 'Backup started successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start backup',
        variant: 'destructive',
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: BackupStatus) => {
    const Icon = statusIcons[status];
    return <Icon className={`h-4 w-4 ${status === 'RUNNING' ? 'animate-spin' : ''}`} />;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/settings')}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Settings
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Backup Management</h1>
            <p className="text-gray-600">
              Create and manage system backups for data protection
            </p>
          </div>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Backup
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Backup</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="backup_name">Backup Name</Label>
                <Input
                  id="backup_name"
                  {...register('backup_name')}
                  placeholder="Enter backup name"
                  className={errors.backup_name ? 'border-red-500' : ''}
                />
                {errors.backup_name && (
                  <p className="text-sm text-red-500">{errors.backup_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="backup_type">Backup Type</Label>
                <Select onValueChange={(value) => setValue('backup_type', value as BackupType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select backup type" />
                  </SelectTrigger>
                  <SelectContent>
                    {BACKUP_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.backup_type && (
                  <p className="text-sm text-red-500">{errors.backup_type.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="retention_days">Retention Period (Days)</Label>
                <Input
                  id="retention_days"
                  type="number"
                  {...register('retention_days')}
                  placeholder="30"
                  className={errors.retention_days ? 'border-red-500' : ''}
                />
                {errors.retention_days && (
                  <p className="text-sm text-red-500">{errors.retention_days.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  {...register('description')}
                  placeholder="Enter backup description"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Backup</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Backup History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search backups..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as BackupStatus | 'ALL')}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                {BACKUP_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as BackupType | 'ALL')}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                {BACKUP_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
            </div>
          ) : filteredBackups.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm || statusFilter !== 'ALL' || typeFilter !== 'ALL' 
                ? 'No backups found matching your criteria.'
                : 'No backups available. Create your first backup to get started.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Retention</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBackups.map((backup) => (
                    <TableRow key={backup.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{backup.backup_name}</p>
                          {backup.description && (
                            <p className="text-sm text-gray-500">{backup.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{backup.backup_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(backup.backup_status)}
                          <Badge className={statusColors[backup.backup_status]}>
                            {backup.backup_status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {backup.backup_size ? formatFileSize(backup.backup_size) : '-'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(backup.started_at), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        {backup.completed_at 
                          ? format(new Date(backup.completed_at), 'MMM d, yyyy HH:mm')
                          : '-'}
                      </TableCell>
                      <TableCell>{backup.retention_days} days</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {backup.backup_status === 'PENDING' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStartBackup(backup.id)}
                            >
                              <Play className="h-3 w-3 mr-1" />
                              Start
                            </Button>
                          )}
                          {backup.backup_status === 'COMPLETED' && backup.backup_path && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Handle download logic here
                                toast({
                                  title: 'Download',
                                  description: 'Backup download started',
                                });
                              }}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backup Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Backups</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{backups.length}</div>
            <p className="text-xs text-muted-foreground">All backup records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {(backups || []).filter(b => b?.backup_status === 'COMPLETED').length}
            </div>
            <p className="text-xs text-muted-foreground">Successful backups</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {(backups || []).filter(b => b?.backup_status === 'FAILED').length}
            </div>
            <p className="text-xs text-muted-foreground">Failed backups</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <Loader2 className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-600">
              {(backups || []).filter(b => b?.backup_status === 'RUNNING').length}
            </div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function BackupManagementPage() {
  return (
    <ProtectedRoute requiredPermissions={['SYSTEM_CONFIG']}>
      <BackupManagementContent />
    </ProtectedRoute>
  );
}