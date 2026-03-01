export type GenreImposterSessionStatus = "pending" | "running" | "paused" | "completed";

export type GenreImposterCountdownSession = {
  status: GenreImposterSessionStatus;
  target_gap_seconds: number;
  countdown_started_at: string | null;
  paused_remaining_seconds: number | null;
};

export function computeGenreImposterRemainingSeconds(session: GenreImposterCountdownSession): number {
  if (session.status === "paused" && Number.isFinite(session.paused_remaining_seconds)) {
    return Math.max(0, Number(session.paused_remaining_seconds));
  }

  if (!session.countdown_started_at) return Math.max(0, session.target_gap_seconds);

  const startedAt = new Date(session.countdown_started_at).getTime();
  if (!Number.isFinite(startedAt)) return Math.max(0, session.target_gap_seconds);

  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  return Math.max(0, session.target_gap_seconds - elapsed);
}

export function normalizeReasonMatch(params: {
  reasonMode: "host_judged" | "strict_key";
  reasonText: string | null;
  reasonKey: string | null;
  explicitReasonCorrect?: boolean;
}): boolean {
  if (params.reasonMode === "host_judged") {
    return Boolean(params.explicitReasonCorrect);
  }

  if (typeof params.explicitReasonCorrect === "boolean") {
    return params.explicitReasonCorrect;
  }

  const reasonText = (params.reasonText ?? "").trim().toLowerCase();
  const reasonKey = (params.reasonKey ?? "").trim().toLowerCase();
  if (!reasonText || !reasonKey) return false;

  return reasonText.includes(reasonKey);
}
