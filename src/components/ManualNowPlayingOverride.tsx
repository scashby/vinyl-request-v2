// src/components/ManualNowPlayingOverride.tsx
"use client";

import { useState } from 'react';
import { supabase } from 'lib/supabaseClient';
import Image from 'next/image';

interface FormData {
  artist: string;
  title: string;
  albumId: string;
}

interface SearchResult {
  id: number;
  artist: string;
  title: string;
  year: string;
  image_url?: string;
}

export default function ManualNowPlayingOverride() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState<FormData>({
    artist: '',
    title: '',
    albumId: ''
  });
  const [status, setStatus] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const searchCollection = async (query: string): Promise<void> => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('collection')
        .select('id, artist, title, year, image_url')
        .or(`artist.ilike.%${query}%, title.ilike.%${query}%`)
        .limit(10);

      if (!error) {
        setSearchResults(data || []);
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const selectAlbum = (album: SearchResult): void => {
    setFormData({
      artist: album.artist,
      title: album.title,
      albumId: album.id.toString()
    });
    setSearchResults([]);
  };

  const handleManualSet = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    if (!formData.artist || !formData.title) {
      setStatus('Please enter artist and title');
      return;
    }

    setStatus('Setting now playing...');

    try {
      const { error } = await supabase
        .from('now_playing')
        .upsert({
          id: 1,
          artist: formData.artist,
          title: formData.title,
          album_id: formData.albumId ? parseInt(formData.albumId) : null,
          started_at: new Date().toISOString(),
          recognition_confidence: 1.0,
          service_used: 'manual_override',
          updated_at: new Date().toISOString()
        });

      if (error) {
        setStatus(`Error: ${error.message}`);
      } else {
        setStatus('✅ Now playing updated successfully!');
        setTimeout(() => {
          setIsOpen(false);
          setStatus('');
          setFormData({ artist: '', title: '', albumId: '' });
        }, 2000);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`Error: ${errorMessage}`);
    }
  };

  const clearNowPlaying = async (): Promise<void> => {
    try {
      const { error } = await supabase
        .from('now_playing')
        .update({
          artist: null,
          title: null,
          album_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      if (!error) {
        setStatus('✅ Now playing cleared');
        setTimeout(() => setStatus(''), 2000);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`Error: ${errorMessage}`);
    }
  };

  const handleInputChange = (field: keyof FormData) => 
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      setFormData(prev => ({ ...prev, [field]: e.target.value }));
    };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>): void => {
    e.currentTarget.style.background = '#f3f4f6';
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>): void => {
    e.currentTarget.style.background = 'transparent';
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: '#7c3aed',
          color: 'white',
          border: 'none',
          borderRadius: '50px',
          padding: '16px 20px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        🎵 Manual Override
      </button>

      {/* Modal */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px'
            }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: 'bold',
                color: '#1f2937',
                margin: 0
              }}>
                Manual Now Playing Override
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '4px'
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleManualSet} style={{ marginBottom: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  Search Collection
                </label>
                <input
                  type="text"
                  placeholder="Search for album in your collection..."
                  onChange={(e) => searchCollection(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
                
                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div style={{
                    marginTop: '8px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    background: '#f9fafb'
                  }}>
                    {searchResults.map((album) => (
                      <div
                        key={album.id}
                        onClick={() => selectAlbum(album)}
                        style={{
                          padding: '12px',
                          borderBottom: '1px solid #e5e7eb',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px'
                        }}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                      >
                        {album.image_url && (
                          <Image
                            src={album.image_url}
                            alt={album.title}
                            width={40}
                            height={40}
                            style={{
                              objectFit: 'cover',
                              borderRadius: '4px'
                            }}
                            unoptimized
                          />
                        )}
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px' }}>
                            {album.title}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>
                            {album.artist} • {album.year}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  Artist *
                </label>
                <input
                  type="text"
                  value={formData.artist}
                  onChange={handleInputChange('artist')}
                  placeholder="Enter artist name"
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={handleInputChange('title')}
                  placeholder="Enter album/track title"
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'space-between'
              }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    background: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Set Now Playing
                </button>
                
                <button
                  type="button"
                  onClick={clearNowPlaying}
                  style={{
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Clear
                </button>
              </div>
            </form>

            {status && (
              <div style={{
                padding: '12px',
                borderRadius: '6px',
                fontSize: '14px',
                textAlign: 'center',
                background: status.includes('Error') ? '#fef2f2' : '#f0fdf4',
                color: status.includes('Error') ? '#dc2626' : '#16a34a',
                border: `1px solid ${status.includes('Error') ? '#fca5a5' : '#bbf7d0'}`
              }}>
                {status}
              </div>
            )}

            <div style={{
              marginTop: '20px',
              padding: '16px',
              background: '#fffbeb',
              border: '1px solid #fbbf24',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#92400e'
            }}>
              <strong>💡 Pro Tip:</strong> Use this when audio recognition fails or for testing the TV display. The manual override will appear immediately on your now-playing display.
            </div>
          </div>
        </div>
      )}
    </>
  );
}