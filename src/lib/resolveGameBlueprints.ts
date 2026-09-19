// src/lib/resolveGameBlueprints.ts
//
// Single source of truth for "what games does the public actually see, and
// what's their current title/status/description" — merges the static
// gameBlueprints.ts defaults with admin-editable overrides stored in
// admin_settings (key "game:blueprint:<slug>"), including entirely new
// games added purely through the admin, which have no static entry at all.
//
// This resolver exists because the admin's edit UI and the public /games
// pages previously read two different sources: edits saved through the
// admin API went into admin_settings, but the public pages imported the
// static gameBlueprints array directly and never looked at admin_settings
// at all. Editing a game's status/title/description had zero effect on the
// live site. Both sides must go through this function.

import { gameBlueprints, type GameBlueprint, type GameStatus } from "src/lib/gameBlueprints";
import { publicCopyBySlug } from "src/lib/gamePublicCopy";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

export type ResolvedGame = GameBlueprint & {
  tagline: string;
  isCustom: boolean;
};

export type GameOverride = {
  title?: string;
  status?: GameStatus;
  notes?: string;
  tagline?: string;
  isCustom?: boolean;
};

const OVERRIDE_KEY_PREFIX = "game:blueprint:";

async function loadOverrides(): Promise<Map<string, GameOverride>> {
  const { data: rows, error } = await supabaseAdmin
    .from("admin_settings")
    .select("key, value")
    .like("key", `${OVERRIDE_KEY_PREFIX}%`);

  const overrideMap = new Map<string, GameOverride>();
  if (error || !rows) return overrideMap;

  for (const row of rows) {
    const slug = (row.key as string).slice(OVERRIDE_KEY_PREFIX.length);
    try {
      overrideMap.set(slug, JSON.parse(row.value as string) as GameOverride);
    } catch {
      // Ignore malformed overrides rather than failing the whole page.
    }
  }
  return overrideMap;
}

// Games added entirely through the admin (no static blueprint) don't need
// the development-era fields (coreMechanic, setup, scoring, pullSizeGuidance,
// whyItWorks) — those described how to BUILD the game, and development now
// happens on a separate site. Default them to empty so the public pages'
// existing optional-chaining renders them as simply absent, not broken.
function blankDevelopmentFields() {
  return {
    coreMechanic: "",
    setup: "",
    pullSizeGuidance: "",
    scoring: "",
    whyItWorks: "",
  };
}

export async function getResolvedGameBlueprints(): Promise<ResolvedGame[]> {
  const overrides = await loadOverrides();
  const staticSlugs = new Set(gameBlueprints.map((g) => g.slug));

  const fromStatic: ResolvedGame[] = gameBlueprints.map((blueprint) => {
    const override = overrides.get(blueprint.slug) ?? {};
    return {
      ...blueprint,
      ...override,
      tagline: override.tagline ?? publicCopyBySlug[blueprint.slug]?.tagline ?? "",
      isCustom: false,
    };
  });

  const fromCustom: ResolvedGame[] = [];
  for (const [slug, override] of overrides) {
    if (staticSlugs.has(slug)) continue;
    fromCustom.push({
      slug,
      title: override.title ?? slug,
      status: override.status ?? "undeveloped",
      notes: override.notes,
      tagline: override.tagline ?? "",
      isCustom: true,
      ...blankDevelopmentFields(),
    });
  }

  return [...fromStatic, ...fromCustom];
}

export async function getResolvedGameBlueprint(slug: string): Promise<ResolvedGame | null> {
  const all = await getResolvedGameBlueprints();
  return all.find((g) => g.slug === slug) ?? null;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
