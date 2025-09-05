'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { supabase } from 'src/lib/supabaseClient';

// Updated type to match actual Discogs CSV export structure
type DiscogsCSVRow = {
  'Catalog#': string;
  Artist: string;
  Title: string;
  Label: string;
  Format: string;
  Rating: string | null;
  Released: number;
  release_id: number | string | null;
  CollectionFolder: string;
  'Date Added': string;
  'Collection Media Condition': string;
  'Collection Sleeve Condition': string;
  'Collection Notes': string | null;
};

type ProcessedRow = {
  artist: string;
  title: string;
  year: number;
  format: string;
  folder: string;
  media_condition: string;
  discogs_release_id: string;
  date_added: string;
  image_url: string | null;
  tracklists: string | null;
};

type EnrichedRow = ProcessedRow & {
  image_url: string | null;
  tracklists: string | null;
};

function parseDiscogsDate(dateString: string): string {
  if (!dateString || dateString.trim() === '') {
    return new Date().toISOString();
  }
  
  try {
    const parsed = new Date(dateString);
    if (isNaN(parsed.getTime())) {
      return new Date().toISOString();
    }
    return parsed.toISOString();
  } catch (error) {
    console.warn('Failed to parse Discogs date:', dateString, error);
    return new Date().toISOString();
  }
}

export default function ImportDiscogsPage() {
  const [csvPreview, setCsvPreview] = useState<EnrichedRow[]>([]);
  const [status, setStatus] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // FIXED: Use existing discogsProxy endpoint instead of direct fetch
  const fetchDiscogsData = async (
    releaseId: string,
    retries = 3
  ): Promise<{ image_url: string | null; tracklists: string | null }> => {
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // Add delay to respect rate limits
        if (attempt > 0) await delay(1000);
        
        // Use the existing proxy endpoint that handles CORS properly
        const res = await fetch(`/api/discogsProxy?releaseId=${releaseId}`);
        
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
        dynamicTyping: true,
        complete: async (results: { data: DiscogsCSVRow[], meta: { fields?: string[] } }) => {
          console.log('CSV Headers:', results.meta.fields);
          console.log('Sample row:', results.data[0]);
          console.log('Sample release_id value:', results.data[0]?.release_id);
          console.log('Sample release_id type:', typeof results.data[0]?.release_id);
          
          setDebugInfo(`CSV Headers: ${results.meta.fields?.join(', ')}`);
          
          // Filter out rows without Release ID and log issues
          const validRows = results.data.filter((row, index) => {
            const releaseId = row.release_id;
            if (!releaseId || releaseId === 0 || releaseId === '' || releaseId === null || releaseId === undefined) {
              if (index < 10) {
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
            discogs_release_id: String(row.release_id),
            date_added: parseDiscogsDate(row['Date Added']),
            image_url: null,
            tracklists: null
          }));

          const releaseIds = processedRows.map(r => r.discogs_release_id);
          
          console.log('Release IDs to check (converted to strings):', releaseIds.slice(0, 5));
          
          setStatus(`Checking Supabase for existing entries among ${releaseIds.length} items...`);
          
          // Get existing release IDs using pagination
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
              hasMore = pageData.length === pageSize;
              console.log(`Fetched page: ${pageData.length} records, total so far: ${allExisting.length}`);
            } else {
              hasMore = false;
            }
          }

          console.log('Total existing entries fetched from database via pagination:', allExisting.length);
          
          // Create a Set of all existing release IDs for fast lookup
          const allExistingIds = new Set(
            (allExisting || [])
              .map((r: { discogs_release_id: string }) => r.discogs_release_id)
              .filter(id => id)
          );

          console.log('All existing release IDs count:', allExistingIds.size);
          
          const existingInCsv = releaseIds.filter(id => allExistingIds.has(id));
          const newRows = processedRows.filter(row => !allExistingIds.has(row.discogs_release_id));

          console.log(`CSV analysis: ${existingInCsv.length} already exist, ${newRows.length} are new`);
          console.log('Sample existing in CSV:', existingInCsv.slice(0, 5));
          console.log('Sample new release IDs:', newRows.slice(0, 5).map(r => r.discogs_release_id));
          
          setStatus(`Found ${newRows.length} new items out of ${releaseIds.length} total. ${existingInCsv.length} already exist in database.`);
          setDebugInfo(prev => prev + `\nTotal CSV rows: ${results.data.length}, Valid rows with release_id: ${validRows.length}, New items: ${newRows.length}, Existing in DB: ${existingInCsv.length}\nTotal existing items in database: ${allExistingIds.size}\nNote: Using proxy endpoint to avoid CORS issues`);
          
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
    setStatus(`Starting enrichment process for ${csvPreview.length} items...`);

    try {
      // Enrich with Discogs data (with rate limiting)
      const enriched: EnrichedRow[] = [];
      for (let i = 0; i < csvPreview.length; i++) {
        const row = csvPreview[i];
        setStatus(`Enriching ${i + 1}/${csvPreview.length}: ${row.artist} - ${row.title}`);
        
        try {
          const { image_url, tracklists } = await fetchDiscogsData(row.discogs_release_id);
          enriched.push({ ...row, image_url, tracklists });
        } catch (error) {
          console.warn(`Failed to enrich ${row.discogs_release_id}:`, error);
          enriched.push({ ...row, image_url: null, tracklists: null });
        }
        
        // Rate limiting: wait 1 second between requests
        if (i < csvPreview.length - 1) {
          await delay(1000);
        }
      }

      setCsvPreview(enriched);
      setStatus('Processing database operations...');
      
      // Check for existing items again
      const { data: existingItems, error: existingError } = await supabase
        .from('collection')
        .select('discogs_release_id, date_added')
        .in('discogs_release_id', enriched.map(r => r.discogs_release_id));
      
      if (existingError) {
        throw new Error(`Failed to check existing items: ${existingError.message}`);
      }
      
      const existingMap = new Map(
        (existingItems || []).map(item => [item.discogs_release_id, item.date_added])
      );
      
      const newItems = enriched.filter(row => !existingMap.has(row.discogs_release_id));
      const updateItems = enriched.filter(row => {
        const dateAdded = existingMap.get(row.discogs_release_id);
        return existingMap.has(row.discogs_release_id) && !dateAdded;
      });
      
      let insertCount = 0;
      let updateCount = 0;
      
      // Insert new items
      if (newItems.length > 0) {
        const { error: insertError } = await supabase
          .from('collection')
          .insert(newItems);

        if (insertError) {
          throw new Error(`Database insert failed: ${insertError.message}`);
        }
        insertCount = newItems.length;
      }
      
      // Update existing items with date_added
      for (const item of updateItems) {
        const { error: updateError } = await supabase
          .from('collection')
          .update({ 
            date_added: item.date_added,
            image_url: item.image_url,
            tracklists: item.tracklists
          })
          .eq('discogs_release_id', item.discogs_release_id);
        
        if (updateError) {
          console.warn(`Failed to update ${item.discogs_release_id}:`, updateError);
        } else {
          updateCount++;
        }
      }

      setStatus(`✅ Successfully processed ${enriched.length} items: ${insertCount} new inserts, ${updateCount} updates with date_added!`);
    } catch (error) {
      console.error('Processing error:', error);
      setStatus(`❌ Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      
      {csvPreview.length > 0 && (
        <button 
          onClick={enrichAndImport}
          disabled={isProcessing}
          style={{ 
            marginLeft: '1rem', 
            padding: '0.5rem 1rem',
            backgroundColor: isProcessing ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            opacity: isProcessing ? 0.6 : 1
          }}
        >
          {isProcessing ? 'Processing...' : 'Enrich with Discogs Data & Import'}
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
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.image_url}
                        alt={`${row.artist} - ${row.title}`}
                        width={50}
                        height={50}
                        style={{ objectFit: 'cover' }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
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