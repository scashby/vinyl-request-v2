import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function makeSlug(prefix) {
  return `${prefix}-${Date.now().toString(36)}`;
}

async function main() {
  const url = requireEnv("STANDALONE_SUPABASE_URL");
  const serviceRoleKey = requireEnv("STANDALONE_SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const tenantId = randomUUID();
  const userId = randomUUID();
  const membershipId = randomUUID();
  const tenantSlug = makeSlug("smoke");
  const userEmail = `smoke-${Date.now()}@deadwaxdialogues.local`;

  const { error: tenantError } = await supabase
    .from("sg_tenants")
    .insert({
      id: tenantId,
      slug: tenantSlug,
      display_name: "Standalone Smoke Tenant",
    });

  if (tenantError) {
    throw new Error(`Failed to create sg_tenants row: ${tenantError.message}`);
  }

  const { error: userError } = await supabase
    .from("sg_users")
    .insert({
      id: userId,
      email: userEmail,
    });

  if (userError) {
    throw new Error(`Failed to create sg_users row: ${userError.message}`);
  }

  const { error: membershipError } = await supabase
    .from("sg_tenant_memberships")
    .insert({
      id: membershipId,
      tenant_id: tenantId,
      user_id: userId,
      role: "owner",
    });

  if (membershipError) {
    throw new Error(
      `Failed to create sg_tenant_memberships row: ${membershipError.message}`
    );
  }

  console.log("Bootstrap complete");
  console.log(`X_TENANT_ID=${tenantId}`);
  console.log(`X_USER_ID=${userId}`);
  console.log("X_ENTITLEMENTS=game:bingo,bundle:core-games,addon:premium-connectors");
  console.log(`Tenant slug: ${tenantSlug}`);
  console.log(`User email: ${userEmail}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});