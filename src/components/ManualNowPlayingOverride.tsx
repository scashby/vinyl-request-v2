// src/components/ManualNowPlayingOverride.tsx - Enhanced manual override with better search
"use client";

import { useState } from 'react';
import { supabase } from 'lib/supabaseClient';
import Image from 'next/image';

interface FormData {
  artist: string;
  title: string;
  albumTitle: string;
  albumId: string;
}

interface SearchResult {
  id: number;
  artist: string;
  title: string;
  year: string;
  image_url?: string;
  folder?: string;
}

export default function ManualNowPlayingOverride() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState<FormData>({
    artist: '',
    title: '',
    albumTitle: '',
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
      const { data } = await supabase
        .from('collection')
        .select('id, artist, title, year, image_url, folder')
        .or(`artist.ilike.%${query}%, title.ilike.%${query}%`)
        .limit(10);

      setSearchResults(data || []);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const selectAlbum = (album: SearchResult): void => {
    setFormData({
      artist: album.artist,
      title: formData.title || 'Album',
      albumTitle: album.title,
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
      // Enhanced now playing update with all fields
      const { error } = await supabase
        .from('now_playing')
        .upsert({
          id: 1,
          artist: formData.artist,
          title: formData.title,
          album_title: formData.albumTitle || null,
          album_id: formData.albumId ? parseInt(formData.albumId) : null,
          started_at: new Date().toISOString(),
          recognition_confidence: 1.0,
          service_used: 'manual_override',
          updated_at: new Date().toISOString(),
          // Clear recognition image so collection image is used
          recognition_image_url: null
        });

      if (error) {
        setStatus(`Error: ${error.message}`);
      } else {
        setStatus('✅ Now playing updated successfully!');
        
        // Also try to set album context if we have album info
        if (formData.albumTitle && formData.artist) {
          try {
            // Clear existing context first
            await supabase.from('album_context').delete().neq('id', 0);
            
            // Set new context
            await supabase.from('album_context').insert({
              artist: formData.artist,
              title: formData.albumTitle,
              year: new Date().getFullYear().toString(),
              collection_id: formData.albumId ? parseInt(formData.albumId) : null,
              source: 'manual_override',
              created_at: new Date().toISOString()
            });
            
            setStatus('✅ Now playing and album context updated!');
          } catch (contextError) {
            console.warn('Failed to set album context:', contextError);
            // Don't fail the whole operation for this
          }
        }
        
        setTimeout(() => {
          setIsOpen(false);
          setStatus('');
          setFormData({ artist: '', title: '', albumTitle: '', albumId: '' });
        }, 2000);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`Error: ${errorMessage}`);
    }
  };

  const clearNowPlaying = async (): Promise<void> => {
    try {
      await supabase
        .from('now_playing')
        .update({
          artist: null,
          title: null,
          album_title: null,
          album_id: null,
          recognition_image_url: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      setStatus('✅ Now playing cleared');
      setTimeout(() => setStatus(''), 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`Error: ${errorMessage}`);
    }
  };

  const testRecognitionServices = async (): Promise<void> => {
    setStatus('Testing recognition services...');
    
    try {
      // Test recognition API
      const recognitionResponse = await fetch('/api/audio-recognition');
      
      // Test manual API  
      const manualResponse = await fetch('/api/manual-recognition');
      
      const recognitionStatus = recognitionResponse.ok ? '✅' : '❌';
      const manualStatus = manualResponse.ok ? '✅' : '❌';
      
      setStatus(`${recognitionStatus} Recognition API | ${manualStatus} Manual API | Check console for details`);
    } catch {
      setStatus('❌ Error testing services');
    }
  };

  const handleInputChange = (field: keyof FormData) => 
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      setFormData(prev => ({ ...prev, [field]: e.target.value }));
      
      // Auto-search when typing in artist field
      if (field === 'artist' && e.target.value.length > 1) {
        searchCollection(e.target.value);
      }
    };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>): void => {
    e.currentTarget.style.background = '#f3f4f6';
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>): void => {
    e.currentTarget.style.background = 'transparent';
  };

  return (
    <>
      {/* Enhanced Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '50px',
          padding: '16px 20px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 8px 32px rgba(124, 58, 237, 0.4)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.3s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 12px 40px rgba(124, 58, 237, 0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(124, 58, 237, 0.4)';
        }}
      >
        🎵 Manual Override
      </button>

      {/* Enhanced Modal */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '32px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 80px rgba(0,0,0,0.3)',
            position: 'relative'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px'
            }}>
              <h2 style={{
                fontSize: '24px',
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
                  fontSize: '28px',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '4px',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>

            {/* Quick Actions */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '24px',
              padding: '16px',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0'
            }}>
              <button
                onClick={testRecognitionServices}
                style={{
                  background: '#0369a1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  flex: 1
                }}
              >
                🔧 Test Services
              </button>
              <button
                onClick={clearNowPlaying}
                style={{
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  flex: 1
                }}
              >
                🗑️ Clear All
              </button>
            </div>

            <form onSubmit={handleManualSet} style={{ marginBottom: '20px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Search Collection
                </label>
                <input
                  type="text"
                  placeholder="Search for album in your collection..."
                  onChange={(e) => searchCollection(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
                
                {/* Enhanced Search Results */}
                {searchResults.length > 0 && (
                  <div style={{
                    marginTop: '12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '10px',
                    maxHeight: '250px',
                    overflowY: 'auto',
                    background: '#f9fafb'
                  }}>
                    {searchResults.map((album) => (
                      <div
                        key={album.id}
                        onClick={() => selectAlbum(album)}
                        style={{
                          padding: '16px',
                          borderBottom: '1px solid #e5e7eb',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                      >
                        <Image
                          src={album.image_url || '/images/coverplaceholder.png'}
                          alt={album.title}
                          width={50}
                          height={50}
                          style={{
                            objectFit: 'cover',
                            borderRadius: '8px',
                            flexShrink: 0
                          }}
                          unoptimized
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>
                            {album.title}
                          </div>
                          <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '2px' }}>
                            {album.artist} • {album.year}
                          </div>
                          <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                            {album.folder}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Enhanced Form Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '8px'
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
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Track Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={handleInputChange('title')}
                    placeholder="Enter track title"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Album Title (optional)
                </label>
                <input
                  type="text"
                  value={formData.albumTitle}
                  onChange={handleInputChange('albumTitle')}
                  placeholder="Enter album title"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'stretch'
              }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '14px',
                    fontSize: '16px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'transform 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  🎵 Set Now Playing
                </button>
              </div>
            </form>

            {/* Status Display */}
            {status && (
              <div style={{
                padding: '16px',
                borderRadius: '10px',
                fontSize: '14px',
                textAlign: 'center',
                fontWeight: 500,
                background: status.includes('Error') || status.includes('❌') ? '#fef2f2' : '#f0fdf4',
                color: status.includes('Error') || status.includes('❌') ? '#dc2626' : '#16a34a',
                border: `2px solid ${status.includes('Error') || status.includes('❌') ? '#fca5a5' : '#bbf7d0'}`,
                marginBottom: '16px'
              }}>
                {status}
              </div>
            )}

            {/* Enhanced Help Section */}
            <div style={{
              marginTop: '24px',
              padding: '20px',
              background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)',
              border: '1px solid #bfdbfe',
              borderRadius: '12px',
              fontSize: '14px',
              color: '#1e40af'
            }}>
              <div style={{ fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                💡 <span>Pro Tips</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.6 }}>
                <li>Search your collection first to get album artwork and metadata automatically</li>
                <li>Use this to test your TV display while debugging audio recognition</li>
                <li>Setting an album title will also create album context for future recognitions</li>
                <li>Test Services button checks if your recognition APIs are working</li>
                <li>Clear All removes everything from the TV display</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}