import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./a11y";

test("an unknown path gets the 404 page with a real 404 status", async ({ page }) => {
  const response = await page.goto("/no-such-page");

  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle(/Page not found/);
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to the home page" })).toHaveAttribute(
    "href",
    "/",
  );

  await expectNoA11yViolations(page);
});
