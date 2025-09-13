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
  date_added: string;
  image_url: string | null;
  tracklists: string | null;
};

type EnrichedRow = ProcessedRow & {
  image_url: string | null;
  tracklists: string | null;
};

type UpdateItem = {
  csvRow: ProcessedRow;
  existingRow: {
    discogs_release_id: string;
    date_added: string | null;
    folder: string | null;
    media_condition: string | null;
    image_url: string | null;
    id: number;
  };
};

type RemovalItem = {
  discogs_release_id: string;
  date_added: string | null;
  folder: string | null;
  media_condition: string | null;
  image_url: string | null;
  id: number;
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
          setDebugInfo(`CSV Headers: ${results.meta.fields?.join(', ')}`);
          
          // Filter out rows without Release ID
          const validRows = results.data.filter((row) => {
            const releaseId = row.release_id;
            if (!releaseId || releaseId === 0 || releaseId === '' || releaseId === null || releaseId === undefined) {
              return false;
            }
            const numericValue = Number(releaseId);
            if (isNaN(numericValue) || numericValue <= 0) {
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
            date_added: parseDiscogsDate(row['Date Added']),
            image_url: null,
            tracklists: null
          }));

          const releaseIds = processedRows.map(r => r.discogs_release_id);
          
          setStatus(`Checking Supabase for existing entries among ${releaseIds.length} items...`);
          
          // Use pagination to get ALL existing entries with folder and media_condition for change detection
          let allExisting: Array<{ 
            discogs_release_id: string; 
            date_added: string | null; 
            folder: string | null; 
            media_condition: string | null; 
            image_url: string | null; 
            id: number 
          }> = [];
          let start = 0;
          const pageSize = 1000;
          let hasMore = true;

          while (hasMore) {
            const { data: pageData, error: queryError } = await supabase
              .from('collection')
              .select('id, discogs_release_id, date_added, folder, media_condition, image_url')
              .not('discogs_release_id', 'is', null)
              .range(start, start + pageSize - 1);

            if (queryError) {
              throw new Error(`Database query failed: ${queryError.message}`);
            }

            if (pageData && pageData.length > 0) {
              allExisting = allExisting.concat(pageData);
              start += pageSize;
              hasMore = pageData.length === pageSize; // Continue if we got a full page
            } else {
              hasMore = false;
            }
          }

          console.log('Total existing entries fetched from database:', allExisting.length);
          
          // Create maps for lookups
          const existingMap = new Map(
            allExisting.map(item => [item.discogs_release_id, item])
          );
          const csvMap = new Map(
            processedRows.map(row => [row.discogs_release_id, row])
          );
          
          // Categorize items
          const newRows = processedRows.filter(row => !existingMap.has(row.discogs_release_id));
          
          const updateItems: UpdateItem[] = processedRows.filter(row => {
            const existing = existingMap.get(row.discogs_release_id);
            if (!existing) return false;
            
            // Check for changes in folder or media condition
            const folderChanged = row.folder !== existing.folder;
            const conditionChanged = row.media_condition !== existing.media_condition;
            const needsImage = !existing.image_url;
            
            return folderChanged || conditionChanged || needsImage;
          }).map(row => {
            const existing = existingMap.get(row.discogs_release_id)!;
            const folderChanged = row.folder !== existing.folder;
            const conditionChanged = row.media_condition !== existing.media_condition;
            
            if (folderChanged || conditionChanged) {
              console.log(`Change detected for ${row.artist} - ${row.title}:`, {
                folderChange: folderChanged ? `${existing.folder} → ${row.folder}` : 'no change',
                conditionChange: conditionChanged ? `${existing.media_condition} → ${row.media_condition}` : 'no change',
                needsImage: !existing.image_url
              });
            }
            
            return { csvRow: row, existingRow: existing };
          });
          
          // Find items to remove (in database but not in CSV)
          const itemsToRemove: RemovalItem[] = allExisting.filter(existing => !csvMap.has(existing.discogs_release_id));
          
          setStatus(`Found ${newRows.length} new items, ${updateItems.length} items to update, ${itemsToRemove.length} items to remove`);
          setDebugInfo(prev => prev + `\nNew: ${newRows.length}, Updates: ${updateItems.length}, Removals: ${itemsToRemove.length}`);
          
          if (validRows.length === 0) {
            setDebugInfo(prev => prev + `\nPROBLEM: No rows have valid release_id values!`);
            setStatus('No rows with valid Release IDs found. Please check your Discogs CSV export includes Release IDs.');
            setIsProcessing(false);
            return;
          }

          // Store the update and removal data for later use
          (window as { updateItems?: UpdateItem[]; itemsToRemove?: RemovalItem[] }).updateItems = updateItems;
          (window as { updateItems?: UpdateItem[]; itemsToRemove?: RemovalItem[] }).itemsToRemove = itemsToRemove;
          
          // Show preview of new items (keeping your original preview behavior)
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
    const BATCH_SIZE = 50;
    const totalItems = csvPreview.length;
    const updateItems = (window as { updateItems?: UpdateItem[] }).updateItems || [];
    const itemsToRemove = (window as { itemsToRemove?: RemovalItem[] }).itemsToRemove || [];
    let allEnriched: EnrichedRow[] = [];
    
    setStatus(`Starting import process: ${totalItems} new items, ${updateItems.length} updates, ${itemsToRemove.length} removals`);

    try {
      // Process new items (your original logic)
      for (let batchStart = 0; batchStart < totalItems; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, totalItems);
        const currentBatch = csvPreview.slice(batchStart, batchEnd);
        const batchNumber = Math.floor(batchStart / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(totalItems / BATCH_SIZE);
        
        setStatus(`Processing new items batch ${batchNumber}/${totalBatches}...`);
        
        // Enrich current batch
        const batchEnriched: EnrichedRow[] = [];
        for (let i = 0; i < currentBatch.length; i++) {
          const row = currentBatch[i];
          const globalIndex = batchStart + i + 1;
          setStatus(`Batch ${batchNumber}: Enriching ${globalIndex}/${totalItems}: ${row.artist} - ${row.title}`);
          
          try {
            const { image_url, tracklists } = await fetchDiscogsData(row.discogs_release_id);
            batchEnriched.push({ ...row, image_url, tracklists });
          } catch (error) {
            console.warn(`Failed to enrich ${row.discogs_release_id}:`, error);
            batchEnriched.push({ ...row, image_url: null, tracklists: null });
          }
          
          if (i < currentBatch.length - 1) {
            await delay(2000);
          }
        }
        
        // Insert new items
        if (batchEnriched.length > 0) {
          const { error: insertError } = await supabase
            .from('collection')
            .insert(batchEnriched);

          if (insertError) {
            console.warn(`Insert failed for batch ${batchNumber}:`, insertError);
          }
        }
        
        allEnriched = allEnriched.concat(batchEnriched);
        setCsvPreview(allEnriched);
        
        if (batchEnd < totalItems) {
          await delay(10000);
        }
      }
      
      // Process updates
      if (updateItems.length > 0) {
        setStatus(`Processing ${updateItems.length} updates...`);
        
        for (let i = 0; i < updateItems.length; i++) {
          const { csvRow, existingRow } = updateItems[i];
          setStatus(`Updating ${i + 1}/${updateItems.length}: ${csvRow.artist} - ${csvRow.title}`);
          
          let image_url = existingRow.image_url;
          let tracklists = null;
          
          // Fetch missing image if needed
          if (!image_url) {
            try {
              const discogsData = await fetchDiscogsData(csvRow.discogs_release_id);
              image_url = discogsData.image_url;
              tracklists = discogsData.tracklists;
              await delay(2000);
            } catch (error) {
              console.warn(`Failed to enrich ${csvRow.discogs_release_id}:`, error);
            }
          }
          
          const { error: updateError } = await supabase
            .from('collection')
            .update({
              folder: csvRow.folder,
              media_condition: csvRow.media_condition,
              image_url: image_url,
              tracklists: tracklists
            })
            .eq('id', existingRow.id);

          if (updateError) {
            console.warn(`Failed to update ${csvRow.discogs_release_id}:`, updateError);
          }
        }
      }
      
      // Process removals
      if (itemsToRemove.length > 0) {
        setStatus(`Removing ${itemsToRemove.length} deleted items...`);
        
        const idsToDelete = itemsToRemove.map(item => item.id);
        const { error: deleteError } = await supabase
          .from('collection')
          .delete()
          .in('id', idsToDelete);

        if (deleteError) {
          console.warn('Failed to delete items:', deleteError);
        }
      }
      
      const totalChanges = allEnriched.length + updateItems.length + itemsToRemove.length;
      setStatus(`✅ All processing complete! ${allEnriched.length} new items, ${updateItems.length} updates, ${itemsToRemove.length} removals. Total: ${totalChanges} changes.`);
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