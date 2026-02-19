// Path: src/types/bingo.ts

export type GameSession = {
  id: number;
  game_code: string;
  status: "pending" | "active" | "paused" | "completed";
  current_pick_index: number;
  bingo_target: string;
  round_count?: number;
  current_round?: number;
  seconds_to_next_call?: number;
  paused_at?: string | null;
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
  column_letter?: "B" | "I" | "N" | "G" | "O";
  track_title?: string;
  artist_name?: string;
  album_name?: string | null;
  game_template_items: {
    id: number;
    title: string;
    artist: string;
    album_name?: string | null;
    bpm?: number;
    key_signature?: string;
    duration_ms?: number;
  };
};

export type Player = {
  id: number;
  display_name: string;
  status: "waiting" | "admitted" | "playing" | "left" | "removed";
  correct_count: number;
  missed_count: number;
  wrong_count: number;
};

export const COLUMN_LETTERS = ["B", "I", "N", "G", "O"] as const;

export const COLUMN_COLORS = [
  { letter: "B", bg: "bg-blue-500", text: "text-blue-500" },
  { letter: "I", bg: "bg-green-500", text: "text-green-500" },
  { letter: "N", bg: "bg-yellow-500", text: "text-yellow-500" },
  { letter: "G", bg: "bg-orange-500", text: "text-orange-500" },
  { letter: "O", bg: "bg-red-500", text: "text-red-500" },
] as const;

export const BINGO_TARGETS = [
  { id: "one_line", label: "Single Line" },
  { id: "two_lines", label: "Double Line" },
  { id: "three_lines", label: "Triple Line" },
  { id: "four_corners", label: "Four Corners" },
  { id: "x_shape", label: "Criss-Cross" },
  { id: "full_card", label: "Blackout" },
] as const;

export function getColumnInfo(index: number) {
  return COLUMN_COLORS[index % 5];
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
