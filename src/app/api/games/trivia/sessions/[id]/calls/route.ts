import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";
import { autoSyncSessionPlaylistMetadata } from "src/lib/playlistMetadataSync";
import { supabaseAdmin } from "src/lib/supabaseAdmin";
import { sanitizeCuePayload, type JsonValue } from "src/lib/triviaBank";

export const runtime = "nodejs";

type MediaAsset = {
  id: number | null;
  asset_role: string;
  asset_type: string;
  bucket: string;
  object_path: string;
  sort_order: number;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
};

type CueAsset = {
  bucket: string;
  object_path: string;
};

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value: unknown): string | null {
  const text = asString(value);
  return text || null;
}

function asNumberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function extractMediaAssets(revealPayload: unknown): MediaAsset[] {
  const payload = asObject(revealPayload);
  const rawAssets = Array.isArray(payload.media_assets)
    ? payload.media_assets
    : (Array.isArray(payload.assets) ? payload.assets : []);

  return rawAssets
    .map((assetRaw) => asObject(assetRaw))
    .map((asset) => ({
      id: asNumberOrNull(asset.id),
      asset_role: asString(asset.asset_role) || "clue_primary",
      asset_type: asString(asset.asset_type) || "image",
      bucket: asString(asset.bucket) || "trivia-assets",
      object_path: asString(asset.object_path),
      sort_order: Number.isFinite(Number(asset.sort_order)) ? Number(asset.sort_order) : 0,
      mime_type: asNullableString(asset.mime_type),
      width: asNumberOrNull(asset.width),
      height: asNumberOrNull(asset.height),
      duration_seconds: asNumberOrNull(asset.duration_seconds),
    }))
    .filter((asset) => asset.object_path.length > 0)
    .sort((a, b) => a.sort_order - b.sort_order);
}

function extractCueAsset(cueSourceType: unknown, cueSourcePayload: unknown): CueAsset | null {
  const cueType = asString(cueSourceType).toLowerCase();
  if (cueType !== "uploaded_clip") return null;
  const payload = asObject(cueSourcePayload);
  const bucket = asString(payload.bucket) || "trivia-assets";
  const objectPath = asString(payload.object_path);
  if (!objectPath) return null;
  return {
    bucket,
    object_path: objectPath,
  };
}

async function signMediaAssets(assets: MediaAsset[]): Promise<Map<string, string>> {
  const byBucket = new Map<string, string[]>();
  for (const asset of assets) {
    const current = byBucket.get(asset.bucket) ?? [];
    if (!current.includes(asset.object_path)) current.push(asset.object_path);
    byBucket.set(asset.bucket, current);
  }

  const signedMap = new Map<string, string>();
  for (const [bucket, paths] of byBucket) {
    const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrls(paths, 60 * 20);
    if (error || !Array.isArray(data)) continue;

    for (const row of data) {
      if (row?.path && row?.signedUrl) {
        signedMap.set(`${bucket}:${row.path}`, row.signedUrl);
      }
    }
  }

  return signedMap;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getTriviaDb();
  try {
    await autoSyncSessionPlaylistMetadata("trivia", sessionId);
  } catch {
    // Fail-open to keep host view available.
  }

  const { data, error } = await db
    .from("trivia_session_calls")
    .select("id, session_id, round_number, call_index, playlist_track_key, question_id, question_type, is_tiebreaker, category, difficulty, question_text, answer_key, accepted_answers, options_payload, answer_payload, explanation_text, reveal_payload, source_note, cue_source_type, cue_source_payload, primary_cue_start_seconds, primary_cue_end_seconds, primary_cue_instruction, cue_notes_text, cue_payload, prep_status, display_element_type, display_image_override_url, auto_cover_art_url, auto_vinyl_label_url, source_artist, source_title, source_album, source_side, source_position, metadata_locked, metadata_synced_at, base_points, bonus_points, status, asked_at, answer_revealed_at, scored_at, created_at")
    .eq("session_id", sessionId)
    .order("call_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const allAssets = rows.flatMap((row) => extractMediaAssets(row.reveal_payload));
  const cueAssets: MediaAsset[] = rows
    .map((row) => extractCueAsset(row.cue_source_type, row.cue_source_payload))
    .filter((asset): asset is CueAsset => Boolean(asset))
    .map((asset) => ({
      id: null,
      asset_role: "clue_primary",
      asset_type: "audio",
      bucket: asset.bucket,
      object_path: asset.object_path,
      sort_order: 0,
      mime_type: null,
      width: null,
      height: null,
      duration_seconds: null,
    }));
  const signedMap = await signMediaAssets([...allAssets, ...cueAssets]);

  const mapped = rows.map((row) => {
    const revealPayload = asObject(row.reveal_payload);
    const cuePayload = sanitizeCuePayload(row.cue_payload);
    const cueSourcePayload = asObject(row.cue_source_payload);
    const cueSourceType = asString(row.cue_source_type) || null;
    const cueAsset = extractCueAsset(cueSourceType, cueSourcePayload);
    const cueSourceSignedUrl = cueAsset
      ? (signedMap.get(`${cueAsset.bucket}:${cueAsset.object_path}`) ?? null)
      : null;
    const mediaAssets = extractMediaAssets(row.reveal_payload);

    const signedMediaAssets = mediaAssets.map((asset) => {
      const signedUrl = signedMap.get(`${asset.bucket}:${asset.object_path}`) ?? null;
      return {
        ...asset,
        signed_url: signedUrl,
      };
    });

    const fallbackSignedImage = signedMediaAssets.find((asset) => asset.asset_type === "image" && asset.signed_url)?.signed_url ?? null;
    const displayElementType = asString(row.display_element_type);
    const effectiveDisplayImageUrl =
      asNullableString(row.display_image_override_url) ??
      (displayElementType === "vinyl_label" ? asNullableString(row.auto_vinyl_label_url) : asNullableString(row.auto_cover_art_url)) ??
      fallbackSignedImage;

    return {
      ...row,
      question_id: asNumberOrNull(row.question_id),
      question_type: asString(row.question_type) || "free_response",
      options_payload: (row.options_payload ?? []) as JsonValue,
      answer_payload: (row.answer_payload ?? {}) as JsonValue,
      explanation_text: asNullableString(row.explanation_text),
      reveal_payload: {
        ...revealPayload,
        media_assets: signedMediaAssets,
      },
      reveal_media_assets: signedMediaAssets,
      cue_notes_text: asNullableString(row.cue_notes_text),
      cue_payload: cuePayload,
      cue_segments: cuePayload.segments,
      cue_source_type: cueSourceType,
      cue_source_payload: cueSourcePayload,
      cue_source_signed_url: cueSourceSignedUrl,
      primary_cue_start_seconds: asNumberOrNull(row.primary_cue_start_seconds),
      primary_cue_end_seconds: asNumberOrNull(row.primary_cue_end_seconds),
      primary_cue_instruction: asNullableString(row.primary_cue_instruction),
      effective_display_image_url: effectiveDisplayImageUrl,
    };
  });

  return NextResponse.json({ data: mapped }, { status: 200 });
}
