'use client';

import { useParams, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { SaleDetailView } from '@/components/sales/SaleDetailView';
import { useSaleWithLines, useCancelSale, useRefundSale } from '@/hooks/use-sales';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

function SaleDetailContent() {
  const params = useParams();
  const router = useRouter();
  const saleId = params.id as string;

  const { 
    transaction, 
    isLoading, 
    error, 
    refetch 
  } = useSaleWithLines(saleId);

  const cancelSale = useCancelSale();
  const refundSale = useRefundSale();

  const handleBack = () => {
    router.push('/sales/history');
  };

  const handlePrint = () => {
    // TODO: Implement print functionality
    // This could open a print dialog or generate a PDF
    toast.info('Print functionality will be implemented soon');
  };

  const handleCancel = async () => {
    if (!transaction) return;

    const confirmed = window.confirm(
      'Are you sure you want to cancel this transaction? This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      await cancelSale.mutateAsync({
        transactionId: transaction.id,
        reason: 'Transaction cancelled by user'
      });
      
      toast.success('Transaction cancelled successfully');
      refetch();
    } catch (error: any) {
      toast.error(`Failed to cancel transaction: ${error.message}`);
    }
  };

  const handleRefund = async () => {
    if (!transaction) return;

    const confirmed = window.confirm(
      `Are you sure you want to process a refund for ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(transaction.total_amount)}?`
    );

    if (!confirmed) return;

    try {
      await refundSale.mutateAsync({
        transactionId: transaction.id,
        amount: transaction.total_amount,
        reason: 'Full refund processed by user'
      });
      
      toast.success('Refund processed successfully');
      refetch();
    } catch (error: any) {
      toast.error(`Failed to process refund: ${error.message}`);
    }
  };

  if (!saleId) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Invalid sale ID provided
        </AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load sale details: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6">
      <SaleDetailView
        transaction={transaction}
        isLoading={isLoading}
        error={error}
        onRefresh={refetch}
        onBack={handleBack}
        onPrint={handlePrint}
        onCancel={handleCancel}
        onRefund={handleRefund}
      />
    </div>
  );
}

export default function SaleDetailPage() {
  return (
    <ProtectedRoute requiredPermissions={['SALE_VIEW']}>
      <SaleDetailContent />
    </ProtectedRoute>
  );
}