import Image from "next/image";
import { notFound } from "next/navigation";
import Link from "next/link";
import { existsSync } from "fs";
import { join } from "path";
import { Container } from "components/ui/Container";
import { getResolvedGameBlueprint } from "src/lib/resolveGameBlueprints";
import { publicCopyBySlug } from "src/lib/gamePublicCopy";
import { getActiveTheme, toCssVars } from "src/lib/getActiveThemeServer";
import type { CSSProperties } from "react";

export const runtime = "nodejs";
// See src/app/games/page.tsx for why this must stay dynamic.
export const dynamic = "force-dynamic";

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = await getResolvedGameBlueprint(slug);
  if (!game) return { title: "Game Not Found" };
  return {
    title: game.title,
    description: game.tagline || game.coreMechanic || undefined,
  };
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = await getResolvedGameBlueprint(slug);

  if (
    !game ||
    (game.status !== "in_production" && game.status !== "in_development")
  ) {
    notFound();
  }

  // Rich, hand-written copy (playerExperience, whatYouDo, exampleRound,
  // etc.) still comes from the static file for the games that have it —
  // admin-added games start with just a title/status/tagline and can get
  // this fuller write-up added later without it blocking the listing.
  const publicCopy = publicCopyBySlug[slug];
  const logoPath = resolveLogoPath(slug);
  const isProduction = game.status === "in_production";
  const theme = await getActiveTheme();
  const cssVars = toCssVars(theme) as CSSProperties;

  return (
    <div
      className="min-h-screen font-[family-name:var(--dwd-font-body)] bg-[var(--dwd-bg)] text-[var(--dwd-ink)]"
      style={cssVars}
    >
      {/* Header */}
      <header className="relative w-full pt-16 pb-12 border-b border-[var(--dwd-ink)]/10">
        <Container size="xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Logo */}
            <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-[var(--dwd-bg-card)] overflow-hidden shrink-0 [border:var(--dwd-card-border)]">
              {logoPath ? (
                <Image unoptimized width={1200} height={1200}
                  src={logoPath}
                  alt={`${game.title} logo`}
                  className="w-14 h-14 object-contain"
                />
              ) : (
                <span className="text-3xl font-bold text-[var(--dwd-ink-faint)] select-none">
                  {game.title.charAt(0)}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <Link
                  href="/games"
                  className="text-xs text-[var(--dwd-ink-faint)] hover:text-[var(--dwd-ink)] transition-colors font-medium"
                >
                  &larr; Games
                </Link>
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={
                    isProduction
                      ? { background: 'color-mix(in srgb, var(--dwd-accent-2) 18%, transparent)', color: 'var(--dwd-accent-2)' }
                      : { background: 'color-mix(in srgb, var(--dwd-accent-3) 25%, transparent)', color: 'var(--dwd-ink)' }
                  }
                >
                  {isProduction ? "Live" : "In development"}
                </span>
              </div>
              <h1 className="font-[family-name:var(--dwd-font-display)] [text-transform:var(--dwd-headline-transform)] text-3xl md:text-5xl">
                {game.title}
              </h1>
              {game.tagline ? (
                <p className="mt-2 text-[var(--dwd-ink-soft)] text-base md:text-lg leading-relaxed max-w-2xl">
                  {game.tagline}
                </p>
              ) : null}
            </div>

            <div className="sm:shrink-0">
              <Link
                href="/about"
                className="inline-flex items-center px-5 py-2.5 rounded-full bg-[var(--dwd-accent-1)] text-[var(--dwd-bg)] hover:bg-[var(--dwd-accent-1-hover)] transition-colors text-sm font-semibold"
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
              <div className="rounded-2xl bg-[var(--dwd-bg-card)] [border:var(--dwd-card-border)] p-6 mb-8">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--dwd-ink-faint)] mb-3">
                  What it is
                </div>
                <p className="text-[var(--dwd-ink-soft)] leading-relaxed">
                  {publicCopy?.playerExperience || game.coreMechanic || game.tagline || "More details coming soon."}
                </p>
                {game.notes ? (
                  <p className="mt-4 text-sm text-[var(--dwd-ink-faint)] leading-relaxed">
                    {game.notes}
                  </p>
                ) : null}
              </div>

              {publicCopy?.whatYouDo?.length ? (
                <div className="rounded-2xl bg-[var(--dwd-bg-card)] [border:var(--dwd-card-border)] p-6 mb-8">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--dwd-ink-faint)] mb-3">
                    How it works
                  </div>
                  <ul className="space-y-2 text-[var(--dwd-ink-soft)] text-sm leading-relaxed list-disc list-inside">
                    {publicCopy.whatYouDo.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="rounded-2xl bg-[var(--dwd-bg-card)] [border:var(--dwd-card-border)] p-6">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--dwd-ink-faint)] mb-3">
                  Stay in the loop
                </div>
                <p className="text-[var(--dwd-ink-soft)] text-sm leading-relaxed mb-4">
                  {game.title} is being refined for live play. Get in touch to
                  be the first venue to book it.
                </p>
                <Link
                  href="/about"
                  className="inline-flex items-center px-4 py-2 rounded-full bg-[var(--dwd-accent-1)] text-[var(--dwd-bg)] hover:bg-[var(--dwd-accent-1-hover)] transition-colors text-sm font-semibold"
                >
                  Enquire &rarr;
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
                  <section className="rounded-2xl bg-[var(--dwd-bg-card)] [border:var(--dwd-card-border)] p-6">
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--dwd-ink-faint)] mb-3">
                      What it feels like
                    </div>
                    <p className="text-[var(--dwd-ink-soft)] leading-relaxed">
                      {publicCopy.playerExperience}
                    </p>
                  </section>
                ) : null}

                {/* How to play */}
                {publicCopy?.whatYouDo?.length ? (
                  <section className="rounded-2xl bg-[var(--dwd-bg-card)] [border:var(--dwd-card-border)] p-6">
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--dwd-ink-faint)] mb-4">
                      How to play
                    </div>
                    <ol className="space-y-3">
                      {publicCopy.whatYouDo.map((step, i) => (
                        <li key={step} className="flex gap-3 text-sm leading-relaxed">
                          <span className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mt-0.5" style={{ background: 'color-mix(in srgb, var(--dwd-accent-1) 18%, transparent)', color: 'var(--dwd-accent-1)' }}>
                            {i + 1}
                          </span>
                          <span className="text-[var(--dwd-ink-soft)]">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </section>
                ) : null}

                {/* Example round */}
                {publicCopy?.exampleRound?.length ? (
                  <section className="rounded-2xl bg-[var(--dwd-bg-card)] [border:var(--dwd-card-border)] p-6">
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--dwd-ink-faint)] mb-4">
                      Example round
                    </div>
                    <ol className="space-y-3">
                      {publicCopy.exampleRound.map((step, i) => (
                        <li key={step} className="flex gap-3 text-sm leading-relaxed">
                          <span className="shrink-0 text-[var(--dwd-ink-faint)] font-mono text-xs mt-1">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="text-[var(--dwd-ink-soft)]">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </section>
                ) : null}
              </div>

              {/* Sidebar */}
              <div className="space-y-5">
                {/* Booker details */}
                <section className="rounded-2xl bg-[var(--dwd-bg-card)] [border:var(--dwd-card-border)] p-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--dwd-ink-faint)] mb-4">
                    Booker details
                  </div>
                  <dl className="space-y-3 text-sm">
                    {publicCopy?.howYouWin ? (
                      <div>
                        <dt className="font-semibold text-[var(--dwd-ink)]">How you win</dt>
                        <dd className="mt-1 text-[var(--dwd-ink-soft)] leading-relaxed">
                          {publicCopy.howYouWin}
                        </dd>
                      </div>
                    ) : null}
                    {(publicCopy?.scoring ?? game.scoring) ? (
                      <div>
                        <dt className="font-semibold text-[var(--dwd-ink)]">Scoring</dt>
                        <dd className="mt-1 text-[var(--dwd-ink-soft)] leading-relaxed">
                          {publicCopy?.scoring ?? game.scoring}
                        </dd>
                      </div>
                    ) : null}
                    {publicCopy?.bestFor ? (
                      <div>
                        <dt className="font-semibold text-[var(--dwd-ink)]">Best for</dt>
                        <dd className="mt-1 text-[var(--dwd-ink-soft)] leading-relaxed">
                          {publicCopy.bestFor}
                        </dd>
                      </div>
                    ) : null}
                    {publicCopy?.whatYouNeed ? (
                      <div>
                        <dt className="font-semibold text-[var(--dwd-ink)]">What we bring / need</dt>
                        <dd className="mt-1 text-[var(--dwd-ink-soft)] leading-relaxed">
                          {publicCopy.whatYouNeed}
                        </dd>
                      </div>
                    ) : null}
                    {game.whyItWorks ? (
                      <div>
                        <dt className="font-semibold text-[var(--dwd-ink)]">Why it works</dt>
                        <dd className="mt-1 text-[var(--dwd-ink-soft)] leading-relaxed">
                          {game.whyItWorks}
                        </dd>
                      </div>
                    ) : null}
                    {game.notes ? (
                      <div>
                        <dt className="font-semibold text-[var(--dwd-ink)]">Note</dt>
                        <dd className="mt-1 text-[var(--dwd-ink-faint)] leading-relaxed">
                          {game.notes}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </section>

                {/* Book CTA */}
                <section className="rounded-2xl p-5" style={{ background: 'color-mix(in srgb, var(--dwd-accent-1) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--dwd-accent-1) 25%, transparent)' }}>
                  <div className="text-xs uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--dwd-accent-1)' }}>
                    Ready to book?
                  </div>
                  <p className="text-sm text-[var(--dwd-ink-soft)] leading-relaxed mb-4">
                    Bring {game.title} to your venue. Get in touch and
                    we&apos;ll sort out the details.
                  </p>
                  <Link
                    href="/about"
                    className="inline-flex items-center px-4 py-2 rounded-full bg-[var(--dwd-accent-1)] text-[var(--dwd-bg)] hover:bg-[var(--dwd-accent-1-hover)] transition-colors text-sm font-semibold"
                  >
                    Book this game &rarr;
                  </Link>
                </section>
              </div>
            </div>
          )}
        </Container>
      </main>
    </div>
  );
}
