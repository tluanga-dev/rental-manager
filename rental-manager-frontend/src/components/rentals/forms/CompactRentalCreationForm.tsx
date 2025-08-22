'use client';

import { Badge } from '@/components/ui/badge';
import { RentalCreationForm } from './RentalCreationForm';

interface CompactRentalCreationFormProps {
  onSuccess?: (rental: any) => void;
}

export function CompactRentalCreationForm({ onSuccess }: CompactRentalCreationFormProps = {}) {
  return (
    <div className="max-w-6xl mx-auto p-2 space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <h1 className="text-xl font-bold">Create Rental</h1>
        <Badge variant="outline" className="text-xs">Compact View</Badge>
      </div>
      
      <div className="compact-form-wrapper">
        <style dangerouslySetInnerHTML={{
          __html: `
            .compact-form-wrapper {
              font-size: 0.875rem;
            }
            
            .compact-form-wrapper .space-y-6 > * + * {
              margin-top: 0.75rem;
            }
            
            .compact-form-wrapper .space-y-4 > * + * {
              margin-top: 0.5rem;
            }
            
            .compact-form-wrapper .space-y-3 > * + * {
              margin-top: 0.375rem;
            }
            
            .compact-form-wrapper .p-6 {
              padding: 0.75rem;
            }
            
            .compact-form-wrapper .p-4 {
              padding: 0.5rem;
            }
            
            .compact-form-wrapper .h-10 {
              height: 2.25rem;
            }
            
            .compact-form-wrapper .py-2 {
              padding-top: 0.25rem;
              padding-bottom: 0.25rem;
            }
            
            .compact-form-wrapper .gap-4 {
              gap: 0.5rem;
            }
            
            .compact-form-wrapper .gap-3 {
              gap: 0.375rem;
            }
            
            .compact-form-wrapper .mb-4 {
              margin-bottom: 0.5rem;
            }
            
            .compact-form-wrapper .mt-4 {
              margin-top: 0.5rem;
            }
            
            .compact-form-wrapper .text-sm {
              font-size: 0.75rem;
            }
            
            .compact-form-wrapper .text-lg {
              font-size: 1rem;
            }
            
            .compact-form-wrapper .text-xl {
              font-size: 1.1rem;
            }
            
            .compact-form-wrapper .text-2xl {
              font-size: 1.25rem;
            }
            
            .compact-form-wrapper button {
              padding: 0.25rem 0.5rem;
              font-size: 0.8rem;
            }
            
            .compact-form-wrapper input, .compact-form-wrapper textarea, .compact-form-wrapper select {
              padding: 0.25rem 0.5rem;
              font-size: 0.8rem;
            }
            
            .compact-form-wrapper .grid-cols-2 {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
               .compact-form-wrapper .grid-cols-3 {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          
          .compact-form-wrapper .grid-cols-1 {
            grid-template-columns: 1fr;
          }
          
          @media (max-width: 768px) {
            .compact-form-wrapper .grid-cols-3 {
              grid-template-columns: 1fr;
            }
          }
            
            .compact-form-wrapper .min-h-[200px] {
              min-height: 150px;
            }
            
            .compact-form-wrapper .max-h-[300px] {
              max-height: 200px;
            }
            
            /* Delivery & Pickup inline layout */
            .compact-form-wrapper .flex.items-center.justify-between {
              gap: 1rem;
            }
            
            .compact-form-wrapper .flex.items-center.gap-4 {
              gap: 1rem;
            }
            
            .compact-form-wrapper .flex.flex-row.items-center.space-x-2 {
              display: flex;
              flex-direction: row;
              align-items: center;
              gap: 0.5rem;
            }
            
            .compact-form-wrapper .pb-3 {
              padding-bottom: 0.5rem;
            }
            
            .compact-form-wrapper .text-sm.font-medium {
              font-size: 0.75rem;
              line-height: 1.2;
            }
            
            .compact-form-wrapper .text-xs {
              font-size: 0.7rem;
              line-height: 1.1;
            }
          `
        }} />
        
        <RentalCreationForm onSuccess={onSuccess} />
      </div>
    </div>
  );
}
