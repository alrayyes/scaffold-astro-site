import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assembleReports, renderIndex } from "./assemble-reports";

let root: string;
let out: string;

async function put(path: string, body = path) {
  const file = join(root, path);
  await mkdir(join(file, ".."), { recursive: true });
  await writeFile(file, body);
}

const FILES = [
  "coverage/junit-unit.xml",
  "coverage/lcov.info",
  "coverage/coverage.xml",
  "coverage/html/index.html",
  "coverage/html/src/index.html",
  "playwright-report/junit.xml",
  "lighthouse-report/lhr-1.html",
  "lighthouse-report/lhr-1.json",
];

async function seed({ without }: { without?: string } = {}) {
  for (const file of FILES) if (file !== without) await put(file);
}

const read = (path: string) => readFile(join(out, path), "utf8");

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "reports-in-"));
  out = join(await mkdtemp(join(tmpdir(), "reports-out-")), "reports");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  await rm(join(out, ".."), { recursive: true, force: true });
});

describe("assembleReports", () => {
  test("names each runner's JUnit XML for it, under tests/", async () => {
    await seed();
    await assembleReports({ root, out });
    expect(await read("tests/unit.xml")).toBe("coverage/junit-unit.xml");
    expect(await read("tests/e2e.xml")).toBe("playwright-report/junit.xml");
  });

  test("ships the Cobertura XML and the native lcov file beside the HTML view", async () => {
    await seed();
    await assembleReports({ root, out });
    expect(await read("coverage/coverage.xml")).toBe("coverage/coverage.xml");
    expect(await read("coverage/lcov.info")).toBe("coverage/lcov.info");
    expect(await read("coverage/index.html")).toBe("coverage/html/index.html");
    expect(await read("coverage/src/index.html")).toBe("coverage/html/src/index.html");
  });

  test("copies the Lighthouse CI output, keeping its HTML and JSON pairs", async () => {
    await seed();
    await assembleReports({ root, out });
    expect(await read("lighthouse/lhr-1.html")).toBe("lighthouse-report/lhr-1.html");
    expect(await read("lighthouse/lhr-1.json")).toBe("lighthouse-report/lhr-1.json");
  });

  test("writes an index at the top, in tests/ and in lighthouse/, since Pages has no directory listing", async () => {
    await seed();
    await assembleReports({ root, out });
    const top = await read("index.html");
    for (const href of ["tests/", "coverage/", "coverage/coverage.xml", "lighthouse/"]) {
      expect(top).toContain(`href="${href}"`);
    }
    const tests = await read("tests/index.html");
    expect(tests).toContain('href="unit.xml"');
    expect(tests).toContain('href="e2e.xml"');
    expect(await read("lighthouse/index.html")).toContain('href="lhr-1.html"');
  });

  test.each(FILES.filter((file) => !file.includes("src/") && !file.startsWith("lighthouse")))(
    "refuses to publish a partial set when %s is missing",
    async (missing) => {
      await seed({ without: missing });
      await expect(assembleReports({ root, out })).rejects.toThrow(missing);
    },
  );

  test("refuses to publish without the Lighthouse output", async () => {
    await seed();
    await rm(join(root, "lighthouse-report"), { recursive: true });
    await expect(assembleReports({ root, out })).rejects.toThrow("lighthouse-report");
  });
});

describe("renderIndex", () => {
  test("is a titled, language-tagged page with a heading and a link per entry", () => {
    const html = renderIndex("Reports", [{ label: "Coverage", href: "coverage/" }]);
    expect(html).toStartWith("<!doctype html>");
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<title>Reports</title>");
    expect(html).toContain("<h1>Reports</h1>");
    expect(html).toContain('<a href="coverage/">Coverage</a>');
  });

  test("escapes markup in labels and hrefs", () => {
    const html = renderIndex("A & B", [{ label: "<b>", href: 'x"y' }]);
    expect(html).toContain("<title>A &amp; B</title>");
    expect(html).toContain('<a href="x&quot;y">&lt;b&gt;</a>');
  });
});
