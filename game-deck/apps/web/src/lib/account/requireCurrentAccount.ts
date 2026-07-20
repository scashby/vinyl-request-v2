import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentAccount = {
  accountId: string;
  accountName: string;
  planTier: string;
  role: string;
  userId: string;
  userEmail: string | null;
};

type AccountMemberRow = {
  role: string;
  accounts: { id: string; name: string; plan_tier: string } | { id: string; name: string; plan_tier: string }[] | null;
};

/**
 * Server-only. Resolves the authenticated user's account via the RLS-enforced
 * server client (not the admin client) — this is the app-layer half of the
 * "cross-account access rejected at both the app layer and by RLS" acceptance
 * check: a user can never fetch a row scoped to an account they don't belong to,
 * because the underlying query is bound to their session, not a service key.
 */
export async function requireCurrentAccount(): Promise<CurrentAccount> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("account_members")
    .select("role, accounts(id, name, plan_tier)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle<AccountMemberRow>();

  if (error || !data || !data.accounts) {
    throw new Error("No account membership found for authenticated user.");
  }

  const account = Array.isArray(data.accounts) ? data.accounts[0] : data.accounts;

  return {
    accountId: account.id,
    accountName: account.name,
    planTier: account.plan_tier,
    role: data.role,
    userId: user.id,
    userEmail: user.email ?? null,
  };
}
