-- Provision a storage bucket for homepage photos (hero, Game Deck teaser).
-- These sections previously had a "photo coming soon" text placeholder
-- with no way to actually upload a real photo — this bucket backs the new
-- image picker on those sections in /admin/edit-home. Mirrors
-- add-events-venue-logo-and-storage.sql. Safe to re-run.

INSERT INTO storage.buckets (id, name, public)
VALUES ('homepage-images', 'homepage-images', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read homepage images'
  ) THEN
    CREATE POLICY "Public read homepage images"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'homepage-images');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated upload homepage images'
  ) THEN
    CREATE POLICY "Authenticated upload homepage images"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'homepage-images');
  END IF;
END $$;
