// src/lib/theme.ts
// The three homepage design directions, formalized as swappable token
// presets. Everything a themed component needs — colors, fonts, and the
// structural details that make each direction feel distinct (card
// rotation, shadow, border weight, badge shape) — lives here as CSS custom
// properties, applied once at the page root (toCssVars). Section
// components reference var(--dwd-*) rather than literal values, so
// switching themes never means touching component code.

export type ThemeName = 'sundayMatinee' | 'brightPopPoster' | 'communityDial';

export interface ThemeTokens {
  name: ThemeName;
  label: string;
  blurb: string;
  // Surfaces
  bg: string;
  bgCard: string;
  navBg: string;
  // Text
  ink: string;
  inkSoft: string; // body copy on light surfaces
  inkFaint: string; // small meta text (dates, captions)
  // Accents
  accent1: string; // primary CTA / links
  accent1Hover: string;
  accent2: string; // secondary accent (bio eyebrow, hero pin dot)
  accent3: string; // tertiary accent (residency pin dot, chips)
  residencyBg: string;
  residencyInk: string; // text color against residencyBg
  residencyCtaBg: string; // "Get Directions" button — must contrast against residencyBg specifically
  residencyCtaColor: string;
  gameDeckBg: string;
  // Type
  fontDisplayVar: string; // e.g. 'var(--font-alfa-slab)'
  fontBodyVar: string;
  headlineTransform: 'none' | 'uppercase';
  // Card "flyer" treatment
  cardBorder: string; // full border shorthand
  cardRadius: string;
  cardShadow: string; // full box-shadow shorthand, or 'none'
  tilt1: string;
  tilt2: string;
  tilt3: string;
  tilt4: string;
  // Hero eyebrow badge
  badgeVariant: 'dashed-outline' | 'filled-pill';
}

export const THEMES: Record<ThemeName, ThemeTokens> = {
  sundayMatinee: {
    name: 'sundayMatinee',
    label: 'Sunday Matinee',
    blurb: 'Warm retro record-shop: cream, mustard, burnt orange, teal — with pinned-flyer details borrowed from Community Dial.',
    bg: '#FAF1E1',
    bgCard: '#FFFFFF',
    navBg: '#FAF1E1',
    ink: '#2A2118',
    inkSoft: '#4A3D2C',
    inkFaint: '#6B5B45',
    accent1: '#C1502E',
    accent1Hover: '#9C3F22',
    accent2: '#2F7A78',
    accent3: '#E8A93C',
    residencyBg: '#4FB8E8',
    residencyInk: '#2A2118',
    residencyCtaBg: '#2A2118',
    residencyCtaColor: '#FAF1E1',
    gameDeckBg: '#6E7F5C',
    fontDisplayVar: 'var(--font-alfa-slab)',
    fontBodyVar: 'var(--font-work-sans)',
    headlineTransform: 'none',
    cardBorder: '2px solid #2A2118',
    cardRadius: '10px',
    cardShadow: '6px 6px 0 rgba(42,33,24,0.10)',
    tilt1: '-1.2deg',
    tilt2: '1deg',
    tilt3: '-0.6deg',
    tilt4: '1.4deg',
    badgeVariant: 'dashed-outline',
  },
  brightPopPoster: {
    name: 'brightPopPoster',
    label: 'Bright Pop Poster',
    blurb: "James Hype's confident, low-density structure, reskinned in flat poster colors — coral, sky blue, sunshine yellow. Clean, no rotation.",
    bg: '#FFFCF6',
    bgCard: '#FFFFFF',
    navBg: '#FFFCF6',
    ink: '#1C1A17',
    inkSoft: '#4A453E',
    inkFaint: '#6b665d',
    accent1: '#FF6B5B',
    accent1Hover: '#E8503F',
    accent2: '#4FB8E8',
    accent3: '#FFD43B',
    residencyBg: '#1C1A17',
    residencyInk: '#FFFCF6',
    residencyCtaBg: '#FFD43B',
    residencyCtaColor: '#1C1A17',
    gameDeckBg: '#FF6B5B',
    fontDisplayVar: 'var(--font-archivo-black)',
    fontBodyVar: 'var(--font-archivo)',
    headlineTransform: 'uppercase',
    cardBorder: '2px solid #1C1A17',
    cardRadius: '18px',
    cardShadow: 'none',
    tilt1: '0deg',
    tilt2: '0deg',
    tilt3: '0deg',
    tilt4: '0deg',
    badgeVariant: 'filled-pill',
  },
  communityDial: {
    name: 'communityDial',
    label: 'Community Dial',
    blurb: 'Hangout-first zine/bulletin-board energy — warm neutral paper, rust and sage, "come be part of this" over polished press kit.',
    bg: '#F2EDE4',
    bgCard: '#F7F2E9',
    navBg: '#F2EDE4',
    ink: '#2E2A24',
    inkSoft: '#4A4438',
    inkFaint: '#6b6455',
    accent1: '#B5482A',
    accent1Hover: '#8A3720',
    accent2: '#6E7F5C',
    accent3: '#6E7F5C',
    residencyBg: '#F7F2E9',
    residencyInk: '#2E2A24',
    residencyCtaBg: '#2E2A24',
    residencyCtaColor: '#F7F2E9',
    gameDeckBg: '#6E7F5C',
    fontDisplayVar: 'var(--font-space-grotesk)',
    fontBodyVar: 'var(--font-karla)',
    headlineTransform: 'none',
    cardBorder: '2px solid #2E2A24',
    cardRadius: '4px',
    cardShadow: 'none',
    tilt1: '-1deg',
    tilt2: '1deg',
    tilt3: '-0.5deg',
    tilt4: '1.5deg',
    badgeVariant: 'dashed-outline',
  },
};

export const DEFAULT_THEME: ThemeName = 'sundayMatinee';

export const isThemeName = (value: unknown): value is ThemeName =>
  typeof value === 'string' && value in THEMES;

// CSS custom properties applied once at the homepage root. Every themed
// component reads these instead of a literal value, e.g.
// `bg-[var(--dwd-bg)]` or `border-[length:2px]` composed from
// `border-[var(--dwd-card-border)]`-style arbitrary properties.
export function toCssVars(t: ThemeTokens): Record<string, string> {
  return {
    '--dwd-bg': t.bg,
    '--dwd-bg-card': t.bgCard,
    '--dwd-nav-bg': t.navBg,
    '--dwd-ink': t.ink,
    '--dwd-ink-soft': t.inkSoft,
    '--dwd-ink-faint': t.inkFaint,
    '--dwd-accent-1': t.accent1,
    '--dwd-accent-1-hover': t.accent1Hover,
    '--dwd-accent-2': t.accent2,
    '--dwd-accent-3': t.accent3,
    '--dwd-residency-bg': t.residencyBg,
    '--dwd-residency-ink': t.residencyInk,
    '--dwd-residency-cta-bg': t.residencyCtaBg,
    '--dwd-residency-cta-color': t.residencyCtaColor,
    '--dwd-game-deck-bg': t.gameDeckBg,
    '--dwd-font-display': t.fontDisplayVar,
    '--dwd-font-body': t.fontBodyVar,
    '--dwd-headline-transform': t.headlineTransform,
    '--dwd-card-border': t.cardBorder,
    '--dwd-card-radius': t.cardRadius,
    '--dwd-card-shadow': t.cardShadow,
    '--dwd-tilt-1': t.tilt1,
    '--dwd-tilt-2': t.tilt2,
    '--dwd-tilt-3': t.tilt3,
    '--dwd-tilt-4': t.tilt4,
    // Derived from badgeVariant so components stay pure CSS-var consumers
    // rather than branching on the enum themselves.
    ...(t.badgeVariant === 'filled-pill'
      ? {
          '--dwd-badge-bg': t.accent3,
          '--dwd-badge-border': 'none',
          '--dwd-badge-color': t.ink,
          '--dwd-badge-radius': '999px',
        }
      : {
          '--dwd-badge-bg': 'transparent',
          '--dwd-badge-border': `2px dashed ${t.accent1}`,
          '--dwd-badge-color': t.accent1,
          '--dwd-badge-radius': '6px',
        }),
  };
}
