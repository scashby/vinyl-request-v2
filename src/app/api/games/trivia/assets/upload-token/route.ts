import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "src/lib/supabaseAdmin";
import { TRIVIA_BANK_ENABLED } from "src/lib/triviaBankApi";

export const runtime = "nodejs";

type Body = {
  question_id?: number | null;
  filename?: string;
  asset_type?: "image" | "audio" | "video";
};

function sanitizeFilename(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "asset.bin";
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return safe || "asset.bin";
}

export async function POST(request: NextRequest) {
  if (!TRIVIA_BANK_ENABLED) return NextResponse.json({ error: "Trivia bank disabled" }, { status: 404 });

  const body = (await request.json()) as Body;
  const questionId = Number(body.question_id);
  const filename = sanitizeFilename(body.filename ?? "asset.bin");
  const questionScope = Number.isFinite(questionId) && questionId > 0 ? String(Math.floor(questionId)) : "unassigned";
  const pathAssetId = randomUUID().replace(/-/g, "");
  const objectPath = `trivia/questions/${questionScope}/${pathAssetId}/${filename}`;

  const { data, error } = await supabaseAdmin.storage
    .from("trivia-assets")
    .createSignedUploadUrl(objectPath);

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Failed to create signed upload url" }, { status: 500 });

  return NextResponse.json(
    {
      bucket: "trivia-assets",
      object_path: objectPath,
      signed_url: data.signedUrl,
      token: data.token,
      path: data.path,
    },
    { status: 200 }
  );
}
