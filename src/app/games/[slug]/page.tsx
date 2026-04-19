import { notFound } from "next/navigation";
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

type GameBlueprintOverride = {
  title?: string;
  status?: GameStatus;
  notes?: string;
  pullSizeGuidance?: string;
};

type GameEvent = {
  id: number;
  title: string;
  date: string;
  time: string | null;
  location: string | null;
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

async function loadGame(slug: string): Promise<GameBlueprint | null> {
  const blueprint = gameBlueprints.find((g) => g.slug === slug);
  if (!blueprint) return null;

  const { data: rows, error } = await supabaseAdmin
    .from("admin_settings")
    .select("key, value")
    .eq("key", `game:blueprint:${slug}`)
    .maybeSingle();

  if (error) {
    console.error("Failed to load game blueprint override", error.message);
    return blueprint;
  }

  if (!rows) return blueprint;

  try {
    const parsed = JSON.parse((rows.value as string) ?? "{}") as Record<
      string,
      unknown
    >;
    const override: GameBlueprintOverride = {
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
    };
    return { ...blueprint, ...override };
  } catch {
    return blueprint;
  }
}

async function loadGameEvents(slug: string): Promise<GameEvent[]> {
  const table = SESSION_TABLE_BY_SLUG[slug];
  if (!table) return [];

  const db = supabaseAdmin as unknown as DynamicEventIdQuery;
  const { data, error } = await db
    .from(table)
    .select("event_id")
    .not("event_id", "is", null)
    .limit(1000);

  if (error) {
    console.error(`Failed to load events from ${table}`, error.message);
    return [];
  }

  const eventIds = Array.from(
    new Set(
      ((data ?? []) as Array<{ event_id: number | null }>)
        .filter((row) => Number.isFinite(row.event_id))
        .map((row) => row.event_id as number)
    )
  );

  if (eventIds.length === 0) return [];

  const today = new Date().toISOString().split("T")[0];

  const { data: events, error: eventsError } = await supabaseAdmin
    .from("events")
    .select("id, title, date, time, location")
    .in("id", eventIds)
    .or(`date.gte.${today},date.eq.9999-12-31`);

  if (eventsError) {
    console.error("Failed to load game events", eventsError.message);
    return [];
  }

  return ((events ?? []) as GameEvent[]).sort((a, b) => {
    const aIsTba = isTbaDate(a.date);
    const bIsTba = isTbaDate(b.date);
    if (aIsTba && !bIsTba) return 1;
    if (!aIsTba && bIsTba) return -1;
    if (aIsTba && bIsTba) return a.title.localeCompare(b.title);
    return (a.date ?? "").localeCompare(b.date ?? "");
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = await loadGame(slug);
  if (!game) return { title: "Game Not Found" };
  const copy = publicCopyBySlug[slug];
  return {
    title: game.title,
    description: copy?.tagline ?? game.coreMechanic,
  };
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = await loadGame(slug);

  if (
    !game ||
    (game.status !== "in_production" && game.status !== "in_development")
  ) {
    notFound();
  }

  const publicCopy = publicCopyBySlug[slug];
  const logoPath = resolveLogoPath(slug);
  const events = await loadGameEvents(slug);
  const isProduction = game.status === "in_production";

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="relative w-full pt-16 pb-12 bg-zinc-950 border-b border-white/10">
        <Container size="xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Logo */}
            <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-black/60 ring-1 ring-white/15 overflow-hidden shrink-0">
              {logoPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoPath}
                  alt={`${game.title} logo`}
                  className="w-14 h-14 object-contain"
                />
              ) : (
                <span className="text-3xl font-bold text-zinc-500 select-none">
                  {game.title.charAt(0)}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <Link
                  href="/games"
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-medium"
                >
                  ← Games
                </Link>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                    isProduction
                      ? "bg-[#00c4ff]/15 text-[#b8efff] ring-[#00c4ff]/35"
                      : "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30"
                  }`}
                >
                  {isProduction ? "Live" : "In development"}
                </span>
              </div>
              <h1 className="font-serif-display text-3xl md:text-5xl font-bold tracking-tight">
                {game.title}
              </h1>
              {publicCopy?.tagline ? (
                <p className="mt-2 text-zinc-300/80 text-base md:text-lg leading-relaxed max-w-2xl">
                  {publicCopy.tagline}
                </p>
              ) : null}
            </div>

            <div className="sm:shrink-0">
              <Link
                href="/about"
                className="inline-flex items-center px-5 py-2.5 rounded-full bg-[#00c4ff]/15 hover:bg-[#00c4ff]/20 transition-colors ring-1 ring-[#00c4ff]/30 text-sm font-semibold text-[#b8efff]"
              >
                Book this game
              </Link>
            </div>
          </div>
        </Container>
      </header>

      <main className="py-12">
        <Container size="xl">
          {!isProduction ? (
            /* In-development: show teaser content */
            <div className="max-w-2xl">
              <div className="rounded-2xl bg-zinc-950/70 ring-1 ring-white/10 p-6 mb-8">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-400 mb-3">
                  What it is
                </div>
                <p className="text-zinc-200/90 leading-relaxed">
                  {publicCopy?.playerExperience ?? game.coreMechanic}
                </p>
                {game.notes ? (
                  <p className="mt-4 text-sm text-zinc-400 leading-relaxed">
                    {game.notes}
                  </p>
                ) : null}
              </div>

              {publicCopy?.whatYouDo?.length ? (
                <div className="rounded-2xl bg-zinc-950/70 ring-1 ring-white/10 p-6 mb-8">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-400 mb-3">
                    How it works
                  </div>
                  <ul className="space-y-2 text-zinc-200/90 text-sm leading-relaxed list-disc list-inside">
                    {publicCopy.whatYouDo.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="rounded-2xl bg-zinc-950/70 ring-1 ring-white/10 p-6">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-400 mb-3">
                  Stay in the loop
                </div>
                <p className="text-zinc-300/80 text-sm leading-relaxed mb-4">
                  {game.title} is being refined for live play. Get in touch to
                  be the first venue to book it.
                </p>
                <Link
                  href="/about"
                  className="inline-flex items-center px-4 py-2 rounded-full bg-[#00c4ff]/15 hover:bg-[#00c4ff]/20 transition-colors ring-1 ring-[#00c4ff]/30 text-sm font-semibold text-[#b8efff]"
                >
                  Enquire →
                </Link>
              </div>
            </div>
          ) : (
            /* In production: full how-to-play layout */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Player experience */}
                {publicCopy?.playerExperience ? (
                  <section className="rounded-2xl bg-zinc-950/70 ring-1 ring-white/10 p-6">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-400 mb-3">
                      What it feels like
                    </div>
                    <p className="text-zinc-200/90 leading-relaxed">
                      {publicCopy.playerExperience}
                    </p>
                  </section>
                ) : null}

                {/* How to play */}
                {publicCopy?.whatYouDo?.length ? (
                  <section className="rounded-2xl bg-zinc-950/70 ring-1 ring-white/10 p-6">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-400 mb-4">
                      How to play
                    </div>
                    <ol className="space-y-3">
                      {publicCopy.whatYouDo.map((step, i) => (
                        <li key={step} className="flex gap-3 text-sm leading-relaxed">
                          <span className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-[#00c4ff]/15 text-[#b8efff] text-xs font-bold ring-1 ring-[#00c4ff]/30 mt-0.5">
                            {i + 1}
                          </span>
                          <span className="text-zinc-200/90">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </section>
                ) : null}

                {/* Example round */}
                {publicCopy?.exampleRound?.length ? (
                  <section className="rounded-2xl bg-zinc-950/70 ring-1 ring-white/10 p-6">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-400 mb-4">
                      Example round
                    </div>
                    <ol className="space-y-3">
                      {publicCopy.exampleRound.map((step, i) => (
                        <li key={step} className="flex gap-3 text-sm leading-relaxed">
                          <span className="shrink-0 text-zinc-600 font-mono text-xs mt-1">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="text-zinc-300/85">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </section>
                ) : null}
              </div>

              {/* Sidebar */}
              <div className="space-y-5">
                {/* Booker details */}
                <section className="rounded-2xl bg-zinc-950/70 ring-1 ring-white/10 p-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-400 mb-4">
                    Booker details
                  </div>
                  <dl className="space-y-3 text-sm">
                    {publicCopy?.howYouWin ? (
                      <div>
                        <dt className="font-semibold text-zinc-200">How you win</dt>
                        <dd className="mt-1 text-zinc-300/80 leading-relaxed">
                          {publicCopy.howYouWin}
                        </dd>
                      </div>
                    ) : null}
                    {(publicCopy?.scoring ?? game.scoring) ? (
                      <div>
                        <dt className="font-semibold text-zinc-200">Scoring</dt>
                        <dd className="mt-1 text-zinc-300/80 leading-relaxed">
                          {publicCopy?.scoring ?? game.scoring}
                        </dd>
                      </div>
                    ) : null}
                    {publicCopy?.bestFor ? (
                      <div>
                        <dt className="font-semibold text-zinc-200">Best for</dt>
                        <dd className="mt-1 text-zinc-300/80 leading-relaxed">
                          {publicCopy.bestFor}
                        </dd>
                      </div>
                    ) : null}
                    {publicCopy?.whatYouNeed ? (
                      <div>
                        <dt className="font-semibold text-zinc-200">What we bring / need</dt>
                        <dd className="mt-1 text-zinc-300/80 leading-relaxed">
                          {publicCopy.whatYouNeed}
                        </dd>
                      </div>
                    ) : null}
                    <div>
                      <dt className="font-semibold text-zinc-200">Why it works</dt>
                      <dd className="mt-1 text-zinc-300/80 leading-relaxed">
                        {game.whyItWorks}
                      </dd>
                    </div>
                    {game.notes ? (
                      <div>
                        <dt className="font-semibold text-zinc-200">Note</dt>
                        <dd className="mt-1 text-zinc-400 leading-relaxed">
                          {game.notes}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </section>

                {/* Book CTA */}
                <section className="rounded-2xl bg-[#00c4ff]/10 ring-1 ring-[#00c4ff]/25 p-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-[#b8efff]/70 mb-2">
                    Ready to book?
                  </div>
                  <p className="text-sm text-zinc-300/80 leading-relaxed mb-4">
                    Bring {game.title} to your venue. Get in touch and
                    we&apos;ll sort out the details.
                  </p>
                  <Link
                    href="/about"
                    className="inline-flex items-center px-4 py-2 rounded-full bg-[#00c4ff]/20 hover:bg-[#00c4ff]/30 transition-colors ring-1 ring-[#00c4ff]/40 text-sm font-semibold text-[#b8efff]"
                  >
                    Book this game →
                  </Link>
                </section>
              </div>
            </div>
          )}

          {/* Upcoming events for this game */}
          <section className="mt-14">
            <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">
                  Upcoming {game.title} nights
                </h2>
                <p className="mt-1 text-zinc-400 text-sm">
                  Events where {game.title} is on the programme.
                </p>
              </div>
              <Link
                href="/events/events-page"
                className="text-sm text-[#b8efff] hover:text-white transition-colors font-medium"
              >
                All events →
              </Link>
            </div>

            {events.length === 0 ? (
              <div className="rounded-2xl bg-zinc-950/70 ring-1 ring-white/10 p-8 text-center">
                <p className="text-zinc-400">No upcoming events yet.</p>
                <Link
                  href="/about"
                  className="mt-4 inline-flex items-center text-sm font-semibold text-[#b8efff] hover:text-white transition-colors"
                >
                  Book the first one →
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {events.map((event) => (
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
                      {event.time ? ` · ${event.time}` : null}
                    </p>
                    <h3 className="text-lg font-bold tracking-tight leading-snug group-hover:text-[#b8efff] transition-colors">
                      {event.title}
                    </h3>
                    {event.location ? (
                      <p className="text-sm text-zinc-400">{event.location}</p>
                    ) : null}
                  </Link>
                ))}
              </div>
            )}
          </section>
        </Container>
      </main>
    </div>
  );
}
