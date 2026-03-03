#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const GAME_CONFIG = {
  bingo: { sessionTable: "bingo_sessions", endpointSlug: "bingo" },
  trivia: { sessionTable: "trivia_sessions", endpointSlug: "trivia" },
  "name-that-tune": { sessionTable: "ntt_sessions", endpointSlug: "name-that-tune" },
  "genre-imposter": { sessionTable: "gi_sessions", endpointSlug: "genre-imposter" },
};

function parseArgs(argv) {
  const args = {
    apply: false,
    games: Object.keys(GAME_CONFIG),
    statuses: ["pending", "running", "paused"],
    baseUrl: process.env.APP_BASE_URL || "http://localhost:3000",
  };

  for (const token of argv.slice(2)) {
    if (token === "--apply") args.apply = true;
    if (token.startsWith("--games=")) args.games = token.slice("--games=".length).split(",").map((v) => v.trim()).filter(Boolean);
    if (token.startsWith("--statuses=")) args.statuses = token.slice("--statuses=".length).split(",").map((v) => v.trim()).filter(Boolean);
    if (token.startsWith("--base-url=")) args.baseUrl = token.slice("--base-url=".length).replace(/\/+$/, "");
  }

  return args;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY");
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function fetchSessions(supabase, game, statuses) {
  const cfg = GAME_CONFIG[game];
  if (!cfg) return [];
  const { data, error } = await supabase
    .from(cfg.sessionTable)
    .select("id, status, session_code")
    .in("status", statuses)
    .order("id", { ascending: true });
  if (error) throw new Error(`${game}: ${error.message}`);
  return data ?? [];
}

async function refreshSession(baseUrl, game, sessionId, apply) {
  const query = apply ? "" : "?dryRun=1";
  const url = `${baseUrl}/api/games/${GAME_CONFIG[game].endpointSlug}/sessions/${sessionId}/refresh-metadata${query}`;
  const response = await fetch(url, { method: "POST" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `${response.status} ${response.statusText}`);
  }
  return payload;
}

async function main() {
  const args = parseArgs(process.argv);
  const supabase = getSupabase();

  const summary = {
    processed: 0,
    updated: 0,
    skipped_locked: 0,
    unresolved: 0,
    failures: 0,
  };

  console.log(`Mode: ${args.apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`Games: ${args.games.join(", ")}`);
  console.log(`Statuses: ${args.statuses.join(", ")}`);
  console.log(`Base URL: ${args.baseUrl}`);

  for (const game of args.games) {
    if (!GAME_CONFIG[game]) {
      console.warn(`Skipping unsupported game: ${game}`);
      continue;
    }
    const sessions = await fetchSessions(supabase, game, args.statuses);
    console.log(`\n[${game}] sessions: ${sessions.length}`);

    for (const session of sessions) {
      summary.processed += 1;
      try {
        const result = await refreshSession(args.baseUrl, game, session.id, args.apply);
        summary.updated += Number(result.updated_count ?? 0);
        summary.skipped_locked += Number(result.skipped_locked_count ?? 0);
        summary.unresolved += Number(result.unresolved_count ?? 0);
        console.log(
          `[${game}] #${session.id} (${session.session_code ?? "n/a"}) updated=${result.updated_count ?? 0} locked=${result.skipped_locked_count ?? 0} unresolved=${result.unresolved_count ?? 0}`
        );
      } catch (error) {
        summary.failures += 1;
        console.error(`[${game}] #${session.id} failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }
  }

  console.log("\nSummary:");
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
