BEGIN;

CREATE TABLE IF NOT EXISTS public.sg_game_bingo_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.sg_tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  source_playlist_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_playlist_names jsonb NOT NULL DEFAULT '[]'::jsonb,
  pool_size integer NOT NULL DEFAULT 0,
  note text,
  created_from_session_id uuid REFERENCES public.sg_game_bingo_sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sg_bingo_presets_tenant ON public.sg_game_bingo_presets(tenant_id, created_at);
ALTER TABLE public.sg_game_bingo_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sg_tenant_scoped_bingo_presets ON public.sg_game_bingo_presets;
CREATE POLICY sg_tenant_scoped_bingo_presets
ON public.sg_game_bingo_presets
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.sg_tenant_memberships m
    WHERE m.tenant_id = sg_game_bingo_presets.tenant_id
      AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sg_tenant_memberships m
    WHERE m.tenant_id = sg_game_bingo_presets.tenant_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin', 'operator')
  )
);

COMMIT;
