import type { BingoDbClient } from "src/lib/bingoDb";
import {
  buildRoundTrackPool,
  type BingoCardCell,
  type GameMode,
  resolvePlaylistTracksForPlaylists,
  type ResolvedPlaylistTrack,
} from "src/lib/bingoEngine";
import { getModesForRound } from "src/lib/bingoModes";

type ValidationCell = BingoCardCell & {
  row: number;
  col: number;
  free: boolean;
  call_id: number | null;
  label: string;
  track_title: string;
  artist_name: string;
};

type ValidationPattern = {
  label: string;
  cells: ValidationCell[];
};

export type BingoCardValidationResult = {
  session_id: number;
  card_identifier: string;
  round: number;
  active_modes: GameMode[];
  is_winner: boolean;
  winning_patterns: Array<{ mode: GameMode; label: string }>;
  mistakes: Array<{
    mode: GameMode;
    message: string;
    missing_cells: Array<{
      row: number;
      col: number;
      label: string;
      track_title: string;
      artist_name: string;
      free: boolean;
    }>;
  }>;
  expected_free_square_count: number;
  actual_free_square_count: number;
  marked_square_count: number;
  playable_square_count: number;
  complete_line_count: number;
};

function coerceInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : null;
}

function normalizeTrackText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function createRoundTrackSnapshots(
  db: BingoDbClient,
  sessionId: number,
  resolvedPlaylistsByRound: Map<number, number[]>
): Promise<void> {
  const rows: Array<{
    session_id: number;
    round_number: number;
    slot_index: number;
    playlist_track_key: string;
    source_playlist_id: number | null;
    track_title: string;
    artist_name: string;
    album_name: string | null;
    side: string | null;
    position: string | null;
  }> = [];

  for (const [roundNumber, playlistIds] of Array.from(resolvedPlaylistsByRound.entries()).sort((left, right) => left[0] - right[0])) {
    const tracks = await resolvePlaylistTracksForPlaylists(db, playlistIds);
    const gameTracks = buildRoundTrackPool(tracks, sessionId, roundNumber);

    gameTracks.forEach((track, index) => {
      rows.push({
        session_id: sessionId,
        round_number: roundNumber,
        slot_index: index + 1,
        playlist_track_key: track.trackKey,
        source_playlist_id: null,
        track_title: track.trackTitle,
        artist_name: track.artistName,
        album_name: track.albumName,
        side: track.side,
        position: track.position,
      });
    });
  }

  const { error } = await db.from("bingo_session_round_tracks").insert(rows);
  if (error) throw new Error(error.message);
}

export async function createRoundTrackSnapshotsFromTracks(
  db: BingoDbClient,
  sessionId: number,
  roundCount: number,
  poolTracks: ResolvedPlaylistTrack[]
): Promise<void> {
  const rows: Array<{
    session_id: number;
    round_number: number;
    slot_index: number;
    playlist_track_key: string;
    source_playlist_id: number | null;
    track_title: string;
    artist_name: string;
    album_name: string | null;
    side: string | null;
    position: string | null;
  }> = [];

  const normalizedRoundCount = Math.max(1, Math.floor(roundCount || 1));
  for (let roundNumber = 1; roundNumber <= normalizedRoundCount; roundNumber += 1) {
    const gameTracks = buildRoundTrackPool(poolTracks, sessionId, roundNumber);
    gameTracks.forEach((track, index) => {
      rows.push({
        session_id: sessionId,
        round_number: roundNumber,
        slot_index: index + 1,
        playlist_track_key: track.trackKey,
        source_playlist_id: null,
        track_title: track.trackTitle,
        artist_name: track.artistName,
        album_name: track.albumName,
        side: track.side,
        position: track.position,
      });
    });
  }

  const { error } = await db.from("bingo_session_round_tracks").insert(rows);
  if (error) throw new Error(error.message);
}

export async function getRoundSnapshotTracks(
  db: BingoDbClient,
  sessionId: number,
  roundNumber: number
): Promise<ResolvedPlaylistTrack[]> {
  const { data, error } = await db
    .from("bingo_session_round_tracks")
    .select("slot_index, playlist_track_key, track_title, artist_name, album_name, side, position")
    .eq("session_id", sessionId)
    .eq("round_number", roundNumber)
    .order("slot_index", { ascending: true });

  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<{
    slot_index: number;
    playlist_track_key: string;
    track_title: string;
    artist_name: string;
    album_name: string | null;
    side: string | null;
    position: string | null;
  }>).map((row) => ({
    trackKey: row.playlist_track_key,
    sortOrder: row.slot_index,
    trackTitle: row.track_title,
    artistName: row.artist_name,
    albumName: row.album_name,
    side: row.side,
    position: row.position,
  }));
}

function coerceCardGrid(grid: unknown): ValidationCell[] {
  if (!Array.isArray(grid)) return [];

  return grid
    .map((rawCell) => {
      if (!rawCell || typeof rawCell !== "object") return null;
      const cell = rawCell as Record<string, unknown>;
      const row = coerceInteger(cell.row);
      const col = coerceInteger(cell.col);
      if (row === null || col === null) return null;

      return {
        row,
        col,
        free: Boolean(cell.free),
        column_letter: normalizeTrackText(cell.column_letter) as ValidationCell["column_letter"],
        call_id: coerceInteger(cell.call_id),
        track_title: normalizeTrackText(cell.track_title),
        artist_name: normalizeTrackText(cell.artist_name),
        label: normalizeTrackText(cell.label),
      } satisfies ValidationCell;
    })
    .filter((cell): cell is ValidationCell => cell !== null);
}

function buildLinePatterns(grid: ValidationCell[]): ValidationPattern[] {
  const byRow = new Map<number, ValidationCell[]>();
  const byCol = new Map<number, ValidationCell[]>();

  for (const cell of grid) {
    const rowCells = byRow.get(cell.row) ?? [];
    rowCells.push(cell);
    byRow.set(cell.row, rowCells);

    const colCells = byCol.get(cell.col) ?? [];
    colCells.push(cell);
    byCol.set(cell.col, colCells);
  }

  const patterns: ValidationPattern[] = [];

  for (let row = 0; row < 5; row += 1) {
    patterns.push({
      label: `Row ${row + 1}`,
      cells: (byRow.get(row) ?? []).sort((left, right) => left.col - right.col),
    });
  }

  for (let col = 0; col < 5; col += 1) {
    patterns.push({
      label: `Column ${col + 1}`,
      cells: (byCol.get(col) ?? []).sort((left, right) => left.row - right.row),
    });
  }

  patterns.push({
    label: "Diagonal TL-BR",
    cells: grid.filter((cell) => cell.row === cell.col).sort((left, right) => left.row - right.row),
  });
  patterns.push({
    label: "Diagonal TR-BL",
    cells: grid.filter((cell) => cell.row + cell.col === 4).sort((left, right) => left.row - right.row),
  });

  return patterns;
}

function getMissingCells(pattern: ValidationPattern, calledCallIds: Set<number>): ValidationCell[] {
  return pattern.cells.filter((cell) => !cell.free && (!cell.call_id || !calledCallIds.has(cell.call_id)));
}

function summarizeMissing(mode: GameMode, message: string, cells: ValidationCell[]) {
  return {
    mode,
    message,
    missing_cells: cells.map((cell) => ({
      row: cell.row,
      col: cell.col,
      label: cell.label,
      track_title: cell.track_title,
      artist_name: cell.artist_name,
      free: cell.free,
    })),
  };
}

function uniqueMissingCells(cells: ValidationCell[]): ValidationCell[] {
  const unique = new Map<string, ValidationCell>();
  for (const cell of cells) {
    unique.set(`${cell.row}:${cell.col}`, cell);
  }
  return Array.from(unique.values()).sort((left, right) => {
    if (left.row !== right.row) return left.row - right.row;
    return left.col - right.col;
  });
}

function validateSingleLikeMode(
  mode: Extract<GameMode, "single_line" | "double_line" | "triple_line">,
  requiredLines: number,
  linePatterns: ValidationPattern[],
  calledCallIds: Set<number>
): { passed: boolean; winners: string[]; mistake: BingoCardValidationResult["mistakes"][number] | null } {
  const summaries = linePatterns.map((pattern) => ({
    pattern,
    missing: getMissingCells(pattern, calledCallIds),
  }));
  const complete = summaries.filter((entry) => entry.missing.length === 0);
  if (complete.length >= requiredLines) {
    return {
      passed: true,
      winners: complete.slice(0, requiredLines).map((entry) => entry.pattern.label),
      mistake: null,
    };
  }

  const targetPatterns = summaries
    .filter((entry) => entry.missing.length > 0)
    .sort((left, right) => left.missing.length - right.missing.length || left.pattern.label.localeCompare(right.pattern.label))
    .slice(0, requiredLines - complete.length);

  return {
    passed: false,
    winners: [],
    mistake: summarizeMissing(
      mode,
      `${requiredLines - complete.length} more line${requiredLines - complete.length === 1 ? "" : "s"} needed for ${mode.replace("_", " ")}.`,
      uniqueMissingCells(targetPatterns.flatMap((entry) => entry.missing))
    ),
  };
}

function validateCrissCross(
  linePatterns: ValidationPattern[],
  calledCallIds: Set<number>
): { passed: boolean; winners: string[]; mistake: BingoCardValidationResult["mistakes"][number] | null } {
  const rows = linePatterns.filter((pattern) => pattern.label.startsWith("Row "));
  const cols = linePatterns.filter((pattern) => pattern.label.startsWith("Column "));
  const diagonals = linePatterns.filter((pattern) => pattern.label.startsWith("Diagonal"));

  const combinations: Array<{ labels: string[]; missing: ValidationCell[] }> = [];
  for (const row of rows) {
    for (const col of cols) {
      combinations.push({
        labels: [row.label, col.label],
        missing: uniqueMissingCells([...getMissingCells(row, calledCallIds), ...getMissingCells(col, calledCallIds)]),
      });
    }
  }
  if (diagonals.length === 2) {
    combinations.push({
      labels: diagonals.map((pattern) => pattern.label),
      missing: uniqueMissingCells(diagonals.flatMap((pattern) => getMissingCells(pattern, calledCallIds))),
    });
  }

  const winner = combinations.find((entry) => entry.missing.length === 0);
  if (winner) {
    return { passed: true, winners: winner.labels, mistake: null };
  }

  const closest = combinations.sort((left, right) => left.missing.length - right.missing.length)[0];
  return {
    passed: false,
    winners: [],
    mistake: summarizeMissing("criss_cross", "Criss-cross requires one full row and one full column, or both diagonals.", closest?.missing ?? []),
  };
}

function validateFourCorners(
  grid: ValidationCell[],
  calledCallIds: Set<number>
): { passed: boolean; winners: string[]; mistake: BingoCardValidationResult["mistakes"][number] | null } {
  const corners = grid.filter((cell) => (cell.row === 0 || cell.row === 4) && (cell.col === 0 || cell.col === 4));
  const missing = corners.filter((cell) => !cell.free && (!cell.call_id || !calledCallIds.has(cell.call_id)));
  if (missing.length === 0) {
    return { passed: true, winners: ["Four Corners"], mistake: null };
  }
  return {
    passed: false,
    winners: [],
    mistake: summarizeMissing("four_corners", "All four corners must be marked.", missing),
  };
}

function validateBlackout(
  grid: ValidationCell[],
  calledCallIds: Set<number>
): { passed: boolean; winners: string[]; mistake: BingoCardValidationResult["mistakes"][number] | null } {
  const missing = grid.filter((cell) => !cell.free && (!cell.call_id || !calledCallIds.has(cell.call_id)));
  if (missing.length === 0) {
    return { passed: true, winners: ["Blackout"], mistake: null };
  }
  return {
    passed: false,
    winners: [],
    mistake: summarizeMissing("blackout", `Blackout still needs ${missing.length} square${missing.length === 1 ? "" : "s"}.`, missing.slice(0, 12)),
  };
}

export async function validateCardByIdentifier(
  db: BingoDbClient,
  sessionId: number,
  cardIdentifier: string,
  roundOverride?: number
): Promise<BingoCardValidationResult> {
  const { data: card, error: cardError } = await db
    .from("bingo_cards")
    .select("session_id, card_identifier, grid")
    .eq("session_id", sessionId)
    .eq("card_identifier", cardIdentifier)
    .maybeSingle();

  if (cardError) throw new Error(cardError.message);
  if (!card) throw new Error("Card not found for this session.");

  const { data: session, error: sessionError } = await db
    .from("bingo_sessions")
    .select("current_round, game_mode, round_modes")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) throw new Error(sessionError.message);
  if (!session) throw new Error("Session not found.");

  const round = roundOverride && Number.isFinite(roundOverride)
    ? Math.max(1, Math.floor(roundOverride))
    : Math.max(1, Number(session.current_round ?? 1));
  const activeModes = getModesForRound(session.round_modes as { round: number; modes: GameMode[] }[] | null, round, (session.game_mode as GameMode) ?? "single_line");

  const { data: calls, error: callsError } = await db
    .from("bingo_session_calls")
    .select("id, status")
    .eq("session_id", sessionId);

  if (callsError) throw new Error(callsError.message);

  const calledCallIds = new Set(
    ((calls ?? []) as Array<{ id: number; status: string }>).filter((call) => call.status === "called" || call.status === "completed").map((call) => call.id)
  );

  const grid = coerceCardGrid((card as { grid?: unknown }).grid);
  const linePatterns = buildLinePatterns(grid);
  const winningPatterns: Array<{ mode: GameMode; label: string }> = [];
  const mistakes: BingoCardValidationResult["mistakes"] = [];

  for (const mode of activeModes) {
    if (mode === "single_line") {
      const result = validateSingleLikeMode(mode, 1, linePatterns, calledCallIds);
      if (result.passed) {
        winningPatterns.push(...result.winners.map((label) => ({ mode, label })));
      } else if (result.mistake) {
        mistakes.push(result.mistake);
      }
      continue;
    }

    if (mode === "double_line") {
      const result = validateSingleLikeMode(mode, 2, linePatterns, calledCallIds);
      if (result.passed) {
        winningPatterns.push(...result.winners.map((label) => ({ mode, label })));
      } else if (result.mistake) {
        mistakes.push(result.mistake);
      }
      continue;
    }

    if (mode === "triple_line") {
      const result = validateSingleLikeMode(mode, 3, linePatterns, calledCallIds);
      if (result.passed) {
        winningPatterns.push(...result.winners.map((label) => ({ mode, label })));
      } else if (result.mistake) {
        mistakes.push(result.mistake);
      }
      continue;
    }

    if (mode === "criss_cross") {
      const result = validateCrissCross(linePatterns, calledCallIds);
      if (result.passed) {
        winningPatterns.push(...result.winners.map((label) => ({ mode, label })));
      } else if (result.mistake) {
        mistakes.push(result.mistake);
      }
      continue;
    }

    if (mode === "four_corners") {
      const result = validateFourCorners(grid, calledCallIds);
      if (result.passed) {
        winningPatterns.push(...result.winners.map((label) => ({ mode, label })));
      } else if (result.mistake) {
        mistakes.push(result.mistake);
      }
      continue;
    }

    if (mode === "blackout") {
      const result = validateBlackout(grid, calledCallIds);
      if (result.passed) {
        winningPatterns.push(...result.winners.map((label) => ({ mode, label })));
      } else if (result.mistake) {
        mistakes.push(result.mistake);
      }
      continue;
    }

    if (mode === "death") {
      mistakes.push({
        mode,
        message: "Death mode does not have a standard positive winner card check.",
        missing_cells: [],
      });
    }
  }

  const actualFreeSquareCount = grid.filter((cell) => cell.free).length;
  const markedSquareCount = grid.filter((cell) => cell.free || (cell.call_id !== null && calledCallIds.has(cell.call_id))).length;
  const completeLineCount = linePatterns.filter((pattern) => getMissingCells(pattern, calledCallIds).length === 0).length;

  return {
    session_id: sessionId,
    card_identifier: (card as { card_identifier: string }).card_identifier,
    round,
    active_modes: activeModes,
    is_winner: winningPatterns.length > 0,
    winning_patterns: winningPatterns,
    mistakes,
    expected_free_square_count: 1,
    actual_free_square_count: actualFreeSquareCount,
    marked_square_count: markedSquareCount,
    playable_square_count: grid.filter((cell) => !cell.free).length,
    complete_line_count: completeLineCount,
  };
}