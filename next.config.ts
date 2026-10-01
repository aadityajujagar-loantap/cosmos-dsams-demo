import type { NextConfig } from "next";

// Air-gapped LAN deployment: `next build` otherwise makes an outbound POST to
// telemetry.nextjs.org. Next reads this env var when it constructs the telemetry
// store, which happens after next.config is evaluated, so setting it here is enough.
// Set in code (not .env) because .env* is gitignored and would not reach the server.
process.env.NEXT_TELEMETRY_DISABLED ??= "1";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
