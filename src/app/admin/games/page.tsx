"use client";

import Link from "next/link";
import { Container } from "components/ui/Container";
import { Button } from "components/ui/Button";

const gameCards = [
  {
    title: "Music Bingo",
    description:
      "Vinyl-only music bingo with printable cards, pick lists, and host controls.",
    href: "/admin/games/bingo",
    cta: "Open",
    status: "ready",
  },
  {
    title: "Music Trivia",
    description: "Question rounds powered by your vinyl collection.",
    href: "/admin/games",
    cta: "Coming soon",
    status: "coming",
  },
  {
    title: "Bracket Tournaments",
    description: "Track vs track elimination brackets.",
    href: "/admin/games",
    cta: "Coming soon",
    status: "coming",
  },
];

export default function Page() {
  return (
    <Container size="md" className="py-8 min-h-screen">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Game Admin Center</h1>
          <p className="text-sm text-gray-500 mt-2">
            Command center for creating, running, and managing music game events.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {gameCards.map((game) => {
          const isComing = game.status === "coming";
          return (
            <div
              key={game.title}
              className="border border-gray-200 rounded-2xl p-5 bg-white shadow-sm flex flex-col gap-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{game.title}</h2>
                  <p className="text-sm text-gray-600 mt-2">{game.description}</p>
                </div>
                {isComing ? (
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    Coming Soon
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-green-700 bg-green-100 px-2 py-1 rounded-full">
                    Active
                  </span>
                )}
              </div>

              <div className="mt-auto">
                {isComing ? (
                  <Button variant="secondary" size="sm" disabled>
                    {game.cta}
                  </Button>
                ) : (
                  <Link href={game.href}>
                    <Button size="sm">{game.cta}</Button>
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Container>
  );
}
