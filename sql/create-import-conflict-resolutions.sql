CREATE TABLE IF NOT EXISTS public.import_conflict_resolutions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  album_id bigint NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  source text NOT NULL,
  resolution text NOT NULL CHECK (resolution IN ('keep_current', 'use_new', 'merge')),
  kept_value jsonb,
  rejected_value jsonb,
  resolved_at timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS import_conflict_resolutions_album_field_source_key
  ON public.import_conflict_resolutions (album_id, field_name, source);
