/**
 * Dynamic Question Pools System
 * Manages question selection, randomization, and pool-based exam generation
 */

export interface QuestionPool {
  id: string;
  name: string;
  description?: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  questions: Question[];
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'image_annotation';
  question: string;
  options?: string[];
  correct_answer?: string | string[];
  points: number;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  image_url?: string;
  annotations?: AnnotationPoint[];
  usage_count: number;
  success_rate?: number;
  average_time?: number;
}

export interface AnnotationPoint {
  id: string;
  x: number;
  y: number;
  label: string;
  color: string;
}

export interface PoolSelectionCriteria {
  poolIds?: string[];
  categories?: string[];
  difficulties?: ('easy' | 'medium' | 'hard')[];
  tags?: string[];
  questionCount: number;
  balanceByDifficulty?: boolean;
  excludeUsedQuestions?: boolean;
  studentId?: string;
}

export interface ExamConfiguration {
  totalQuestions: number;
  difficultyDistribution?: {
    easy: number;
    medium: number;
    hard: number;
  };
  categoryDistribution?: Record<string, number>;
  randomizeOrder: boolean;
  preventRepeats: boolean;
}

export class QuestionPoolManager {
  /**
   * Generate questions for an exam based on pool criteria
   */
  static async generateExamQuestions(
    criteria: PoolSelectionCriteria,
    config: ExamConfiguration
  ): Promise<Question[]> {
    // Get available question pools
    const pools = await this.getQuestionPools(criteria);
    
    // Collect all eligible questions
    let eligibleQuestions = this.collectEligibleQuestions(pools, criteria);
    
    // Filter out previously used questions if required
    if (criteria.excludeUsedQuestions && criteria.studentId) {
      eligibleQuestions = await this.filterUsedQuestions(eligibleQuestions, criteria.studentId);
    }
    
    // Select questions based on configuration
    const selectedQuestions = this.selectQuestions(eligibleQuestions, config);
    
    // Randomize order if required
    if (config.randomizeOrder) {
      this.shuffleArray(selectedQuestions);
    }
    
    return selectedQuestions;
  }

  /**
   * Get question pools based on criteria
   */
  private static async getQuestionPools(criteria: PoolSelectionCriteria): Promise<QuestionPool[]> {
    // This would typically fetch from your database
    // For now, returning mock data structure
    return [];
  }

  /**
   * Collect questions from pools that match criteria
   */
  private static collectEligibleQuestions(
    pools: QuestionPool[], 
    criteria: PoolSelectionCriteria
  ): Question[] {
    const questions: Question[] = [];
    
    for (const pool of pools) {
      for (const question of pool.questions) {
        // Check difficulty filter
        if (criteria.difficulties && !criteria.difficulties.includes(question.difficulty)) {
          continue;
        }
        
        // Check tags filter
        if (criteria.tags && !criteria.tags.some(tag => question.tags.includes(tag))) {
          continue;
        }
        
        questions.push(question);
      }
    }
    
    return questions;
  }

  /**
   * Filter out questions already used by student
   */
  private static async filterUsedQuestions(
    questions: Question[], 
    studentId: string
  ): Promise<Question[]> {
    // This would check against student's question history
    // Implementation depends on your database structure
    return questions;
  }

  /**
   * Select questions based on exam configuration
   */
  private static selectQuestions(
    questions: Question[], 
    config: ExamConfiguration
  ): Question[] {
    if (config.difficultyDistribution) {
      return this.selectByDifficultyDistribution(questions, config);
    }
    
    if (config.categoryDistribution) {
      return this.selectByCategoryDistribution(questions, config);
    }
    
    // Simple random selection
    this.shuffleArray(questions);
    return questions.slice(0, config.totalQuestions);
  }

  /**
   * Select questions maintaining difficulty distribution
   */
  private static selectByDifficultyDistribution(
    questions: Question[], 
    config: ExamConfiguration
  ): Question[] {
    const { difficultyDistribution } = config;
    if (!difficultyDistribution) return [];

    const selected: Question[] = [];
    const questionsByDifficulty = this.groupByDifficulty(questions);

    // Select easy questions
    const easyQuestions = questionsByDifficulty.easy || [];
    this.shuffleArray(easyQuestions);
    selected.push(...easyQuestions.slice(0, difficultyDistribution.easy));

    // Select medium questions
    const mediumQuestions = questionsByDifficulty.medium || [];
    this.shuffleArray(mediumQuestions);
    selected.push(...mediumQuestions.slice(0, difficultyDistribution.medium));

    // Select hard questions
    const hardQuestions = questionsByDifficulty.hard || [];
    this.shuffleArray(hardQuestions);
    selected.push(...hardQuestions.slice(0, difficultyDistribution.hard));

    return selected;
  }

  /**
   * Select questions maintaining category distribution
   */
  private static selectByCategoryDistribution(
    questions: Question[], 
    config: ExamConfiguration
  ): Question[] {
    const { categoryDistribution } = config;
    if (!categoryDistribution) return [];

    const selected: Question[] = [];
    
    // Group questions by their first tag (assuming first tag is category)
    const questionsByCategory = questions.reduce((acc, question) => {
      const category = question.tags[0] || 'uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(question);
      return acc;
    }, {} as Record<string, Question[]>);

    // Select from each category
    for (const [category, count] of Object.entries(categoryDistribution)) {
      const categoryQuestions = questionsByCategory[category] || [];
      this.shuffleArray(categoryQuestions);
      selected.push(...categoryQuestions.slice(0, count));
    }

    return selected;
  }

  /**
   * Group questions by difficulty
   */
  private static groupByDifficulty(questions: Question[]): Record<string, Question[]> {
    return questions.reduce((acc, question) => {
      if (!acc[question.difficulty]) acc[question.difficulty] = [];
      acc[question.difficulty].push(question);
      return acc;
    }, {} as Record<string, Question[]>);
  }

  /**
   * Shuffle array in place using Fisher-Yates algorithm
   */
  private static shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  /**
   * Analyze question pool performance
   */
  static analyzePoolPerformance(pool: QuestionPool): {
    averageSuccessRate: number;
    difficultyDistribution: Record<string, number>;
    mostUsedQuestions: Question[];
    leastUsedQuestions: Question[];
  } {
    const questions = pool.questions;
    
    // Calculate average success rate
    const questionsWithSuccessRate = questions.filter(q => q.success_rate !== undefined);
    const averageSuccessRate = questionsWithSuccessRate.length > 0
      ? questionsWithSuccessRate.reduce((sum, q) => sum + (q.success_rate || 0), 0) / questionsWithSuccessRate.length
      : 0;

    // Calculate difficulty distribution
    const difficultyDistribution = questions.reduce((acc, q) => {
      acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Find most and least used questions
    const sortedByUsage = [...questions].sort((a, b) => b.usage_count - a.usage_count);
    const mostUsedQuestions = sortedByUsage.slice(0, 5);
    const leastUsedQuestions = sortedByUsage.slice(-5).reverse();

    return {
      averageSuccessRate,
      difficultyDistribution,
      mostUsedQuestions,
      leastUsedQuestions
    };
  }

  /**
   * Suggest optimal question distribution for exam
   */
  static suggestOptimalDistribution(
    availableQuestions: Question[],
    totalQuestions: number,
    targetDifficulty: 'balanced' | 'easy' | 'challenging'
  ): ExamConfiguration['difficultyDistribution'] {
    const distributions = {
      balanced: { easy: 0.4, medium: 0.4, hard: 0.2 },
      easy: { easy: 0.6, medium: 0.3, hard: 0.1 },
      challenging: { easy: 0.2, medium: 0.4, hard: 0.4 }
    };

    const ratios = distributions[targetDifficulty];
    
    return {
      easy: Math.round(totalQuestions * ratios.easy),
      medium: Math.round(totalQuestions * ratios.medium),
      hard: Math.round(totalQuestions * ratios.hard)
    };
  }

  /**
   * Validate question pool integrity
   */
  static validatePool(pool: QuestionPool): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if pool has questions
    if (pool.questions.length === 0) {
      errors.push("Pool contains no questions");
    }

    // Check question validity
    for (const question of pool.questions) {
      if (!question.question.trim()) {
        errors.push(`Question ${question.id} has empty question text`);
      }

      if (question.type === 'multiple_choice' && (!question.options || question.options.length < 2)) {
        errors.push(`Multiple choice question ${question.id} needs at least 2 options`);
      }

      if (!question.correct_answer) {
        warnings.push(`Question ${question.id} has no correct answer defined`);
      }

      if (question.points <= 0) {
        warnings.push(`Question ${question.id} has zero or negative points`);
      }
    }

    // Check difficulty distribution
    const difficultyCount = pool.questions.reduce((acc, q) => {
      acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    if (Object.keys(difficultyCount).length === 1) {
      warnings.push("Pool contains questions of only one difficulty level");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}
