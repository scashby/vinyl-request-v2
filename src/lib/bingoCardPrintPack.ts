export type PrintableCard = {
  card_number: number;
  card_identifier?: string;
  grid: Array<{ row: number; col: number; label: string }>;
};

export function computeAutomaticCardOverage(baseCardCount: number, roundCopies: number): number {
  const minimumTotal = Math.max(1, Math.floor(baseCardCount || 0)) * Math.max(1, Math.floor(roundCopies || 1));
  if (minimumTotal <= 0) return 0;

  // Follow the bingo spare guidance: always print beyond the minimum,
  // targeting at least a 10% overage with a small fixed floor.
  return Math.max(4, Math.ceil(minimumTotal * 0.1));
}

export function buildPrintableCardStack(baseCards: PrintableCard[], roundCopies: number, extraCards: number): PrintableCard[] {
  const normalizedBaseCards = (baseCards ?? []).filter((card) => Array.isArray(card.grid) && card.grid.length > 0);
  if (normalizedBaseCards.length === 0) return [];

  const copies = Math.max(1, Math.floor(roundCopies || 1));
  const extras = Math.max(0, Math.floor(extraCards || 0));
  const total = normalizedBaseCards.length * copies + extras;

  return Array.from({ length: total }, (_, index) => {
    const source = normalizedBaseCards[index % normalizedBaseCards.length];
    return {
      card_number: index + 1,
      grid: source.grid,
    };
  });
}
