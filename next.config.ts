import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // forbidden() for gated pages (lib/dal.ts). globalNotFound: an unknown address gets app/global-not-found.tsx,
  // a whole document drawn on the server, since the site and the projects are separate root layouts.
  experimental: { authInterrupts: true, globalNotFound: true },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "files-cdn.x.ai",
        port: "",
        pathname: "/**",
        search: "",
      },
    ],
  },
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
