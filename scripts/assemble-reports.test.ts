import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assembleReports, pageSlug, renderIndex, stabiliseLighthouse } from "./assemble-reports";

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

describe("pageSlug", () => {
  test.each([
    ["http://localhost/", "index"],
    ["http://localhost/index.html", "index"],
    ["http://localhost/404.html", "404"],
    ["http://localhost/blog/post.html", "blog-post"],
    ["http://localhost/about.htm", "about"],
    ["http://localhost/blog/", "blog"],
    ["http://localhost/caf%C3%A9.html", "caf_e9"],
    ["http://localhost/%C3%A9", "_e9"],
    ["http://localhost/%E6%97%A5%E6%9C%AC", "_65e5_672c"],
    ["http://localhost/%ZZ", "ZZ"],
    ["http://localhost/%E0%A4%A.html", "E0-A4-A"],
    ["http://localhost/a%20b.html", "a-b"],
  ])("%s becomes %s", (url, slug) => {
    expect(pageSlug(url)).toBe(slug);
  });
});

describe("pageSlug length", () => {
  const long = (tail: string) => `http://localhost/${"a".repeat(300)}${tail}`;

  test("leaves a short path's name unchanged", () => {
    expect(pageSlug("http://localhost/blog/post.html")).toBe("blog-post");
  });

  test("shortens a long path to a name that fits a file system, ending in a hash", () => {
    const slug = pageSlug(long(""));
    expect(Buffer.byteLength(`${slug}-2.report.html`)).toBeLessThanOrEqual(200);
    expect(slug).toMatch(/^a+-[0-9a-f]{8}$/);
  });

  test("keeps two long paths that share their first 200 bytes apart", () => {
    expect(pageSlug(long("x"))).not.toBe(pageSlug(long("y")));
  });

  test("leaves a 160-character slug alone and cuts a 161-character one", () => {
    expect(pageSlug(`http://localhost/${"a".repeat(160)}`)).toBe("a".repeat(160));
    expect(pageSlug(`http://localhost/${"a".repeat(161)}`)).toMatch(/^a+-[0-9a-f]{8}$/);
  });

  test("gives the same hash every time", () => {
    expect(pageSlug(long("x"))).toBe(pageSlug(long("x")));
  });

  test("drops a dash the cut lands on, so the hash never follows two", () => {
    const slug = pageSlug(`http://localhost/${"a".repeat(150)}/${"b".repeat(30)}`);
    expect(slug).not.toContain("--");
    expect(slug).toMatch(/-[0-9a-f]{8}$/);
  });

  test("ends a long non-Latin name in a hash", () => {
    const slug = pageSlug(`http://localhost/${encodeURIComponent("日本語".repeat(40))}`);
    expect(slug).toMatch(/-[0-9a-f]{8}$/);
  });

  test("counts bytes, so a long non-Latin path fits too", () => {
    const slug = pageSlug(`http://localhost/${encodeURIComponent("日本語".repeat(40))}`);
    expect(Buffer.byteLength(`${slug}-2.report.html`)).toBeLessThanOrEqual(200);
  });
});

describe("stabiliseLighthouse", () => {
  const stamps = ["2026_10_16_16_21_30", "2026_10_16_16_21_40", "2026_10_16_16_21_50"];

  async function seedRuns(manifest: ReturnType<typeof run>[]) {
    await put(`${LH}manifest.json`, JSON.stringify(manifest));
    for (const entry of manifest) {
      await put(`${LH}${entry.htmlPath.split("/").pop()}`);
      await put(`${LH}${entry.jsonPath.split("/").pop()}`);
    }
  }
  const runs = () =>
    stamps.map((stamp, i) => run("http://localhost/", stamp, i === 1, "localhost-index"));

  test("numbers a third run of a page -3", async () => {
    await seedRuns(runs());
    const result = await stabiliseLighthouse({
      from: join(root, "lighthouse-report"),
      to: join(out, "lighthouse"),
    });
    expect(result.map((e) => e.htmlPath).sort()).toEqual([
      "index-2.report.html",
      "index-3.report.html",
      "index.report.html",
    ]);
  });

  test("gives each non-representative run the same name whatever order the manifest lists them in", async () => {
    const forward = runs();
    await seedRuns(forward);
    const a = await stabiliseLighthouse({
      from: join(root, "lighthouse-report"),
      to: join(out, "a"),
    });
    const b = await stabiliseLighthouse({
      from: join(root, "lighthouse-report"),
      to: join(out, "b"),
    });
    expect(b).toEqual(a);
    await put(`${LH}manifest.json`, JSON.stringify([...forward].reverse()));
    const reversed = await stabiliseLighthouse({
      from: join(root, "lighthouse-report"),
      to: join(out, "c"),
    });
    const byName = (list: typeof a) =>
      Object.fromEntries(list.map((e) => [e.htmlPath, e.jsonPath]));
    expect(byName(reversed)).toEqual(byName(a));
    for (const name of ["index", "index-2", "index-3"]) {
      for (const ext of ["html", "json"]) {
        const file = `${name}.report.${ext}`;
        expect(await readFile(join(out, "c", file), "utf8")).toBe(
          await readFile(join(out, "a", file), "utf8"),
        );
      }
    }
  });

  test.each([
    ["page first", ["http://localhost/foo", "http://localhost/foo-2"]],
    ["numbered name first", ["http://localhost/foo-2", "http://localhost/foo"]],
  ])("refuses a page named like another's numbered run (%s)", async (_label, urls) => {
    const runsOf = (url: string, slug: string) =>
      stamps.slice(0, 2).map((stamp, i) => run(url, stamp, i === 0, slug));
    const [first, second] = urls;
    await seedRuns([...runsOf(first, "localhost-first"), ...runsOf(second, "localhost-second")]);
    await expect(
      stabiliseLighthouse({ from: join(root, "lighthouse-report"), to: join(out, "lighthouse") }),
    ).rejects.toThrow("name clash");
  });

  test("names a page with a percent-encoded path with no % in it, so the index link opens the file", async () => {
    await seed();
    await seedRuns([run("http://localhost/caf%C3%A9.html", stamps[0], true, "localhost-cafe")]);
    await assembleReports({ root, out });
    const names = await readdir(join(out, "lighthouse"));
    expect(names.some((n) => n.includes("%"))).toBe(false);
    const index = await read("lighthouse/index.html");
    for (const n of names.filter((n) => n.endsWith(".report.html"))) {
      expect(index).toContain(`href="${n}"`);
    }
  });

  test("keeps pages that differ only by a non-ASCII character apart, and apart from the home page", async () => {
    await seed();
    await seedRuns([
      run("http://localhost/", stamps[0], true, "localhost-home"),
      run("http://localhost/%C3%A9", stamps[1], true, "localhost-e1"),
      run("http://localhost/%C3%A8", stamps[2], true, "localhost-e2"),
    ]);
    await assembleReports({ root, out });
    const names = (await readdir(join(out, "lighthouse"))).filter((n) =>
      n.endsWith(".report.html"),
    );
    expect(names.sort()).toEqual(["_e8.report.html", "_e9.report.html", "index.report.html"]);
  });

  test("still refuses two URLs that differ only by encoding", async () => {
    await seedRuns([
      run("http://localhost/a%20b.html", stamps[0], true, "localhost-one"),
      run("http://localhost/a-b.html", stamps[1], true, "localhost-two"),
    ]);
    await expect(
      stabiliseLighthouse({ from: join(root, "lighthouse-report"), to: join(out, "lighthouse") }),
    ).rejects.toThrow("name clash");
  });

  test("refuses two different URLs that flatten to the same name, naming both", async () => {
    await seedRuns([
      run("http://localhost/a/b", stamps[0], true, "localhost-a-b"),
      run("http://localhost/a-b", stamps[1], true, "localhost-a-b-x"),
    ]);
    await expect(
      stabiliseLighthouse({ from: join(root, "lighthouse-report"), to: join(out, "lighthouse") }),
    ).rejects.toThrow(/http:\/\/localhost\/a\/b.*http:\/\/localhost\/a-b/);
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
