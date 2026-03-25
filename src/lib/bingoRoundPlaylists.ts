export type RoundPlaylistEntry = {
  round: number;
  playlist_ids: number[];
};

type SessionPlaylistConfig = {
  playlist_id?: number | null;
  playlist_ids?: number[] | null;
  round_playlist_ids?: RoundPlaylistEntry[] | null;
};

export function normalizePlaylistIds(input: unknown, fallbackPlaylistId?: number | null): number[] {
  const fromArray = Array.isArray(input)
    ? input.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)
    : [];

  const normalized = fromArray.length > 0
    ? fromArray
    : Number.isFinite(fallbackPlaylistId)
      ? [Number(fallbackPlaylistId)]
      : [];

  return Array.from(new Set(normalized));
}

export function normalizeRoundPlaylistIds(input: unknown, roundCount: number): RoundPlaylistEntry[] {
  if (input == null) return [];
  if (!Array.isArray(input)) {
    throw new Error("round_playlist_ids must be an array");
  }

  const byRound = new Map<number, RoundPlaylistEntry>();

  for (const value of input) {
    if (!value || typeof value !== "object") {
      throw new Error("Each round playlist override must be an object");
    }

    const round = Math.floor(Number((value as { round?: unknown }).round));
    if (!Number.isFinite(round) || round < 1 || round > roundCount) {
      throw new Error(`round_playlist_ids round must be between 1 and ${roundCount}`);
    }

    const playlistIds = normalizePlaylistIds((value as { playlist_ids?: unknown }).playlist_ids);
    if (playlistIds.length === 0) {
      byRound.delete(round);
      continue;
    }

    byRound.set(round, { round, playlist_ids: playlistIds });
  }

  return Array.from(byRound.values()).sort((left, right) => left.round - right.round);
}

export function resolveDefaultPlaylistIds(session: SessionPlaylistConfig): number[] {
  if (Array.isArray(session.playlist_ids) && session.playlist_ids.length > 0) {
    return normalizePlaylistIds(session.playlist_ids);
  }

  return normalizePlaylistIds([], session.playlist_id);
}

export function resolveRoundPlaylistIds(session: SessionPlaylistConfig, round: number): number[] {
  const roundOverrides = Array.isArray(session.round_playlist_ids) ? session.round_playlist_ids : [];
  const override = roundOverrides.find((entry) => entry.round === round);
  if (override && Array.isArray(override.playlist_ids) && override.playlist_ids.length > 0) {
    return normalizePlaylistIds(override.playlist_ids);
  }

  return resolveDefaultPlaylistIds(session);
}

export function collectResolvedPlaylistIdsByRound(
  session: SessionPlaylistConfig,
  roundCount: number
): Map<number, number[]> {
  const resolved = new Map<number, number[]>();
  for (let round = 1; round <= roundCount; round += 1) {
    resolved.set(round, resolveRoundPlaylistIds(session, round));
  }
  return resolved;
}

export function findPrimaryPlaylistId(
  defaultPlaylistIds: number[],
  roundPlaylistIds: RoundPlaylistEntry[]
): number | null {
  if (defaultPlaylistIds.length > 0) return defaultPlaylistIds[0];
  return roundPlaylistIds.find((entry) => entry.playlist_ids.length > 0)?.playlist_ids[0] ?? null;
}