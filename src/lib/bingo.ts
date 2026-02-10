export type BingoVariant = "standard" | "death" | "blackout";
export type BingoTarget =
  | "one_line"
  | "two_lines"
  | "three_lines"
  | "four_lines"
  | "four_corners"
  | "edges"
  | "x_shape"
  | "full_card";
export type PickListMode = "shuffle" | "setlist";

export type BingoItem = {
  id: string;
  title: string;
  artist: string;
};

export type BingoCardCell = {
  label: string;
  itemId?: string;
  isFree?: boolean;
};

export type BingoCard = {
  index: number;
  cells: BingoCardCell[];
};

const GRID_SIZE = 5;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;
const CENTER_INDEX = Math.floor(CELL_COUNT / 2);

const shuffle = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const ensureEnoughItems = (items: BingoItem[], needs: number) => {
  if (items.length < needs) {
    throw new Error(`Not enough items for bingo cards. Need ${needs}, got ${items.length}.`);
  }
};

export const buildPickList = (items: BingoItem[], mode: PickListMode): BingoItem[] => {
  return mode === "setlist" ? [...items] : shuffle(items);
};

export const buildBingoCards = (
  items: BingoItem[],
  cardCount: number,
  variant: BingoVariant
): BingoCard[] => {
  const needs = variant === "standard" ? CELL_COUNT - 1 : CELL_COUNT;
  ensureEnoughItems(items, needs);

  const cards: BingoCard[] = [];

  for (let cardIndex = 0; cardIndex < cardCount; cardIndex += 1) {
    const selections = shuffle(items).slice(0, needs);
    const cells: BingoCardCell[] = [];
    let selectionIndex = 0;

    for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
      if (variant === "standard" && cellIndex === CENTER_INDEX) {
        cells.push({ label: "FREE", isFree: true });
        continue;
      }

      const item = selections[selectionIndex];
      selectionIndex += 1;
      cells.push({ label: `${item.title} — ${item.artist}`, itemId: item.id });
    }

    cards.push({ index: cardIndex + 1, cells });
  }

  return cards;
};
