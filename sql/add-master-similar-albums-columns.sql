-- Add canonical similar-album fields to masters for enrichment
-- Created: 2026-02-16

alter table public.masters
  add column if not exists lastfm_similar_albums text[] default '{}'::text[];

alter table public.masters
  add column if not exists allmusic_similar_albums text[] default '{}'::text[];
