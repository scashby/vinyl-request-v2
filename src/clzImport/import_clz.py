import os
import xml.etree.ElementTree as ET

# --- CONFIGURATION ---
XML_FILE = 'music_2025-12-18_14-38-58-export.xml'
OUTPUT_PREFIX = 'inventory_import'
BATCH_SIZE = 50


def clean_text(value):
    if value is None:
        return ''
    return str(value).replace("'", "''").strip()


def normalize_int(value):
    if value is None:
        return None
    value = str(value).strip()
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def parse_tracks(music):
    tracks = []
    discs = music.findall('.//discs/disc')

    if not discs:
        discs = [music]

    for disc_index, disc in enumerate(discs, start=1):
        track_nodes = disc.findall('.//track') if disc is not music else music.findall('.//tracks/track')
        for track in track_nodes:
            raw_pos = track.findtext('position', '').strip()
            seconds_val = normalize_int(track.findtext('length', '0')) or 0
            title = track.findtext('title', '') or ''
            if not title:
                continue
            tracks.append({
                'title': title,
                'position': raw_pos or str(len(tracks) + 1),
                'side': raw_pos[0] if raw_pos and raw_pos[0].isalpha() else None,
                'duration_seconds': seconds_val,
            })
    return tracks


def parse_clz_xml(xml_path):
    print(f"Parsing XML: {xml_path}...")
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
    except Exception as e:
        print(f"Error reading XML: {e}")
        return []

    clz_data = []
    music_list = root.find('.//musiclist')
    if music_list is None:
        return []

    for music in music_list.findall('music'):
        artist_nodes = music.findall('.//artists/artist/displayname')
        artists = [a.text for a in artist_nodes if a.text]
        primary_artist = artists[0] if artists else "Unknown Artist"
        title = music.findtext('title', 'Unknown Title')
        year = music.findtext('releaseyear', '')
        notes = music.findtext('notes', '')
        storage = music.findtext('storagedevice', '')
        slot = music.findtext('slot', '')
        location = f"{storage} {slot}".strip()

        tracks = parse_tracks(music)
        clz_data.append({
            'artist': primary_artist,
            'title': title,
            'year': year,
            'tracks': tracks,
            'barcode': music.findtext('barcode', ''),
            'cat_no': music.findtext('labelnumber', ''),
            'personal_notes': notes,
            'location': location,
        })
    return clz_data


def build_album_sql(item):
    artist = clean_text(item['artist'])
    title = clean_text(item['title'])
    year = normalize_int(item['year'])
    barcode = clean_text(item['barcode']) or None
    catalog_number = clean_text(item['cat_no']) or None
    location = clean_text(item['location']) or None
    personal_notes = clean_text(item['personal_notes']) or None
    return f"""
WITH artist_row AS (
  INSERT INTO public.artists (name)
  VALUES ('{artist}')
  ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
),
artist_id AS (
  SELECT id FROM artist_row
  UNION ALL
  SELECT id FROM public.artists WHERE name = '{artist}' LIMIT 1
),
master_row AS (
  INSERT INTO public.masters (title, main_artist_id, original_release_year)
  VALUES ('{title}', (SELECT id FROM artist_id), {year if year else 'NULL'})
  ON CONFLICT (title, main_artist_id) DO UPDATE SET title = EXCLUDED.title
  RETURNING id
),
master_id AS (
  SELECT id FROM master_row
  UNION ALL
  SELECT id FROM public.masters WHERE title = '{title}' AND main_artist_id = (SELECT id FROM artist_id) LIMIT 1
),
release_row AS (
  INSERT INTO public.releases (master_id, media_type, qty, catalog_number, barcode, release_year)
  VALUES (
    (SELECT id FROM master_id),
    'Unknown',
    1,
    {f"'{catalog_number}'" if catalog_number else 'NULL'},
    {f"'{barcode}'" if barcode else 'NULL'},
    {year if year else 'NULL'}
  )
  ON CONFLICT (master_id, catalog_number) DO UPDATE SET
    qty = EXCLUDED.qty
  RETURNING id
),
release_id AS (
  SELECT id FROM release_row
  UNION ALL
  SELECT id FROM public.releases WHERE master_id = (SELECT id FROM master_id) AND catalog_number IS NOT DISTINCT FROM {f"'{catalog_number}'" if catalog_number else 'NULL'} LIMIT 1
)
INSERT INTO public.inventory (release_id, status, location, personal_notes)
VALUES (
  (SELECT id FROM release_id),
  'in_collection',
  {f"'{location}'" if location else 'NULL'},
  {f"'{personal_notes}'" if personal_notes else 'NULL'}
);
""".strip()


def build_track_sql(item, track):
    artist = clean_text(item['artist'])
    title = clean_text(item['title'])
    catalog_number = clean_text(item['cat_no']) or None
    track_title = clean_text(track['title'])
    position = clean_text(track['position'])
    side = clean_text(track['side']) if track.get('side') else None
    duration_seconds = track.get('duration_seconds')

    return f"""
WITH release_id AS (
  SELECT r.id
  FROM public.releases r
  JOIN public.masters m ON m.id = r.master_id
  JOIN public.artists a ON a.id = m.main_artist_id
  WHERE a.name = '{artist}'
    AND m.title = '{title}'
    AND r.catalog_number IS NOT DISTINCT FROM {f"'{catalog_number}'" if catalog_number else 'NULL'}
  LIMIT 1
),
recording_row AS (
  INSERT INTO public.recordings (title, duration_seconds)
  VALUES (
    '{track_title}',
    {duration_seconds if duration_seconds is not None else 'NULL'}
  )
  RETURNING id
)
INSERT INTO public.release_tracks (release_id, recording_id, position, side)
VALUES (
  (SELECT id FROM release_id),
  (SELECT id FROM recording_row),
  '{position}',
  {f"'{side}'" if side else 'NULL'}
);
""".strip()


def generate_sql():
    if not os.path.exists(XML_FILE):
        print(f"ERROR: {XML_FILE} not found.")
        return

    clz_items = parse_clz_xml(XML_FILE)
    if not clz_items:
        print("No rows to import.")
        return

    print(f"Generating SQL for {len(clz_items)} records...")

    for i in range(0, len(clz_items), BATCH_SIZE):
        batch_num = (i // BATCH_SIZE) + 1
        filename = f"{OUTPUT_PREFIX}_{batch_num}.sql"

        with open(filename, 'w', encoding='utf-8') as f:
            f.write("BEGIN;\n\n")
            for item in clz_items[i:i + BATCH_SIZE]:
                f.write(build_album_sql(item))
                f.write("\n\n")
                for track in item['tracks']:
                    f.write(build_track_sql(item, track))
                    f.write("\n\n")
            f.write("COMMIT;")

        print(f"Created {filename}")


if __name__ == "__main__":
    generate_sql()
