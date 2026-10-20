import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // forbidden() for gated pages (lib/dal.ts)
  experimental: { authInterrupts: true },
  // Sun became Orrery (pm-199): the old page is the Sun's poster now. The exact
  // path only, so /sun/nope stays the site's 404. 308s are cached for good.
  async redirects() {
    return [{ source: "/sun", destination: "/orrery/sun", permanent: true }];
  },
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
