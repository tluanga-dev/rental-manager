'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Package, RotateCcw, FileText, Building2, TrendingUp } from 'lucide-react';

import { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { PurchaseAnalyticsCards } from '@/components/purchases/purchase-analytics-cards';
import { PurchaseHistoryTable } from '@/components/purchases/purchase-history-table';

export default function PurchasesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <AuthConnectionGuard requireAuth={true} showOfflineAlert={true}>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Purchases</h1>
            <p className="text-muted-foreground">
              Manage purchases, returns, and supplier relationships
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
            onClick={() => router.push('/purchases/returns')}
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            View Returns
          </Button>
          <Button onClick={() => router.push('/purchases/record')}>
            <Package className="h-4 w-4 mr-1" />
            Record Purchase
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="recent">Recent Purchases</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Analytics Cards */}
          <PurchaseAnalyticsCards />

          {/* Quick Actions */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors" 
                  onClick={() => router.push('/purchases/record')}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Record Purchase</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Record a completed purchase and add items to inventory
                </p>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:bg-muted/50 transition-colors" 
                  onClick={() => router.push('/purchases/history')}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Purchase History</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  View and manage all recorded purchases
                </p>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:bg-muted/50 transition-colors" 
                  onClick={() => router.push('/purchases/returns')}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Purchase Returns</CardTitle>
                <RotateCcw className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Process returns and manage refunds
                </p>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:bg-muted/50 transition-colors" 
                  onClick={() => router.push('/purchases/suppliers')}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Suppliers</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Manage supplier information and relationships
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Purchases Preview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Purchases</CardTitle>
                  <CardDescription>Latest purchase transactions</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => router.push('/purchases/history')}
                >
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <PurchaseHistoryTable 
                filters={{ limit: 5 }}
                showFilters={false}
                compact={true}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent" className="space-y-6">
          <PurchaseHistoryTable />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <PurchaseAnalyticsCards />
          
          {/* Additional Analytics */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>Monthly Trends</span>
                </CardTitle>
                <CardDescription>
                  Purchase volume and spending trends over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Purchase trends chart would be displayed here
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Building2 className="h-5 w-5" />
                  <span>Supplier Performance</span>
                </CardTitle>
                <CardDescription>
                  Top suppliers by volume and value
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Supplier performance metrics would be displayed here
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </AuthConnectionGuard>
  );
}