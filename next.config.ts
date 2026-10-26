import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const nextConfig = (phase: string): NextConfig => ({
  reactStrictMode: true,
  poweredByHeader: false,
  // Production builds must not replace files used by a running local preview.
  distDir: process.env.RESERVATIONS_LOCAL_TEST === "true"
    ? ".next-reservations"
    : phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  serverExternalPackages: ["@electric-sql/pglite"],
  webpack(config) {
    // Two local dev instances must not watch each other's builds or payment data.
    config.watchOptions = {
      ...config.watchOptions,
      ignored: /(^|[/\\])(\.git|\.next|\.next-dev|\.next-reservations|\.data|node_modules)([/\\]|$)/,
    };
    return config;
  },
  images: {
    qualities: [75, 90, 95],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
        ],
      },
      {
        source: "/reserve/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex" },
        ],
      },
    ];
  },
});

export default nextConfig;
