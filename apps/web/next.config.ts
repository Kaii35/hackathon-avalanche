import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@hack/shared', '@hack/sdk', '@hack/ui'],
  typedRoutes: false,
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
