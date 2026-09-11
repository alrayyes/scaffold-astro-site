# scaffold-astro-site

[![CI](https://github.com/alrayyes/scaffold-astro-site/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/alrayyes/scaffold-astro-site/actions/workflows/ci.yml)
[![Codecov](https://codecov.io/gh/alrayyes/scaffold-astro-site/graph/badge.svg)](https://codecov.io/gh/alrayyes/scaffold-astro-site)
[![release](https://img.shields.io/github/v/release/alrayyes/scaffold-astro-site?sort=semver)](https://github.com/alrayyes/scaffold-astro-site/releases/latest)
[![licence](https://img.shields.io/badge/licence-unlicensed-lightgrey)](LICENSE)

A GitHub template for a static `Astro` site, deployed to Cloudflare. Run `gh repo
create my-real-site --template alrayyes/scaffold-astro-site` and you get a
site with the conventions already wired in — pinned tooling, Biome linting,
an accessibility-tested Playwright suite, prose linting, secret scanning,
and release automation — rather than a blank directory and a checklist to
work through by hand.

It isn't a real site on its own. The one page it has, a form that greets a
name back, exists so the whole chain — the page, its tests, hooks, CI — has
something real to run against. Replace it with your first real page and
delete this paragraph.

## Requirements

- **[bun](https://bun.sh) 1.3.x** — pinned below 1.4 in `package.json`'s
  `packageManager` field, since Dependabot's bundled bun updater can't yet
  read the newer lockfile format. It's the runtime, the test runner, the
  package manager for the linter, and the [lefthook](https://lefthook.dev)
  that runs the git hooks.
- No external services to build or test locally — `bun run build` writes a
  plain static site to `dist/` that any static host can serve. A Cloudflare
  account is only needed to actually deploy it (see Deployment below).

## Installation

```sh
git clone https://github.com/alrayyes/scaffold-astro-site.git
cd scaffold-astro-site
bun install
```

## Usage

```sh
bun run dev       # local dev server, http://localhost:4321
bun run build     # writes the static site to dist/
bun run preview   # serves the build through wrangler — what the real deploy runs
```

## Deployment

This scaffold ships a `wrangler.jsonc` in static-assets mode: no Worker
script, no adapter, just `dist/` served directly by Cloudflare Workers —
the same shape as this account's other `Astro`/Cloudflare sites
(`movie-planner-web`, `washy-washy-web`).

The deploy itself isn't a step in this repo's own CI. Cloudflare's own
GitHub integration is what actually builds and deploys a project stamped
from this template — connected once, on the Cloudflare dashboard, against
the real repo a site lives in, watching pushes to `main` for production and
opening a preview deployment per pull request. That's a per-project,
dashboard-side setup this template can't do on your behalf (it needs a real
Cloudflare account and project to point at), which is also why `release.yml`
only tags versions and never runs `wrangler deploy` itself: doing so would
just be a second, unattended way to ship the same build Cloudflare's
integration already ships on its own.

`wrangler deploy`/`wrangler versions upload` (the `deploy`/`deploy:version`
scripts) stay available for a manual or CI-driven deploy instead, if a
project stamped from this template ever wants that instead of the GitHub
integration — see [Cloudflare's Workers docs](https://developers.cloudflare.com/workers/wrangler/).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the toolchain, the hooks, and how
a change gets reviewed and released.

## Licence

No licence has been chosen yet — see [`LICENSE`](LICENSE). Pick one before a
project stamped from this template goes anywhere public.
