interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface PerformanceMonitorOptions {
  enabled?: boolean;
  logToConsole?: boolean;
  trackMemory?: boolean;
  trackQueryMetrics?: boolean;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private options: PerformanceMonitorOptions;
  private startTimes: Map<string, number> = new Map();

  constructor(options: PerformanceMonitorOptions = {}) {
    this.options = {
      enabled: process.env.NODE_ENV === 'development',
      logToConsole: true,
      trackMemory: true,
      trackQueryMetrics: true,
      ...options,
    };
  }

  startTimer(name: string): void {
    if (!this.options.enabled) return;
    
    // Create unique timer name to avoid conflicts
    const timestamp = Date.now();
    const uniqueName = `${name}-${timestamp}`;
    
    this.startTimes.set(name, performance.now());
    this.startTimes.set(`${name}_unique`, uniqueName);
    
    if (this.options.logToConsole) {
      console.time(`[Performance] ${uniqueName}`);
    }
  }

  endTimer(name: string, metadata?: Record<string, any>): number | null {
    if (!this.options.enabled) return null;

    const startTime = this.startTimes.get(name);
    const uniqueName = this.startTimes.get(`${name}_unique`) as string;
    
    if (!startTime) {
      // Silently handle missing timer - this is common in development with hot reloads
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Performance timer "${name}" was not started`);
      }
      return null;
    }

    const duration = performance.now() - startTime;
    this.startTimes.delete(name);
    this.startTimes.delete(`${name}_unique`);

    this.recordMetric(name, duration, metadata);

    if (this.options.logToConsole) {
      if (uniqueName) {
        console.timeEnd(`[Performance] ${uniqueName}`);
      }
      console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`, metadata || '');
    }

    return duration;
  }

  recordMetric(name: string, value: number, metadata?: Record<string, any>): void {
    if (!this.options.enabled) return;

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      metadata,
    };

    this.metrics.push(metric);

    // Keep only last 100 metrics to prevent memory leaks
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }
  }

  getMetrics(name?: string): PerformanceMetric[] {
    if (name) {
      return (this.metrics || []).filter(metric => metric?.name === name);
    }
    return [...(this.metrics || [])];
  }

  getAverageMetric(name: string): number | null {
    const metrics = this.getMetrics(name);
    if (metrics.length === 0) return null;

    const sum = metrics.reduce((acc, metric) => acc + metric.value, 0);
    return sum / metrics.length;
  }

  getLatestMetric(name: string): PerformanceMetric | null {
    const metrics = this.getMetrics(name);
    return metrics.length > 0 ? metrics[metrics.length - 1] : null;
  }

  trackMemoryUsage(label?: string): void {
    if (!this.options.enabled || !this.options.trackMemory) return;

    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory;
      this.recordMetric(`memory-usage${label ? `-${label}` : ''}`, memory.usedJSHeapSize, {
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        used: memory.usedJSHeapSize,
      });
    }
  }

  trackQueryMetrics(queryKey: string, duration: number, cacheHit: boolean, errorCount?: number): void {
    if (!this.options.enabled || !this.options.trackQueryMetrics) return;

    this.recordMetric('query-duration', duration, {
      queryKey,
      cacheHit,
      errorCount: errorCount || 0,
    });

    this.recordMetric('cache-hit-rate', cacheHit ? 1 : 0, { queryKey });
  }

  getQueryStats(queryKey?: string): {
    totalQueries: number;
    averageDuration: number;
    cacheHitRate: number;
    errorRate: number;
  } {
    const queryMetrics = this.getMetrics('query-duration');
    const filteredMetrics = queryKey 
      ? (queryMetrics || []).filter(m => m?.metadata?.queryKey === queryKey)
      : (queryMetrics || []);

    if (filteredMetrics.length === 0) {
      return { totalQueries: 0, averageDuration: 0, cacheHitRate: 0, errorRate: 0 };
    }

    const totalQueries = filteredMetrics.length;
    const averageDuration = filteredMetrics.reduce((sum, m) => sum + m.value, 0) / totalQueries;
    
    const cacheHits = (filteredMetrics || []).filter(m => m?.metadata?.cacheHit === true).length;
    const cacheHitRate = cacheHits / totalQueries;
    
    const errors = filteredMetrics.reduce((sum, m) => sum + (m.metadata?.errorCount || 0), 0);
    const errorRate = errors / totalQueries;

    return {
      totalQueries,
      averageDuration,
      cacheHitRate,
      errorRate,
    };
  }

  generateReport(): string {
    if (!this.options.enabled) return 'Performance monitoring is disabled';

    const report: string[] = [];
    report.push('=== Performance Report ===\n');

    // Get unique metric names
    const metricNames = [...new Set(this.metrics.map(m => m.name))];

    metricNames.forEach(name => {
      const metrics = this.getMetrics(name);
      const average = this.getAverageMetric(name);
      const latest = this.getLatestMetric(name);
      
      report.push(`${name}:`);
      report.push(`  Count: ${metrics.length}`);
      report.push(`  Average: ${average?.toFixed(2)}ms`);
      report.push(`  Latest: ${latest?.value.toFixed(2)}ms`);
      report.push('');
    });

    // Query-specific stats
    const queryStats = this.getQueryStats();
    if (queryStats.totalQueries > 0) {
      report.push('Query Performance:');
      report.push(`  Total Queries: ${queryStats.totalQueries}`);
      report.push(`  Average Duration: ${queryStats.averageDuration.toFixed(2)}ms`);
      report.push(`  Cache Hit Rate: ${(queryStats.cacheHitRate * 100).toFixed(1)}%`);
      report.push(`  Error Rate: ${(queryStats.errorRate * 100).toFixed(1)}%`);
      report.push('');
    }

    return report.join('\n');
  }

  reset(): void {
    this.metrics = [];
    this.startTimes.clear();
  }

  enable(): void {
    this.options.enabled = true;
  }

  disable(): void {
    this.options.enabled = false;
  }
}

// Global instance
export const performanceMonitor = new PerformanceMonitor();

// React Hook for component performance tracking
export function usePerformanceTracking(componentName: string) {
  const trackRender = (metadata?: Record<string, any>) => {
    performanceMonitor.recordMetric(`${componentName}-render`, performance.now(), metadata);
  };

  const trackSearch = (searchTerm: string, resultCount: number, duration: number) => {
    performanceMonitor.recordMetric(`${componentName}-search`, duration, {
      searchTerm,
      resultCount,
    });
  };

  const trackSelection = (duration: number, metadata?: Record<string, any>) => {
    performanceMonitor.recordMetric(`${componentName}-selection`, duration, metadata);
  };

  return {
    trackRender,
    trackSearch,
    trackSelection,
    startTimer: (name: string) => performanceMonitor.startTimer(`${componentName}-${name}`),
    endTimer: (name: string, metadata?: Record<string, any>) => 
      performanceMonitor.endTimer(`${componentName}-${name}`, metadata),
  };
}

// Development helper to expose performance data globally
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).performanceMonitor = performanceMonitor;
}