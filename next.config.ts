import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Experimental features (Turbopack compatible)
  experimental: {
    // Add any Turbopack-compatible experimental features here if needed
  },
  // Add browser compatibility
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === "production",
  },
  // Static generation and caching optimizations
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 31536000, // 1 year
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Enable static exports for specific routes
  output: process.env.STATIC_EXPORT === 'true' ? 'export' : undefined,
  // Optimize bundle
  swcMinify: true,
  // Enable compression
  compress: true,
  // Power optimizations
  poweredByHeader: false,
  // Generate static pages at build time
  generateBuildId: async () => {
    // Use timestamp for cache busting
    return `build-${Date.now()}`;
  },
  async redirects() {
    return [
      {
        source: "/admin/debug",
        destination: "/404",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/api/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=60',
          },
          {
            key: 'X-Static-Generation',
            value: 'true',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
