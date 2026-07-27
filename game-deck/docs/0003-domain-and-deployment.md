# ADR 0003: Domain and deployment strategy

**Status:** Accepted (Phase 0)

## Decision

game-deck is served at **`play.deadwaxdialogues.com`** — a subdomain of the existing business domain, on its **own Vercel project** rooted at `game-deck/apps/web`.

## Why

game-deck is a product *of* the Dead Wax Dialogues business, not a separate brand, so a fully separate domain isn't warranted. But it needs its own domain-scoped cookies — customers get their own logins in Phase 1, wholly separate from the main site's admin session — so a **subpath** under `www.deadwaxdialogues.com` was rejected:

- A subpath would either merge the two apps' routing into one deployment (defeating the point of the separate `game-deck/` app), or require Vercel multi-zone rewrites stitching two deployments together under one path — real operational coupling (shared versioning/routing config) for no brand benefit over a subdomain.
- A subdomain gets both properties at once: it visibly reads as part of the deadwaxdialogues brand, while remaining a technically independent deployment — own Vercel project, own DNS record, own cookie origin — consistent with the separate-Supabase-project isolation decision (ADR 0002) and the "architecturally independent" requirement.

## Rejected alternatives

- **Fully separate domain (new product name):** maximum independence, but not needed — game-deck is explicitly a product sold under the existing business, not a spin-off brand.
- **Subpath (`www.deadwaxdialogues.com/game-deck`):** simplest DNS, but shares the parent domain's cookie namespace and either merges routing or requires multi-zone rewrite complexity. Rejected.

## Status (Phase 0)

- **Done:** new Vercel project `game-deck-web` created (`scashbys-projects` team/scope), connected to the `scashby/vinyl-request-v2` GitHub repo, `play.deadwaxdialogues.com` added as a domain on the project.
- **Pending (dashboard-only, not exposed by the Vercel CLI used here):** set the project's Root Directory to `game-deck/apps/web` in the Vercel dashboard (Project Settings → General → Root Directory) — needed so Git-based deploys build the right subfolder instead of the repo root. Framework Preset should auto-detect as Next.js once that's set.
- **Pending (DNS provider action, not Vercel):** `deadwaxdialogues.com` uses third-party nameservers (`ns-cloud-b{1..4}.googledomains.com` — Google Cloud DNS, not Vercel DNS). Add this record at whatever console manages that zone (Squarespace/Google domains DNS settings):

  | Type | Name | Value |
  |---|---|---|
  | CNAME | `play` | `5030ad79205a5602.vercel-dns-016.com.` |

  Then re-run `vercel domains verify play.deadwaxdialogues.com --scope scashbys-projects` to confirm.
- Add both Spotify redirect URIs (local dev + `https://play.deadwaxdialogues.com/api/v1/providers/spotify/callback`) to the one existing Spotify app (see ADR 0002) — still pending, user action (Spotify dashboard).
