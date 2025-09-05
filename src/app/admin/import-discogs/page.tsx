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

interface DiscogsTrack {
  position?: string;
  title?: string;
  duration?: string;
}

interface DiscogsRelease {
  tracklist?: DiscogsTrack[];
  images?: { uri: string }[];
}

interface PapaParseResult {
  data: DiscogsCSVRow[];
  meta: { fields?: string[] };
  errors: Error[];
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
  const [csvData, setCsvData] = useState<DiscogsCSVRow[]>([]);
  const [enrichedData, setEnrichedData] = useState<EnrichedRow[]>([]);
  const [status, setStatus] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const fetchDiscogsData = async (releaseId: string): Promise<{ image_url: string | null; tracklists: string | null }> => {
    try {
      const response = await fetch(`https://api.discogs.com/releases/${releaseId}`, {
        headers: {
          'User-Agent': 'DeadwaxDialogues/1.0 +https://deadwaxdialogues.com',
          'Authorization': `Discogs token=${process.env.NEXT_PUBLIC_DISCOGS_TOKEN}`
        }
      });
      
      if (!response.ok) {
        console.warn(`Failed to fetch release ${releaseId}, status: ${response.status}`);
        return { image_url: null, tracklists: null };
      }
      
      const data: DiscogsRelease = await response.json();
      
      let tracklistsStr: string | null = null;
      if (Array.isArray(data.tracklist) && data.tracklist.length > 0) {
        tracklistsStr = JSON.stringify(data.tracklist.map((track: DiscogsTrack) => ({
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
      console.error(`Error fetching release ${releaseId}:`, error);
      return { image_url: null, tracklists: null };
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('Parsing CSV...');
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results: PapaParseResult) => {
        const data = results.data as DiscogsCSVRow[];
        setCsvData(data.filter(row => row.Artist && row.Title && row.release_id));
        setStatus(`Parsed ${data.length} rows from CSV`);
      },
      error: (error: Error) => {
        setStatus(`Error parsing CSV: ${error.message}`);
      }
    });
  };

  const processAndEnrichData = async () => {
    if (csvData.length === 0) return;
    
    setIsProcessing(true);
    setStatus('Processing and enriching data...');
    
    const processed: EnrichedRow[] = [];
    
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      
      try {
        setStatus(`Processing ${i + 1}/${csvData.length}: ${row.Artist} - ${row.Title}`);
        
        const processedRow: ProcessedRow = {
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
        };
        
        const { image_url, tracklists } = await fetchDiscogsData(processedRow.discogs_release_id);
        
        processed.push({
          ...processedRow,
          image_url,
          tracklists,
          status: 'success'
        });
        
        await delay(100);
        
      } catch (error) {
        processed.push({
          artist: row.Artist,
          title: row.Title,
          year: row.Released || 0,
          format: row.Format || '',
          folder: row.CollectionFolder || '',
          media_condition: row['Collection Media Condition'] || '',
          discogs_release_id: String(row.release_id),
          date_added: parseDiscogsDate(row['Date Added']),
          image_url: null,
          tracklists: null,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    setEnrichedData(processed);
    setStatus(`Processing complete. ${processed.filter(r => r.status === 'success').length} successful, ${processed.filter(r => r.status === 'error').length} errors.`);
    setIsProcessing(false);
  };

  const insertToDatabase = async () => {
    if (enrichedData.length === 0) return;
    
    setIsProcessing(true);
    setStatus('Inserting to database...');
    
    const results: string[] = [];
    
    for (let i = 0; i < enrichedData.length; i++) {
      const row = enrichedData[i];
      
      try {
        const { data: existing, error: checkError } = await supabase
          .from('collection')
          .select('id, date_added')
          .eq('discogs_release_id', row.discogs_release_id)
          .single();
        
        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }
        
        if (existing) {
          if (!existing.date_added) {
            const { error: updateError } = await supabase
              .from('collection')
              .update({ 
                date_added: row.date_added,
                image_url: row.image_url,
                tracklists: row.tracklists
              })
              .eq('id', existing.id);
            
            if (updateError) throw updateError;
            results.push(`Updated: ${row.artist} - ${row.title}`);
          } else {
            results.push(`Skipped (exists): ${row.artist} - ${row.title}`);
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
              date_added: row.date_added,
              image_url: row.image_url,
              tracklists: row.tracklists
            });
          
          if (insertError) throw insertError;
          results.push(`Inserted: ${row.artist} - ${row.title}`);
        }
        
      } catch (error) {
        results.push(`Error: ${row.artist} - ${row.title} - ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    setDebugInfo(results.join('\n'));
    setStatus('Database insertion complete');
    setIsProcessing(false);
  };

  return (
    <div style={{ padding: 24, background: "#fff", color: "#222", minHeight: "100vh" }}>
      <h2 style={{ color: "#222", marginBottom: 24 }}>Import Discogs Collection</h2>
      
      <div style={{ marginBottom: 24 }}>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          disabled={isProcessing}
        />
        <p style={{ fontSize: 14, color: '#666', marginTop: 8 }}>
          Upload your Discogs collection CSV export
        </p>
      </div>

      {csvData.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={processAndEnrichData}
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
            Process & Enrich Data
          </button>
          
          {enrichedData.length > 0 && (
            <button
              onClick={insertToDatabase}
              disabled={isProcessing}
              style={{
                padding: '8px 16px',
                background: '#059669',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: isProcessing ? 'not-allowed' : 'pointer'
              }}
            >
              Insert to Database
            </button>
          )}
        </div>
      )}

      {status && (
        <div style={{ marginBottom: 16, padding: 12, background: '#f3f4f6', borderRadius: 4 }}>
          <strong>Status:</strong> {status}
        </div>
      )}

      {debugInfo && (
        <div style={{ marginBottom: 16, padding: 12, background: '#fef3c7', borderRadius: 4 }}>
          <strong>Results:</strong>
          <pre style={{ fontSize: 12, marginTop: 8, whiteSpace: 'pre-wrap' }}>{debugInfo}</pre>
        </div>
      )}

      {enrichedData.length > 0 && (
        <div>
          <h3>Preview ({enrichedData.length} items)</h3>
          <div style={{ overflowX: 'auto', maxHeight: 400, border: '1px solid #ddd' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
              <thead style={{ background: '#f5f5f5' }}>
                <tr>
                  <th style={{ padding: '8px 4px', borderBottom: '1px solid #ddd' }}>Status</th>
                  <th style={{ padding: '8px 4px', borderBottom: '1px solid #ddd' }}>Artist</th>
                  <th style={{ padding: '8px 4px', borderBottom: '1px solid #ddd' }}>Title</th>
                  <th style={{ padding: '8px 4px', borderBottom: '1px solid #ddd' }}>Year</th>
                  <th style={{ padding: '8px 4px', borderBottom: '1px solid #ddd' }}>Date Added</th>
                </tr>
              </thead>
              <tbody>
                {enrichedData.map((row, index) => (
                  <tr key={index}>
                    <td style={{ padding: '4px' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: 3,
                        fontSize: 11,
                        fontWeight: 'bold',
                        color: 'white',
                        background: row.status === 'success' ? '#059669' : '#dc2626'
                      }}>
                        {row.status}
                      </span>
                    </td>
                    <td style={{ padding: '4px' }}>{row.artist}</td>
                    <td style={{ padding: '4px' }}>{row.title}</td>
                    <td style={{ padding: '4px' }}>{row.year}</td>
                    <td style={{ padding: '4px', fontSize: 11 }}>
                      {new Date(row.date_added).toLocaleDateString()}
                    </td>
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