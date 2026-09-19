-- Dialogues page content, reusing the same homepage_sections table (see
-- sql/create-homepage-sections.sql) with page='dialogues' instead of
-- 'home' — the same reuse pattern as sql/create-merch-sections.sql.
--
-- Values match what was previously hardcoded in src/app/dialogues/page.tsx
-- exactly, so running this migration changes nothing visually until it's
-- actually edited from /admin/edit-dialogues.

INSERT INTO homepage_sections (page, section_type, position, data) VALUES
('dialogues', 'dialogues_intro', 1, '{
  "heading": "Dialogues",
  "subhead": "Crate digs, liner notes, and whatever else is on the turntable."
}'::jsonb),
('dialogues', 'dialogues_sidebar', 2, '{
  "heading": "Follow Along",
  "description": "New posts, photos, and the playlist — wherever you already hang out."
}'::jsonb)
ON CONFLICT (page, section_type) DO NOTHING;
