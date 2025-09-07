// src/app/staff-voting/page.tsx
"use client";

import { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from 'src/lib/supabaseClient';
import Image from 'next/image';

interface Album {
  id: number;
  artist: string;
  title: string;
  year: string;
  image_url: string;
  folder: string;
}

interface StaffPick {
  albumId: number;
  rank: number;
  reason: string;
  favoriteTrack: string;
  listeningContext: string;
}

interface StaffInfo {
  name: string;
  title: string;
  email: string;
  bio: string;
  photoUrl: string;
}

export default function StaffVotingPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedPicks, setSelectedPicks] = useState<Map<number, StaffPick>>(new Map());
  const [staffInfo, setStaffInfo] = useState<StaffInfo>({
    name: '',
    title: '',
    email: '',
    bio: '',
    photoUrl: ''
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const MAX_PICKS = 5;
  const submitFormRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCollection();
  }, []);

  const loadCollection = async () => {
    try {
      const { data, error } = await supabase
        .from('collection')
        .select('id, artist, title, year, image_url, folder')
        .eq('folder', 'Vinyl')
        .or('blocked.is.null,blocked.eq.false')
        .order('artist', { ascending: true })
        .order('title', { ascending: true });

      if (error) throw error;
      setAlbums(data || []);
    } catch (error) {
      console.error('Error loading vinyl collection:', error);
      setError('Failed to load collection. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const filteredAlbums = useMemo(() => {
    if (!searchQuery.trim()) return albums;
    
    const query = searchQuery.toLowerCase().trim();
    const queryWords = query.split(/\s+/);
    
    return albums.filter(album => {
      const artistLower = album.artist.toLowerCase();
      const titleLower = album.title.toLowerCase();
      const yearStr = album.year.toString();
      
      if (artistLower.includes(query) || titleLower.includes(query)) {
        return true;
      }
      
      const allWords = queryWords.every(word => 
        artistLower.includes(word) || 
        titleLower.includes(word) || 
        yearStr.includes(word)
      );
      
      return allWords;
    });
  }, [albums, searchQuery]);

  const toggleAlbumPick = (albumId: number) => {
    setSelectedPicks(prev => {
      const newMap = new Map(prev);
      if (newMap.has(albumId)) {
        newMap.delete(albumId);
        // Re-rank remaining picks
        const remainingEntries = Array.from(newMap.entries())
          .sort(([, a], [, b]) => a.rank - b.rank);
        
        const rerankedMap = new Map<number, StaffPick>();
        remainingEntries.forEach(([id, pick], index) => {
          rerankedMap.set(id, { ...pick, rank: index + 1 });
        });
        return rerankedMap;
      } else if (newMap.size < MAX_PICKS) {
        newMap.set(albumId, {
          albumId,
          rank: newMap.size + 1,
          reason: '',
          favoriteTrack: '',
          listeningContext: ''
        });
      }
      return newMap;
    });
  };

  const updatePickDetails = (albumId: number, field: keyof StaffPick, value: string | number) => {
    setSelectedPicks(prev => {
      const newMap = new Map(prev);
      const pick = newMap.get(albumId);
      if (pick) {
        newMap.set(albumId, { ...pick, [field]: value });
      }
      return newMap;
    });
  };

  const movePickRank = (albumId: number, direction: 'up' | 'down') => {
    setSelectedPicks(prev => {
      const picksArray = Array.from(prev.entries()).sort(([, a], [, b]) => a.rank - b.rank);
      const currentIndex = picksArray.findIndex(([id]) => id === albumId);
      
      if (currentIndex === -1) return prev;
      if (direction === 'up' && currentIndex === 0) return prev;
      if (direction === 'down' && currentIndex === picksArray.length - 1) return prev;
      
      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      
      // Swap positions
      [picksArray[currentIndex], picksArray[newIndex]] = [picksArray[newIndex], picksArray[currentIndex]];
      
      // Create new map with updated ranks
      const newMap = new Map<number, StaffPick>();
      picksArray.forEach(([id, pick], index) => {
        newMap.set(id, { ...pick, rank: index + 1 });
      });
      
      return newMap;
    });
  };

  const submitPicks = async () => {
    // Validate staff info
    if (!staffInfo.name.trim() || !staffInfo.email.trim()) {
      setError('Please fill in your name and email address.');
      return;
    }

    if (selectedPicks.size === 0) {
      setError('Please select at least one album for your picks.');
      return;
    }

    // Validate pick details
    const picks = Array.from(selectedPicks.values());
    const missingReasons = picks.filter(pick => !pick.reason.trim());
    if (missingReasons.length > 0) {
      setError('Please provide a reason for all your selected albums.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Check if this email has already submitted picks
      const { data: existingPicks, error: checkError } = await supabase
        .from('staff_picks')
        .select('staff_name')
        .eq('staff_name', staffInfo.name.trim())
        .limit(1);

      if (checkError) throw checkError;

      if (existingPicks && existingPicks.length > 0) {
        setError('You have already submitted your staff picks. Each staff member can only submit once.');
        setSubmitting(false);
        return;
      }

      // Submit all picks
      const picksToSubmit = Array.from(selectedPicks.values()).map(pick => ({
        staff_name: staffInfo.name.trim(),
        staff_title: staffInfo.title.trim() || null,
        staff_bio: staffInfo.bio.trim() || null,
        staff_photo_url: staffInfo.photoUrl.trim() || null,
        collection_id: pick.albumId,
        pick_order: pick.rank,
        reason: pick.reason.trim(),
        favorite_track: pick.favoriteTrack.trim() || null,
        listening_context: pick.listeningContext.trim() || null,
        is_active: true
      }));

      const { error: submitError } = await supabase
        .from('staff_picks')
        .insert(picksToSubmit);

      if (submitError) throw submitError;

      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting picks:', error);
      setError(`Failed to submit picks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToSubmit = () => {
    submitFormRef.current?.scrollIntoView({ 
      behavior: 'smooth',
      block: 'start'
    });
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 16 }}>🎵 Loading Collection...</div>
          <div style={{ fontSize: 16, opacity: 0.8 }}>Preparing your staff picks experience</div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        padding: 20
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: 16,
          padding: 40,
          textAlign: 'center',
          maxWidth: 600,
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>🎉</div>
          <h1 style={{ fontSize: 32, marginBottom: 16, margin: 0 }}>Thank You!</h1>
          <p style={{ fontSize: 18, marginBottom: 20, opacity: 0.9 }}>
            Your staff picks have been submitted successfully. Thank you for sharing your favorite albums with our community!
          </p>
          <p style={{ fontSize: 16, opacity: 0.7, marginBottom: 30 }}>
            You selected {selectedPicks.size} album{selectedPicks.size !== 1 ? 's' : ''} for your top picks.
          </p>
          <div style={{ marginTop: 30, fontSize: 14, opacity: 0.6 }}>
            Your picks will be visible on the Staff Picks page soon.
          </div>
        </div>
      </div>
    );
  }

  const selectedCount = selectedPicks.size;
  const picksArray = Array.from(selectedPicks.entries()).sort(([, a], [, b]) => a.rank - b.rank);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: 20
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', color: 'white' }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: 40,
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: 16,
          padding: 30,
          backdropFilter: 'blur(10px)'
        }}>
          <h1 style={{ fontSize: 36, margin: '0 0 16px 0', fontWeight: 'bold' }}>
            🎵 Staff Picks Selection
          </h1>
          <p style={{ fontSize: 18, margin: '0 0 20px 0', opacity: 0.9 }}>
            Choose your top 5 favorite albums from our collection
          </p>
          <p style={{ fontSize: 16, opacity: 0.8 }}>
            Select up to <strong>{MAX_PICKS} albums</strong> and tell us why you love them
          </p>
          
          {/* Pick Counter */}
          <div style={{
            marginTop: 20,
            padding: '12px 24px',
            background: selectedCount === MAX_PICKS ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
            borderRadius: 8,
            display: 'inline-block',
            border: `2px solid ${selectedCount === MAX_PICKS ? '#ef4444' : '#22c55e'}`
          }}>
            <strong>{selectedCount} / {MAX_PICKS} picks selected</strong>
          </div>
        </div>

        {/* Search Section */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: 16,
          padding: 24,
          marginBottom: 32,
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 20 }}>🔍</div>
            <h3 style={{ fontSize: 20, margin: 0, fontWeight: 'bold' }}>
              Search Albums
            </h3>
          </div>

          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '16px 20px',
              borderRadius: 12,
              border: 'none',
              fontSize: 16,
              background: 'rgba(255, 255, 255, 0.9)',
              color: '#333',
              outline: 'none'
            }}
            placeholder="Search by artist name, album title, or year..."
          />
        </div>

        {/* Selected Picks Summary */}
        {selectedCount > 0 && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 16,
            padding: 24,
            marginBottom: 32,
            backdropFilter: 'blur(10px)'
          }}>
            <h3 style={{ fontSize: 20, margin: '0 0 16px 0', fontWeight: 'bold' }}>
              📋 Your Current Picks ({selectedCount}/{MAX_PICKS})
            </h3>
            
            <div style={{ display: 'grid', gap: 12 }}>
              {picksArray.map(([albumId, pick]) => {
                const album = albums.find(a => a.id === albumId);
                if (!album) return null;
                
                return (
                  <div key={albumId} style={{
                    display: 'flex',
                    gap: 12,
                    padding: 12,
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    alignItems: 'center'
                  }}>
                    <div style={{
                      background: '#fbbf24',
                      color: '#000',
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 'bold'
                    }}>
                      #{pick.rank}
                    </div>
                    
                    {album.image_url && (
                      <Image
                        src={album.image_url}
                        alt={`${album.artist} - ${album.title}`}
                        width={40}
                        height={40}
                        style={{ borderRadius: 4, objectFit: 'cover' }}
                        unoptimized
                      />
                    )}
                    
                    <div style={{ flex: 1, fontSize: 14 }}>
                      <strong>{album.artist}</strong> - {album.title}
                    </div>
                    
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => movePickRank(albumId, 'up')}
                        disabled={pick.rank === 1}
                        style={{
                          background: pick.rank === 1 ? '#6b7280' : '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          padding: '4px 8px',
                          fontSize: 12,
                          cursor: pick.rank === 1 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => movePickRank(albumId, 'down')}
                        disabled={pick.rank === selectedCount}
                        style={{
                          background: pick.rank === selectedCount ? '#6b7280' : '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          padding: '4px 8px',
                          fontSize: 12,
                          cursor: pick.rank === selectedCount ? 'not-allowed' : 'pointer'
                        }}
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => toggleAlbumPick(albumId)}
                        style={{
                          background: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          padding: '4px 8px',
                          fontSize: 12,
                          cursor: 'pointer'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <button
              onClick={scrollToSubmit}
              style={{
                marginTop: 16,
                background: '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                cursor: 'pointer',
                fontWeight: 'bold',
                width: '100%'
              }}
            >
              ↓ Add Details & Submit Picks ↓
            </button>
          </div>
        )}

        {/* Album Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 20,
          marginBottom: 40
        }}>
          {filteredAlbums.map(album => {
            const isSelected = selectedPicks.has(album.id);
            const pick = selectedPicks.get(album.id);
            
            return (
              <div
                key={album.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: 12,
                  padding: 16,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  border: isSelected ? '3px solid #fbbf24' : '3px solid transparent',
                  transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                  backdropFilter: 'blur(10px)',
                  position: 'relative'
                }}
                onClick={() => toggleAlbumPick(album.id)}
              >
                {/* Selection Indicator */}
                <div style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  fontSize: 24,
                  color: isSelected ? '#fbbf24' : 'rgba(255, 255, 255, 0.5)',
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  zIndex: 10
                }}>
                  {isSelected ? '⭐' : '☆'}
                </div>

                {/* Rank Number */}
                {isSelected && pick && (
                  <div style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    background: '#fbbf24',
                    color: '#000',
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 'bold'
                  }}>
                    #{pick.rank}
                  </div>
                )}

                {/* Album Cover */}
                <div style={{
                  width: '100%',
                  aspectRatio: '1',
                  marginBottom: 12,
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: '#374151'
                }}>
                  {album.image_url ? (
                    <Image
                      src={album.image_url}
                      alt={`${album.artist} - ${album.title}`}
                      width={200}
                      height={200}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      unoptimized
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      color: '#9ca3af'
                    }}>
                      No Image
                    </div>
                  )}
                </div>

                {/* Album Info */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 'bold',
                    marginBottom: 4,
                    lineHeight: 1.3,
                    height: 36,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {album.title}
                  </div>
                  <div style={{
                    fontSize: 12,
                    opacity: 0.8,
                    marginBottom: 4
                  }}>
                    {album.artist}
                  </div>
                  <div style={{
                    fontSize: 11,
                    opacity: 0.6
                  }}>
                    {album.year} • {album.folder}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Details & Submission Form */}
        <div 
          ref={submitFormRef}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 16,
            padding: 30,
            backdropFilter: 'blur(10px)',
            marginBottom: 20
          }}
        >
          <h3 style={{ fontSize: 24, margin: '0 0 20px 0', textAlign: 'center' }}>
            📝 Your Information & Pick Details
          </h3>
          
          {/* Staff Information */}
          <div style={{ marginBottom: 32 }}>
            <h4 style={{ fontSize: 18, margin: '0 0 16px 0', fontWeight: 'bold' }}>
              About You
            </h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 20,
              marginBottom: 16
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                  Your Name *
                </label>
                <input
                  type="text"
                  value={staffInfo.name}
                  onChange={e => setStaffInfo(prev => ({ ...prev, name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: 'none',
                    fontSize: 16,
                    background: 'rgba(255, 255, 255, 0.9)',
                    color: '#333'
                  }}
                  placeholder="Enter your name"
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  value={staffInfo.email}
                  onChange={e => setStaffInfo(prev => ({ ...prev, email: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: 'none',
                    fontSize: 16,
                    background: 'rgba(255, 255, 255, 0.9)',
                    color: '#333'
                  }}
                  placeholder="your@email.com"
                />
              </div>
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 20,
              marginBottom: 16
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                  Your Job Title
                </label>
                <input
                  type="text"
                  value={staffInfo.title}
                  onChange={e => setStaffInfo(prev => ({ ...prev, title: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: 'none',
                    fontSize: 16,
                    background: 'rgba(255, 255, 255, 0.9)',
                    color: '#333'
                  }}
                  placeholder="e.g., Bartender, Chef, Manager"
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                  Photo URL (Optional)
                </label>
                <input
                  type="url"
                  value={staffInfo.photoUrl}
                  onChange={e => setStaffInfo(prev => ({ ...prev, photoUrl: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: 'none',
                    fontSize: 16,
                    background: 'rgba(255, 255, 255, 0.9)',
                    color: '#333'
                  }}
                  placeholder="https://..."
                />
              </div>
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                Short Bio (Optional)
              </label>
              <textarea
                value={staffInfo.bio}
                onChange={e => setStaffInfo(prev => ({ ...prev, bio: e.target.value }))}
                rows={2}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: 16,
                  background: 'rgba(255, 255, 255, 0.9)',
                  color: '#333',
                  resize: 'vertical'
                }}
                placeholder="Tell us a bit about yourself and your musical background..."
              />
            </div>
          </div>

          {/* Pick Details */}
          {selectedCount > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h4 style={{ fontSize: 18, margin: '0 0 16px 0', fontWeight: 'bold' }}>
                Tell Us About Your Picks
              </h4>
              
              {picksArray.map(([albumId, pick]) => {
                const album = albums.find(a => a.id === albumId);
                if (!album) return null;
                
                return (
                  <div key={albumId} style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: 12,
                    padding: 20,
                    marginBottom: 20
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      marginBottom: 16
                    }}>
                      <div style={{
                        background: '#fbbf24',
                        color: '#000',
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        fontWeight: 'bold'
                      }}>
                        #{pick.rank}
                      </div>
                      
                      {album.image_url && (
                        <Image
                          src={album.image_url}
                          alt={`${album.artist} - ${album.title}`}
                          width={60}
                          height={60}
                          style={{ borderRadius: 6, objectFit: 'cover' }}
                          unoptimized
                        />
                      )}
                      
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 'bold' }}>
                          {album.title}
                        </div>
                        <div style={{ fontSize: 14, opacity: 0.8 }}>
                          {album.artist} • {album.year}
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'grid', gap: 16 }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                          Why did you choose this album? *
                        </label>
                        <textarea
                          value={pick.reason}
                          onChange={e => updatePickDetails(albumId, 'reason', e.target.value)}
                          rows={3}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            borderRadius: 8,
                            border: 'none',
                            fontSize: 14,
                            background: 'rgba(255, 255, 255, 0.9)',
                            color: '#333',
                            resize: 'vertical'
                          }}
                          placeholder="Share why this album is special to you..."
                        />
                      </div>
                      
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 16
                      }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                            Favorite Track (Optional)
                          </label>
                          <input
                            type="text"
                            value={pick.favoriteTrack}
                            onChange={e => updatePickDetails(albumId, 'favoriteTrack', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: 6,
                              border: 'none',
                              fontSize: 14,
                              background: 'rgba(255, 255, 255, 0.9)',
                              color: '#333'
                            }}
                            placeholder="e.g., Track 3, Blue in Green"
                          />
                        </div>
                        
                        <div>
                          <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                            When/Where You Listen (Optional)
                          </label>
                          <input
                            type="text"
                            value={pick.listeningContext}
                            onChange={e => updatePickDetails(albumId, 'listeningContext', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: 6,
                              border: 'none',
                              fontSize: 14,
                              background: 'rgba(255, 255, 255, 0.9)',
                              color: '#333'
                            }}
                            placeholder="e.g., Closing shifts, Sunday mornings"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '2px solid #ef4444',
              borderRadius: 8,
              padding: 12,
              marginBottom: 20,
              textAlign: 'center',
              fontSize: 14
            }}>
              {error}
            </div>
          )}

          <div style={{ textAlign: 'center' }}>
            <button
              onClick={submitPicks}
              disabled={submitting || selectedCount === 0 || !staffInfo.name.trim() || !staffInfo.email.trim()}
              style={{
                background: submitting ? '#6b7280' : '#fbbf24',
                color: submitting ? '#fff' : '#000',
                border: 'none',
                borderRadius: 12,
                padding: '16px 32px',
                fontSize: 18,
                fontWeight: 'bold',
                cursor: submitting ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                opacity: (selectedCount === 0 || !staffInfo.name.trim() || !staffInfo.email.trim()) ? 0.5 : 1
              }}
            >
              {submitting ? '⏳ Submitting Your Picks...' : `🎵 Submit ${selectedCount} Pick${selectedCount !== 1 ? 's' : ''}`}
            </button>
          </div>

          <div style={{ fontSize: 12, opacity: 0.7, textAlign: 'center', marginTop: 16 }}>
            Each staff member can only submit picks once. Your selections will be featured on the Staff Picks page.
          </div>
        </div>
      </div>
    </div>
  );
}