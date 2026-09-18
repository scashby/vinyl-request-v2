// src/lib/homeContent.ts
// Types + fallback defaults for the homepage's section-based content model.
// See sql/create-homepage-sections.sql for the table this mirrors.
//
// DEFAULT_SECTIONS matches that migration's seed data exactly, so the page
// renders identically whether or not the migration has been run yet against
// a given environment — /api/homepage-sections just fills in real (editable)
// data on top of these once it exists.

import { DEFAULT_PHOTO_FOCUS, type PhotoFocus } from "src/lib/homePhotoFocus";

export interface HeroData {
  eyebrow: string;
  headline: string; // may contain "{night}" / "{venue}" tokens
  subhead: string;
  primary_cta_label: string;
  primary_cta_href: string;
  secondary_cta_label: string;
  secondary_cta_href: string;
  photo_url: string; // shown instead of the placeholder once set
  photo_focus: PhotoFocus; // pan/zoom framing of photo_url within its (4:5) slot
  photo_placeholder_text: string; // may contain "{venue}"; shown until photo_url is set
}

export interface ResidencyData {
  eyebrow: string;
  venue: string;
  night: string;
  description: string;
  cta_label: string;
  cta_href: string;
}

export interface EventsStripData {
  heading: string;
  cta_label: string;
  cta_href: string;
  empty_state_text: string; // may contain "{night}" / "{venue}" tokens
}

export interface BioData {
  eyebrow: string;
  body: string; // may contain "{venue}"
}

export interface GameDeckData {
  eyebrow: string;
  headline: string;
  body: string;
  chips: string[];
  cta_label: string;
  cta_href: string;
  photo_url: string; // shown instead of the placeholder once set
  photo_focus: PhotoFocus; // pan/zoom framing of photo_url within its (7:5) slot
  photo_placeholder_text: string; // shown until photo_url is set
}

export interface DialoguesTeaserData {
  heading: string;
  cta_label: string;
  cta_href: string;
}

export interface SocialLink {
  name: string;
  url: string;
}

export interface ConnectData {
  heading: string;
  subhead: string;
  socials: SocialLink[];
  spotify_fallback_label: string;
  spotify_fallback_sublabel: string;
}

export type SectionType =
  | 'hero'
  | 'residency'
  | 'events_strip'
  | 'bio'
  | 'game_deck'
  | 'dialogues_teaser'
  | 'connect';

export interface HomepageSection<T = unknown> {
  id: number;
  page: string;
  section_type: SectionType;
  position: number;
  visible: boolean;
  data: T;
}

// Replaces a "{night}"/"{venue}" token in section copy with the residency
// section's actual values, so editing the residency once updates every
// section that references it.
export const fillTokens = (
  text: string,
  tokens: { night: string; venue: string }
): string => text.replace('{night}', tokens.night).replace('{venue}', tokens.venue);

export const DEFAULT_SECTIONS: {
  hero: HeroData;
  residency: ResidencyData;
  events_strip: EventsStripData;
  bio: BioData;
  game_deck: GameDeckData;
  dialogues_teaser: DialoguesTeaserData;
  connect: ConnectData;
} = {
  hero: {
    eyebrow: "Spinning 70s–90s · Devil's Purse Brewery",
    headline: 'The needle drops every {night}.',
    subhead:
      'Pop, rock, and dance cuts from the 70s through the 90s — played warm, played loud enough, never shouted at you once.',
    primary_cta_label: 'See Upcoming Nights',
    primary_cta_href: '/events/events-page',
    secondary_cta_label: 'Book a Private Event',
    secondary_cta_href: '/about',
    photo_url: '',
    photo_focus: DEFAULT_PHOTO_FOCUS,
    photo_placeholder_text: 'Photo coming soon — Steve at the decks, {venue}',
  },
  residency: {
    eyebrow: 'The Residency',
    venue: "Devil's Purse Brewery",
    night: 'Sunday',
    description:
      'Same bar, same crate of records, same good time. Pull up a stool and put in a request.',
    cta_label: 'Get Directions',
    cta_href: 'https://www.google.com/maps/search/?api=1&query=Devil%27s+Purse+Brewery',
  },
  events_strip: {
    heading: 'Coming Up',
    cta_label: 'Full calendar →',
    cta_href: '/events/events-page',
    empty_state_text:
      'Nothing on the calendar yet — check back soon, or catch the standing {night} residency at {venue}.',
  },
  bio: {
    eyebrow: 'The Short Version',
    body:
      "Steve's been building crossfades since he was taping songs off the radio as a kid. These days you'll find him behind the decks at {venue}, spinning the deep cuts and just-as-good B-sides from the 70s through the 90s — pop, rock, a little disco, always danceable.",
  },
  game_deck: {
    eyebrow: 'Things To Do At A Dead Wax Night',
    headline: 'Bring a team. We brought the games.',
    body: 'Vinyl Game Deck turns the night into a party — right alongside the set, no extra cover charge.',
    chips: ['Vinyl Bingo', 'Cover Art Clue Chase', 'Decade Dash'],
    cta_label: 'Explore Vinyl Game Deck →',
    cta_href: 'https://vinylgamedeck.com',
    photo_url: '',
    photo_focus: DEFAULT_PHOTO_FOCUS,
    photo_placeholder_text: 'Photo coming soon — Vinyl Bingo on a brewery table',
  },
  dialogues_teaser: {
    heading: 'From The Dialogues',
    cta_label: 'Read more →',
    cta_href: '/dialogues',
  },
  connect: {
    heading: 'Say Hi',
    subhead: 'Playlists, photos, and the occasional bad pun.',
    socials: [
      { name: 'Spotify', url: 'https://open.spotify.com/user/deadwaxdialogues' },
      { name: 'Instagram', url: 'https://www.instagram.com/deadwaxdialogues/' },
      { name: 'Facebook', url: 'https://www.facebook.com/profile.php?id=61576451743378' },
      { name: 'Threads', url: 'https://www.threads.net/@deadwaxdialogues' },
      { name: 'Bluesky', url: 'https://bsky.app/profile/deadwaxdialogues.bsky.social' },
      { name: 'Substack', url: 'https://deadwaxdialogues.substack.com' },
      { name: 'Discogs', url: 'https://www.discogs.com/user/socialblunders/collection' },
    ],
    spotify_fallback_label: 'Follow the playlist on Spotify',
    spotify_fallback_sublabel: 'The Dead Wax Dialogues rotation, updated weekly',
  },
};

export const SECTION_TYPES: SectionType[] = [
  'hero',
  'residency',
  'events_strip',
  'bio',
  'game_deck',
  'dialogues_teaser',
  'connect',
];

export const SECTION_LABELS: Record<SectionType, string> = {
  hero: 'Hero',
  residency: 'Residency',
  events_strip: 'Coming Up (heading/links only — events come from Manage Events)',
  bio: 'Bio',
  game_deck: 'Vinyl Game Deck Teaser',
  dialogues_teaser: 'Dialogues Teaser (heading/links only — posts come from Substack)',
  connect: 'Connect',
};

// Merge fetched rows onto the defaults so a partially-seeded environment (or
// a row with a field an older admin form didn't set) still renders fully.
export function resolveSections(
  rows: HomepageSection<Record<string, unknown>>[] | null | undefined
) {
  const byType = new Map(rows?.map((r) => [r.section_type, r]) ?? []);

  const build = <T extends object>(type: SectionType, fallback: T): { row: HomepageSection<T> | null; data: T } => {
    const row = byType.get(type) as HomepageSection<Record<string, unknown>> | undefined;
    if (!row) return { row: null, data: fallback };
    return {
      row: row as unknown as HomepageSection<T>,
      data: { ...fallback, ...(row.data as Partial<T>) },
    };
  };

  return {
    hero: build('hero', DEFAULT_SECTIONS.hero),
    residency: build('residency', DEFAULT_SECTIONS.residency),
    events_strip: build('events_strip', DEFAULT_SECTIONS.events_strip),
    bio: build('bio', DEFAULT_SECTIONS.bio),
    game_deck: build('game_deck', DEFAULT_SECTIONS.game_deck),
    dialogues_teaser: build('dialogues_teaser', DEFAULT_SECTIONS.dialogues_teaser),
    connect: build('connect', DEFAULT_SECTIONS.connect),
  };
}
