-- Demo seed for Vinyl Bingo (testability)
-- Requires vb_* tables from sql/create-vb-bingo.sql

BEGIN;

WITH t AS (
  INSERT INTO public.vb_templates (name, description, source, setlist_mode, created_by)
  VALUES ('Demo Vinyl Bingo 100', 'Seeded demo playlist for smoke testing', 'demo_seed', false, 'codex')
  RETURNING id
)
INSERT INTO public.vb_template_tracks (
  template_id,
  track_title,
  artist_name,
  album_name,
  side,
  position,
  sort_order
)
SELECT
  t.id,
  'Track ' || gs::text,
  'Artist ' || ((gs % 12) + 1)::text,
  'Album ' || ((gs % 20) + 1)::text,
  CASE WHEN gs % 2 = 0 THEN 'A' ELSE 'B' END,
  ((gs % 10) + 1)::text,
  gs
FROM t
CROSS JOIN generate_series(1, 100) AS gs;

COMMIT;
