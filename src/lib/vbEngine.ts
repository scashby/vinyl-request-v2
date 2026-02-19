export type VbVariant = "standard" | "death" | "blackout";
export type VbTarget =
  | "single_line"
  | "double_line"
  | "triple_line"
  | "criss_cross"
  | "four_corners"
  | "blackout";

export type VbTrack = {
  id: number;
  track_title: string;
  artist_name: string;
  album_name?: string | null;
};

export type VbCardCell = {
  label: string;
  trackId?: number;
  isFree?: boolean;
};

export type VbCard = {
  index: number;
  cells: VbCardCell[];
};

const GRID_SIZE = 5;
const CELL_COUNT = 25;
const CENTER_INDEX = 12;

const shuffle = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const getColumnLetter = (index: number): "B" | "I" | "N" | "G" | "O" => {
  return ["B", "I", "N", "G", "O"][index % 5] as "B" | "I" | "N" | "G" | "O";
};

export const buildCallOrder = (tracks: VbTrack[], setlistMode: boolean): VbTrack[] => {
  return setlistMode ? [...tracks] : shuffle(tracks);
};

export const buildCards = (tracks: VbTrack[], cardCount: number, variant: VbVariant): VbCard[] => {
  const needed = variant === "standard" ? CELL_COUNT - 1 : CELL_COUNT;
  if (tracks.length < needed) {
    throw new Error(`Not enough tracks. Need at least ${needed}, got ${tracks.length}.`);
  }

  const cards: VbCard[] = [];

  for (let cardIndex = 0; cardIndex < cardCount; cardIndex += 1) {
    const picks = shuffle(tracks).slice(0, needed);
    const cells: VbCardCell[] = [];
    let pickIndex = 0;

    for (let i = 0; i < CELL_COUNT; i += 1) {
      if (variant === "standard" && i === CENTER_INDEX) {
        cells.push({ label: "FREE", isFree: true });
        continue;
      }

      const pick = picks[pickIndex];
      pickIndex += 1;
      cells.push({
        label: `${pick.track_title} - ${pick.artist_name}`,
        trackId: pick.id,
      });
    }

    cards.push({ index: cardIndex + 1, cells });
  }

  return cards;
};
