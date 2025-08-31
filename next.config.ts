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
  async redirects() {
    return [
      {
        source: "/admin/debug",
        destination: "/404",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
