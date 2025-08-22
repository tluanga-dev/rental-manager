// DROP-IN REPLACEMENT: Return button fix for existing active rentals page
import React from 'react';

interface ReturnButtonFixProps {
  rentalId: string;
  rentalStatus?: string;
  disabled?: boolean;
  onReturnClick?: (rentalId: string) => void;
}

export default function ActiveRentalsReturnButtonFix({ 
  rentalId, 
  rentalStatus = 'RENTAL_INPROGRESS',
  disabled = false,
  onReturnClick 
}: ReturnButtonFixProps) {
  
  // Debug logging
  console.log('🔧 ReturnButtonFix rendered:', { rentalId, rentalStatus, disabled });

  // Check if rental can be returned
  const canReturn = () => {
    const returnableStatuses = [
      'RENTAL_INPROGRESS',
      'RENTAL_EXTENDED', 
      'RENTAL_PARTIAL_RETURN',
      'RENTAL_LATE_PARTIAL_RETURN',
      'RENTAL_LATE'
    ];
    return returnableStatuses.includes(rentalStatus);
  };

  const handleReturnClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🔧 RETURN BUTTON CLICKED!');
    console.log('🔧 Rental ID:', rentalId);
    console.log('🔧 Rental Status:', rentalStatus);
    console.log('🔧 Can Return:', canReturn());
    
    if (!rentalId) {
      console.error('❌ No rental ID provided');
      alert('Error: No rental ID provided');
      return;
    }

    if (!canReturn() && !disabled) {
      console.warn('⚠️ Rental cannot be returned based on status');
      alert(`Cannot return rental with status: ${rentalStatus}`);
      return;
    }

    const targetUrl = `/rentals/${rentalId}/return`;
    console.log('🔧 Target URL:', targetUrl);

    // Call custom handler if provided
    if (onReturnClick) {
      console.log('🔧 Calling custom return handler');
      onReturnClick(rentalId);
      return;
    }

    // Use the most reliable navigation method
    try {
      console.log('🔧 Using window.location.href navigation');
      window.location.href = targetUrl;
    } catch (error) {
      console.error('❌ Navigation failed:', error);
      
      // Fallback: try router if available
      try {
        // @ts-ignore - Try Next.js router as fallback
        if (typeof window !== 'undefined' && window.next && window.next.router) {
          console.log('🔧 Trying Next.js router fallback');
          window.next.router.push(targetUrl);
        } else {
          throw new Error('No fallback available');
        }
      } catch (fallbackError) {
        console.error('❌ Fallback navigation failed:', fallbackError);
        alert(`Navigation failed. Please manually navigate to: ${targetUrl}`);
      }
    }
  };

  // Don't render if rental can't be returned (unless disabled override)
  if (!canReturn() && !disabled) {
    console.log('🔧 Button not rendered - rental cannot be returned');
    return null;
  }

  return (
    <button
      onClick={handleReturnClick}
      disabled={disabled}
      style={{
        backgroundColor: disabled ? '#9CA3AF' : '#3B82F6',
        color: 'white',
        padding: '6px 12px',
        border: 'none',
        borderRadius: '4px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '14px',
        fontWeight: '500',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        transition: 'all 0.2s ease'
      }}
      onMouseOver={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = '#2563EB';
        }
      }}
      onMouseOut={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = '#3B82F6';
        }
      }}
      title={`Process return for rental ${rentalId}`}
    >
      {/* Return Icon */}
      <svg 
        width="16" 
        height="16" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2"
      >
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
        <path d="M21 3v5h-5"/>
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
        <path d="M3 21v-5h5"/>
      </svg>
      Return
    </button>
  );
}

// USAGE EXAMPLES:

// Example 1: Drop-in replacement for existing button
export const ExampleUsage1 = () => (
  <ActiveRentalsReturnButtonFix 
    rentalId="9e71e6de-6de4-42f9-a648-af09a39647ce"
    rentalStatus="RENTAL_INPROGRESS"
  />
);

// Example 2: With custom click handler
export const ExampleUsage2 = () => (
  <ActiveRentalsReturnButtonFix 
    rentalId="9e71e6de-6de4-42f9-a648-af09a39647ce"
    rentalStatus="RENTAL_INPROGRESS"
    onReturnClick={(rentalId) => {
      console.log('Custom handler called for:', rentalId);
      // Your custom logic here
      window.location.href = `/rentals/${rentalId}/return`;
    }}
  />
);

// Example 3: In a table row
export const ExampleTableUsage = ({ rental }: { rental: any }) => (
  <tr>
    <td>{rental.transaction_number}</td>
    <td>{rental.customer_name}</td>
    <td>{rental.rental_status}</td>
    <td>
      <ActiveRentalsReturnButtonFix 
        rentalId={rental.id}
        rentalStatus={rental.rental_status}
      />
    </td>
  </tr>
);

// Example 4: Multiple buttons in a row
export const ExampleMultipleButtons = ({ rental }: { rental: any }) => (
  <div style={{ display: 'flex', gap: '8px' }}>
    <button style={{ padding: '6px 12px', backgroundColor: '#10B981', color: 'white', border: 'none', borderRadius: '4px' }}>
      View
    </button>
    <ActiveRentalsReturnButtonFix 
      rentalId={rental.id}
      rentalStatus={rental.rental_status}
    />
    <button style={{ padding: '6px 12px', backgroundColor: '#6B7280', color: 'white', border: 'none', borderRadius: '4px' }}>
      Edit
    </button>
  </div>
);