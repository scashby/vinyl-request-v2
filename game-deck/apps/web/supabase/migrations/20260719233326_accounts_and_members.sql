-- Phase 1: tenant/auth foundation — accounts, account_members, RLS, signup trigger.

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Account',
  plan_tier text not null default 'free',
  billing_customer_id text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.account_members (
  account_id uuid not null references public.accounts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'operator', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (account_id, user_id)
);

alter table public.accounts enable row level security;
alter table public.account_members enable row level security;

-- A user can only see accounts they belong to, and only their own membership rows.
-- No insert/update/delete policies for the anon/authenticated roles: account + membership
-- creation happens exclusively via the SECURITY DEFINER trigger below, which bypasses RLS.
create policy "members can select their account"
  on public.accounts
  for select
  to authenticated
  using (
    id in (
      select account_id from public.account_members where user_id = auth.uid()
    )
  );

create policy "members can select their own membership rows"
  on public.account_members
  for select
  to authenticated
  using (user_id = auth.uid());

-- Auto-provision an account + owner membership for every new auth.users row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_account_id uuid;
begin
  insert into public.accounts (name)
  values (coalesce(new.email, 'My Account'))
  returning id into new_account_id;

  insert into public.account_members (account_id, user_id, role)
  values (new_account_id, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
