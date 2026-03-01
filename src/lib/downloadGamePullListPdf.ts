import { GamePullListRow, generateGamePullListPdf } from "src/lib/gamePullListPdf";

type DownloadGamePullListOptions = {
  gameSlug: string;
  gameTitle: string;
  sessionId: number;
  sessionCode: string;
  accentRgb?: [number, number, number];
};

type ApiPayload = {
  data?: Array<Record<string, unknown>>;
};

function text(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  return null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeGenericRow(row: Record<string, unknown>, fallbackIndex: number): GamePullListRow {
  const callIndex = num(row.call_index) ?? num(row.seed) ?? fallbackIndex;
  const roundNumber = num(row.round_number);

  const artist =
    text(row.artist) ??
    text(row.artist_name) ??
    text(row.artist_answer) ??
    text(row.spin_artist) ??
    text(row.sampled_artist) ??
    text(row.track_a_artist);

  const title =
    text(row.title) ??
    text(row.title_answer) ??
    text(row.track_title) ??
    text(row.sampled_title) ??
    text(row.track_a_title) ??
    text(row.entry_label) ??
    text(row.question_text);

  const pairSourceLabel =
    [text(row.track_a_source_label), text(row.track_b_source_label)]
      .filter((value): value is string => Boolean(value))
      .join(" | ") || null;
  const sourceLabel = text(row.source_label) ?? pairSourceLabel;

  const detailParts = [
    text(row.detail),
    text(row.accepted_connection),
    text(row.accepted_detail),
    text(row.original_artist) ? `Original artist: ${text(row.original_artist)}` : null,
    text(row.source_artist) && text(row.source_title)
      ? `Source: ${text(row.source_artist)} - ${text(row.source_title)}`
      : null,
    text(row.category) ? `Category: ${text(row.category)}` : null,
    text(row.difficulty) ? `Difficulty: ${text(row.difficulty)}` : null,
    text(row.answer_key) ? `Answer: ${text(row.answer_key)}` : null,
    text(row.dj_cue_hint) ? `Cue: ${text(row.dj_cue_hint)}` : null,
  ].filter(Boolean) as string[];

  return {
    call_index: callIndex,
    round_number: roundNumber,
    artist,
    title,
    source_label: sourceLabel,
    detail: detailParts.length ? detailParts.join(" | ") : null,
    host_notes: text(row.host_notes),
  };
}

function normalizeRows(rows: Array<Record<string, unknown>>): GamePullListRow[] {
  return rows.map((row, index) => normalizeGenericRow(row, index + 1));
}

export async function downloadGamePullListPdf(options: DownloadGamePullListOptions): Promise<void> {
  const { accentRgb, gameSlug, gameTitle, sessionCode, sessionId } = options;
  const res = await fetch(`/api/games/${gameSlug}/sessions/${sessionId}/calls`);

  if (!res.ok) {
    alert("Failed to load pull list for PDF");
    return;
  }

  const payload = (await res.json()) as ApiPayload;
  const apiRows = payload.data ?? [];
  const rows = normalizeRows(apiRows);

  if (!rows.length) {
    alert("No pull list rows found for this session");
    return;
  }

  const doc = generateGamePullListPdf(rows, `${gameTitle} Pull List · ${sessionCode}`, accentRgb);
  doc.save(`${gameSlug}-${sessionCode.toLowerCase()}-pull-list.pdf`);
}
