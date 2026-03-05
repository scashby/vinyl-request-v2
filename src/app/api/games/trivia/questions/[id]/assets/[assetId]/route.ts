import { NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";
import { supabaseAdmin } from "src/lib/supabaseAdmin";
import { TRIVIA_BANK_ENABLED } from "src/lib/triviaBankApi";

export const runtime = "nodejs";

function parsePositiveInt(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; assetId: string }> }) {
  if (!TRIVIA_BANK_ENABLED) return NextResponse.json({ error: "Trivia bank disabled" }, { status: 404 });

  const { id, assetId } = await params;
  const questionId = parsePositiveInt(id);
  const typedAssetId = parsePositiveInt(assetId);
  if (!questionId || !typedAssetId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const db = getTriviaDb();
  const { data: asset, error: assetError } = await db
    .from("trivia_question_assets")
    .select("id, question_id, bucket, object_path")
    .eq("id", typedAssetId)
    .eq("question_id", questionId)
    .maybeSingle();
  if (assetError) return NextResponse.json({ error: assetError.message }, { status: 500 });
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  const { error: deleteError } = await db
    .from("trivia_question_assets")
    .delete()
    .eq("id", typedAssetId)
    .eq("question_id", questionId);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  await supabaseAdmin.storage.from(asset.bucket || "trivia-assets").remove([asset.object_path]);

  const { data: remaining } = await db
    .from("trivia_question_assets")
    .select("id")
    .eq("question_id", questionId)
    .limit(1);
  if (!remaining || remaining.length === 0) {
    await db
      .from("trivia_question_facets")
      .upsert({
        question_id: questionId,
        has_media: false,
      }, { onConflict: "question_id" });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
