-- Structured per-field/per-source enrichment diagnostics
-- Created: 2026-02-19

create table if not exists public.enrichment_field_diagnostics (
  id bigint generated always as identity primary key,
  run_id text not null,
  album_id bigint not null,
  field_name text not null,
  source_name text not null,
  outcome_code text not null check (
    outcome_code in (
      'returned_target_field',
      'returned_other_fields',
      'not_found',
      'source_error_auth',
      'source_error_rate_limit',
      'source_error_timeout',
      'source_error_http_other',
      'source_error_parse',
      'source_not_called',
      'source_unavailable'
    )
  ),
  http_status integer,
  reason text,
  returned_keys text[] not null default '{}',
  has_candidate_value boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_enrichment_field_diag_run_id
  on public.enrichment_field_diagnostics (run_id);

create index if not exists idx_enrichment_field_diag_album_id
  on public.enrichment_field_diagnostics (album_id);

create index if not exists idx_enrichment_field_diag_field_source
  on public.enrichment_field_diagnostics (field_name, source_name);

create index if not exists idx_enrichment_field_diag_created_at
  on public.enrichment_field_diagnostics (created_at desc);

create or replace view public.enrichment_pattern_stats as
with grouped as (
  select
    run_id,
    field_name,
    source_name,
    outcome_code,
    count(*)::int as outcome_count
  from public.enrichment_field_diagnostics
  group by run_id, field_name, source_name, outcome_code
),
totals as (
  select
    run_id,
    field_name,
    source_name,
    sum(outcome_count)::int as total_albums_checked
  from grouped
  group by run_id, field_name, source_name
),
ranked as (
  select
    g.run_id,
    g.field_name,
    g.source_name,
    g.outcome_code,
    g.outcome_count,
    t.total_albums_checked,
    row_number() over (
      partition by g.run_id, g.field_name, g.source_name
      order by g.outcome_count desc, g.outcome_code asc
    ) as rn
  from grouped g
  join totals t
    on t.run_id = g.run_id
   and t.field_name = g.field_name
   and t.source_name = g.source_name
)
select
  run_id,
  field_name,
  source_name,
  total_albums_checked,
  outcome_code as dominant_outcome_code,
  outcome_count as dominant_outcome_count,
  round((outcome_count::numeric / nullif(total_albums_checked, 0)) * 100, 2) as dominant_outcome_pct,
  (total_albums_checked >= 50 and (outcome_count::numeric / nullif(total_albums_checked, 0)) >= 0.8) as pattern_flag
from ranked
where rn = 1;
