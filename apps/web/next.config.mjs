import fs from 'node:fs';
import path from 'node:path';

// Load monorepo root .env if not already present
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (fs.existsSync(rootEnv) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(rootEnv);
  } catch (e) {
    console.warn('[next.config.mjs] Failed to load root .env:', e);
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@morphic/db', '@morphic/shared'],
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
        },
      ],
    },
  ],
};

export default nextConfig;
