-- Standalone core schema (tenant-scoped, user-supplied catalog)
-- Safe boundary: this migration is only for standalone-games infra.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.sg_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sg_users (
  id uuid PRIMARY KEY,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sg_tenant_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.sg_tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.sg_users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'operator',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sg_tenant_memberships_role_chk CHECK (role IN ('owner', 'admin', 'operator', 'viewer')),
  CONSTRAINT sg_tenant_memberships_unique UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.sg_provider_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.sg_tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_account_id text,
  connection_status text NOT NULL DEFAULT 'active',
  scopes jsonb,
  encrypted_access_token text,
  encrypted_refresh_token text,
  token_expires_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sg_provider_connections_provider_chk CHECK (provider IN ('spotify', 'apple', 'tidal', 'csv')),
  CONSTRAINT sg_provider_connections_status_chk CHECK (connection_status IN ('active', 'revoked', 'expired', 'error'))
);

CREATE TABLE IF NOT EXISTS public.sg_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.sg_tenants(id) ON DELETE CASCADE,
  provider_connection_id uuid REFERENCES public.sg_provider_connections(id) ON DELETE SET NULL,
  provider text NOT NULL,
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  requested_by_user_id uuid REFERENCES public.sg_users(id) ON DELETE SET NULL,
  progress_percent integer NOT NULL DEFAULT 0,
  source_payload jsonb,
  summary jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  CONSTRAINT sg_import_jobs_provider_chk CHECK (provider IN ('spotify', 'apple', 'tidal', 'csv')),
  CONSTRAINT sg_import_jobs_type_chk CHECK (job_type IN ('playlist_import', 'library_import', 'manual_upload')),
  CONSTRAINT sg_import_jobs_status_chk CHECK (status IN ('pending', 'running', 'partial', 'completed', 'failed', 'cancelled')),
  CONSTRAINT sg_import_jobs_progress_chk CHECK (progress_percent >= 0 AND progress_percent <= 100)
);

CREATE TABLE IF NOT EXISTS public.sg_external_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.sg_tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_track_id text NOT NULL,
  provider_uri text,
  track_title text,
  artist_name text,
  album_name text,
  duration_ms integer,
  isrc text,
  raw_payload jsonb,
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sg_external_tracks_provider_chk CHECK (provider IN ('spotify', 'apple', 'tidal', 'csv')),
  CONSTRAINT sg_external_tracks_unique UNIQUE (tenant_id, provider, provider_track_id)
);

CREATE TABLE IF NOT EXISTS public.sg_canonical_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_title text NOT NULL,
  normalized_artist text NOT NULL,
  normalized_album text,
  isrc text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sg_canonical_tracks_unique_key UNIQUE (normalized_title, normalized_artist, normalized_album)
);

CREATE TABLE IF NOT EXISTS public.sg_track_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.sg_tenants(id) ON DELETE CASCADE,
  external_track_id uuid NOT NULL REFERENCES public.sg_external_tracks(id) ON DELETE CASCADE,
  canonical_track_id uuid NOT NULL REFERENCES public.sg_canonical_tracks(id) ON DELETE CASCADE,
  confidence_score numeric(5,4) NOT NULL DEFAULT 0,
  mapping_status text NOT NULL DEFAULT 'auto_matched',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sg_track_mappings_confidence_chk CHECK (confidence_score >= 0 AND confidence_score <= 1),
  CONSTRAINT sg_track_mappings_status_chk CHECK (mapping_status IN ('auto_matched', 'manual_matched', 'unmatched', 'rejected')),
  CONSTRAINT sg_track_mappings_unique_external UNIQUE (tenant_id, external_track_id)
);

CREATE TABLE IF NOT EXISTS public.sg_tenant_playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.sg_tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_playlist_id text,
  name text NOT NULL,
  description text,
  source_import_job_id uuid REFERENCES public.sg_import_jobs(id) ON DELETE SET NULL,
  created_by_user_id uuid REFERENCES public.sg_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sg_tenant_playlists_provider_chk CHECK (provider IN ('spotify', 'apple', 'tidal', 'csv', 'manual'))
);

CREATE TABLE IF NOT EXISTS public.sg_tenant_playlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_playlist_id uuid NOT NULL REFERENCES public.sg_tenant_playlists(id) ON DELETE CASCADE,
  external_track_id uuid REFERENCES public.sg_external_tracks(id) ON DELETE SET NULL,
  canonical_track_id uuid REFERENCES public.sg_canonical_tracks(id) ON DELETE SET NULL,
  sort_order integer NOT NULL,
  display_title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sg_tenant_playlist_items_sort_chk CHECK (sort_order >= 0),
  CONSTRAINT sg_tenant_playlist_items_unique_sort UNIQUE (tenant_playlist_id, sort_order)
);

CREATE TABLE IF NOT EXISTS public.sg_tenant_playlist_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.sg_tenants(id) ON DELETE CASCADE,
  tenant_playlist_id uuid NOT NULL REFERENCES public.sg_tenant_playlists(id) ON DELETE CASCADE,
  snapshot_name text,
  snapshot_payload jsonb NOT NULL,
  created_by_user_id uuid REFERENCES public.sg_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sg_game_bingo_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.sg_tenants(id) ON DELETE CASCADE,
  session_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  playlist_snapshot_id uuid NOT NULL REFERENCES public.sg_tenant_playlist_snapshots(id) ON DELETE RESTRICT,
  round_count integer NOT NULL DEFAULT 3,
  card_count integer NOT NULL DEFAULT 40,
  game_mode text NOT NULL DEFAULT 'single_line',
  call_interval_seconds integer NOT NULL DEFAULT 45,
  created_by_user_id uuid REFERENCES public.sg_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz,
  CONSTRAINT sg_game_bingo_sessions_status_chk CHECK (status IN ('pending', 'running', 'paused', 'completed')),
  CONSTRAINT sg_game_bingo_sessions_round_count_chk CHECK (round_count >= 1),
  CONSTRAINT sg_game_bingo_sessions_card_count_chk CHECK (card_count >= 1),
  CONSTRAINT sg_game_bingo_sessions_mode_chk CHECK (game_mode IN ('single_line', 'double_line', 'triple_line', 'criss_cross', 'four_corners', 'blackout', 'death'))
);

CREATE TABLE IF NOT EXISTS public.sg_game_bingo_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sg_game_bingo_sessions(id) ON DELETE CASCADE,
  call_index integer NOT NULL,
  canonical_track_id uuid REFERENCES public.sg_canonical_tracks(id) ON DELETE SET NULL,
  track_title text NOT NULL,
  artist_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  called_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sg_game_bingo_calls_status_chk CHECK (status IN ('pending', 'called', 'skipped', 'completed')),
  CONSTRAINT sg_game_bingo_calls_unique UNIQUE (session_id, call_index)
);

CREATE INDEX IF NOT EXISTS idx_sg_tenant_memberships_tenant ON public.sg_tenant_memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sg_provider_connections_tenant ON public.sg_provider_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sg_import_jobs_tenant ON public.sg_import_jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sg_external_tracks_tenant ON public.sg_external_tracks(tenant_id, provider);
CREATE INDEX IF NOT EXISTS idx_sg_track_mappings_tenant ON public.sg_track_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sg_tenant_playlists_tenant ON public.sg_tenant_playlists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sg_bingo_sessions_tenant ON public.sg_game_bingo_sessions(tenant_id, status);

ALTER TABLE public.sg_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sg_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sg_tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sg_provider_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sg_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sg_external_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sg_canonical_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sg_track_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sg_tenant_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sg_tenant_playlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sg_tenant_playlist_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sg_game_bingo_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sg_game_bingo_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sg_tenants_membership_select ON public.sg_tenants;
CREATE POLICY sg_tenants_membership_select
ON public.sg_tenants
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.sg_tenant_memberships m
    WHERE m.tenant_id = sg_tenants.id
      AND m.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS sg_tenant_scoped_read ON public.sg_tenant_memberships;
CREATE POLICY sg_tenant_scoped_read
ON public.sg_tenant_memberships
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS sg_tenant_scoped_provider_connections ON public.sg_provider_connections;
CREATE POLICY sg_tenant_scoped_provider_connections
ON public.sg_provider_connections
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.sg_tenant_memberships m
    WHERE m.tenant_id = sg_provider_connections.tenant_id
      AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sg_tenant_memberships m
    WHERE m.tenant_id = sg_provider_connections.tenant_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin', 'operator')
  )
);

DROP POLICY IF EXISTS sg_tenant_scoped_import_jobs ON public.sg_import_jobs;
CREATE POLICY sg_tenant_scoped_import_jobs
ON public.sg_import_jobs
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.sg_tenant_memberships m
    WHERE m.tenant_id = sg_import_jobs.tenant_id
      AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sg_tenant_memberships m
    WHERE m.tenant_id = sg_import_jobs.tenant_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin', 'operator')
  )
);

DROP POLICY IF EXISTS sg_tenant_scoped_external_tracks ON public.sg_external_tracks;
CREATE POLICY sg_tenant_scoped_external_tracks
ON public.sg_external_tracks
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.sg_tenant_memberships m
    WHERE m.tenant_id = sg_external_tracks.tenant_id
      AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sg_tenant_memberships m
    WHERE m.tenant_id = sg_external_tracks.tenant_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin', 'operator')
  )
);

DROP POLICY IF EXISTS sg_tenant_scoped_track_mappings ON public.sg_track_mappings;
CREATE POLICY sg_tenant_scoped_track_mappings
ON public.sg_track_mappings
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.sg_tenant_memberships m
    WHERE m.tenant_id = sg_track_mappings.tenant_id
      AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sg_tenant_memberships m
    WHERE m.tenant_id = sg_track_mappings.tenant_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin', 'operator')
  )
);

DROP POLICY IF EXISTS sg_tenant_scoped_playlists ON public.sg_tenant_playlists;
CREATE POLICY sg_tenant_scoped_playlists
ON public.sg_tenant_playlists
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.sg_tenant_memberships m
    WHERE m.tenant_id = sg_tenant_playlists.tenant_id
      AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sg_tenant_memberships m
    WHERE m.tenant_id = sg_tenant_playlists.tenant_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin', 'operator')
  )
);

DROP POLICY IF EXISTS sg_tenant_scoped_playlist_snapshots ON public.sg_tenant_playlist_snapshots;
CREATE POLICY sg_tenant_scoped_playlist_snapshots
ON public.sg_tenant_playlist_snapshots
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.sg_tenant_memberships m
    WHERE m.tenant_id = sg_tenant_playlist_snapshots.tenant_id
      AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sg_tenant_memberships m
    WHERE m.tenant_id = sg_tenant_playlist_snapshots.tenant_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin', 'operator')
  )
);

DROP POLICY IF EXISTS sg_tenant_scoped_bingo_sessions ON public.sg_game_bingo_sessions;
CREATE POLICY sg_tenant_scoped_bingo_sessions
ON public.sg_game_bingo_sessions
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.sg_tenant_memberships m
    WHERE m.tenant_id = sg_game_bingo_sessions.tenant_id
      AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sg_tenant_memberships m
    WHERE m.tenant_id = sg_game_bingo_sessions.tenant_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin', 'operator')
  )
);

DROP POLICY IF EXISTS sg_bingo_calls_by_session_membership ON public.sg_game_bingo_calls;
CREATE POLICY sg_bingo_calls_by_session_membership
ON public.sg_game_bingo_calls
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.sg_game_bingo_sessions s
    JOIN public.sg_tenant_memberships m ON m.tenant_id = s.tenant_id
    WHERE s.id = sg_game_bingo_calls.session_id
      AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sg_game_bingo_sessions s
    JOIN public.sg_tenant_memberships m ON m.tenant_id = s.tenant_id
    WHERE s.id = sg_game_bingo_calls.session_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin', 'operator')
  )
);

COMMIT;
