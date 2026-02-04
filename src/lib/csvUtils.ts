// src/lib/csvUtils.ts
import Papa from 'papaparse';

// Matches the exact headers from your uploaded CSV
export interface DiscogsCSVRow {
  'Catalog#': string;
  Artist: string;
  Title: string;
  Label: string;
  Format: string;
  Released: string;
  release_id: string;
  CollectionFolder: string;
  'Date Added': string;
  'Collection Media Condition': string;
  'Collection Sleeve Condition': string;
  'Collection Notes': string;
  [key: string]: string; // Allow for other columns
}

export interface ProcessedRelease {
  artist: string;
  sort_artist: string;
  title: string;
  format: string;
  location: string;
  year: number | null;
  media_condition: string;
  package_sleeve_condition: string;
  discogs_release_id: string;
  personal_notes: string;
  date_added: string;
}

// 🛠 Extract, normalize fields, apply Phase 2 Logic
export function parseDiscogsCSV(file: File, callback: (rows: ProcessedRelease[]) => void): void {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const rows = (results.data as DiscogsCSVRow[]).map((row) => {
        // 1. Clean Artist
        const primary = row['Artist'] || '';

        // 2. Logic: Folder -> Location
        const folder = row['CollectionFolder'] || '';
        const location = folder;

        return {
          artist: primary,
          sort_artist: primary, // Will be refined by server-side rules later, default to primary
          title: row['Title'] || '',
          format: row['Format'] || '',
          
          // Map Folder Logic
          location: location,
          year: parseInt(row['Released'], 10) || null,
          media_condition: row['Collection Media Condition'] || '',
          package_sleeve_condition: row['Collection Sleeve Condition'] || '',
          
          // Map IDs
          discogs_release_id: row['release_id'] || '',
          
          // Map Notes (The Fix!)
          personal_notes: row['Collection Notes'] || '',
          
          date_added: row['Date Added'] || new Date().toISOString(),
        };
      });
      callback(rows);
    },
    error: (err: Error) => {
      console.error('CSV parse error:', err);
      callback([]);
    }
  });
}
