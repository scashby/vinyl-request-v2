export type EntitlementKey =
  | "game:bingo"
  | "game:trivia"
  | "game:name-that-tune"
  | "bundle:core-games"
  | "addon:advanced-host-tools"
  | "addon:premium-connectors";

export interface EntitlementSet {
  tenantId: string;
  products: EntitlementKey[];
  effectiveAt: string;
}

export function hasEntitlement(
  set: EntitlementSet,
  required: EntitlementKey
): boolean {
  if (set.products.includes(required)) return true;
  if (required.startsWith("game:") && set.products.includes("bundle:core-games")) {
    return required !== "game:trivia";
  }
  return false;
}
