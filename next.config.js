/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // sodium-native is a Node.js native module — exclude from browser bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    // Exclude sodium-native from webpack entirely
    config.externals = [
      ...(Array.isArray(config.externals) ? config.externals : []),
      "sodium-native",
    ];
    return config;
  },
};

module.exports = nextConfig;
