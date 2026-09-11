import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./a11y";

test("greets the visitor's own name back", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "scaffold-astro-site" })).toBeVisible();

  await page.getByLabel("Name").fill("Ada");
  await page.getByRole("button", { name: "Say hello" }).click();

  await expect(page.getByRole("status")).toHaveText("Hello, Ada!");

  await expectNoA11yViolations(page);
});
