'use client';

import React from 'react';
import { PurchaseRecordingForm } from './purchase-recording-form';

/**
 * Test component for the enhanced purchase recording form with serial numbers
 * This component can be used to test the serial number functionality
 */
export function PurchaseFormTest() {
  const handleSuccess = (purchase: any) => {
    console.log('Purchase created successfully:', purchase);
    alert('Purchase created successfully! Check console for details.');
  };

  const handleCancel = () => {
    console.log('Purchase creation cancelled');
    alert('Purchase creation cancelled');
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Purchase Form with Serial Numbers - Test</h1>
        <p className="text-muted-foreground mt-2">
          Test the enhanced purchase recording form with serial number support.
          Select items that require serial numbers to see the serial number input fields.
        </p>
      </div>
      
      <PurchaseRecordingForm 
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
}

export default PurchaseFormTest;