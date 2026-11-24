import type { NextConfig } from "next";

// Air-gapped LAN deployment: `next build` otherwise makes an outbound POST to
// telemetry.nextjs.org. Next reads this env var when it constructs the telemetry
// store, which happens after next.config is evaluated, so setting it here is enough.
// Set in code (not .env) because .env* is gitignored and would not reach the server.
process.env.NEXT_TELEMETRY_DISABLED ??= "1";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "victory-vendor/d3-shape": "d3-shape",
      "victory-vendor/d3-scale": "d3-scale",
    };
    return config;
  },
  turbopack: {
    resolveAlias: {
      "victory-vendor/d3-shape": "d3-shape",
      "victory-vendor/d3-scale": "d3-scale",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none';",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-origin",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
