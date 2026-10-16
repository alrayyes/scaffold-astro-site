// Gathers the reports CI produced into the directory Pages serves at
// <page_url>/reports/, in the layout every repo publishes. Run it as
// `bun scripts/assemble-reports.ts <out-dir>` from the repo root, after the
// test, coverage and Lighthouse steps have written their files.
//
// It refuses to run when a required file is missing: a half-populated reports
// directory would deploy, replace the last good one, and 404 the links that
// point at it.
import { access, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

export interface IndexLink {
  label: string;
  href: string;
}

const REQUIRED = [
  "coverage/junit-unit.xml",
  "coverage/lcov.info",
  "coverage/coverage.xml",
  "coverage/html/index.html",
  "playwright-report/junit.xml",
  "lighthouse-report/manifest.json",
];

// Pages has no directory listing, so every directory a link points at needs a
// page of its own. No colours of its own: `color-scheme` lets the browser's
// defaults follow light and dark mode.
export function renderIndex(title: string, links: IndexLink[]): string {
  const items = links
    .map(
      ({ label, href }) =>
        `      <li><a href="${Bun.escapeHTML(href)}">${Bun.escapeHTML(label)}</a></li>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${Bun.escapeHTML(title)}</title>
    <style>
      :root { color-scheme: light dark; }
      body { font: 1rem/1.5 system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; }
      li { margin: 0.5rem 0; }
    </style>
  </head>
  <body>
    <main>
      <h1>${Bun.escapeHTML(title)}</h1>
      <ul>
${items}
      </ul>
    </main>
  </body>
</html>
`;
}

interface ManifestEntry {
  url: string;
  isRepresentativeRun?: boolean;
  htmlPath: string;
  jsonPath: string;
  [key: string]: unknown;
}

// `/` becomes `index`, `/blog/post.html` becomes `blog-post`.
export function pageSlug(url: string): string {
  const slug = new URL(url).pathname
    .replace(/\.html?$/, "")
    .replace(/^\/+|\/+$/g, "")
    .replaceAll("/", "-");
  return slug || "index";
}

// Lighthouse CI stamps every file name with the run's time, so each deploy
// renamed all of them and a manifest cached by the CDN pointed at files that
// were gone. Name each file for its page instead: the representative run is
// `<page>.report.*`, any other run of that page `<page>-2.report.*` and so on.
// The manifest is rewritten to the new bare file names.
export async function stabiliseLighthouse({ from, to }: { from: string; to: string }) {
  const manifest: ManifestEntry[] = JSON.parse(await readFile(join(from, "manifest.json"), "utf8"));
  const ordered = [...manifest].sort(
    (a, b) => Number(!!b.isRepresentativeRun) - Number(!!a.isRepresentativeRun),
  );
  const seen = new Map<string, number>();
  const renamed = new Map<ManifestEntry, ManifestEntry>();

  await mkdir(to, { recursive: true });
  for (const entry of ordered) {
    const slug = pageSlug(entry.url);
    const n = (seen.get(slug) ?? 0) + 1;
    seen.set(slug, n);
    const stem = n === 1 ? slug : `${slug}-${n}`;
    const htmlPath = `${stem}.report.html`;
    const jsonPath = `${stem}.report.json`;
    await cp(join(from, basename(entry.htmlPath)), join(to, htmlPath));
    await cp(join(from, basename(entry.jsonPath)), join(to, jsonPath));
    renamed.set(entry, { ...entry, htmlPath, jsonPath });
  }

  const result = manifest.map((entry) => renamed.get(entry) as ManifestEntry);
  await writeFile(join(to, "manifest.json"), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

export async function assembleReports({ root, out }: { root: string; out: string }) {
  for (const path of REQUIRED) {
    if (!(await exists(join(root, path)))) {
      throw new Error(`missing report input: ${path}`);
    }
  }

  await mkdir(join(out, "tests"), { recursive: true });
  await cp(join(root, "coverage/junit-unit.xml"), join(out, "tests/unit.xml"));
  await cp(join(root, "playwright-report/junit.xml"), join(out, "tests/e2e.xml"));

  await cp(join(root, "coverage/html"), join(out, "coverage"), { recursive: true });
  await cp(join(root, "coverage/lcov.info"), join(out, "coverage/lcov.info"));
  await cp(join(root, "coverage/coverage.xml"), join(out, "coverage/coverage.xml"));

  const runs = await stabiliseLighthouse({
    from: join(root, "lighthouse-report"),
    to: join(out, "lighthouse"),
  });
  const pages = runs.map((run) => run.htmlPath).sort();

  await writeFile(
    join(out, "tests/index.html"),
    renderIndex("Test results", [
      { label: "Unit tests (JUnit XML)", href: "unit.xml" },
      { label: "End-to-end tests (JUnit XML)", href: "e2e.xml" },
    ]),
  );
  await writeFile(
    join(out, "lighthouse/index.html"),
    renderIndex(
      "Lighthouse",
      pages.map((name) => ({ label: name, href: name })),
    ),
  );
  await writeFile(
    join(out, "index.html"),
    renderIndex("Reports", [
      { label: "Test results", href: "tests/" },
      { label: "Coverage", href: "coverage/" },
      { label: "Coverage (Cobertura XML)", href: "coverage/coverage.xml" },
      { label: "Lighthouse", href: "lighthouse/" },
    ]),
  );
}

if (import.meta.main) {
  const out = process.argv[2];
  if (!out) {
    console.error("usage: bun scripts/assemble-reports.ts <out-dir>");
    process.exit(2);
  }
  await assembleReports({ root: process.cwd(), out });
}
