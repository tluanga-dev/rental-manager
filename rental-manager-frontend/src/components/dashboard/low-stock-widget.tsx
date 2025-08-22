'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Package, 
  AlertTriangle, 
  ShoppingCart, 
  ExternalLink,
  RefreshCw,
  TrendingDown
} from 'lucide-react';
import { stockLevelsApi } from '@/services/api/inventory';
import { cn } from '@/lib/utils';

interface LowStockAlert {
  item_id: string;
  item_name: string;
  location_id: string;
  location_name: string;
  current_stock: number;
  reorder_point: number;
  days_until_stockout?: number;
  severity: 'low' | 'critical';
}

export function LowStockWidget() {
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const router = useRouter();

  const fetchLowStockAlerts = async () => {
    try {
      setIsLoading(true);
      const data = await stockLevelsApi.getLowStockAlerts();
      // Extract alerts array from the response object
      setAlerts(Array.isArray(data) ? data : (data?.alerts || []));
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch low stock alerts:', error);
      // Use empty array on error
      setAlerts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLowStockAlerts();
    
    // Refresh alerts every 10 minutes on dashboard
    const interval = setInterval(fetchLowStockAlerts, 10 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Ensure alerts is always an array
  const alertsArray = Array.isArray(alerts) ? alerts : [];
  const criticalAlerts = alertsArray.filter(alert => alert.severity === 'critical');
  const lowStockAlerts = alertsArray.filter(alert => alert.severity === 'low');
  const totalAlerts = alertsArray.length;
  const criticalCount = criticalAlerts.length;

  const getSeverityIcon = (severity: string) => {
    return severity === 'critical' ? (
      <AlertTriangle className="h-3 w-3 text-red-500" />
    ) : (
      <TrendingDown className="h-3 w-3 text-yellow-500" />
    );
  };

  const getSeverityBadge = (severity: string) => {
    return severity === 'critical' ? (
      <Badge variant="destructive" className="text-xs">CRITICAL</Badge>
    ) : (
      <Badge variant="secondary" className="text-xs">LOW</Badge>
    );
  };

  const handleViewItem = (itemId: string) => {
    router.push(`/products/items/${itemId}`);
  };

  const handleCreatePurchase = () => {
    router.push('/purchases/record');
  };

  const handleViewInventory = () => {
    router.push('/inventory/stock');
  };

  const handleManageReorderPoints = () => {
    router.push('/inventory/reorder-points');
  };

  const handleQuickReorder = (alert: LowStockAlert) => {
    // Pre-populate purchase form with item details
    // Use a default quantity suggestion since reorder_quantity is no longer available
    const suggestedQuantity = Math.max(10, alert.reorder_point * 2);
    const purchaseUrl = `/purchases/record?item_id=${alert.item_id}&quantity=${suggestedQuantity}&supplier_hint=reorder`;
    router.push(purchaseUrl);
  };

  const displayAlerts = [...criticalAlerts, ...lowStockAlerts].slice(0, 5);

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Package className="h-5 w-5" />
            <span>Low Stock Alerts</span>
            {totalAlerts > 0 && (
              <Badge 
                variant={criticalCount > 0 ? "destructive" : "secondary"}
                className="ml-2"
              >
                {totalAlerts}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchLowStockAlerts}
              disabled={isLoading}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            {lastUpdated && (
              <span className="text-xs text-gray-500">
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {totalAlerts === 0 ? (
          <div className="text-center py-8">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">All items properly stocked</h3>
            <p className="mt-1 text-sm text-gray-500">
              No items are currently below their reorder points.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleViewInventory}
              className="mt-4"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Inventory
            </Button>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
                <div className="text-xs text-gray-500">Critical</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{lowStockAlerts.length}</div>
                <div className="text-xs text-gray-500">Low Stock</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-600">{totalAlerts}</div>
                <div className="text-xs text-gray-500">Total Alerts</div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
              <Button 
                size="sm" 
                onClick={handleCreatePurchase}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Purchase Order
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleManageReorderPoints}
              >
                <Package className="h-4 w-4 mr-2" />
                Reorder Points
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleViewInventory}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Inventory
              </Button>
            </div>

            {/* Alerts Table */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Reorder At</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        Loading stock alerts...
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayAlerts.map((alert) => (
                      <TableRow 
                        key={`${alert.item_id}-${alert.location_id}`}
                        className="hover:bg-gray-50"
                      >
                        <TableCell>
                          <div 
                            className="flex items-center space-x-2 cursor-pointer"
                            onClick={() => handleViewItem(alert.item_id)}
                          >
                            {getSeverityIcon(alert.severity)}
                            <div>
                              <div className="font-medium text-sm">{alert.item_name}</div>
                              <div className="text-xs text-gray-500">
                                ID: {alert.item_id.slice(0, 8)}...
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{alert.location_name}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className={cn(
                            "font-medium",
                            alert.severity === 'critical' ? 'text-red-600' : 'text-yellow-600'
                          )}>
                            {alert.current_stock}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="text-sm text-gray-500">
                            {alert.reorder_point}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col space-y-1">
                            {getSeverityBadge(alert.severity)}
                            {alert.days_until_stockout && (
                              <div className="text-xs text-red-600">
                                ~{alert.days_until_stockout}d to stockout
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickReorder(alert)}
                            className="h-6 px-2 text-xs"
                          >
                            <ShoppingCart className="h-3 w-3 mr-1" />
                            Reorder
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Show More Link */}
            {totalAlerts > 5 && (
              <div className="text-center mt-4">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleViewInventory}
                >
                  View all {totalAlerts} alerts
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}