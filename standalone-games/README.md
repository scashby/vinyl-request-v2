# Standalone Games Workspace

This folder contains all standalone product work.

Boundary rule:
- Do not move, rename, or modify existing legacy app folders for standalone implementation.
- Standalone APIs must live under apps/web/src/app/api/v1 in this workspace.
- Standalone data should point at a separate database/Supabase project, not the legacy app database.

Environment contract:
- STANDALONE_SUPABASE_URL
- STANDALONE_SUPABASE_SERVICE_ROLE_KEY
- x-tenant-id request header
- x-user-id request header
- x-entitlements request header for local entitlement simulation

Initial scope in this workspace:
- Build platform-neutral game and catalog packages
- Build provider connectors for Spotify, Apple, TIDAL, and CSV
- Build standalone web client as the first client only
- Keep architecture portable for mobile and desktop clients
