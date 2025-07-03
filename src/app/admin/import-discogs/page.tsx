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
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const addDebug = (message: string) => {
    console.log(message);
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setStatus('Parsing CSV...');
    setDebugInfo([]);
    setCsvPreview([]);
    
    try {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true, // This will convert numbers properly
        complete: async (results: { data: DiscogsCSVRow[] }) => {
          try {
            addDebug(`Parsed ${results.data.length} rows from CSV`);
            
            const rows = results.data.filter(row => row.release_id);
            addDebug(`Filtered to ${rows.length} rows with release_id`);
            
            if (rows.length === 0) {
              setStatus('No valid rows found in CSV');
              setIsProcessing(false);
              return;
            }

            // Log sample data for debugging
            addDebug(`Sample row: ${JSON.stringify(rows[0])}`);
            addDebug(`First 5 release_ids: ${rows.slice(0, 5).map(r => r.release_id).join(', ')}`);
            
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

            addDebug(`Processed ${processedRows.length} rows`);
            addDebug(`Sample processed row: ${JSON.stringify(processedRows[0])}`);

            const releaseIds = processedRows.map(r => r.discogs_release_id);
            addDebug(`Release IDs to check: ${releaseIds.slice(0, 5).join(', ')}...`);
            
            setStatus(`Checking Supabase for existing entries among ${releaseIds.length} items...`);
            
            // Check for existing entries
            const { data: existing, error: queryError } = await supabase
              .from('collection')
              .select('discogs_release_id')
              .in('discogs_release_id', releaseIds);

            if (queryError) {
              addDebug(`Database query error: ${queryError.message}`);
              throw new Error(`Database query failed: ${queryError.message}`);
            }

            addDebug(`Found ${existing?.length || 0} existing entries in database`);
            if (existing && existing.length > 0) {
              addDebug(`Sample existing IDs: ${existing.slice(0, 5).map(r => r.discogs_release_id).join(', ')}`);
            }

            const existingIds = new Set(
              (existing || []).map((r: { discogs_release_id: number }) => r.discogs_release_id)
            );
            
            const newRows = processedRows.filter(
              (r: ProcessedRow) => !existingIds.has(r.discogs_release_id)
            );

            addDebug(`Found ${newRows.length} new items (${existingIds.size} duplicates filtered out)`);
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
            addDebug(`Starting enrichment for ${newRows.length} items`);

            // Enrich with Discogs data via existing proxy route
            const enriched: EnrichedRow[] = [];
            
            for (let i = 0; i < newRows.length; i++) {
              const row = newRows[i];
              setStatus(`Enriching ${i + 1}/${newRows.length}: ${row.artist} - ${row.title}`);
              addDebug(`Enriching release ID: ${row.discogs_release_id}`);
              
              try {
                const response = await fetch(`/api/discogsProxy?releaseId=${row.discogs_release_id}`);
                
                if (!response.ok) {
                  addDebug(`Failed to fetch release ${row.discogs_release_id}, status: ${response.status}`);
                  enriched.push({
                    ...row,
                    image_url: null,
                    tracklists: null
                  });
                  continue;
                }
                
                const data = await response.json();
                
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
                
                enriched.push({
                  ...row,
                  image_url: data.images?.[0]?.uri || null,
                  tracklists: tracklistsStr
                });
                
                addDebug(`Successfully enriched ${row.artist} - ${row.title}`);
                
                // Rate limiting: wait 1 second between requests
                if (i < newRows.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
              } catch (error) {
                addDebug(`Error enriching release ${row.discogs_release_id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                enriched.push({
                  ...row,
                  image_url: null,
                  tracklists: null
                });
              }
            }

            setCsvPreview(enriched);
            setStatus('Inserting into Supabase...');
            addDebug(`Inserting ${enriched.length} enriched items into database`);
            
            // Insert into database
            const { error: insertError } = await supabase
              .from('collection')
              .insert(enriched);

            if (insertError) {
              addDebug(`Database insert error: ${insertError.message}`);
              throw new Error(`Database insert failed: ${insertError.message}`);
            }

            addDebug(`Successfully inserted ${enriched.length} items`);
            setStatus(`Successfully imported ${enriched.length} new items!`);

          } catch (error) {
            console.error('Processing error:', error);
            addDebug(`Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setStatus(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          } finally {
            setIsProcessing(false);
          }
        },
        error: (error: Error) => {
          addDebug(`CSV parsing error: ${error.message}`);
          setStatus(`CSV parsing error: ${error.message}`);
          setIsProcessing(false);
        }
      });
    } catch (error) {
      console.error('File processing error:', error);
      addDebug(`File processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStatus(`File processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

      {debugInfo.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h3>Debug Information:</h3>
          <div style={{ 
            maxHeight: '200px', 
            overflowY: 'auto', 
            backgroundColor: '#f5f5f5', 
            padding: '10px', 
            fontSize: '12px',
            fontFamily: 'monospace'
          }}>
            {debugInfo.map((info, i) => (
              <div key={i}>{info}</div>
            ))}
          </div>
        </div>
      )}

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
              {csvPreview.slice(0, 10).map((row, i) => (
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
              {csvPreview.length > 10 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', fontStyle: 'italic' }}>
                    ... and {csvPreview.length - 10} more items
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}