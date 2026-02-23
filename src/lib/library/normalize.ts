export function normalizeText(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/["'`]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizePosition(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

export function buildCanonicalPosition(input: {
  position?: string | number | null;
  side?: string | null;
  discNumber?: number | null;
}): string {
  const side = input.side ? normalizePosition(input.side).slice(0, 1) : "";
  const positionRaw = input.position;
  const positionText = String(positionRaw ?? "").trim();

  // If caller already gives us a combined position like "A1" or "2-1", normalize it.
  const normalized = normalizePosition(positionText);
  if (normalized) return normalized;

  const discNumber = typeof input.discNumber === "number" && input.discNumber > 1 ? input.discNumber : null;
  const numeric =
    typeof positionRaw === "number"
      ? positionRaw
      : (() => {
          const parsed = Number(positionText);
          return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        })();

  const numText = numeric ? String(Math.trunc(numeric)) : "";

  if (side && numText) return `${side}${numText}`;
  if (discNumber && numText) return `${discNumber}-${numText}`;
  return numText || "";
}

