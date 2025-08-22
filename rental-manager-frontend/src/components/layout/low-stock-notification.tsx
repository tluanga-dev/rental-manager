'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  AlertTriangle, 
  Package, 
  ShoppingCart, 
  ExternalLink,
  RefreshCw 
} from 'lucide-react';
import { stockAnalysisApi } from '@/services/api/inventory';
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

export function LowStockNotification() {
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const fetchLowStockAlerts = async () => {
    try {
      setIsLoading(true);
      const data = await stockAnalysisApi.getLowStockAlerts();
      setAlerts(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch low stock alerts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLowStockAlerts();
    
    // Refresh alerts every 5 minutes
    const interval = setInterval(fetchLowStockAlerts, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const criticalAlerts = (alerts || []).filter(alert => alert.severity === 'critical');
  const lowStockAlerts = (alerts || []).filter(alert => alert.severity === 'low');
  const totalAlerts = (alerts || []).length;

  const getSeverityIcon = (severity: string) => {
    return severity === 'critical' ? (
      <AlertTriangle className="h-3 w-3 text-red-500" />
    ) : (
      <Package className="h-3 w-3 text-yellow-500" />
    );
  };

  const getSeverityColor = (severity: string) => {
    return severity === 'critical' ? 'text-red-600' : 'text-yellow-600';
  };

  const handleViewItem = (itemId: string) => {
    router.push(`/products/items/${itemId}`);
    setIsOpen(false);
  };

  const handleCreatePurchase = () => {
    router.push('/purchases/record');
    setIsOpen(false);
  };

  const handleViewInventory = () => {
    router.push('/inventory/stock');
    setIsOpen(false);
  };

  const handleManageReorderPoints = () => {
    router.push('/inventory/reorder-points');
    setIsOpen(false);
  };

  const handleQuickReorder = (alert: LowStockAlert) => {
    // Pre-populate purchase form with item details
    // Use a default quantity suggestion since reorder_quantity is no longer available
    const suggestedQuantity = Math.max(10, alert.reorder_point * 2);
    const purchaseUrl = `/purchases/record?item_id=${alert.item_id}&quantity=${suggestedQuantity}&supplier_hint=reorder`;
    router.push(purchaseUrl);
    setIsOpen(false);
  };

  if (totalAlerts === 0) {
    return null; // Don't show notification if no alerts
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className={cn(
            "relative flex items-center space-x-2",
            criticalAlerts.length > 0 && "text-red-600 hover:text-red-700",
            criticalAlerts.length === 0 && lowStockAlerts.length > 0 && "text-yellow-600 hover:text-yellow-700"
          )}
        >
          <Package className="h-5 w-5" />
          <span className="hidden sm:inline text-sm font-medium">
            Low Stock
          </span>
          {totalAlerts > 0 && (
            <Badge 
              variant={criticalAlerts.length > 0 ? "destructive" : "secondary"}
              className="h-5 w-5 text-xs p-0 flex items-center justify-center"
            >
              {totalAlerts > 9 ? '9+' : totalAlerts}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuLabel className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Package className="h-4 w-4" />
            <span>Low Stock Alerts</span>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchLowStockAlerts}
              disabled={isLoading}
              className="h-6 w-6 p-0"
            >
              <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
            </Button>
            {lastUpdated && (
              <span className="text-xs text-gray-500">
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        {/* Quick Actions */}
        <div className="p-2 space-y-1">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleCreatePurchase}
            className="w-full justify-start"
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Create Purchase Order
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleManageReorderPoints}
            className="w-full justify-start"
          >
            <Package className="h-4 w-4 mr-2" />
            Manage Reorder Points
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleViewInventory}
            className="w-full justify-start"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Inventory
          </Button>
        </div>
        
        <DropdownMenuSeparator />
        
        {/* Alert List */}
        <div className="max-h-64 overflow-y-auto">
          {/* Critical Alerts First */}
          {criticalAlerts.length > 0 && (
            <>
              <div className="px-3 py-2 text-xs font-semibold text-red-600 bg-red-50">
                CRITICAL ALERTS ({criticalAlerts.length})
              </div>
              {criticalAlerts.map((alert) => (
                <div
                  key={`${alert.item_id}-${alert.location_id}`}
                  className="p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-start justify-between">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => handleViewItem(alert.item_id)}
                    >
                      <div className="flex items-center space-x-2 mb-2">
                        {getSeverityIcon(alert.severity)}
                        <span className="font-medium text-sm">
                          {alert.item_name}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600">
                        <div>Location: {alert.location_name}</div>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className={getSeverityColor(alert.severity)}>
                            Stock: {alert.current_stock}
                          </span>
                          <span>Reorder at: {alert.reorder_point}</span>
                        </div>
                        {alert.days_until_stockout && (
                          <div className="text-red-600 font-medium">
                            Est. stockout in {alert.days_until_stockout} days
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Quick Action Button */}
                    <div className="ml-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickReorder(alert);
                        }}
                        className="h-6 px-2 text-xs"
                      >
                        <ShoppingCart className="h-3 w-3 mr-1" />
                        Reorder
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
          
          {/* Low Stock Alerts */}
          {lowStockAlerts.length > 0 && (
            <>
              {criticalAlerts.length > 0 && <DropdownMenuSeparator />}
              <div className="px-3 py-2 text-xs font-semibold text-yellow-600 bg-yellow-50">
                LOW STOCK ALERTS ({lowStockAlerts.length})
              </div>
              {lowStockAlerts.map((alert) => (
                <div
                  key={`${alert.item_id}-${alert.location_id}`}
                  className="p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-start justify-between">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => handleViewItem(alert.item_id)}
                    >
                      <div className="flex items-center space-x-2 mb-2">
                        {getSeverityIcon(alert.severity)}
                        <span className="font-medium text-sm">
                          {alert.item_name}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600">
                        <div>Location: {alert.location_name}</div>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className={getSeverityColor(alert.severity)}>
                            Stock: {alert.current_stock}
                          </span>
                          <span>Reorder at: {alert.reorder_point}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Quick Action Button */}
                    <div className="ml-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickReorder(alert);
                        }}
                        className="h-6 px-2 text-xs"
                      >
                        <ShoppingCart className="h-3 w-3 mr-1" />
                        Reorder
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
        
        {totalAlerts === 0 && (
          <div className="p-4 text-center text-gray-500">
            All items are properly stocked
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
