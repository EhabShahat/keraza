'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  RefreshCw, 
  Trash2, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Activity,
  Database,
  Zap,
  Settings,
  TrendingUp,
  Clock
} from 'lucide-react';

/**
 * Cache statistics interface
 */
interface CacheStats {
  memory: {
    size: number;
    maxSize: number;
    hitRate: number;
    hits: number;
    misses: number;
    evictions: number;
    totalRequests: number;
  };
  edge: {
    size: number;
    maxSize: number;
    hitRate: number;
    hits: number;
    misses: number;
    evictions: number;
    totalRequests: number;
  };
  database: {
    size: number;
    maxSize: number;
    hitRate: number;
    hits: number;
    misses: number;
    evictions: number;
    totalRequests: number;
  };
}

/**
 * Cache analytics interface
 */
interface CacheAnalytics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  avgResponseTime: number;
  avgCacheResponseTime: number;
  avgMissResponseTime: number;
  totalCacheSize: number;
  averageEntrySize: number;
  topPerformers: Array<{
    key: string;
    dataType: string;
    hitRate: number;
    requests: number;
  }>;
  underPerformers: Array<{
    key: string;
    dataType: string;
    hitRate: number;
    requests: number;
  }>;
}

/**
 * Cache invalidation rule interface
 */
interface CacheInvalidationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
}

/**
 * Real-time cache statistics
 */
interface RealTimeStats {
  currentHitRate: number;
  requestsPerMinute: number;
  avgResponseTime: number;
  activeEntries: number;
  totalSize: number;
}

/**
 * Cache management dashboard component
 */
export default function CacheManagementDashboard() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [analytics, setAnalytics] = useState<CacheAnalytics | null>(null);
  const [rules, setRules] = useState<CacheInvalidationRule[]>([]);
  const [realTimeStats, setRealTimeStats] = useState<RealTimeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalidating, setInvalidating] = useState<string | null>(null);

  /**
   * Fetch cache statistics
   */
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/cache/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch cache stats:', error);
    }
  };

  /**
   * Fetch cache analytics
   */
  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/cache/analytics');
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to fetch cache analytics:', error);
    }
  };

  /**
   * Fetch invalidation rules
   */
  const fetchRules = async () => {
    try {
      const response = await fetch('/api/cache/rules');
      if (response.ok) {
        const data = await response.json();
        setRules(data);
      }
    } catch (error) {
      console.error('Failed to fetch invalidation rules:', error);
    }
  };

  /**
   * Fetch real-time statistics
   */
  const fetchRealTimeStats = async () => {
    try {
      const response = await fetch('/api/cache/realtime-stats');
      if (response.ok) {
        const data = await response.json();
        setRealTimeStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch real-time stats:', error);
    }
  };

  /**
   * Invalidate cache by type
   */
  const invalidateCache = async (type: string) => {
    setInvalidating(type);
    try {
      const response = await fetch('/api/cache/invalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });

      if (response.ok) {
        await fetchStats();
        await fetchAnalytics();
      }
    } catch (error) {
      console.error('Failed to invalidate cache:', error);
    } finally {
      setInvalidating(null);
    }
  };

  /**
   * Toggle invalidation rule
   */
  const toggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      const response = await fetch('/api/cache/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId, enabled })
      });

      if (response.ok) {
        await fetchRules();
      }
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  /**
   * Initialize dashboard
   */
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchStats(),
        fetchAnalytics(),
        fetchRules(),
        fetchRealTimeStats()
      ]);
      setLoading(false);
    };

    loadData();

    // Set up real-time updates
    const interval = setInterval(() => {
      fetchRealTimeStats();
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  /**
   * Format bytes to human readable
   */
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  /**
   * Format percentage
   */
  const formatPercentage = (value: number): string => {
    return (value * 100).toFixed(1) + '%';
  };

  /**
   * Get hit rate color
   */
  const getHitRateColor = (hitRate: number): string => {
    if (hitRate >= 0.8) return 'text-green-600';
    if (hitRate >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading cache dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cache Management Dashboard</h1>
        <Button onClick={() => window.location.reload()} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Real-time Statistics */}
      {realTimeStats && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            Real-time Statistics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className={`text-2xl font-bold ${getHitRateColor(realTimeStats.currentHitRate)}`}>
                {formatPercentage(realTimeStats.currentHitRate)}
              </div>
              <div className="text-sm text-gray-600">Hit Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{realTimeStats.requestsPerMinute}</div>
              <div className="text-sm text-gray-600">Requests/min</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{realTimeStats.avgResponseTime.toFixed(0)}ms</div>
              <div className="text-sm text-gray-600">Avg Response</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{realTimeStats.activeEntries}</div>
              <div className="text-sm text-gray-600">Active Entries</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{formatBytes(realTimeStats.totalSize)}</div>
              <div className="text-sm text-gray-600">Total Size</div>
            </div>
          </div>
        </Card>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="invalidation">Invalidation</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Memory Cache */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Zap className="h-5 w-5 mr-2" />
                  Memory Cache
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Hit Rate:</span>
                    <span className={getHitRateColor(stats.memory.hitRate)}>
                      {formatPercentage(stats.memory.hitRate)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Size:</span>
                    <span>{stats.memory.size} / {stats.memory.maxSize}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Hits:</span>
                    <span>{stats.memory.hits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Misses:</span>
                    <span>{stats.memory.misses}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Evictions:</span>
                    <span>{stats.memory.evictions}</span>
                  </div>
                </div>
                <Button 
                  className="w-full mt-4" 
                  variant="outline"
                  onClick={() => invalidateCache('memory')}
                  disabled={invalidating === 'memory'}
                >
                  {invalidating === 'memory' ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Clear Memory Cache
                </Button>
              </Card>

              {/* Edge Cache */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2" />
                  Edge Cache
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Hit Rate:</span>
                    <span className={getHitRateColor(stats.edge.hitRate)}>
                      {formatPercentage(stats.edge.hitRate)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Hits:</span>
                    <span>{stats.edge.hits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Misses:</span>
                    <span>{stats.edge.misses}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Requests:</span>
                    <span>{stats.edge.totalRequests}</span>
                  </div>
                </div>
                <Button 
                  className="w-full mt-4" 
                  variant="outline"
                  onClick={() => invalidateCache('edge')}
                  disabled={invalidating === 'edge'}
                >
                  {invalidating === 'edge' ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Clear Edge Cache
                </Button>
              </Card>

              {/* Database Cache */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Database className="h-5 w-5 mr-2" />
                  Database Cache
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Hit Rate:</span>
                    <span className={getHitRateColor(stats.database.hitRate)}>
                      {formatPercentage(stats.database.hitRate)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Hits:</span>
                    <span>{stats.database.hits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Misses:</span>
                    <span>{stats.database.misses}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Requests:</span>
                    <span>{stats.database.totalRequests}</span>
                  </div>
                </div>
                <Button 
                  className="w-full mt-4" 
                  variant="outline"
                  onClick={() => invalidateCache('database')}
                  disabled={invalidating === 'database'}
                >
                  {invalidating === 'database' ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Clear Database Cache
                </Button>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          {analytics && (
            <>
              {/* Performance Metrics */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Performance Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{analytics.totalRequests}</div>
                    <div className="text-sm text-gray-600">Total Requests</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${getHitRateColor(analytics.hitRate)}`}>
                      {formatPercentage(analytics.hitRate)}
                    </div>
                    <div className="text-sm text-gray-600">Overall Hit Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{analytics.avgResponseTime.toFixed(0)}ms</div>
                    <div className="text-sm text-gray-600">Avg Response Time</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{formatBytes(analytics.totalCacheSize)}</div>
                    <div className="text-sm text-gray-600">Total Cache Size</div>
                  </div>
                </div>
              </Card>

              {/* Top Performers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                    Top Performers
                  </h3>
                  <div className="space-y-2">
                    {analytics.topPerformers.slice(0, 5).map((entry, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <div>
                          <div className="font-medium text-sm">{entry.key}</div>
                          <div className="text-xs text-gray-600">{entry.dataType}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-green-600 font-medium">
                            {formatPercentage(entry.hitRate)}
                          </div>
                          <div className="text-xs text-gray-600">{entry.requests} req</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <XCircle className="h-5 w-5 mr-2 text-red-600" />
                    Underperformers
                  </h3>
                  <div className="space-y-2">
                    {analytics.underPerformers.slice(0, 5).map((entry, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <div>
                          <div className="font-medium text-sm">{entry.key}</div>
                          <div className="text-xs text-gray-600">{entry.dataType}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-red-600 font-medium">
                            {formatPercentage(entry.hitRate)}
                          </div>
                          <div className="text-xs text-gray-600">{entry.requests} req</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* Invalidation Tab */}
        <TabsContent value="invalidation" className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Manual Cache Invalidation</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                onClick={() => invalidateCache('system')}
                disabled={invalidating === 'system'}
                variant="outline"
              >
                {invalidating === 'system' ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Settings className="h-4 w-4 mr-2" />
                )}
                System Config
              </Button>
              <Button 
                onClick={() => invalidateCache('exams')}
                disabled={invalidating === 'exams'}
                variant="outline"
              >
                {invalidating === 'exams' ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Database className="h-4 w-4 mr-2" />
                )}
                Exams
              </Button>
              <Button 
                onClick={() => invalidateCache('students')}
                disabled={invalidating === 'students'}
                variant="outline"
              >
                {invalidating === 'students' ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Database className="h-4 w-4 mr-2" />
                )}
                Students
              </Button>
              <Button 
                onClick={() => invalidateCache('attempts')}
                disabled={invalidating === 'attempts'}
                variant="outline"
              >
                {invalidating === 'attempts' ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Clock className="h-4 w-4 mr-2" />
                )}
                Attempts
              </Button>
              <Button 
                onClick={() => invalidateCache('analytics')}
                disabled={invalidating === 'analytics'}
                variant="outline"
              >
                {invalidating === 'analytics' ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TrendingUp className="h-4 w-4 mr-2" />
                )}
                Analytics
              </Button>
              <Button 
                onClick={() => invalidateCache('all')}
                disabled={invalidating === 'all'}
                variant="destructive"
              >
                {invalidating === 'all' ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Clear All
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Rules Tab */}
        <TabsContent value="rules" className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Cache Invalidation Rules</h3>
            <div className="space-y-4">
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium">{rule.name}</h4>
                      <Badge variant={rule.enabled ? "default" : "secondary"}>
                        {rule.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                      <Badge variant="outline">Priority: {rule.priority}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{rule.description}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleRule(rule.id, !rule.enabled)}
                  >
                    {rule.enabled ? (
                      <>
                        <XCircle className="h-4 w-4 mr-2" />
                        Disable
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Enable
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}