import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";

export const runtime = "nodejs";

type CallPatchBody = {
  status?: "pending" | "asked" | "answer_revealed" | "scored" | "skipped";
  question_text?: string;
  answer_key?: string;
  accepted_answers?: string[];
  source_note?: string | null;
  prep_status?: "draft" | "ready";
  display_element_type?: "song" | "artist" | "album" | "cover_art" | "vinyl_label";
  display_image_override_url?: string | null;
  source_artist?: string | null;
  source_title?: string | null;
  source_album?: string | null;
  source_side?: string | null;
  source_position?: string | null;
  metadata_locked?: boolean;
};

type CallRow = {
  id: number;
  session_id: number;
  call_index: number;
  round_number: number;
  question_text: string;
  answer_key: string;
  prep_status: "draft" | "ready";
};

type SessionRow = {
  id: number;
  started_at: string | null;
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const callId = Number(id);
  if (!Number.isFinite(callId)) return NextResponse.json({ error: "Invalid call id" }, { status: 400 });

  const body = (await request.json()) as CallPatchBody;
  const hasEditableField =
    typeof body.status === "string" ||
    typeof body.question_text === "string" ||
    typeof body.answer_key === "string" ||
    Array.isArray(body.accepted_answers) ||
    typeof body.source_note === "string" ||
    body.source_note === null ||
    typeof body.prep_status === "string" ||
    typeof body.display_element_type === "string" ||
    typeof body.display_image_override_url === "string" ||
    body.display_image_override_url === null ||
    typeof body.source_artist === "string" ||
    body.source_artist === null ||
    typeof body.source_title === "string" ||
    body.source_title === null ||
    typeof body.source_album === "string" ||
    body.source_album === null ||
    typeof body.source_side === "string" ||
    body.source_side === null ||
    typeof body.source_position === "string" ||
    body.source_position === null ||
    typeof body.metadata_locked === "boolean";
  if (!hasEditableField) return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });

  const db = getTriviaDb();
  const { data: call, error: callError } = await db
    .from("trivia_session_calls")
    .select("id, session_id, call_index, round_number, question_text, answer_key, prep_status")
    .eq("id", callId)
    .maybeSingle();

  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  const typedCall = call as CallRow;
  const now = new Date().toISOString();

  const patch: Record<string, unknown> = {};

  if (body.status) {
    patch.status = body.status;
    if (body.status === "asked") patch.asked_at = now;
    if (body.status === "answer_revealed") patch.answer_revealed_at = now;
    if (body.status === "scored") patch.scored_at = now;
  }

  if (typeof body.question_text === "string") patch.question_text = body.question_text.trim();
  if (typeof body.answer_key === "string") patch.answer_key = body.answer_key.trim();
  if (Array.isArray(body.accepted_answers)) {
    patch.accepted_answers = Array.from(
      new Set(
        body.accepted_answers
          .map((answer) => String(answer).trim())
          .filter(Boolean)
      )
    );
  }
  if (typeof body.source_note === "string" || body.source_note === null) {
    patch.source_note = typeof body.source_note === "string" ? (body.source_note.trim() || null) : null;
  }
  if (body.prep_status === "draft" || body.prep_status === "ready") patch.prep_status = body.prep_status;
  if (
    body.display_element_type === "song" ||
    body.display_element_type === "artist" ||
    body.display_element_type === "album" ||
    body.display_element_type === "cover_art" ||
    body.display_element_type === "vinyl_label"
  ) {
    patch.display_element_type = body.display_element_type;
  }
  if (typeof body.display_image_override_url === "string" || body.display_image_override_url === null) {
    patch.display_image_override_url =
      typeof body.display_image_override_url === "string"
        ? (body.display_image_override_url.trim() || null)
        : null;
  }
  if (typeof body.source_artist === "string" || body.source_artist === null) {
    patch.source_artist = typeof body.source_artist === "string" ? body.source_artist.trim() || null : null;
  }
  if (typeof body.source_title === "string" || body.source_title === null) {
    patch.source_title = typeof body.source_title === "string" ? body.source_title.trim() || null : null;
  }
  if (typeof body.source_album === "string" || body.source_album === null) {
    patch.source_album = typeof body.source_album === "string" ? body.source_album.trim() || null : null;
  }
  if (typeof body.source_side === "string" || body.source_side === null) {
    patch.source_side = typeof body.source_side === "string" ? body.source_side.trim().toUpperCase() || null : null;
  }
  if (typeof body.source_position === "string" || body.source_position === null) {
    patch.source_position = typeof body.source_position === "string" ? body.source_position.trim() || null : null;
  }
  if (typeof body.metadata_locked === "boolean") {
    patch.metadata_locked = body.metadata_locked;
  }

  const touchedMetadataFields =
    Object.prototype.hasOwnProperty.call(body, "source_artist") ||
    Object.prototype.hasOwnProperty.call(body, "source_title") ||
    Object.prototype.hasOwnProperty.call(body, "source_album") ||
    Object.prototype.hasOwnProperty.call(body, "source_side") ||
    Object.prototype.hasOwnProperty.call(body, "source_position");
  if (touchedMetadataFields && typeof body.metadata_locked !== "boolean") {
    patch.metadata_locked = true;
  }
  if (touchedMetadataFields) {
    patch.metadata_synced_at = now;
  }

  const nextPrepStatus = (patch.prep_status as "draft" | "ready" | undefined) ?? typedCall.prep_status;
  const nextQuestion = (patch.question_text as string | undefined) ?? typedCall.question_text;
  const nextAnswer = (patch.answer_key as string | undefined) ?? typedCall.answer_key;
  if (nextPrepStatus === "ready" && (!nextQuestion.trim() || !nextAnswer.trim())) {
    return NextResponse.json(
      { error: "question_text and answer_key are required before marking prep_status=ready" },
      { status: 400 }
    );
  }

  const { error } = await db.from("trivia_session_calls").update(patch).eq("id", callId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.status === "asked") {
    const { data: session } = await db.from("trivia_sessions").select("id, started_at").eq("id", typedCall.session_id).maybeSingle();
    const typedSession = session as SessionRow | null;

    await db
      .from("trivia_sessions")
      .update({
        current_call_index: typedCall.call_index,
        current_round: typedCall.round_number,
        status: "running",
        countdown_started_at: now,
        paused_at: null,
        paused_remaining_seconds: null,
        started_at: typedSession?.started_at ?? now,
      })
      .eq("id", typedCall.session_id);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
