import Link from "next/link";
import { Container } from "components/ui/Container";
import { gameBlueprints, type GameBlueprint } from "src/lib/gameBlueprints";

export const metadata = {
  title: "Games | Dead Wax Dialogues",
  description:
    "A vinyl-first catalog of Dead Wax Dialogues games: what they are and how to play.",
};

type StatusMeta = { label: string; className: string };

const getStatusMeta = (status: GameBlueprint["status"]): StatusMeta => {
  switch (status) {
    case "in_development":
      return {
        label: "In development",
        className:
          "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30",
      };
    case "needs_workshopping":
      return {
        label: "Needs workshopping",
        className: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30",
      };
    default:
      return {
        label: "Undeveloped",
        className: "bg-zinc-500/15 text-zinc-200 ring-1 ring-white/15",
      };
  }
};

export default function GamesPage() {
  const games = [...gameBlueprints].sort((a, b) =>
    a.title.localeCompare(b.title),
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="relative w-full h-[280px] flex items-center justify-center bg-[url('/images/event-header-still.jpg')] bg-cover bg-center">
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 w-full">
          <Container size="xl">
            <div className="py-10 text-center">
              <div className="barcode-font text-white/70 mb-4">GAMES</div>
              <h1 className="font-serif-display text-4xl md:text-6xl font-bold tracking-tight">
                Vinyl-First Game Library
              </h1>
              <p className="mt-4 text-zinc-200/80 max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
                A catalog of the Dead Wax Dialogues games we&apos;ve designed for
                two turntables, a single host, and a room full of teams.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href="/events/events-page"
                  className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 transition-colors ring-1 ring-white/10 text-sm font-semibold"
                >
                  See upcoming events
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
          <div className="flex items-end justify-between gap-6 flex-wrap mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                How to play
              </h2>
              <p className="mt-2 text-zinc-300/80 max-w-2xl">
                Each game below includes a quick overview and a simple 3-step
                flow: setup, play, score.
              </p>
            </div>
            <div className="text-sm text-zinc-300/70">
              {games.length} games in the library
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {games.map((game) => {
              const status = getStatusMeta(game.status);

              return (
                <article
                  key={game.slug}
                  className="group relative overflow-hidden rounded-2xl bg-zinc-950/70 ring-1 ring-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] hover:ring-[#00c4ff]/30 transition-colors"
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(circle_at_30%_20%,rgba(0,196,255,0.18),transparent_55%)]" />
                  <div className="relative p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="text-xl font-bold tracking-tight truncate">
                          {game.title}
                        </h3>
                        <p className="mt-2 text-zinc-300/85 leading-relaxed">
                          {game.coreMechanic}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-4">
                      <div className="rounded-xl bg-black/30 ring-1 ring-white/10 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                          How to play
                        </div>
                        <ol className="mt-3 space-y-2 text-sm text-zinc-200/90 leading-relaxed list-decimal list-inside">
                          <li>
                            <span className="text-zinc-300/70">Setup:</span>{" "}
                            {game.setup}
                          </li>
                          <li>
                            <span className="text-zinc-300/70">Play:</span>{" "}
                            {game.coreMechanic}
                          </li>
                          <li>
                            <span className="text-zinc-300/70">Score:</span>{" "}
                            {game.scoring}
                          </li>
                        </ol>
                      </div>

                      <div className="rounded-xl bg-black/30 ring-1 ring-white/10 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                          Why it works
                        </div>
                        <p className="mt-2 text-sm text-zinc-200/90 leading-relaxed">
                          {game.whyItWorks}
                        </p>
                        {game.notes ? (
                          <p className="mt-3 text-sm text-zinc-300/75 leading-relaxed">
                            <span className="font-semibold text-zinc-200">
                              Note:
                            </span>{" "}
                            {game.notes}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </Container>
      </main>
    </div>
  );
}

