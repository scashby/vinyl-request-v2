// src/components/AlbumContextManager.tsx - Standalone Album Context Manager
"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from 'lib/supabaseClient';
import Image from 'next/image';

interface AlbumContext {
  id: number;
  artist: string;
  title: string;
  year: string;
  image_url?: string;
  folder?: string;
  collection_id?: number;
  track_count?: number;
  track_listing?: string[];
  source?: string;
  created_at: string;
  updated_at: string;
}

interface SearchResult {
  artist: string;
  title: string;
  album?: string;
  image_url?: string;
  track_count?: number;
  track_listing?: string[];
  service?: string;
}

export default function AlbumContextManager() {
  const [currentContext, setCurrentContext] = useState<AlbumContext | null>(null);
  const [searchArtist, setSearchArtist] = useState<string>('');
  const [searchAlbum, setSearchAlbum] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<string>('');
  const [showTrackListing, setShowTrackListing] = useState<boolean>(false);

  const clearContext = useCallback(async (): Promise<void> => {
    try {
      await supabase.from('album_context').delete().neq('id', 0);
      setCurrentContext(null);
      setStatus('Album context cleared');
    } catch (error) {
      console.error('Error clearing context:', error);
      setStatus('Error clearing context');
    }
  }, []);

  const loadCurrentContext = useCallback(async (): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('album_context')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        // Check if context is still valid
        const contextAge = Date.now() - new Date(data.created_at).getTime();
        const maxAge = 2 * 60 * 60 * 1000; // 2 hours

        if (contextAge <= maxAge) {
          setCurrentContext(data);
        } else {
          await clearContext();
        }
      } else {
        setCurrentContext(null);
      }
    } catch (error) {
      console.error('Error loading context:', error);
      setCurrentContext(null);
    }
  }, [clearContext]);

  useEffect(() => {
    loadCurrentContext();
    
    // Subscribe to context changes
    const channel = supabase
      .channel('album_context_manager')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'album_context' },
        () => {
          loadCurrentContext();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadCurrentContext]);

  const searchForAlbum = async (): Promise<void> => {
    if (!searchArtist.trim()) {
      setStatus('Please enter an artist name');
      return;
    }

    setIsSearching(true);
    setStatus('Searching for albums...');
    setSearchResults([]);

    try {
      const response = await fetch('/api/manual-recognition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          artist: searchArtist.trim(),
          album: searchAlbum.trim() || undefined,
          setAsContext: false // We'll set context manually after selection
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        const results = [result.track, ...(result.candidates || [])];
        setSearchResults(results);
        setStatus(`Found ${results.length} album${results.length !== 1 ? 's' : ''}`);
      } else {
        setStatus(result.error || 'No albums found');
        setSearchResults([]);
      }
    } catch (error: unknown) {
      console.error('Search error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`Search error: ${errorMessage}`);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const setAlbumContext = async (album: SearchResult): Promise<void> => {
    setStatus('Setting album context...');

    try {
      // Check for collection match
      const { data: collectionMatch } = await supabase
        .from('collection')
        .select('*')
        .ilike('artist', album.artist)
        .ilike('title', album.album || album.title)
        .limit(1);

      const albumContextData = {
        artist: album.artist,
        title: album.album || album.title,
        year: new Date().getFullYear().toString(), // Could be enhanced to get actual year
        image_url: album.image_url,
        folder: collectionMatch?.[0]?.folder || null,
        collection_id: collectionMatch?.[0]?.id || null,
        track_count: album.track_count || 0,
        track_listing: album.track_listing || [],
        source: album.service || 'manual',
        created_at: new Date().toISOString()
      };

      // Clear existing context and set new one
      await supabase.from('album_context').delete().neq('id', 0);
      const { error } = await supabase.from('album_context').insert(albumContextData);

      if (error) {
        throw error;
      }

      setStatus(`✅ Album context set: ${album.artist} - ${album.album || album.title}`);
      setSearchResults([]);
      setSearchArtist('');
      setSearchAlbum('');
      
      // Reload context
      await loadCurrentContext();
    } catch (error: unknown) {
      console.error('Error setting context:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`Error setting context: ${errorMessage}`);
    }
  };

  const getContextAge = (): string => {
    if (!currentContext?.created_at) return '';
    
    const age = Date.now() - new Date(currentContext.created_at).getTime();
    const minutes = Math.floor(age / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ago`;
    }
    return `${minutes}m ago`;
  };

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      padding: 24,
      marginBottom: 24
    }}>
      <h2 style={{ 
        margin: '0 0 20px 0', 
        fontSize: '20px', 
        fontWeight: 'bold',
        color: '#1f2937'
      }}>
        Album Context Manager
      </h2>

      {/* Current Context Display */}
      {currentContext ? (
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #22c55e',
          borderRadius: 8,
          padding: 20,
          marginBottom: 24,
          display: 'flex',
          gap: 16,
          alignItems: 'center'
        }}>
          {currentContext.image_url && (
            <Image
              src={currentContext.image_url}
              alt={currentContext.title}
              width={80}
              height={80}
              style={{
                objectFit: 'cover',
                borderRadius: 8,
                flexShrink: 0
              }}
              unoptimized
            />
          )}
          <div style={{ flex: 1 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8
            }}>
              <span style={{ fontSize: 18 }}>🎯</span>
              <h3 style={{ 
                margin: 0, 
                color: '#16a34a', 
                fontSize: '16px' 
              }}>
                Active Album Context
              </h3>
            </div>
            <div style={{ 
              fontSize: '16px', 
              fontWeight: 600, 
              marginBottom: 4 
            }}>
              {currentContext.artist} - {currentContext.title}
            </div>
            <div style={{ 
              fontSize: '14px', 
              color: '#666', 
              marginBottom: 8 
            }}>
              {currentContext.track_count && currentContext.track_count > 0 ? 
                `${currentContext.track_count} tracks` : 
                'Track count unknown'
              } • 
              {currentContext.folder && ` ${currentContext.folder} • `}
              Set {getContextAge()} • 
              Source: {currentContext.source || 'unknown'}
            </div>
            
            {currentContext.track_listing && currentContext.track_listing.length > 0 && (
              <div>
                <button
                  onClick={() => setShowTrackListing(!showTrackListing)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#16a34a',
                    fontSize: '12px',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0
                  }}
                >
                  {showTrackListing ? 'Hide' : 'Show'} track listing ({currentContext.track_listing.length} tracks)
                </button>
                
                {showTrackListing && (
                  <div style={{
                    marginTop: 8,
                    padding: 12,
                    background: 'rgba(34, 197, 94, 0.1)',
                    borderRadius: 6,
                    fontSize: '12px',
                    maxHeight: 150,
                    overflowY: 'auto'
                  }}>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: 8
                    }}>
                      {currentContext.track_listing.map((track, index) => (
                        <div key={index} style={{ color: '#065f46' }}>
                          {index + 1}. {track}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={clearContext}
            style={{
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            Clear
          </button>
        </div>
      ) : (
        <div style={{
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
          fontSize: '14px',
          color: '#92400e'
        }}>
          <strong>No album context active.</strong> Search for an album below to set context for improved track recognition.
        </div>
      )}

      {/* Search Interface */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: 20
      }}>
        <h3 style={{ 
          margin: '0 0 16px 0', 
          fontSize: '16px', 
          color: '#374151' 
        }}>
          Search for Album
        </h3>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr auto',
          gap: 12,
          marginBottom: 16,
          alignItems: 'end'
        }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: 4
            }}>
              Artist *
            </label>
            <input
              type="text"
              value={searchArtist}
              onChange={(e) => setSearchArtist(e.target.value)}
              placeholder="e.g. Traffic"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                fontSize: 14
              }}
            />
          </div>
          
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: 4
            }}>
              Album (optional)
            </label>
            <input
              type="text"
              value={searchAlbum}
              onChange={(e) => setSearchAlbum(e.target.value)}
              placeholder="e.g. Mr. Fantasy"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                fontSize: 14
              }}
            />
          </div>
          
          <button
            onClick={searchForAlbum}
            disabled={!searchArtist.trim() || isSearching}
            style={{
              background: searchArtist.trim() && !isSearching ? '#2563eb' : '#9ca3af',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: 4,
              fontSize: 14,
              fontWeight: 600,
              cursor: searchArtist.trim() && !isSearching ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap'
            }}
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {status && (
          <div style={{
            padding: 12,
            borderRadius: 4,
            fontSize: 14,
            marginBottom: 16,
            background: status.includes('Error') || status.includes('No albums') ? '#fef2f2' : '#f0fdf4',
            color: status.includes('Error') || status.includes('No albums') ? '#dc2626' : '#16a34a',
            border: `1px solid ${status.includes('Error') || status.includes('No albums') ? '#fca5a5' : '#bbf7d0'}`
          }}>
            {status}
          </div>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div>
            <h4 style={{ 
              margin: '0 0 12px 0', 
              fontSize: '14px', 
              color: '#374151',
              fontWeight: 600
            }}>
              Found {searchResults.length} album{searchResults.length !== 1 ? 's' : ''}:
            </h4>
            <div style={{
              display: 'grid',
              gap: 12
            }}>
              {searchResults.map((album, index) => (
                <div
                  key={index}
                  style={{
                    background: '#fff',
                    border: '2px solid #e5e7eb',
                    borderRadius: 8,
                    padding: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setAlbumContext(album)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#2563eb';
                    e.currentTarget.style.background = '#eff6ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.background = '#fff';
                  }}
                >
                  {album.image_url && (
                    <Image
                      src={album.image_url}
                      alt={album.album || album.title}
                      width={60}
                      height={60}
                      style={{
                        objectFit: 'cover',
                        borderRadius: 6,
                        flexShrink: 0
                      }}
                      unoptimized
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontWeight: 600, 
                      marginBottom: 4,
                      fontSize: 14
                    }}>
                      {album.album || album.title}
                    </div>
                    <div style={{ 
                      fontSize: 12, 
                      color: '#666',
                      marginBottom: 4
                    }}>
                      {album.artist}
                    </div>
                    <div style={{ 
                      fontSize: 11, 
                      color: '#888' 
                    }}>
                      {album.track_count && album.track_count > 0 ? 
                        `${album.track_count} tracks` : 
                        'Track count unknown'
                      } • Source: {album.service || 'Unknown'}
                    </div>
                  </div>
                  <div style={{
                    background: '#2563eb',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600
                  }}>
                    SET CONTEXT
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}