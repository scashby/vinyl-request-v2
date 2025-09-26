// src/app/admin/cd-only-checker/page.tsx
'use client';

import { useState } from 'react';
import { supabase } from 'src/lib/supabaseClient';

type DiscogsFormat = {
  name?: string;
};

type DiscogsVersion = {
  format?: string[];
};

type DiscogsResponse = {
  formats?: DiscogsFormat[];
  master_id?: number;
  versions?: {
    results?: DiscogsVersion[];
  };
};

type CDOnlyResult = {
  id: number;
  artist: string;
  title: string;
  year: number;
  discogs_master_id: number;
  discogs_release_id: number;
  available_formats: string[];
  is_cd_only: boolean;
};

type CheckResult = {
  cd_only_albums: CDOnlyResult[];
  has_vinyl_albums: CDOnlyResult[];
  errors: Array<{album: string, error: string}>;
  summary: {
    total_cds: number;
    cd_only_count: number;
    has_vinyl_count: number;
    error_count: number;
  };
};

export default function CDOnlyChecker() {
  const [results, setResults] = useState<CheckResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const checkAlbumFormats = async (album: {
    id: number;
    artist: string;
    title: string;
    year: number;
    discogs_master_id: number | null;
    discogs_release_id: number | null;
  }): Promise<CDOnlyResult> => {
    const masterId = album.discogs_master_id || album.discogs_release_id;
    
    if (!masterId) {
      return {
        id: album.id,
        artist: album.artist,
        title: album.title,
        year: album.year,
        discogs_master_id: album.discogs_master_id,
        discogs_release_id: album.discogs_release_id,
        available_formats: ['Unknown'],
        is_cd_only: false
      };
    }

    try {
      // Use your existing proxy route
      const response = await fetch(`/api/discogsProxy?releaseId=${masterId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data: DiscogsResponse = await response.json();
      
      // If this is a release (not master), we need to get the master
      let masterData: DiscogsResponse = data;
      if (data.master_id && data.master_id !== masterId) {
        const masterResponse = await fetch(`/api/discogsProxy?releaseId=${data.master_id}`);
        if (masterResponse.ok) {
          // Get all versions of the master release through the proxy
          const masterVersionsResponse = await fetch(`/api/discogsProxy?releaseId=${data.master_id}&type=master`);
          
          if (masterVersionsResponse.ok) {
            const versionsData: DiscogsResponse = await masterVersionsResponse.json();
            masterData = versionsData;
          }
        }
      }
      
      // Extract available formats
      const availableFormats = new Set<string>();
      
      // Check current release format
      if (data.formats) {
        data.formats.forEach((format: DiscogsFormat) => {
          if (format.name) {
            availableFormats.add(format.name.toLowerCase());
          }
        });
      }
      
      // Check all versions if we have master data
      if (masterData.versions && masterData.versions.results) {
        masterData.versions.results.forEach((version: DiscogsVersion) => {
          if (version.format) {
            version.format.forEach((format: string) => {
              availableFormats.add(format.toLowerCase());
            });
          }
        });
      }
      
      const formatArray = Array.from(availableFormats);
      
      // Determine if CD-only (has CD but no vinyl formats)
      const hasCD = formatArray.some(f => f.includes('cd'));
      const hasVinyl = formatArray.some(f => 
        f.includes('vinyl') || 
        f.includes('lp') || 
        f.includes('12"') ||
        f.includes('album') // Sometimes vinyl is just marked as "Album"
      );
      
      return {
        id: album.id,
        artist: album.artist,
        title: album.title,
        year: album.year,
        discogs_master_id: album.discogs_master_id,
        discogs_release_id: album.discogs_release_id,
        available_formats: formatArray,
        is_cd_only: hasCD && !hasVinyl
      };
      
    } catch (error) {
      console.error(`Error checking ${album.artist} - ${album.title}:`, error);
      return {
        id: album.id,
        artist: album.artist,
        title: album.title,
        year: album.year,
        discogs_master_id: album.discogs_master_id,
        discogs_release_id: album.discogs_release_id,
        available_formats: ['Error'],
        is_cd_only: false
      };
    }
  };

  const runCDOnlyCheck = async () => {
    setIsProcessing(true);
    setStatus('Fetching CD collection from database...');
    setProgress(0);
    
    try {
      // Get all CDs from your collection
      const { data: cdAlbums, error } = await supabase
        .from('collection')
        .select('id, artist, title, year, discogs_master_id, discogs_release_id')
        .eq('folder', 'CDs')
        .not('discogs_release_id', 'is', null);
      
      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }
      
      if (!cdAlbums || cdAlbums.length === 0) {
        setStatus('No CDs found in collection');
        setIsProcessing(false);
        return;
      }
      
      setStatus(`Found ${cdAlbums.length} CDs. Checking formats...`);
      
      const results: CDOnlyResult[] = [];
      const errors: Array<{album: string, error: string}> = [];
      
      // Process in smaller batches to avoid rate limiting
      const BATCH_SIZE = 5;
      for (let i = 0; i < cdAlbums.length; i += BATCH_SIZE) {
        const batch = cdAlbums.slice(i, Math.min(i + BATCH_SIZE, cdAlbums.length));
        
        setStatus(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(cdAlbums.length/BATCH_SIZE)}`);
        setProgress((i / cdAlbums.length) * 100);
        
        const batchPromises = batch.map(album => checkAlbumFormats(album));
        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach((result) => {
          if (result.available_formats.includes('Error')) {
            errors.push({
              album: `${result.artist} - ${result.title}`,
              error: 'Failed to fetch Discogs data'
            });
          } else {
            results.push(result);
          }
        });
        
        // Rate limiting - wait 5 seconds between batches
        if (i + BATCH_SIZE < cdAlbums.length) {
          await delay(5000);
        }
      }
      
      // Categorize results
      const cd_only_albums = results.filter(r => r.is_cd_only);
      const has_vinyl_albums = results.filter(r => !r.is_cd_only);
      
      const finalResults: CheckResult = {
        cd_only_albums,
        has_vinyl_albums,
        errors,
        summary: {
          total_cds: cdAlbums.length,
          cd_only_count: cd_only_albums.length,
          has_vinyl_count: has_vinyl_albums.length,
          error_count: errors.length
        }
      };
      
      setResults(finalResults);
      setStatus(`✅ Complete! Found ${cd_only_albums.length} CD-only albums out of ${cdAlbums.length} total CDs`);
      setProgress(100);
      
    } catch (error) {
      console.error('CD-only check failed:', error);
      setStatus(`❌ Check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ padding: '2rem', backgroundColor: '#ffffff', minHeight: '100vh', color: '#212529' }}>
      <h1 style={{ color: '#212529', marginBottom: '1.5rem' }}>CD-Only Album Finder</h1>
      
      <p style={{ marginBottom: '1.5rem', color: '#6c757d' }}>
        This will check all CDs in your collection against Discogs to find albums that were never released on vinyl.
      </p>
      
      <button
        onClick={runCDOnlyCheck}
        disabled={isProcessing}
        style={{
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
        {isProcessing ? 'Checking...' : 'Find CD-Only Albums'}
      </button>
      
      {isProcessing && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#e9ecef',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              backgroundColor: '#007bff',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <p style={{ marginTop: '0.5rem', fontSize: '14px', color: '#6c757d' }}>
            {Math.round(progress)}% complete
          </p>
        </div>
      )}
      
      <p style={{ 
        color: status.includes('❌') ? '#dc3545' : '#212529',
        fontWeight: status.includes('✅') ? 'bold' : 'normal',
        marginTop: '1rem',
        fontSize: '16px'
      }}>
        {status}
      </p>
      
      {results && (
        <div style={{ marginTop: '2rem' }}>
          <div style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '1rem', 
            borderRadius: '6px',
            marginBottom: '2rem'
          }}>
            <h3 style={{ color: '#212529', marginBottom: '1rem' }}>Summary</h3>
            <p><strong>Total CDs checked:</strong> {results.summary.total_cds}</p>
            <p><strong>CD-only albums:</strong> {results.summary.cd_only_count}</p>
            <p><strong>Also available on vinyl:</strong> {results.summary.has_vinyl_count}</p>
            <p><strong>Errors:</strong> {results.summary.error_count}</p>
          </div>
          
          {results.cd_only_albums.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ color: '#dc3545', marginBottom: '1rem' }}>
                🎯 CD-Only Albums ({results.cd_only_albums.length})
              </h3>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                backgroundColor: '#ffffff'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8d7da' }}>
                    <th style={{ padding: '12px', border: '1px solid #f5c6cb', textAlign: 'left' }}>Artist</th>
                    <th style={{ padding: '12px', border: '1px solid #f5c6cb', textAlign: 'left' }}>Title</th>
                    <th style={{ padding: '12px', border: '1px solid #f5c6cb', textAlign: 'left' }}>Year</th>
                    <th style={{ padding: '12px', border: '1px solid #f5c6cb', textAlign: 'left' }}>Available Formats</th>
                  </tr>
                </thead>
                <tbody>
                  {results.cd_only_albums.map((album, i) => (
                    <tr key={album.id} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8f9fa' }}>
                      <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>{album.artist}</td>
                      <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>{album.title}</td>
                      <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>{album.year}</td>
                      <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>{album.available_formats.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {results.errors.length > 0 && (
            <div>
              <h3 style={{ color: '#ffc107', marginBottom: '1rem' }}>
                ⚠️ Errors ({results.errors.length})
              </h3>
              <ul>
                {results.errors.map((error, i) => (
                  <li key={i} style={{ color: '#856404' }}>
                    {error.album}: {error.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}