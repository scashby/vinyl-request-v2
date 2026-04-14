import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb, type TriviaDatabase } from "src/lib/triviaDb";

export const runtime = "nodejs";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value: unknown): string | null {
  const text = asString(value);
  return text || null;
}

async function generateRunCode() {
  const db = getTriviaDb();
  for (let i = 0; i < 20; i += 1) {
    const code = `TRI-IMP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const { data } = await db.from("trivia_import_runs").select("id").eq("run_code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Unable to generate unique import run code");
}

export async function GET() {
  const db = getTriviaDb();
  const { data, error } = await db
    .from("trivia_import_runs")
    .select("id, run_code, source_mode, status, triggered_by, scope_payload, source_payload, notes_text, created_at, started_at, completed_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const runs = (data ?? []) as Array<Record<string, unknown>>;
  const runIds = runs.map((run) => Number(run.id)).filter((value) => Number.isFinite(value));
  const { data: sourceCounts, error: sourceCountsError } = runIds.length > 0
    ? await db
        .from("trivia_source_records")
        .select("import_run_id")
        .in("import_run_id", runIds)
    : { data: [], error: null };

  if (sourceCountsError) return NextResponse.json({ error: sourceCountsError.message }, { status: 500 });

  const countByRunId = new Map<number, number>();
  for (const row of (sourceCounts ?? []) as Array<{ import_run_id: number | null }>) {
    const runId = Number(row.import_run_id);
    if (!Number.isFinite(runId)) continue;
    countByRunId.set(runId, (countByRunId.get(runId) ?? 0) + 1);
  }

  return NextResponse.json({
    data: runs.map((run) => ({
      ...run,
      source_record_count: countByRunId.get(Number(run.id)) ?? 0,
    })),
  }, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const db = getTriviaDb();
    const body = (await request.json()) as Record<string, unknown>;
    const now = new Date().toISOString();
    const runCode = await generateRunCode();

    const sourceModeRaw = asString(body.source_mode).toLowerCase();
    const sourceMode = sourceModeRaw === "api" || sourceModeRaw === "editorial" || sourceModeRaw === "search"
      ? sourceModeRaw
      : "manual";

    const statusRaw = asString(body.status).toLowerCase();
    const status = statusRaw === "running" || statusRaw === "completed" || statusRaw === "failed" || statusRaw === "cancelled"
      ? statusRaw
      : "pending";

    const scopePayload = (body.scope_payload && typeof body.scope_payload === "object" ? body.scope_payload : {}) as TriviaDatabase["public"]["Tables"]["trivia_import_runs"]["Insert"]["scope_payload"];
    const sourcePayload = (body.source_payload && typeof body.source_payload === "object" ? body.source_payload : {}) as TriviaDatabase["public"]["Tables"]["trivia_import_runs"]["Insert"]["source_payload"];

    const { data, error } = await db
      .from("trivia_import_runs")
      .insert({
        run_code: runCode,
        source_mode: sourceMode,
        status,
        triggered_by: asNullableString(body.triggered_by) ?? "admin",
        scope_payload: scopePayload,
        source_payload: sourcePayload,
        notes_text: asNullableString(body.notes_text),
        created_at: now,
        started_at: status === "running" ? now : null,
        completed_at: status === "completed" ? now : null,
      })
      .select("id, run_code, source_mode, status, triggered_by, scope_payload, source_payload, notes_text, created_at, started_at, completed_at")
      .single();

    if (error || !data) return NextResponse.json({ error: error?.message ?? "Failed to create import run" }, { status: 500 });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}