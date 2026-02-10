-- Create tables for Music Bingo and future game types.

create table if not exists public.game_templates (
  id bigserial primary key,
  name text not null,
  description text,
  source text not null default 'vinyl_collection',
  setlist_mode boolean not null default false,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.game_template_items (
  id bigserial primary key,
  template_id bigint not null references public.game_templates(id) on delete cascade,
  inventory_id bigint references public.inventory(id) on delete set null,
  recording_id bigint references public.recordings(id) on delete set null,
  title text not null,
  artist text not null,
  side text,
  position text,
  sort_order integer,
  created_at timestamptz not null default now()
);

create table if not exists public.game_sessions (
  id bigserial primary key,
  event_id bigint references public.events(id) on delete set null,
  template_id bigint references public.game_templates(id) on delete set null,
  game_code text unique,
  game_type text not null default 'music_bingo',
  variant text not null default 'standard',
  bingo_target text not null default 'one_line',
  card_count integer not null default 40,
  setlist_mode boolean not null default false,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

create table if not exists public.game_session_picks (
  id bigserial primary key,
  session_id bigint not null references public.game_sessions(id) on delete cascade,
  template_item_id bigint references public.game_template_items(id) on delete set null,
  pick_index integer not null,
  called_at timestamptz
);

create table if not exists public.game_cards (
  id bigserial primary key,
  session_id bigint not null references public.game_sessions(id) on delete cascade,
  card_number integer not null,
  has_free_space boolean not null default true,
  grid jsonb not null,
  created_at timestamptz not null default now()
);
