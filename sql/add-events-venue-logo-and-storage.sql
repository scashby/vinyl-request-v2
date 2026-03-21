-- Add venue_logo_url to events and provision storage bucket for venue logos.
-- Safe to re-run where possible.

BEGIN;

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS venue_logo_url text;

COMMIT;

-- Storage bucket provisioning (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('venue-logos', 'venue-logos', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

-- Public read policy for venue logos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read venue logos'
  ) THEN
    CREATE POLICY "Public read venue logos"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'venue-logos');
  END IF;
END $$;

-- Authenticated upload policy for venue logos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated upload venue logos'
  ) THEN
    CREATE POLICY "Authenticated upload venue logos"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'venue-logos');
  END IF;
END $$;
