import Image from "next/image";
import Link from "next/link";
import { existsSync } from "fs";
import { join } from "path";
import { Container } from "components/ui/Container";
import {
  gameBlueprints,
  type GameBlueprint,
  type GameStatus,
} from "src/lib/gameBlueprints";
import { publicCopyBySlug } from "src/lib/gamePublicCopy";
import { supabaseAdmin } from "src/lib/supabaseAdmin";
import { getActiveTheme, toCssVars } from "src/lib/getActiveThemeServer";
import type { CSSProperties } from "react";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Games",
  description:
    "A vinyl-first catalog of Dead Wax Dialogues games: what they are, how to play, and how to book.",
};

type GameBlueprintOverride = {
  title?: string;
  status?: GameStatus;
  notes?: string;
  pullSizeGuidance?: string;
};

type PublicGame = GameBlueprint & {
  tagline?: string;
  logoPath: string | null;
};

type GameNightEvent = {
  id: number;
  title: string;
  date: string;
  time: string | null;
  location: string | null;
  linkedGameTitles: string[];
};

type DynamicEventIdQuery = {
  from: (table: string) => {
    select: (columns: string) => {
      not: (column: string, operator: string, value: null) => {
        limit: (count: number) => Promise<{
          data: Array<{ event_id: number | null }> | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};

const ALLOWED_PUBLIC_STATUSES: GameStatus[] = [
  "in_production",
  "in_development",
];

const SESSION_TABLE_BY_SLUG: Partial<Record<string, string>> = {
  bingo: "bingo_sessions",
  "music-trivia": "trivia_sessions",
  "name-that-tune": "ntt_sessions",
  "bracket-battle": "bb_sessions",
  "needle-drop-roulette": "ndr_sessions",
  "lyric-gap-relay": "lgr_sessions",
  "genre-imposter": "gi_sessions",
  "decade-dash": "dd_sessions",
  "cover-art-clue-chase": "cacc_sessions",
  "crate-categories": "ccat_sessions",
  "wrong-lyric-challenge": "wlc_sessions",
  "sample-detective": "sd_sessions",
  "artist-alias": "aa_sessions",
  "original-or-cover": "ooc_sessions",
  "back-to-back-connection": "b2bc_sessions",
};

const isGameStatus = (value: unknown): value is GameStatus =>
  value === "in_production" ||
  value === "in_development" ||
  value === "needs_workshopping" ||
  value === "undeveloped";

const isTbaDate = (date: string | null | undefined): boolean =>
  !date || date === "9999-12-31";

function resolveLogoPath(slug: string): string | null {
  for (const ext of ["svg", "png", "jpg", "webp"]) {
    const filePath = join(
      process.cwd(),
      "public",
      "images",
      "games",
      `${slug}-logo.${ext}`
    );
    if (existsSync(filePath)) {
      return `/images/games/${slug}-logo.${ext}`;
    }
  }
  return null;
}

async function loadPublicGames(): Promise<PublicGame[]> {
  const { data: rows, error } = await supabaseAdmin
    .from("admin_settings")
    .select("key, value")
    .like("key", "game:blueprint:%");

  if (error) {
    console.error("Failed to load game blueprint overrides", error.message);
  }

  const overridesBySlug = new Map<string, GameBlueprintOverride>();
  for (const row of rows ?? []) {
    const slug = (row.key as string).replace("game:blueprint:", "");
    try {
      const parsed = JSON.parse((row.value as string) ?? "{}") as Record<
        string,
        unknown
      >;
      overridesBySlug.set(slug, {
        title:
          typeof parsed.title === "string" && parsed.title.trim().length > 0
            ? parsed.title.trim()
            : undefined,
        status: isGameStatus(parsed.status) ? parsed.status : undefined,
        notes: typeof parsed.notes === "string" ? parsed.notes : undefined,
        pullSizeGuidance:
          typeof parsed.pullSizeGuidance === "string"
            ? parsed.pullSizeGuidance
            : undefined,
      });
    } catch {
      // Ignore malformed overrides.
    }
  }

  return gameBlueprints
    .map((blueprint) => {
      const override = overridesBySlug.get(blueprint.slug);
      const merged: GameBlueprint = { ...blueprint, ...(override ?? {}) };
      return {
        ...merged,
        tagline: publicCopyBySlug[merged.slug]?.tagline,
        logoPath: resolveLogoPath(merged.slug),
      };
    })
    .filter((game) => ALLOWED_PUBLIC_STATUSES.includes(game.status));
}

async function loadUpcomingGameNights(
  games: PublicGame[]
): Promise<GameNightEvent[]> {
  const tableEntries = games
    .map((game) => {
      const table = SESSION_TABLE_BY_SLUG[game.slug];
      if (!table) return null;
      return { slug: game.slug, title: game.title, table };
    })
    .filter(
      (entry): entry is { slug: string; title: string; table: string } =>
        Boolean(entry)
    );

  if (tableEntries.length === 0) return [];

  const db = supabaseAdmin as unknown as DynamicEventIdQuery;

  const linkedEventRows = await Promise.all(
    tableEntries.map(async (entry) => {
      const { data, error } = await db
        .from(entry.table)
        .select("event_id")
        .not("event_id", "is", null)
        .limit(10000);

      if (error) {
        console.error(
          `Failed to load linked events from ${entry.table}`,
          error.message
        );
        return [] as Array<{ event_id: number; gameTitle: string }>;
      }

      return ((data ?? []) as Array<{ event_id: number | null }>)
        .filter((row) => Number.isFinite(row.event_id))
        .map((row) => ({
          event_id: row.event_id as number,
          gameTitle: entry.title,
        }));
    })
  );

  const allLinkedRows = linkedEventRows.flat();
  const uniqueEventIds = Array.from(
    new Set(allLinkedRows.map((row) => row.event_id))
  );

  if (uniqueEventIds.length === 0) return [];

  const linkedGameTitlesByEventId = new Map<number, Set<string>>();
  for (const row of allLinkedRows) {
    const current =
      linkedGameTitlesByEventId.get(row.event_id) ?? new Set<string>();
    current.add(row.gameTitle);
    linkedGameTitlesByEventId.set(row.event_id, current);
  }

  const today = new Date().toISOString().split("T")[0];

  const { data: events, error: eventsError } = await supabaseAdmin
    .from("events")
    .select("id, title, date, time, location")
    .in("id", uniqueEventIds)
    .or(`date.gte.${today},date.eq.9999-12-31`);

  if (eventsError) {
    console.error("Failed to load game night events", eventsError.message);
    return [];
  }

  return ((events ?? []) as Array<Omit<GameNightEvent, "linkedGameTitles">>)
    .map((event) => ({
      ...event,
      linkedGameTitles: Array.from(
        linkedGameTitlesByEventId.get(event.id) ?? []
      ).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => {
      const aIsTba = isTbaDate(a.date);
      const bIsTba = isTbaDate(b.date);
      if (aIsTba && !bIsTba) return 1;
      if (!aIsTba && bIsTba) return -1;
      if (aIsTba && bIsTba) return a.title.localeCompare(b.title);
      return (a.date ?? "").localeCompare(b.date ?? "");
    });
}

const CARD_TILT_VARS = ["--dwd-tilt-1", "--dwd-tilt-2", "--dwd-tilt-3", "--dwd-tilt-4"];

function GameTile({ game, tilt }: { game: PublicGame; tilt: string }) {
  const isProduction = game.status === "in_production";

  return (
    <Link
      href={`/games/${game.slug}`}
      className="group relative flex flex-col overflow-hidden transition-transform hover:!rotate-0 hover:-translate-y-1 bg-[var(--dwd-bg-card)] [border:var(--dwd-card-border)] [border-radius:var(--dwd-card-radius)] [box-shadow:var(--dwd-card-shadow)]"
      style={{ transform: `rotate(var(${tilt}))` }}
    >
      <div className="relative flex flex-col h-full p-6">
        {/* Logo area */}
        <div className="mb-4 flex items-center justify-center w-16 h-16 rounded-xl bg-[var(--dwd-bg)] overflow-hidden shrink-0 [border:var(--dwd-card-border)]">
          {game.logoPath ? (
            <Image unoptimized width={1200} height={1200}
              src={game.logoPath}
              alt={`${game.title} logo`}
              className="w-12 h-12 object-contain"
            />
          ) : (
            <span className="text-2xl font-bold text-[var(--dwd-ink-faint)] select-none">
              {game.title.charAt(0)}
            </span>
          )}
        </div>

        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-lg font-bold tracking-tight leading-snug">
            {game.title}
          </h3>
          <span
            className="shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
            style={
              isProduction
                ? { background: 'color-mix(in srgb, var(--dwd-accent-2) 18%, transparent)', color: 'var(--dwd-accent-2)' }
                : { background: 'color-mix(in srgb, var(--dwd-accent-3) 25%, transparent)', color: 'var(--dwd-ink)' }
            }
          >
            {isProduction ? "Live" : "In development"}
          </span>
        </div>

        <p className="text-sm text-[var(--dwd-ink-soft)] leading-relaxed flex-1">
          {game.tagline ?? game.coreMechanic}
        </p>

        <div className="mt-4 flex items-center text-xs font-semibold text-[var(--dwd-accent-1)] group-hover:text-[var(--dwd-accent-1-hover)] transition-colors">
          {isProduction ? "How to play" : "Learn more"}
          <svg
            className="ml-1.5 w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </div>
    </Link>
  );
}

export default async function GamesPage() {
  const publicGames = await loadPublicGames();

  const productionGames = publicGames
    .filter((game) => game.status === "in_production")
    .sort((a, b) => a.title.localeCompare(b.title));

  const comingSoonGames = publicGames
    .filter((game) => game.status === "in_development")
    .sort((a, b) => a.title.localeCompare(b.title));

  const gameNights = await loadUpcomingGameNights(productionGames);
  const theme = await getActiveTheme();
  const cssVars = toCssVars(theme) as CSSProperties;

  return (
    <div
      className="min-h-screen font-[family-name:var(--dwd-font-body)] bg-[var(--dwd-bg)] text-[var(--dwd-ink)]"
      style={cssVars}
    >
      <Container size="xl">
        <div className="pt-16 pb-10 md:pt-20 text-center">
          <div className="inline-block rounded-[var(--dwd-badge-radius)] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.1em] mb-6 [border:var(--dwd-badge-border)]" style={{ background: 'var(--dwd-badge-bg)', color: 'var(--dwd-badge-color)' }}>
            Games
          </div>
          <div className="font-[family-name:var(--dwd-font-display)] [text-transform:var(--dwd-headline-transform)] text-4xl md:text-6xl mb-4">
            Game Library
          </div>
          <p className="text-[var(--dwd-ink-soft)] max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
            Vinyl-first game formats for your venue. Tap any game to learn
            how it works, where it&apos;s playing, and how to book it.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/events/events-page"
              className="px-5 py-2.5 rounded-full text-sm font-semibold bg-transparent text-[var(--dwd-ink)] border-2 border-[var(--dwd-ink)] hover:opacity-65 transition-opacity"
            >
              All upcoming events
            </Link>
            <Link
              href="/about"
              className="px-5 py-2.5 rounded-full text-sm font-semibold bg-[var(--dwd-accent-1)] text-[var(--dwd-bg)] hover:bg-[var(--dwd-accent-1-hover)] transition-colors"
            >
              Book a games night
            </Link>
          </div>
        </div>
      </Container>

      <main className="pb-16">
        <Container size="xl">

          {/* Active games */}
          {productionGames.length > 0 && (
            <section className="mb-14">
              <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                    Live formats
                  </h2>
                  <p className="mt-1 text-[var(--dwd-ink-faint)] text-sm">
                    Games available to book right now.
                  </p>
                </div>
                <span className="text-sm text-[var(--dwd-ink-faint)]">
                  {productionGames.length}{" "}
                  {productionGames.length === 1 ? "format" : "formats"}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {productionGames.map((game, i) => (
                  <GameTile key={game.slug} game={game} tilt={CARD_TILT_VARS[i % CARD_TILT_VARS.length]} />
                ))}
              </div>
            </section>
          )}

          {/* Upcoming events */}
          {gameNights.length > 0 ? (
            <section className="mb-14">
              <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                    Upcoming game nights
                  </h2>
                  <p className="mt-1 text-[var(--dwd-ink-faint)] text-sm">
                    All events with a game session attached.
                  </p>
                </div>
                <Link
                  href="/events/events-page"
                  className="text-sm text-[var(--dwd-accent-1)] hover:text-[var(--dwd-accent-1-hover)] transition-colors font-medium"
                >
                  All events &rarr;
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {gameNights.map((event) => (
                  <Link
                    key={event.id}
                    href={`/events/event-detail/${event.id}`}
                    className="group p-5 flex flex-col gap-2 transition-transform hover:-translate-y-0.5 bg-[var(--dwd-bg-card)] [border:var(--dwd-card-border)] [border-radius:var(--dwd-card-radius)]"
                  >
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--dwd-ink-faint)]">
                      {isTbaDate(event.date)
                        ? "Date TBA"
                        : new Date(
                            `${event.date}T00:00:00`
                          ).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                      {event.time
                        ? ` · ${event.time}`
                        : null}
                    </p>
                    <h3 className="text-lg font-bold tracking-tight leading-snug group-hover:text-[var(--dwd-accent-1)] transition-colors">
                      {event.title}
                    </h3>
                    {event.location ? (
                      <p className="text-sm text-[var(--dwd-ink-faint)]">{event.location}</p>
                    ) : null}
                    {event.linkedGameTitles.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {event.linkedGameTitles.map((title) => (
                          <span
                            key={title}
                            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                            style={{ background: 'color-mix(in srgb, var(--dwd-accent-1) 12%, transparent)', color: 'var(--dwd-accent-1)' }}
                          >
                            {title}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </Link>
                ))}
              </div>
            </section>
          ) : (
            <section className="mb-14">
              <div className="p-8 text-center bg-[var(--dwd-bg-card)] [border:var(--dwd-card-border)] [border-radius:var(--dwd-card-radius)]">
                <p className="text-[var(--dwd-ink-soft)]">
                  Follow us on Instagram, Facebook, and other socials @deadwaxdialogues.
                </p>
              </div>
            </section>
          )}

          {/* Coming soon */}
          {comingSoonGames.length > 0 && (
            <section>
              <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                    In development
                  </h2>
                  <p className="mt-1 text-[var(--dwd-ink-faint)] text-sm">
                    Formats being built and tested. Tap for a preview.
                  </p>
                </div>
                <span className="text-sm text-[var(--dwd-ink-faint)]">
                  {comingSoonGames.length} in the works
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {comingSoonGames.map((game, i) => (
                  <GameTile key={game.slug} game={game} tilt={CARD_TILT_VARS[i % CARD_TILT_VARS.length]} />
                ))}
              </div>
            </section>
          )}
        </Container>
      </main>
    </div>
  );
}
