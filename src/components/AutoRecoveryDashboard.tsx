/**
 * Auto-Recovery Dashboard Component
 * Provides UI for monitoring and managing automated recovery and scaling
 */

'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half_open';
  failure_count: number;
  last_failure: string;
  next_attempt: string;
  half_open_calls: number;
}

interface FunctionInstance {
  id: string;
  endpoint: string;
  status: 'active' | 'inactive' | 'recovering' | 'failed';
  health: {
    function_name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    response_time: number;
    error_rate: number;
    memory_usage: number;
    cpu_usage: number;
    last_check: string;
    uptime: number;
    success_rate: number;
  };
  connections: number;
  last_request: string;
  created_at: string;
}

interface FunctionStatus {
  function_name: string;
  circuit_breaker: CircuitBreakerState;
  instances: FunctionInstance[];
  active_requests: number;
}

interface AutoRecoveryStatus {
  functions: FunctionStatus[];
  total_active_requests: number;
}

export default function AutoRecoveryDashboard() {
  const [status, setStatus] = useState<AutoRecoveryStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFunction, setSelectedFunction] = useState<string>('admin');

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/admin/monitoring/auto-recovery?action=status');
      if (!response.ok) throw new Error('Failed to fetch status');
      
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleManualAction = async (action: string, functionName: string, scaleAction?: string) => {
    try {
      const body: any = { action, function_name: functionName };
      if (scaleAction) body.scale_action = scaleAction;

      const response = await fetch('/api/admin/monitoring/auto-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) throw new Error('Action failed');
      
      // Refresh status after action
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const initializeFunction = async (functionName: string) => {
    await handleManualAction('initialize', functionName);
  };

  const triggerFailover = async (functionName: string) => {
    await handleManualAction('failover', functionName);
  };

  const scaleFunction = async (functionName: string, direction: 'up' | 'down') => {
    await handleManualAction('scale', functionName, direction);
  };

  const stopMonitoring = async (functionName: string) => {
    await handleManualAction('stop', functionName);
  };

  const clearSessions = async () => {
    await handleManualAction('clear-sessions', '');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': case 'active': case 'closed': return 'text-green-600';
      case 'degraded': case 'recovering': case 'half_open': return 'text-yellow-600';
      case 'unhealthy': case 'failed': case 'open': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusBadge = (status: string) => {
    const color = getStatusColor(status);
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color} bg-opacity-10`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-red-600">
          <h3 className="text-lg font-semibold mb-2">Error</h3>
          <p>{error}</p>
          <Button onClick={fetchStatus} className="mt-4">
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card className="p-6">
        <p>No auto-recovery status available</p>
      </Card>
    );
  }

  const selectedFunctionStatus = status.functions.find(f => f.function_name === selectedFunction);

  return (
    <div className="space-y-6">
      {/* Overview */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Auto-Recovery System</h2>
          <div className="flex gap-2">
            <Button onClick={fetchStatus} variant="outline" size="sm">
              Refresh
            </Button>
            <Button onClick={clearSessions} variant="outline" size="sm">
              Clear Sessions
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{status.total_active_requests}</div>
            <div className="text-sm text-blue-600">Active Requests</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {status.functions.filter(f => f.circuit_breaker?.state === 'closed').length}
            </div>
            <div className="text-sm text-green-600">Healthy Functions</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">
              {status.functions.filter(f => f.circuit_breaker?.state === 'half_open').length}
            </div>
            <div className="text-sm text-yellow-600">Recovering Functions</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {status.functions.filter(f => f.circuit_breaker?.state === 'open').length}
            </div>
            <div className="text-sm text-red-600">Failed Functions</div>
          </div>
        </div>

        {/* Function Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {status.functions.map((func) => (
            <div key={func.function_name} className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold capitalize">{func.function_name}</h3>
                {getStatusBadge(func.circuit_breaker?.state || 'unknown')}
              </div>
              <div className="space-y-1 text-sm">
                <div>Instances: {func.instances.length}</div>
                <div>Active Requests: {func.active_requests}</div>
                <div>Failures: {func.circuit_breaker?.failure_count || 0}</div>
              </div>
              <div className="flex gap-1 mt-3">
                <Button 
                  onClick={() => initializeFunction(func.function_name)}
                  size="sm" 
                  variant="outline"
                >
                  Init
                </Button>
                <Button 
                  onClick={() => triggerFailover(func.function_name)}
                  size="sm" 
                  variant="outline"
                >
                  Failover
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Detailed Function View */}
      <Card className="p-6">
        <Tabs value={selectedFunction} onValueChange={setSelectedFunction}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="admin">Admin</TabsTrigger>
            <TabsTrigger value="public">Public</TabsTrigger>
            <TabsTrigger value="attempts">Attempts</TabsTrigger>
          </TabsList>

          {['admin', 'public', 'attempts'].map((functionName) => (
            <TabsContent key={functionName} value={functionName} className="space-y-4">
              {(() => {
                const funcStatus = status.functions.find(f => f.function_name === functionName);
                if (!funcStatus) return <div>No data available for {functionName}</div>;

                return (
                  <>
                    {/* Circuit Breaker Status */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-3">Circuit Breaker</h4>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <div className="text-gray-600">State</div>
                          <div className={getStatusColor(funcStatus.circuit_breaker?.state || 'unknown')}>
                            {funcStatus.circuit_breaker?.state || 'Unknown'}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600">Failures</div>
                          <div>{funcStatus.circuit_breaker?.failure_count || 0}</div>
                        </div>
                        <div>
                          <div className="text-gray-600">Last Failure</div>
                          <div>
                            {funcStatus.circuit_breaker?.last_failure 
                              ? new Date(funcStatus.circuit_breaker.last_failure).toLocaleTimeString()
                              : 'None'
                            }
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600">Next Attempt</div>
                          <div>
                            {funcStatus.circuit_breaker?.next_attempt 
                              ? new Date(funcStatus.circuit_breaker.next_attempt).toLocaleTimeString()
                              : 'N/A'
                            }
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600">Half-Open Calls</div>
                          <div>{funcStatus.circuit_breaker?.half_open_calls || 0}</div>
                        </div>
                      </div>
                    </div>

                    {/* Function Instances */}
                    <div className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-semibold">Function Instances</h4>
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => scaleFunction(functionName, 'up')}
                            size="sm"
                            variant="outline"
                          >
                            Scale Up
                          </Button>
                          <Button 
                            onClick={() => scaleFunction(functionName, 'down')}
                            size="sm"
                            variant="outline"
                          >
                            Scale Down
                          </Button>
                        </div>
                      </div>

                      {funcStatus.instances.length === 0 ? (
                        <div className="text-gray-500 text-center py-4">
                          No instances available
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {funcStatus.instances.map((instance) => (
                            <div key={instance.id} className="border rounded p-3">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <div className="font-medium">{instance.id}</div>
                                  <div className="text-sm text-gray-600">{instance.endpoint}</div>
                                </div>
                                <div className="flex gap-2">
                                  {getStatusBadge(instance.status)}
                                  {getStatusBadge(instance.health.status)}
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <div className="text-gray-600">Response Time</div>
                                  <div>{instance.health.response_time}ms</div>
                                </div>
                                <div>
                                  <div className="text-gray-600">Error Rate</div>
                                  <div>{instance.health.error_rate.toFixed(1)}%</div>
                                </div>
                                <div>
                                  <div className="text-gray-600">Connections</div>
                                  <div>{instance.connections}</div>
                                </div>
                                <div>
                                  <div className="text-gray-600">Success Rate</div>
                                  <div>{instance.health.success_rate.toFixed(1)}%</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-3">Actions</h4>
                      <div className="flex gap-2">
                        <Button 
                          onClick={() => initializeFunction(functionName)}
                          variant="outline"
                        >
                          Initialize Auto-Recovery
                        </Button>
                        <Button 
                          onClick={() => triggerFailover(functionName)}
                          variant="outline"
                        >
                          Trigger Failover
                        </Button>
                        <Button 
                          onClick={() => stopMonitoring(functionName)}
                          variant="outline"
                        >
                          Stop Monitoring
                        </Button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </TabsContent>
          ))}
        </Tabs>
      </Card>
    </div>
  );
}