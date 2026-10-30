const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

/** @type {import('next').NextConfig} */
// mapbox-gl ships un-transpiled ES modules; Next.js needs to transpile them.
const MAPBOX_TRANSPILE = ['mapbox-gl', 'react-map-gl'];
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/admin';

const nextConfig = {
  transpilePackages: MAPBOX_TRANSPILE,
  basePath,
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  async redirects() {
    const adminRoot = basePath.endsWith('/') ? basePath : `${basePath}/`;
    return [
      {
        source: '/',
        destination: adminRoot,
        permanent: false,
        basePath: false,
      },
      {
        source: '/:path((?!admin|_next|favicon.ico).*)',
        destination: `${basePath}/:path`,
        permanent: false,
        basePath: false,
      },
    ];
  },
  async rewrites() {
    const apiUrl = String(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000')
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/api$/i, '');
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${apiUrl}/uploads/:path*`,
      },
    ];
  },
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/node_modules/**', '../node_modules/**', '../src/**', '../uploads/**', '../storage/**'],
    };
    return config;
  },
};

module.exports = nextConfig;
