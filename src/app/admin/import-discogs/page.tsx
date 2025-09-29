// Enhanced Discogs Import - populates genres, styles, and decade
// Replace: src/app/admin/import-discogs/page.tsx

'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { supabase } from 'src/lib/supabaseClient';

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
  discogs_genres: string[] | null;
  discogs_styles: string[] | null;
  decade: number | null;
};

type ExistingRecord = {
  id: number;
  discogs_release_id: string;
  artist: string;
  title: string;
  date_added: string | null;
  folder: string | null;
  media_condition: string | null;
  image_url: string | null;
  tracklists: string | null;
  discogs_genres: string[] | null;
  discogs_styles: string[] | null;
  decade: number | null;
};

type UpdateOperation = {
  csvRow: ProcessedRow;
  existingRecord: ExistingRecord;
};

type SyncPreview = {
  newItems: ProcessedRow[];
  updateOperations: UpdateOperation[];
  recordsToRemove: ExistingRecord[];
};

interface SyncDataStorage {
  updateOperations?: UpdateOperation[];
  recordsToRemove?: ExistingRecord[];
}

// Calculate decade from year
function calculateDecade(year: number | null): number | null {
  if (!year || year <= 0) return null;
  return Math.floor(year / 10) * 10;
}

function normalizeValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function valuesAreEqual(val1: string | number | null | undefined, val2: string | number | null | undefined): boolean {
  const norm1 = normalizeValue(val1);
  const norm2 = normalizeValue(val2);
  return norm1 === norm2;
}

function sanitizeMediaCondition(condition: string | null | undefined): string {
  if (!condition || condition.trim() === '') return 'Unknown';
  return condition.trim();
}

function sanitizeFolder(folder: string | null | undefined): string {
  if (!folder || folder.trim() === '') return 'Uncategorized';
  return folder.trim();
}

function parseDiscogsDate(dateString: string): string {
  if (!dateString || dateString.trim() === '') return new Date().toISOString();
  try {
    const parsed = new Date(dateString);
    if (isNaN(parsed.getTime())) return new Date().toISOString();
    return parsed.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

type DiscogsTrack = {
  position?: string;
  type_?: string;
  title?: string;
  duration?: string;
};

type DiscogsResponse = {
  images?: Array<{ uri: string }>;
  tracklist?: DiscogsTrack[];
  genres?: string[];
  styles?: string[];
};

export default function ImportDiscogsPage() {
  const [syncPreview, setSyncPreview] = useState<SyncPreview | null>(null);
  const [status, setStatus] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // ENHANCED: Now fetches genres, styles, images, and tracklists
  const fetchDiscogsData = async (
    releaseId: string,
    retries = 3
  ): Promise<{ 
    image_url: string | null; 
    tracklists: string | null;
    genres: string[] | null;
    styles: string[] | null;
  }> => {
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
          return { image_url: null, tracklists: null, genres: null, styles: null };
        }
        
        const data = await res.json() as DiscogsResponse;
        
        // Process tracklist
        let tracklistsStr = null;
        if (Array.isArray(data.tracklist) && data.tracklist.length > 0) {
          tracklistsStr = JSON.stringify(data.tracklist.map((track: DiscogsTrack) => ({
            position: track.position || '',
            type_: track.type_ || 'track',
            title: track.title || '',
            duration: track.duration || ''
          })));
        }
        
        // Extract genres and styles
        const genres = Array.isArray(data.genres) && data.genres.length > 0 
          ? data.genres.filter(g => g && g.trim()).map(g => g.trim()) 
          : null;
          
        const styles = Array.isArray(data.styles) && data.styles.length > 0 
          ? data.styles.filter(s => s && s.trim()).map(s => s.trim()) 
          : null;
        
        return {
          image_url: data.images?.[0]?.uri || null,
          tracklists: tracklistsStr,
          genres,
          styles
        };
      } catch (error) {
        console.warn(`Attempt ${attempt + 1} failed for release ${releaseId}:`, error);
        if (attempt === retries - 1) {
          return { image_url: null, tracklists: null, genres: null, styles: null };
        }
        await delay(1000);
      }
    }
    
    return { image_url: null, tracklists: null, genres: null, styles: null };
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
        dynamicTyping: true,
        complete: async (results: { data: DiscogsCSVRow[], meta: { fields?: string[] } }) => {
          // Filter valid rows
          const validRows = results.data.filter((row) => {
            const releaseId = row.release_id;
            if (!releaseId || releaseId === 0 || releaseId === '') return false;
            const numericValue = Number(releaseId);
            return !isNaN(numericValue) && numericValue > 0;
          });
          
          // Process with decade calculation
          const processedRows: ProcessedRow[] = validRows.map(row => {
            const year = row.Released || 0;
            return {
              artist: row.Artist || 'Unknown Artist',
              title: row.Title || 'Unknown Title',
              year,
              format: row.Format || 'Unknown',
              folder: sanitizeFolder(row.CollectionFolder),
              media_condition: sanitizeMediaCondition(row['Collection Media Condition']),
              discogs_release_id: String(row.release_id),
              date_added: parseDiscogsDate(row['Date Added']),
              image_url: null,
              tracklists: null,
              discogs_genres: null,
              discogs_styles: null,
              decade: calculateDecade(year)
            };
          });

          const releaseIds = processedRows.map(r => r.discogs_release_id);
          
          setStatus(`Checking existing entries for ${releaseIds.length} items...`);
          
          // Fetch all existing records
          let allExisting: ExistingRecord[] = [];
          let start = 0;
          const pageSize = 1000;
          let hasMore = true;

          while (hasMore) {
            const { data: pageData, error: queryError } = await supabase
              .from('collection')
              .select('id, discogs_release_id, artist, title, date_added, folder, media_condition, image_url, tracklists, discogs_genres, discogs_styles, decade')
              .not('discogs_release_id', 'is', null)
              .range(start, start + pageSize - 1);

            if (queryError) throw new Error(`Database query failed: ${queryError.message}`);

            if (pageData && pageData.length > 0) {
              allExisting = allExisting.concat(pageData as ExistingRecord[]);
              start += pageSize;
              hasMore = pageData.length === pageSize;
            } else {
              hasMore = false;
            }
          }

          const allExistingIds = new Set(allExisting.map(r => r.discogs_release_id).filter(id => id));
          const existingRecordsMap = new Map(allExisting.map(record => [record.discogs_release_id, record]));
          const csvRecordsMap = new Map(processedRows.map(row => [row.discogs_release_id, row]));

          const newRows = processedRows.filter(row => !allExistingIds.has(row.discogs_release_id));

          // Find updates - check genres/styles/decade too
          const updateOperations: UpdateOperation[] = [];
          for (const csvRow of processedRows) {
            const existingRecord = existingRecordsMap.get(csvRow.discogs_release_id);
            if (existingRecord) {
              const folderChanged = !valuesAreEqual(csvRow.folder, existingRecord.folder);
              const conditionChanged = !valuesAreEqual(csvRow.media_condition, existingRecord.media_condition);
              const needsImage = !existingRecord.image_url;
              const needsTracklists = !existingRecord.tracklists || 
                                   existingRecord.tracklists === '' || 
                                   existingRecord.tracklists === 'null' ||
                                   existingRecord.tracklists === '[]';
              const needsGenres = !existingRecord.discogs_genres || existingRecord.discogs_genres.length === 0;
              const needsStyles = !existingRecord.discogs_styles || existingRecord.discogs_styles.length === 0;
              const needsDecade = existingRecord.decade === null && csvRow.decade !== null;
              
              if (folderChanged || conditionChanged || needsImage || needsTracklists || needsGenres || needsStyles || needsDecade) {
                updateOperations.push({ csvRow, existingRecord });
              }
            }
          }
          
          const recordsToRemove: ExistingRecord[] = allExisting.filter(
            existingRecord => !csvRecordsMap.has(existingRecord.discogs_release_id)
          );

          setStatus(`Found ${newRows.length} new, ${updateOperations.length} updates, ${recordsToRemove.length} removals`);

          (window as Window & SyncDataStorage).updateOperations = updateOperations;
          (window as Window & SyncDataStorage).recordsToRemove = recordsToRemove;

          setSyncPreview({ newItems: newRows, updateOperations, recordsToRemove });
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
    if (!syncPreview || (syncPreview.newItems.length === 0 && syncPreview.updateOperations.length === 0)) {
      setStatus('Nothing to import or update');
      return;
    }
    
    setIsProcessing(true);
    const BATCH_SIZE = 25;
    const totalItems = syncPreview.newItems.length;
    let allEnriched: ProcessedRow[] = [];
    
    const updateOperations = (window as Window & SyncDataStorage).updateOperations || [];
    const recordsToRemove = (window as Window & SyncDataStorage).recordsToRemove || [];
    
    setStatus(`Starting enrichment for ${totalItems} new items...`);

    try {
      // Process new items
      for (let batchStart = 0; batchStart < totalItems; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, totalItems);
        const currentBatch = syncPreview.newItems.slice(batchStart, batchEnd);
        const batchNumber = Math.floor(batchStart / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(totalItems / BATCH_SIZE);
        
        setStatus(`Batch ${batchNumber}/${totalBatches} (items ${batchStart + 1}-${batchEnd})...`);
        
        const batchEnriched: ProcessedRow[] = [];
        for (let i = 0; i < currentBatch.length; i++) {
          const row = currentBatch[i];
          const globalIndex = batchStart + i + 1;
          setStatus(`Batch ${batchNumber}: Enriching ${globalIndex}/${totalItems}: ${row.artist} - ${row.title}`);
          
          try {
            const { image_url, tracklists, genres, styles } = await fetchDiscogsData(row.discogs_release_id);
            batchEnriched.push({ 
              ...row, 
              image_url, 
              tracklists,
              discogs_genres: genres,
              discogs_styles: styles
            });
          } catch (error) {
            console.warn(`Failed to enrich ${row.discogs_release_id}:`, error);
            batchEnriched.push({ ...row });
          }
          
          if (i < currentBatch.length - 1) await delay(2000);
        }
        
        // Insert batch
        let batchInsertCount = 0;
        for (const item of batchEnriched) {
          try {
            const { error: insertError } = await supabase
              .from('collection')
              .insert([item]);

            if (!insertError) batchInsertCount++;
          } catch (error) {
            console.error(`Error inserting ${item.artist} - ${item.title}:`, error);
          }
        }
        
        setStatus(`Batch ${batchNumber} complete: ${batchInsertCount}/${batchEnriched.length} inserted`);
        allEnriched = allEnriched.concat(batchEnriched);
        
        if (batchEnd < totalItems) {
          setStatus(`Waiting before next batch...`);
          await delay(10000);
        }
      }
      
      // Process updates - includes genres/styles/decade
      if (updateOperations.length > 0) {
        setStatus(`Processing ${updateOperations.length} updates...`);
        
        let updateCount = 0;
        for (let i = 0; i < updateOperations.length; i++) {
          const { csvRow, existingRecord } = updateOperations[i];
          setStatus(`Update ${i + 1}/${updateOperations.length}: ${csvRow.artist} - ${csvRow.title}`);
          
          let image_url = existingRecord.image_url;
          let tracklists = existingRecord.tracklists;
          let genres = existingRecord.discogs_genres;
          let styles = existingRecord.discogs_styles;
          
          const needsImage = !image_url;
          const needsTracklists = !tracklists || tracklists === '' || tracklists === 'null' || tracklists === '[]';
          const needsGenres = !genres || genres.length === 0;
          const needsStyles = !styles || styles.length === 0;
          
          if (needsImage || needsTracklists || needsGenres || needsStyles) {
            try {
              const discogsData = await fetchDiscogsData(csvRow.discogs_release_id);
              
              if (needsImage && discogsData.image_url) image_url = discogsData.image_url;
              if (needsTracklists && discogsData.tracklists) tracklists = discogsData.tracklists;
              if (needsGenres && discogsData.genres) genres = discogsData.genres;
              if (needsStyles && discogsData.styles) styles = discogsData.styles;
              
              await delay(2000);
            } catch (error) {
              console.warn(`Failed to enrich ${csvRow.discogs_release_id}:`, error);
            }
          }
          
          const updateData = {
            folder: csvRow.folder,
            media_condition: csvRow.media_condition,
            date_added: csvRow.date_added,
            image_url,
            tracklists,
            discogs_genres: genres,
            discogs_styles: styles,
            decade: csvRow.decade
          };
          
          try {
            const { error: updateError } = await supabase
              .from('collection')
              .update(updateData)
              .eq('id', existingRecord.id);

            if (!updateError) updateCount++;
          } catch (error) {
            console.error(`Error updating ${csvRow.discogs_release_id}:`, error);
          }
        }
        
        setStatus(`Completed ${updateCount}/${updateOperations.length} updates`);
      }
      
      // Process removals
      if (recordsToRemove.length > 0) {
        setStatus(`Removing ${recordsToRemove.length} records...`);
        const idsToDelete = recordsToRemove.map(record => record.id);
        await supabase.from('collection').delete().in('id', idsToDelete);
      }
      
      setStatus(`✅ Complete! ${allEnriched.length} new, ${updateOperations.length} updated, ${recordsToRemove.length} removed`);
    } catch (error) {
      setStatus(`❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{
      padding: 24,
      background: '#f8fafc',
      minHeight: '100vh',
      maxWidth: 1400,
      margin: '0 auto'
    }}>
      <h1 style={{
        fontSize: 32,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 8
      }}>
        Import Discogs Collection
      </h1>
      <p style={{
        color: '#6b7280',
        fontSize: 16,
        marginBottom: 24
      }}>
        Enhanced import now includes genres, styles, and decade classification
      </p>

      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 24,
        marginBottom: 24,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          disabled={isProcessing}
          style={{
            padding: '10px 16px',
            border: '2px solid #d1d5db',
            borderRadius: 8,
            fontSize: 14,
            cursor: isProcessing ? 'not-allowed' : 'pointer'
          }}
        />
        
        {syncPreview && (
          <button
            onClick={enrichAndImport}
            disabled={isProcessing}
            style={{
              marginLeft: 16,
              padding: '12px 24px',
              background: isProcessing ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
              boxShadow: isProcessing ? 'none' : '0 4px 6px rgba(59, 130, 246, 0.2)'
            }}
          >
            {isProcessing ? 'Processing...' : '⚡ Enrich & Import'}
          </button>
        )}
      </div>

      {status && (
        <div style={{
          background: status.includes('✅') ? '#dcfce7' : status.includes('❌') ? '#fee2e2' : '#dbeafe',
          border: `1px solid ${status.includes('✅') ? '#16a34a' : status.includes('❌') ? '#dc2626' : '#3b82f6'}`,
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
          color: status.includes('✅') ? '#15803d' : status.includes('❌') ? '#991b1b' : '#1e40af',
          fontSize: 14,
          fontWeight: 500
        }}>
          {status}
        </div>
      )}

      {syncPreview && (
        <div style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 24,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{
            fontSize: 24,
            fontWeight: 600,
            color: '#1f2937',
            marginBottom: 16
          }}>
            Sync Preview
          </h2>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 24
          }}>
            <div style={{
              background: '#dcfce7',
              border: '1px solid #16a34a',
              borderRadius: 8,
              padding: 16,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 32, fontWeight: 'bold', color: '#15803d' }}>
                {syncPreview.newItems.length}
              </div>
              <div style={{ fontSize: 14, color: '#15803d' }}>New Albums</div>
            </div>
            
            <div style={{
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: 8,
              padding: 16,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 32, fontWeight: 'bold', color: '#d97706' }}>
                {syncPreview.updateOperations.length}
              </div>
              <div style={{ fontSize: 14, color: '#d97706' }}>Updates</div>
            </div>
            
            <div style={{
              background: '#fee2e2',
              border: '1px solid #dc2626',
              borderRadius: 8,
              padding: 16,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 32, fontWeight: 'bold', color: '#991b1b' }}>
                {syncPreview.recordsToRemove.length}
              </div>
              <div style={{ fontSize: 14, color: '#991b1b' }}>To Remove</div>
            </div>
          </div>
          
          <div style={{
            padding: 12,
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: 6,
            fontSize: 13,
            color: '#0c4a6e'
          }}>
            <strong>📊 What&apos;s New:</strong> This import will automatically fetch genres, styles from Discogs and calculate decade from release year for all items.
          </div>
        </div>
      )}
    </div>
  );
}