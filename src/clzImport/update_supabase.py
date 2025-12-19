import csv
import xml.etree.ElementTree as ET
import json
import re
import os
from supabase import create_client, Client

# --- CONFIGURATION ---
# Supabase credentials - ensure these are correct for your project
SUPABASE_URL = "https://bntoivaipesuovselglg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJudG9pdmFpcGVzdW92c2VsZ2xnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTM1OTg4MCwiZXhwIjoyMDYwOTM1ODgwfQ.srCEGMjw6zerpKbMadCpPYv72n_193Q_payXEMN17mM"

XML_FILE = 'music_2025-12-18_14-38-58-export.xml'
SUPABASE_CSV = 'collection_rows (3).csv'

def format_duration_clz(seconds_int):
    """Converts raw XML seconds to MM:SS string."""
    if not seconds_int or seconds_int <= 0: return "0:00"
    return f"{seconds_int // 60}:{seconds_int % 60:02d}"

def normalize_text(text):
    """Normalized artist/title for strict matching."""
    if not text: return ""
    text = str(text).lower()
    text = re.sub(r'\s\(\d+\)', '', text) # Remove Discogs suffixes like (1)
    text = re.sub(r'[^a-z0-9\s]', '', text)
    return " ".join(text.split())

def parse_clz_xml(xml_path):
    """Parses CLZ XML and prepares metadata for lookup."""
    print(f"📦 Parsing CLZ XML data...")
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
    except Exception as e:
        print(f"Error reading XML: {e}")
        return {}
    
    clz_data = {}
    music_list = root.find('.//musiclist')
    if music_list is None: return {}

    for music in music_list.findall('music'):
        artist_node = music.find('.//artists/artist/displayname')
        artist = artist_node.text if artist_node is not None else "Unknown Artist"
        title = music.findtext('title', 'Unknown Title')
        
        # Create unique key for matching
        key = f"{normalize_text(artist)}|{normalize_text(title)}"
        
        tracks_json = []
        discs_nodes = music.findall('.//discs/disc') or [music]

        for i, disc_node in enumerate(discs_nodes):
            xml_disc_idx = i + 1
            raw_tracks = disc_node.findall('.//track') or music.findall('.//tracks/track')
            
            for track in raw_tracks:
                raw_pos = track.findtext('position', '')
                side = raw_pos[0].upper() if raw_pos and raw_pos[0].isalpha() else None
                
                seconds_val = int(track.findtext('length', '0'))
                tracks_json.append({
                    "id": f"clz-{track.findtext('hash', '0')}",
                    "position": str(raw_pos), # Strictly string
                    "side": side,
                    "title": track.findtext('title', ''),
                    "artist": "",
                    "duration": format_duration_clz(seconds_val),
                    "disc_number": xml_disc_idx,
                    "type": "track",
                    "is_header": False
                })

        unique_discs = sorted(list(set(t['disc_number'] for t in tracks_json)))
        
        clz_data[key] = {
            "tracks": tracks_json,
            "disc_metadata": [{"index": ud, "name": f"Disc {ud}"} for ud in unique_discs],
            "disc_count": len(unique_discs),
            "credits": {
                "musicians": [m.findtext('displayname') for m in music.findall('.//musicians/musician') if m.findtext('displayname')],
                "producers": [p.findtext('displayname') for p in music.findall('.//producers/producer') if p.findtext('displayname')],
                "engineers": [e.findtext('displayname') for e in music.findall('.//engineers/engineer') if e.findtext('displayname')],
                "songwriters": [s.findtext('displayname') for s in music.findall('.//songwriters/songwriter') if s.findtext('displayname')]
            },
            "barcode": music.findtext('barcode', ''),
            "cat_no": music.findtext('labelnumber', '')
        }
    return clz_data

def run_import():
    # Initialize Supabase
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Load XML data into memory for fast lookup
    clz_lookup = parse_clz_xml(XML_FILE)
    
    print(f"🔍 Processing {SUPABASE_CSV} with 'CSV-First' logic...")
    
    updates_count = 0
    with open(SUPABASE_CSV, mode='r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            s_id = row['id']
            # Recreate match key from CSV row
            key = f"{normalize_text(row['artist_norm'])}|{normalize_text(row['title_norm'])}"
            
            if key in clz_lookup:
                xml_data = clz_lookup[key]
                
                # ====================================================================
                # CSV-FIRST LOGIC:
                # 1. If CSV cell has data (tracks/meta), USE IT.
                # 2. If CSV is empty, use XML.
                # 3. Always take Credits (musicians, etc) from XML.
                # ====================================================================
                
                # Determine tracks - Check both 'tracklists' (legacy) and 'tracks' (JSONB)
                csv_tracks_raw = row.get('tracks', row.get('tracklists', '[]'))
                try:
                    # In your CSV snippet, it looks like 'tracks' might be empty but 'tracklists' has data
                    csv_tracks = json.loads(csv_tracks_raw) if csv_tracks_raw and csv_tracks_raw != '[]' else []
                except:
                    csv_tracks = []
                
                final_tracks = csv_tracks if csv_tracks else xml_data['tracks']
                
                # Determine metadata/disc count
                csv_meta_raw = row.get('disc_metadata', '[]')
                try:
                    csv_meta = json.loads(csv_meta_raw) if csv_meta_raw and csv_meta_raw != '[]' else []
                except:
                    csv_meta = []
                
                final_meta = csv_meta if csv_meta else xml_data['disc_metadata']
                final_discs = len(final_meta) if final_meta else xml_data['disc_count']

                # Build the update payload
                update_payload = {
                    "tracks": final_tracks,
                    "disc_metadata": final_meta,
                    "discs": final_discs,
                    "musicians": xml_data['credits']['musicians'],
                    "producers": xml_data['credits']['producers'],
                    "engineers": xml_data['credits']['engineers'],
                    "songwriters": xml_data['credits']['songwriters'],
                    "barcode": row.get('barcode') or xml_data['barcode'],
                    "cat_no": row.get('cat_no') or xml_data['cat_no']
                }

                try:
                    supabase.table("collection").update(update_payload).eq("id", s_id).execute()
                    updates_count += 1
                    if updates_count % 50 == 0:
                        print(f"✅ Updated {updates_count} records...")
                except Exception as e:
                    print(f"⚠️ Error updating ID {s_id}: {e}")

    print(f"\n✨ FINISHED! {updates_count} records refreshed. CSV data was preserved where present.")

if __name__ == "__main__":
    run_import()