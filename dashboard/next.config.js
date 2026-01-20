/** @type {import('next').NextConfig} */
const rawBasePath = process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || '';
const basePath = rawBasePath ? `/${rawBasePath.replace(/^\/|\/$/g, '')}` : '';
const baseDomain = (process.env.NEXT_PUBLIC_BASE_DOMAIN || process.env.BASE_DOMAIN || '').replace(/\/$/, '');

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  output: 'standalone',

  // Enable reverse-proxy deployments with subpaths and optional absolute domain
  basePath: basePath || undefined,
  assetPrefix: baseDomain ? `${baseDomain}${basePath}` : undefined,

  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_BASE_DOMAIN: baseDomain,
  },

  serverExternalPackages: ['better-sqlite3'],
  
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          // SECURITY FIX: Restrict CORS to specific origins in production
          // For now, allowing all but consider restricting to your domains
          { key: 'Access-Control-Allow-Origin', value: process.env.ALLOWED_ORIGINS || '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
    ];
  },

  webpack: (config, { isServer }) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    
    if (isServer) {
      config.externals.push('better-sqlite3');
    }
    
    return config;
  },
};

module.exports = nextConfig;