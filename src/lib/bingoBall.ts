export const BINGO_COLUMNS = ["B", "I", "N", "G", "O"] as const;
export type BingoColumn = (typeof BINGO_COLUMNS)[number];

export function getColumnLetterForBallNumber(ballNumber: number): BingoColumn {
  if (!Number.isFinite(ballNumber) || ballNumber < 1 || ballNumber > 75) return "B";
  const index = Math.floor((ballNumber - 1) / 15);
  return BINGO_COLUMNS[index] ?? "B";
}

export function getColumnNumberForBallNumber(ballNumber: number): number {
  if (!Number.isFinite(ballNumber) || ballNumber < 1 || ballNumber > 75) return 1;
  return ((ballNumber - 1) % 15) + 1;
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

