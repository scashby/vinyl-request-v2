// src/app/page.tsx
// Home page ("/") — Landing for Dead Wax Dialogues
//
// Content for each section below comes from the `homepage_sections` table
// (editable at /admin/edit-home), falling back to DEFAULT_SECTIONS if a row
// doesn't exist yet (e.g. before sql/create-homepage-sections.sql has been
// run). Resolved server-side (see homeContentServer.ts) so the real copy is
// there on the first paint, inheriting the root layout's 5-minute
// revalidation — an admin edit here shows up within a few minutes, not
// instantly, in exchange for the page not flashing default copy on load.
// Events and Dialogues posts stay sourced from their own existing
// tables/feeds, fetched client-side in HomePageClient — only the static
// copy lives here. The Connect section's Spotify block always shows its
// static fallback (linking to the Spotify profile URL in the socials list)
// now that /admin/playlists is retired.

import { getResolvedHomeSections } from "src/lib/homeContentServer";
import { HomePageClient } from "src/components/home/HomePageClient";

export default async function Page() {
  const sections = await getResolvedHomeSections("home");
  return <HomePageClient sections={sections} />;
}
