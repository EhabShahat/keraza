import { promises as fs } from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

export interface APIRoute {
    id: string;
    path: string;
    fullPath: string;
    methods: string[];
    category: 'admin' | 'public' | 'attempts' | 'auth' | 'utility';
    dependencies: string[];
    estimatedComplexity: 'low' | 'medium' | 'high';
    consolidationCandidate: boolean;
    fileSize: number;
    lastModified: Date;
}

export interface FunctionMetrics {
    totalRoutes: number;
    routesByCategory: Record<string, number>;
    routesByComplexity: Record<string, number>;
    consolidationCandidates: number;
    totalFileSize: number;
    averageFileSize: number;
}

export interface PerformanceBaseline {
    timestamp: Date;
    totalFunctions: number;
    estimatedMemoryUsage: number;
    estimatedColdStartTime: number;
    consolidationPotential: number;
}

export class FunctionAnalyzer {
    private apiBasePath: string;
    private routes: APIRoute[] = [];

    constructor(apiBasePath: string = 'src/app/api') {
        this.apiBasePath = apiBasePath;
    }

    /**
     * Scan and catalog all API routes in the project
     */
    async scanRoutes(): Promise<APIRoute[]> {
        console.log('🔍 Starting API route scan...');
        const startTime = performance.now();

        this.routes = [];
        await this.scanDirectory(this.apiBasePath, '');

        const endTime = performance.now();
        console.log(`✅ Scan completed in ${(endTime - startTime).toFixed(2)}ms`);
        console.log(`📊 Found ${this.routes.length} API routes`);

        return this.routes;
    }

    /**
     * Recursively scan directory for route files
     */
    private async scanDirectory(dirPath: string, relativePath: string): Promise<void> {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                const newRelativePath = path.join(relativePath, entry.name);

                if (entry.isDirectory()) {
                    await this.scanDirectory(fullPath, newRelativePath);
                } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
                    await this.analyzeRoute(fullPath, relativePath);
                }
            }
        } catch (error) {
            console.warn(`⚠️  Could not scan directory ${dirPath}:`, error);
        }
    }

    /**
     * Analyze individual route file
     */
    private async analyzeRoute(filePath: string, routePath: string): Promise<void> {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const stats = await fs.stat(filePath);

            const route: APIRoute = {
                id: this.generateRouteId(routePath),
                path: this.normalizeRoutePath(routePath),
                fullPath: filePath,
                methods: this.extractHttpMethods(content),
                category: this.categorizeRoute(routePath),
                dependencies: this.extractDependencies(content),
                estimatedComplexity: this.estimateComplexity(content),
                consolidationCandidate: this.isConsolidationCandidate(routePath, content),
                fileSize: stats.size,
                lastModified: stats.mtime
            };

            this.routes.push(route);
        } catch (error) {
            console.warn(`⚠️  Could not analyze route ${filePath}:`, error);
        }
    }

    /**
     * Generate unique ID for route
     */
    private generateRouteId(routePath: string): string {
        return routePath.replace(/[/\\]/g, '_').replace(/^\._/, '') || 'root';
    }

    /**
     * Normalize route path for API
     */
    private normalizeRoutePath(routePath: string): string {
        return '/api/' + routePath.replace(/[/\\]/g, '/').replace(/^\//, '');
    }

    /**
     * Extract HTTP methods from route file content
     */
    private extractHttpMethods(content: string): string[] {
        const methods: string[] = [];
        const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

        for (const method of httpMethods) {
            if (content.includes(`export async function ${method}`) ||
                content.includes(`export function ${method}`)) {
                methods.push(method);
            }
        }

        return methods.length > 0 ? methods : ['GET']; // Default to GET if none found
    }

    /**
     * Categorize route based on path
     */
    private categorizeRoute(routePath: string): APIRoute['category'] {
        if (routePath.includes('admin')) return 'admin';
        if (routePath.includes('public')) return 'public';
        if (routePath.includes('attempts')) return 'attempts';
        if (routePath.includes('auth')) return 'auth';
        return 'utility';
    }

    /**
     * Extract dependencies from route content
     */
    private extractDependencies(content: string): string[] {
        const dependencies: string[] = [];

        // Check for common dependencies
        if (content.includes('supabase')) dependencies.push('supabase');
        if (content.includes('requireAdmin')) dependencies.push('admin-auth');
        if (content.includes('NextRequest')) dependencies.push('next');
        if (content.includes('jose')) dependencies.push('jwt');
        if (content.includes('zod')) dependencies.push('validation');
        if (content.includes('audit')) dependencies.push('audit-logging');

        return dependencies;
    }

    /**
     * Estimate complexity based on file content
     */
    private estimateComplexity(content: string): APIRoute['estimatedComplexity'] {
        const lines = content.split('\n').length;
        const hasDatabase = content.includes('supabase') || content.includes('sql');
        const hasAuth = content.includes('requireAdmin') || content.includes('jwt');
        const hasValidation = content.includes('zod') || content.includes('validate');

        let complexityScore = 0;

        if (lines > 100) complexityScore += 2;
        else if (lines > 50) complexityScore += 1;

        if (hasDatabase) complexityScore += 1;
        if (hasAuth) complexityScore += 1;
        if (hasValidation) complexityScore += 1;

        if (complexityScore >= 3) return 'high';
        if (complexityScore >= 1) return 'medium';
        return 'low';
    }

    /**
     * Determine if route is a good consolidation candidate
     */
    private isConsolidationCandidate(routePath: string, content: string): boolean {
        // Routes in the same category with similar patterns are good candidates
        const category = this.categorizeRoute(routePath);
        const hasSimpleLogic = content.split('\n').length < 100;
        const hasSimilarAuth = content.includes('requireAdmin') || content.includes('public');

        return hasSimpleLogic && hasSimilarAuth &&
            (category === 'admin' || category === 'public' || category === 'attempts');
    }

    /**
     * Generate comprehensive metrics
     */
    generateMetrics(): FunctionMetrics {
        const routesByCategory = this.routes.reduce((acc, route) => {
            acc[route.category] = (acc[route.category] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const routesByComplexity = this.routes.reduce((acc, route) => {
            acc[route.estimatedComplexity] = (acc[route.estimatedComplexity] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const totalFileSize = this.routes.reduce((sum, route) => sum + route.fileSize, 0);

        return {
            totalRoutes: this.routes.length,
            routesByCategory,
            routesByComplexity,
            consolidationCandidates: this.routes.filter(r => r.consolidationCandidate).length,
            totalFileSize,
            averageFileSize: totalFileSize / this.routes.length
        };
    }

    /**
     * Generate performance baseline
     */
    generatePerformanceBaseline(): PerformanceBaseline {
        const metrics = this.generateMetrics();

        // Estimate memory usage (rough calculation based on file sizes and complexity)
        const estimatedMemoryUsage = this.routes.reduce((total, route) => {
            let baseMemory = route.fileSize * 2; // Rough estimate
            if (route.estimatedComplexity === 'high') baseMemory *= 1.5;
            if (route.estimatedComplexity === 'medium') baseMemory *= 1.2;
            return total + baseMemory;
        }, 0);

        // Estimate cold start time (more functions = longer cold starts)
        const estimatedColdStartTime = Math.min(5000, this.routes.length * 50); // Cap at 5 seconds

        // Calculate consolidation potential (percentage of functions that could be consolidated)
        const consolidationPotential = (metrics.consolidationCandidates / metrics.totalRoutes) * 100;

        return {
            timestamp: new Date(),
            totalFunctions: metrics.totalRoutes,
            estimatedMemoryUsage,
            estimatedColdStartTime,
            consolidationPotential
        };
    }

    /**
     * Export analysis results to JSON
     */
    async exportAnalysis(outputPath: string): Promise<void> {
        const analysis = {
            timestamp: new Date().toISOString(),
            routes: this.routes,
            metrics: this.generateMetrics(),
            baseline: this.generatePerformanceBaseline()
        };

        await fs.writeFile(outputPath, JSON.stringify(analysis, null, 2));
        console.log(`📄 Analysis exported to ${outputPath}`);
    }

    /**
     * Generate consolidation recommendations
     */
    generateConsolidationRecommendations(): Array<{
        category: string;
        routes: APIRoute[];
        consolidatedName: string;
        estimatedSavings: number;
    }> {
        const recommendations: Array<{
            category: string;
            routes: APIRoute[];
            consolidatedName: string;
            estimatedSavings: number;
        }> = [];

        // Group consolidation candidates by category
        const candidatesByCategory = this.routes
            .filter(route => route.consolidationCandidate)
            .reduce((acc, route) => {
                if (!acc[route.category]) acc[route.category] = [];
                acc[route.category].push(route);
                return acc;
            }, {} as Record<string, APIRoute[]>);

        for (const [category, routes] of Object.entries(candidatesByCategory)) {
            if (routes.length > 1) {
                recommendations.push({
                    category,
                    routes,
                    consolidatedName: `${category}-unified-handler`,
                    estimatedSavings: routes.length - 1 // Number of functions that would be eliminated
                });
            }
        }

        return recommendations;
    }

    /**
     * Get routes by category
     */
    getRoutesByCategory(category: APIRoute['category']): APIRoute[] {
        return this.routes.filter(route => route.category === category);
    }

    /**
     * Get all routes
     */
    getAllRoutes(): APIRoute[] {
        return [...this.routes];
    }

    /**
     * Get functions formatted for registry registration
     */
    getFunctionsForRegistry(routes: APIRoute[]): Array<{
        name: string;
        original_path: string;
        category: 'admin' | 'public' | 'attempts' | 'auth' | 'utility';
        http_methods: string[];
        dependencies: string[];
        estimated_complexity: 'low' | 'medium' | 'high';
        consolidation_candidate: boolean;
        file_size: number;
    }> {
        return routes.map(route => ({
            name: route.id,
            original_path: route.path,
            category: route.category,
            http_methods: route.methods,
            dependencies: route.dependencies,
            estimated_complexity: route.estimatedComplexity,
            consolidation_candidate: route.consolidationCandidate,
            file_size: route.fileSize
        }));
    }
}

// Global instance for easy access
export const functionAnalyzer = new FunctionAnalyzer();