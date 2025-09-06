// Fixed Album Detail page with track listings, event context, and navigation
// Replace: src/app/browse/album-detail/[id]/page.js

"use client";

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from 'src/lib/supabaseClient';
import { addOrVoteRequest } from 'src/lib/addOrVoteRequest';
import 'styles/internal.css';
import 'styles/album-detail.css';

function AlbumDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id;
  const eventId = searchParams.get('eventId');

  const [album, setAlbum] = useState(null);
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requestStatus, setRequestStatus] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const fetchAlbum = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('collection')
        .select('*')
        .eq('id', id)
        .single();

      if (error) setError(error.message);
      else setAlbum(data);
    } catch {
      setError('Failed to load album');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchEventData = useCallback(async () => {
    if (!eventId) return;
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
      if (!error && data) setEventData(data);
    } catch (error) {
      console.error('Error fetching event data:', error);
    }
  }, [eventId]);

  useEffect(() => {
    if (id) fetchAlbum();
    if (eventId) fetchEventData();
  }, [id, eventId, fetchAlbum, fetchEventData]);

  const handleAddToQueue = async (side) => {
    if (!eventId) {
      setRequestStatus('No event selected');
      return;
    }
    if (!album) {
      setRequestStatus('Album not loaded');
      return;
    }

    setSubmittingRequest(true);
    try {
      const updated = await addOrVoteRequest({
        eventId,
        albumId: id,
        side,
        artist: album.artist,
        title: album.title,
        status: 'open',                // matches your existing page’s status
        year: album.year ?? null,
        format: album.format ?? null,
        folder: album.folder ?? 'Unknown',
      });

      setRequestStatus(`Queued ${album.title} — Side ${side}. Votes: x${updated?.votes ?? 1}`);
    } catch (err) {
      console.error(err);
      setRequestStatus('Failed to add to queue');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const goToEvent = () => {
    if (eventId) {
      router.push(`/events/event-detail/${eventId}`);
    }
  };

  const goToBrowse = () => {
    if (eventId) {
      router.push(`/browse/browse-albums?eventId=${eventId}`);
    } else {
      router.push('/browse/browse-albums');
    }
  };

  const goToQueue = () => {
    if (eventId) {
      router.push(`/browse/browse-queue?eventId=${eventId}`);
    }
  };

  const getAvailableSides = () => {
    const sides = new Set();

    // Try parsing tracklists as JSON first
    if (album?.tracklists) {
      try {
        const parsedTracks = JSON.parse(album.tracklists);
        
        if (Array.isArray(parsedTracks)) {
          parsedTracks.forEach(track => {
            if (track.position) {
              const sideMatch = track.position.match(/^([A-Z])/);
              if (sideMatch) {
                sides.add(sideMatch[1]);
              }
            }
          });
        }
      } catch {
        // If JSON parsing fails, treat as plain text and look for side patterns
        const trackLines = album.tracklists.split('\n').filter(track => track.trim());
        trackLines.forEach(track => {
          const sideMatch = track.match(/^([A-Z])\d+/);
          if (sideMatch) {
            sides.add(sideMatch[1]);
          }
        });
      }
    }
    
    // If no sides found in tracklists, check the sides property
    if (sides.size === 0 && album?.sides) {
      Object.keys(album.sides).forEach(side => {
        sides.add(side.toUpperCase());
      });
    }
    
    // If still no sides found, default to A and B
    if (sides.size === 0) {
      sides.add('A');
      sides.add('B');
    }
    
    return Array.from(sides).sort();
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <div style={{ padding: 40, textAlign: 'center' }}>
          <p>Loading album...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wrapper">
        <div style={{ padding: 40, textAlign: 'center', color: 'red' }}>
          <p>Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="page-wrapper">
        <div style={{ padding: 40, textAlign: 'center' }}>
          <p>Album not found</p>
        </div>
      </div>
    );
  }

  const imageUrl = album.image_url && album.image_url.toLowerCase() !== 'no'
    ? album.image_url
    : '/images/coverplaceholder.png';

  return (
    <div className="album-detail">
      {/* Event shortcuts */}
      {eventId && (
        <div style={{
          position: 'relative', zIndex: 10, background: 'rgba(0, 0, 0, 0.8)',
          padding: '12px 24px', paddingLeft: '60px', display: 'flex',
          gap: '16px', alignItems: 'center', flexWrap: 'wrap'
        }}>
          <button onClick={goToBrowse} style={{
            background: '#059669', color: 'white', border: 'none',
            borderRadius: '6px', padding: '8px 16px', fontSize: '14px',
            fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
          }}>← Browse Collection</button>

          <button onClick={goToQueue} style={{
            background: '#3b82f6', color: 'white', border: 'none',
            borderRadius: '6px', padding: '8px 16px', fontSize: '14px',
            fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
          }}>🎵 View Queue</button>

          <button onClick={goToEvent} style={{
            background: '#9333ea', color: 'white', border: 'none',
            borderRadius: '6px', padding: '8px 16px', fontSize: '14px',
            fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
          }}>📅 Event Details</button>

          {eventData && (
            <span style={{ color: '#fff', fontSize: '14px', marginLeft: 'auto', opacity: 0.9 }}>
              Event: {eventData.title}
            </span>
          )}
        </div>
      )}

      {/* Album Header */}
      <div className="album-header">
        <Image
          src={imageUrl}
          alt={`${album.artist} - ${album.title}`}
          width={200}
          height={200}
          className="album-art"
          unoptimized
        />
        
        <div className="album-info">
          <h1 className="title">{album.title}</h1>
          <h2 className="artist">{album.artist}</h2>
          
          <div className="meta">
            {album.year && <span>Year: {album.year} • </span>}
            {album.format && <span>Format: {album.format} • </span>}
            {album.folder && <span>Category: {album.folder}</span>}
          </div>
          
          {album.media_condition && (
            <div className="meta" style={{ marginTop: '8px' }}>
              Condition: {album.media_condition}
            </div>
          )}
          
          {album.folder && (
            <span className="badge">{album.folder}</span>
          )}
          
          {eventId && (
            <div style={{ marginTop: '20px' }}>
              <h3 style={{ color: '#fff', marginBottom: '12px', fontSize: '18px' }}>
                Add to Event Queue:
              </h3>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {getAvailableSides().map((side, index) => (
                  <button
                    key={side}
                    onClick={() => handleAddToQueue(side)}
                    disabled={submittingRequest}
                    style={{
                      background: index % 4 === 0 ? '#3b82f6'
                        : index % 4 === 1 ? '#10b981'
                        : index % 4 === 2 ? '#f59e0b'
                        : '#ef4444',
                      color: 'white', border: 'none', borderRadius: 6,
                      padding: '12px 24px', cursor: submittingRequest ? 'not-allowed' : 'pointer',
                      fontSize: 16, fontWeight: 'bold', opacity: submittingRequest ? 0.7 : 1
                    }}
                  >
                    Side {side}
                  </button>
                ))}
              </div>

              {requestStatus && (
                <p style={{
                  color: requestStatus.includes('Error') ? '#ef4444' : '#10b981',
                  fontWeight: 'bold', fontSize: '14px'
                }}>
                  {requestStatus}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tracklist / Sides */}
      <div className="album-tracks">
        <h3>Tracks</h3>
        {album.tracklists ? (
          <div className="track-table">
            <div className="track head">
              <div>#</div>
              <div>Title</div>
              <div>Artist</div>
              <div>Duration</div>
            </div>

            {/* Try JSON format first */}
            {(() => {
              try {
                const tracks = JSON.parse(album.tracklists);

                if (Array.isArray(tracks)) {
                  // array of track objects
                  return tracks.map((track, index) => (
                    <div key={index} className="track">
                      <div>{track.position || index + 1}</div>
                      <div style={{ color: '#fff', fontWeight: '500' }}>
                        {track.title || track.name || 'Unknown Track'}
                      </div>
                      <div style={{ color: '#ccc' }}>
                        {track.artist || album.artist}
                      </div>
                      <div style={{ color: '#aaa', fontSize: '14px' }}>
                        {track.duration || '--:--'}
                      </div>
                    </div>
                  ));
                } else {
                  // object with track data not recognized
                  return (
                    <div className="track">
                      <div>1</div>
                      <div style={{ color: '#fff', fontWeight: '500' }}>
                        JSON data structure not recognized
                      </div>
                      <div style={{ color: '#ccc' }}>{album.artist}</div>
                      <div style={{ color: '#aaa', fontSize: '14px' }}>--:--</div>
                    </div>
                  );
                }
              } catch {
                // Fallback: plain text (one per line)
                const tracks = album.tracklists.split('\n').filter((t) => t.trim());
                return tracks.length ? tracks.map((t, i) => (
                  <div key={i} className="track">
                    <div>{i + 1}</div>
                    <div style={{ color: '#fff', fontWeight: '500' }}>{t}</div>
                    <div style={{ color: '#ccc' }}>{album.artist}</div>
                    <div style={{ color: '#aaa', fontSize: '14px' }}>--:--</div>
                  </div>
                )) : (
                  <div className="track">
                    <div>1</div>
                    <div style={{ color: '#fff', fontWeight: '500' }}>
                      {typeof tracks === 'string' ? tracks : 'No track information'}
                    </div>
                    <div style={{ color: '#ccc' }}>{album.artist}</div>
                    <div style={{ color: '#aaa', fontSize: '14px' }}>--:--</div>
                  </div>
                );
              }
            })()}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function AlbumDetailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AlbumDetailContent />
    </Suspense>
  );
}
