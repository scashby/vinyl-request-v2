'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { supabase } from 'lib/supabaseClient';
import Image from 'next/image';

// Updated type to match actual Discogs CSV export structure
type DiscogsCSVRow = {
  'Catalog#': string;
  Artist: string;
  Title: string;
  Label: string;
  Format: string;
  Rating: string | null;
  Released: number;
  release_id: number; // This is the correct field name from Discogs export
  CollectionFolder: string;
  'Date Added': string;
  'Collection Media Condition': string;
  'Collection Sleeve Condition': string;
  'Collection Notes': string | null;
};

// Type for the processed row that will go to Supabase
type ProcessedRow = {
  artist: string;
  title: string;
  year: number;
  format: string;
  folder: string;
  media_condition: string;
  discogs_release_id: number; // Supabase expects this field name
  image_url: string | null;
  tracklists: string | null;
};

type EnrichedRow = ProcessedRow & {
  image_url: string | null;
  tracklists: string | null;
};

export default function ImportDiscogsPage() {
  const [csvPreview, setCsvPreview] = useState<EnrichedRow[]>([]);
  const [status, setStatus] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Add rate limiting for Discogs API
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const fetchDiscogsData = async (
    releaseId: number,
    retries = 3
  ): Promise<{ image_url: string | null; tracklists: string | null }> => {
    const url = `https://api.discogs.com/releases/${releaseId}`;
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // Add delay to respect rate limits (1 request per second for free accounts)
        if (attempt > 0) await delay(1000);
        
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'DeadwaxDialogues/1.0 +https://yourwebsite.com', // Replace with your actual website
            'Authorization': `Discogs token=${process.env.NEXT_PUBLIC_DISCOGS_TOKEN}`
          }
        });
        
        if (res.status === 429) {
          // Rate limited, wait longer
          await delay(2000);
          continue;
        }
        
        if (!res.ok) {
          console.warn(`Failed to fetch release ${releaseId}, status: ${res.status}`);
          return { image_url: null, tracklists: null };
        }
        
        const data = await res.json();
        
        // Process tracklist - store as JSON string for Supabase
        let tracklistsStr = null;
        if (Array.isArray(data.tracklist) && data.tracklist.length > 0) {
          tracklistsStr = JSON.stringify(data.tracklist.map((track: {
            position?: string;
            type_?: string;
            title?: string;
            duration?: string;
          }) => ({
            position: track.position || '',
            type_: track.type_ || 'track',
            title: track.title || '',
            duration: track.duration || ''
          })));
        }
        
        return {
          image_url: data.images?.[0]?.uri || null,
          tracklists: tracklistsStr
        };
      } catch (error) {
        console.warn(`Attempt ${attempt + 1} failed for release ${releaseId}:`, error);
        if (attempt === retries - 1) {
          return { image_url: null, tracklists: null };
        }
        await delay(1000);
      }
    }
    
    return { image_url: null, tracklists: null };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setStatus('Parsing CSV...');
    
    try {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true, // This will convert numbers properly
        complete: async (results: { data: DiscogsCSVRow[] }) => {
          const rows = results.data.filter(row => row.release_id); // Filter out rows without release_id
          
          // Convert to the format expected by Supabase
          const processedRows: ProcessedRow[] = rows.map(row => ({
            artist: row.Artist,
            title: row.Title,
            year: row.Released,
            format: row.Format,
            folder: row.CollectionFolder,
            media_condition: row['Collection Media Condition'],
            discogs_release_id: row.release_id, // Map release_id to discogs_release_id
            image_url: null,
            tracklists: null
          }));

          const releaseIds = processedRows.map(r => r.discogs_release_id);
          
          setStatus(`Checking Supabase for existing entries among ${releaseIds.length} items...`);
          
          // Check for existing entries
          const { data: existing, error: queryError } = await supabase
            .from('collection')
            .select('discogs_release_id')
            .in('discogs_release_id', releaseIds);

          if (queryError) {
            throw new Error(`Database query failed: ${queryError.message}`);
          }

          const existingIds = new Set(
            (existing || []).map((r: { discogs_release_id: number }) => r.discogs_release_id)
          );
          
          const newRows = processedRows.filter(
            (r: ProcessedRow) => !existingIds.has(r.discogs_release_id)
          );

          setStatus(`Found ${newRows.length} new items out of ${releaseIds.length} total. ${existingIds.size} already exist.`);
          
          if (newRows.length === 0) {
            setStatus('No new items to import.');
            setCsvPreview([]);
            setIsProcessing(false);
            return;
          }

          // Show preview before enriching
          setCsvPreview(newRows);
          setStatus(`Enriching ${newRows.length} new items with Discogs data...`);

          // Enrich with Discogs data (with rate limiting)
          const enriched: EnrichedRow[] = [];
          for (let i = 0; i < newRows.length; i++) {
            const row = newRows[i];
            setStatus(`Enriching ${i + 1}/${newRows.length}: ${row.artist} - ${row.title}`);
            
            const { image_url, tracklists } = await fetchDiscogsData(row.discogs_release_id);
            enriched.push({ ...row, image_url, tracklists });
            
            // Rate limiting: wait 1 second between requests
            if (i < newRows.length - 1) {
              await delay(1000);
            }
          }

          setCsvPreview(enriched);
          setStatus('Inserting into Supabase...');
          
          // Insert into database
          const { error: insertError } = await supabase
            .from('collection')
            .insert(enriched);

          if (insertError) {
            throw new Error(`Database insert failed: ${insertError.message}`);
          }

          setStatus(`Successfully imported ${enriched.length} new items!`);
        },
        error: (error: Error) => {
          setStatus(`CSV parsing error: ${error.message}`);
          setIsProcessing(false);
        }
      });
    } catch (error) {
      console.error('Import error:', error);
      setStatus(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Import Discogs CSV</h1>
      <input 
        type="file" 
        accept=".csv" 
        onChange={handleFileUpload} 
        disabled={isProcessing}
      />
      <p style={{ 
        color: status.includes('error') || status.includes('failed') ? 'red' : 'black',
        fontWeight: status.includes('Successfully') ? 'bold' : 'normal'
      }}>
        {status}
      </p>

      {csvPreview.length > 0 && (
        <div>
          <h2>Preview ({csvPreview.length} items)</h2>
          <table border={1} cellPadding={4} style={{ marginTop: '1rem' }}>
            <thead>
              <tr>
                <th>Artist</th>
                <th>Title</th>
                <th>Year</th>
                <th>Format</th>
                <th>Folder</th>
                <th>Media Condition</th>
                <th>Release ID</th>
                <th>Image</th>
                <th>Tracklist Status</th>
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
                  <td>
                    {row.tracklists ? (
                      `${JSON.parse(row.tracklists).length} tracks`
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}