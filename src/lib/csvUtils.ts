import Papa from 'papaparse';

export interface DiscogsCSVRow {
  Artist: string;
  Title: string;
  Format: string;
  Folder: string;
  Year: string;
  'Media Condition': string;
  'External Images': string;
  Notes: string;
  [key: string]: string; // Allow for other columns
}

export interface ProcessedRelease {
  artist: string;
  title: string;
  format: string;
  folder: string;
  year: number | null;
  media_condition: string;
  image_url: string;
  notes: string;
}

// 🛠 Extract, normalize fields
export function parseDiscogsCSV(file: File, callback: (rows: ProcessedRelease[]) => void): void {
  Papa.parse<DiscogsCSVRow>(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const rows = results.data.map((row) => ({
        artist: row['Artist'],
        title: row['Title'],
        format: row['Format'],
        folder: row['Folder'],
        year: parseInt(row['Year'], 10) || null,
        media_condition: row['Media Condition'],
        image_url: row['External Images'] || '',
        notes: row['Notes'],
      }));
      callback(rows);
    },
    error: (err: Error) => {
      console.error('CSV parse error:', err);
      callback([]);
    }
  });
}