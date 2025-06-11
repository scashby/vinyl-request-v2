import type { NextConfig } from 'next';

// Use the type from Next.js' own type system for Webpack config
const nextConfig: NextConfig = {
  webpack(config) {
    // TypeScript knows config is type 'import("webpack").Configuration'
    config.resolve = config.resolve || {};
    config.resolve.extensions = config.resolve.extensions || [];
    config.resolve.extensions.push('.ts', '.tsx');
    return config;
  },
  // ...other Next.js config here
};

export default nextConfig;
