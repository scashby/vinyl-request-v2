'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { supabase } from 'lib/supabaseClient';
import Image from 'next/image';

type CsvRow = {
  artist: string;
  title: string;
  year: string;
  format: string;
  folder: string;
  media_condition: string;
  discogs_release_id: string;
};

type EnrichedRow = CsvRow & {
  image_url: string | null;
  tracklists: string[] | null;
};

export default function ImportDiscogsPage() {
  const [csvPreview, setCsvPreview] = useState<EnrichedRow[]>([]);
  const [status, setStatus] = useState<string>('');

  const fetchDiscogsData = async (
    releaseId: string
  ): Promise<{ image_url: string | null; tracklists: string[] | null }> => {
    const url = `https://api.discogs.com/releases/${releaseId}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();
      return {
        image_url: data.images?.[0]?.uri || null,
        tracklists: Array.isArray(data.tracklist)
          ? data.tracklist.map((t: { title: string }) => t.title)
          : null,
      };
    } catch {
      return { image_url: null, tracklists: null };
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('Parsing CSV...');
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: { data: CsvRow[] }) => {
        const rows = results.data;
        const ids = rows.map((r: CsvRow) => r.discogs_release_id).filter(Boolean);

        setStatus('Checking Supabase for existing entries...');
        const { data: existing } = await supabase
          .from('collection')
          .select('discogs_release_id')
          .in('discogs_release_id', ids);

        const existingIds = new Set(
          (existing || []).map((r: { discogs_release_id: string }) => r.discogs_release_id)
        );
        const newRows: CsvRow[] = rows.filter(
          (r: CsvRow) => !existingIds.has(r.discogs_release_id)
        );

        setStatus(`Found ${newRows.length} new items. Enriching...`);

        const enriched: EnrichedRow[] = await Promise.all(
          newRows.map(async (row: CsvRow) => {
            const { image_url, tracklists } = await fetchDiscogsData(row.discogs_release_id);
            return { ...row, image_url, tracklists };
          })
        );

        setCsvPreview(enriched);
        setStatus('Inserting into Supabase...');
        await supabase.from('collection').insert(enriched);
        setStatus('Upload complete.');
      },
    });
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Import Discogs CSV</h1>
      <input type="file" accept=".csv" onChange={handleFileUpload} />
      <p>{status}</p>

      {csvPreview.length > 0 && (
        <table border={1} cellPadding={4}>
          <thead>
            <tr>
              <th>Artist</th>
              <th>Title</th>
              <th>Year</th>
              <th>Format</th>
              <th>Folder</th>
              <th>Media</th>
              <th>Release ID</th>
              <th>Image</th>
              <th>Tracklist</th>
            </tr>
          </thead>
          <tbody>
            {csvPreview.map((row, i) => (
              <tr key={i}>
                <td>{row.artist}</td>
                <td>{row.title}</td>
                <td>{row.year}</td>
                <td>{row.format}</td>
                <td>{row.folder}</td>
                <td>{row.media_condition}</td>
                <td>{row.discogs_release_id}</td>
                <td>
                  {row.image_url ? (
                    <Image
                      src={row.image_url}
                      alt=""
                      width={50}
                      height={50}
                      style={{ objectFit: 'cover' }}
                    />
                  ) : (
                    '—'
                  )}
                </td>
                <td>{row.tracklists?.join(', ') ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
