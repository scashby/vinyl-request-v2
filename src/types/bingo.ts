// Path: src/types/bingo.ts
// Shared types for the Bingo game system

export type GameSession = {
  id: number;
  game_code: string | null;
  status: "pending" | "active" | "paused" | "completed";
  variant: "standard" | "death" | "blackout";
  bingo_target: string;
  current_pick_index: number;
  created_at: string | null;
  game_templates: {
    id: number;
    name: string;
    description?: string | null;
  };
};

export type PickItem = {
  id: number;
  pick_index: number;
  status: "pending" | "played" | "skipped";
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
  };
};

export type Player = {
  id: number;
  display_name: string;
  status: "waiting" | "admitted" | "playing" | "left" | "removed";
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

export const COLUMN_COLORS = [
  { letter: "B", bg: "bg-blue-500", text: "text-blue-500" },
  { letter: "I", bg: "bg-green-500", text: "text-green-500" },
  { letter: "N", bg: "bg-yellow-500", text: "text-yellow-500" },
  { letter: "G", bg: "bg-orange-500", text: "text-orange-500" },
  { letter: "O", bg: "bg-red-500", text: "text-red-500" },
] as const;

export const BINGO_TARGETS = [
  { value: "one_line", label: "One Line", description: "Any single line" },
  { value: "two_lines", label: "Two Lines", description: "Any two lines" },
  { value: "four_corners", label: "Four Corners", description: "Corner squares" },
  { value: "x_shape", label: "X Shape", description: "Both diagonals" },
  { value: "full_card", label: "Full Card", description: "Blackout" },
] as const;

export function getColumnLabel(pickIndex: number): string {
  return COLUMN_LABELS[pickIndex % COLUMN_LABELS.length];
}

export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}