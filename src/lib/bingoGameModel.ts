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
  card_preview: Array<{
    row: number;
    col: number;
    label: string;
    track_title: string;
    artist_name: string;
    free: boolean;
    marked: boolean;
    call_id: number | null;
  }>;
  winning_line_calls: Array<{
    mode: GameMode;
    label: string;
    calls: Array<{
      row: number;
      col: number;
      label: string;
      track_title: string;
      artist_name: string;
      free: boolean;
      marked: boolean;
      call_id: number | null;
    }>;
  }>;
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
    link_group: string | null;
    theme_hint: string | null;
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
        link_group: track.linkGroup ?? null,
        theme_hint: track.themeHint ?? null,
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
    link_group: string | null;
    theme_hint: string | null;
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
        link_group: track.linkGroup ?? null,
        theme_hint: track.themeHint ?? null,
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
    .select("slot_index, playlist_track_key, track_title, artist_name, album_name, side, position, link_group, theme_hint")
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
    link_group: string | null;
    theme_hint: string | null;
  }>).map((row) => ({
    trackKey: row.playlist_track_key,
    sortOrder: row.slot_index,
    trackTitle: row.track_title,
    artistName: row.artist_name,
    albumName: row.album_name,
    side: row.side,
    position: row.position,
    linkGroup: row.link_group ?? null,
    themeHint: row.theme_hint ?? null,
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

function buildTrackIdentity(trackTitle: string, artistName: string): string {
  const title = (trackTitle || "").trim().toLowerCase();
  const artist = (artistName || "").trim().toLowerCase();
  if (!title && !artist) return "";
  return `${title}::${artist}`;
}

function getMissingCells(pattern: ValidationPattern, isCellMarked: (cell: ValidationCell) => boolean): ValidationCell[] {
  return pattern.cells.filter((cell) => !cell.free && !isCellMarked(cell));
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
  isCellMarked: (cell: ValidationCell) => boolean
): { passed: boolean; winners: string[]; mistake: BingoCardValidationResult["mistakes"][number] | null } {
  const summaries = linePatterns.map((pattern) => ({
    pattern,
    missing: getMissingCells(pattern, isCellMarked),
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
  isCellMarked: (cell: ValidationCell) => boolean
): { passed: boolean; winners: string[]; mistake: BingoCardValidationResult["mistakes"][number] | null } {
  const rows = linePatterns.filter((pattern) => pattern.label.startsWith("Row "));
  const cols = linePatterns.filter((pattern) => pattern.label.startsWith("Column "));
  const diagonals = linePatterns.filter((pattern) => pattern.label.startsWith("Diagonal"));

  const combinations: Array<{ labels: string[]; missing: ValidationCell[] }> = [];
  for (const row of rows) {
    for (const col of cols) {
      combinations.push({
        labels: [row.label, col.label],
        missing: uniqueMissingCells([...getMissingCells(row, isCellMarked), ...getMissingCells(col, isCellMarked)]),
      });
    }
  }
  if (diagonals.length === 2) {
    combinations.push({
      labels: diagonals.map((pattern) => pattern.label),
      missing: uniqueMissingCells(diagonals.flatMap((pattern) => getMissingCells(pattern, isCellMarked))),
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
  isCellMarked: (cell: ValidationCell) => boolean
): { passed: boolean; winners: string[]; mistake: BingoCardValidationResult["mistakes"][number] | null } {
  const corners = grid.filter((cell) => (cell.row === 0 || cell.row === 4) && (cell.col === 0 || cell.col === 4));
  const missing = corners.filter((cell) => !cell.free && !isCellMarked(cell));
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
  isCellMarked: (cell: ValidationCell) => boolean
): { passed: boolean; winners: string[]; mistake: BingoCardValidationResult["mistakes"][number] | null } {
  const missing = grid.filter((cell) => !cell.free && !isCellMarked(cell));
  if (missing.length === 0) {
    return { passed: true, winners: ["Blackout"], mistake: null };
  }
  return {
    passed: false,
    winners: [],
    mistake: summarizeMissing("blackout", `Blackout still needs ${missing.length} square${missing.length === 1 ? "" : "s"}.`, missing.slice(0, 12)),
  };
}

function sortCells(cells: ValidationCell[]): ValidationCell[] {
  return [...cells].sort((left, right) => {
    if (left.row !== right.row) return left.row - right.row;
    return left.col - right.col;
  });
}

function toPreviewCell(cell: ValidationCell, isCellMarked: (cell: ValidationCell) => boolean) {
  return {
    row: cell.row,
    col: cell.col,
    label: cell.label,
    track_title: cell.track_title,
    artist_name: cell.artist_name,
    free: cell.free,
    marked: isCellMarked(cell),
    call_id: cell.call_id,
  };
}

function collectWinningLineCells(
  mode: GameMode,
  label: string,
  linePatterns: ValidationPattern[],
  grid: ValidationCell[]
): ValidationCell[] {
  if (label.startsWith("Row ") || label.startsWith("Column ") || label.startsWith("Diagonal")) {
    const pattern = linePatterns.find((entry) => entry.label === label);
    return pattern ? sortCells(pattern.cells) : [];
  }

  if (mode === "four_corners" || label === "Four Corners") {
    return sortCells(grid.filter((cell) => (cell.row === 0 || cell.row === 4) && (cell.col === 0 || cell.col === 4)));
  }

  if (mode === "blackout" || label === "Blackout") {
    return sortCells(grid);
  }

  return [];
}

export async function validateCardByIdentifier(
  db: BingoDbClient,
  sessionId: number,
  cardIdentifier: string,
  roundOverride?: number
): Promise<BingoCardValidationResult> {
  const { data: session, error: sessionError } = await db
    .from("bingo_sessions")
    .select("current_round, game_mode, round_modes, is_sandbox, sandbox_source_session_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) throw new Error(sessionError.message);
  if (!session) throw new Error("Session not found.");

  let card: { session_id: number; card_identifier: string; grid: unknown } | null = null;
  const { data: sessionCard, error: sessionCardError } = await db
    .from("bingo_cards")
    .select("session_id, card_identifier, grid")
    .eq("session_id", sessionId)
    .eq("card_identifier", cardIdentifier)
    .maybeSingle();

  if (sessionCardError) throw new Error(sessionCardError.message);
  if (sessionCard) {
    card = sessionCard as { session_id: number; card_identifier: string; grid: unknown };
  } else {
    const isSandbox = Boolean((session as { is_sandbox?: unknown }).is_sandbox);
    const sourceSessionId = Number((session as { sandbox_source_session_id?: unknown }).sandbox_source_session_id);
    if (isSandbox && Number.isFinite(sourceSessionId)) {
      const { data: sourceCard, error: sourceCardError } = await db
        .from("bingo_cards")
        .select("session_id, card_identifier, grid")
        .eq("session_id", sourceSessionId)
        .eq("card_identifier", cardIdentifier)
        .maybeSingle();

      if (sourceCardError) throw new Error(sourceCardError.message);
      if (sourceCard) {
        card = sourceCard as { session_id: number; card_identifier: string; grid: unknown };
      }
    }
  }

  if (!card) throw new Error("Card not found for this session.");

  const round = roundOverride && Number.isFinite(roundOverride)
    ? Math.max(1, Math.floor(roundOverride))
    : Math.max(1, Number(session.current_round ?? 1));
  const activeModes = getModesForRound(session.round_modes as { round: number; modes: GameMode[] }[] | null, round, (session.game_mode as GameMode) ?? "single_line");

  const { data: calls, error: callsError } = await db
    .from("bingo_session_calls")
    .select("id, call_index, status, track_title, artist_name")
    .eq("session_id", sessionId);

  if (callsError) throw new Error(callsError.message);

  const sessionCalls = (calls ?? []) as Array<{ id: number; call_index: number; status: string; track_title: string; artist_name: string }>;
  const calledSessionCalls = sessionCalls.filter((call) => call.status === "called" || call.status === "completed");
  const calledCallIds = new Set<number>(calledSessionCalls.map((call) => call.id));
  const calledTrackByCallId = new Map<number, string>(
    sessionCalls.map((call) => [call.id, buildTrackIdentity(call.track_title, call.artist_name)])
  );
  const calledSessionTrackKeys = new Set<string>(
    calledSessionCalls
      .map((call) => buildTrackIdentity(call.track_title, call.artist_name))
      .filter((key) => key.length > 0)
  );

  const isSandbox = Boolean((session as { is_sandbox?: unknown }).is_sandbox);
  const sourceSessionId = Number((session as { sandbox_source_session_id?: unknown }).sandbox_source_session_id);
  if (isSandbox && Number.isFinite(sourceSessionId)) {
    const { data: sourceCalls, error: sourceCallsError } = await db
      .from("bingo_session_calls")
      .select("id, call_index, track_title, artist_name")
      .eq("session_id", sourceSessionId);

    if (sourceCallsError) throw new Error(sourceCallsError.message);

    const typedSourceCalls = (sourceCalls ?? []) as Array<{ id: number; call_index: number; track_title: string; artist_name: string }>;
    typedSourceCalls.forEach((call) => {
      calledTrackByCallId.set(call.id, buildTrackIdentity(call.track_title, call.artist_name));
    });

    // Include source-session call ids by matching called track identity.
    // This remains correct even if sandbox call order changes during dry run.
    typedSourceCalls.forEach((sourceCall) => {
      const sourceTrackKey = buildTrackIdentity(sourceCall.track_title, sourceCall.artist_name);
      if (sourceTrackKey.length > 0 && calledSessionTrackKeys.has(sourceTrackKey)) {
        calledCallIds.add(sourceCall.id);
      }
    });
  }

  const calledTrackKeys = new Set<string>();
  calledCallIds.forEach((callId) => {
    const key = calledTrackByCallId.get(callId);
    if (key) calledTrackKeys.add(key);
  });

  const isCellMarked = (cell: ValidationCell): boolean => {
    if (cell.free) return true;

    const cellTrackKey = buildTrackIdentity(cell.track_title, cell.artist_name);

    if (cell.call_id !== null && calledCallIds.has(cell.call_id)) {
      const calledTrackKey = calledTrackByCallId.get(cell.call_id) ?? "";
      if (!calledTrackKey || !cellTrackKey || calledTrackKey === cellTrackKey) {
        return true;
      }
    }

    return cellTrackKey.length > 0 && calledTrackKeys.has(cellTrackKey);
  };

  const grid = coerceCardGrid((card as { grid?: unknown }).grid);
  const linePatterns = buildLinePatterns(grid);
  const winningPatterns: Array<{ mode: GameMode; label: string }> = [];
  const mistakes: BingoCardValidationResult["mistakes"] = [];

  for (const mode of activeModes) {
    if (mode === "single_line") {
      const result = validateSingleLikeMode(mode, 1, linePatterns, isCellMarked);
      if (result.passed) {
        winningPatterns.push(...result.winners.map((label) => ({ mode, label })));
      } else if (result.mistake) {
        mistakes.push(result.mistake);
      }
      continue;
    }

    if (mode === "double_line") {
      const result = validateSingleLikeMode(mode, 2, linePatterns, isCellMarked);
      if (result.passed) {
        winningPatterns.push(...result.winners.map((label) => ({ mode, label })));
      } else if (result.mistake) {
        mistakes.push(result.mistake);
      }
      continue;
    }

    if (mode === "triple_line") {
      const result = validateSingleLikeMode(mode, 3, linePatterns, isCellMarked);
      if (result.passed) {
        winningPatterns.push(...result.winners.map((label) => ({ mode, label })));
      } else if (result.mistake) {
        mistakes.push(result.mistake);
      }
      continue;
    }

    if (mode === "criss_cross") {
      const result = validateCrissCross(linePatterns, isCellMarked);
      if (result.passed) {
        winningPatterns.push(...result.winners.map((label) => ({ mode, label })));
      } else if (result.mistake) {
        mistakes.push(result.mistake);
      }
      continue;
    }

    if (mode === "four_corners") {
      const result = validateFourCorners(grid, isCellMarked);
      if (result.passed) {
        winningPatterns.push(...result.winners.map((label) => ({ mode, label })));
      } else if (result.mistake) {
        mistakes.push(result.mistake);
      }
      continue;
    }

    if (mode === "blackout") {
      const result = validateBlackout(grid, isCellMarked);
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
  const markedSquareCount = grid.filter((cell) => isCellMarked(cell)).length;
  const completeLineCount = linePatterns.filter((pattern) => getMissingCells(pattern, isCellMarked).length === 0).length;
  const cardPreview = sortCells(grid).map((cell) => toPreviewCell(cell, isCellMarked));
  const winningLineCalls = winningPatterns.map((pattern) => ({
    mode: pattern.mode,
    label: pattern.label,
    calls: collectWinningLineCells(pattern.mode, pattern.label, linePatterns, grid).map((cell) => toPreviewCell(cell, isCellMarked)),
  }));

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
    card_preview: cardPreview,
    winning_line_calls: winningLineCalls,
  };
}