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
  release_id: number | string | null; // Can be number, string, or null from CSV parsing
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
  discogs_release_id: string; // String to match database schema
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
  const [debugInfo, setDebugInfo] = useState<string>('');

  // Add rate limiting for Discogs API
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const fetchDiscogsData = async (
    releaseId: string,
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
    setDebugInfo('');
    
    try {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true, // This will convert numbers properly
        complete: async (results: { data: DiscogsCSVRow[], meta: { fields?: string[] } }) => {
          console.log('CSV Headers:', results.meta.fields);
          console.log('Sample row:', results.data[0]);
          console.log('Sample release_id value:', results.data[0]?.release_id);
          console.log('Sample release_id type:', typeof results.data[0]?.release_id);
          
          setDebugInfo(`CSV Headers: ${results.meta.fields?.join(', ')}`);
          
          // Filter out rows without Release ID and log issues
          const validRows = results.data.filter((row, index) => {
            const releaseId = row.release_id;
            // Check for missing, null, undefined, empty string, or zero values
            if (!releaseId || releaseId === 0 || releaseId === '' || releaseId === null || releaseId === undefined) {
              if (index < 10) { // Only log first 10 for brevity
                console.log(`Row ${index} missing/invalid release_id:`, { 
                  catalog: row['Catalog#'], 
                  artist: row.Artist, 
                  title: row.Title,
                  release_id: releaseId,
                  release_id_type: typeof releaseId 
                });
              }
              return false;
            }
            // Also filter out non-numeric strings (we'll convert valid numbers to strings later)
            const numericValue = Number(releaseId);
            if (isNaN(numericValue) || numericValue <= 0) {
              if (index < 10) {
                console.log(`Row ${index} invalid release_id (not a positive number):`, { 
                  catalog: row['Catalog#'], 
                  artist: row.Artist, 
                  title: row.Title,
                  release_id: releaseId,
                  release_id_type: typeof releaseId,
                  numeric_value: numericValue
                });
              }
              return false;
            }
            return true;
          });
          
          console.log(`Total rows: ${results.data.length}, Valid rows: ${validRows.length}`);
          
          // Convert to the format expected by Supabase
          const processedRows: ProcessedRow[] = validRows.map(row => ({
            artist: row.Artist,
            title: row.Title,
            year: row.Released,
            format: row.Format,
            folder: row.CollectionFolder,
            media_condition: row['Collection Media Condition'],
            discogs_release_id: String(row.release_id), // Convert to string to match database
            image_url: null,
            tracklists: null
          }));

          const releaseIds = processedRows.map(r => r.discogs_release_id);
          
          console.log('Release IDs to check (converted to strings):', releaseIds.slice(0, 5)); // Log first 5 for debugging
          
          setStatus(`Checking Supabase for existing entries among ${releaseIds.length} items...`);
          
          // First, get a count of all records with discogs_release_id
          const { count: totalCount, error: countError } = await supabase
            .from('collection')
            .select('*', { count: 'exact', head: true })
            .not('discogs_release_id', 'is', null);

          if (countError) {
            console.warn('Count query failed:', countError);
          } else {
            console.log('Total records with discogs_release_id in database:', totalCount);
          }
          
          // Use pagination to get ALL existing release IDs
          let allExisting: { discogs_release_id: string }[] = [];
          let start = 0;
          const pageSize = 1000;
          let hasMore = true;

          while (hasMore) {
            const { data: pageData, error: queryError } = await supabase
              .from('collection')
              .select('discogs_release_id')
              .not('discogs_release_id', 'is', null)
              .range(start, start + pageSize - 1);

            if (queryError) {
              throw new Error(`Database query failed: ${queryError.message}`);
            }

            if (pageData && pageData.length > 0) {
              allExisting = allExisting.concat(pageData);
              start += pageSize;
              hasMore = pageData.length === pageSize; // Continue if we got a full page
              console.log(`Fetched page: ${pageData.length} records, total so far: ${allExisting.length}`);
            } else {
              hasMore = false;
            }
          }

          console.log('Total existing entries fetched from database via pagination:', allExisting.length);
          console.log('Expected around 1178, fetched:', allExisting.length, 'Count query returned:', totalCount);
          
          // Create a Set of all existing release IDs for fast lookup
          const allExistingIds = new Set(
            (allExisting || [])
              .map((r: { discogs_release_id: string }) => r.discogs_release_id)
              .filter(id => id) // Remove any null/undefined values
          );

          console.log('All existing release IDs count:', allExistingIds.size);
          
          // Debug: Check specific IDs that should be duplicates
          const testIds = ['24532220', '21975574', '2775546', '8315395', '1841179'];
          testIds.forEach(id => {
            const inDatabase = allExistingIds.has(id);
            const inCsv = releaseIds.includes(id);
            console.log(`Test ID ${id}: In database: ${inDatabase}, In CSV: ${inCsv}`);
          });
          
          // Now filter our CSV data to find only the ones that don't exist
          const existingInCsv = releaseIds.filter(id => allExistingIds.has(id));
          const newRows = processedRows.filter(row => !allExistingIds.has(row.discogs_release_id));

          console.log(`CSV analysis: ${existingInCsv.length} already exist, ${newRows.length} are new`);
          console.log('Sample existing in CSV:', existingInCsv.slice(0, 5));
          console.log('Sample new release IDs:', newRows.slice(0, 5).map(r => r.discogs_release_id));
          
          setStatus(`Found ${newRows.length} new items out of ${releaseIds.length} total. ${existingInCsv.length} already exist in database.`);
          setDebugInfo(prev => prev + `\nTotal CSV rows: ${results.data.length}, Valid rows with release_id: ${validRows.length}, New items: ${newRows.length}, Existing in DB: ${existingInCsv.length}\nTotal existing items in database: ${allExistingIds.size}\nNote: Converting release IDs to strings to match database schema`);
          
          if (validRows.length === 0) {
            setDebugInfo(prev => prev + `\nPROBLEM: No rows have valid release_id values! This suggests the Discogs export may be missing release IDs.`);
            setStatus('No rows with valid Release IDs found. Please check your Discogs CSV export includes Release IDs.');
            setIsProcessing(false);
            return;
          }

          // Show preview without enriching first
          setCsvPreview(newRows);
          setStatus(`Preview of ${newRows.length} new items ready. Click "Enrich with Discogs Data" to continue.`);
          setIsProcessing(false);
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

  const enrichAndImport = async () => {
    if (csvPreview.length === 0) return;
    
    setIsProcessing(true);
    setStatus(`Enriching ${csvPreview.length} items with Discogs data...`);

    try {
      // Enrich with Discogs data (with rate limiting)
      const enriched: EnrichedRow[] = [];
      for (let i = 0; i < csvPreview.length; i++) {
        const row = csvPreview[i];
        setStatus(`Enriching ${i + 1}/${csvPreview.length}: ${row.artist} - ${row.title}`);
        
        const { image_url, tracklists } = await fetchDiscogsData(row.discogs_release_id);
        enriched.push({ ...row, image_url, tracklists });
        
        // Rate limiting: wait 1 second between requests
        if (i < csvPreview.length - 1) {
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
    } catch (error) {
      console.error('Enrichment error:', error);
      setStatus(`Enrichment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
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
      
      {csvPreview.length > 0 && !isProcessing && (
        <button 
          onClick={enrichAndImport}
          style={{ 
            marginLeft: '1rem', 
            padding: '0.5rem 1rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Enrich with Discogs Data & Import
        </button>
      )}
      
      <p style={{ 
        color: status.includes('error') || status.includes('failed') ? 'red' : 'black',
        fontWeight: status.includes('Successfully') ? 'bold' : 'normal'
      }}>
        {status}
      </p>

      {debugInfo && (
        <details style={{ marginTop: '1rem', fontSize: '0.9em', color: '#666' }}>
          <summary>Debug Info</summary>
          <pre>{debugInfo}</pre>
        </details>
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