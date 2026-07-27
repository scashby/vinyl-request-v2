# ADR 0001: Monorepo tooling for game-deck

**Status:** Accepted (Phase 0)

## Decision

Use npm workspaces, added additively to the root `package.json`:

```json
"workspaces": ["game-deck/apps/*"]
```

The root app remains its own package (`deadwaxdialogues`), otherwise unchanged. `game-deck/apps/web` is a separate Next.js app with its own `package.json`, `next.config.ts`, and `tsconfig.json`.

## Why

- No new tooling — the repo already uses npm (package-lock.json, no yarn/pnpm/turborepo present).
- Scoped only to `game-deck/*`, so it cannot pull the legacy app into the workspace graph or vice versa.
- Enables a shared internal `packages/*` directory later (e.g. provider connectors reused across Bingo and a future game) without duplicating dependencies, once that need is real (Phase 3+).

## Rejected alternatives

- **Plain folder with its own lockfile (no workspace):** maximum isolation, but no code-sharing mechanism across future games. Kept as the documented fallback below.
- **Turborepo:** adds a new tool, a `turbo.json`, and a learning curve not justified until there are 3+ interdependent packages with real build-caching value. Revisit at Phase 7+ if that materializes.

## Fallback trigger

If npm workspaces causes any regression in the root app's build, dependency resolution, or deploy — fall back to a plain folder with its own `package.json` and lockfile, remove the `workspaces` field from root `package.json`, and re-run the Phase 0 acceptance check.

## Verification performed (Phase 0)

- `npm run build` at root: green before the `workspaces` edit and green after, output unchanged in shape (same route list, same static/dynamic markers).
- `npm run build --workspace=game-deck-web`: green, placeholder page builds and prerenders.
- `git diff -- package.json`: only the `workspaces` field added.
