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
        .limit(1000);

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

function GameTile({ game }: { game: PublicGame }) {
  const isProduction = game.status === "in_production";

  return (
    <Link
      href={`/games/${game.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-zinc-950/70 ring-1 ring-white/10 hover:ring-[#00c4ff]/40 transition-all hover:-translate-y-0.5"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(circle_at_30%_20%,rgba(0,196,255,0.12),transparent_60%)]" />

      <div className="relative flex flex-col h-full p-6">
        {/* Logo area */}
        <div className="mb-4 flex items-center justify-center w-16 h-16 rounded-xl bg-black/40 ring-1 ring-white/10 overflow-hidden shrink-0">
          {game.logoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={game.logoPath}
              alt={`${game.title} logo`}
              className="w-12 h-12 object-contain"
            />
          ) : (
            <span className="text-2xl font-bold text-zinc-500 select-none">
              {game.title.charAt(0)}
            </span>
          )}
        </div>

        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-lg font-bold tracking-tight leading-snug">
            {game.title}
          </h3>
          <span
            className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
              isProduction
                ? "bg-[#00c4ff]/15 text-[#b8efff] ring-[#00c4ff]/35"
                : "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30"
            }`}
          >
            {isProduction ? "Live" : "In development"}
          </span>
        </div>

        <p className="text-sm text-zinc-300/80 leading-relaxed flex-1">
          {game.tagline ?? game.coreMechanic}
        </p>

        <div className="mt-4 flex items-center text-xs font-semibold text-[#b8efff] group-hover:text-white transition-colors">
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

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="relative w-full h-[280px] flex items-center justify-center bg-[url('/images/event-header-still.jpg')] bg-cover bg-center">
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 w-full">
          <Container size="xl">
            <div className="py-10 text-center">
              <div className="barcode-font text-white/70 mb-4">GAMES</div>
              <h1 className="font-serif-display text-4xl md:text-6xl font-bold tracking-tight">
                Game Library
              </h1>
              <p className="mt-4 text-zinc-200/80 max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
                Vinyl-first game formats for your venue. Tap any game to learn
                how it works, where it&apos;s playing, and how to book it.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href="/events/events-page"
                  className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 transition-colors ring-1 ring-white/10 text-sm font-semibold"
                >
                  All upcoming events
                </Link>
                <Link
                  href="/about"
                  className="px-5 py-2.5 rounded-full bg-[#00c4ff]/15 hover:bg-[#00c4ff]/20 transition-colors ring-1 ring-[#00c4ff]/30 text-sm font-semibold text-[#b8efff]"
                >
                  Book a games night
                </Link>
              </div>
            </div>
          </Container>
        </div>
      </header>

      <main className="py-12">
        <Container size="xl">

          {/* Active games */}
          {productionGames.length > 0 && (
            <section className="mb-14">
              <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                    Live formats
                  </h2>
                  <p className="mt-1 text-zinc-400 text-sm">
                    Games available to book right now.
                  </p>
                </div>
                <span className="text-sm text-zinc-500">
                  {productionGames.length}{" "}
                  {productionGames.length === 1 ? "format" : "formats"}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {productionGames.map((game) => (
                  <GameTile key={game.slug} game={game} />
                ))}
              </div>
            </section>
          )}

          {/* Upcoming events */}
          <section className="mb-14">
            <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                  Upcoming game nights
                </h2>
                <p className="mt-1 text-zinc-400 text-sm">
                  All events with a game session attached.
                </p>
              </div>
              <Link
                href="/events/events-page"
                className="text-sm text-[#b8efff] hover:text-white transition-colors font-medium"
              >
                All events →
              </Link>
            </div>

            {gameNights.length === 0 ? (
              <div className="rounded-2xl bg-zinc-950/70 ring-1 ring-white/10 p-8 text-center">
                <p className="text-zinc-400">No upcoming game nights yet.</p>
                <Link
                  href="/about"
                  className="mt-4 inline-flex items-center text-sm font-semibold text-[#b8efff] hover:text-white transition-colors"
                >
                  Book the first one →
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {gameNights.map((event) => (
                  <Link
                    key={event.id}
                    href={`/events/event-detail/${event.id}`}
                    className="group rounded-2xl bg-zinc-950/70 ring-1 ring-white/10 p-5 hover:ring-[#00c4ff]/30 transition-colors flex flex-col gap-2"
                  >
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
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
                    <h3 className="text-lg font-bold tracking-tight leading-snug group-hover:text-[#b8efff] transition-colors">
                      {event.title}
                    </h3>
                    {event.location ? (
                      <p className="text-sm text-zinc-400">{event.location}</p>
                    ) : null}
                    {event.linkedGameTitles.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {event.linkedGameTitles.map((title) => (
                          <span
                            key={title}
                            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-[#00c4ff]/10 text-[#b8efff] ring-1 ring-[#00c4ff]/20"
                          >
                            {title}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Coming soon */}
          {comingSoonGames.length > 0 && (
            <section>
              <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                    In development
                  </h2>
                  <p className="mt-1 text-zinc-400 text-sm">
                    Formats being built and tested. Tap for a preview.
                  </p>
                </div>
                <span className="text-sm text-zinc-500">
                  {comingSoonGames.length} in the works
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {comingSoonGames.map((game) => (
                  <GameTile key={game.slug} game={game} />
                ))}
              </div>
            </section>
          )}
        </Container>
      </main>
    </div>
  );
}
