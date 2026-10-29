import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  outputFileTracingExcludes: {
    "*": [
      "./public/vendor/**/*",
      "./public/icons/**/*",
      "./node_modules/sharp/**/*",
      "./node_modules/@img/**/*",
    ],
    "/*": [
      "./public/vendor/**/*",
      "./public/icons/**/*",
      "./node_modules/sharp/**/*",
      "./node_modules/@img/**/*",
    ],
  },
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
  async headers() {
    return [
      {
        source: "/play/shadows",
        headers: [{ key: "Permissions-Policy", value: "camera=(self), microphone=()" }],
      },
      {
        source: "/vendor/hand-landmarker/:version/hand-worker.js",
        headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; script-src 'self' blob: 'wasm-unsafe-eval'; connect-src 'self' blob:; worker-src 'none'" }],
      },
      {
        source: "/vendor/duckdb/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; worker-src 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: "/play",
        headers: [
          { key: "Permissions-Policy", value: "camera=(self), microphone=()" },
        ],
      },
      {
        source: "/play/booth",
        headers: [
          { key: "Permissions-Policy", value: "camera=(self), microphone=()" },
        ],
      },
      {
        source: "/vendor/peep-box/:version/head-worker.js",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'none'; script-src 'self' blob: 'wasm-unsafe-eval'; connect-src 'self' blob:; worker-src 'none'",
          },
        ],
      },
    ];
  },
  // Sun became Orrery (pm-199): the old page is the Sun's poster now. The exact
  // path only, so /sun/nope stays the site's 404. 308s are cached for good.
  async redirects() {
    return [{ source: "/sun", destination: "/orrery/sun", permanent: true }];
  },
  // Chrome falls back to /favicon.ico when a soft navigation leaves no icon link (the hop out of a 403); the
  // site's only icon is app/icon.svg, so serve that instead of a 404 console error.
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon.svg" }];
  },
  // Commit the build came from; layout.tsx publishes it as <meta name="build-sha">.
  env: {
    BUILD_SHA:
      process.env.GITHUB_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
    // The day the build ran, YYYY-MM-DD in UTC: the postmark on every page's Open Graph card (lib/og.tsx).
    BUILD_DATE: process.env.BUILD_DATE ?? new Date().toISOString().slice(0, 10),
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
