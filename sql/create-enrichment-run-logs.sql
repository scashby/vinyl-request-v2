-- Persistent enrichment audit logs for scan/review runs
-- Created: 2026-02-14

create table if not exists public.enrichment_run_logs (
  id bigint generated always as identity primary key,
  run_id text not null,
  album_id bigint not null,
  album_artist text,
  album_title text,
  phase text not null default 'scan',
  selected_fields text[] not null default '{}',
  checked_sources text[] not null default '{}',
  returned_sources text[] not null default '{}',
  returned_fields text[] not null default '{}',
  source_payload jsonb,
  proposed_updates jsonb,
  applied_updates jsonb,
  conflict_fields text[] not null default '{}',
  update_status text not null default 'no_change',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_enrichment_run_logs_run_id
  on public.enrichment_run_logs (run_id);

create index if not exists idx_enrichment_run_logs_album_id
  on public.enrichment_run_logs (album_id);

create index if not exists idx_enrichment_run_logs_created_at
  on public.enrichment_run_logs (created_at desc);
