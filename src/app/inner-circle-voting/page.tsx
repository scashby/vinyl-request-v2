// Inner Circle Voting Page
// Create as: src/app/inner-circle-voting/page.tsx
// Secret URL for Inner Circle members to vote on their favorite vinyl

"use client";

import { useEffect, useState } from 'react';
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
  
  const MAX_VOTES = 20; // Limit votes per person

  useEffect(() => {
    loadCollection();
    loadVoteCounts();
  }, []);

  const loadCollection = async () => {
    try {
      const { data, error } = await supabase
        .from('collection')
        .select('id, artist, title, year, image_url, folder')
        .ilike('format', '%vinyl%')
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

        {/* Album Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 20,
          marginBottom: 40
        }}>
          {albums.map(album => {
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

        {/* Voter Information Form */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: 16,
          padding: 30,
          backdropFilter: 'blur(10px)',
          marginBottom: 20
        }}>
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
      </div>
    </div>
  );
}