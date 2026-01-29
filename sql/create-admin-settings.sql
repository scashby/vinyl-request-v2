-- Create admin_settings table for storing admin UI configuration
create table if not exists public.admin_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- Recommended RLS setup (adjust to your auth model)
alter table public.admin_settings enable row level security;

-- Allow authenticated users to read settings
create policy "Allow authenticated read of admin_settings"
  on public.admin_settings
  for select
  to authenticated
  using (true);

-- Allow authenticated users to upsert settings
create policy "Allow authenticated upsert of admin_settings"
  on public.admin_settings
  for insert
  to authenticated
  with check (true);

create policy "Allow authenticated update of admin_settings"
  on public.admin_settings
  for update
  to authenticated
  using (true)
  with check (true);
