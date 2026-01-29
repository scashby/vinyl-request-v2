-- One-time fix for weekly recurring child events that drifted to the wrong weekday.
--
-- This aligns child events to the parent event's recurrence weekday (or the first
-- weekday listed in recurrence_days when provided).
--
-- It only updates child events where the weekday does not match the parent.

WITH parent_events AS (
  SELECT
    id,
    date AS parent_date,
    NULLIF(recurrence_days, '') AS recurrence_days
  FROM events
  WHERE is_recurring = true
    AND recurrence_pattern = 'weekly'
),
resolved_targets AS (
  SELECT
    e.id AS event_id,
    e.date AS child_date,
    CASE
      WHEN p.recurrence_days IS NULL THEN EXTRACT(DOW FROM p.parent_date)::int
      ELSE CASE SPLIT_PART(p.recurrence_days, ',', 1)
        WHEN 'sun' THEN 0
        WHEN 'mon' THEN 1
        WHEN 'tue' THEN 2
        WHEN 'wed' THEN 3
        WHEN 'thu' THEN 4
        WHEN 'fri' THEN 5
        WHEN 'sat' THEN 6
        ELSE EXTRACT(DOW FROM p.parent_date)::int
      END
    END AS target_dow
  FROM events e
  JOIN parent_events p ON e.parent_event_id = p.id
),
misaligned AS (
  SELECT
    event_id,
    child_date,
    target_dow,
    EXTRACT(DOW FROM child_date)::int AS child_dow
  FROM resolved_targets
  WHERE EXTRACT(DOW FROM child_date)::int <> target_dow
)
UPDATE events
SET date = child_date + ((target_dow - child_dow + 7) % 7) * INTERVAL '1 day'
FROM misaligned
WHERE events.id = misaligned.event_id;
