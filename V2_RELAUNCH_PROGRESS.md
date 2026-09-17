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
- **Admin login redirect bug**: magic link never passed `emailRedirectTo`,
  so it (and, separately, Google OAuth whenever the target URL wasn't on
  Supabase's Redirect URLs allowlist) fell back to the account's Site URL —
  in practice, logging in from a preview deployment could land you in
  **production's** live admin panel instead. Magic link fixed in code
  (`6afd16ee`); the Google OAuth side needed a Supabase dashboard change
  (Redirect URLs allowlist), which is done — verified directly with a
  scripted login rather than by asking for manual re-testing.
- **`/admin/edit-home` Connect section layout bug**: the URL field next to
  each social link name rendered as an unreadable sliver. Root cause was a
  Tailwind specificity tie — the Name input carried both the shared
  `inputClass`'s `w-full` and its own `w-32` override, and Tailwind's
  fixed internal utility ordering (not source order) let `w-full` win, so
  Name ate the row and URL got crushed trying to shrink around it. Fixed
  with `!w-32` (`1462bbe7`) and confirmed three independent ways against
  the exact deployed commit: compiled CSS output, DOM measurements via a
  scripted authenticated session, and a screenshot — not by asking for
  manual re-verification.
- **Nav trimmed and About/Dialogues/Merch restyled + extended into the
  content model.** "Browse Collection" removed from nav — Most Wanted and
  the Amazon/Discogs wishlist links already lived on About (not a new
  move). All three pages now theme-aware (`useActiveTheme` — extracted
  from the triplicated fetch logic in page.tsx/Nav/Footer into
  `src/lib/useActiveTheme.ts`) and use the shared card language.
  - **About**: visual-only restyle. Data source untouched — still
    `/api/about-content` + `/admin/edit-about`, no migration needed. Also
    fixed a real bug found while verifying: two blank Most Wanted rows
    (empty title/url already sitting in that table) were rendering as
    empty numbered list items — now filtered out client-side.
  - **Dialogues**: visual-only restyle (rotated "pinned flyer" post
    cards, matching the homepage's Dialogues teaser). Data sources
    unchanged (Substack via `/api/wordpress`, Playlists).
  - **Merch**: store list moved off a hardcoded array into the *same*
    `homepage_sections` table, scoped `page='merch'` instead of `'home'`
    — exactly the reuse that table was designed for, no new table or API
    route needed. Migration `sql/create-merch-sections.sql` applied.
    Editable at new **`/admin/edit-merch`**.
  - **Known pre-existing issue, not fixed (out of scope):** the About
    page's Facebook embed (via `SocialEmbeds.tsx`, untouched by this
    work) throws a Facebook SDK error and renders as a blank box in a
    local/non-production-domain test — likely Meta's embed SDK
    restricting to whitelisted domains. Unclear yet whether this also
    happens on the real `deadwaxdialogues.com` domain; worth checking
    there specifically.
- **Events, Games, DJ Sets, and event-detail restyled too.** These were
  initially left out — Events specifically because "we already have a
  pretty good events page setup" (said before any v2 direction existed)
  got misread as "leave the styling alone forever," not "the
  functionality doesn't need rework." Games and DJ Sets were a plain
  oversight. All three were still on old v1 styling (Events/Games:
  `bg-black` + neon cyan `#00c4ff`, the "hands in the air" club look
  explicitly *not* wanted for this brand; DJ Sets: old white/gray v1).
  Now theme-aware and using the shared card language, same recipe as
  About/Dialogues/Merch. Events in particular had several very
  club/cyberpunk-coded visual bits (a skewed radial-gradient "Book DJ
  Gigs" ad, a neon retro-grid-floor "Latest DJ Sets" panel) rewritten
  into the calmer brand language rather than just palette-swapped.
  - Games is a **server component** (fetches via `supabaseAdmin`
    directly, not client-side) — added `src/lib/getActiveThemeServer.ts`
    as the server-side counterpart to `useActiveTheme`, kept in its own
    file so `theme.ts` (imported by client components) never pulls in
    the service-role Supabase client.
  - On `event-detail`, left `QueueSection` and `EventDJSets` components
    untouched — `QueueSection` in particular may double as a live
    venue-screen display, which is a different context than "match the
    marketing site," and restyling it wasn't asked for.
  - Verified via real production build again; one more pre-existing,
    unrelated, local-only failure surfaced: the Google Maps embed on
    event-detail 403s locally because that API key is domain-restricted
    and `localhost` isn't on the allowlist — same code, will work on the
    real domain.

- **Collection and Games disconnected from the active admin/nav ("the
  stuff we can't see").** Steve's call: Collection is abandoned entirely
  for DWD, and Games are moving to the sister site Vinyl Game Deck
  (vinylgamedeck.com) — both are kept *archival* (code left in place for
  reference while building Vinyl Game Deck) but fully disconnected from
  nav/routes/active admin:
  - `EditEventForm.tsx`, `eventTypeConfig.ts`, `admin/event-types`,
    `admin/manage-events`: removed every collection/games-dependent
    field — `has_queue`, `queue_types`, `allowed_formats`, `crate_id`,
    `venue_logo_url` (admin can no longer set it; DB column/per-event
    usage tracking left alone), and the "Add Game Sessions" picker.
    Manage Events' badge list and `validKeys` whitelist cleaned up to
    match (also found and removed a pre-existing garbage duplicate-field
    array unrelated to this task, `venue_logo_archived_archived_...`).
  - `events/event-detail/[id]`: removed the `has_queue`-gated
    `QueueSection` / "Browse the Collection" block from the public page.
  - `AdminSidebar`: removed the Collection, Games, and Playlists nav
    entries; `admin-dashboard`: removed the "Collection Command Center"
    quick action.
  - `NavigationMenu` "Games" and the homepage Game Deck teaser CTA now
    link externally to `vinylgamedeck.com` instead of the internal
    `/games` route (confirmed live). Updated in code, the live
    `homepage_sections` DB row, and the seed SQL.
  - `/admin/playlists` (the Spotify/Apple embed-code editor) is also
    abandoned. Replacement: the homepage Connect section's Spotify block
    now always shows its static fallback copy as a real link to the
    Spotify profile URL (no more embed-or-fallback branching); the
    Dialogues page sidebar's dynamic "Playlists" embed list was replaced
    with a static "Follow Along" social-icon panel, sourced from the
    same shared `connect.socials` data Footer already uses.
  - The actual `/edit-collection/*`, `/browse/*`, and `/admin/games/*`
    route trees were left completely untouched — only their nav entry
    points were removed, per "archival, not deleted."
  - Verified via a full production build (`npm run build && npm run
    start`) plus scripted Playwright checks: public pages (external
    link hrefs, no leftover queue/collection UI, no console errors
    beyond the pre-existing localhost-only Maps 403), and a real admin
    session (generated via the Supabase service-role
    `admin/generate_link` technique) exercising Manage Events → Edit →
    Save on a real event end-to-end, confirming the simplified form
    still round-trips correctly without corrupting any of the
    now-hidden DB fields.

**📋 PLANNED / BACKLOG:**
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
- Events and Dialogues posts stay sourced from their existing tables/feeds
  (`events`, Substack via `/api/wordpress`) — only the *static* homepage
  copy moves into the new content model. The `playlists` table/API route
  still exist (archival, per the Collection/Games note above) but are no
  longer read by any active page; the Connect section's Spotify block and
  the Dialogues sidebar now just link out to the static social URLs.
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
