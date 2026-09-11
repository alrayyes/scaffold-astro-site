// Static output: Cloudflare Workers serves the built `dist/` directory
// directly as static assets (wrangler.jsonc), with no adapter or SSR
// runtime needed — the same shape as this account's other Astro/Cloudflare
// sites (movie-planner-web, washy-washy-web).
import codecovAstroPlugin from "@codecov/astro-plugin";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  integrations: [
    // Codecov Bundle Analysis: a build-time plugin, not a CI-time upload
    // step. Reuses the same CODECOV_TOKEN coverage and test results
    // already use — one credential across all three. See
    // skills/repo-creation's "Bundle Analysis" section.
    codecovAstroPlugin({
      enableBundleAnalysis: true,
      bundleName: "scaffold-astro-site",
      uploadToken: process.env.CODECOV_TOKEN,
      gitService: "github",
    }),
  ],
});
