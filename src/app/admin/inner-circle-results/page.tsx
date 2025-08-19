// Inner Circle Voting Results Admin Page
// Create as: src/app/admin/inner-circle-results/page.tsx
// Admin page to view voting results and apply IC badges to winners

"use client";

import { useEffect, useState } from 'react';
import { supabase } from 'src/lib/supabaseClient';
import Image from 'next/image';

interface VoteResult {
  collection_id: number;
  artist: string;
  title: string;
  year: string;
  image_url: string;
  folder: string;
  vote_count: number;
  current_ic_badge: boolean;
  voters: string[];
}

interface VoterInfo {
  voter_name: string;
  voter_email: string;
  voted_at: string;
  album_count: number;
}

export default function InnerCircleResultsPage() {
  const [results, setResults] = useState<VoteResult[]>([]);
  const [voters, setVoters] = useState<VoterInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState<'votes' | 'artist' | 'title'>('votes');

  useEffect(() => {
    loadVotingResults();
    loadVoterInfo();
  }, []);

  const loadVotingResults = async () => {
    try {
      // Get vote counts with album details - simplified approach
      const { data: votesData, error: votesError } = await supabase
        .from('inner_circle_votes')
        .select('collection_id, voter_name');

      if (votesError) throw votesError;

      // Get unique collection IDs from votes
      const collectionIds = [...new Set(votesData?.map(vote => vote.collection_id))];
      
      if (collectionIds.length === 0) {
        setResults([]);
        return;
      }

      // Get album details for voted collections
      const { data: albumsData, error: albumsError } = await supabase
        .from('collection')
        .select('id, artist, title, year, image_url, folder, inner_circle_preferred')
        .in('id', collectionIds);

      if (albumsError) throw albumsError;

      // Group votes by album and count
      const albumVotes: Record<number, VoteResult> = {};
      
      // Initialize album data
      albumsData?.forEach(album => {
        albumVotes[album.id] = {
          collection_id: album.id,
          artist: album.artist || '',
          title: album.title || '',
          year: album.year || '',
          image_url: album.image_url || '',
          folder: album.folder || '',
          vote_count: 0,
          current_ic_badge: album.inner_circle_preferred || false,
          voters: []
        };
      });

      // Count votes and collect voter names
      votesData?.forEach(vote => {
        if (albumVotes[vote.collection_id]) {
          albumVotes[vote.collection_id].vote_count++;
          albumVotes[vote.collection_id].voters.push(vote.voter_name || 'Anonymous');
        }
      });

      const sortedResults = Object.values(albumVotes).sort((a, b) => b.vote_count - a.vote_count);
      setResults(sortedResults);

    } catch (error) {
      console.error('Error loading voting results:', error);
      setStatus(`Error loading results: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const loadVoterInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('inner_circle_votes')
        .select('voter_name, voter_email, voted_at')
        .order('voted_at', { ascending: false });

      if (error) throw error;

      // Group by voter and count albums voted for
      const voterMap: Record<string, VoterInfo> = {};
      
      data?.forEach(vote => {
        const key = vote.voter_email;
        if (!voterMap[key]) {
          voterMap[key] = {
            voter_name: vote.voter_name,
            voter_email: vote.voter_email,
            voted_at: vote.voted_at,
            album_count: 0
          };
        }
        voterMap[key].album_count++;
      });

      setVoters(Object.values(voterMap));
    } catch (error) {
      console.error('Error loading voter info:', error);
    }
  };

  const toggleICBadge = async (albumId: number, currentState: boolean) => {
    setUpdating(albumId);
    try {
      const { error } = await supabase
        .from('collection')
        .update({ inner_circle_preferred: !currentState })
        .eq('id', albumId);

      if (error) throw error;

      // Update local state
      setResults(prev => prev.map(result => 
        result.collection_id === albumId 
          ? { ...result, current_ic_badge: !currentState }
          : result
      ));

      setStatus(`${!currentState ? 'Added' : 'Removed'} Inner Circle badge for album ID ${albumId}`);
      setTimeout(() => setStatus(''), 3000);

    } catch (error) {
      console.error('Error updating IC badge:', error);
      setStatus(`Error updating badge: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUpdating(null);
    }
  };

  const applyTopWinners = async (topCount: number) => {
    if (!confirm(`Apply Inner Circle badges to the top ${topCount} voted albums?`)) return;
    
    setStatus(`Applying badges to top ${topCount} albums...`);
    
    try {
      const topAlbums = results.slice(0, topCount);
      const updates = topAlbums.map(album => 
        supabase
          .from('collection')
          .update({ inner_circle_preferred: true })
          .eq('id', album.collection_id)
      );

      await Promise.all(updates);

      // Update local state
      setResults(prev => prev.map((result, index) => 
        index < topCount 
          ? { ...result, current_ic_badge: true }
          : result
      ));

      setStatus(`✅ Applied Inner Circle badges to top ${topCount} albums!`);
    } catch (error) {
      setStatus(`Error applying badges: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const sortedResults = [...results].sort((a, b) => {
    switch (sortBy) {
      case 'artist':
        return a.artist.localeCompare(b.artist);
      case 'title':
        return a.title.localeCompare(b.title);
      case 'votes':
      default:
        return b.vote_count - a.vote_count;
    }
  });

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <h1>Loading Inner Circle Voting Results...</h1>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: '#fff', color: '#222', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 8 }}>
          💎 Inner Circle Voting Results
        </h1>
        <p style={{ color: '#666', fontSize: 16, marginBottom: 16 }}>
          View voting results and apply Inner Circle badges to winners
        </p>
        
        {/* Quick Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 16,
          marginBottom: 24
        }}>
          <div style={{
            background: '#f0f9ff',
            padding: 16,
            borderRadius: 8,
            border: '1px solid #0369a1'
          }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#0c4a6e' }}>
              {results.length}
            </div>
            <div style={{ fontSize: 14, color: '#0369a1' }}>Albums Voted For</div>
          </div>
          
          <div style={{
            background: '#f0fdf4',
            padding: 16,
            borderRadius: 8,
            border: '1px solid #22c55e'
          }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#15803d' }}>
              {voters.length}
            </div>
            <div style={{ fontSize: 14, color: '#059669' }}>Total Voters</div>
          </div>
          
          <div style={{
            background: '#fefce8',
            padding: 16,
            borderRadius: 8,
            border: '1px solid #eab308'
          }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#a16207' }}>
              {results.reduce((sum, r) => sum + r.vote_count, 0)}
            </div>
            <div style={{ fontSize: 14, color: '#ca8a04' }}>Total Votes Cast</div>
          </div>
          
          <div style={{
            background: '#fdf2f8',
            padding: 16,
            borderRadius: 8,
            border: '1px solid #ec4899'
          }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#be185d' }}>
              {results.filter(r => r.current_ic_badge).length}
            </div>
            <div style={{ fontSize: 14, color: '#db2777' }}>Current IC Badges</div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{
        marginBottom: 24,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => applyTopWinners(10)}
          style={{
            background: '#7c3aed',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '10px 16px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          🏆 Badge Top 10
        </button>
        
        <button
          onClick={() => applyTopWinners(15)}
          style={{
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '10px 16px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          🏆 Badge Top 15
        </button>
        
        <button
          onClick={() => applyTopWinners(20)}
          style={{
            background: '#059669',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '10px 16px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          🏆 Badge Top 20
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 14, fontWeight: 'bold' }}>Sort by:</label>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as 'votes' | 'artist' | 'title')}
            style={{
              padding: '6px 10px',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              fontSize: 14
            }}
          >
            <option value="votes">Vote Count</option>
            <option value="artist">Artist</option>
            <option value="title">Title</option>
          </select>
        </div>
      </div>

      {status && (
        <div style={{
          marginBottom: 16,
          padding: 12,
          borderRadius: 8,
          background: status.includes('Error') ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${status.includes('Error') ? '#fca5a5' : '#22c55e'}`,
          color: status.includes('Error') ? '#dc2626' : '#059669',
          fontWeight: 'bold'
        }}>
          {status}
        </div>
      )}

      {/* Results Table */}
      <div style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f9fafb' }}>
            <tr>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Rank</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Album</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>Votes</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>IC Badge</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Voters</th>
            </tr>
          </thead>
          <tbody>
            {sortedResults.map((result, index) => (
              <tr key={result.collection_id} style={{
                borderBottom: '1px solid #f3f4f6',
                background: result.current_ic_badge ? '#fdf2f8' : 'white'
              }}>
                <td style={{ padding: '12px 8px', fontWeight: 'bold', fontSize: 18 }}>
                  {sortBy === 'votes' ? index + 1 : '—'}
                </td>
                
                <td style={{ padding: '12px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {result.image_url ? (
                      <Image
                        src={result.image_url}
                        alt={`${result.artist} - ${result.title}`}
                        width={50}
                        height={50}
                        style={{ borderRadius: 6, objectFit: 'cover' }}
                        unoptimized
                      />
                    ) : (
                      <div style={{
                        width: 50,
                        height: 50,
                        background: '#e5e7eb',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        color: '#9ca3af'
                      }}>
                        NO IMG
                      </div>
                    )}
                    
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: 16 }}>
                        {result.title}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: 14 }}>
                        {result.artist} • {result.year}
                      </div>
                      <div style={{ color: '#9ca3af', fontSize: 12 }}>
                        {result.folder}
                      </div>
                    </div>
                  </div>
                </td>
                
                <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                  <div style={{
                    background: '#dbeafe',
                    color: '#1d4ed8',
                    padding: '6px 12px',
                    borderRadius: 20,
                    fontWeight: 'bold',
                    fontSize: 16,
                    display: 'inline-block'
                  }}>
                    {result.vote_count}
                  </div>
                </td>
                
                <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                  <button
                    onClick={() => toggleICBadge(result.collection_id, result.current_ic_badge)}
                    disabled={updating === result.collection_id}
                    style={{
                      background: result.current_ic_badge ? '#7c3aed' : '#e5e7eb',
                      color: result.current_ic_badge ? 'white' : '#6b7280',
                      border: 'none',
                      borderRadius: 20,
                      padding: '6px 12px',
                      cursor: updating === result.collection_id ? 'not-allowed' : 'pointer',
                      fontWeight: 'bold',
                      fontSize: 12
                    }}
                  >
                    {updating === result.collection_id ? '...' : 
                     result.current_ic_badge ? '💎 IC' : 'Add IC'}
                  </button>
                </td>
                
                <td style={{ padding: '12px 8px', fontSize: 12 }}>
                  {result.voters.slice(0, 3).join(', ')}
                  {result.voters.length > 3 && ` +${result.voters.length - 3} more`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Voter Information */}
      <div style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>
          Voter Information ({voters.length} people voted)
        </h3>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
          gap: 12
        }}>
          {voters.map(voter => (
            <div key={voter.voter_email} style={{
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: 12
            }}>
              <div style={{ fontWeight: 'bold', fontSize: 14 }}>
                {voter.voter_name}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                {voter.voter_email}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>
                {voter.album_count} votes • {new Date(voter.voted_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}