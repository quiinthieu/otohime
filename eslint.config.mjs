import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    // Generated unmodified SDK/Wasm loader bytes, verified by the asset manifest.
    "public/vendor/peep-box/**",
    "public/vendor/duckdb/**",
    "next-env.d.ts",
    // Vendored verbatim from sea-glass (Apache-2.0).
    "app/(shore)/_lib/sea-glass.mjs",
    // The Cloudflare Worker package: its own lock, types (workerd) and typecheck (npm run typecheck there).
    "ghosts/worker/**",
  ]),
]);

export default eslintConfig;
