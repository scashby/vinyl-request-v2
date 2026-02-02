import csv
import os

# --- CONFIGURATION ---
# This file generates INSERT statements that follow the "Get or Create" chain:
# Artists → Masters → Releases → Inventory.

CLZ_CSV = 'clz_export.csv'
OUTPUT_PREFIX = 'inventory_import'
BATCH_SIZE = 100

def clean_text(val):
    if val is None:
        return ''
    return str(val).replace("'", "''").strip()

def check_files():
    if not os.path.exists(CLZ_CSV):
        print(f"ERROR: {CLZ_CSV} not found.")
        return False
    return True

def normalize_row(row):
    return {
        'artist': row.get('artist') or row.get('Artist') or '',
        'title': row.get('title') or row.get('Title') or '',
        'year': row.get('year') or row.get('Year') or '',
        'media_type': row.get('media_type') or row.get('Media Type') or row.get('format') or row.get('Format') or 'Unknown',
        'label': row.get('label') or row.get('Label') or '',
        'catalog_number': row.get('catalog_number') or row.get('Catalog #') or row.get('cat_no') or '',
        'location': row.get('location') or row.get('Location') or row.get('folder') or '',
        'media_condition': row.get('media_condition') or row.get('Media Condition') or '',
        'sleeve_condition': row.get('sleeve_condition') or row.get('Sleeve Condition') or '',
        'personal_notes': row.get('personal_notes') or row.get('notes') or ''
    }

def build_sql(item):
    artist = clean_text(item['artist'])
    title = clean_text(item['title'])
    year = clean_text(item['year'])
    media_type = clean_text(item['media_type']) or 'Unknown'
    label = clean_text(item['label']) or None
    catalog_number = clean_text(item['catalog_number']) or None
    location = clean_text(item['location']) or None
    media_condition = clean_text(item['media_condition']) or None
    sleeve_condition = clean_text(item['sleeve_condition']) or None
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
  INSERT INTO public.releases (master_id, media_type, label, catalog_number, release_year)
  VALUES (
    (SELECT id FROM master_id),
    '{media_type}',
    {f"'{label}'" if label else 'NULL'},
    {f"'{catalog_number}'" if catalog_number else 'NULL'},
    {year if year else 'NULL'}
  )
  ON CONFLICT (master_id, catalog_number) DO UPDATE SET media_type = EXCLUDED.media_type
  RETURNING id
),
release_id AS (
  SELECT id FROM release_row
  UNION ALL
  SELECT id FROM public.releases WHERE master_id = (SELECT id FROM master_id) AND catalog_number IS NOT DISTINCT FROM {f"'{catalog_number}'" if catalog_number else 'NULL'} LIMIT 1
)
INSERT INTO public.inventory (release_id, status, location, media_condition, sleeve_condition, personal_notes)
VALUES (
  (SELECT id FROM release_id),
  'in_collection',
  {f"'{location}'" if location else 'NULL'},
  {f"'{media_condition}'" if media_condition else 'NULL'},
  {f"'{sleeve_condition}'" if sleeve_condition else 'NULL'},
  {f"'{personal_notes}'" if personal_notes else 'NULL'}
);
""".strip()

def generate_import_sql():
    if not check_files():
        return

    print(f"Reading CLZ Export: {CLZ_CSV}...")
    inserts = []

    with open(CLZ_CSV, mode='r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            normalized = normalize_row(row)
            if not normalized['artist'] or not normalized['title']:
                continue
            inserts.append(normalized)

    if not inserts:
        print("No rows to import.")
        return

    print(f"Generating SQL for {len(inserts)} records...")

    for i in range(0, len(inserts), BATCH_SIZE):
        batch_num = (i // BATCH_SIZE) + 1
        filename = f"{OUTPUT_PREFIX}_{batch_num}.sql"

        with open(filename, 'w', encoding='utf-8') as f:
            f.write("BEGIN;\n\n")
            for item in inserts[i:i + BATCH_SIZE]:
                f.write(build_sql(item))
                f.write("\n\n")
            f.write("COMMIT;")

        print(f"Created {filename}")

if __name__ == "__main__":
    generate_import_sql()
