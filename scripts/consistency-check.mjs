import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

function loadEnvFromFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

// Best-effort load for local runs (Next.js loads these automatically; plain Node does not).
loadEnvFromFile(path.join(process.cwd(), ".env.local"));
loadEnvFromFile(path.join(process.cwd(), ".env"));

const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const key = String(process.env.SUPABASE_SECRET_KEY || "").trim();
const sampleSize = Math.min(200, Math.max(5, Number(process.env.CONSISTENCY_SAMPLE || 25)));

if (!url || !key) {
  console.error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY");
  process.exit(2);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function normalizePosition(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

async function main() {
  console.log(`🔎 Consistency check (sample=${sampleSize})`);

  const { data: inventory, error: invErr } = await supabase
    .from("inventory")
    .select("id, release_id")
    .not("release_id", "is", null)
    .order("id", { ascending: false })
    .limit(sampleSize);

  if (invErr) throw invErr;

  let failures = 0;

  for (const row of inventory || []) {
    const inventoryId = row.id;
    const releaseId = row.release_id;
    if (!releaseId) continue;

    const [{ data: tracks, error: trackErr }, { data: rel, error: relErr }] = await Promise.all([
      supabase
        .from("release_tracks")
        .select("id, position, recording_id")
        .eq("release_id", releaseId),
      supabase
        .from("releases")
        .select("id, track_count")
        .eq("id", releaseId)
        .single(),
    ]);

    if (trackErr) throw trackErr;
    if (relErr) throw relErr;

    const positions = (tracks || []).map((t) => normalizePosition(t.position));
    const dupes = positions.filter((p, idx) => p && positions.indexOf(p) !== idx);
    const missingPos = positions.filter((p) => !p);

    if (dupes.length > 0 || missingPos.length > 0) {
      failures += 1;
      console.log(
        `❌ inventory ${inventoryId} release ${releaseId}: duplicate/missing positions (dupes=${new Set(
          dupes
        ).size}, missing=${missingPos.length})`
      );
    }

    const dbCount = typeof rel.track_count === "number" ? rel.track_count : null;
    if (dbCount !== null && dbCount !== (tracks || []).length) {
      failures += 1;
      console.log(
        `❌ inventory ${inventoryId} release ${releaseId}: releases.track_count=${dbCount} but release_tracks=${(tracks || []).length}`
      );
    }
  }

  if (failures > 0) {
    console.log(`\n❌ Consistency check failed (${failures} issue(s))`);
    process.exit(1);
  }

  console.log("\n✅ Consistency check passed");
}

main().catch((err) => {
  console.error("Fatal:", err?.message || err);
  process.exit(1);
});
