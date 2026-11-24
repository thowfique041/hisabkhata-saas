/** @type {import('next').NextConfig} */
const apiOrigin = process.env.API_ORIGIN || 'http://localhost:4000';

import path from 'node:path';

const nextConfig = {
  reactStrictMode: true,
  // Self-hosted Docker builds use the standalone server; Vercel ignores this.
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  poweredByHeader: false,
  transpilePackages: ['@hisabkhata/shared'],
  // The browser only ever talks to this origin; /api is proxied to the NestJS service.
  // That keeps auth cookies first-party (SameSite=Lax) even when the API lives on Render.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};
export default nextConfig;
