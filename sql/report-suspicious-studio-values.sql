-- Review suspicious values currently stored in releases.studio.
-- Intended for manual cleanup review before running bulk updates.

WITH normalized AS (
  SELECT
    id,
    studio,
    lower(trim(coalesce(studio, ''))) AS studio_norm
  FROM public.releases
  WHERE studio IS NOT NULL
    AND trim(studio) <> ''
),
classified AS (
  SELECT
    id,
    studio,
    studio_norm,
    CASE
      WHEN length(studio_norm) > 80 THEN 'too_long'
      WHEN studio_norm LIKE '%media condition%' THEN 'contains_media_condition'
      WHEN studio_norm LIKE '%sleeve condition%' THEN 'contains_sleeve_condition'
      WHEN studio_norm LIKE '%cat no%' OR studio_norm LIKE '%catalog%' THEN 'contains_catalog_text'
      WHEN studio_norm LIKE '%skip%' OR studio_norm LIKE '%scuff%' THEN 'contains_note_language'
      WHEN studio_norm LIKE '%vinyl%' OR studio_norm LIKE '%lp%' OR studio_norm LIKE '%repress%' THEN 'contains_format_language'
      WHEN studio_norm LIKE '%very good%' OR studio_norm LIKE '%mint%' OR studio_norm LIKE '%poor%' THEN 'contains_grade_language'
      WHEN position(E'\n' IN studio) > 0 THEN 'contains_newline'
      WHEN position(';' IN studio) > 0 THEN 'contains_semicolon_list'
      WHEN studio_norm ~ '^[0-9]{2,}$' THEN 'numeric_only'
      ELSE NULL
    END AS suspicious_reason
  FROM normalized
)
SELECT
  suspicious_reason,
  studio,
  COUNT(*) AS usage_count,
  MIN(id) AS sample_release_id
FROM classified
WHERE suspicious_reason IS NOT NULL
GROUP BY suspicious_reason, studio
ORDER BY usage_count DESC, suspicious_reason, studio;
