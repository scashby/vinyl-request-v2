import { normalizePosition } from "src/lib/library/normalize";

export const toSingle = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

export function getRecordingLyricsUrl(recording: {
  lyrics_url?: string | null;
  credits?: unknown | null;
}): string | null {
  const direct = typeof recording.lyrics_url === "string" ? recording.lyrics_url.trim() : "";
  if (direct) return direct;

  const credits = recording.credits;
  if (!credits || typeof credits !== "object" || Array.isArray(credits)) return null;
  const legacy = (credits as Record<string, unknown>).lyrics_url;
  return typeof legacy === "string" && legacy.trim().length > 0 ? legacy.trim() : null;
}

export function buildPlaylistTrackKey(inventoryId: number, position: string | null | undefined): string {
  return `${inventoryId}:${normalizePosition(position)}`;
}

