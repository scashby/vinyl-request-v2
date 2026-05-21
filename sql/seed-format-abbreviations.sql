-- Seed format_abbreviations from provided source data.
-- Sources:
--   color        → https://www.urpressing.com/client-resources/vinyl-colors/
--   vinyl_material → user-provided weight specs
--   edition      → https://www.discogs.com/help/formatslist (Description Field)
--   cd_feature   → https://www.discogs.com/help/formatslist (Description Field, CD-specific)
--   packaging    → PENDING (Discogs DB Guidelines article)
--   cassette_feature → PENDING (Discogs DB Guidelines article)
--   pressing_plant   → PENDING (not yet provided)
--
-- Safe to run multiple times — ON CONFLICT DO NOTHING skips existing rows.

-- ─────────────────────────────────────────────────────────────────────────────
-- VINYL COLORS  (source: urpressing.com, deduplicated by name)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.format_abbreviations (category, full_name, abbreviation) VALUES
  -- Opaque
  ('color', 'Black',                  'Black'),
  ('color', 'White',                  'White'),
  ('color', 'Orange',                 'Orange'),
  ('color', 'Red',                    'Red'),
  ('color', 'Turquoise',              'Turquoise'),
  ('color', 'Yellow',                 'Yellow'),
  ('color', 'Forest Green',           'Forest Green'),
  ('color', 'Green',                  'Green'),
  ('color', 'Emerald',                'Emerald'),
  ('color', 'Olive Drab Green',       'Olive Drab Green'),
  ('color', 'Blue',                   'Blue'),
  ('color', 'Purple',                 'Purple'),
  ('color', 'Pink',                   'Pink'),
  ('color', 'Brown',                  'Brown'),
  ('color', 'Inferno',                'Inferno'),
  ('color', 'Mac n Cheese',           'Mac n Cheese'),
  ('color', 'Forsythia',              'Forsythia'),
  ('color', 'Neptune',                'Neptune'),
  ('color', 'Live Through This',      'Live Through This'),
  ('color', 'Dream Pop',              'Dream Pop'),
  ('color', 'Chocolate',              'Chocolate'),
  -- Translucent (new names only)
  ('color', 'Magenta',                'Magenta'),
  ('color', 'Swamp Green',            'Swamp Green'),
  ('color', 'Gold',                   'Gold'),
  ('color', 'Sea Glass',              'Sea Glass'),
  ('color', 'Clear',                  'Clear'),
  ('color', 'Frost',                  'Frost'),
  ('color', 'Ultra Clear',            'Ultra Clear'),
  ('color', 'Tan',                    'Tan'),
  ('color', 'Black Ice',              'Black Ice'),
  ('color', 'Candy Apple Red',        'Candy Apple Red'),
  ('color', 'Juice',                  'Juice'),
  ('color', 'Mellow Gold',            'Mellow Gold'),
  ('color', 'Lemon Drop',             'Lemon Drop'),
  ('color', 'Blue Hour',              'Blue Hour'),
  ('color', 'Comic Sands',            'Comic Sands'),
  ('color', 'Window Pane',            'Window Pane'),
  -- Metallic
  ('color', 'Pure Gold',              'Pure Gold'),
  ('color', 'Silver',                 'Silver'),
  ('color', 'Alchemy',                'Alchemy'),
  ('color', 'Pewter',                 'Pewter'),
  -- Pastel (new names only)
  ('color', 'Baby Blue',              'Baby Blue'),
  ('color', 'Custard',                'Custard'),
  ('color', 'Light Violet',           'Light Violet'),
  ('color', 'Violet',                 'Violet'),
  -- Custom Mix
  ('color', 'Storm',                  'Storm'),
  ('color', 'Crystal Ball',           'Crystal Ball'),
  ('color', 'Sangria',                'Sangria'),
  ('color', 'Cherry Glaze',           'Cherry Glaze'),
  ('color', 'Peach',                  'Peach'),
  ('color', 'Motown Suite Orange',    'Motown Suite Orange'),
  ('color', 'Radiation',              'Radiation'),
  ('color', 'Séance',                 'Séance'),
  ('color', 'Amber Fossil',           'Amber Fossil'),
  ('color', 'Tabby Cat',              'Tabby Cat'),
  ('color', 'Lemonade',               'Lemonade'),
  ('color', 'Cockatiel',              'Cockatiel'),
  ('color', 'Slime',                  'Slime'),
  ('color', 'Malachite',              'Malachite'),
  ('color', 'Swamp',                  'Swamp'),
  ('color', 'Glacier',                'Glacier'),
  ('color', 'Mermaid',                'Mermaid'),
  ('color', 'Motown Suite Teal',      'Motown Suite Teal'),
  ('color', 'Sea Foam',               'Sea Foam'),
  ('color', 'Atlantis',               'Atlantis'),
  ('color', 'Good Jeans',             'Good Jeans'),
  ('color', 'Hatful of Hollow',       'Hatful of Hollow'),
  ('color', 'Helium',                 'Helium'),
  ('color', 'Nevermind',              'Nevermind'),
  ('color', 'Purple Haze',            'Purple Haze'),
  ('color', 'Because the Night',      'Because the Night'),
  ('color', 'Rose Quartz',            'Rose Quartz'),
  ('color', 'Synthwave',              'Synthwave'),
  ('color', 'Yoshimi',                'Yoshimi'),
  ('color', 'Vice City',              'Vice City'),
  ('color', 'Root Beer',              'Root Beer'),
  ('color', 'Buttered Popcorn',       'Buttered Popcorn'),
  ('color', 'Pangaea',                'Pangaea'),
  ('color', 'Nashville Public Library Parking Garage', 'Nashville Public Library Parking Garage'),
  -- New Wave
  ('color', 'Energy Dome',            'Energy Dome'),
  ('color', 'Psycho Killer',          'Psycho Killer'),
  ('color', 'Rip It Up',              'Rip It Up'),
  ('color', 'Brass in Pocket',        'Brass in Pocket'),
  ('color', 'Bananarama',             'Bananarama'),
  ('color', 'Dangerous Type',         'Dangerous Type'),
  ('color', 'Radioactivity',          'Radioactivity'),
  ('color', 'Wild Planet',            'Wild Planet'),
  ('color', 'Everything''s Gone Green', 'Everything''s Gone Green'),
  ('color', 'Ocean Rain',             'Ocean Rain'),
  ('color', 'Blue Monday',            'Blue Monday'),
  ('color', 'Are ''Friends'' Electric?', 'Are ''Friends'' Electric?'),
  ('color', 'Atrocity Exhibition',    'Atrocity Exhibition'),
  ('color', 'Cosmic Thing',           'Cosmic Thing'),
  ('color', 'Head Over Heels',        'Head Over Heels'),
  ('color', 'I Want Candy',           'I Want Candy'),
  ('color', 'The King of Rock ''n'' Roll', 'The King of Rock ''n'' Roll'),
  ('color', 'Missing Persons',        'Missing Persons'),
  -- Other
  ('color', 'Pink & Clear Split',     'Pink & Clear Split'),
  ('color', 'Random Mix',             'Random Mix'),
  ('color', 'Random Mix Split',       'Random Mix Split')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- VINYL WEIGHT / MATERIAL  (source: user-provided)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.format_abbreviations (category, full_name, abbreviation) VALUES
  ('vinyl_material', '30g – 40g (7-inch Singles)',                '30g'),
  ('vinyl_material', '120g (12-inch Standard)',                   '120g'),
  ('vinyl_material', '140g (12-inch Standard)',                   '140g'),
  ('vinyl_material', '150g (12-inch Audiophile)',                 '150g'),
  ('vinyl_material', '180g (12-inch Heavyweight/Audiophile)',     '180g'),
  ('vinyl_material', '200g (12-inch Super Heavyweight)',          '200g')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- EDITION  (source: Discogs Description Field — general/cross-format)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.format_abbreviations (category, full_name, abbreviation) VALUES
  ('edition', 'Advance',             'Advance'),
  ('edition', 'Album',               'Album'),
  ('edition', 'Ambisonic',           'Amb'),
  ('edition', 'Bioplastic',          'Bioplastic'),
  ('edition', 'Card Backed',         'Card'),
  ('edition', 'Club Edition',        'Club'),
  ('edition', 'Compilation',         'Comp'),
  ('edition', 'Deluxe Edition',      'Dlx'),
  ('edition', 'Double Sided',        'D/Sided'),
  ('edition', 'EP',                  'EP'),
  ('edition', 'Etched',              'Etch'),
  ('edition', 'Jukebox',             'Jukebox'),
  ('edition', 'Limited Edition',     'Ltd'),
  ('edition', 'LP',                  'LP'),
  ('edition', 'Maxi-Single',         'Maxi'),
  ('edition', 'Mini-Album',          'MiniAlbum'),
  ('edition', 'Mispress',            'MP'),
  ('edition', 'Misprint',            'M/Print'),
  ('edition', 'Mixed',               'Mixed'),
  ('edition', 'Mixtape',             'Mixtape'),
  ('edition', 'Mono',                'Mono'),
  ('edition', 'Numbered',            'Num'),
  ('edition', 'Partially Mixed',     'P/Mixed'),
  ('edition', 'Partially Unofficial','P/Unofficial'),
  ('edition', 'Picture Disc',        'Pic'),
  ('edition', 'Promo',               'Promo'),
  ('edition', 'Quadraphonic',        'Quad'),
  ('edition', 'Record Store Day',    'RSD'),
  ('edition', 'Reissue',             'RE'),
  ('edition', 'Remastered',          'RM'),
  ('edition', 'Repress',             'RP'),
  ('edition', 'Sampler',             'Smplr'),
  ('edition', 'Single',              'Single'),
  ('edition', 'Single Sided',        'S/Sided'),
  ('edition', 'Special Cut',         'Special Cut'),
  ('edition', 'Special Edition',     'S/Edition'),
  ('edition', 'Stereo',              'Stereo'),
  ('edition', 'Styrene',             'Styrene'),
  ('edition', 'Test Pressing',       'TP'),
  ('edition', 'Tour Recording',      'Tour'),
  ('edition', 'Transcription',       'Transcription'),
  ('edition', 'Unofficial Release',  'Unofficial'),
  ('edition', 'White Label',         'W/Lbl')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- CD FEATURES  (source: Discogs Description Field — CD/video-specific)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.format_abbreviations (category, full_name, abbreviation) VALUES
  ('cd_feature', 'AVCD',          'AVCD'),
  ('cd_feature', 'CD+G',          'CD+G'),
  ('cd_feature', 'CD-ROM',        'CD-ROM'),
  ('cd_feature', 'CDi',           'CDi'),
  ('cd_feature', 'Copy Protected','Copy Prot.'),
  ('cd_feature', 'DualDisc',      'DualDisc'),
  ('cd_feature', 'DVDplus',       'DVDplus'),
  ('cd_feature', 'Enhanced',      'Enh'),
  ('cd_feature', 'HDCD',          'HDCD'),
  ('cd_feature', 'Minimax',       'Minimax'),
  ('cd_feature', 'Multichannel',  'Multichannel'),
  ('cd_feature', 'SVCD',          'SVCD'),
  ('cd_feature', 'VCD',           'VCD'),
  ('cd_feature', 'VinylDisc',     'VinylDisc'),
  ('cd_feature', 'XRCD',          'XRCD')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- CASSETTE FEATURES  (source: user-provided IEC tape type specs)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.format_abbreviations (category, full_name, abbreviation) VALUES
  ('cassette_feature', 'Normal (IEC Type I)',        'Nor'),
  ('cassette_feature', 'Chrome (IEC Type II)',        'Cr'),
  ('cassette_feature', 'Ferrichrome (IEC Type III)', 'FeCr'),
  ('cassette_feature', 'Metal (IEC Type IV)',         'Met'),
  ('cassette_feature', 'Dolby B',                    'Dolby B'),
  ('cassette_feature', 'Dolby C',                    'Dolby C'),
  ('cassette_feature', 'Dolby HX Pro',               'HX Pro'),
  ('cassette_feature', 'DBX',                        'DBX')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- PACKAGING  (source: user-provided LP/CD/Singles specs)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.format_abbreviations (category, full_name, abbreviation) VALUES
  -- LP
  ('packaging', 'Solo Sleeve', 'Sol'),
  ('packaging', 'Flipback',    'Fli'),
  ('packaging', 'Gatefold',    'Gat'),
  ('packaging', 'Tri-fold',    'Tri'),
  ('packaging', 'Flyout',      'Fly'),
  ('packaging', 'Poster',      'Pos'),
  ('packaging', 'Die-cut',     'Die'),
  ('packaging', 'Embossed',    'Emb'),
  ('packaging', 'Gimmick',     'Gim'),
  ('packaging', 'Obi',         'Obi'),
  -- CD
  ('packaging', 'Jewelcase',   'Jew'),
  ('packaging', 'Slimline',    'Sli'),
  ('packaging', 'JHybrid',     'JHy'),
  ('packaging', 'Carded',      'Car'),
  ('packaging', 'Digipak',     'Dig'),
  ('packaging', 'Slipcase',    'Slip'),
  ('packaging', 'O-case',      'O-c'),
  ('packaging', 'Paper',       'Pap'),
  -- Singles
  ('packaging', 'Picture',     'Pic'),
  ('packaging', 'Company',     'Com'),
  ('packaging', 'Plain',       'Pla'),
  ('packaging', 'DJP',         'DJP')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- PRESSING PLANTS  (source: user-provided runout etchings guide)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.format_abbreviations (category, full_name, abbreviation) VALUES
  ('pressing_plant', 'Abbey Record Mfg.',           'AB'),
  ('pressing_plant', 'Allentown Record Co.',         'AL'),
  ('pressing_plant', 'Allied Record Company',        'AR'),
  ('pressing_plant', 'American Record Pressing',     'ARP'),
  ('pressing_plant', 'Bestway',                      'BW'),
  ('pressing_plant', 'Capitol Records Jacksonville', 'JW'),
  ('pressing_plant', 'Capitol Records Los Angeles',  'LW'),
  ('pressing_plant', 'Capitol Records Scranton',     'IAM'),
  ('pressing_plant', 'Capitol Records Winchester',   'W'),
  ('pressing_plant', 'Columbia Records Carrollton',  'G'),
  ('pressing_plant', 'Columbia Records Pitman',      'P'),
  ('pressing_plant', 'Columbia Records Santa Maria', 'S'),
  ('pressing_plant', 'Columbia Records Terre Haute', 'T'),
  ('pressing_plant', 'Electrosound Midwest',         'B'),
  ('pressing_plant', 'Goldisc',                      'GoL'),
  ('pressing_plant', 'GZ Media',                     'GZ'),
  ('pressing_plant', 'Hauppauge',                    'HRM'),
  ('pressing_plant', 'Hub-Servall',                  'HuB'),
  ('pressing_plant', 'H.V. Waddell',                 'HVW'),
  ('pressing_plant', 'MCA Gloversville',             'MCA-G'),
  ('pressing_plant', 'MCA Pinckneyville',            'MCA-P'),
  ('pressing_plant', 'MGM',                          'MG'),
  ('pressing_plant', 'Monarch',                      'MR'),
  ('pressing_plant', 'Optimal Media',                'OPTIMAL'),
  ('pressing_plant', 'Pallas',                       'PALLAS'),
  ('pressing_plant', 'Plastic Products',             'PL'),
  ('pressing_plant', 'PRC Richmond',                 'PRC'),
  ('pressing_plant', 'PRC Compton',                  'PRC-C'),
  ('pressing_plant', 'Presswell',                    'PR'),
  ('pressing_plant', 'Quality Records Toronto',      'Q'),
  ('pressing_plant', 'RCA Hollywood',                'H'),
  ('pressing_plant', 'RCA Indianapolis',             'I'),
  ('pressing_plant', 'RCA Rockaway',                 'R'),
  ('pressing_plant', 'Shelley Products',             'LY'),
  ('pressing_plant', 'Sonic Recording',              'SON'),
  ('pressing_plant', 'Specialty Records',            'SP'),
  ('pressing_plant', 'Sterling Sound',               'SS'),
  ('pressing_plant', 'United Record Pressing',       'URP'),
  ('pressing_plant', 'Wakefield Manufacturing',      'YK')
ON CONFLICT DO NOTHING;

