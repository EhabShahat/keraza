"use client";

import { useEffect, useState } from 'react';
import { RealtimeStats } from '@/lib/api/realtime-attempt';

interface RealtimeAttemptMonitorProps {
  examId?: string;
  refreshInterval?: number;
  className?: string;
}

interface AttemptActivity {
  attempt_id: string;
  exam_id: string;
  student_name?: string;
  started_at: string;
  last_activity: string;
  progress_data?: any;
  ip_address?: string;
}

/**
 * Real-time monitoring component for active attempts
 */
export function RealtimeAttemptMonitor({
  examId,
  refreshInterval = 10000,
  className = ""
}: RealtimeAttemptMonitorProps) {
  const [stats, setStats] = useState<RealtimeStats | null>(null);
  const [activeAttempts, setActiveAttempts] = useState<AttemptActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRealtimeData();
    
    const interval = setInterval(fetchRealtimeData, refreshInterval);
    return () => clearInterval(interval);
  }, [examId, refreshInterval]);

  const fetchRealtimeData = async () => {
    try {
      // Fetch real-time stats
      const statsResponse = await fetch(`/api/attempts/stats?action=realtime`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'stats',
          data: {}
        })
      });

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      // Fetch active attempts
      const attemptsUrl = examId 
        ? `/api/attempts/monitor?action=stats&type=active&exam_id=${examId}`
        : `/api/attempts/monitor?action=stats&type=active`;

      const attemptsResponse = await fetch(attemptsUrl);
      
      if (attemptsResponse.ok) {
        const attemptsData = await attemptsResponse.json();
        setActiveAttempts(attemptsData.active_attempts || []);
      }

      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch real-time data');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (startTime: string): string => {
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins}m`;
    }
    
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  };

  const formatLastActivity = (lastActivity: string): string => {
    const last = new Date(lastActivity);
    const now = new Date();
    const diffMs = now.getTime() - last.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    
    if (diffSecs < 60) {
      return `${diffSecs}s ago`;
    }
    
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }
    
    const hours = Math.floor(diffMins / 60);
    return `${hours}h ago`;
  };

  if (loading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Real-time Monitoring Error
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Real-time Statistics */}
      {stats && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Real-time Statistics
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {stats.activeConnections}
              </div>
              <div className="text-sm text-blue-600">Active Connections</div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {stats.totalSyncOperations}
              </div>
              <div className="text-sm text-green-600">Sync Operations</div>
            </div>
            
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-600">
                {stats.conflictResolutions}
              </div>
              <div className="text-sm text-yellow-600">Conflicts Resolved</div>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">
                {stats.averageLatency}ms
              </div>
              <div className="text-sm text-purple-600">Avg Latency</div>
            </div>
          </div>

          {stats.lastSyncTime && (
            <div className="mt-4 text-sm text-gray-500">
              Last sync: {new Date(stats.lastSyncTime).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {/* Active Attempts */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Active Attempts ({activeAttempts.length})
          </h3>
        </div>
        
        {activeAttempts.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No active attempts at the moment
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Activity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activeAttempts.map((attempt) => (
                  <tr key={attempt.attempt_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {attempt.student_name || 'Anonymous'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {attempt.attempt_id.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDuration(attempt.started_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatLastActivity(attempt.last_activity)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {attempt.ip_address || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <span className="w-1.5 h-1.5 mr-1.5 bg-green-400 rounded-full animate-pulse"></span>
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default RealtimeAttemptMonitor;