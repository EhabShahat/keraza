'use client';

/**
 * Database Health Monitoring Dashboard
 * Provides real-time monitoring of database performance, alerts, and tuning recommendations
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'critical';
  connectionPool: {
    active: number;
    max: number;
    utilization: number;
  };
  queryPerformance: {
    averageResponseTime: number;
    slowQueries: number;
    errorRate: number;
  };
  recommendations: string[];
  alerts: any[];
}

interface PerformanceMetrics {
  queryCount: number;
  averageResponseTime: number;
  errorRate: number;
  slowQueryCount: number;
  connectionPoolUtilization: number;
  topQueries: Array<{ query: string; count: number; avgDuration: number }>;
}

interface TuningRecommendation {
  id: string;
  type: 'index' | 'query' | 'connection' | 'cache' | 'schema';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  automated: boolean;
  applied: boolean;
  createdAt: string;
}

export default function DatabaseHealthDashboard() {
  const [health, setHealth] = useState<DatabaseHealth | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [recommendations, setRecommendations] = useState<TuningRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [timeWindow, setTimeWindow] = useState(600000); // 10 minutes

  useEffect(() => {
    fetchData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, timeWindow]);

  const fetchData = async () => {
    try {
      const [healthRes, metricsRes, recsRes] = await Promise.all([
        fetch(`/api/admin/database/performance?action=health`),
        fetch(`/api/admin/database/performance?action=metrics&timeWindow=${timeWindow}`),
        fetch(`/api/admin/database/tuning?action=recommendations`)
      ]);

      if (healthRes.ok) {
        const { health } = await healthRes.json();
        setHealth(health);
      }

      if (metricsRes.ok) {
        const { metrics } = await metricsRes.json();
        setMetrics(metrics);
      }

      if (recsRes.ok) {
        const { recommendations } = await recsRes.json();
        setRecommendations(recommendations);
      }
    } catch (error) {
      console.error('Failed to fetch database data:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyRecommendation = async (id: string) => {
    try {
      const response = await fetch('/api/admin/database/tuning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply', recommendationId: id })
      });

      if (response.ok) {
        fetchData(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to apply recommendation:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50';
      case 'degraded': return 'text-yellow-600 bg-yellow-50';
      case 'critical': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Database Health Monitor</h2>
        <div className="flex items-center gap-4">
          <select
            value={timeWindow}
            onChange={(e) => setTimeWindow(parseInt(e.target.value))}
            className="input"
          >
            <option value={300000}>5 minutes</option>
            <option value={600000}>10 minutes</option>
            <option value={1800000}>30 minutes</option>
            <option value={3600000}>1 hour</option>
          </select>
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Auto Refresh On' : 'Auto Refresh Off'}
          </Button>
          <Button onClick={fetchData}>Refresh</Button>
        </div>
      </div>

      {/* Status Overview */}
      {health && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Overall Status</p>
                <p className={`text-lg font-semibold px-2 py-1 rounded ${getStatusColor(health.status)}`}>
                  {health.status.toUpperCase()}
                </p>
              </div>
              <div className="text-2xl">
                {health.status === 'healthy' ? '✅' : health.status === 'degraded' ? '⚠️' : '🚨'}
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div>
              <p className="text-sm text-gray-600">Connection Pool</p>
              <p className="text-lg font-semibold">
                {health.connectionPool.active}/{health.connectionPool.max}
              </p>
              <p className="text-sm text-gray-500">
                {(health.connectionPool.utilization * 100).toFixed(1)}% utilized
              </p>
            </div>
          </Card>

          <Card className="p-4">
            <div>
              <p className="text-sm text-gray-600">Avg Response Time</p>
              <p className="text-lg font-semibold">
                {health.queryPerformance.averageResponseTime.toFixed(0)}ms
              </p>
              <p className="text-sm text-gray-500">
                {health.queryPerformance.slowQueries} slow queries
              </p>
            </div>
          </Card>

          <Card className="p-4">
            <div>
              <p className="text-sm text-gray-600">Error Rate</p>
              <p className="text-lg font-semibold">
                {(health.queryPerformance.errorRate * 100).toFixed(2)}%
              </p>
              <p className="text-sm text-gray-500">
                {health.alerts.length} active alerts
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Detailed Tabs */}
      <Tabs defaultValue="metrics" className="w-full">
        <TabsList>
          <TabsTrigger value="metrics">Performance Metrics</TabsTrigger>
          <TabsTrigger value="recommendations">Tuning Recommendations</TabsTrigger>
          <TabsTrigger value="alerts">Alerts & Monitoring</TabsTrigger>
          <TabsTrigger value="queries">Query Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          {metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Query Performance</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Total Queries:</span>
                    <span className="font-semibold">{metrics.queryCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Average Response Time:</span>
                    <span className="font-semibold">{metrics.averageResponseTime.toFixed(0)}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Error Rate:</span>
                    <span className="font-semibold">{(metrics.errorRate * 100).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Slow Queries:</span>
                    <span className="font-semibold">{metrics.slowQueryCount}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Connection Pool</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Pool Utilization:</span>
                    <span className="font-semibold">
                      {(metrics.connectionPoolUtilization * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${metrics.connectionPoolUtilization * 100}%` }}
                    ></div>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Optimization Recommendations</h3>
            <Button onClick={() => fetchData()}>Refresh Recommendations</Button>
          </div>
          
          <div className="space-y-3">
            {recommendations.length === 0 ? (
              <Card className="p-6 text-center text-gray-500">
                No recommendations available
              </Card>
            ) : (
              recommendations.map((rec) => (
                <Card key={rec.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 text-xs rounded border ${getPriorityColor(rec.priority)}`}>
                          {rec.priority.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">{rec.type}</span>
                        {rec.automated && (
                          <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">
                            AUTO
                          </span>
                        )}
                        {rec.applied && (
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                            APPLIED
                          </span>
                        )}
                      </div>
                      <h4 className="font-semibold">{rec.title}</h4>
                      <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                      <p className="text-sm text-green-600 mt-1">
                        <strong>Impact:</strong> {rec.impact}
                      </p>
                      <p className="text-sm text-gray-500">
                        <strong>Effort:</strong> {rec.effort} • 
                        <strong> Created:</strong> {new Date(rec.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="ml-4">
                      {!rec.applied && rec.automated && (
                        <Button
                          size="sm"
                          onClick={() => applyRecommendation(rec.id)}
                        >
                          Apply
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <h3 className="text-lg font-semibold">Recent Alerts</h3>
          {health?.alerts && health.alerts.length > 0 ? (
            <div className="space-y-3">
              {health.alerts.map((alert, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded ${getPriorityColor(alert.severity)}`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date(alert.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-2">{alert.message}</p>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center text-gray-500">
              No recent alerts
            </Card>
          )}
        </TabsContent>

        <TabsContent value="queries" className="space-y-4">
          <h3 className="text-lg font-semibold">Top Queries</h3>
          {metrics?.topQueries && metrics.topQueries.length > 0 ? (
            <div className="space-y-3">
              {metrics.topQueries.map((query, index) => (
                <Card key={index} className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <code className="text-sm bg-gray-100 p-2 rounded block">
                        {query.query}
                      </code>
                    </div>
                    <div className="ml-4 text-right">
                      <div className="text-sm">
                        <strong>{query.count}</strong> executions
                      </div>
                      <div className="text-sm text-gray-500">
                        {query.avgDuration.toFixed(0)}ms avg
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center text-gray-500">
              No query data available
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}