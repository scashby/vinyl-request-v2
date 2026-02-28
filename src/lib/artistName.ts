const DISCOGS_SUFFIX_PATTERN = /\s+\(\d+\)\s*$/;

/**
 * Removes only Discogs disambiguation suffixes like " (2)" at the end.
 * Keeps legitimate parenthetical names, e.g. "Was (Not Was)".
 */
export function stripDiscogsDisambiguationSuffix(value: string | null | undefined): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.replace(DISCOGS_SUFFIX_PATTERN, "").trim();
}

/**
 * Normalized artist string for loose matching/search.
 */
export function normalizeArtistForMatch(value: string | null | undefined): string {
  return stripDiscogsDisambiguationSuffix(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/["'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
