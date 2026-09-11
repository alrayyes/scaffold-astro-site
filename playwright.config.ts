import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // A second, machine-readable reporter alongside the human-readable one —
  // Codecov Test Analytics needs JUnit XML to show per-test failure/flake
  // detail on a PR, not just a coverage delta. CI-only: a local run has no
  // Codecov upload step to feed it.
  reporter: process.env.CI
    ? [["list"], ["junit", { outputFile: "playwright-report/junit.xml" }]]
    : "list",
  use: {
    baseURL: "http://localhost:4321",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Playwright builds and serves the Worker through wrangler, not
  // `astro preview` — Astro's own preview server backgrounds itself instead
  // of staying in the foreground Playwright's webServer expects, and
  // wrangler is the more representative server anyway: it's what the
  // Cloudflare Worker deploy actually runs on.
  webServer: {
    command: "bun run build && bun run preview",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env.CI,
  },
});
