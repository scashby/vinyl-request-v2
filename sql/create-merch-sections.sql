-- Merch page content, reusing the same homepage_sections table (see
-- sql/create-homepage-sections.sql) with page='merch' instead of 'home' —
-- exactly the reuse that migration's comment anticipated.

INSERT INTO homepage_sections (page, section_type, position, data) VALUES
('merch', 'merch_intro', 1, '{
  "heading": "Support The Dialogues",
  "subhead": "Find our latest vinyl drops and official merchandise across our various marketplaces."
}'::jsonb),
('merch', 'merch_stores', 2, '{
  "stores": [
    {"name": "Official Shop", "description": "Apparel, accessories, and exclusive Dead Wax Dialogues gear.", "url": "https://shop.deadwaxdialogues.com"},
    {"name": "Discogs Store", "description": "Browse our curated selection of vintage vinyl and rare finds.", "url": "https://www.discogs.com/seller/deadwaxdialogues"},
    {"name": "eBay Collection", "description": "Special auctions and unique collectibles.", "url": "https://www.ebay.com/usr/deadwaxdialogues"}
  ]
}'::jsonb)
ON CONFLICT (page, section_type) DO NOTHING;
