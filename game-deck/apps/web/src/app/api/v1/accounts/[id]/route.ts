import { NextResponse } from "next/server";
import { requireCurrentAccount } from "@/lib/account/requireCurrentAccount";
import { assertAccountOwnership, AccountAccessDeniedError } from "@/lib/account/assertAccountOwnership";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Reference implementation of the pattern every future admin-client-backed
 * route follows: resolve the caller's own account (RLS-scoped), fetch the
 * requested resource via the admin client (bypasses RLS by design), then
 * enforce ownership explicitly in code before returning anything. Two
 * independent layers — RLS never even sees this query, so the app-layer
 * check here is what protects it, not a supplement to RLS.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await requireCurrentAccount();

  const admin = createSupabaseAdminClient();
  const { data: account, error } = await admin.from("accounts").select("id, name, plan_tier").eq("id", id).maybeSingle();

  if (error || !account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    assertAccountOwnership(account.id, caller.accountId);
  } catch (e) {
    if (e instanceof AccountAccessDeniedError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    throw e;
  }

  return NextResponse.json({ account });
}
