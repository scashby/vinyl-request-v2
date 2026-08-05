-- Support for user-added "custom" tracks (e.g. mix tapes/CDs) that aren't
-- backed by a real Discogs/official release. These get a full
-- artists -> masters -> releases -> release_tracks/recordings -> inventory
-- chain like any owned record, just flagged so downstream code (collection
-- stats, totals, exports) can exclude them if it ever needs to.
-- Idempotent.

BEGIN;

ALTER TABLE public.masters
  ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false;

ALTER TABLE public.releases
  ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false;

COMMIT;
