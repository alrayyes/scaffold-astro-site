import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

// Cloudflare reads public/_headers from the build output. Astro fingerprints
// /_astro/, so those files must be cached for a year and never revalidated.
test("fingerprinted assets are served immutable", async () => {
  const headers = await readFile("public/_headers", "utf8");
  const block = headers.match(/^\/_astro\/\*\n((?:[ \t]+.+\n?)+)/m)?.[1] ?? "";
  expect(block).toContain("Cache-Control: public, max-age=31536000, immutable");
});
