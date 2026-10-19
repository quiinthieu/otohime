import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // forbidden() for gated pages (lib/dal.ts)
  experimental: { authInterrupts: true },
  // Commit the build came from; layout.tsx publishes it as <meta name="build-sha">.
  env: {
    BUILD_SHA: process.env.GITHUB_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
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
