'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/axios';

export default function TestInventoryItemsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get('/inventory/items?limit=10');
        console.log('Raw API Response:', response);
        setData(response.data);
      } catch (err: any) {
        console.error('API Error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;

  return (
    <div className="p-8 bg-white">
      <h1 className="text-2xl font-bold mb-4">Inventory Items Debug Page</h1>
      
      <div className="mb-4">
        <h2 className="font-semibold">Data Type:</h2>
        <p>{typeof data}</p>
        <p>Is Array: {Array.isArray(data) ? 'Yes' : 'No'}</p>
        <p>Length: {Array.isArray(data) ? data.length : 'N/A'}</p>
      </div>

      <div className="mb-4">
        <h2 className="font-semibold">Raw Data:</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>

      {Array.isArray(data) && data.length > 0 && (
        <div className="mb-4">
          <h2 className="font-semibold">Items Found:</h2>
          <ul className="list-disc pl-5">
            {data.map((item: any) => (
              <li key={item.id}>
                {item.sku} - {item.item_name} 
                (Stock: {item.stock_summary?.total || 0})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
}