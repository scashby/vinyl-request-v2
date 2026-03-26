-- Repair Vinyl Sundays series rows 7-15 after accidental bulk overwrite.
--
-- Assumptions:
-- - Event IDs 7..15 are one weekly series.
-- - Event 9 should be dated 2026-03-29.
-- - Queue should be enabled for the full series.
--
-- Run this in Supabase SQL editor.

BEGIN;

-- Preview current state before update.
SELECT id, title, date, has_queue, queue_types, is_recurring, parent_event_id
FROM events
WHERE id BETWEEN 7 AND 15
ORDER BY id;

-- Rebuild weekly dates using event 9 as the anchor date.
-- date(id) = '2026-03-29' + (id - 9) * 7 days
UPDATE events
SET
  date = (
    DATE '2026-03-29' + (((id - 9) * 7)::int)
  )::date,
  has_queue = true,
  -- Keep existing queue_types when present, otherwise provide a safe default.
  queue_types = CASE
    WHEN queue_types IS NULL OR array_length(queue_types, 1) IS NULL THEN ARRAY['general']::text[]
    ELSE queue_types
  END,
  -- Re-establish explicit series linkage for this range.
  parent_event_id = CASE WHEN id = 7 THEN NULL ELSE 7 END,
  is_recurring = CASE WHEN id = 7 THEN true ELSE false END
WHERE id BETWEEN 7 AND 15;

-- Verify repaired state.
SELECT id, title, date, has_queue, queue_types, is_recurring, parent_event_id
FROM events
WHERE id BETWEEN 7 AND 15
ORDER BY id;

COMMIT;
