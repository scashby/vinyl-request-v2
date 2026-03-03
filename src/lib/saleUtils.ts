type SaleCandidate = {
  status?: unknown;
  for_sale?: unknown;
  location?: unknown;
  discogs_folder_name?: unknown;
  discogs_folder_id?: unknown;
  discogs_instance_id?: unknown;
};

const SALE_FOLDER_NAMES = new Set(["sale", "for sale"]);

export const SALE_SMART_RULES = {
  rules: [
    {
      field: "for_sale",
      operator: "is",
      value: true,
    },
  ],
};

const normalizeSaleToken = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
};

export const isSaleFolderName = (value: unknown): boolean => {
  const normalized = normalizeSaleToken(value);
  return normalized.length > 0 && SALE_FOLDER_NAMES.has(normalized);
};

export const isSaleLocation = (value: unknown): boolean => isSaleFolderName(value);

export const isTruthySaleValue = (value: unknown): boolean => {
  if (value === true) return true;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "yes" || normalized === "1";
  }
  return false;
};

export const hasSaleSmartRule = (smartRules: unknown): boolean => {
  if (!smartRules || typeof smartRules !== "object" || Array.isArray(smartRules)) return false;
  const maybeRules = (smartRules as { rules?: unknown }).rules;
  if (!Array.isArray(maybeRules) || maybeRules.length !== 1) return false;
  const rule = maybeRules[0];
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) return false;
  const typedRule = rule as { field?: unknown; operator?: unknown; value?: unknown };
  return (
    normalizeSaleToken(typedRule.field) === "for_sale" &&
    normalizeSaleToken(typedRule.operator) === "is" &&
    isTruthySaleValue(typedRule.value)
  );
};

export const isForSaleInventory = (value: SaleCandidate | null | undefined): boolean => {
  if (!value) return false;
  if (normalizeSaleToken(value.status) === "for_sale") return true;
  if (isTruthySaleValue(value.for_sale)) return true;
  if (isSaleFolderName(value.discogs_folder_name)) return true;

  const hasDiscogsFolderIdentity =
    typeof value.discogs_folder_name === "string" ||
    typeof value.discogs_folder_id === "number" ||
    typeof value.discogs_instance_id === "number";

  // Transitional fallback for legacy rows not yet migrated to canonical folder fields.
  if (!hasDiscogsFolderIdentity) {
    return isSaleLocation(value.location);
  }

  return false;
};
