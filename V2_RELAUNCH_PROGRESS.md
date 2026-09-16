# Dead Wax Dialogues v2 Relaunch — Progress Tracker

Tracking the redesign of deadwaxdialogues.com away from the v1 "sprawling mess"
(vinyl-collection tooling mixed with the DJ/events brand) toward a focused
site: events, the Devil's Purse Brewery residency, Vinyl Game Deck, socials/
Spotify, and the Dialogues blog. Working branch: `development`, previewed via
draft PR [#112](https://github.com/scashby/vinyl-request-v2/pull/112) before
merging to `main`.

## Status Summary

**✅ COMPLETE:**
- Branch/deploy setup: `main` confirmed as Vercel production branch,
  `development` created as the preview branch, draft PR #112 open so every
  push auto-builds a Vercel preview.
- Design direction chosen: **"Sunday Matinee"** (warm cream/mustard/
  burnt-orange/teal, Alfa Slab One + Work Sans) as the base, with
  **Community Dial's** angled/pinned-flyer details (rotated cards, offset
  shadows, pin dots) layered in, plus the residency band recolored sky blue
  and the Game Deck teaser recolored sage green (both pulled from the other
  two directions). Two other full directions explored and kept: **"Bright
  Pop Poster"** and **"Community Dial"** — not deleted, see Themes below.
- Homepage (`src/app/page.tsx`), nav (`src/components/NavigationMenu.tsx`),
  and footer (`src/components/Footer.tsx`) rebuilt in the new visual
  direction. Footer now actually renders site-wide (previously defined but
  never mounted anywhere — dead code).
- Homepage wired to real data: Supabase `events` table (Coming Up strip),
  `/api/wordpress` Substack feed (Dialogues teaser), real social links.
  Committed as [`d22d1693`](https://github.com/scashby/vinyl-request-v2/commit/d22d1693f781af148d0e58be47e64b780ab7606a).
- Verified with `npm run build` (clean) and a real headless-browser pass at
  desktop (1440px) and mobile (390px) widths — no console errors, no failed
  requests.
- **Content model**: homepage copy (hero, residency, bio, Game Deck blurb,
  button labels, social links) moved out of `page.tsx` into an admin-editable,
  section-based content model (`homepage_sections` table — see
  `sql/create-homepage-sections.sql`). Homepage split into per-section
  components under `src/components/home/`; each reads its copy from
  `/api/homepage-sections`, falling back to `DEFAULT_SECTIONS` in
  `src/lib/homeContent.ts` if the table doesn't exist yet, so the site never
  breaks. Editable at **`/admin/edit-home`**. Footer's social links now pull
  from the same `connect` section instead of a separate hardcoded list.
  Designed to grow into drag-and-drop later without a rebuild: each row
  already carries `position` and `visible`, even though reorder/add/remove
  *UI* isn't built yet — this pass is content editing only.

  **✅ Migration applied** — `homepage_sections` exists on the production DB
  and is seeded; `/admin/edit-home` saves for real. (Direct Postgres access
  is now set up for running future migrations from a session — see local
  memory, not committed to the repo.)
- **Theme system**: the three explored directions (Sunday Matinee, Bright
  Pop Poster, Community Dial) are now formalized as swappable design-token
  presets in `src/lib/theme.ts` — colors, fonts, *and* the structural
  details that make each direction distinct (card rotation/shadow/border,
  hero badge shape, headline case). Every themed component (all homepage
  sections, nav, footer) reads `var(--dwd-*)` CSS custom properties instead
  of literal values, so switching themes never touches component code.
  Active theme is stored in the existing `admin_settings` key/value table
  (key `theme:active`) and switchable from a picker at the top of
  **`/admin/edit-home`** — takes effect immediately, site-wide. Verified all
  three render correctly (including catching and fixing a real bug: Bright
  Pop Poster's "Get Directions" button was invisible because its background
  matched the residency band's background exactly — added a dedicated
  contrast-safe token pair rather than reusing ink/bg universally).

**📋 PLANNED / BACKLOG:**
- Extend the section/content model + admin editing to About → Book,
  Dialogues, and Merch → Connect.
- Trim the nav/sitemap (currently unchanged this pass): fold or demote
  Browse Collection, Most Wanted, Amazon/Discogs wishlists — these are
  personal-collector content, not the DJ/events brand.
- Add a real photo of Steve (hero + Game Deck teaser currently show an
  honest "photo coming soon" placeholder — no fabricated image).
- Longer-term, explicitly deferred: a true drag-and-drop page builder
  (freely add/remove/reorder/resize sections). Today's content model is
  being built to make that additive later, not to replace it now.

## Architecture Decisions

- **Section-based content, not a single content blob.** Each homepage
  section is its own row (`section_type`, `position`, `data jsonb`,
  `visible`), same shape a page-builder would use, so later reordering/
  show-hide/insert work is additive rather than a migration.
- Events, Dialogues posts, and Spotify playlists stay sourced from their
  existing tables/feeds (`events`, Substack via `/api/wordpress`, the
  `playlists` table) — only the *static* homepage copy moves into the new
  content model.
- Admin write routes (`/api/homepage-sections/[id]`, `/api/site-theme`)
  follow this repo's existing convention of relying on the `/admin`
  client-side session gate rather than per-request server-side auth —
  matches `about-content` and other existing admin API routes, not a new
  gap introduced here.
- **Theming via CSS custom properties, not per-theme component variants.**
  `src/lib/theme.ts` computes a flat bag of `--dwd-*` values (including
  ones derived from higher-level fields, e.g. badge background/border
  derived from `badgeVariant`) and applies them once at each themed
  component's root via inline `style`. Components never branch on theme
  name — this is what makes adding a fourth theme later a `theme.ts`-only
  change.
