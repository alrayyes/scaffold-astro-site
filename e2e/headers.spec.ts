import { expect, test } from "@playwright/test";

// Header test against the wrangler server the deploy runs on, which reads
// public/_headers the way Cloudflare does (rules/web-performance.md).
test("HTML revalidates on every request", async ({ request }) => {
  const response = await request.get("/");

  expect(response.headers()["cache-control"]).toContain("must-revalidate");
});

test("fingerprinted assets are cached for a year and immutable", async ({ page, request }) => {
  await page.goto("/");
  const urls = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("link[href], script[src]")].map(
      (el) => (el as HTMLLinkElement).href || (el as HTMLScriptElement).src,
    ),
  );
  const assets = urls.filter((url) => new URL(url).pathname.startsWith("/_astro/"));

  // The scaffold's one page inlines its CSS and ships no JS, so there may be
  // nothing under /_astro/ yet. This starts checking when a real page adds one.
  test.skip(assets.length === 0, "the page references no /_astro/ asset yet");

  for (const url of assets) {
    const response = await request.get(url);
    expect(response.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
  }
});
