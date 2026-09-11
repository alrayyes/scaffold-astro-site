# Contributing

This file is for whoever changes this template. The [README](README.md) is
for whoever stamps a site out of it.

## Getting set up

- **[bun](https://bun.sh) 1.3.x.** Runtime, test runner, package manager
  for the linter, and the [lefthook](https://lefthook.dev) that runs the
  git hooks — bun is the only thing to install.
- **[Vale](https://vale.sh)** on your `PATH`, for the style tier of the
  prose lint:

  ```sh
  go install github.com/errata-ai/vale/v3/cmd/vale@latest
  ```

  `ltex-cli-plus` needs nothing installed: the hook fetches and caches it
  on first use.

One command installs the linter, the git hooks, and their dependencies:

```sh
bun install
```

An uninstalled hook silently does nothing, which is worse than not having
one, so the `prepare` script runs `lefthook install` for you — `|| true`
because Cloudflare's own build also runs `bun install` (to get `wrangler`
and the rest of `devDependencies` needed to build), and a hook-installation
failure there has no business blocking a deploy.

## Everyday commands

Every one of these is what a hook or CI runs — see `lefthook.yml` and
`.github/workflows/*.yml` for exactly which.

```sh
bun run dev
bun run build
bun run check                # astro check, type-checks .astro and .ts together
bun run test                 # test:unit then test:e2e
bun run test:unit            # bun test src, with coverage
bun run test:e2e             # playwright, against a build served through wrangler

bun run lint                 # biome check ., the check-only form
bun run format                # biome check --write ., the fixer

bun run format:check         # prettier --check (md/yml/astro), add --write to fix
bun run lint:md
bun run lint:prose           # vale
bun run lint:mechanics       # ltex-cli-plus
```

## How it fits together

One page, `src/pages/index.astro`, laid out through `src/layouts/Layout.astro`
— `Astro`'s file-based routing, no framework beyond `Astro` itself.
`src/lib/greeting.ts` is the one bit of real logic (`index.test.ts`'s
sibling, `greeting.test.ts`, uses `bun:test`), purely so the page has
something real to render, test, and run an accessibility scan against. A
real site stamped from this template replaces the page and deletes the
greeting helper.

`e2e/a11y.ts` is a reusable Playwright helper —
`new AxeBuilder({ page }).withTags([...]).analyze()` against WCAG 2.1 A/AA,
asserting `violations` is empty. `e2e/home.spec.ts` calls it as the last
step of a real journey test (fill the form, submit, check the result),
never as a parallel suite re-driving the same pages just to run a scanner.
Add the same call to whichever journey test already exercises a new page,
rather than writing a second suite.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/):
`type(scope): description`, types `feat`/`fix`/`docs`/`style`/`refactor`/
`perf`/`test`/`build`/`ci`/`chore`/`revert`. Subject under 50 characters,
lowercase, no trailing full stop. commitlint enforces the shape at
commit-msg and again in CI; the length and case rules are tighter than what
it checks, so hold to them anyway.

## Branching, review, and release

Every change goes through a pull request — nothing is pushed straight to
`main`, including the bootstrapping that built this repo. Branch protection
is on (`Settings → Branches → main`): a pull request is required, though no
approval count is enforced mechanically, so PR-only discipline still comes
down to whoever's committing rather than the platform alone.

The pull request **title** has to be a valid Conventional Commit too —
`pr-title.yml` checks it. commitlint only ever reads commit objects, and a
squash merge defaults its commit message to the pull request title, so this
is the only check standing between a badly titled pull request and a bad
message on `main`.

Once a pull request's checks are green, squash-merge it and delete the
branch. [release-please](https://github.com/googleapis/release-please)
reads the Conventional Commits on `main` and keeps a release pull request
open with the next version and changelog entry; merging that one tags the
release. Nobody picks a version by hand.

Deploys are separate from all of this: Cloudflare's own GitHub integration
watches a real site's repo and builds/deploys on every push (preview per
pull request, production on `main`), configured on the Cloudflare
dashboard, not in this repo's workflows — see the README's Deployment
section.
