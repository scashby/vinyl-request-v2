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
 * Canonical display/storage form for track-level artist values.
 * Returns null for empty input after normalization.
 */
export function normalizeArtistDisplay(value: string | null | undefined): string | null {
  const stripped = stripDiscogsDisambiguationSuffix(value);
  return stripped.length > 0 ? stripped : null;
}

export function getTrackArtistFromCredits(credits: unknown): string | null {
  if (!credits || typeof credits !== "object" || Array.isArray(credits)) return null;
  const raw = (credits as Record<string, unknown>).track_artist;
  if (typeof raw === "string") return normalizeArtistDisplay(raw);
  if (typeof raw === "number") return normalizeArtistDisplay(String(raw));
  return null;
}

export function resolveTrackArtist(params: {
  trackArtist?: string | null;
  credits?: unknown;
  albumArtist?: string | null;
  fallback?: string;
}): string {
  return (
    normalizeArtistDisplay(params.trackArtist) ??
    getTrackArtistFromCredits(params.credits) ??
    normalizeArtistDisplay(params.albumArtist) ??
    params.fallback ??
    "Unknown Artist"
  );
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
