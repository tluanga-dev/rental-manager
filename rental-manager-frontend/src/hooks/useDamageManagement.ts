// Custom hook for damage management functionality
import { useState, useEffect, useCallback } from 'react';
import { 
  DamageSummary, 
  RepairOrder, 
  DamageAssessment,
  RepairStatus,
  DamageSeverity 
} from '../types/rental-return-enhanced';

interface UseDamageManagementReturn {
  summary: DamageSummary | null;
  repairQueue: RepairOrder[] | null;
  recentAssessments: DamageAssessment[] | null;
  loading: boolean;
  error: string | null;
  refreshData: () => void;
  createAssessment: (assessment: Partial<DamageAssessment>) => Promise<void>;
  createRepairOrder: (assessmentId: string, vendorId?: string) => Promise<void>;
  completeRepair: (repairOrderId: string, cost: number, invoice?: string) => Promise<void>;
  performQualityCheck: (repairOrderId: string, passed: boolean, notes?: string) => Promise<void>;
  writeOffItem: (assessmentId: string, reason: string) => Promise<void>;
}

export function useDamageManagement(): UseDamageManagementReturn {
  const [summary, setSummary] = useState<DamageSummary | null>(null);
  const [repairQueue, setRepairQueue] = useState<RepairOrder[] | null>(null);
  const [recentAssessments, setRecentAssessments] = useState<DamageAssessment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch damage summary
  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch('/api/inventory/damage/summary', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch damage summary');
      
      const data = await response.json();
      setSummary(data);
    } catch (err) {
      console.error('Error fetching damage summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch damage summary');
    }
  }, []);

  // Fetch repair queue
  const fetchRepairQueue = useCallback(async () => {
    try {
      const response = await fetch('/api/inventory/damage/repair-queue', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch repair queue');
      
      const data = await response.json();
      setRepairQueue(data);
    } catch (err) {
      console.error('Error fetching repair queue:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch repair queue');
    }
  }, []);

  // Fetch recent assessments
  const fetchRecentAssessments = useCallback(async () => {
    try {
      const response = await fetch('/api/inventory/damage/assessments?limit=10', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch assessments');
      
      const data = await response.json();
      setRecentAssessments(data.items);
    } catch (err) {
      console.error('Error fetching assessments:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch assessments');
    }
  }, []);

  // Refresh all data
  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    await Promise.all([
      fetchSummary(),
      fetchRepairQueue(),
      fetchRecentAssessments()
    ]);
    
    setLoading(false);
  }, [fetchSummary, fetchRepairQueue, fetchRecentAssessments]);

  // Create damage assessment
  const createAssessment = useCallback(async (assessment: Partial<DamageAssessment>) => {
    try {
      const response = await fetch('/api/inventory/damage/assessments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(assessment),
      });
      
      if (!response.ok) throw new Error('Failed to create assessment');
      
      await refreshData();
    } catch (err) {
      console.error('Error creating assessment:', err);
      throw err;
    }
  }, [refreshData]);

  // Create repair order
  const createRepairOrder = useCallback(async (assessmentId: string, vendorId?: string) => {
    try {
      const response = await fetch('/api/inventory/damage/repair-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          damage_assessment_id: assessmentId,
          repair_vendor_id: vendorId,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to create repair order');
      
      await refreshData();
    } catch (err) {
      console.error('Error creating repair order:', err);
      throw err;
    }
  }, [refreshData]);

  // Complete repair
  const completeRepair = useCallback(async (
    repairOrderId: string, 
    cost: number, 
    invoice?: string
  ) => {
    try {
      const response = await fetch(`/api/inventory/damage/repair-orders/${repairOrderId}/complete`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          repair_cost: cost,
          invoice_number: invoice,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to complete repair');
      
      await refreshData();
    } catch (err) {
      console.error('Error completing repair:', err);
      throw err;
    }
  }, [refreshData]);

  // Perform quality check
  const performQualityCheck = useCallback(async (
    repairOrderId: string,
    passed: boolean,
    notes?: string
  ) => {
    try {
      const response = await fetch(`/api/inventory/damage/repair-orders/${repairOrderId}/quality-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          passed,
          notes,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to perform quality check');
      
      await refreshData();
    } catch (err) {
      console.error('Error performing quality check:', err);
      throw err;
    }
  }, [refreshData]);

  // Write off item
  const writeOffItem = useCallback(async (assessmentId: string, reason: string) => {
    try {
      const response = await fetch(`/api/inventory/damage/write-off/${assessmentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ reason }),
      });
      
      if (!response.ok) throw new Error('Failed to write off item');
      
      await refreshData();
    } catch (err) {
      console.error('Error writing off item:', err);
      throw err;
    }
  }, [refreshData]);

  // Initial load
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return {
    summary,
    repairQueue,
    recentAssessments,
    loading,
    error,
    refreshData,
    createAssessment,
    createRepairOrder,
    completeRepair,
    performQualityCheck,
    writeOffItem,
  };
}