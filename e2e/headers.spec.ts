import { expect, test } from "@playwright/test";

// Header test against the wrangler server the deploy runs on, which reads
// public/_headers the way Cloudflare does (rules/web-performance.md).
test("HTML revalidates on every request", async ({ request }) => {
  const response = await request.get("/");

  expect(response.headers()["cache-control"]).toContain("must-revalidate");
});

test("pages send the baseline security headers", async ({ request }) => {
  const headers = (await request.get("/")).headers();

  expect(headers["content-security-policy"]).toContain("script-src 'self'");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["strict-transport-security"]).toContain("max-age=31536000");
  expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
  expect(headers["x-frame-options"]).toBe("DENY");
});

test("the CSP lets the home page run its own script", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) violations.push(message.text());
  });

  await page.goto("/");
  await page.getByLabel("Name").fill("Ada");
  await page.getByRole("button", { name: "Say hello" }).click();

  await expect(page.getByRole("status")).not.toBeEmpty();
  expect(violations).toEqual([]);
});

test("fingerprinted assets are cached for a year and immutable", async ({ page, request }) => {
  await page.goto("/");
  const urls = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("link[href], script[src]")].map(
      (el) => (el as HTMLLinkElement).href || (el as HTMLScriptElement).src,
    ),
  );
  const assets = urls.filter((url) => new URL(url).pathname.startsWith("/_astro/"));

  expect(assets.length).toBeGreaterThan(0);

  for (const url of assets) {
    const response = await request.get(url);
    expect(response.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
  }
});
