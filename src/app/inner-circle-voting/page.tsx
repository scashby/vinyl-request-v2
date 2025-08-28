// Inner Circle Voting Page with Enhanced Search
// Enhanced version of: src/app/inner-circle-voting/page.tsx
// Adds search functionality, similar artist suggestions, and better filtering

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
  vote_count?: number;
}

interface VoterInfo {
  name: string;
  email: string;
}

export default function InnerCircleVotingPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbums, setSelectedAlbums] = useState<Set<number>>(new Set());
  const [voterInfo, setVoterInfo] = useState<VoterInfo>({ name: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [voteCounts, setVoteCounts] = useState<Record<number, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const MAX_VOTES = 20; // Limit votes per person
  const submitFormRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const scrollToSubmit = () => {
    submitFormRef.current?.scrollIntoView({ 
      behavior: 'smooth',
      block: 'start'
    });
  };

  useEffect(() => {
    loadCollection();
    loadVoteCounts();
  }, []);

  const loadCollection = async () => {
    try {
      const { data, error } = await supabase
        .from('collection')
        .select('id, artist, title, year, image_url, folder')
        .eq('folder', 'Vinyl') // Filter by vinyl folder
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

  const loadVoteCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('inner_circle_votes')
        .select('collection_id')
        .not('collection_id', 'is', null);

      if (error) throw error;

      // Count votes per album
      const counts: Record<number, number> = {};
      data?.forEach(vote => {
        counts[vote.collection_id] = (counts[vote.collection_id] || 0) + 1;
      });
      
      setVoteCounts(counts);
    } catch (error) {
      console.error('Error loading vote counts:', error);
    }
  };

  // Enhanced search functionality with fuzzy matching
  const filteredAlbums = useMemo(() => {
    if (!searchQuery.trim()) return albums;
    
    const query = searchQuery.toLowerCase().trim();
    const queryWords = query.split(/\s+/);
    
    return albums.filter(album => {
      const artistLower = album.artist.toLowerCase();
      const titleLower = album.title.toLowerCase();
      const yearStr = album.year.toString();
      
      // Exact phrase matching
      if (artistLower.includes(query) || titleLower.includes(query)) {
        return true;
      }
      
      // Word-based matching (all words must be found)
      const allWords = queryWords.every(word => 
        artistLower.includes(word) || 
        titleLower.includes(word) || 
        yearStr.includes(word)
      );
      
      if (allWords) return true;
      
      // Partial matching for shorter queries
      if (query.length >= 3) {
        return artistLower.startsWith(query) || 
               titleLower.startsWith(query) ||
               artistLower.includes(query.substring(0, -1)) ||
               titleLower.includes(query.substring(0, -1));
      }
      
      return false;
    });
  }, [albums, searchQuery]);

  // Get unique artists for suggestions
  const uniqueArtists = useMemo(() => {
    const artists = new Set(albums.map(album => album.artist));
    return Array.from(artists).sort();
  }, [albums]);

  // Get search suggestions based on current query
  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    
    const query = searchQuery.toLowerCase();
    const suggestions = new Set<string>();
    
    // Artist suggestions
    uniqueArtists.forEach(artist => {
      if (artist.toLowerCase().includes(query) && artist.toLowerCase() !== query) {
        suggestions.add(artist);
      }
    });
    
    // Album title suggestions
    albums.forEach(album => {
      if (album.title.toLowerCase().includes(query) && 
          album.title.toLowerCase() !== query &&
          suggestions.size < 10) {
        suggestions.add(`${album.artist} - ${album.title}`);
      }
    });
    
    return Array.from(suggestions).slice(0, 8);
  }, [searchQuery, uniqueArtists, albums]);

  const clearSearch = () => {
    setSearchQuery('');
    setShowSuggestions(false);
    searchInputRef.current?.focus();
  };

  const selectSuggestion = (suggestion: string) => {
    setSearchQuery(suggestion.includes(' - ') ? suggestion.split(' - ')[0] : suggestion);
    setShowSuggestions(false);
  };

  const toggleVote = (albumId: number) => {
    setSelectedAlbums(prev => {
      const newSet = new Set(prev);
      if (newSet.has(albumId)) {
        newSet.delete(albumId);
      } else if (newSet.size < MAX_VOTES) {
        newSet.add(albumId);
      }
      return newSet;
    });
  };

  const submitVotes = async () => {
    if (!voterInfo.name.trim() || !voterInfo.email.trim()) {
      setError('Please enter your name and email address.');
      return;
    }

    if (selectedAlbums.size === 0) {
      setError('Please select at least one album to vote for.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Check if this email has already voted
      const { data: existingVotes, error: checkError } = await supabase
        .from('inner_circle_votes')
        .select('voter_email')
        .eq('voter_email', voterInfo.email.toLowerCase().trim())
        .limit(1);

      if (checkError) throw checkError;

      if (existingVotes && existingVotes.length > 0) {
        setError('This email address has already been used to vote. Each person can only vote once.');
        setSubmitting(false);
        return;
      }

      // Submit all votes
      const votes = Array.from(selectedAlbums).map(albumId => ({
        voter_name: voterInfo.name.trim(),
        voter_email: voterInfo.email.toLowerCase().trim(),
        collection_id: albumId,
        session_id: Math.random().toString(36).substring(7), // Simple session ID
        voter_ip: null // Could add IP tracking if needed
      }));

      const { error: submitError } = await supabase
        .from('inner_circle_votes')
        .insert(votes);

      if (submitError) throw submitError;

      setSubmitted(true);
      loadVoteCounts(); // Refresh vote counts
    } catch (error) {
      console.error('Error submitting votes:', error);
      setError(`Failed to submit votes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
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
          <div style={{ fontSize: 16, opacity: 0.8 }}>Preparing your voting experience</div>
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
          maxWidth: 500,
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>🎉</div>
          <h1 style={{ fontSize: 32, marginBottom: 16, margin: 0 }}>Thank You!</h1>
          <p style={{ fontSize: 18, marginBottom: 20, opacity: 0.9 }}>
            Your votes have been submitted successfully. We appreciate your participation in choosing the Inner Circle favorites!
          </p>
          <p style={{ fontSize: 16, opacity: 0.7 }}>
            You voted for {selectedAlbums.size} album{selectedAlbums.size !== 1 ? 's' : ''}.
          </p>
          <div style={{ marginTop: 30, fontSize: 14, opacity: 0.6 }}>
            Results will be announced soon and winners will be marked with the 💎 Inner Circle badge.
          </div>
        </div>
      </div>
    );
  }

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
            💎 Inner Circle Voting
          </h1>
          <p style={{ fontSize: 18, margin: '0 0 20px 0', opacity: 0.9 }}>
            Vote for your favorite albums from the Dead Wax Dialogues collection
          </p>
          <p style={{ fontSize: 16, opacity: 0.8 }}>
            Select up to <strong>{MAX_VOTES} albums</strong> • {albums.length} records available
          </p>
          
          {/* Vote Counter */}
          <div style={{
            marginTop: 20,
            padding: '12px 24px',
            background: selectedAlbums.size === MAX_VOTES ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
            borderRadius: 8,
            display: 'inline-block',
            border: `2px solid ${selectedAlbums.size === MAX_VOTES ? '#ef4444' : '#22c55e'}`
          }}>
            <strong>{selectedAlbums.size} / {MAX_VOTES} votes selected</strong>
            {selectedAlbums.size === MAX_VOTES && (
              <div style={{ fontSize: 14, marginTop: 4, opacity: 0.9 }}>
                Maximum votes reached! Unselect an album to choose a different one.
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Search Section */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: 16,
          padding: 24,
          marginBottom: 32,
          backdropFilter: 'blur(10px)',
          position: 'relative',
          zIndex: 1000
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 20 }}>🔍</div>
            <h3 style={{ fontSize: 20, margin: 0, fontWeight: 'bold' }}>
              Search Albums
            </h3>
            {searchQuery && (
              <div style={{
                background: 'rgba(34, 197, 94, 0.2)',
                color: '#22c55e',
                padding: '4px 12px',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 'bold'
              }}>
                {filteredAlbums.length} found
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setShowSuggestions(e.target.value.length > 1);
              }}
              onFocus={() => setShowSuggestions(searchQuery.length > 1)}
              style={{
                width: '100%',
                padding: '16px 50px 16px 20px',
                borderRadius: 12,
                border: 'none',
                fontSize: 16,
                background: 'rgba(255, 255, 255, 0.9)',
                color: '#333',
                outline: 'none'
              }}
              placeholder="Search by artist name, album title, or year..."
            />
            
            {searchQuery && (
              <button
                onClick={clearSearch}
                style={{
                  position: 'absolute',
                  right: 15,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  fontSize: 18,
                  cursor: 'pointer',
                  color: '#666',
                  padding: 5
                }}
              >
                ✕
              </button>
            )}

            {/* Search Suggestions Dropdown */}
            {showSuggestions && searchSuggestions.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '0 0 12px 12px',
                backdropFilter: 'blur(10px)',
                zIndex: 9999,
                maxHeight: 200,
                overflowY: 'auto',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                marginTop: 2
              }}>
                <div style={{
                  padding: '8px 16px',
                  fontSize: 12,
                  fontWeight: 'bold',
                  color: '#666',
                  borderBottom: '1px solid rgba(0,0,0,0.1)'
                }}>
                  Suggestions
                </div>
                {searchSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => selectSuggestion(suggestion)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: 'none',
                      background: 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: 14,
                      color: '#333',
                      borderBottom: index < searchSuggestions.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {suggestion.includes(' - ') ? (
                      <>
                        <span style={{ fontWeight: 'bold' }}>
                          {suggestion.split(' - ')[0]}
                        </span>
                        <span style={{ color: '#666' }}>
                          {' - ' + suggestion.split(' - ')[1]}
                        </span>
                      </>
                    ) : (
                      <span style={{ fontWeight: 'bold' }}>{suggestion}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search Stats */}
          <div style={{
            marginTop: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 14,
            opacity: 0.8
          }}>
            <div>
              {searchQuery ? (
                <>Showing {filteredAlbums.length} of {albums.length} albums</>
              ) : (
                <>Showing all {albums.length} albums</>
              )}
            </div>
            <div>
              Try searching for artist names like &ldquo;Beatles&rdquo; or &ldquo;Miles Davis&rdquo;
            </div>
          </div>
        </div>

        {/* Album Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 20,
          marginBottom: 40
        }}>
          {filteredAlbums.map(album => {
            const isSelected = selectedAlbums.has(album.id);
            const voteCount = voteCounts[album.id] || 0;
            
            return (
              <div
                key={album.id}
                onClick={() => toggleVote(album.id)}
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
              >
                {/* Vote Heart */}
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

                {/* Vote Count */}
                {voteCount > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    background: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 'bold'
                  }}>
                    {voteCount} vote{voteCount !== 1 ? 's' : ''}
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

        {/* No Results Message */}
        {searchQuery && filteredAlbums.length === 0 && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 16,
            padding: 40,
            textAlign: 'center',
            marginBottom: 40,
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <h3 style={{ fontSize: 24, marginBottom: 12, margin: 0 }}>
              No albums found
            </h3>
            <p style={{ fontSize: 16, opacity: 0.8, marginBottom: 20 }}>
              No albums match your search for &ldquo;<strong>{searchQuery}</strong>&rdquo;
            </p>
            <button
              onClick={clearSearch}
              style={{
                background: '#fbbf24',
                color: '#000',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Clear Search
            </button>
          </div>
        )}

        {/* Voter Information Form */}
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
            Submit Your Votes
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 20,
            maxWidth: 600,
            margin: '0 auto 20px auto'
          }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                Your Name *
              </label>
              <input
                type="text"
                value={voterInfo.name}
                onChange={e => setVoterInfo(prev => ({ ...prev, name: e.target.value }))}
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
                value={voterInfo.email}
                onChange={e => setVoterInfo(prev => ({ ...prev, email: e.target.value }))}
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
              onClick={submitVotes}
              disabled={submitting || selectedAlbums.size === 0 || !voterInfo.name.trim() || !voterInfo.email.trim()}
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
                opacity: (selectedAlbums.size === 0 || !voterInfo.name.trim() || !voterInfo.email.trim()) ? 0.5 : 1
              }}
            >
              {submitting ? '⏳ Submitting Votes...' : `🗳️ Submit ${selectedAlbums.size} Vote${selectedAlbums.size !== 1 ? 's' : ''}`}
            </button>
          </div>

          <div style={{ fontSize: 12, opacity: 0.7, textAlign: 'center', marginTop: 16 }}>
            Each email address can only vote once. Your votes will be used to select Inner Circle favorites.
          </div>
        </div>

        {/* Floating Submit Button */}
        {selectedAlbums.size > 0 && (
          <button
            onClick={scrollToSubmit}
            style={{
              position: 'fixed',
              bottom: 30,
              right: 30,
              background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
              color: '#000',
              border: 'none',
              borderRadius: '50%',
              width: 70,
              height: 70,
              fontSize: 12,
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 8px 25px rgba(251, 191, 36, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              transition: 'all 0.3s ease',
              zIndex: 9999
            }}
          >
            <div style={{ fontSize: 16 }}>🗳️</div>
            <div style={{ fontSize: 10, lineHeight: 1 }}>
              SUBMIT<br/>{selectedAlbums.size}
            </div>
          </button>
        )}
      </div>
    </div>
  );
}