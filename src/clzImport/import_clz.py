import csv
import xml.etree.ElementTree as ET
import json
import re
import os

# --- CONFIGURATION ---
XML_FILE = 'music_2025-12-18_14-38-58-export.xml'
CLZ_CSV = 'model_data (3).csv'
SUPABASE_CSV = 'collection_rows (3).csv'
OUTPUT_PREFIX = 'migration_part'
BATCH_SIZE = 100  # Reduced to 100 to avoid "Query too large" errors in Supabase

def format_duration_clz(seconds_int):
    """Converts integer seconds to MM:SS string for frontend compatibility."""
    if not seconds_int or seconds_int <= 0:
        return "0:00"
    minutes = seconds_int // 60
    seconds = seconds_int % 60
    return f"{minutes}:{seconds:02d}"

def clean_position(pos_str):
    """
    Converts string positions (A1, 1, 1.1) to numbers for the frontend.
    If it's non-numeric (like 'A1'), it strips letters.
    """
    if not pos_str: return 0
    # Remove letters to get the numeric part (e.g., A1 -> 1)
    nums = re.findall(r'\d+', str(pos_str))
    return int(nums[0]) if nums else 0

def normalize_clz_text(text):
    """Normalizes CLZ strings to match Supabase's stored *_norm columns."""
    if not text or text == 'N/A' or str(text).lower() == 'none':
        return ""
    text = str(text).lower()
    text = re.sub(r'\s\(\d+\)', '', text)
    text = re.sub(r'[^a-z0-9\s]', '', text)
    return " ".join(text.split())

def check_files():
    files = [XML_FILE, CLZ_CSV, SUPABASE_CSV]
    missing = [f for f in files if not os.path.exists(f)]
    if missing:
        print("ERROR: Missing files in the current folder:")
        for m in missing: print(f" - {m}")
        return False
    return True

def parse_clz_xml(xml_path):
    print(f"Parsing XML: {xml_path}...")
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
    except Exception as e:
        print(f"Error reading XML: {e}")
        return {}
    
    clz_data = []
    music_list = root.find('.//musiclist')
    if music_list is None: return {}

    for music in music_list.findall('music'):
        artist_nodes = music.findall('.//artists/artist/displayname')
        artists = [a.text for a in artist_nodes if a.text]
        primary_artist = artists[0] if artists else "Unknown Artist"
        title = music.findtext('title', 'Unknown Title')
        year = music.findtext('releaseyear', '')
        
        tracks_json = []
        disc_metadata = []
        discs = music.findall('.//discs/disc')
        
        if not discs:
            actual_disc_count = 1
            disc_metadata.append({"index": 1, "name": "Disc 1"})
            for track in music.findall('.//tracks/track'):
                seconds_val = int(track.findtext('length', '0'))
                t_hash = track.findtext('hash', '0')
                tracks_json.append({
                    "id": f"clz-{t_hash}",
                    "title": track.findtext('title', ''),
                    "position": clean_position(track.findtext('position', '0')),
                    "side": track.findtext('position', '')[0] if track.findtext('position', '').isalpha() else None,
                    "duration": format_duration_clz(seconds_val),
                    "disc_number": 1, 
                    "type": "track",
                    "artist": None
                })
        else:
            actual_disc_count = len(discs)
            for i, disc in enumerate(discs):
                d_idx = i + 1
                d_name = disc.findtext('displayname', f"Disc {d_idx}")
                disc_metadata.append({"index": d_idx, "name": d_name})
                
                for track in disc.findall('.//track'):
                    seconds_val = int(track.findtext('length', '0'))
                    t_hash = track.findtext('hash', '0')
                    raw_pos = track.findtext('position', '')
                    tracks_json.append({
                        "id": f"clz-{t_hash}",
                        "title": track.findtext('title', ''),
                        "position": clean_position(raw_pos),
                        "side": raw_pos[0] if raw_pos and raw_pos[0].isalpha() else None,
                        "duration": format_duration_clz(seconds_val),
                        "disc_number": d_idx,
                        "type": "track",
                        "artist": None
                    })

        clz_data.append({
            "artist": primary_artist,
            "title": title,
            "year": year,
            "norm_artist": normalize_clz_text(primary_artist),
            "norm_title": normalize_clz_text(title),
            "tracks": tracks_json,
            "disc_metadata": disc_metadata,
            "disc_count": actual_disc_count,
            "credits": {
                "musicians": [m.findtext('displayname') for m in music.findall('.//musicians/musician') if m.findtext('displayname')],
                "producers": [p.findtext('displayname') for p in music.findall('.//producers/producer') if p.findtext('displayname')],
                "engineers": [e.findtext('displayname') for e in music.findall('.//engineers/engineer') if e.findtext('displayname')],
                "songwriters": [s.findtext('displayname') for s in music.findall('.//songwriters/songwriter') if s.findtext('displayname')]
            },
            "barcode": music.findtext('barcode', ''),
            "cat_no": music.findtext('labelnumber', '')
        })
    return clz_data

def generate_sql():
    if not check_files(): return
    clz_items = parse_clz_xml(XML_FILE)
    updates = []
    
    print(f"Reading Supabase State: {SUPABASE_CSV}...")
    with open(SUPABASE_CSV, mode='r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            s_id, s_norm_artist, s_norm_title, s_year = row['id'], row['artist_norm'], row['title_norm'], row['year']
            match_found = next((i for i in clz_items if i['norm_artist'] == s_norm_artist and i['norm_title'] == s_norm_title and i['year'] == s_year), None)
            if not match_found:
                match_found = next((i for i in clz_items if i['norm_artist'] == s_norm_artist and i['norm_title'] == s_norm_title), None)
            if not match_found:
                match_found = next((i for i in clz_items if i['norm_title'] == s_norm_title and (i['norm_artist'] in s_norm_artist or s_norm_artist in i['norm_artist'])), None)
            
            if match_found: updates.append((s_id, match_found))

    if not updates:
        print("No matches found.")
        return

    print(f"Matched {len(updates)} records. Splitting into batches of {BATCH_SIZE}...")
    for i in range(0, len(updates), BATCH_SIZE):
        batch_num = (i // BATCH_SIZE) + 1
        filename = f"{OUTPUT_PREFIX}_{batch_num}.sql"
        with open(filename, 'w', encoding='utf-8') as f:
            f.write("BEGIN;\n\n")
            for s_id, data in updates[i:i + BATCH_SIZE]:
                def esc(v):
                    if not isinstance(v, str): return v
                    return v.replace("'", "''")
                
                def to_arr(l):
                    if not l: return "'{}'"
                    items = ['"' + x.replace('"', '""') + '"' for x in l]
                    joined = ",".join(items)
                    return f"'{{{joined}}}'"

                tracks_json_str = json.dumps(data['tracks']).replace("'", "''")
                disc_meta_json_str = json.dumps(data['disc_metadata']).replace("'", "''")
                
                sql = f"""UPDATE public.collection SET 
    tracks = '{tracks_json_str}'::jsonb, 
    disc_metadata = '{disc_meta_json_str}'::jsonb, 
    discs = {data['disc_count']}, 
    musicians = {to_arr(data['credits']['musicians'])}, 
    producers = {to_arr(data['credits']['producers'])}, 
    engineers = {to_arr(data['credits']['engineers'])}, 
    songwriters = {to_arr(data['credits']['songwriters'])}, 
    barcode = '{esc(data['barcode'])}', 
    cat_no = '{esc(data['cat_no'])}' 
WHERE id = {s_id};"""
                f.write(sql + "\n")
            f.write("\nCOMMIT;")
        print(f"Created {filename}")

if __name__ == "__main__":
    generate_sql()