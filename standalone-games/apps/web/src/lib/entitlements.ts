import { headers } from "next/headers";

export type EntitlementKey =
  | "game:bingo"
  | "game:trivia"
  | "game:name-that-tune"
  | "bundle:core-games"
  | "addon:advanced-host-tools"
  | "addon:premium-connectors";

interface ParsedEntitlements {
  tenantId: string;
  products: EntitlementKey[];
}

const ENTITLEMENTS_HEADER = "x-entitlements";

export async function getRequestEntitlements(
  tenantId: string
): Promise<ParsedEntitlements> {
  const requestHeaders = await headers();
  const raw = requestHeaders.get(ENTITLEMENTS_HEADER);

  if (!raw) {
    return {
      tenantId,
      products: [],
    };
  }

  const products = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean) as EntitlementKey[];

  return {
    tenantId,
    products,
  };
}

export function hasEntitlement(
  entitlements: ParsedEntitlements,
  required: EntitlementKey
): boolean {
  if (entitlements.products.includes(required)) return true;
  if (
    required.startsWith("game:") &&
    entitlements.products.includes("bundle:core-games")
  ) {
    return required !== "game:trivia";
  }
  return false;
}
