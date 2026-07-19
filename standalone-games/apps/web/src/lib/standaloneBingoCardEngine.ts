import type {
  BingoGameMode,
  StandaloneBingoSessionRecord,
} from "@/lib/standaloneBingoSessionsRepo";
import type {
  CreateStandaloneBingoCardInput,
  StandaloneBingoCardCell,
  StandaloneBingoCardRecord,
} from "@/lib/standaloneBingoCardsRepo";
import type { StandaloneBingoCallRecord } from "@/lib/standaloneBingoCallsRepo";

type Pattern = { label: string; cells: StandaloneBingoCardCell[] };

export type StandaloneBingoValidationResult = {
  card_identifier: string;
  is_winner: boolean;
  active_modes: BingoGameMode[];
  winning_patterns: Array<{ mode: BingoGameMode; label: string }>;
  mistakes: Array<{
    mode: BingoGameMode;
    message: string;
    missing_cells: Array<{ label: string }>;
  }>;
  expected_free_square_count: number;
  actual_free_square_count: number;
  marked_square_count: number;
  playable_square_count: number;
  card_preview: Array<StandaloneBingoCardCell & { marked: boolean }>;
  winning_line_calls: Array<{
    mode: BingoGameMode;
    label: string;
    calls: Array<StandaloneBingoCardCell & { marked: boolean }>;
  }>;
};

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = next[i];
    next[i] = next[j] as T;
    next[j] = temp as T;
  }
  return next;
}

function samplePool(pool: Array<{ track_title: string; artist_name: string }>, size: number) {
  if (pool.length === 0) {
    return Array.from({ length: size }, (_, idx) => ({
      track_title: `Track ${idx + 1}`,
      artist_name: "Unknown Artist",
    }));
  }

  const items: Array<{ track_title: string; artist_name: string }> = [];
  const shuffled = shuffle(pool);
  for (let i = 0; i < size; i += 1) {
    items.push(shuffled[i % shuffled.length] as { track_title: string; artist_name: string });
  }
  return shuffle(items);
}

function cellLabel(row: number, col: number): string {
  const letters = ["B", "I", "N", "G", "O"];
  return `${letters[col]}${row + 1}`;
}

export function generateStandaloneBingoCards(
  sessionCode: string,
  calls: Array<{ trackTitle: string; artistName: string }>,
  cardCount: number,
  existingCount = 0
): CreateStandaloneBingoCardInput[] {
  const normalizedCalls = calls
    .map((call) => ({
      track_title: String(call.trackTitle ?? "").trim(),
      artist_name: String(call.artistName ?? "").trim(),
    }))
    .filter((call) => call.track_title.length > 0 && call.artist_name.length > 0);

  const cards: CreateStandaloneBingoCardInput[] = [];

  for (let cardOffset = 0; cardOffset < cardCount; cardOffset += 1) {
    const tracks = samplePool(normalizedCalls, 24);
    const grid: StandaloneBingoCardCell[] = [];
    let trackCursor = 0;

    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        const isFree = row === 2 && col === 2;
        if (isFree) {
          grid.push({
            row,
            col,
            label: cellLabel(row, col),
            track_title: "FREE",
            artist_name: "FREE",
            free: true,
            call_id: null,
          });
          continue;
        }

        const track = tracks[trackCursor] as { track_title: string; artist_name: string };
        trackCursor += 1;
        grid.push({
          row,
          col,
          label: cellLabel(row, col),
          track_title: track.track_title,
          artist_name: track.artist_name,
          free: false,
          call_id: null,
        });
      }
    }

    const cardIndex = existingCount + cardOffset + 1;
    cards.push({
      cardIndex,
      cardIdentifier: `${sessionCode}-${String(cardIndex).padStart(3, "0")}`,
      grid,
    });
  }

  return cards;
}

function buildTrackKey(trackTitle: string, artistName: string): string {
  return `${trackTitle.trim().toLowerCase()}::${artistName.trim().toLowerCase()}`;
}

function getLinePatterns(grid: StandaloneBingoCardCell[]): Pattern[] {
  const cellBy = new Map<string, StandaloneBingoCardCell>();
  for (const cell of grid) {
    cellBy.set(`${cell.row},${cell.col}`, cell);
  }

  const patterns: Pattern[] = [];

  for (let row = 0; row < 5; row += 1) {
    patterns.push({
      label: `Row ${row + 1}`,
      cells: Array.from({ length: 5 }, (_, col) => cellBy.get(`${row},${col}`)).filter(
        (cell): cell is StandaloneBingoCardCell => Boolean(cell)
      ),
    });
  }

  for (let col = 0; col < 5; col += 1) {
    patterns.push({
      label: `Column ${col + 1}`,
      cells: Array.from({ length: 5 }, (_, row) => cellBy.get(`${row},${col}`)).filter(
        (cell): cell is StandaloneBingoCardCell => Boolean(cell)
      ),
    });
  }

  patterns.push({
    label: "Diagonal Main",
    cells: Array.from({ length: 5 }, (_, n) => cellBy.get(`${n},${n}`)).filter(
      (cell): cell is StandaloneBingoCardCell => Boolean(cell)
    ),
  });
  patterns.push({
    label: "Diagonal Anti",
    cells: Array.from({ length: 5 }, (_, n) => cellBy.get(`${n},${4 - n}`)).filter(
      (cell): cell is StandaloneBingoCardCell => Boolean(cell)
    ),
  });

  return patterns;
}

function completePatterns(
  patterns: Pattern[],
  isMarked: (cell: StandaloneBingoCardCell) => boolean
): Pattern[] {
  return patterns.filter((pattern) => pattern.cells.every((cell) => isMarked(cell)));
}

function missingCells(
  cells: StandaloneBingoCardCell[],
  isMarked: (cell: StandaloneBingoCardCell) => boolean
) {
  return cells
    .filter((cell) => !isMarked(cell))
    .map((cell) => ({ label: cell.label }));
}

export function validateStandaloneBingoCard(
  session: StandaloneBingoSessionRecord,
  card: StandaloneBingoCardRecord,
  calls: StandaloneBingoCallRecord[]
): StandaloneBingoValidationResult {
  const calledTrackKeys = new Set(
    calls
      .filter((call) => call.status === "called" || call.status === "completed")
      .map((call) => buildTrackKey(call.trackTitle, call.artistName))
  );

  const grid = card.grid;
  const patterns = getLinePatterns(grid);
  const mode = session.gameMode;

  const isMarked = (cell: StandaloneBingoCardCell) => {
    if (cell.free) return true;
    return calledTrackKeys.has(buildTrackKey(cell.track_title, cell.artist_name));
  };

  const completeLines = completePatterns(patterns, isMarked);
  const winningPatterns: Array<{ mode: BingoGameMode; label: string }> = [];
  const mistakes: StandaloneBingoValidationResult["mistakes"] = [];

  const pushSingleLike = (requiredLineCount: number) => {
    if (completeLines.length >= requiredLineCount) {
      completeLines.slice(0, requiredLineCount).forEach((line) => {
        winningPatterns.push({ mode, label: line.label });
      });
      return;
    }

    const nextPattern = patterns.find((line) => !line.cells.every((cell) => isMarked(cell)));
    mistakes.push({
      mode,
      message: `Needs ${requiredLineCount} complete line(s).`,
      missing_cells: missingCells(nextPattern?.cells ?? [], isMarked),
    });
  };

  if (mode === "single_line") pushSingleLike(1);
  if (mode === "double_line") pushSingleLike(2);
  if (mode === "triple_line") pushSingleLike(3);

  if (mode === "criss_cross") {
    const diagonals = patterns.filter(
      (pattern) => pattern.label === "Diagonal Main" || pattern.label === "Diagonal Anti"
    );
    const completedDiagonals = completePatterns(diagonals, isMarked);
    if (completedDiagonals.length === 2) {
      completedDiagonals.forEach((line) => winningPatterns.push({ mode, label: line.label }));
    } else {
      const target = diagonals.find((line) => !line.cells.every((cell) => isMarked(cell)));
      mistakes.push({
        mode,
        message: "Both diagonals must be complete.",
        missing_cells: missingCells(target?.cells ?? [], isMarked),
      });
    }
  }

  if (mode === "four_corners") {
    const corners = grid.filter(
      (cell) =>
        (cell.row === 0 && cell.col === 0) ||
        (cell.row === 0 && cell.col === 4) ||
        (cell.row === 4 && cell.col === 0) ||
        (cell.row === 4 && cell.col === 4)
    );
    if (corners.every((cell) => isMarked(cell))) {
      winningPatterns.push({ mode, label: "Four Corners" });
    } else {
      mistakes.push({
        mode,
        message: "All four corners must be marked.",
        missing_cells: missingCells(corners, isMarked),
      });
    }
  }

  if (mode === "blackout") {
    const playable = grid.filter((cell) => !cell.free);
    if (playable.every((cell) => isMarked(cell))) {
      winningPatterns.push({ mode, label: "Blackout" });
    } else {
      mistakes.push({
        mode,
        message: "All playable cells must be marked.",
        missing_cells: missingCells(playable, isMarked),
      });
    }
  }

  if (mode === "death") {
    mistakes.push({
      mode,
      message: "Death mode does not use standard winner validation.",
      missing_cells: [],
    });
  }

  const cardPreview = [...grid]
    .sort((a, b) => (a.row === b.row ? a.col - b.col : a.row - b.row))
    .map((cell) => ({ ...cell, marked: isMarked(cell) }));

  const winningLineCalls = winningPatterns
    .map((winner) => {
      const pattern = patterns.find((line) => line.label === winner.label);
      if (!pattern) return null;
      return {
        mode: winner.mode,
        label: winner.label,
        calls: pattern.cells.map((cell) => ({ ...cell, marked: isMarked(cell) })),
      };
    })
    .filter(
      (entry): entry is {
        mode: BingoGameMode;
        label: string;
        calls: Array<StandaloneBingoCardCell & { marked: boolean }>;
      } => Boolean(entry)
    );

  const playableSquareCount = grid.filter((cell) => !cell.free).length;
  const markedSquareCount = grid.filter((cell) => isMarked(cell)).length;
  const actualFreeSquareCount = grid.filter((cell) => cell.free).length;

  return {
    card_identifier: card.cardIdentifier,
    is_winner: winningPatterns.length > 0,
    active_modes: [mode],
    winning_patterns: winningPatterns,
    mistakes,
    expected_free_square_count: 1,
    actual_free_square_count: actualFreeSquareCount,
    marked_square_count: markedSquareCount,
    playable_square_count: playableSquareCount,
    card_preview: cardPreview,
    winning_line_calls: winningLineCalls,
  };
}