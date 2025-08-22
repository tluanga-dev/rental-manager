// Debug version of ActiveRentalsTable with detailed logging and error handling
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  ArrowPathIcon,
  EyeIcon,
  ExclamationTriangleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

interface ActiveRental {
  id: string;
  transaction_number: string;
  customer_name: string;
  rental_status: string;
  total_amount: number;
  items_count: number;
}

export default function DebugActiveRentalsTable() {
  const router = useRouter();
  const [rentals, setRentals] = useState<ActiveRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingReturn, setProcessingReturn] = useState<string | null>(null);

  // Debug: Log router object
  console.log('Router object:', router);
  console.log('Current pathname:', router.pathname);
  console.log('Current asPath:', router.asPath);

  useEffect(() => {
    fetchActiveRentals();
  }, []);

  const fetchActiveRentals = async () => {
    try {
      console.log('Fetching active rentals...');
      setLoading(true);
      setError(null);
      
      const apiUrl = '/api/transactions/rentals/active';
      console.log('API URL:', apiUrl);
      
      const response = await fetch(apiUrl);
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch active rentals: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('API Response:', result);
      
      setRentals(result.data || []);
      
    } catch (err) {
      console.error('Error fetching rentals:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const canReturn = (rental: ActiveRental) => {
    const returnableStatuses = [
      'RENTAL_INPROGRESS',
      'RENTAL_EXTENDED',
      'RENTAL_PARTIAL_RETURN',
      'RENTAL_LATE_PARTIAL_RETURN'
    ];
    const canReturnResult = returnableStatuses.includes(rental.rental_status);
    console.log(`Can return rental ${rental.id} (${rental.rental_status}):`, canReturnResult);
    return canReturnResult;
  };

  const handleReturnItems = (rentalId: string) => {
    console.log('🔵 Return button clicked!');
    console.log('🔵 Rental ID:', rentalId);
    console.log('🔵 Router available:', !!router);
    console.log('🔵 Router push function:', typeof router.push);
    
    const targetUrl = `/rentals/${rentalId}/return`;
    console.log('🔵 Target URL:', targetUrl);
    
    setProcessingReturn(rentalId);
    console.log('🔵 Set processing return to:', rentalId);
    
    try {
      // Method 1: Direct router.push
      console.log('🔵 Attempting direct router.push...');
      router.push(targetUrl)
        .then(() => {
          console.log('✅ Navigation successful!');
          setProcessingReturn(null);
        })
        .catch((err) => {
          console.error('❌ Navigation failed:', err);
          setProcessingReturn(null);
        });
        
      // Alternative Method 2: Using window.location (uncomment to test)
      // console.log('🔵 Using window.location as fallback...');
      // window.location.href = targetUrl;
      
      // Alternative Method 3: Using router.replace (uncomment to test)
      // console.log('🔵 Using router.replace...');
      // router.replace(targetUrl);
      
    } catch (err) {
      console.error('❌ Exception during navigation:', err);
      setProcessingReturn(null);
    }
  };

  const handleViewDetails = (rentalId: string) => {
    console.log('👁️ View details clicked for rental:', rentalId);
    const targetUrl = `/rentals/${rentalId}`;
    console.log('👁️ Navigating to:', targetUrl);
    router.push(targetUrl);
  };

  // Test button for debugging
  const handleTestNavigation = () => {
    console.log('🧪 Test navigation clicked');
    const testUrl = '/rentals/test-id/return';
    console.log('🧪 Test URL:', testUrl);
    router.push(testUrl);
  };

  if (loading) {
    return (
      <div className="p-8">
        <h2 className="text-xl font-bold mb-4">Debug: Loading Active Rentals...</h2>
        <div>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h2 className="text-xl font-bold mb-4 text-red-600">Debug: Error Loading Rentals</h2>
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <p className="text-red-800">{error}</p>
          <button 
            onClick={fetchActiveRentals}
            className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">Debug: Active Rentals Table</h2>
      
      {/* Debug Info */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
        <h3 className="font-semibold text-blue-800 mb-2">Debug Information:</h3>
        <p><strong>Router pathname:</strong> {router.pathname}</p>
        <p><strong>Router asPath:</strong> {router.asPath}</p>
        <p><strong>Rentals loaded:</strong> {rentals.length}</p>
        <p><strong>Processing return for:</strong> {processingReturn || 'none'}</p>
        
        {/* Test Button */}
        <button 
          onClick={handleTestNavigation}
          className="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          🧪 Test Navigation
        </button>
      </div>

      {/* Simple Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Transaction
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Amount
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rentals.map((rental) => (
              <tr key={rental.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {rental.transaction_number}
                  </div>
                  <div className="text-xs text-gray-500">
                    ID: {rental.id}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {rental.customer_name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {rental.rental_status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  ${rental.total_amount.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    {/* View Button */}
                    <button
                      onClick={() => handleViewDetails(rental.id)}
                      className="text-blue-600 hover:text-blue-900 flex items-center px-3 py-1 border border-blue-300 rounded hover:bg-blue-50"
                    >
                      <EyeIcon className="w-4 h-4 mr-1" />
                      View
                    </button>
                    
                    {/* Return Button */}
                    {canReturn(rental) && (
                      <button
                        onClick={() => handleReturnItems(rental.id)}
                        disabled={processingReturn === rental.id}
                        className={`flex items-center px-3 py-1 rounded text-white transition-colors ${
                          processingReturn === rental.id
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-700'
                        }`}
                      >
                        {processingReturn === rental.id ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                            Opening...
                          </>
                        ) : (
                          <>
                            <ArrowPathIcon className="w-4 h-4 mr-1" />
                            Return
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {rentals.length === 0 && (
          <div className="text-center py-12">
            <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No active rentals</h3>
            <p className="mt-1 text-sm text-gray-500">
              There are no active rental transactions at this time.
            </p>
          </div>
        )}
      </div>

      {/* Debug Console */}
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded">
        <h3 className="font-semibold text-gray-800 mb-2">Debug Console:</h3>
        <p className="text-sm text-gray-600">
          Check your browser's developer console (F12) for detailed logs when clicking buttons.
        </p>
        <p className="text-sm text-gray-600 mt-1">
          Look for messages starting with 🔵 (return button) and 👁️ (view button).
        </p>
      </div>
    </div>
  );
}