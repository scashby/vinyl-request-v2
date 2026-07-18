import { headers } from "next/headers";

export interface TenantRequestContext {
  tenantId: string;
  userId: string;
}

const TENANT_HEADER = "x-tenant-id";
const USER_HEADER = "x-user-id";

export async function getTenantRequestContext(): Promise<TenantRequestContext> {
  const requestHeaders = await headers();
  const tenantId = requestHeaders.get(TENANT_HEADER);
  const userId = requestHeaders.get(USER_HEADER);

  if (!tenantId || !userId) {
    throw new Error(
      "Missing tenant context headers. Required: x-tenant-id and x-user-id."
    );
  }

  return { tenantId, userId };
}
