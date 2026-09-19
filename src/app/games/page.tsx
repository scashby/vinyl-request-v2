import Image from "next/image";
import Link from "next/link";
import { existsSync } from "fs";
import { join } from "path";
import { Container } from "components/ui/Container";
import { getResolvedGameBlueprints, type ResolvedGame } from "src/lib/resolveGameBlueprints";
import type { GameStatus } from "src/lib/gameBlueprints";
import { getActiveTheme, toCssVars } from "src/lib/getActiveThemeServer";
import type { CSSProperties } from "react";

export const runtime = "nodejs";
// Without this, Next.js prerenders this page once at build time and bakes
// in whatever games/statuses existed then — admin edits (now backed by a
// live Supabase read in resolveGameBlueprints) wouldn't show up until the
// next deploy.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Games",
  description:
    "A vinyl-first catalog of Dead Wax Dialogues games: what they are and how to play.",
};

type PublicGame = ResolvedGame & {
  logoPath: string | null;
};

const ALLOWED_PUBLIC_STATUSES: GameStatus[] = ["in_production", "in_development"];

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
  const games = await getResolvedGameBlueprints();
  return games
    .filter((game) => ALLOWED_PUBLIC_STATUSES.includes(game.status))
    .map((game) => ({
      ...game,
      logoPath: resolveLogoPath(game.slug),
    }));
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
          {game.tagline || game.coreMechanic || "More details coming soon."}
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
            how it works and how to book it.
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
