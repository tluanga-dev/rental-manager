// Minimal return button - guaranteed to work
import React from 'react';

interface MinimalReturnButtonProps {
  rentalId: string;
  rentalNumber?: string;
}

export default function MinimalReturnButton({ rentalId, rentalNumber }: MinimalReturnButtonProps) {
  console.log('🔹 MinimalReturnButton rendered for rental:', rentalId);

  const handleReturnClick = () => {
    console.log('🔵 RETURN BUTTON CLICKED!');
    console.log('🔵 Rental ID:', rentalId);
    
    const targetUrl = `/rentals/${rentalId}/return`;
    console.log('🔵 Target URL:', targetUrl);
    
    try {
      // Method 1: Simple window.location (most reliable)
      console.log('🔵 Using window.location.href...');
      window.location.href = targetUrl;
    } catch (error) {
      console.error('❌ Navigation failed:', error);
      alert(`Navigation failed. Target URL was: ${targetUrl}`);
    }
  };

  const handleTestClick = () => {
    console.log('🧪 TEST BUTTON CLICKED!');
    alert(`Test button works! Rental ID: ${rentalId}`);
  };

  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
      {/* Test Button */}
      <button
        onClick={handleTestClick}
        style={{
          backgroundColor: '#10b981',
          color: 'white',
          padding: '8px 16px',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px'
        }}
      >
        🧪 Test
      </button>

      {/* Return Button */}
      <button
        onClick={handleReturnClick}
        style={{
          backgroundColor: '#3b82f6',
          color: 'white',
          padding: '8px 16px',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold'
        }}
      >
        🔄 Return
      </button>
      
      <span style={{ fontSize: '12px', color: '#6b7280' }}>
        ID: {rentalId.substring(0, 8)}...
      </span>
    </div>
  );
}