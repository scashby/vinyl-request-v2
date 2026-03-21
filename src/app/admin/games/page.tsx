import path from "node:path";
import { existsSync } from "node:fs";
import { supabaseAdmin } from "src/lib/supabaseAdmin";
import { gameBlueprints, type GameBlueprint, type GameStatus } from "src/lib/gameBlueprints";
import GamesHub from "./_components/GamesHub";

type GameOverride = {
  title?: string;
  status?: GameStatus;
  notes?: string;
  pullSizeGuidance?: string;
};

async function getMergedBlueprints() {
  const { data: rows } = await supabaseAdmin
    .from("admin_settings")
    .select("key, value")
    .like("key", "game:blueprint:%");

  const overrideMap = new Map<string, GameOverride>();
  for (const row of rows ?? []) {
    const slug = (row.key as string).replace("game:blueprint:", "");
    try {
      overrideMap.set(slug, JSON.parse(row.value as string) as GameOverride);
    } catch {
      // Ignore malformed overrides
    }
  }

  return gameBlueprints.map((blueprint: GameBlueprint) => {
    const override = overrideMap.get(blueprint.slug) ?? {};
    const hasConcreteModule = existsSync(
      path.join(process.cwd(), "src", "app", "admin", "games", blueprint.slug, "page.tsx")
    );
    return { ...blueprint, ...override, hasConcreteModule };
  });
}

export default async function GamesHomePage() {
  const initialGames = await getMergedBlueprints();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#4a1f16,transparent_40%),radial-gradient(circle_at_80%_0%,#1f3c42,transparent_35%),linear-gradient(180deg,#121212,#1b1b1b)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-3xl border border-amber-900/50 bg-black/40 p-8 shadow-[0_20px_80px_rgba(0,0,0,0.55)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.35em] text-amber-300">Analog Night Ops</p>
            <a
              href="/edit-collection?playlistStudio=1&playlistView=manual&viewMode=playlist&trackSource=playlists&folderMode=playlists"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-amber-700 px-3 py-1 text-xs uppercase tracking-[0.15em] hover:border-amber-400 hover:text-amber-200"
            >
              Open Playlist Editor
            </a>
          </div>
          <h1 className="mt-2 text-5xl font-black uppercase tracking-tight text-amber-100">Game Admin Center</h1>
          <p className="mt-3 max-w-2xl text-sm text-stone-300">
            Vinyl-first control room. Printed play, live host orchestration, and big-screen display scenes.
          </p>

          <GamesHub initialGames={initialGames} />
        </div>
      </div>
    </div>
  );
}
