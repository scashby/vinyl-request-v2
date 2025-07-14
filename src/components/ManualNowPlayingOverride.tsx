// File: src/components/ManualNowPlayingOverride.tsx
// FIXED VERSION - Restored working functionality with proper error handling
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

interface ServiceTestResult {
  service: string;
  status: 'success' | 'error' | 'testing';
  message?: string;
  details?: unknown;
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
  const [serviceTestResults, setServiceTestResults] = useState<ServiceTestResult[]>([]);
  const [isTesting, setIsTesting] = useState<boolean>(false);

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
          recognition_image_url: null
        });

      if (error) {
        setStatus(`Error: ${error.message}`);
      } else {
        setStatus('✅ Now playing updated successfully!');
        
        // Set album context if we have album info
        if (formData.albumTitle && formData.artist) {
          try {
            await supabase.from('album_context').delete().neq('id', 0);
            
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
    setIsTesting(true);
    setStatus('Testing all recognition services...');
    setServiceTestResults([]);
    
    const services = [
      { name: 'Audio Recognition API', endpoint: '/api/audio-recognition' },
      { name: 'Manual Recognition API', endpoint: '/api/manual-recognition' },
      { name: 'Album Context API', endpoint: '/api/album-context' }
    ];

    const results: ServiceTestResult[] = [];

    for (const service of services) {
      try {
        results.push({ service: service.name, status: 'testing' });
        setServiceTestResults([...results]);
        
        const response = await fetch(service.endpoint, {
          method: 'GET',
        });
        
        if (response.ok) {
          const data = await response.json();
          results[results.length - 1] = {
            service: service.name,
            status: 'success',
            message: `✅ Available - ${data.message || 'OK'}`,
            details: data
          };
        } else {
          results[results.length - 1] = {
            service: service.name,
            status: 'error',
            message: `❌ HTTP ${response.status}`,
          };
        }
      } catch (error) {
        results[results.length - 1] = {
          service: service.name,
          status: 'error',
          message: `❌ ${error instanceof Error ? error.message : 'Network error'}`,
        };
      }
      
      setServiceTestResults([...results]);
    }

    const successCount = results.filter(r => r.status === 'success').length;
    setStatus(`Testing complete: ${successCount}/${services.length} services available`);
    setIsTesting(false);
  };

  const handleInputChange = (field: keyof FormData) => 
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      setFormData(prev => ({ ...prev, [field]: e.target.value }));
      
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
      >
        🎵 Manual Override
      </button>

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
            maxWidth: '700px',
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
                disabled={isTesting}
                style={{
                  background: isTesting ? '#9ca3af' : '#0369a1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isTesting ? 'not-allowed' : 'pointer',
                  flex: 1
                }}
              >
                {isTesting ? '🔧 Testing...' : '🔧 Test All Services'}
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

            {/* Service Test Results */}
            {serviceTestResults.length > 0 && (
              <div style={{
                marginBottom: '24px',
                padding: '16px',
                background: '#f0f9ff',
                borderRadius: '12px',
                border: '1px solid #0369a1'
              }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#0369a1',
                  margin: '0 0 12px 0'
                }}>
                  Service Test Results
                </h3>
                <div style={{ fontSize: '14px', lineHeight: 1.6 }}>
                  {serviceTestResults.map((result, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px',
                      padding: '8px',
                      background: result.status === 'success' ? '#f0fdf4' : 
                                 result.status === 'error' ? '#fef2f2' : '#f3f4f6',
                      borderRadius: '6px'
                    }}>
                      <span style={{ fontWeight: 600 }}>{result.service}:</span>
                      <span style={{
                        color: result.status === 'success' ? '#16a34a' : 
                               result.status === 'error' ? '#dc2626' : '#6b7280'
                      }}>
                        {result.status === 'testing' ? '⏳ Testing...' : result.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                />
                
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
                />
              </div>

              <button
                type="submit"
                style={{
                  width: '100%',
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
              >
                🎵 Set Now Playing
              </button>
            </form>

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
                💡 <span>Enhanced Features</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.6 }}>
                <li>Service testing shows which APIs are working</li>
                <li>Search your collection first for automatic metadata</li>
                <li>Enhanced error reporting and status updates</li>
                <li>Setting album title creates album context for future recognitions</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}