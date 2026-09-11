import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * One assertion in an existing journey test, not a parallel suite re-driving
 * the same pages — see rules/a11y.md. WCAG 2.1 A/AA only; any violation
 * fails the run rather than only being logged.
 */
export async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}
