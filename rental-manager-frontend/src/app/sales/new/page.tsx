'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { SaleForm } from '@/components/sales/SaleForm';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

function NewSaleContent() {
  const router = useRouter();

  const handleSuccess = (saleId: string, transactionNumber: string) => {
    toast.success(`Sale ${transactionNumber} created successfully!`);
    router.push(`/sales/${saleId}`);
  };

  const handleCancel = () => {
    router.push('/sales');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <SaleForm 
          onSuccess={handleSuccess}
          onCancel={handleCancel}
          className="p-6"
        />
      </div>
    </div>
  );
}

export default function NewSalePage() {
  return (
    <ProtectedRoute requiredPermissions={['SALE_CREATE']}>
      <NewSaleContent />
    </ProtectedRoute>
  );
}