-- accounts has no direct FK to auth.users (it's reached only via account_members),
-- so deleting a user cascades their account_members row but leaves an orphaned
-- account behind. Clean up any account left with zero members after a deletion.
-- (Single-owner-per-account is the only model Phase 1 creates; this is safe under
-- that model and remains correct once multi-member accounts exist, since it only
-- fires when the LAST member of an account is removed.)

create or replace function public.delete_account_if_orphaned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.accounts
  where id = old.account_id
    and not exists (
      select 1 from public.account_members where account_id = old.account_id
    );

  return old;
end;
$$;

drop trigger if exists on_account_member_deleted on public.account_members;
create trigger on_account_member_deleted
  after delete on public.account_members
  for each row execute function public.delete_account_if_orphaned();
