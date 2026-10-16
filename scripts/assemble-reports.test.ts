import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
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
  "lighthouse-report/manifest.json",
  "lighthouse-report/localhost-index_html-2026_10_16_16_21_30.report.html",
  "lighthouse-report/localhost-index_html-2026_10_16_16_21_30.report.json",
  "lighthouse-report/localhost-index_html-2026_10_16_16_21_45.report.html",
  "lighthouse-report/localhost-index_html-2026_10_16_16_21_45.report.json",
  "lighthouse-report/localhost-404_html-2026_10_16_16_21_31.report.html",
  "lighthouse-report/localhost-404_html-2026_10_16_16_21_31.report.json",
];

const LH = "lighthouse-report/";
const run = (url: string, stamp: string, representative: boolean, slug: string) => ({
  url,
  isRepresentativeRun: representative,
  htmlPath: `/home/runner/work/site/site/${LH}${slug}-${stamp}.report.html`,
  jsonPath: `/home/runner/work/site/site/${LH}${slug}-${stamp}.report.json`,
  summary: { performance: 1 },
});
const MANIFEST = [
  run("http://localhost/index.html", "2026_10_16_16_21_30", false, "localhost-index_html"),
  run("http://localhost/index.html", "2026_10_16_16_21_45", true, "localhost-index_html"),
  run("http://localhost/404.html", "2026_10_16_16_21_31", true, "localhost-404_html"),
];

async function seed({ without }: { without?: string } = {}) {
  for (const file of FILES) {
    if (file === without) continue;
    await put(file, file.endsWith("manifest.json") ? JSON.stringify(MANIFEST) : file);
  }
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

  test("publishes each audited page's representative run under a name with no timestamp", async () => {
    await seed();
    await assembleReports({ root, out });
    expect(await read("lighthouse/index.report.html")).toBe(
      `${LH}localhost-index_html-2026_10_16_16_21_45.report.html`,
    );
    expect(await read("lighthouse/index.report.json")).toBe(
      `${LH}localhost-index_html-2026_10_16_16_21_45.report.json`,
    );
    expect(await read("lighthouse/404.report.html")).toBe(
      `${LH}localhost-404_html-2026_10_16_16_21_31.report.html`,
    );
  });

  test("keeps the other runs of a page as <page>-2, so none is lost", async () => {
    await seed();
    await assembleReports({ root, out });
    expect(await read("lighthouse/index-2.report.html")).toBe(
      `${LH}localhost-index_html-2026_10_16_16_21_30.report.html`,
    );
    expect(await read("lighthouse/index-2.report.json")).toBe(
      `${LH}localhost-index_html-2026_10_16_16_21_30.report.json`,
    );
  });

  test("leaves no timestamped file in the published directory", async () => {
    await seed();
    await assembleReports({ root, out });
    expect((await readdir(join(out, "lighthouse"))).filter((n) => /\d{4}_\d\d_/.test(n))).toEqual(
      [],
    );
  });

  test("rewrites the manifest so every path is a file name that exists", async () => {
    await seed();
    await assembleReports({ root, out });
    const manifest = JSON.parse(await read("lighthouse/manifest.json"));
    expect(manifest).toHaveLength(3);
    const names = new Set(await readdir(join(out, "lighthouse")));
    for (const entry of manifest) {
      expect(entry.htmlPath).toMatch(/^[^/]+\.report\.html$/);
      expect(entry.jsonPath).toMatch(/^[^/]+\.report\.json$/);
      expect(names.has(entry.htmlPath)).toBe(true);
      expect(names.has(entry.jsonPath)).toBe(true);
    }
    expect(manifest.find((e: { htmlPath: string }) => e.htmlPath === "index.report.html").url).toBe(
      "http://localhost/index.html",
    );
    expect(manifest[0].summary).toEqual({ performance: 1 });
  });

  test("is stable: a second assembly names every file the same", async () => {
    await seed();
    await assembleReports({ root, out });
    const first = (await readdir(join(out, "lighthouse"))).sort();
    await rm(out, { recursive: true });
    await assembleReports({ root, out });
    expect((await readdir(join(out, "lighthouse"))).sort()).toEqual(first);
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
    const lighthouse = await read("lighthouse/index.html");
    expect(lighthouse).toContain('href="index.report.html"');
    expect(lighthouse).toContain('href="404.report.html"');
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
