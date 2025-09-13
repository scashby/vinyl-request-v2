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

// Type for existing database records
type ExistingRecord = {
  id: number;
  discogs_release_id: string;
  date_added: string | null;
  folder: string | null;
  media_condition: string | null;
  image_url: string | null;
};

// Type for update operations
type UpdateOperation = {
  csvRow: ProcessedRow;
  existingRecord: ExistingRecord;
};

// Type for sync data storage
interface SyncDataStorage {
  updateOperations?: UpdateOperation[];
  recordsToRemove?: ExistingRecord[];
}

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
            date_added: parseDiscogsDate(row['Date Added']),
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
          
          // Use pagination to get ALL existing release IDs with additional fields for change detection
          let allExisting: ExistingRecord[] = [];
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
              allExisting = allExisting.concat(pageData as ExistingRecord[]);
              start += pageSize;
              hasMore = pageData.length === pageSize; // Continue if we got a full page
              console.log(`Fetched page: ${pageData.length} records, total so far: ${allExisting.length}`);
            } else {
              hasMore = false;
            }
          }

          console.log('Total existing entries fetched from database via pagination:', allExisting.length);
          
          // Create lookup maps
          const allExistingIds = new Set(
            allExisting.map(r => r.discogs_release_id).filter(id => id)
          );
          const existingRecordsMap = new Map(
            allExisting.map(record => [record.discogs_release_id, record])
          );
          const csvRecordsMap = new Map(
            processedRows.map(row => [row.discogs_release_id, row])
          );

          console.log('All existing release IDs count:', allExistingIds.size);
          
          // Categorize items
          const existingInCsv = releaseIds.filter(id => allExistingIds.has(id));
          const newRows = processedRows.filter(row => !allExistingIds.has(row.discogs_release_id));

          // Find items that need updates (folder/condition changes or missing images)
          const updateOperations: UpdateOperation[] = [];
          for (const csvRow of processedRows) {
            const existingRecord = existingRecordsMap.get(csvRow.discogs_release_id);
            if (existingRecord) {
              const folderChanged = csvRow.folder !== existingRecord.folder;
              const conditionChanged = csvRow.media_condition !== existingRecord.media_condition;
              const needsImage = !existingRecord.image_url;
              
              if (folderChanged || conditionChanged || needsImage) {
                updateOperations.push({ csvRow, existingRecord });
                
                if (folderChanged || conditionChanged) {
                  console.log('Change detected:', {
                    releaseId: csvRow.discogs_release_id,
                    artist: csvRow.artist,
                    title: csvRow.title,
                    folderChange: folderChanged ? `${existingRecord.folder} → ${csvRow.folder}` : 'no change',
                    conditionChange: conditionChanged ? `${existingRecord.media_condition} → ${csvRow.media_condition}` : 'no change',
                    needsImage: needsImage
                  });
                }
              }
            }
          }
          
          // Find items to remove (in database but not in current CSV)
          const recordsToRemove: ExistingRecord[] = allExisting.filter(
            existingRecord => !csvRecordsMap.has(existingRecord.discogs_release_id)
          );

          console.log(`CSV analysis: ${existingInCsv.length} already exist, ${newRows.length} are new, ${updateOperations.length} need updates, ${recordsToRemove.length} to remove`);
          console.log('Sample existing in CSV:', existingInCsv.slice(0, 5));
          console.log('Sample new release IDs:', newRows.slice(0, 5).map(r => r.discogs_release_id));
          
          setStatus(`Found ${newRows.length} new items, ${updateOperations.length} items to update, ${recordsToRemove.length} items to remove`);
          setDebugInfo(prev => prev + `\nTotal CSV rows: ${results.data.length}, Valid rows with release_id: ${validRows.length}, New items: ${newRows.length}, Updates: ${updateOperations.length}, Removals: ${recordsToRemove.length}\nTotal existing items in database: ${allExistingIds.size}\nNote: Converting release IDs to strings to match database schema`);
          
          if (validRows.length === 0) {
            setDebugInfo(prev => prev + `\nPROBLEM: No rows have valid release_id values! This suggests the Discogs export may be missing release IDs.`);
            setStatus('No rows with valid Release IDs found. Please check your Discogs CSV export includes Release IDs.');
            setIsProcessing(false);
            return;
          }

          // Store sync data for enrichAndImport function
          (window as Window & SyncDataStorage).updateOperations = updateOperations;
          (window as Window & SyncDataStorage).recordsToRemove = recordsToRemove;

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
    const BATCH_SIZE = 50; // Process 50 items at a time
    const totalItems = csvPreview.length;
    let allEnriched: EnrichedRow[] = [];
    
    // Get stored sync data
    const updateOperations = (window as Window & SyncDataStorage).updateOperations || [];
    const recordsToRemove = (window as Window & SyncDataStorage).recordsToRemove || [];
    
    setStatus(`Starting enrichment process for ${totalItems} new items, ${updateOperations.length} updates, ${recordsToRemove.length} removals`);

    try {
      // Process new items in batches (your original logic)
      for (let batchStart = 0; batchStart < totalItems; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, totalItems);
        const currentBatch = csvPreview.slice(batchStart, batchEnd);
        const batchNumber = Math.floor(batchStart / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(totalItems / BATCH_SIZE);
        
        setStatus(`Processing batch ${batchNumber}/${totalBatches} (items ${batchStart + 1}-${batchEnd})...`);
        
        // Enrich current batch
        const batchEnriched: EnrichedRow[] = [];
        for (let i = 0; i < currentBatch.length; i++) {
          const row = currentBatch[i];
          const globalIndex = batchStart + i + 1;
          setStatus(`Batch ${batchNumber}/${totalBatches}: Enriching ${globalIndex}/${totalItems}: ${row.artist} - ${row.title}`);
          
          try {
            const { image_url, tracklists } = await fetchDiscogsData(row.discogs_release_id);
            batchEnriched.push({ ...row, image_url, tracklists });
          } catch (error) {
            console.warn(`Failed to enrich ${row.discogs_release_id}:`, error);
            // Add the row without enrichment if Discogs API fails
            batchEnriched.push({ ...row, image_url: null, tracklists: null });
          }
          
          // Rate limiting: wait 2 seconds between requests
          if (i < currentBatch.length - 1) {
            await delay(2000);
          }
        }
        
        // Save this batch to database immediately
        setStatus(`Batch ${batchNumber}: Saving ${batchEnriched.length} items to database...`);
        
        // Check for existing items in this batch
        const { data: existingItems, error: existingError } = await supabase
          .from('collection')
          .select('discogs_release_id, date_added')
          .in('discogs_release_id', batchEnriched.map(r => r.discogs_release_id));
        
        if (existingError) {
          console.warn(`Failed to check existing items in batch ${batchNumber}:`, existingError);
        } else {
          const existingMap = new Map(
            (existingItems || []).map(item => [item.discogs_release_id, item.date_added])
          );
          
          const newItems = batchEnriched.filter(row => !existingMap.has(row.discogs_release_id));
          const updateItems = batchEnriched.filter(row => {
            const dateAdded = existingMap.get(row.discogs_release_id);
            return existingMap.has(row.discogs_release_id) && !dateAdded;
          });
          
          let batchInsertCount = 0;
          let batchUpdateCount = 0;
          
          // Insert new items from this batch
          if (newItems.length > 0) {
            const { error: insertError } = await supabase
              .from('collection')
              .insert(newItems);

            if (insertError) {
              console.warn(`Database insert failed for batch ${batchNumber}:`, insertError);
            } else {
              batchInsertCount = newItems.length;
            }
          }
          
          // Update existing items from this batch
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
              console.warn(`Failed to update ${item.discogs_release_id} in batch ${batchNumber}:`, updateError);
            } else {
              batchUpdateCount++;
            }
          }
          
          setStatus(`Batch ${batchNumber} complete: ${batchInsertCount} inserted, ${batchUpdateCount} updated`);
        }
        
        // Add this batch to preview
        allEnriched = allEnriched.concat(batchEnriched);
        setCsvPreview(allEnriched); // Update preview after each batch
        
        // Longer delay between batches to avoid rate limiting
        if (batchEnd < totalItems) {
          setStatus(`Batch ${batchNumber} saved. Waiting 10 seconds before next batch...`);
          await delay(10000);
        }
      }
      
      // Process updates
      if (updateOperations.length > 0) {
        setStatus(`Processing ${updateOperations.length} update operations...`);
        
        for (let i = 0; i < updateOperations.length; i++) {
          const { csvRow, existingRecord } = updateOperations[i];
          setStatus(`Update ${i + 1}/${updateOperations.length}: ${csvRow.artist} - ${csvRow.title}`);
          
          let image_url = existingRecord.image_url;
          let tracklists = null;
          
          // Fetch missing image/tracklist data if needed
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
              date_added: csvRow.date_added,
              image_url: image_url,
              tracklists: tracklists
            })
            .eq('id', existingRecord.id);

          if (updateError) {
            console.warn(`Failed to update ${csvRow.discogs_release_id}:`, updateError);
          }
        }
      }
      
      // Process removals
      if (recordsToRemove.length > 0) {
        setStatus(`Removing ${recordsToRemove.length} records no longer in collection...`);
        
        const idsToDelete = recordsToRemove.map(record => record.id);
        const { error: deleteError } = await supabase
          .from('collection')
          .delete()
          .in('id', idsToDelete);

        if (deleteError) {
          console.warn('Failed to delete records:', deleteError);
        }
      }
      
      const totalChanges = allEnriched.length + updateOperations.length + recordsToRemove.length;
      setStatus(`✅ All processing complete! Total: ${totalChanges} changes (${allEnriched.length} new, ${updateOperations.length} updated, ${recordsToRemove.length} removed).`);
    } catch (error) {
      console.error('Processing error:', error);
      setStatus(`❌ Processing failed after ${allEnriched.length} items: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
                          // Hide broken images
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