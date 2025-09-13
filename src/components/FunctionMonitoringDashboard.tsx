'use client';

/**
 * Function Monitoring Dashboard
 * Real-time dashboard for function performance and usage monitoring
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface FunctionHealth {
  function_name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  response_time: number;
  error_rate: number;
  memory_usage: number;
  cpu_usage: number;
  last_check: string;
  uptime: number;
  success_rate: number;
}

interface Alert {
  id: string;
  rule_id: string;
  function_name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  resolved: boolean;
}

interface MonitoringData {
  monitoring_status: {
    initialized: boolean;
    config: any;
  };
  summary: {
    total_functions: number;
    healthy_functions: number;
    degraded_functions: number;
    unhealthy_functions: number;
    active_alerts: number;
    avg_response_time: number;
  };
  function_metrics: Array<{
    function_name: string;
    current_health: FunctionHealth;
    metrics_24h: {
      avg_response_time: number;
      total_invocations: number;
      error_rate: number;
      success_rate: number;
    };
  }>;
  active_alerts: Alert[];
}

export default function FunctionMonitoringDashboard() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch monitoring data
  const fetchData = async () => {
    try {
      const response = await fetch('/api/admin/monitoring/status');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch monitoring data');
      console.error('Error fetching monitoring data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    fetchData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // Status color helper
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50';
      case 'degraded': return 'text-yellow-600 bg-yellow-50';
      case 'unhealthy': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Severity color helper
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'text-blue-600 bg-blue-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'critical': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="p-6 border-red-200 bg-red-50">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Monitoring Data</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchData} variant="outline">
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <p className="text-gray-600">No monitoring data available</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Function Monitoring</h1>
          <p className="text-gray-600">Real-time performance and health monitoring</p>
        </div>
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-600">Auto-refresh</span>
          </label>
          <Button onClick={fetchData} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Functions</p>
              <p className="text-2xl font-bold text-gray-900">{data.summary.total_functions}</p>
            </div>
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 text-sm">⚡</span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Healthy</p>
              <p className="text-2xl font-bold text-green-600">{data.summary.healthy_functions}</p>
            </div>
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 text-sm">✓</span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Issues</p>
              <p className="text-2xl font-bold text-yellow-600">
                {data.summary.degraded_functions + data.summary.unhealthy_functions}
              </p>
            </div>
            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
              <span className="text-yellow-600 text-sm">⚠</span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Response</p>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(data.summary.avg_response_time)}ms
              </p>
            </div>
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-purple-600 text-sm">⏱</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="functions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="functions">Functions</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts {data.active_alerts.length > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded-full">
                {data.active_alerts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Functions Tab */}
        <TabsContent value="functions">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.function_metrics.map((func) => (
              <Card key={func.function_name} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">{func.function_name}</h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(func.current_health.status)}`}>
                    {func.current_health.status}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Response Time:</span>
                    <span className="font-medium">{func.current_health.response_time}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Success Rate:</span>
                    <span className="font-medium">{func.current_health.success_rate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">24h Invocations:</span>
                    <span className="font-medium">{func.metrics_24h.total_invocations}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">24h Avg Response:</span>
                    <span className="font-medium">{Math.round(func.metrics_24h.avg_response_time)}ms</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-500">
                    Last check: {new Date(func.current_health.last_check).toLocaleTimeString()}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          <div className="space-y-4">
            {data.active_alerts.length === 0 ? (
              <Card className="p-6 text-center">
                <div className="text-green-600 text-4xl mb-2">✓</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">No Active Alerts</h3>
                <p className="text-gray-600">All functions are operating normally</p>
              </Card>
            ) : (
              data.active_alerts.map((alert) => (
                <Card key={alert.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(alert.severity)}`}>
                          {alert.severity}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{alert.function_name}</span>
                      </div>
                      <p className="text-gray-700 mb-2">{alert.message}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Acknowledge
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Trends */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Trends</h3>
              <div className="space-y-4">
                {data.function_metrics.map((func) => (
                  <div key={func.function_name} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">{func.function_name}</span>
                      <span className="text-sm text-gray-600">
                        {Math.round(func.metrics_24h.avg_response_time)}ms avg
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${Math.min((func.metrics_24h.avg_response_time / 3000) * 100, 100)}%`
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Cost Analysis */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Analysis</h3>
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-1">
                    ${((data.summary.total_functions * 0.0000002 * 1000000) / 100).toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-600">Estimated monthly cost</div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Function invocations (24h):</span>
                    <span className="font-medium">
                      {data.function_metrics.reduce((sum, f) => sum + f.metrics_24h.total_invocations, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Avg execution time:</span>
                    <span className="font-medium">{Math.round(data.summary.avg_response_time)}ms</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Functions deployed:</span>
                    <span className="font-medium">{data.summary.total_functions}</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}