'use client';

import React from 'react';
import { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';
import { RentalCalculator } from '@/components/rental-pricing/RentalCalculator';
import { 
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function RentalCalculatorPage() {
  return (
    <AuthConnectionGuard requireAuth={true} showOfflineAlert={true}>
      <div className="container mx-auto p-6 max-w-4xl">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/rentals">Rentals</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Calculator</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Calculator className="h-8 w-8 text-primary" />
            Rental Cost Calculator
          </h1>
          <p className="text-muted-foreground mt-2">
            Calculate rental costs for any item with automatic pricing tier selection
          </p>
        </div>

        {/* Info Alert */}
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            This calculator automatically selects the best pricing tier based on rental duration. 
            Longer rental periods may qualify for volume discounts.
          </AlertDescription>
        </Alert>

        {/* Main Calculator */}
        <RentalCalculator />

        {/* Features Card */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Calculator Features</CardTitle>
            <CardDescription>
              Make informed rental pricing decisions with our advanced calculator
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Smart Pricing Selection
                </h4>
                <p className="text-sm text-muted-foreground">
                  Automatically selects the most cost-effective pricing tier based on rental duration
                </p>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Volume Discounts
                </h4>
                <p className="text-sm text-muted-foreground">
                  Shows savings compared to daily rates when qualifying for weekly or monthly pricing
                </p>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Real-time Availability
                </h4>
                <p className="text-sm text-muted-foreground">
                  Checks current stock levels to ensure items are available for rental
                </p>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Flexible Date Selection
                </h4>
                <p className="text-sm text-muted-foreground">
                  Calculate by specific dates or number of days for maximum flexibility
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthConnectionGuard>
  );
}