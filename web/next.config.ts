import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server for the Docker image (ignored by Vercel).
  output: "standalone",
  experimental: {
    agentFeedback: true,
  },
  // Hide the Next.js dev badge (the round "N") that floats over the logo.
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  // Browser calls /api/*; Next.js proxies it to FastAPI, so no CORS and no
  // backend URL in client code. Set API_URL in Vercel/Cloud Run env.
  async rewrites() {
    const apiUrl = process.env.API_URL ?? "http://localhost:8000";
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
