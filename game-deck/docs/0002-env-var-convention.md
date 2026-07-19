# ADR 0002: Environment variable convention

**Status:** Accepted (Phase 0)

## Decision

All game-deck env vars are prefixed `GAMEDECK_` and live only in `game-deck/apps/web/.env.local` (gitignored — see `game-deck/.gitignore`). They are never added to, or read from, the root `.env.local`.

A template with placeholder (non-secret) values is committed at `game-deck/apps/web/.env.example`.

## Why

- Keeps credential blast radius separate: nothing in game-deck's runtime can accidentally read the main site's Supabase service-role key or Spotify secret, and nothing in the main site can read game-deck's.
- Matches the separate-Supabase-project decision (plan §3) — there's a real second set of credentials to keep isolated, not just a naming convention for its own sake.

## Supabase key naming — corrected

Supabase's legacy JWT-based **`anon`**/**`service_role`** keys are deprecated in favor of new, non-JWT **`publishable`** (`sb_publishable_...`) and **`secret`** (`sb_secret_...`) keys. game-deck uses the new names/formats throughout: `GAMEDECK_SUPABASE_PUBLISHABLE_KEY` (client-side, replaces "anon") and `GAMEDECK_SUPABASE_SECRET_KEY` (server-side, replaces "service_role").

**Do not port the legacy app's `src/lib/supabaseAdmin.ts` JWT-decoding pattern into game-deck** — it decodes the key as a JWT and asserts a `role: service_role` claim, which only works for the old key format. The new `sb_secret_...` keys are opaque tokens, not JWTs, so that decode-and-check approach doesn't apply and shouldn't be reused when building game-deck's own Supabase client wrapper in Phase 1.

## What's pending (user action items)

- **Supabase — done.** A new, separate Supabase project has been created; `game-deck/apps/web/.env.local` is populated with its URL, publishable key, secret key, and direct DB connection string (for CLI migrations only).
- **Spotify — corrected, done.** Spotify allows only one registered developer app per account, so game-deck reuses the existing legacy Spotify app's client ID/secret (same app, not a new one) — GAMEDECK_-prefixed here only for isolation/clarity in this codebase, not because it's a distinct Spotify-side app. `.env.local` has a local-dev redirect URI (`http://127.0.0.1:3000/api/v1/providers/spotify/callback`) to add to that app's Redirect URIs list in the Spotify dashboard now; a production URI will be added once game-deck's domain is chosen (Vercel project setup, still pending). Note: the Spotify consent screen a game-deck customer sees will show the same app name/logo as the legacy site — a real branding consideration to resolve before Phase 2 ships to customers, not a technical blocker.
