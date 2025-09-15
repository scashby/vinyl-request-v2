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

type EnrichedRow = ProcessedRow;

// Type for existing database records
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
};

// Type for update operations
type UpdateOperation = {
  csvRow: ProcessedRow;
  existingRecord: ExistingRecord;
};

// Type for complete sync preview
type SyncPreview = {
  newItems: EnrichedRow[];
  updateOperations: UpdateOperation[];
  recordsToRemove: ExistingRecord[];
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
  const [syncPreview, setSyncPreview] = useState<SyncPreview | null>(null);
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
              .select('id, discogs_release_id, artist, title, date_added, folder, media_condition, image_url, tracklists')
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

          // Find items that need updates (folder/condition changes or missing images/tracklists)
          const updateOperations: UpdateOperation[] = [];
          for (const csvRow of processedRows) {
            const existingRecord = existingRecordsMap.get(csvRow.discogs_release_id);
            if (existingRecord) {
              const folderChanged = csvRow.folder !== existingRecord.folder;
              const conditionChanged = csvRow.media_condition !== existingRecord.media_condition;
              const needsImage = !existingRecord.image_url;
              const needsTracklists = !existingRecord.tracklists || existingRecord.tracklists === '' || existingRecord.tracklists === 'null';
              
              if (folderChanged || conditionChanged || needsImage || needsTracklists) {
                updateOperations.push({ csvRow, existingRecord });
                
                if (folderChanged || conditionChanged) {
                  console.log('Change detected:', {
                    releaseId: csvRow.discogs_release_id,
                    artist: csvRow.artist,
                    title: csvRow.title,
                    folderChange: folderChanged ? `${existingRecord.folder} → ${csvRow.folder}` : 'no change',
                    conditionChange: conditionChanged ? `${existingRecord.media_condition} → ${csvRow.media_condition}` : 'no change',
                    needsImage: needsImage,
                    needsTracklists: needsTracklists
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

          // Show comprehensive preview of ALL changes
          setSyncPreview({
            newItems: newRows,
            updateOperations,
            recordsToRemove
          });
          setStatus(`Preview ready: ${newRows.length} new items, ${updateOperations.length} updates, ${recordsToRemove.length} removals. Review all changes below.`);
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
    if (!syncPreview || syncPreview.newItems.length === 0) return;
    
    setIsProcessing(true);
    const BATCH_SIZE = 50; // Process 50 items at a time
    const totalItems = syncPreview.newItems.length;
    let allEnriched: EnrichedRow[] = [];
    
    // Get stored sync data
    const updateOperations = (window as Window & SyncDataStorage).updateOperations || [];
    const recordsToRemove = (window as Window & SyncDataStorage).recordsToRemove || [];
    
    setStatus(`Starting enrichment process for ${totalItems} new items, ${updateOperations.length} updates, ${recordsToRemove.length} removals`);

    try {
      // Process new items in batches
      for (let batchStart = 0; batchStart < totalItems; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, totalItems);
        const currentBatch = syncPreview.newItems.slice(batchStart, batchEnd);
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
        if (syncPreview) {
          setSyncPreview({
            ...syncPreview,
            newItems: allEnriched
          });
        }
        
        // Longer delay between batches to avoid rate limiting
        if (batchEnd < totalItems) {
          setStatus(`Batch ${batchNumber} saved. Waiting 10 seconds before next batch...`);
          await delay(10000);
        }
      }
      
      // Process updates with improved tracklist handling
      if (updateOperations.length > 0) {
        setStatus(`Processing ${updateOperations.length} update operations...`);
        
        for (let i = 0; i < updateOperations.length; i++) {
          const { csvRow, existingRecord } = updateOperations[i];
          setStatus(`Update ${i + 1}/${updateOperations.length}: ${csvRow.artist} - ${csvRow.title}`);
          
          let image_url = existingRecord.image_url;
          let tracklists = existingRecord.tracklists;
          
          // Check if we need to fetch missing data
          const needsImage = !image_url;
          const needsTracklists = !tracklists || tracklists === '' || tracklists === 'null';
          
          // Fetch missing image/tracklist data if needed
          if (needsImage || needsTracklists) {
            try {
              const discogsData = await fetchDiscogsData(csvRow.discogs_release_id);
              
              // Only update image_url if it was missing
              if (needsImage && discogsData.image_url) {
                image_url = discogsData.image_url;
              }
              
              // Only update tracklists if they were missing/invalid
              if (needsTracklists && discogsData.tracklists) {
                tracklists = discogsData.tracklists;
              }
              
              await delay(2000);
            } catch (error) {
              console.warn(`Failed to enrich ${csvRow.discogs_release_id}:`, error);
            }
          }
          
          // Build update object
          const updateData = {
            folder: csvRow.folder,
            media_condition: csvRow.media_condition,
            date_added: csvRow.date_added,
            image_url: image_url,
            tracklists: tracklists
          };
          
          const { error: updateError } = await supabase
            .from('collection')
            .update(updateData)
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

  const recoverMissingTracklists = async () => {
    setIsProcessing(true);
    setStatus('Finding items with missing tracklists...');
    
    try {
      // Find all items with discogs_release_id but missing/invalid tracklists
      const { data: itemsNeedingTracklists, error: queryError } = await supabase
        .from('collection')
        .select('id, discogs_release_id, artist, title, tracklists')
        .not('discogs_release_id', 'is', null)
        .neq('discogs_release_id', '');
      
      if (queryError) {
        setStatus(`Error querying database: ${queryError.message}`);
        return;
      }
      
      // Filter items that actually need tracklists
      const itemsToFix = itemsNeedingTracklists.filter(item => {
        if (!item.tracklists || item.tracklists === '' || item.tracklists === 'null') {
          return true;
        }
        
        try {
          const parsed = JSON.parse(item.tracklists);
          return !Array.isArray(parsed) || parsed.length === 0;
        } catch {
          return true; // Invalid JSON
        }
      });
      
      if (itemsToFix.length === 0) {
        setStatus('✅ No items found that need tracklist recovery!');
        setIsProcessing(false);
        return;
      }
      
      setStatus(`Found ${itemsToFix.length} items missing tracklists. Starting recovery...`);
      
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < itemsToFix.length; i++) {
        const item = itemsToFix[i];
        setStatus(`Recovering ${i + 1}/${itemsToFix.length}: ${item.artist} - ${item.title}`);
        
        try {
          const { tracklists } = await fetchDiscogsData(item.discogs_release_id);
          
          if (tracklists) {
            const { error: updateError } = await supabase
              .from('collection')
              .update({ tracklists })
              .eq('id', item.id);
            
            if (updateError) {
              console.warn(`Failed to update tracklists for ID ${item.id}:`, updateError);
              errorCount++;
            } else {
              successCount++;
            }
          } else {
            console.warn(`No tracklists found for ${item.discogs_release_id}`);
            errorCount++;
          }
          
          // Rate limiting
          await delay(2000);
          
        } catch (error) {
          console.warn(`Error processing item ID ${item.id}:`, error);
          errorCount++;
        }
      }
      
      setStatus(`✅ Tracklist recovery complete! ${successCount} recovered, ${errorCount} failed.`);
      
    } catch (error) {
      console.error('Tracklist recovery error:', error);
      setStatus(`❌ Recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ 
      padding: '2rem', 
      backgroundColor: '#ffffff', 
      minHeight: '100vh',
      color: '#212529'
    }}>
      <h1 style={{ color: '#212529', marginBottom: '1.5rem' }}>Import Discogs CSV</h1>
      <input 
        type="file" 
        accept=".csv" 
        onChange={handleFileUpload} 
        disabled={isProcessing}
        style={{
          padding: '8px 12px',
          border: '1px solid #ced4da',
          borderRadius: '6px',
          fontSize: '16px',
          backgroundColor: '#ffffff',
          color: '#212529'
        }}
      />
      
      {syncPreview && (
        <button 
          onClick={enrichAndImport}
          disabled={isProcessing}
          style={{ 
            marginLeft: '1rem', 
            padding: '12px 24px',
            backgroundColor: isProcessing ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            opacity: isProcessing ? 0.6 : 1,
            fontSize: '16px',
            fontWeight: '500'
          }}
        >
          {isProcessing ? 'Processing...' : 'Enrich with Discogs Data & Import'}
        </button>
      )}

      <button 
        onClick={recoverMissingTracklists}
        disabled={isProcessing}
        style={{ 
          marginLeft: '1rem', 
          padding: '12px 24px',
          backgroundColor: isProcessing ? '#6c757d' : '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: isProcessing ? 'not-allowed' : 'pointer',
          opacity: isProcessing ? 0.6 : 1,
          fontSize: '16px',
          fontWeight: '500'
        }}
      >
        {isProcessing ? 'Processing...' : 'Fix Missing Tracklists'}
      </button>
      
      <p style={{ 
        color: status.includes('error') || status.includes('failed') ? '#dc3545' : '#212529',
        fontWeight: status.includes('Successfully') ? 'bold' : 'normal',
        marginTop: '1rem',
        fontSize: '16px'
      }}>
        {status}
      </p>

      {debugInfo && (
        <details style={{ marginTop: '1.5rem', fontSize: '14px', color: '#6c757d' }}>
          <summary style={{ cursor: 'pointer', padding: '8px 0', color: '#212529' }}>Debug Info</summary>
          <pre style={{ 
            backgroundColor: '#f8f9fa', 
            color: '#212529',
            padding: '12px', 
            border: '1px solid #dee2e6', 
            borderRadius: '4px',
            marginTop: '8px',
            fontSize: '12px',
            overflow: 'auto'
          }}>{debugInfo}</pre>
        </details>
      )}

      {syncPreview && (
        <div style={{ backgroundColor: '#ffffff', color: '#212529' }}>
          <h2 style={{ color: '#212529', marginBottom: '1.5rem', marginTop: '2rem' }}>Sync Preview - All Changes</h2>
          
          {/* New Items Section - SHOW ALL ITEMS */}
          {syncPreview.newItems.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ color: '#28a745' }}>✅ Items to Add ({syncPreview.newItems.length})</h3>
              <table style={{ 
                marginTop: '0.5rem', 
                width: '100%', 
                borderCollapse: 'collapse',
                backgroundColor: '#ffffff'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#d4edda' }}>
                    <th style={{ textAlign: 'left', padding: '12px', border: '1px solid #c3e6cb', color: '#155724' }}>Artist</th>
                    <th style={{ textAlign: 'left', padding: '12px', border: '1px solid #c3e6cb', color: '#155724' }}>Title</th>
                    <th style={{ textAlign: 'left', padding: '12px', border: '1px solid #c3e6cb', color: '#155724' }}>Year</th>
                    <th style={{ textAlign: 'left', padding: '12px', border: '1px solid #c3e6cb', color: '#155724' }}>Format</th>
                    <th style={{ textAlign: 'left', padding: '12px', border: '1px solid #c3e6cb', color: '#155724' }}>Folder</th>
                    <th style={{ textAlign: 'left', padding: '12px', border: '1px solid #c3e6cb', color: '#155724' }}>Condition</th>
                    <th style={{ textAlign: 'left', padding: '12px', border: '1px solid #c3e6cb', color: '#155724' }}>Release ID</th>
                  </tr>
                </thead>
                <tbody>
                  {syncPreview.newItems.map((row, i) => (
                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8f9fa' }}>
                      <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#212529' }}>{row.artist}</td>
                      <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#212529' }}>{row.title}</td>
                      <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#212529' }}>{row.year}</td>
                      <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#212529' }}>{row.format}</td>
                      <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#212529' }}>{row.folder}</td>
                      <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#212529' }}>{row.media_condition}</td>
                      <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#212529' }}>{row.discogs_release_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Update Items Section - SHOW ALL UPDATES */}
          {syncPreview.updateOperations.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ color: '#fd7e14' }}>⚠️ Items to Update ({syncPreview.updateOperations.length})</h3>
              <table style={{ 
                marginTop: '0.5rem', 
                width: '100%', 
                borderCollapse: 'collapse',
                backgroundColor: '#ffffff'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#fff3cd' }}>
                    <th style={{ textAlign: 'left', padding: '12px', border: '1px solid #ffeaa7', color: '#856404' }}>Artist</th>
                    <th style={{ textAlign: 'left', padding: '12px', border: '1px solid #ffeaa7', color: '#856404' }}>Title</th>
                    <th style={{ textAlign: 'left', padding: '12px', border: '1px solid #ffeaa7', color: '#856404' }}>Release ID</th>
                    <th style={{ textAlign: 'left', padding: '12px', border: '1px solid #ffeaa7', color: '#856404' }}>Folder Change</th>
                    <th style={{ textAlign: 'left', padding: '12px', border: '1px solid #ffeaa7', color: '#856404' }}>Condition Change</th>
                    <th style={{ textAlign: 'left', padding: '12px', border: '1px solid #ffeaa7', color: '#856404' }}>Will Fetch Image</th>
                    <th style={{ textAlign: 'left', padding: '12px', border: '1px solid #ffeaa7', color: '#856404' }}>Will Fetch Tracklists</th>
                  </tr>
                </thead>
                <tbody>
                  {syncPreview.updateOperations.map((op, i) => {
                    const folderChanged = op.csvRow.folder !== op.existingRecord.folder;
                    const conditionChanged = op.csvRow.media_condition !== op.existingRecord.media_condition;
                    const needsImage = !op.existingRecord.image_url;
                    const needsTracklists = !op.existingRecord.tracklists || op.existingRecord.tracklists === '' || op.existingRecord.tracklists === 'null';
                    return (
                      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8f9fa' }}>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#212529' }}>{op.csvRow.artist}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#212529' }}>{op.csvRow.title}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#212529' }}>{op.csvRow.discogs_release_id}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#212529' }}>
                          {folderChanged ? (
                            <span style={{ color: '#fd7e14', fontWeight: 'bold' }}>
                              {op.existingRecord.folder || '(none)'} → {op.csvRow.folder}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#212529' }}>
                          {conditionChanged ? (
                            <span style={{ color: '#fd7e14', fontWeight: 'bold' }}>
                              {op.existingRecord.media_condition || '(none)'} → {op.csvRow.media_condition}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#212529' }}>{needsImage ? '✓' : '—'}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#212529' }}>{needsTracklists ? '✓' : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Remove Items Section - SHOW ALL DELETIONS */}
          {syncPreview.recordsToRemove.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ color: '#dc3545' }}>🗑️ Items to Remove ({syncPreview.recordsToRemove.length})</h3>
              <div style={{ 
                backgroundColor: '#f8d7da', 
                color: '#721c24', 
                padding: '12px', 
                marginBottom: '12px', 
                border: '1px solid #f5c6cb', 
                borderRadius: '4px' 
              }}>
                <strong>⚠️ WARNING:</strong> These records exist in your database but are NOT in the current CSV. They will be PERMANENTLY DELETED.
              </div>
              <table style={{ 
                marginTop: '0.5rem', 
                width: '100%', 
                borderCollapse: 'collapse',
                backgroundColor: '#ffffff'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8d7da' }}>
                    <th style={{ textAlign: 'left', padding: '12px', border: '1px solid #f5c6cb', color: '#721c24' }}>Artist</th>
                    <th style={{ textAlign: 'left', padding: '12px', border: '1px solid #f5c6cb', color: '#721c24' }}>Title</th>
                    <th style={{ textAlign: 'left', padding: '12px', border: '1px solid #f5c6cb', color: '#721c24' }}>Release ID</th>
                    <th style={{ textAlign: 'left', padding: '12px', border: '1px solid #f5c6cb', color: '#721c24' }}>Folder</th>
                    <th style={{ textAlign: 'left', padding: '12px', border: '1px solid #f5c6cb', color: '#721c24' }}>Condition</th>
                    <th style={{ textAlign: 'left', padding: '12px', border: '1px solid #f5c6cb', color: '#721c24' }}>Date Added</th>
                  </tr>
                </thead>
                <tbody>
                  {syncPreview.recordsToRemove.map((record, i) => (
                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8f9fa' }}>
                      <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#212529' }}>{record.artist || '—'}</td>
                      <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#212529' }}>{record.title || '—'}</td>
                      <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#212529' }}>{record.discogs_release_id}</td>
                      <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#212529' }}>{record.folder || '—'}</td>
                      <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#212529' }}>{record.media_condition || '—'}</td>
                      <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#212529' }}>{record.date_added ? new Date(record.date_added).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          <div style={{ 
            padding: '16px', 
            backgroundColor: '#f8f9fa', 
            color: '#495057',
            border: '1px solid #dee2e6', 
            borderRadius: '6px',
            marginTop: '2rem'
          }}>
            <strong>Summary:</strong> This operation will make {
              syncPreview.newItems.length + syncPreview.updateOperations.length + syncPreview.recordsToRemove.length
            } total changes to your collection.
          </div>
        </div>
      )}
    </div>
  );
}