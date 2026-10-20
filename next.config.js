const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
const { withSentryConfig } = require('@sentry/nextjs');
const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
// CDN host for static assets (/_next/static/*, /public/*). When unset,
// Next.js serves assets from the app's own origin — i.e. it "falls back to
// origin" automatically, so leaving CDN_ASSET_PREFIX unconfigured is a safe
// default for local dev / CI, not a broken state.
const cdnAssetPrefix = process.env.CDN_ASSET_PREFIX || undefined;

const nextConfig = {
  // Gzip/Brotli-compress all server responses (HTML, JSON API payloads, etc.)
  // to cut payload size for slower / mobile connections.
  compress: true,
  // Serve build output (JS/CSS chunks) from a CDN when configured. Next.js
  // fingerprints these files with content hashes, so swapping the prefix on
  // deploy is automatic cache-busting / versioning — no manual query strings.
  assetPrefix: cdnAssetPrefix,
  experimental: {
    serverComponentsExternalPackages: ['@stellar/stellar-sdk', '@vercel/blob'],
  },
  images: {
    // Serve modern formats where the browser supports them; falls back
    // automatically for browsers that don't.
    formats: ["image/webp"],
    // Recipient avatars fall back to Gravatar; served unoptimized so no image
    // requests are proxied through the Next.js optimizer.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.gravatar.com',
        pathname: '/avatar/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // X-XSS-Protection enables the browser's built-in XSS filter (IE/Chrome legacy).
          // Modern browsers rely on CSP instead, but this header provides defence-in-depth
          // for older clients. Mode=block prevents partial rendering of detected attacks.
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(self)',
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/embed/:id',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
        ],
      },
      {
        // Next.js fingerprints build assets with content hashes, so they're
        // safe to cache aggressively and immutably on the client/CDN.
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // Fingerprinted static files under /public (images, fonts, icons).
        source: "/:path*.(svg|jpg|jpeg|png|webp|avif|gif|ico|woff|woff2|ttf|otf)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // JSON API responses: allow short-lived shared caching + revalidation
        // instead of forcing every client to refetch from origin.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "private, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    config.externals = [
      ...(Array.isArray(config.externals) ? config.externals : []),
      'sodium-native',
      ...(isServer
        ? [
            { '@stellar/stellar-sdk': 'commonjs2 @stellar/stellar-sdk' },
            { '@vercel/blob': 'commonjs2 @vercel/blob' },
          ]
        : []),
    ];
    config.resolve.alias = {
      ...config.resolve.alias,
      '@apm-js-collab/tracing-hooks': false,
    };
    return config;
  },
};

const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  // Hide source maps from the client bundle; they are uploaded to Sentry instead.
  hideSourceMaps: true,
  // Upload source maps for all client files, not just the ones referenced in the bundle.
  widenClientFileUpload: true,
  // Route Sentry requests through a same-origin tunnel to avoid ad-blockers.
  tunnelRoute: '/monitoring',
  // Only run the Sentry webpack plugins when a DSN is configured.
  disableServerWebpackPlugin: !process.env.NEXT_PUBLIC_SENTRY_DSN,
  disableClientWebpackPlugin: !process.env.NEXT_PUBLIC_SENTRY_DSN,
};

module.exports = withSentryConfig(
  withBundleAnalyzer(withPWA(nextConfig)),
  sentryWebpackPluginOptions
);
