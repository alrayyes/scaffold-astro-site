import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const workflow = readFileSync(
  new URL("../.github/workflows/release-auto-merge.yml", import.meta.url),
  "utf8",
);

// The opened run skips (no label yet) and the labeled run lands a second
// later in the same group. With cancel-in-progress the labeled run was
// cancelled and auto-merge never armed.
test("a later run never cancels the one that arms auto-merge", () => {
  expect(workflow).not.toMatch(/cancel-in-progress:\s*true/);
  expect(workflow).toMatch(/cancel-in-progress:\s*false/);
});
