BEGIN;

CREATE TABLE IF NOT EXISTS public.image_assets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  image_kind text NOT NULL CHECK (image_kind IN ('eventImage', 'venueLogo')),
  source_type text NOT NULL CHECK (source_type IN ('supabase', 'external')),
  public_url text NOT NULL,
  storage_path text,
  bucket_name text,
  label text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS image_assets_kind_public_url_idx
  ON public.image_assets (image_kind, public_url);

CREATE UNIQUE INDEX IF NOT EXISTS image_assets_kind_storage_path_idx
  ON public.image_assets (image_kind, storage_path)
  WHERE storage_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS image_assets_kind_archived_idx
  ON public.image_assets (image_kind, archived);

CREATE OR REPLACE FUNCTION public.set_image_assets_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_image_assets_updated_at ON public.image_assets;

CREATE TRIGGER set_image_assets_updated_at
BEFORE UPDATE ON public.image_assets
FOR EACH ROW
EXECUTE FUNCTION public.set_image_assets_updated_at();

ALTER TABLE public.image_assets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'image_assets'
      AND policyname = 'Allow authenticated read of image_assets'
  ) THEN
    CREATE POLICY "Allow authenticated read of image_assets"
      ON public.image_assets
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'image_assets'
      AND policyname = 'Allow authenticated insert of image_assets'
  ) THEN
    CREATE POLICY "Allow authenticated insert of image_assets"
      ON public.image_assets
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'image_assets'
      AND policyname = 'Allow authenticated update of image_assets'
  ) THEN
    CREATE POLICY "Allow authenticated update of image_assets"
      ON public.image_assets
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'image_assets'
      AND policyname = 'Allow authenticated delete of image_assets'
  ) THEN
    CREATE POLICY "Allow authenticated delete of image_assets"
      ON public.image_assets
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

COMMIT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read event images'
  ) THEN
    CREATE POLICY "Public read event images"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'event-images');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated upload event images'
  ) THEN
    CREATE POLICY "Authenticated upload event images"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'event-images');
  END IF;
END $$;
