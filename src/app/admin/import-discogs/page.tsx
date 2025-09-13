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
  // Normalize data for comparison
  const csvYear = csvRow.year?.toString().trim() || '';
  const dbYear = dbRow.year?.toString().trim() || '';
  
  const csvArtist = csvRow.artist?.trim() || '';
  const dbArtist = dbRow.artist?.trim() || '';
  
  const csvTitle = csvRow.title?.trim() || '';
  const dbTitle = dbRow.title?.trim() || '';
  
  const csvFormat = csvRow.format?.trim() || '';
  const dbFormat = dbRow.format?.trim() || '';
  
  const csvFolder = csvRow.folder?.trim() || '';
  const dbFolder = dbRow.folder?.trim() || '';
  
  const csvCondition = csvRow.media_condition?.trim() || '';
  const dbCondition = dbRow.media_condition?.trim() || '';
  
  // For dates, just compare the date part (ignore time)
  const csvDatePart = csvRow.date_added ? csvRow.date_added.split('T')[0] : '';
  const dbDatePart = dbRow.date_added ? dbRow.date_added.split('T')[0] : '';
  
  const hasChange = (
    csvArtist !== dbArtist ||
    csvTitle !== dbTitle ||
    csvYear !== dbYear ||
    csvFormat !== dbFormat ||
    csvFolder !== dbFolder ||
    csvCondition !== dbCondition ||
    csvDatePart !== dbDatePart
  );
  
  // Debug logging for first few comparisons
  if (hasChange) {
    console.log('CHANGE DETECTED:', {
      releaseId: csvRow.discogs_release_id,
      artist: { csv: csvArtist, db: dbArtist, same: csvArtist === dbArtist },
      title: { csv: csvTitle, db: dbTitle, same: csvTitle === dbTitle },
      year: { csv: csvYear, db: dbYear, same: csvYear === dbYear },
      format: { csv: csvFormat, db: dbFormat, same: csvFormat === dbFormat },
      folder: { csv: csvFolder, db: dbFolder, same: csvFolder === dbFolder },
      condition: { csv: csvCondition, db: dbCondition, same: csvCondition === dbCondition },
      dateAdded: { csv: csvDatePart, db: dbDatePart, same: csvDatePart === dbDatePart }
    });
  }
  
  return hasChange;
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
            tracklists: null
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
              .select('id, artist, title, year, format, folder, media_condition, discogs_release_id, date_added, image_url, blocked')
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
              tracklists: row.tracklists
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
      
      // 3. Process removed items (delete permanently)
      if (syncMode === 'full-sync' && previewData.removedItems.length > 0) {
        setStatus(`Deleting ${previewData.removedItems.length} removed items permanently...`);
        
        const removedIds = previewData.removedItems.map(item => item.id);
        const { error: deleteError } = await supabase
          .from('collection')
          .delete()
          .in('id', removedIds);

        if (deleteError) {
          console.error('Delete error:', deleteError);
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
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '2rem', color: '#1a1a1a' }}>Import & Sync Discogs Collection</h1>
      
      {/* Sync Mode Selection */}
      <div style={{ 
        marginBottom: '2rem', 
        padding: '1.5rem', 
        border: '2px solid #e1e5e9', 
        borderRadius: '8px', 
        backgroundColor: '#f8f9fa' 
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.3rem' }}>Sync Mode</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            fontSize: '1.1rem',
            cursor: 'pointer',
            padding: '0.5rem'
          }}>
            <input
              type="radio"
              value="import-only"
              checked={syncMode === 'import-only'}
              onChange={(e) => setSyncMode(e.target.value as SyncMode)}
              disabled={isProcessing}
              style={{ transform: 'scale(1.2)' }}
            />
            <span><strong>Import New Only</strong> - Safe, doesn&apos;t modify existing records</span>
          </label>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            fontSize: '1.1rem',
            cursor: 'pointer',
            padding: '0.5rem'
          }}>
            <input
              type="radio"
              value="full-sync"
              checked={syncMode === 'full-sync'}
              onChange={(e) => setSyncMode(e.target.value as SyncMode)}
              disabled={isProcessing}
              style={{ transform: 'scale(1.2)' }}
            />
            <span><strong>Full Sync</strong> - Updates existing records and deletes removed items</span>
          </label>
        </div>
      </div>
      
      {/* File Upload */}
      <div style={{ marginBottom: '2rem' }}>
        <input 
          type="file" 
          accept=".csv" 
          onChange={handleFileUpload} 
          disabled={isProcessing}
          style={{ 
            fontSize: '1.1rem', 
            padding: '0.75rem', 
            border: '2px solid #ddd', 
            borderRadius: '6px',
            backgroundColor: 'white'
          }}
        />
        
        {previewData && (
          <button 
            onClick={executeSync}
            disabled={isProcessing}
            style={{ 
              marginLeft: '1rem', 
              padding: '0.75rem 1.5rem',
              fontSize: '1.1rem',
              backgroundColor: isProcessing ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              opacity: isProcessing ? 0.6 : 1,
              fontWeight: 'bold'
            }}
          >
            {isProcessing ? 'Syncing...' : `Execute Sync (${syncStats.newItems + syncStats.updatedItems + syncStats.removedItems} changes)`}
          </button>
        )}
      </div>
      
      {/* Stats Display */}
      {(syncStats.newItems > 0 || syncStats.updatedItems > 0 || syncStats.removedItems > 0) && (
        <div style={{ 
          margin: '2rem 0', 
          padding: '2rem', 
          backgroundColor: '#e3f2fd', 
          borderRadius: '8px',
          border: '1px solid #bbdefb'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.5rem', color: '#0d47a1' }}>Sync Statistics</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '1.5rem' 
          }}>
            <div style={{ 
              padding: '1rem', 
              backgroundColor: 'white', 
              borderRadius: '6px', 
              textAlign: 'center',
              border: '1px solid #e0e0e0'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#28a745' }}>{syncStats.newItems}</div>
              <div style={{ fontSize: '1.1rem', color: '#666' }}>New Items</div>
            </div>
            <div style={{ 
              padding: '1rem', 
              backgroundColor: 'white', 
              borderRadius: '6px', 
              textAlign: 'center',
              border: '1px solid #e0e0e0'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ffc107' }}>{syncStats.updatedItems}</div>
              <div style={{ fontSize: '1.1rem', color: '#666' }}>Updated Items</div>
            </div>
            <div style={{ 
              padding: '1rem', 
              backgroundColor: 'white', 
              borderRadius: '6px', 
              textAlign: 'center',
              border: '1px solid #e0e0e0'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc3545' }}>{syncStats.removedItems}</div>
              <div style={{ fontSize: '1.1rem', color: '#666' }}>Removed Items</div>
            </div>
            <div style={{ 
              padding: '1rem', 
              backgroundColor: 'white', 
              borderRadius: '6px', 
              textAlign: 'center',
              border: '1px solid #e0e0e0'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#6c757d' }}>{syncStats.unchangedItems}</div>
              <div style={{ fontSize: '1.1rem', color: '#666' }}>Unchanged</div>
            </div>
            {syncStats.errors > 0 && (
              <div style={{ 
                padding: '1rem', 
                backgroundColor: '#ffebee', 
                borderRadius: '6px', 
                textAlign: 'center',
                border: '1px solid #ffcdd2'
              }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#d32f2f' }}>{syncStats.errors}</div>
                <div style={{ fontSize: '1.1rem', color: '#666' }}>Errors</div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Status Message */}
      <div style={{ 
        fontSize: '1.2rem',
        padding: '1rem',
        marginBottom: '2rem',
        backgroundColor: status.includes('error') || status.includes('failed') ? '#ffebee' : '#f5f5f5',
        color: status.includes('error') || status.includes('failed') ? '#d32f2f' : '#333',
        borderRadius: '6px',
        border: '1px solid #ddd',
        fontWeight: status.includes('complete') ? 'bold' : 'normal'
      }}>
        {status}
      </div>

      {debugInfo && (
        <details style={{ marginBottom: '2rem', fontSize: '1rem', color: '#666' }}>
          <summary style={{ cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold' }}>Debug Info</summary>
          <pre style={{ 
            marginTop: '1rem', 
            padding: '1rem', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '4px',
            overflow: 'auto'
          }}>{debugInfo}</pre>
        </details>
      )}

      {/* Preview Tables */}
      {previewData && (
        <div style={{ marginTop: '2rem' }}>
          {/* New Items Preview */}
          {previewData.newItems.length > 0 && (
            <div style={{ marginBottom: '3rem' }}>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#28a745' }}>
                ✨ New Items ({previewData.newItems.length})
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#28a745', color: 'white' }}>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '1.1rem' }}>Artist</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '1.1rem' }}>Title</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '1.1rem' }}>Year</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '1.1rem' }}>Format</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '1.1rem' }}>Folder</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '1.1rem' }}>Condition</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.newItems.slice(0, 10).map((row, i) => (
                      <tr key={i} style={{ 
                        backgroundColor: i % 2 === 0 ? '#f8f9fa' : 'white',
                        borderBottom: '1px solid #e0e0e0'
                      }}>
                        <td style={{ padding: '0.75rem', fontSize: '1rem' }}>{row.artist}</td>
                        <td style={{ padding: '0.75rem', fontSize: '1rem' }}>{row.title}</td>
                        <td style={{ padding: '0.75rem', fontSize: '1rem' }}>{row.year}</td>
                        <td style={{ padding: '0.75rem', fontSize: '1rem' }}>{row.format}</td>
                        <td style={{ padding: '0.75rem', fontSize: '1rem' }}>{row.folder}</td>
                        <td style={{ padding: '0.75rem', fontSize: '1rem' }}>{row.media_condition}</td>
                      </tr>
                    ))}
                    {previewData.newItems.length > 10 && (
                      <tr style={{ backgroundColor: '#f0f0f0' }}>
                        <td colSpan={6} style={{ 
                          padding: '1rem', 
                          textAlign: 'center', 
                          fontSize: '1.1rem', 
                          fontStyle: 'italic' 
                        }}>
                          ... and {previewData.newItems.length - 10} more items
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Updated Items Preview */}
          {previewData.updatedItems.length > 0 && (
            <div style={{ marginBottom: '3rem' }}>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#ffc107' }}>
                🔄 Updated Items ({previewData.updatedItems.length})
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#ffc107', color: 'black' }}>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '1.1rem' }}>Artist</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '1.1rem' }}>Title</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '1.1rem' }}>Changes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.updatedItems.slice(0, 10).map(({ csv, db }, i) => {
                      const changes = [];
                      if (csv.folder !== db.folder) changes.push(`Folder: ${db.folder} → ${csv.folder}`);
                      if (csv.media_condition !== db.media_condition) changes.push(`Condition: ${db.media_condition} → ${csv.media_condition}`);
                      if (csv.format !== db.format) changes.push(`Format: ${db.format} → ${csv.format}`);
                      
                      return (
                        <tr key={i} style={{ 
                          backgroundColor: i % 2 === 0 ? '#f8f9fa' : 'white',
                          borderBottom: '1px solid #e0e0e0'
                        }}>
                          <td style={{ padding: '0.75rem', fontSize: '1rem' }}>{csv.artist}</td>
                          <td style={{ padding: '0.75rem', fontSize: '1rem' }}>{csv.title}</td>
                          <td style={{ padding: '0.75rem', fontSize: '1rem', fontFamily: 'monospace' }}>{changes.join('; ')}</td>
                        </tr>
                      );
                    })}
                    {previewData.updatedItems.length > 10 && (
                      <tr style={{ backgroundColor: '#f0f0f0' }}>
                        <td colSpan={3} style={{ 
                          padding: '1rem', 
                          textAlign: 'center', 
                          fontSize: '1.1rem', 
                          fontStyle: 'italic' 
                        }}>
                          ... and {previewData.updatedItems.length - 10} more items
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Removed Items Preview */}
          {previewData.removedItems.length > 0 && (
            <div style={{ marginBottom: '3rem' }}>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#dc3545' }}>
                ⚠️ Removed Items ({previewData.removedItems.length}) - Will be deleted permanently
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#dc3545', color: 'white' }}>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '1.1rem' }}>Artist</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '1.1rem' }}>Title</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '1.1rem' }}>Year</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '1.1rem' }}>Folder</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.removedItems.slice(0, 10).map((row, i) => (
                      <tr key={i} style={{ 
                        backgroundColor: i % 2 === 0 ? '#f8f9fa' : 'white',
                        borderBottom: '1px solid #e0e0e0'
                      }}>
                        <td style={{ padding: '0.75rem', fontSize: '1rem' }}>{row.artist}</td>
                        <td style={{ padding: '0.75rem', fontSize: '1rem' }}>{row.title}</td>
                        <td style={{ padding: '0.75rem', fontSize: '1rem' }}>{row.year}</td>
                        <td style={{ padding: '0.75rem', fontSize: '1rem' }}>{row.folder}</td>
                      </tr>
                    ))}
                    {previewData.removedItems.length > 10 && (
                      <tr style={{ backgroundColor: '#f0f0f0' }}>
                        <td colSpan={4} style={{ 
                          padding: '1rem', 
                          textAlign: 'center', 
                          fontSize: '1.1rem', 
                          fontStyle: 'italic' 
                        }}>
                          ... and {previewData.removedItems.length - 10} more items
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}