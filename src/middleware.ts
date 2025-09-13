/**
 * Next.js Middleware with Auto-Recovery Integration
 * Handles load balancing and traffic routing for consolidated functions
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadBalancer, defaultLoadBalancerConfigs } from '@/lib/monitoring/load-balancer';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this is a request to a consolidated function
  if (pathname.startsWith('/api/admin/') && !pathname.includes('/health') && !pathname.includes('/monitoring')) {
    // Route through load balancer for admin functions
    return await loadBalancer.routeRequest(request, {
      ...defaultLoadBalancerConfigs.admin,
      fallback_endpoint: '/api/admin/health' // Fallback to health check
    });
  }

  if (pathname.startsWith('/api/public/') && !pathname.includes('/health')) {
    // Route through load balancer for public functions
    return await loadBalancer.routeRequest(request, {
      ...defaultLoadBalancerConfigs.public,
      fallback_endpoint: '/api/public/health' // Fallback to health check
    });
  }

  if (pathname.startsWith('/api/attempts/') && !pathname.includes('/health')) {
    // Route through load balancer for attempt functions
    return await loadBalancer.routeRequest(request, {
      ...defaultLoadBalancerConfigs.attempts,
      fallback_endpoint: '/api/attempts/health' // Fallback to health check
    });
  }

  // For all other requests, continue normally
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};