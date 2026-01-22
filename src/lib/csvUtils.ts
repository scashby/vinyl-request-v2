// src/lib/csvUtils.ts
import Papa from 'papaparse';
import { cleanArtistName, extractSecondaryArtists } from './importUtils';

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
  sort_artist: string; // We'll generate a default here
  secondary_artists: string[];
  title: string;
  format: string;
  location: string;
  for_sale: boolean;
  year: number | null;
  media_condition: string;
  package_sleeve_condition: string;
  discogs_id: string;
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
        // 1. Clean Artist & Split Secondary
        const { primary, secondary } = extractSecondaryArtists(row['Artist'] || '');
        
        // 2. Logic: Folder -> Location/Sale
        const folder = row['CollectionFolder'] || '';
        const isSale = folder.toLowerCase() === 'sale' || folder.toLowerCase().includes('for sale');
        const location = isSale ? '' : folder;

        return {
          artist: primary,
          sort_artist: primary, // Will be refined by server-side rules later, default to primary
          secondary_artists: secondary,
          title: row['Title'] || '',
          format: row['Format'] || '',
          
          // Map Folder Logic
          location: location,
          for_sale: isSale,
          
          year: parseInt(row['Released'], 10) || null,
          media_condition: row['Collection Media Condition'] || '',
          package_sleeve_condition: row['Collection Sleeve Condition'] || '',
          
          // Map IDs
          discogs_id: row['release_id'] || '',
          
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