# ADR 0002: Environment variable convention

**Status:** Accepted (Phase 0)

## Decision

All game-deck env vars are prefixed `GAMEDECK_` and live only in `game-deck/apps/web/.env.local` (gitignored — see `game-deck/.gitignore`). They are never added to, or read from, the root `.env.local`.

A template with placeholder (non-secret) values is committed at `game-deck/apps/web/.env.example`.

## Why

- Keeps credential blast radius separate: nothing in game-deck's runtime can accidentally read the main site's Supabase service-role key or Spotify secret, and nothing in the main site can read game-deck's.
- Matches the separate-Supabase-project decision (plan §3) — there's a real second set of credentials to keep isolated, not just a naming convention for its own sake.

## What's pending (user action items)

- **Supabase — done.** A new, separate Supabase project has been created. Still needed: populate `GAMEDECK_SUPABASE_*` in `game-deck/apps/web/.env.local` (not yet present) with that project's URL/keys.
- **Spotify — corrected.** Spotify allows only one registered developer app per account, so game-deck cannot get its own app registration. Instead, `GAMEDECK_SPOTIFY_CLIENT_ID`/`GAMEDECK_SPOTIFY_CLIENT_SECRET` are **copies of the existing legacy Spotify app's credentials** (same app, not a new one) — GAMEDECK_-prefixed here only for isolation/clarity in this codebase, not because it's a distinct Spotify-side app. A second redirect URI must be added to that one Spotify app (in the Spotify developer dashboard) pointing at game-deck's own OAuth callback route; populate `GAMEDECK_SPOTIFY_REDIRECT_URI` with that value. Note: the Spotify consent screen a game-deck customer sees will show the same app name/logo as the legacy site — this is a real branding consideration to resolve before Phase 2 ships to customers, not a technical blocker.
