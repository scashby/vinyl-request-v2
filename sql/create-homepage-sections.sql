-- Section-based content model for the v2 homepage rebuild.
--
-- Each row is one editable content block. Deliberately shaped like a
-- page-builder's block model (section_type, position, visible, data jsonb)
-- even though the admin UI only supports editing content for now — reorder/
-- show-hide/add/remove can be layered on top of this same table later
-- without another migration.
--
-- `page` scopes rows to a page (only 'home' today; About/Dialogues/Merch can
-- reuse this table later instead of getting their own).

CREATE TABLE homepage_sections (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  page         text NOT NULL DEFAULT 'home',
  section_type text NOT NULL,
  position     integer NOT NULL DEFAULT 0,
  visible      boolean NOT NULL DEFAULT true,
  data         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page, section_type)
);

CREATE INDEX idx_homepage_sections_page_position ON homepage_sections(page, position);

-- Enable RLS (consistent with all other tables in this project)
ALTER TABLE public.homepage_sections ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.homepage_sections TO anon, authenticated;

-- Open policies — single-owner admin app, no per-user ownership
CREATE POLICY homepage_sections_select_all
  ON public.homepage_sections FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY homepage_sections_insert_all
  ON public.homepage_sections FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY homepage_sections_update_all
  ON public.homepage_sections FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY homepage_sections_delete_all
  ON public.homepage_sections FOR DELETE TO anon, authenticated USING (true);

-- Seed with the copy currently hardcoded in src/app/page.tsx, so publishing
-- this migration changes nothing visually until someone edits it in
-- /admin/edit-home.
INSERT INTO homepage_sections (page, section_type, position, data) VALUES
('home', 'hero', 1, '{
  "eyebrow": "Spinning 70s–90s · Devil''s Purse Brewery",
  "headline": "The needle drops every {night}.",
  "subhead": "Pop, rock, and dance cuts from the 70s through the 90s — played warm, played loud enough, never shouted at you once.",
  "primary_cta_label": "See Upcoming Nights",
  "primary_cta_href": "/events/events-page",
  "secondary_cta_label": "Book a Private Event",
  "secondary_cta_href": "/about",
  "photo_placeholder_text": "Photo coming soon — Steve at the decks, {venue}"
}'::jsonb),
('home', 'residency', 2, '{
  "eyebrow": "The Residency",
  "venue": "Devil''s Purse Brewery",
  "night": "Sunday",
  "description": "Same bar, same crate of records, same good time. Pull up a stool and put in a request.",
  "cta_label": "Get Directions",
  "cta_href": "https://www.google.com/maps/search/?api=1&query=Devil%27s+Purse+Brewery"
}'::jsonb),
('home', 'events_strip', 3, '{
  "heading": "Coming Up",
  "cta_label": "Full calendar →",
  "cta_href": "/events/events-page",
  "empty_state_text": "Nothing on the calendar yet — check back soon, or catch the standing {night} residency at {venue}."
}'::jsonb),
('home', 'bio', 4, '{
  "eyebrow": "The Short Version",
  "body": "Steve''s been building crossfades since he was taping songs off the radio as a kid. These days you''ll find him behind the decks at {venue}, spinning the deep cuts and just-as-good B-sides from the 70s through the 90s — pop, rock, a little disco, always danceable."
}'::jsonb),
('home', 'game_deck', 5, '{
  "eyebrow": "Things To Do At A Dead Wax Night",
  "headline": "Bring a team. We brought the games.",
  "body": "Vinyl Game Deck turns the night into a party — right alongside the set, no extra cover charge.",
  "chips": ["Vinyl Bingo", "Cover Art Clue Chase", "Decade Dash"],
  "cta_label": "Explore Vinyl Game Deck →",
  "cta_href": "/games",
  "photo_placeholder_text": "Photo coming soon — Vinyl Bingo on a brewery table"
}'::jsonb),
('home', 'dialogues_teaser', 6, '{
  "heading": "From The Dialogues",
  "cta_label": "Read more →",
  "cta_href": "/dialogues"
}'::jsonb),
('home', 'connect', 7, '{
  "heading": "Say Hi",
  "subhead": "Playlists, photos, and the occasional bad pun.",
  "socials": [
    {"name": "Spotify", "url": "https://open.spotify.com/user/deadwaxdialogues"},
    {"name": "Instagram", "url": "https://www.instagram.com/deadwaxdialogues/"},
    {"name": "Facebook", "url": "https://www.facebook.com/profile.php?id=61576451743378"},
    {"name": "Threads", "url": "https://www.threads.net/@deadwaxdialogues"},
    {"name": "Bluesky", "url": "https://bsky.app/profile/deadwaxdialogues.bsky.social"},
    {"name": "Substack", "url": "https://deadwaxdialogues.substack.com"},
    {"name": "Discogs", "url": "https://www.discogs.com/user/socialblunders/collection"}
  ],
  "spotify_fallback_label": "Follow the playlist on Spotify",
  "spotify_fallback_sublabel": "The Dead Wax Dialogues rotation, updated weekly"
}'::jsonb);
