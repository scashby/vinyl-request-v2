"use client";

import Link from 'next/link';
import { Container } from 'components/ui/Container';

const adminCards = [
  {
    title: 'Games Admin Hub',
    description:
      'Prep Vinyl Games ahead of events, manage templates, and jump into live game sessions.',
    links: [
      {
        href: '/admin/games/sessions',
        label: '🎛️ Game Sessions',
        helper: 'Create and manage live sessions tied to events.',
      },
      {
        href: '/admin/games/templates',
        label: '🧩 Game Templates',
        helper: 'Pre-slot Trivia/Bingo/Bracketology templates without an event.',
      },
      {
        href: '/admin/games/bingo',
        label: '🎯 Bingo Cards',
        helper: 'Generate printable bingo cards from crates.',
      },
    ],
  },
  {
    title: 'Prep & Planning',
    description:
      'Use templates to seed trivia questions or prep bingo/bracket configurations before an event exists.',
    links: [
      {
        href: '/admin/games/templates',
        label: '➕ Create a Template',
        helper: 'Start building game content ahead of time.',
      },
      {
        href: '/admin/manage-events',
        label: '📅 Attach to an Event',
        helper: 'Assign games to events once the template is ready.',
      },
    ],
  },
];

export default function GamesAdminHub() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Container size="lg">
        <div className="py-12">
          <p className="text-sm uppercase tracking-[0.35em] text-[#7bdcff]">
            Admin · Vinyl Games
          </p>
          <h1 className="text-3xl md:text-4xl font-black mt-2">Games Admin</h1>
          <p className="text-white/60 mt-2 max-w-2xl">
            This is the home base for Vinyl Games. Prep game content before events
            exist, seed templates, and jump into live sessions from one place.
          </p>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {adminCards.map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4"
              >
                <div>
                  <h2 className="text-lg font-semibold">{card.title}</h2>
                  <p className="text-sm text-white/60 mt-2">{card.description}</p>
                </div>
                <div className="space-y-3">
                  {card.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="block rounded-xl border border-white/10 bg-black/60 px-4 py-3 transition hover:border-[#7bdcff]"
                    >
                      <div className="font-semibold text-white">{link.label}</div>
                      <div className="text-xs text-white/60 mt-1">{link.helper}</div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
}
