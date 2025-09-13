/**
 * Success Validation Dashboard Component
 * Displays validation results for optimization success criteria
 */

'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ValidationResult {
  criteriaId: string;
  name: string;
  passed: boolean;
  actualValue: number;
  targetValue: number;
  deviation: number;
  message: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
}

interface SuccessReport {
  timestamp: Date;
  overallSuccess: boolean;
  successRate: number;
  criticalFailures: number;
  highFailures: number;
  mediumFailures: number;
  lowFailures: number;
  results: ValidationResult[];
  summary: {
    performance: { passed: number; total: number };
    cost: { passed: number; total: number };
    reliability: { passed: number; total: number };
    scalability: { passed: number; total: number };
    feature_parity: { passed: number; total: number };
  };
  recommendations: string[];
}

interface FeatureParityResult {
  testId: string;
  name: string;
  passed: boolean;
  actualResponse: any;
  expectedResponse: any;
  responseTime: number;
  error?: string;
}

export default function SuccessValidationDashboard() {
  const [validationReport, setValidationReport] = useState<SuccessReport | null>(null);
  const [featureParityResults, setFeatureParityResults] = useState<FeatureParityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastValidation, setLastValidation] = useState<Date | null>(null);

  useEffect(() => {
    loadValidationSummary();
  }, []);

  const loadValidationSummary = async () => {
    try {
      const response = await fetch('/api/admin/validation/success?type=summary');
      if (response.ok) {
        const data = await response.json();
        // This just loads the summary, not full validation
        console.log('Validation summary loaded:', data.summary);
      }
    } catch (err) {
      console.warn('Failed to load validation summary:', err);
    }
  };

  const runFullValidation = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/validation/success', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'validate-all',
          includeFeatureParity: true 
        })
      });

      if (!response.ok) {
        throw new Error(`Validation failed: ${response.status}`);
      }

      const data = await response.json();
      setValidationReport(data.data);
      setLastValidation(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  const runPerformanceValidation = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/validation/success', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate-performance' })
      });

      if (!response.ok) {
        throw new Error(`Performance validation failed: ${response.status}`);
      }

      const data = await response.json();
      setValidationReport(data.data);
      setLastValidation(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Performance validation failed');
    } finally {
      setLoading(false);
    }
  };

  const runFeatureParityValidation = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/validation/success', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate-feature-parity' })
      });

      if (!response.ok) {
        throw new Error(`Feature parity validation failed: ${response.status}`);
      }

      const data = await response.json();
      setFeatureParityResults(data.data.results);
      setLastValidation(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Feature parity validation failed');
    } finally {
      setLoading(false);
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

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'performance': return 'bg-blue-100 text-blue-800';
      case 'cost': return 'bg-green-100 text-green-800';
      case 'reliability': return 'bg-red-100 text-red-800';
      case 'scalability': return 'bg-purple-100 text-purple-800';
      case 'feature_parity': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatValue = (value: number, category: string) => {
    if (category === 'cost') {
      return `$${value.toFixed(4)}`;
    } else if (category === 'performance' || category === 'reliability') {
      return `${value.toFixed(2)}`;
    } else {
      return value.toFixed(1);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Running validation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Success Validation Dashboard</h2>
          {lastValidation && (
            <p className="text-sm text-gray-600">
              Last validation: {lastValidation.toLocaleString()}
            </p>
          )}
        </div>
        <div className="space-x-2">
          <Button onClick={runPerformanceValidation} variant="outline">
            Validate Performance
          </Button>
          <Button onClick={runFeatureParityValidation} variant="outline">
            Validate Features
          </Button>
          <Button onClick={runFullValidation}>
            Run Full Validation
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">Error: {error}</p>
        </div>
      )}

      {validationReport && (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="results">Detailed Results</TabsTrigger>
            <TabsTrigger value="categories">By Category</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className={`p-4 border-2 ${validationReport.overallSuccess ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <h3 className="font-semibold text-sm text-gray-600 mb-2">Overall Status</h3>
                <p className={`text-2xl font-bold ${validationReport.overallSuccess ? 'text-green-600' : 'text-red-600'}`}>
                  {validationReport.overallSuccess ? 'PASSED' : 'FAILED'}
                </p>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold text-sm text-gray-600 mb-2">Success Rate</h3>
                <p className="text-2xl font-bold">
                  {validationReport.successRate.toFixed(1)}%
                </p>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold text-sm text-gray-600 mb-2">Critical Failures</h3>
                <p className={`text-2xl font-bold ${validationReport.criticalFailures > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {validationReport.criticalFailures}
                </p>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold text-sm text-gray-600 mb-2">Total Criteria</h3>
                <p className="text-2xl font-bold">
                  {validationReport.results.length}
                </p>
              </Card>
            </div>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Category Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {Object.entries(validationReport.summary).map(([category, stats]) => (
                  <div key={category} className="text-center">
                    <p className={`text-xs font-medium px-2 py-1 rounded-full ${getCategoryColor(category)} mb-2`}>
                      {category.replace('_', ' ').toUpperCase()}
                    </p>
                    <p className="text-lg font-semibold">
                      {stats.passed}/{stats.total}
                    </p>
                    <p className="text-xs text-gray-600">
                      {stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(0) : 0}% passed
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            <div className="space-y-3">
              {validationReport.results.map((result, index) => (
                <Card key={index} className={`p-4 border ${result.passed ? 'border-green-200' : 'border-red-200'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold">{result.name}</h4>
                      <p className="text-sm text-gray-600">{result.message}</p>
                    </div>
                    <div className="flex space-x-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(result.category)}`}>
                        {result.category.replace('_', ' ')}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${getPriorityColor(result.priority)}`}>
                        {result.priority.toUpperCase()}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${result.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {result.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Actual Value</p>
                      <p className="font-semibold">{formatValue(result.actualValue, result.category)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Target Value</p>
                      <p className="font-semibold">{formatValue(result.targetValue, result.category)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Deviation</p>
                      <p className={`font-semibold ${result.deviation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {result.deviation > 0 ? '+' : ''}{result.deviation.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            {Object.entries(validationReport.summary).map(([category, stats]) => {
              const categoryResults = validationReport.results.filter(r => r.category === category);
              
              if (categoryResults.length === 0) return null;

              return (
                <Card key={category} className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold capitalize">
                      {category.replace('_', ' ')} ({stats.passed}/{stats.total})
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(category)}`}>
                      {((stats.passed / stats.total) * 100).toFixed(0)}% Success
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    {categoryResults.map((result, index) => (
                      <div key={index} className={`p-3 rounded border ${result.passed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{result.name}</span>
                          <span className={`text-sm font-medium ${result.passed ? 'text-green-600' : 'text-red-600'}`}>
                            {result.passed ? '✓ PASS' : '✗ FAIL'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{result.message}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-4">
            {validationReport.recommendations.length > 0 ? (
              <div className="space-y-3">
                {validationReport.recommendations.map((recommendation, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <p className="text-gray-800">{recommendation}</p>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-6 text-center">
                <p className="text-green-600 font-medium">🎉 All validation criteria passed!</p>
                <p className="text-gray-600 mt-2">No recommendations needed - optimization is ready for deployment.</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {featureParityResults.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Feature Parity Test Results</h3>
          <div className="space-y-2">
            {featureParityResults.map((result, index) => (
              <div key={index} className={`p-3 rounded border ${result.passed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <div className="flex justify-between items-center">
                  <span className="font-medium">{result.name}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">{result.responseTime}ms</span>
                    <span className={`text-sm font-medium ${result.passed ? 'text-green-600' : 'text-red-600'}`}>
                      {result.passed ? '✓ PASS' : '✗ FAIL'}
                    </span>
                  </div>
                </div>
                {result.error && (
                  <p className="text-sm text-red-600 mt-1">{result.error}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {!validationReport && !featureParityResults.length && (
        <Card className="p-8 text-center">
          <p className="text-gray-600 mb-4">No validation results available</p>
          <p className="text-sm text-gray-500 mb-4">
            Run a validation to see success criteria results
          </p>
          <Button onClick={runFullValidation}>
            Run Full Validation
          </Button>
        </Card>
      )}
    </div>
  );
}