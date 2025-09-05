// src/app/admin/import-discogs/page.tsx
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
};

type EnrichedRow = ProcessedRow & {
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
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
            'User-Agent': 'DeadwaxDialogues/1.0 +https://deadwaxdialogues.com',
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
            title: track.title || '',
            duration: track.duration || ''
          })));
        }
        
        return {
          image_url: Array.isArray(data.images) && data.images.length > 0 ? data.images[0].uri : null,
          tracklists: tracklistsStr
        };
        
      } catch (error) {
        console.error(`Attempt ${attempt + 1} failed for release ${releaseId}:`, error);
        if (attempt === retries - 1) {
          return { image_url: null, tracklists: null };
        }
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
          console.log('Sample row with Date Added:', {
            artist: results.data[0]?.Artist,
            title: results.data[0]?.Title,
            dateAdded: results.data[0]?.['Date Added']
          });

          const processedData: ProcessedRow[] = results.data
            .filter(row => row.Artist && row.Title && row.release_id)
            .map(row => ({
              artist: row.Artist,
              title: row.Title,
              year: row.Released || 0,
              format: row.Format || '',
              folder: row.CollectionFolder || '',
              media_condition: row['Collection Media Condition'] || '',
              discogs_release_id: String(row.release_id),
              date_added: parseDiscogsDate(row['Date Added']),
              image_url: null,
              tracklists: null
            }));

          const enrichedData: EnrichedRow[] = processedData.map(row => ({
            ...row,
            status: 'pending' as const
          }));

          setCsvPreview(enrichedData);
          setStatus(`Parsed ${enrichedData.length} rows. Ready to enrich with Discogs data.`);
        },
        error: (error) => {
          console.error('CSV parse error:', error);
          setStatus(`CSV parsing failed: ${error.message}`);
          setIsProcessing(false);
        }
      });
    } catch (error) {
      console.error('File processing error:', error);
      setStatus(`File processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsProcessing(false);
    }
  };

  const enrichWithDiscogsData = async () => {
    if (csvPreview.length === 0) return;
    
    setStatus('Enriching data with Discogs API...');
    const updatedData = [...csvPreview];
    
    for (let i = 0; i < updatedData.length; i++) {
      const row = updatedData[i];
      
      try {
        updatedData[i] = { ...row, status: 'processing' };
        setCsvPreview([...updatedData]);
        
        const { image_url, tracklists } = await fetchDiscogsData(row.discogs_release_id);
        
        updatedData[i] = {
          ...row,
          image_url,
          tracklists,
          status: 'success'
        };
        
        setStatus(`Enriched ${i + 1}/${updatedData.length} rows...`);
        setCsvPreview([...updatedData]);
        
        await delay(100);
        
      } catch (error) {
        console.error(`Error enriching row ${i}:`, error);
        updatedData[i] = {
          ...row,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        setCsvPreview([...updatedData]);
      }
    }
    
    setStatus(`Enrichment complete! ${updatedData.filter(r => r.status === 'success').length} successful enrichments.`);
  };

  const processAndInsertData = async () => {
    if (csvPreview.length === 0) return;
    
    setStatus('Inserting data...');
    const successfulInserts: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < csvPreview.length; i++) {
      const row = csvPreview[i];
      if (row.status !== 'success') continue;

      try {
        const discogsDate = parseDiscogsDate(row.date_added);
        
        const { data: existingItem, error: checkError } = await supabase
          .from('collection')
          .select('id, date_added')
          .eq('discogs_release_id', row.discogs_release_id)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }

        if (existingItem) {
          if (!existingItem.date_added) {
            const { error: updateError } = await supabase
              .from('collection')
              .update({ 
                date_added: discogsDate,
                image_url: row.image_url,
                tracklists: row.tracklists
              })
              .eq('id', existingItem.id);

            if (updateError) throw updateError;
            
            successfulInserts.push(`Updated date for: ${row.artist} - ${row.title}`);
          } else {
            successfulInserts.push(`Skipped (exists with date): ${row.artist} - ${row.title}`);
          }
        } else {
          const { error: insertError } = await supabase
            .from('collection')
            .insert({
              artist: row.artist,
              title: row.title,
              year: row.year,
              format: row.format,
              folder: row.folder,
              media_condition: row.media_condition,
              discogs_release_id: row.discogs_release_id,
              date_added: discogsDate,
              image_url: row.image_url,
              tracklists: row.tracklists
            });

          if (insertError) throw insertError;
          
          successfulInserts.push(`Inserted: ${row.artist} - ${row.title}`);
        }

      } catch (error) {
        console.error(`Error processing ${row.artist} - ${row.title}:`, error);
        errors.push(`${row.artist} - ${row.title}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    setStatus(`Import complete! ${successfulInserts.length} successful, ${errors.length} errors`);
    
    if (errors.length > 0) {
      setDebugInfo('Errors:\n' + errors.join('\n'));
    } else {
      setDebugInfo('All imports successful:\n' + successfulInserts.join('\n'));
    }
    
    setIsProcessing(false);
  };

  const resetPreview = () => {
    setCsvPreview([]);
    setStatus('');
    setDebugInfo('');
    setIsProcessing(false);
  };

  return (
    <div style={{ padding: 24, background: "#fff", color: "#222", minHeight: "100vh" }}>
      <h2 style={{ color: "#222", marginBottom: 24 }}>Import Discogs Collection</h2>
      
      <div style={{ marginBottom: 24 }}>
        <h3>Step 1: Upload CSV</h3>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          disabled={isProcessing}
          style={{ marginBottom: 16 }}
        />
        <p style={{ fontSize: 14, color: '#666' }}>
          Export your collection from Discogs as CSV and upload it here.
        </p>
      </div>

      {csvPreview.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3>Step 2: Enrich Data</h3>
          <button
            onClick={enrichWithDiscogsData}
            disabled={isProcessing}
            style={{
              padding: '8px 16px',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              marginRight: 12
            }}
          >
            {isProcessing ? 'Processing...' : 'Enrich with Discogs Data'}
          </button>
          
          <button
            onClick={processAndInsertData}
            disabled={isProcessing || csvPreview.filter(r => r.status === 'success').length === 0}
            style={{
              padding: '8px 16px',
              background: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              marginRight: 12
            }}
          >
            Insert to Database
          </button>
          
          <button
            onClick={resetPreview}
            style={{
              padding: '8px 16px',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            Reset
          </button>
        </div>
      )}

      {status && (
        <div style={{ marginBottom: 16, padding: 12, background: '#f3f4f6', borderRadius: 4 }}>
          <strong>Status:</strong> {status}
        </div>
      )}

      {debugInfo && (
        <div style={{ marginBottom: 16, padding: 12, background: '#fef3c7', borderRadius: 4 }}>
          <strong>Debug Info:</strong>
          <pre style={{ fontSize: 12, marginTop: 8, whiteSpace: 'pre-wrap' }}>{debugInfo}</pre>
        </div>
      )}

      {csvPreview.length > 0 && (
        <div>
          <h3>Preview ({csvPreview.length} items)</h3>
          <div style={{ overflowX: 'auto', maxHeight: 400, border: '1px solid #ddd' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
              <thead style={{ background: '#f5f5f5', position: 'sticky', top: 0 }}>
                <tr>
                  <th style={{ padding: '8px 4px', borderBottom: '1px solid #ddd' }}>Status</th>
                  <th style={{ padding: '8px 4px', borderBottom: '1px solid #ddd' }}>Artist</th>
                  <th style={{ padding: '8px 4px', borderBottom: '1px solid #ddd' }}>Title</th>
                  <th style={{ padding: '8px 4px', borderBottom: '1px solid #ddd' }}>Year</th>
                  <th style={{ padding: '8px 4px', borderBottom: '1px solid #ddd' }}>Format</th>
                  <th style={{ padding: '8px 4px', borderBottom: '1px solid #ddd' }}>Date Added</th>
                  <th style={{ padding: '8px 4px', borderBottom: '1px solid #ddd' }}>Release ID</th>
                </tr>
              </thead>
              <tbody>
                {csvPreview.map((row, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '4px', fontSize: 12 }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: 3,
                        fontSize: 11,
                        fontWeight: 'bold',
                        color: 'white',
                        background: row.status === 'success' ? '#059669' :
                                   row.status === 'processing' ? '#2563eb' :
                                   row.status === 'error' ? '#dc2626' : '#6b7280'
                      }}>
                        {row.status}
                      </span>
                    </td>
                    <td style={{ padding: '4px', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.artist}</td>
                    <td style={{ padding: '4px', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.title}</td>
                    <td style={{ padding: '4px' }}>{row.year}</td>
                    <td style={{ padding: '4px' }}>{row.format}</td>
                    <td style={{ padding: '4px', fontSize: 11 }}>
                      {new Date(row.date_added).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '4px', fontSize: 11 }}>{row.discogs_release_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}