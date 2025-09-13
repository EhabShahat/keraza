/**
 * Cost Analysis Dashboard Component
 * Displays cost metrics, ROI analysis, and optimization recommendations
 */

'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CostBreakdown {
  functionCosts: number;
  computeCosts: number;
  memoryCosts: number;
  bandwidthCosts: number;
  storageCosts: number;
  databaseCosts: number;
  cacheCosts: number;
  totalCost: number;
}

interface ROIAnalysis {
  period: string;
  beforeOptimization: CostBreakdown;
  afterOptimization: CostBreakdown;
  savings: {
    absolute: number;
    percentage: number;
    monthly: number;
    yearly: number;
  };
  optimizationCost: number;
  paybackPeriod: number;
  roi: number;
  netBenefit: number;
}

interface CostProjection {
  timeframe: 'monthly' | 'quarterly' | 'yearly';
  currentTrajectory: number;
  optimizedTrajectory: number;
  projectedSavings: number;
  confidenceLevel: number;
}

interface CostOptimizationRecommendation {
  category: string;
  priority: 'high' | 'medium' | 'low';
  description: string;
  estimatedSavings: number;
  implementationEffort: 'low' | 'medium' | 'high';
  timeToImplement: number;
}

export default function CostAnalysisDashboard() {
  const [currentCosts, setCurrentCosts] = useState<CostBreakdown | null>(null);
  const [baseline, setBaseline] = useState<CostBreakdown | null>(null);
  const [roiAnalysis, setRoiAnalysis] = useState<ROIAnalysis | null>(null);
  const [projections, setProjections] = useState<CostProjection[]>([]);
  const [recommendations, setRecommendations] = useState<CostOptimizationRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load current costs
      const currentResponse = await fetch('/api/admin/cost-analysis/roi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'current-costs' })
      });

      if (currentResponse.ok) {
        const currentData = await currentResponse.json();
        setCurrentCosts(currentData.data);
      }

      // Load baseline
      const baselineResponse = await fetch('/api/admin/cost-analysis/roi?action=baseline');
      if (baselineResponse.ok) {
        const baselineData = await baselineResponse.json();
        setBaseline(baselineData.baseline);
      }

      // Load projections
      const projectionsResponse = await fetch('/api/admin/cost-analysis/roi?action=projections&timeframe=monthly');
      if (projectionsResponse.ok) {
        const projectionsData = await projectionsResponse.json();
        setProjections(projectionsData.projections);
      }

      // Load recommendations
      const recommendationsResponse = await fetch('/api/admin/cost-analysis/roi?action=recommendations');
      if (recommendationsResponse.ok) {
        const recommendationsData = await recommendationsResponse.json();
        setRecommendations(recommendationsData.recommendations);
      }

      // Calculate ROI if baseline exists
      if (baseline) {
        const roiResponse = await fetch('/api/admin/cost-analysis/roi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'calculate-roi',
            optimizationCost: 5000, // Example optimization cost
            period: '30-day'
          })
        });

        if (roiResponse.ok) {
          const roiData = await roiResponse.json();
          setRoiAnalysis(roiData.data);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cost analysis data');
    } finally {
      setLoading(false);
    }
  };

  const establishBaseline = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/cost-analysis/roi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'establish-baseline' })
      });

      if (response.ok) {
        const data = await response.json();
        setBaseline(data.data);
        await loadDashboardData(); // Reload all data
      } else {
        throw new Error('Failed to establish baseline');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to establish baseline');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading cost analysis...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">Error: {error}</p>
        <Button onClick={loadDashboardData} className="mt-2">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Cost Analysis Dashboard</h2>
        <div className="space-x-2">
          <Button onClick={establishBaseline} variant="outline">
            Establish Baseline
          </Button>
          <Button onClick={loadDashboardData} variant="outline">
            Refresh Data
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="roi">ROI Analysis</TabsTrigger>
          <TabsTrigger value="projections">Projections</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <h3 className="font-semibold text-sm text-gray-600 mb-2">Current Daily Cost</h3>
              <p className="text-2xl font-bold">
                {currentCosts ? formatCurrency(currentCosts.totalCost) : 'N/A'}
              </p>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold text-sm text-gray-600 mb-2">Baseline Daily Cost</h3>
              <p className="text-2xl font-bold">
                {baseline ? formatCurrency(baseline.totalCost) : 'N/A'}
              </p>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold text-sm text-gray-600 mb-2">Daily Savings</h3>
              <p className="text-2xl font-bold text-green-600">
                {baseline && currentCosts 
                  ? formatCurrency(baseline.totalCost - currentCosts.totalCost)
                  : 'N/A'
                }
              </p>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold text-sm text-gray-600 mb-2">Monthly Projection</h3>
              <p className="text-2xl font-bold">
                {currentCosts ? formatCurrency(currentCosts.totalCost * 30) : 'N/A'}
              </p>
            </Card>
          </div>

          {currentCosts && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Cost Breakdown</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Functions</p>
                  <p className="font-semibold">{formatCurrency(currentCosts.functionCosts)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Compute</p>
                  <p className="font-semibold">{formatCurrency(currentCosts.computeCosts)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Bandwidth</p>
                  <p className="font-semibold">{formatCurrency(currentCosts.bandwidthCosts)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Storage</p>
                  <p className="font-semibold">{formatCurrency(currentCosts.storageCosts)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Database</p>
                  <p className="font-semibold">{formatCurrency(currentCosts.databaseCosts)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Cache</p>
                  <p className="font-semibold">{formatCurrency(currentCosts.cacheCosts)}</p>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="roi" className="space-y-4">
          {roiAnalysis ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">ROI Metrics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>ROI Percentage:</span>
                    <span className="font-semibold text-green-600">
                      {roiAnalysis.roi.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payback Period:</span>
                    <span className="font-semibold">
                      {roiAnalysis.paybackPeriod.toFixed(1)} months
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Net Benefit (1 year):</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(roiAnalysis.netBenefit)}
                    </span>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Savings Breakdown</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Daily Savings:</span>
                    <span className="font-semibold">
                      {formatCurrency(roiAnalysis.savings.absolute)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Monthly Savings:</span>
                    <span className="font-semibold">
                      {formatCurrency(roiAnalysis.savings.monthly)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Yearly Savings:</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(roiAnalysis.savings.yearly)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Percentage Reduction:</span>
                    <span className="font-semibold">
                      {roiAnalysis.savings.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            <Card className="p-6 text-center">
              <p className="text-gray-600 mb-4">No ROI analysis available</p>
              <p className="text-sm text-gray-500">
                Establish a cost baseline to enable ROI analysis
              </p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="projections" className="space-y-4">
          {projections.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {projections.map((projection, index) => (
                <Card key={index} className="p-6">
                  <h3 className="text-lg font-semibold mb-4 capitalize">
                    {projection.timeframe} Projection
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600">Current Trajectory</p>
                      <p className="font-semibold">
                        {formatCurrency(projection.currentTrajectory)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Optimized Trajectory</p>
                      <p className="font-semibold text-green-600">
                        {formatCurrency(projection.optimizedTrajectory)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Projected Savings</p>
                      <p className="font-semibold text-green-600">
                        {formatCurrency(projection.projectedSavings)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Confidence Level</p>
                      <p className="font-semibold">{projection.confidenceLevel}%</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center">
              <p className="text-gray-600">No projections available</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          {recommendations.length > 0 ? (
            <div className="space-y-4">
              {recommendations.map((rec, index) => (
                <Card key={index} className="p-6">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold">{rec.description}</h3>
                      <p className="text-sm text-gray-600 capitalize">
                        Category: {rec.category}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(rec.priority)}`}>
                      {rec.priority.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Estimated Savings</p>
                      <p className="font-semibold text-green-600">
                        {formatCurrency(rec.estimatedSavings)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Implementation Effort</p>
                      <p className={`font-semibold capitalize ${getEffortColor(rec.implementationEffort)}`}>
                        {rec.implementationEffort}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Time to Implement</p>
                      <p className="font-semibold">
                        {rec.timeToImplement} days
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center">
              <p className="text-gray-600">No recommendations available</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}