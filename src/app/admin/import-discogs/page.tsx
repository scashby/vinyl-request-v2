// src/app/admin/import-discogs/page.tsx
// Enhanced Discogs CSV import with full synchronization capabilities
// Handles new items, updates to existing records, and permanent deletion of removed items

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

// Type for the processed row that will go to Supabase
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
  notes: string | null;
};

// Type for database records
type DatabaseRow = {
  id: number;
  artist: string;
  title: string;
  year: string | null;
  format: string | null;
  folder: string | null;
  media_condition: string | null;
  discogs_release_id: string | null;
  date_added: string | null;
  image_url: string | null;
  notes: string | null;
  blocked: boolean | null;
};

type SyncStats = {
  newItems: number;
  updatedItems: number;
  removedItems: number;
  unchangedItems: number;
  errors: number;
};

type SyncMode = 'import-only' | 'full-sync';

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

// Compare two records to see if they have meaningful differences
function hasChanges(csvRow: ProcessedRow, dbRow: DatabaseRow): boolean {
  const csvYear = csvRow.year?.toString() || null;
  const dbYear = dbRow.year;
  
  return (
    csvRow.artist !== dbRow.artist ||
    csvRow.title !== dbRow.title ||
    csvYear !== dbYear ||
    csvRow.format !== dbRow.format ||
    csvRow.folder !== dbRow.folder ||
    csvRow.media_condition !== dbRow.media_condition ||
    csvRow.notes !== dbRow.notes ||
    csvRow.date_added !== dbRow.date_added
  );
}

export default function ImportDiscogsPage() {
  const [syncStats, setSyncStats] = useState<SyncStats>({
    newItems: 0,
    updatedItems: 0,
    removedItems: 0,
    unchangedItems: 0,
    errors: 0
  });
  const [status, setStatus] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [syncMode, setSyncMode] = useState<SyncMode>('import-only');
  const [previewData, setPreviewData] = useState<{
    newItems: ProcessedRow[];
    updatedItems: { csv: ProcessedRow; db: DatabaseRow }[];
    removedItems: DatabaseRow[];
  } | null>(null);

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const fetchDiscogsData = async (
    releaseId: string,
    retries = 3
  ): Promise<{ image_url: string | null; tracklists: string | null }> => {
    const url = `https://api.discogs.com/releases/${releaseId}`;
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        if (attempt > 0) await delay(1000);
        
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'DeadwaxDialogues/1.0 +https://yourwebsite.com',
            'Authorization': `Discogs token=${process.env.NEXT_PUBLIC_DISCOGS_TOKEN}`
          }
        });
        
        if (res.status === 429) {
          await delay(2000);
          continue;
        }
        
        if (!res.ok) {
          console.warn(`Failed to fetch release ${releaseId}, status: ${res.status}`);
          return { image_url: null, tracklists: null };
        }
        
        const data = await res.json();
        
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
    setPreviewData(null);
    
    try {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: async (results: { data: DiscogsCSVRow[], meta: { fields?: string[] } }) => {
          console.log('CSV Headers:', results.meta.fields);
          setDebugInfo(`CSV Headers: ${results.meta.fields?.join(', ')}`);
          
          // Filter and process valid rows
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
          
          console.log(`Total CSV rows: ${results.data.length}, Valid rows: ${validRows.length}`);
          
          // Convert to ProcessedRow format
          const csvProcessedRows: ProcessedRow[] = validRows.map(row => ({
            artist: row.Artist,
            title: row.Title,
            year: row.Released,
            format: row.Format,
            folder: row.CollectionFolder,
            media_condition: row['Collection Media Condition'],
            discogs_release_id: String(row.release_id),
            date_added: parseDiscogsDate(row['Date Added']),
            image_url: null,
            tracklists: null,
            notes: row['Collection Notes'] || null
          }));
          
          setStatus('Fetching current database records...');
          
          // Get ALL records from database with Discogs release IDs
          let allDbRecords: DatabaseRow[] = [];
          let start = 0;
          const pageSize = 1000;
          let hasMore = true;

          while (hasMore) {
            const { data: pageData, error: queryError } = await supabase
              .from('collection')
              .select('id, artist, title, year, format, folder, media_condition, discogs_release_id, date_added, image_url, notes, blocked')
              .not('discogs_release_id', 'is', null)
              .range(start, start + pageSize - 1);

            if (queryError) {
              throw new Error(`Database query failed: ${queryError.message}`);
            }

            if (pageData && pageData.length > 0) {
              allDbRecords = allDbRecords.concat(pageData as DatabaseRow[]);
              start += pageSize;
              hasMore = pageData.length === pageSize;
            } else {
              hasMore = false;
            }
          }

          console.log('Total database records:', allDbRecords.length);
          
          // Create lookup maps
          const csvByReleaseId = new Map(csvProcessedRows.map(row => [row.discogs_release_id, row]));
          const dbByReleaseId = new Map(allDbRecords.map(row => [row.discogs_release_id!, row]));
          
          // Categorize items
          const newItems: ProcessedRow[] = [];
          const updatedItems: { csv: ProcessedRow; db: DatabaseRow }[] = [];
          const unchangedItems: ProcessedRow[] = [];
          
          // Check each CSV item
          for (const csvRow of csvProcessedRows) {
            const dbRow = dbByReleaseId.get(csvRow.discogs_release_id);
            
            if (!dbRow) {
              // New item
              newItems.push(csvRow);
            } else if (hasChanges(csvRow, dbRow)) {
              // Updated item
              updatedItems.push({ csv: csvRow, db: dbRow });
            } else {
              // Unchanged item
              unchangedItems.push(csvRow);
            }
          }
          
          // Find removed items (in DB but not in current CSV)
          const removedItems: DatabaseRow[] = [];
          if (syncMode === 'full-sync') {
            for (const dbRow of allDbRecords) {
              if (!csvByReleaseId.has(dbRow.discogs_release_id!) && !dbRow.blocked) {
                removedItems.push(dbRow);
              }
            }
          }
          
          // Update stats
          setSyncStats({
            newItems: newItems.length,
            updatedItems: updatedItems.length,
            removedItems: removedItems.length,
            unchangedItems: unchangedItems.length,
            errors: 0
          });
          
          // Set preview data
          setPreviewData({
            newItems,
            updatedItems,
            removedItems
          });
          
          setStatus(`Analysis complete: ${newItems.length} new, ${updatedItems.length} updated, ${removedItems.length} removed, ${unchangedItems.length} unchanged`);
          setDebugInfo(prev => prev + `\nSync Mode: ${syncMode}\nNew: ${newItems.length}, Updated: ${updatedItems.length}, Removed: ${removedItems.length}, Unchanged: ${unchangedItems.length}`);
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

  const executeSync = async () => {
    if (!previewData) return;
    
    setIsProcessing(true);
    const BATCH_SIZE = 50;
    
    try {
      setStatus('Starting synchronization...');
      
      // 1. Process new items
      if (previewData.newItems.length > 0) {
        setStatus(`Processing ${previewData.newItems.length} new items...`);
        
        for (let i = 0; i < previewData.newItems.length; i += BATCH_SIZE) {
          const batch = previewData.newItems.slice(i, i + BATCH_SIZE);
          setStatus(`Enriching new items batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(previewData.newItems.length / BATCH_SIZE)}...`);
          
          // Enrich with Discogs data
          const enrichedBatch: ProcessedRow[] = [];
          for (const row of batch) {
            try {
              const { image_url, tracklists } = await fetchDiscogsData(row.discogs_release_id);
              enrichedBatch.push({ ...row, image_url, tracklists });
            } catch (error) {
              console.warn(`Failed to enrich ${row.discogs_release_id}:`, error);
              enrichedBatch.push(row);
            }
            await delay(2000); // Rate limiting
          }
          
          // Insert batch
          const { error: insertError } = await supabase
            .from('collection')
            .insert(enrichedBatch.map(row => ({
              artist: row.artist,
              title: row.title,
              year: row.year?.toString() || null,
              format: row.format,
              folder: row.folder,
              media_condition: row.media_condition,
              discogs_release_id: row.discogs_release_id,
              date_added: row.date_added,
              image_url: row.image_url,
              tracklists: row.tracklists,
              notes: row.notes
            })));

          if (insertError) {
            console.error('Insert error:', insertError);
            setSyncStats(prev => ({ ...prev, errors: prev.errors + batch.length }));
          }
          
          await delay(5000); // Delay between batches
        }
      }
      
      // 2. Process updated items
      if (previewData.updatedItems.length > 0) {
        setStatus(`Processing ${previewData.updatedItems.length} updated items...`);
        
        for (let i = 0; i < previewData.updatedItems.length; i += BATCH_SIZE) {
          const batch = previewData.updatedItems.slice(i, i + BATCH_SIZE);
          setStatus(`Updating items batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(previewData.updatedItems.length / BATCH_SIZE)}...`);
          
          for (const { csv: csvRow, db: dbRow } of batch) {
            try {
              // Only fetch new Discogs data if image/tracklist is missing
              let image_url = dbRow.image_url;
              let tracklists = null;
              
              if (!image_url) {
                const discogsData = await fetchDiscogsData(csvRow.discogs_release_id);
                image_url = discogsData.image_url;
                tracklists = discogsData.tracklists;
                await delay(2000);
              }
              
              const { error: updateError } = await supabase
                .from('collection')
                .update({
                  artist: csvRow.artist,
                  title: csvRow.title,
                  year: csvRow.year?.toString() || null,
                  format: csvRow.format,
                  folder: csvRow.folder,
                  media_condition: csvRow.media_condition,
                  date_added: csvRow.date_added,
                  image_url: image_url,
                  tracklists: tracklists
                })
                .eq('id', dbRow.id);

              if (updateError) {
                console.error(`Update error for ${csvRow.discogs_release_id}:`, updateError);
                setSyncStats(prev => ({ ...prev, errors: prev.errors + 1 }));
              }
            } catch (error) {
              console.error(`Failed to update ${csvRow.discogs_release_id}:`, error);
              setSyncStats(prev => ({ ...prev, errors: prev.errors + 1 }));
            }
          }
          
          await delay(2000);
        }
      }
      
      // 3. Process removed items (mark as blocked rather than delete)
      if (syncMode === 'full-sync' && previewData.removedItems.length > 0) {
        setStatus(`Marking ${previewData.removedItems.length} removed items as blocked...`);
        
        const removedIds = previewData.removedItems.map(item => item.id);
        const { error: blockError } = await supabase
          .from('collection')
          .update({ blocked: true })
          .in('id', removedIds);

        if (blockError) {
          console.error('Block error:', blockError);
          setSyncStats(prev => ({ ...prev, errors: prev.errors + previewData.removedItems.length }));
        }
      }
      
      setStatus(`✅ Sync complete! New: ${syncStats.newItems}, Updated: ${syncStats.updatedItems}, Removed: ${syncStats.removedItems}`);
      
    } catch (error) {
      console.error('Sync error:', error);
      setStatus(`❌ Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Import & Sync Discogs Collection</h1>
      
      {/* Sync Mode Selection */}
      <div style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
        <h3>Sync Mode</h3>
        <label style={{ marginRight: '1rem' }}>
          <input
            type="radio"
            value="import-only"
            checked={syncMode === 'import-only'}
            onChange={(e) => setSyncMode(e.target.value as SyncMode)}
            disabled={isProcessing}
          />
          Import New Only (safe - doesn&apos;t modify existing records)
        </label>
        <label>
          <input
            type="radio"
            value="full-sync"
            checked={syncMode === 'full-sync'}
            onChange={(e) => setSyncMode(e.target.value as SyncMode)}
            disabled={isProcessing}
          />
          Full Sync (updates existing records and marks removed items)
        </label>
      </div>
      
      <input 
        type="file" 
        accept=".csv" 
        onChange={handleFileUpload} 
        disabled={isProcessing}
      />
      
      {previewData && (
        <button 
          onClick={executeSync}
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
          {isProcessing ? 'Syncing...' : `Execute Sync (${syncStats.newItems + syncStats.updatedItems + syncStats.removedItems} changes)`}
        </button>
      )}
      
      {/* Stats Display */}
      {(syncStats.newItems > 0 || syncStats.updatedItems > 0 || syncStats.removedItems > 0) && (
        <div style={{ margin: '1rem 0', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <h3>Sync Statistics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
            <div><strong>New Items:</strong> {syncStats.newItems}</div>
            <div><strong>Updated Items:</strong> {syncStats.updatedItems}</div>
            <div><strong>Removed Items:</strong> {syncStats.removedItems}</div>
            <div><strong>Unchanged:</strong> {syncStats.unchangedItems}</div>
            {syncStats.errors > 0 && <div style={{ color: 'red' }}><strong>Errors:</strong> {syncStats.errors}</div>}
          </div>
        </div>
      )}
      
      <p style={{ 
        color: status.includes('error') || status.includes('failed') ? 'red' : 'black',
        fontWeight: status.includes('complete') ? 'bold' : 'normal'
      }}>
        {status}
      </p>

      {debugInfo && (
        <details style={{ marginTop: '1rem', fontSize: '0.9em', color: '#666' }}>
          <summary>Debug Info</summary>
          <pre>{debugInfo}</pre>
        </details>
      )}

      {/* Preview Tables */}
      {previewData && (
        <div style={{ marginTop: '2rem' }}>
          {/* New Items Preview */}
          {previewData.newItems.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3>New Items ({previewData.newItems.length})</h3>
              <table border={1} cellPadding={4} style={{ width: '100%', fontSize: '0.9em' }}>
                <thead>
                  <tr>
                    <th>Artist</th>
                    <th>Title</th>
                    <th>Year</th>
                    <th>Format</th>
                    <th>Folder</th>
                    <th>Condition</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.newItems.slice(0, 10).map((row, i) => (
                    <tr key={i}>
                      <td>{row.artist}</td>
                      <td>{row.title}</td>
                      <td>{row.year}</td>
                      <td>{row.format}</td>
                      <td>{row.folder}</td>
                      <td>{row.media_condition}</td>
                    </tr>
                  ))}
                  {previewData.newItems.length > 10 && (
                    <tr><td colSpan={6}>... and {previewData.newItems.length - 10} more</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Updated Items Preview */}
          {previewData.updatedItems.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3>Updated Items ({previewData.updatedItems.length})</h3>
              <table border={1} cellPadding={4} style={{ width: '100%', fontSize: '0.9em' }}>
                <thead>
                  <tr>
                    <th>Artist</th>
                    <th>Title</th>
                    <th>Changes</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.updatedItems.slice(0, 10).map(({ csv, db }, i) => {
                    const changes = [];
                    if (csv.folder !== db.folder) changes.push(`Folder: ${db.folder} → ${csv.folder}`);
                    if (csv.media_condition !== db.media_condition) changes.push(`Condition: ${db.media_condition} → ${csv.media_condition}`);
                    if (csv.format !== db.format) changes.push(`Format: ${db.format} → ${csv.format}`);
                    
                    return (
                      <tr key={i}>
                        <td>{csv.artist}</td>
                        <td>{csv.title}</td>
                        <td>{changes.join('; ')}</td>
                      </tr>
                    );
                  })}
                  {previewData.updatedItems.length > 10 && (
                    <tr><td colSpan={3}>... and {previewData.updatedItems.length - 10} more</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Removed Items Preview */}
          {previewData.removedItems.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3>Removed Items ({previewData.removedItems.length}) - Will be marked as blocked</h3>
              <table border={1} cellPadding={4} style={{ width: '100%', fontSize: '0.9em' }}>
                <thead>
                  <tr>
                    <th>Artist</th>
                    <th>Title</th>
                    <th>Year</th>
                    <th>Folder</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.removedItems.slice(0, 10).map((row, i) => (
                    <tr key={i}>
                      <td>{row.artist}</td>
                      <td>{row.title}</td>
                      <td>{row.year}</td>
                      <td>{row.folder}</td>
                    </tr>
                  ))}
                  {previewData.removedItems.length > 10 && (
                    <tr><td colSpan={4}>... and {previewData.removedItems.length - 10} more</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}