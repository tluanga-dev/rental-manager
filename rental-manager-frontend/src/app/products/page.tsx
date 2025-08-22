'use client';

import { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { 
  Package, 
  Grid3X3, 
  Tag, 
  Boxes,
  Plus,
  BarChart3,
  AlertCircle,
  TrendingUp
} from 'lucide-react';

function ProductsContent() {
  const router = useRouter();

  const stats = [
    {
      title: 'Total Products',
      value: '342',
      change: '+23 this month',
      icon: Package,
      color: 'text-slate-600',
    },
    {
      title: 'Active SKUs',
      value: '1,456',
      change: '+45 this month',
      icon: Boxes,
      color: 'text-green-600',
    },
    {
      title: 'Categories',
      value: '28',
      change: '12 leaf categories',
      icon: Grid3X3,
      color: 'text-purple-600',
    },
    {
      title: 'Brands',
      value: '54',
      change: '+3 this month',
      icon: Tag,
      color: 'text-orange-600',
    },
  ];

  const quickActions = [
    {
      title: 'Categories',
      description: 'Manage product categories',
      icon: Grid3X3,
      path: '/products/categories',
      color: 'bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20',
      iconColor: 'text-purple-600',
    },
    {
      title: 'Brands',
      description: 'Manage product brands',
      icon: Tag,
      path: '/products/brands',
      color: 'bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20',
      iconColor: 'text-orange-600',
    },
    {
      title: 'Products',
      description: 'Manage master products',
      icon: Package,
      path: '/products/items',
      color: 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/20',
      iconColor: 'text-slate-600',
    },
    {
      title: 'SKUs',
      description: 'Manage product variants',
      icon: Boxes,
      path: '/products/skus',
      color: 'bg-green-50 hover:bg-green-100 dark:bg-green-900/20',
      iconColor: 'text-green-600',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Product Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your product catalog, categories, brands, and SKUs
          </p>
        </div>
        <Button onClick={() => router.push('/products/items/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Product
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.change}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Card 
              key={action.title}
              className={`cursor-pointer transition-all ${action.color}`}
              onClick={() => router.push(action.path)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{action.title}</CardTitle>
                  <Icon className={`h-5 w-5 ${action.iconColor}`} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {action.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity and Insights */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Products */}
        <Card>
          <CardHeader>
            <CardTitle>Recently Added Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  name: 'Canon EOS R5 Mirrorless Camera',
                  category: 'Cameras > Digital > Mirrorless',
                  skus: 3,
                  addedBy: 'John Doe',
                  date: '2 hours ago',
                },
                {
                  name: 'Godox AD600 Pro Studio Flash',
                  category: 'Lighting > Studio > Flash',
                  skus: 2,
                  addedBy: 'Jane Smith',
                  date: '5 hours ago',
                },
                {
                  name: 'DJI RS 3 Pro Gimbal',
                  category: 'Accessories > Stabilizers',
                  skus: 1,
                  addedBy: 'Mike Johnson',
                  date: 'Yesterday',
                },
              ].map((product, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  onClick={() => router.push('/products/items')}
                >
                  <div className="flex-1">
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-gray-600">
                      {product.category}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {product.skus} SKUs • Added by {product.addedBy} • {product.date}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Product Insights */}
        <Card>
          <CardHeader>
            <CardTitle>Product Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 border rounded-lg bg-orange-50 dark:bg-orange-900/20">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-orange-600 mr-2 mt-0.5" />
                  <div>
                    <p className="font-medium text-orange-900 dark:text-orange-100">
                      Low Stock Alert
                    </p>
                    <p className="text-sm text-orange-700 dark:text-orange-200">
                      15 SKUs are below reorder point
                    </p>
                    <Button 
                      variant="link" 
                      className="p-0 h-auto text-orange-700 dark:text-orange-200"
                      onClick={() => router.push('/inventory/stock')}
                    >
                      View Details →
                    </Button>
                  </div>
                </div>
              </div>

              <div className="p-3 border rounded-lg">
                <div className="flex items-start">
                  <TrendingUp className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
                  <div>
                    <p className="font-medium">Top Performing Category</p>
                    <p className="text-sm text-gray-600">
                      Cameras generated 45% of rental revenue this month
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 border rounded-lg">
                <div className="flex items-start">
                  <BarChart3 className="h-5 w-5 text-slate-600 mr-2 mt-0.5" />
                  <div>
                    <p className="font-medium">Product Utilization</p>
                    <p className="text-sm text-gray-600">
                      Average rental utilization: 68%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Overview */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Category Overview</CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push('/products/categories')}
            >
              Manage Categories
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { name: 'Cameras', products: 85, skus: 342, path: 'cameras' },
              { name: 'Lighting', products: 62, skus: 215, path: 'lighting' },
              { name: 'Audio', products: 45, skus: 178, path: 'audio' },
              { name: 'Accessories', products: 120, skus: 456, path: 'accessories' },
              { name: 'Drones', products: 18, skus: 72, path: 'drones' },
              { name: 'Tripods & Supports', products: 30, skus: 95, path: 'supports' },
            ].map((category) => (
              <div
                key={category.name}
                className="p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                onClick={() => router.push(`/products/categories?filter=${category.path}`)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{category.name}</p>
                    <p className="text-sm text-gray-600">
                      {category.products} products • {category.skus} SKUs
                    </p>
                  </div>
                  <Grid3X3 className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <AuthConnectionGuard requireAuth={true} showOfflineAlert={true}>
      <ProtectedRoute requiredPermissions={['INVENTORY_VIEW']}>
        <ProductsContent />
      </ProtectedRoute>
    </AuthConnectionGuard>
  );
}