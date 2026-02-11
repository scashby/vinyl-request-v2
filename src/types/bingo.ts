// Path: src/types/bingo.ts
// Shared types for the Bingo game system

export type GameSession = {
  id: number;
  game_code: string | null;
  status: "pending" | "active" | "paused" | "finished";
  variant: "standard" | "death" | "blackout";
  bingo_target: string;
  created_at: string | null;
};

export type PickItem = {
  id: number;
  pick_index: number;
  called_at: string | null;
  game_template_items: {
    id: number;
    title: string;
    artist: string;
    // Extended metadata for sidekick view
    bpm?: number;
    key_signature?: string;
    duration_ms?: number;
    spotify_uri?: string;
    lyrics_url?: string;
  } | null;
};

export type Player = {
  id: number;
  display_name: string;
  status: "lobby" | "playing" | "left" | "removed";
  joined_at: string;
  correct_count: number;
  missed_count: number;
  wrong_count: number;
  has_bingo: boolean;
  card_squares: PlayerSquare[];
};

export type PlayerSquare = {
  index: number;
  item_id: number;
  dabbed: boolean;
  is_correct: boolean | null; // null = not yet called
};

export type JumbotronSettings = {
  video_url: string | null;
  pre_game_video_url: string | null;
  show_game_code: boolean;
  show_current_song: boolean;
  theme: "dark" | "light" | "transparent";
};

export const COLUMN_LABELS = ["B", "I", "N", "G", "O"] as const;

export const BINGO_TARGETS = [
  { value: "one_line", label: "One Line", description: "Any single line" },
  { value: "two_lines", label: "Two Lines", description: "Any two lines" },
  { value: "four_corners", label: "Four Corners", description: "Corner squares" },
  { value: "x_shape", label: "X Shape", description: "Both diagonals" },
  { value: "full_card", label: "Full Card", description: "Blackout" },
] as const;

export function getColumnLabel(pickIndex: number): string {
  return COLUMN_LABELS[(pickIndex - 1) % COLUMN_LABELS.length];
}

export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
