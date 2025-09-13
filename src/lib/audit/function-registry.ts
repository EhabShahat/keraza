import { supabaseServer } from '@/lib/supabase/server';

export interface FunctionRegistryEntry {
  id: string;
  name: string;
  original_path: string;
  current_path?: string;
  category: 'admin' | 'public' | 'attempts' | 'auth' | 'utility';
  status: 'active' | 'deprecated' | 'migrated' | 'consolidated';
  consolidation_target?: string;
  http_methods: string[];
  dependencies: string[];
  estimated_complexity: 'low' | 'medium' | 'high';
  consolidation_candidate: boolean;
  file_size: number;
  created_at: string;
  updated_at: string;
  migrated_at?: string;
  notes?: string;
}

export interface ConsolidationPlan {
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

export interface PerformanceBaseline {
  id: string;
  baseline_type: 'initial' | 'milestone' | 'final';
  timestamp: string;
  total_functions: number;
  avg_response_time_ms: number;
  memory_usage_mb: number;
  error_rate_percent: number;
  throughput_rpm: number;
  consolidation_potential_percent: number;
  cost_estimate_monthly?: number;
  notes?: string;
}

export interface OptimizationRecommendation {
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

export interface DashboardData {
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

export class FunctionRegistry {
  private supabase;

  constructor() {
    this.supabase = supabaseServer();
  }

  /**
   * Register a new function in the registry
   */
  async registerFunction(params: {
    name: string;
    original_path: string;
    category: FunctionRegistryEntry['category'];
    http_methods: string[];
    dependencies: string[];
    estimated_complexity: FunctionRegistryEntry['estimated_complexity'];
    consolidation_candidate: boolean;
    file_size: number;
  }): Promise<string> {
    const { data, error } = await this.supabase.rpc('register_function', {
      p_name: params.name,
      p_original_path: params.original_path,
      p_category: params.category,
      p_http_methods: params.http_methods,
      p_dependencies: params.dependencies,
      p_estimated_complexity: params.estimated_complexity,
      p_consolidation_candidate: params.consolidation_candidate,
      p_file_size: params.file_size
    });

    if (error) {
      throw new Error(`Failed to register function: ${error.message}`);
    }

    return data;
  }

  /**
   * Bulk register functions from analysis results
   */
  async bulkRegisterFunctions(functions: Array<{
    name: string;
    original_path: string;
    category: FunctionRegistryEntry['category'];
    http_methods: string[];
    dependencies: string[];
    estimated_complexity: FunctionRegistryEntry['estimated_complexity'];
    consolidation_candidate: boolean;
    file_size: number;
  }>): Promise<void> {
    console.log(`📝 Registering ${functions.length} functions...`);
    
    const results = await Promise.allSettled(
      functions.map(func => this.registerFunction(func))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`✅ Successfully registered ${successful} functions`);
    if (failed > 0) {
      console.warn(`⚠️  Failed to register ${failed} functions`);
    }
  }

  /**
   * Update function metrics
   */
  async updateFunctionMetrics(params: {
    function_name: string;
    invocations: number;
    avg_duration_ms: number;
    max_duration_ms: number;
    min_duration_ms: number;
    error_count: number;
    success_count: number;
    memory_usage_mb: number;
    throughput_rpm: number;
  }): Promise<void> {
    const { error } = await this.supabase.rpc('update_function_metrics', {
      p_function_name: params.function_name,
      p_invocations: params.invocations,
      p_avg_duration_ms: params.avg_duration_ms,
      p_max_duration_ms: params.max_duration_ms,
      p_min_duration_ms: params.min_duration_ms,
      p_error_count: params.error_count,
      p_success_count: params.success_count,
      p_memory_usage_mb: params.memory_usage_mb,
      p_throughput_rpm: params.throughput_rpm
    });

    if (error) {
      throw new Error(`Failed to update function metrics: ${error.message}`);
    }
  }

  /**
   * Get consolidation candidates by category
   */
  async getConsolidationCandidates(category?: string): Promise<FunctionRegistryEntry[]> {
    const { data, error } = await this.supabase.rpc('get_consolidation_candidates', {
      p_category: category || null
    });

    if (error) {
      throw new Error(`Failed to get consolidation candidates: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Create a consolidation plan
   */
  async createConsolidationPlan(params: {
    consolidation_name: string;
    category: string;
    target_handler_path: string;
    function_names: string[];
  }): Promise<string> {
    const { data, error } = await this.supabase.rpc('create_consolidation_plan', {
      p_consolidation_name: params.consolidation_name,
      p_category: params.category,
      p_target_handler_path: params.target_handler_path,
      p_function_names: params.function_names
    });

    if (error) {
      throw new Error(`Failed to create consolidation plan: ${error.message}`);
    }

    return data;
  }

  /**
   * Record performance baseline
   */
  async recordPerformanceBaseline(params: {
    baseline_type: PerformanceBaseline['baseline_type'];
    total_functions: number;
    avg_response_time_ms: number;
    memory_usage_mb: number;
    error_rate_percent: number;
    throughput_rpm: number;
    consolidation_potential_percent: number;
    notes?: string;
  }): Promise<string> {
    const { data, error } = await this.supabase.rpc('record_performance_baseline', {
      p_baseline_type: params.baseline_type,
      p_total_functions: params.total_functions,
      p_avg_response_time_ms: params.avg_response_time_ms,
      p_memory_usage_mb: params.memory_usage_mb,
      p_error_rate_percent: params.error_rate_percent,
      p_throughput_rpm: params.throughput_rpm,
      p_consolidation_potential_percent: params.consolidation_potential_percent,
      p_notes: params.notes || null
    });

    if (error) {
      throw new Error(`Failed to record performance baseline: ${error.message}`);
    }

    return data;
  }

  /**
   * Get all functions in registry
   */
  async getAllFunctions(): Promise<FunctionRegistryEntry[]> {
    const { data, error } = await this.supabase
      .from('function_registry')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to get functions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get functions by status
   */
  async getFunctionsByStatus(status: FunctionRegistryEntry['status']): Promise<FunctionRegistryEntry[]> {
    const { data, error } = await this.supabase
      .from('function_registry')
      .select('*')
      .eq('status', status)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to get functions by status: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update function status
   */
  async updateFunctionStatus(functionId: string, status: FunctionRegistryEntry['status']): Promise<void> {
    const updateData: Partial<FunctionRegistryEntry> = { status };
    
    if (status === 'migrated' || status === 'consolidated') {
      updateData.migrated_at = new Date().toISOString();
    }

    const { error } = await this.supabase
      .from('function_registry')
      .update(updateData)
      .eq('id', functionId);

    if (error) {
      throw new Error(`Failed to update function status: ${error.message}`);
    }
  }

  /**
   * Get consolidation plans
   */
  async getConsolidationPlans(): Promise<ConsolidationPlan[]> {
    const { data, error } = await this.supabase
      .from('consolidation_progress')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get consolidation plans: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update consolidation plan status
   */
  async updateConsolidationPlan(planId: string, updates: Partial<ConsolidationPlan>): Promise<void> {
    const { error } = await this.supabase
      .from('consolidation_progress')
      .update(updates)
      .eq('id', planId);

    if (error) {
      throw new Error(`Failed to update consolidation plan: ${error.message}`);
    }
  }

  /**
   * Get performance baselines
   */
  async getPerformanceBaselines(): Promise<PerformanceBaseline[]> {
    const { data, error } = await this.supabase
      .from('performance_baselines')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      throw new Error(`Failed to get performance baselines: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get optimization dashboard data
   */
  async getDashboardData(): Promise<DashboardData> {
    const { data, error } = await this.supabase.rpc('get_optimization_dashboard');

    if (error) {
      throw new Error(`Failed to get dashboard data: ${error.message}`);
    }

    return data || {
      total_functions: 0,
      consolidated_functions: 0,
      consolidation_candidates: 0,
      active_consolidations: 0,
      completed_consolidations: 0,
      total_savings: 0,
      categories: {}
    };
  }

  /**
   * Add optimization recommendation
   */
  async addRecommendation(recommendation: Omit<OptimizationRecommendation, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const { data, error } = await this.supabase
      .from('optimization_recommendations')
      .insert(recommendation)
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to add recommendation: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Get optimization recommendations
   */
  async getRecommendations(status?: OptimizationRecommendation['status']): Promise<OptimizationRecommendation[]> {
    let query = this.supabase
      .from('optimization_recommendations')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get recommendations: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update recommendation status
   */
  async updateRecommendationStatus(
    recommendationId: string, 
    status: OptimizationRecommendation['status'],
    notes?: string
  ): Promise<void> {
    const updateData: Partial<OptimizationRecommendation> = { status };
    
    if (notes) {
      updateData.notes = notes;
    }
    
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await this.supabase
      .from('optimization_recommendations')
      .update(updateData)
      .eq('id', recommendationId);

    if (error) {
      throw new Error(`Failed to update recommendation status: ${error.message}`);
    }
  }
}

// Global instance for easy access
export const functionRegistry = new FunctionRegistry();