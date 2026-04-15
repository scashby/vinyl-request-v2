// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — masters/artists/crates tables are not in TriviaDatabase; use supabaseAdmin directly
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";
import { getTriviaDb } from "src/lib/triviaDb";
import {
  contentHash,
  type MasterForFacts,
  type ArtistForFacts,
  type TriviaRawFact,
} from "src/lib/triviaFactFetcher";
import { generateRawTrivia, type RawTriviaFact } from "src/lib/triviaAIGenerator";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes — sequential Sonnet calls can be slow

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScopeType =
  | "collection"
  | "playlist"
  | "crate"
  | "artist"
  | "album"
  | "format"
  | "decade"
  | "genre";

type FetchFactsRequest = {
  scope_type: ScopeType;
  scope_ref_id?: number | null;
  scope_value?: string | null;
  entity_limit?: number;
  run_id?: number | null;
  created_by?: string;
};

type MasterRow = MasterForFacts & { main_artist_id: number | null };
type ArtistRow = ArtistForFacts;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDecade(value: string): number | null {
  const m = value.match(/(\d{4})/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  return Math.floor(year / 10) * 10;
}

const MASTER_SELECT = [
  "id",
  "title",
  "notes",
  "critical_reception",
  "cultural_significance",
  "producers",
  "engineers",
  "musicians",
  "songwriters",
  "chart_positions",
  "awards",
  "certifications",
  "recording_location",
  "recording_date",
  "allmusic_review",
  "pitchfork_review",
  "discogs_master_id",
  "wikipedia_url",
  "genres",
  "styles",
  "main_artist_id",
].join(", ");

// ---------------------------------------------------------------------------
// Scope resolver — returns distinct masters (+ their artist IDs)
// ---------------------------------------------------------------------------

async function resolveEntityPool(
  req: FetchFactsRequest,
  limit: number
): Promise<{ masters: MasterRow[]; artistIds: Set<number> }> {
  const db = supabaseAdmin as unknown as { from: (t: string) => unknown };
  const { scope_type, scope_ref_id, scope_value } = req;

  let masterRows: MasterRow[] = [];

  if (scope_type === "collection") {
    // All masters linked to inventory items
    const { data } = await (db
      .from("inventory")
      .select(`releases!inner(masters!inner(${MASTER_SELECT}))`)
      .limit(limit * 5) as unknown as Promise<{ data: unknown[] | null }>);

    const seen = new Set<number>();
    for (const row of (data ?? []) as Array<{ releases: { masters: MasterRow } }>) {
      const m = row.releases?.masters;
      if (m && !seen.has(m.id)) { seen.add(m.id); masterRows.push(m); }
    }

  } else if (scope_type === "playlist" && scope_ref_id) {
    const { data: items } = await (db
      .from("collection_playlist_items")
      .select("inventory:inventory_id(releases!inner(masters!inner(" + MASTER_SELECT + ")))")
      .eq("playlist_id", scope_ref_id)
      .limit(limit * 5) as unknown as Promise<{ data: unknown[] | null }>);

    const seen = new Set<number>();
    for (const row of (items ?? []) as Array<{ inventory: { releases: { masters: MasterRow } } }>) {
      const m = row.inventory?.releases?.masters;
      if (m && !seen.has(m.id)) { seen.add(m.id); masterRows.push(m); }
    }

  } else if (scope_type === "crate" && scope_ref_id) {
    // Resolve crate → inventory_ids → masters
    const { data: crateItems } = await (db
      .from("crate_items")
      .select("inventory_id")
      .eq("crate_id", scope_ref_id)
      .limit(limit * 5) as unknown as Promise<{ data: Array<{ inventory_id: number }> | null }>);

    const inventoryIds = (crateItems ?? []).map((c) => c.inventory_id).filter(Boolean);
    if (inventoryIds.length) {
      const { data: invRows } = await (db
        .from("inventory")
        .select(`releases!inner(masters!inner(${MASTER_SELECT}))`)
        .in("id", inventoryIds) as unknown as Promise<{ data: unknown[] | null }>);

      const seen = new Set<number>();
      for (const row of (invRows ?? []) as Array<{ releases: { masters: MasterRow } }>) {
        const m = row.releases?.masters;
        if (m && !seen.has(m.id)) { seen.add(m.id); masterRows.push(m); }
      }
    }

  } else if (scope_type === "artist" && scope_ref_id) {
    const { data } = await (db
      .from("masters")
      .select(MASTER_SELECT)
      .eq("main_artist_id", scope_ref_id)
      .limit(limit) as unknown as Promise<{ data: MasterRow[] | null }>);
    masterRows = data ?? [];

  } else if (scope_type === "album" && scope_ref_id) {
    const { data } = await (db
      .from("masters")
      .select(MASTER_SELECT)
      .eq("id", scope_ref_id)
      .single() as unknown as Promise<{ data: MasterRow | null }>);
    if (data) masterRows = [data];

  } else if (scope_type === "format" && scope_value) {
    // Filter by format_details on releases, then resolve masters
    const term = scope_value.toLowerCase();
    const { data } = await (db
      .from("inventory")
      .select(`releases!inner(format_details, masters!inner(${MASTER_SELECT}))`)
      .limit(limit * 10) as unknown as Promise<{ data: unknown[] | null }>);

    const seen = new Set<number>();
    for (const row of (data ?? []) as Array<{ releases: { format_details: string[] | null; masters: MasterRow } }>) {
      const fmts = row.releases?.format_details ?? [];
      const matches = fmts.some((f: string) => f.toLowerCase().includes(term));
      const m = row.releases?.masters;
      if (matches && m && !seen.has(m.id)) { seen.add(m.id); masterRows.push(m); }
    }

  } else if (scope_type === "decade" && scope_value) {
    const decadeStart = parseDecade(scope_value);
    if (decadeStart !== null) {
      const { data } = await (db
        .from("inventory")
        .select(`releases!inner(release_year, masters!inner(${MASTER_SELECT}))`)
        .gte("releases.release_year", decadeStart)
        .lt("releases.release_year", decadeStart + 10)
        .limit(limit * 5) as unknown as Promise<{ data: unknown[] | null }>);

      const seen = new Set<number>();
      for (const row of (data ?? []) as Array<{ releases: { masters: MasterRow } }>) {
        const m = row.releases?.masters;
        if (m && !seen.has(m.id)) { seen.add(m.id); masterRows.push(m); }
      }
    }

  } else if (scope_type === "genre" && scope_value) {
    const { data } = await (db
      .from("masters")
      .select(MASTER_SELECT)
      .contains("genres", [scope_value])
      .limit(limit) as unknown as Promise<{ data: MasterRow[] | null }>);
    masterRows = data ?? [];
  }

  // Collect unique artist IDs
  const artistIds = new Set<number>();
  for (const m of masterRows) {
    if (m.main_artist_id) artistIds.add(m.main_artist_id);
  }

  return { masters: masterRows.slice(0, limit), artistIds };
}

// ---------------------------------------------------------------------------
// Fact storage helpers
// ---------------------------------------------------------------------------

async function upsertSourceRecord(
  triviaDb: unknown,
  fact: TriviaRawFact,
  runId: number,
  createdBy: string
): Promise<number | null> {
  const db = triviaDb as { from: (t: string) => unknown };
  const hash = fact.content_hash;

  // Check for existing source record with same content
  const { data: existing } = await (db
    .from("trivia_source_records")
    .select("id, fetched_at")
    .eq("content_hash", hash)
    .maybeSingle() as unknown as Promise<{ data: { id: number; fetched_at: string | null } | null }>);

  if (existing) return existing.id;

  const now = new Date().toISOString();
  const { data: inserted, error } = await (db
    .from("trivia_source_records")
    .insert({
      import_run_id: runId,
      source_kind: fact.source_url ? "api" : "editorial",
      source_url: fact.source_url,
      source_domain: fact.source_domain,
      source_title: fact.source_title,
      excerpt_text: fact.excerpt_text.slice(0, 2000),
      claim_text: fact.fact_text.slice(0, 1000),
      verification_status: "unreviewed",
      content_hash: hash,
      fetched_at: now,
      created_by: createdBy,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single() as unknown as Promise<{ data: { id: number } | null; error: { message: string } | null }>);

  if (error) { console.error("[facts/fetch] source record insert error:", error.message); return null; }
  return inserted?.id ?? null;
}

function generateFactCode(): string {
  const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "TF-";
  for (let i = 0; i < 7; i++) code += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return code;
}

async function insertFact(
  triviaDb: unknown,
  fact: TriviaRawFact,
  sourceRecordId: number | null,
  runId: number,
  createdBy: string
): Promise<boolean> {
  const db = triviaDb as { from: (t: string) => unknown };

  // Dedup: skip if fact_text already exists for this entity
  const { data: existing } = await (db
    .from("trivia_facts")
    .select("id")
    .eq("entity_type", fact.entity_type)
    .eq("entity_id", fact.entity_id)
    .eq("fact_text", fact.fact_text.slice(0, 500))
    .maybeSingle() as unknown as Promise<{ data: { id: number } | null }>);
  if (existing) return false;

  // Generate unique code
  let code = "";
  for (let i = 0; i < 20; i++) {
    const candidate = generateFactCode();
    const { data } = await (db
      .from("trivia_facts")
      .select("id")
      .eq("fact_code", candidate)
      .maybeSingle() as unknown as Promise<{ data: { id: number } | null }>);
    if (!data) { code = candidate; break; }
  }
  if (!code) return false;

  const now = new Date().toISOString();
  const { error } = await (db
    .from("trivia_facts")
    .insert({
      fact_code: code,
      entity_type: fact.entity_type,
      entity_id: fact.entity_id,
      entity_ref: fact.entity_ref,
      fact_text: fact.fact_text,
      fact_kind: fact.fact_kind,
      status: "draft",
      confidence: fact.confidence,
      generation_run_id: runId,
      source_record_id: sourceRecordId,
      created_by: createdBy,
      created_at: now,
      updated_at: now,
    }) as unknown as Promise<{ error: { message: string } | null }>);

  if (error) { console.error("[facts/fetch] fact insert error:", error.message); return false; }
  return true;
}

// ---------------------------------------------------------------------------
// AI trivia fact insertion (Phase 1 — Claude Sonnet surprising trivia)
// ---------------------------------------------------------------------------

async function insertAIFacts(
  triviaDb: unknown,
  aiFacts: RawTriviaFact[],
  entityType: "artist" | "master",
  entityId: number,
  entityRef: string,
  runId: number,
  createdBy: string
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const ai of aiFacts) {
    const factText = ai.fact.trim();
    if (factText.length < 20) continue;

    const hash = contentHash(factText);

    // Build a minimal TriviaRawFact-shaped object so we can reuse upsertSourceRecord
    const rawFact: TriviaRawFact = {
      entity_type: entityType,
      entity_id: entityId,
      entity_ref: entityRef,
      fact_text: factText,
      fact_kind: ai.kind,
      confidence: "high", // Claude Sonnet from its own training
      source_url: null,
      source_domain: null,
      source_title: "Claude AI (training knowledge)",
      excerpt_text: factText,
      content_hash: hash,
    };

    const srcId = await upsertSourceRecord(triviaDb, rawFact, runId, createdBy);
    const ok = await insertFact(triviaDb, rawFact, srcId, runId, createdBy);
    if (ok) inserted++;
    else skipped++;
  }

  return { inserted, skipped };
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const triviaDb = getTriviaDb();

  let body: FetchFactsRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    scope_type,
    scope_ref_id = null,
    scope_value = null,
    entity_limit = 20,
    run_id = null,
    created_by = "trivia-fact-fetcher",
  } = body;

  const validScopes: ScopeType[] = ["collection", "playlist", "crate", "artist", "album", "format", "decade", "genre"];
  if (!validScopes.includes(scope_type)) {
    return NextResponse.json({ error: "Invalid scope_type" }, { status: 400 });
  }

  const limit = Math.min(Math.max(1, entity_limit ?? 20), 100);
  const now = new Date().toISOString();

  // Create or retrieve import run
  let runId = run_id;
  if (!runId) {
    const runCode = `TFRUN-${Date.now()}`;
    const { data: run, error: runErr } = await (triviaDb as unknown as { from: (t: string) => unknown })
      .from("trivia_import_runs")
      .insert({
        run_code: runCode,
        source_mode: "api",
        status: "running",
        triggered_by: created_by,
        scope_payload: { scope_type, scope_ref_id, scope_value, limit },
        notes_text: `Fact fetch: ${scope_type}`,
        created_at: now,
        started_at: now,
      })
      .select("id")
      .single() as unknown as Promise<{ data: { id: number } | null; error: { message: string } | null }>;

    if (runErr || !run) {
      return NextResponse.json({ error: runErr?.message ?? "Failed to create import run" }, { status: 500 });
    }
    runId = run.id;
  }

  // Resolve entity pool
  let masters: MasterRow[];
  let artistIds: Set<number>;
  try {
    ({ masters, artistIds } = await resolveEntityPool(body, limit));
  } catch (err) {
    console.error("[facts/fetch] scope resolution error:", err);
    return NextResponse.json({ error: "Failed to resolve entity pool" }, { status: 500 });
  }

  // Fetch artist rows for entities in pool
  const artistMap = new Map<number, ArtistRow>();
  if (artistIds.size > 0) {
    const { data: artists } = await (supabaseAdmin as unknown as { from: (t: string) => unknown })
      .from("artists")
      .select("id, name, discogs_id")
      .in("id", [...artistIds]) as unknown as Promise<{ data: ArtistRow[] | null }>;
    for (const a of (artists ?? [])) artistMap.set(a.id, a);
  }

  let factsInserted = 0;
  let skippedDuplicates = 0;
  const processedArtists = new Set<number>();
  const apiErrors: string[] = [];

  for (const master of masters) {
    const genres: string[] = master.genres ?? [];

    // Ask Claude Sonnet for counterintuitive, pub-quiz-worthy trivia about the album
    try {
      const aiAlbumFacts = await generateRawTrivia(master.title, "album", { genres });
      const { inserted: aiAlbumInserted, skipped: aiAlbumSkipped } = await insertAIFacts(
        triviaDb, aiAlbumFacts, "master", master.id, master.title, runId, created_by
      );
      factsInserted += aiAlbumInserted;
      skippedDuplicates += aiAlbumSkipped;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[facts/fetch] AI album error for "${master.title}":`, msg);
      apiErrors.push(`album "${master.title}": ${msg}`);
      // Stop on first API error — likely auth/model issue affecting all calls
      break;
    }

    // Ask Claude Sonnet for surprising artist trivia (once per artist)
    if (master.main_artist_id && !processedArtists.has(master.main_artist_id)) {
      processedArtists.add(master.main_artist_id);
      const artist = artistMap.get(master.main_artist_id);
      if (artist) {
        try {
          const aiArtistFacts = await generateRawTrivia(artist.name, "artist", { genres });
          const { inserted: aiArtistInserted, skipped: aiArtistSkipped } = await insertAIFacts(
            triviaDb, aiArtistFacts, "artist", artist.id, artist.name, runId, created_by
          );
          factsInserted += aiArtistInserted;
          skippedDuplicates += aiArtistSkipped;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[facts/fetch] AI artist error for "${artist.name}":`, msg);
          apiErrors.push(`artist "${artist.name}": ${msg}`);
        }
      }
    }
  }

  // Mark run complete
  await (triviaDb as unknown as { from: (t: string) => unknown })
    .from("trivia_import_runs")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", runId);

  return NextResponse.json({
    run_id: runId,
    facts_fetched: factsInserted,
    entities_processed: masters.length,
    artists_processed: processedArtists.size,
    skipped_duplicates: skippedDuplicates,
    ...(apiErrors.length ? { api_errors: apiErrors } : {}),
  });
}
