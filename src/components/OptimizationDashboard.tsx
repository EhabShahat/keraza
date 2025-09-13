'use client';

import React, { useEffect, useState } from 'react';

interface DashboardData {
  total_functions: number;
  consolidated_functions: number;
  consolidation_candidates: number;
  active_consolidations: number;
  completed_consolidations: number;
  total_savings: number;
  categories: Record<string, number>;
  latest_baseline?: {
    timestamp: string;
    total_functions: number;
    avg_response_time_ms: number;
    memory_usage_mb: number;
    error_rate_percent: number;
  };
}

interface ConsolidationPlan {
  id: string;
  consolidation_name: string;
  category: string;
  target_handler_path: string;
  status: 'planned' | 'in_progress' | 'testing' | 'deployed' | 'completed' | 'failed';
  functions_count: number;
  functions_migrated: number;
  estimated_savings: number;
  actual_savings: number;
  performance_improvement_percent: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  notes?: string;
}

interface OptimizationRecommendation {
  id: string;
  recommendation_type: 'consolidation' | 'caching' | 'edge_computing' | 'database_optimization';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  estimated_impact: 'low' | 'medium' | 'high';
  estimated_effort: 'low' | 'medium' | 'high';
  functions_affected: string[];
  status: 'open' | 'in_progress' | 'completed' | 'dismissed';
  created_at: string;
  updated_at: string;
  completed_at?: string;
  notes?: string;
}

interface OptimizationDashboardProps {
  className?: string;
}

export function OptimizationDashboard({ className = '' }: OptimizationDashboardProps) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [consolidationPlans, setConsolidationPlans] = useState<ConsolidationPlan[]>([]);
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [dashboardRes, plansRes, recsRes] = await Promise.all([
        fetch('/api/admin/optimization?action=dashboard'),
        fetch('/api/admin/optimization?action=consolidation-plans'),
        fetch('/api/admin/optimization?action=recommendations&status=open')
      ]);

      if (!dashboardRes.ok || !plansRes.ok || !recsRes.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const [dashboard, plans, recs] = await Promise.all([
        dashboardRes.json(),
        plansRes.json(),
        recsRes.json()
      ]);

      setDashboardData(dashboard);
      setConsolidationPlans(plans);
      setRecommendations(recs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'in_progress': return 'text-blue-600 bg-blue-100';
      case 'testing': return 'text-yellow-600 bg-yellow-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">Error Loading Dashboard</h3>
          <p className="text-red-600 mt-1">{error}</p>
          <button 
            onClick={loadDashboardData}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="text-center text-gray-500">No dashboard data available</div>
      </div>
    );
  }

  const consolidationProgress = dashboardData.total_functions > 0 
    ? ((dashboardData.consolidated_functions / dashboardData.total_functions) * 100).toFixed(1)
    : '0';

  return (
    <div className={`p-6 ${className}`}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Function Optimization Dashboard</h2>
        <p className="text-gray-600">Track progress of Netlify Functions optimization and consolidation</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Functions</p>
              <p className="text-3xl font-bold text-gray-900">{dashboardData.total_functions}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Consolidated</p>
              <p className="text-3xl font-bold text-green-600">{dashboardData.consolidated_functions}</p>
              <p className="text-sm text-gray-500">{consolidationProgress}% complete</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Functions Saved</p>
              <p className="text-3xl font-bold text-purple-600">{dashboardData.total_savings}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Candidates</p>
              <p className="text-3xl font-bold text-orange-600">{dashboardData.consolidation_candidates}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Function Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Functions by Category</h3>
          <div className="space-y-3">
            {Object.entries(dashboardData.categories).map(([category, count]) => (
              <div key={category} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 capitalize">{category}</span>
                <div className="flex items-center">
                  <span className="text-sm text-gray-600 mr-2">{count as number}</span>
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${((count as number) / dashboardData.total_functions) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Baseline */}
        {dashboardData.latest_baseline && (
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Latest Performance Baseline</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Response Time</span>
                <span className="text-sm font-medium">{dashboardData.latest_baseline.avg_response_time_ms.toFixed(1)}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Memory Usage</span>
                <span className="text-sm font-medium">{dashboardData.latest_baseline.memory_usage_mb.toFixed(1)}MB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Error Rate</span>
                <span className="text-sm font-medium">{dashboardData.latest_baseline.error_rate_percent.toFixed(2)}%</span>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Last updated: {new Date(dashboardData.latest_baseline.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active Consolidation Plans */}
      <div className="bg-white rounded-lg shadow border mb-6">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Active Consolidation Plans</h3>
        </div>
        <div className="p-6">
          {consolidationPlans.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No active consolidation plans</p>
          ) : (
            <div className="space-y-4">
              {consolidationPlans.slice(0, 5).map((plan: ConsolidationPlan) => (
                <div key={plan.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">{plan.consolidation_name}</h4>
                    <p className="text-sm text-gray-600">
                      {plan.category} • {plan.functions_migrated}/{plan.functions_count} functions migrated
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {plan.functions_count > 0 ? ((plan.functions_migrated / plan.functions_count) * 100).toFixed(0) : 0}%
                      </div>
                      <div className="w-20 bg-gray-200 rounded-full h-2 mt-1">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ 
                            width: `${plan.functions_count > 0 ? (plan.functions_migrated / plan.functions_count) * 100 : 0}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(plan.status)}`}>
                      {plan.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Optimization Recommendations */}
      <div className="bg-white rounded-lg shadow border">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Optimization Recommendations</h3>
        </div>
        <div className="p-6">
          {recommendations.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No open recommendations</p>
          ) : (
            <div className="space-y-4">
              {recommendations.slice(0, 5).map((rec: OptimizationRecommendation) => (
                <div key={rec.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-medium text-gray-900">{rec.title}</h4>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(rec.priority)}`}>
                          {rec.priority}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>Impact: {rec.estimated_impact}</span>
                        <span>Effort: {rec.estimated_effort}</span>
                        <span>Type: {rec.recommendation_type.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}