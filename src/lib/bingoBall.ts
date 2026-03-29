export const BINGO_COLUMNS = ["B", "I", "N", "G", "O"] as const;
export type BingoColumn = (typeof BINGO_COLUMNS)[number];

export const BINGO_COLUMN_RGB: Record<BingoColumn, [number, number, number]> = {
  B: [125, 211, 252],
  I: [240, 171, 252],
  N: [110, 231, 183],
  G: [252, 211, 77],
  O: [253, 164, 175],
};

const BINGO_COLUMN_TEXT_CLASSES: Record<BingoColumn, string> = {
  B: "text-sky-300",
  I: "text-fuchsia-300",
  N: "text-emerald-300",
  G: "text-amber-300",
  O: "text-rose-300",
};

export function getColumnLetterForBallNumber(ballNumber: number): BingoColumn {
  if (!Number.isFinite(ballNumber) || ballNumber < 1 || ballNumber > 75) return "B";
  const index = Math.floor((ballNumber - 1) / 15);
  return BINGO_COLUMNS[index] ?? "B";
}

export function getColumnNumberForBallNumber(ballNumber: number): number {
  if (!Number.isFinite(ballNumber) || ballNumber < 1 || ballNumber > 75) return 1;
  return ballNumber;
}

export function formatBallLabel(ballNumber: number | null | undefined, columnLetter?: string | null): string {
  if (Number.isFinite(ballNumber)) {
    const letter = getColumnLetterForBallNumber(ballNumber as number);
    const columnNumber = getColumnNumberForBallNumber(ballNumber as number);
    return `${letter}${columnNumber}`;
  }
  if (columnLetter) return columnLetter;
  return "?";
}

export function resolveBingoColumn(columnLetter?: string | null, ballNumber?: number | null): BingoColumn {
  if (typeof columnLetter === "string") {
    const normalized = columnLetter.trim().toUpperCase();
    if (BINGO_COLUMNS.includes(normalized as BingoColumn)) {
      return normalized as BingoColumn;
    }
  }
  if (Number.isFinite(ballNumber)) {
    return getColumnLetterForBallNumber(ballNumber as number);
  }
  return "B";
}

export function getBingoColumnTextClass(columnLetter?: string | null, ballNumber?: number | null): string {
  return BINGO_COLUMN_TEXT_CLASSES[resolveBingoColumn(columnLetter, ballNumber)];
}
