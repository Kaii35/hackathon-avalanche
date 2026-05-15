import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@hack/shared', '@hack/sdk', '@hack/ui'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
