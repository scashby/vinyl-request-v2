type CountdownSession = {
  target_gap_seconds: number;
  countdown_started_at: string | null;
  paused_remaining_seconds: number | null;
  status: "pending" | "running" | "paused" | "completed";
};

export function computeNameThatTuneRemainingSeconds(session: CountdownSession): number {
  if (session.status === "paused" && Number.isFinite(session.paused_remaining_seconds)) {
    return Math.max(0, Number(session.paused_remaining_seconds));
  }

  if (!session.countdown_started_at) return Math.max(0, session.target_gap_seconds);

  const startedAt = new Date(session.countdown_started_at).getTime();
  if (!Number.isFinite(startedAt)) return Math.max(0, session.target_gap_seconds);

  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  return Math.max(0, session.target_gap_seconds - elapsed);
}
