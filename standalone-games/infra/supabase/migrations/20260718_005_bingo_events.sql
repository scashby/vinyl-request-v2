BEGIN;

CREATE TABLE IF NOT EXISTS public.sg_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.sg_tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  date text NOT NULL,
  time text,
  location text,
  venue_logo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sg_events_tenant ON public.sg_events(tenant_id, date);
ALTER TABLE public.sg_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sg_tenant_scoped_events ON public.sg_events;
CREATE POLICY sg_tenant_scoped_events
ON public.sg_events
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.sg_tenant_memberships m
    WHERE m.tenant_id = sg_events.tenant_id
      AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sg_tenant_memberships m
    WHERE m.tenant_id = sg_events.tenant_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin', 'operator')
  )
);

ALTER TABLE public.sg_game_bingo_sessions
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.sg_events(id) ON DELETE SET NULL;

COMMIT;
