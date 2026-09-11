# scaffold-astro-site

A GitHub template repo, not a distributed tool. It's built from
`~/.config/claude/CLAUDE.md` and `~/.config/claude/rules/*.md` — read those
for the "why" behind everything below. This file only says what's specific
to this repo.

## What this is

The GitHub-native sibling of the Forgejo template at
`git.higherlearning.eu/alrayyes/scaffold-astro-site` (its issue #1). Same
chassis — `Astro` static site, Biome/Prettier/Vale/LTeX prose tiers,
Playwright with an axe-core accessibility scan, lefthook — with the
CI/release/dependency-bot layer swapped for GitHub-native tooling:
`.github/workflows/` instead of `.forgejo/workflows/`, release-please
instead of semantic-release, Dependabot instead of Renovate. The swap
itself is documented once, centrally, in `skills/repo-creation`'s
"GitHub-native siblings" section — not repeated here or in a per-repo
migration doc that only goes stale.

## Deploy: Cloudflare's GitHub integration, not wrangler in CI

The Forgejo sibling's `release.yml` runs `wrangler pages deploy` in a CI
job, authenticated with `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`/
`CLOUDFLARE_PROJECT_NAME` secrets, against Cloudflare **Pages**. This repo
deliberately does it differently: `wrangler.jsonc` is Cloudflare
**Workers** static-assets mode (`assets.directory`, not
`pages_build_output_dir`), and there's no deploy step in `release.yml` at
all — Cloudflare's own GitHub integration, connected on the Cloudflare
dashboard once a real site's repo exists, watches pushes and builds/deploys
on its own (preview per pull request, production on `main`).

This matches how this account's two actual production `Astro`/Cloudflare
sites work right now — `movie-planner-web` and `washy-washy-web`, both
Workers static-assets mode with no deploy step in their own `release.yml`
— rather than the Forgejo scaffold's older Pages-via-wrangler-in-CI
pattern. It also sidesteps a real problem: a template repo with no actual
Cloudflare project behind it has no legitimate value for
`CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_PROJECT_NAME` to
hold, so wiring a deploy step in here would either fail on every push or
sit on placeholder secrets nobody can verify. Worth raising as a possible
update to the Forgejo scaffold too — its Pages-based approach may itself be
stale relative to what the account's real sites do — but that's a decision
for that repo, not this one.

## Commands

```sh
bun install
bun run dev
bun run build
bun run test                 # test:unit then test:e2e
bun run lint                 # biome check ., bun run format to fix
bun run format:check         # bun run lint:md, lint:prose, lint:mechanics too
```

Full list and what each one does: [CONTRIBUTING.md](CONTRIBUTING.md).

## Gotchas

- **`bun` is pinned below 1.4** (`packageManager: "bun@1.3.14"`), and the
  committed `bun.lock` is `lockfileVersion: 1`, generated with that pinned
  bun rather than whatever's newest locally. `bun` 1.4 defaults new lockfiles
  to `lockfileVersion: 2`, which Dependabot's bundled bun updater (still on
  1.3.5) silently corrupts back down to v1 instead of erroring on — see
  `rules/javascript.md`. Regenerate the lockfile with a pinned-below-1.4
  `bun install` if this ever needs redoing, not whatever `bun` resolves to
  on `PATH`.
- **TypeScript is pinned to 6.0.3, not latest.** `astro check`'s compiler
  API isn't exposed by TypeScript 7's native compiler yet — see
  <https://github.com/withastro/roadmap/discussions/1321> before bumping
  past 6.x. Matches the Forgejo sibling's own pin, for the same reason.
- **Biome doesn't parse `.astro` files at all.** Prettier
  (`prettier-plugin-astro`) formats them; `astro check` type-checks them.
  `biome.json`'s `includes` excludes `public/` (static assets, not
  source).
- **`LICENSE` is deliberately unpicked.** Don't default it to GPL-3.0 or
  anything else; that's a decision the project stamped from this template
  makes, not this template.
- **Dependabot, not Renovate** — GitHub-native, needs no bot collaborator
  granted: `.github/dependabot.yml` is enough on its own.
- **`RELEASE_TOKEN` isn't set on this repo yet.** `release.yml` and
  `release-auto-merge.yml` both need it — ask Ryan to add it
  (`gh secret set RELEASE_TOKEN --repo alrayyes/scaffold-astro-site`,
  `write:repository` scope) once a real `feat`/`fix` commit needs an
  actual release cut. Until then release-please's own workflow run simply
  has nothing to authenticate with.
