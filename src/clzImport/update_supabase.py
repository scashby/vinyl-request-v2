import csv
import json
import os
import re

# --- CONFIGURATION ---
# This file is used to generate UPDATE statements for existing records
# based on a matching logic (e.g. from CLZ export vs Supabase export)

SUPABASE_CSV = 'collection_rows (3).csv' 
OUTPUT_PREFIX = 'update_batch'
BATCH_SIZE = 100

def clean_text(val):
    if not val: return ''
    return val.replace("'", "''").strip()

def check_files():
    if not os.path.exists(SUPABASE_CSV):
        print(f"ERROR: {SUPABASE_CSV} not found.")
        return False
    return True

def generate_update_sql():
    if not check_files(): return
    
    print(f"Reading Supabase State: {SUPABASE_CSV}...")
    updates = []
    
    with open(SUPABASE_CSV, mode='r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if not row.get('id'): continue
            s_id = row['id']
            
            # Example Logic: If we want to move data from 'folder' to 'location' 
            # (If not done via SQL) or clean up notes.
            
            folder = row.get('folder', '')
            notes = row.get('notes', '')
            
            # Skip if already empty or seemingly migrated
            if not folder and not notes: continue

            # Determine new values
            is_sale = 'sale' in folder.lower()
            location = '' if is_sale else folder
            
            # Construct UPDATE
            # This is a safe "Migrate in Place" generation
            updates.append({
                'id': s_id,
                'location': location,
                'personal_notes': notes,
                'for_sale': 'true' if is_sale else 'false'
            })

    if not updates:
        print("No updates needed.")
        return

    print(f"Generating SQL for {len(updates)} records...")
    
    for i in range(0, len(updates), BATCH_SIZE):
        batch_num = (i // BATCH_SIZE) + 1
        filename = f"{OUTPUT_PREFIX}_{batch_num}.sql"
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write("BEGIN;\n\n")
            for item in updates[i:i + BATCH_SIZE]:
                sql = f"""UPDATE public.collection SET 
    location = '{clean_text(item['location'])}',
    personal_notes = '{clean_text(item['personal_notes'])}',
    for_sale = {item['for_sale']}
WHERE id = {item['id']};"""
                f.write(sql + "\n")
            f.write("\nCOMMIT;")
        
        print(f"Created {filename}")

if __name__ == "__main__":
    generate_update_sql()