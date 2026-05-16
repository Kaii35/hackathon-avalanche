import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@hack/shared', '@hack/sdk', '@hack/ui'],
  typedRoutes: false,
  // Pin the monorepo root so Next doesn't accidentally pick up a stray
  // pnpm-lock.yaml in the user's home directory when tracing output files.
  outputFileTracingRoot: path.resolve(__dirname, '../..'),
  webpack(config) {
    // Silence noisy optional deps from wallet libs in browser bundle.
    config.externals = [
      ...(config.externals ?? []),
      {
        '@react-native-async-storage/async-storage':
          'commonjs @react-native-async-storage/async-storage',
      },
      'pino-pretty',
    ];
    return config;
  },
};

export default nextConfig;
