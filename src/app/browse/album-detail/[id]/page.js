// Album Detail page with queue type support (track/side/album)
// Replace: src/app/browse/album-detail/[id]/page.js

"use client";

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from 'src/lib/supabaseClient';
import 'styles/internal.css';
import 'styles/album-detail.css';

// tiny inline style object for the 1001 badge
const badge1001 = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  padding: "2px 6px",
  fontSize: 10,
  fontWeight: 700,
  lineHeight: 1,
  border: "1px solid rgba(0,0,0,0.2)",
  background: "rgba(0,0,0,0.75)",
  color: "#fff",
  marginLeft: 8,
  whiteSpace: "nowrap",
};

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

      if (error) {
        setError(error.message);
      } else {
        setAlbum(data);
      }
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

      if (!error && data) {
        setEventData(data);
      }
    } catch (error) {
      console.error('Error fetching event data:', error);
    }
  }, [eventId]);

  useEffect(() => {
    if (id) {
      fetchAlbum();
    }
    if (eventId) {
      fetchEventData();
    }
  }, [id, eventId, fetchAlbum, fetchEventData]);

  // Handler for side-based queue
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
      const { data: existingRows, error: findErr } = await supabase
        .from('requests')
        .select('id, votes')
        .eq('event_id', eventId)
        .eq('album_id', id)
        .eq('side', side)
        .order('timestamp', { ascending: true })
        .limit(1);

      if (findErr) throw findErr;

      const existing = Array.isArray(existingRows) ? existingRows[0] : null;

      if (existing) {
        const newVotes = (existing.votes ?? 0) + 1;
        const { error: updateErr } = await supabase
          .from('requests')
          .update({ votes: newVotes })
          .eq('id', existing.id);

        if (updateErr) throw updateErr;

        setRequestStatus(`Added vote: ${album.title} — Side ${side}. Votes: x${newVotes}`);
      } else {
        const { error: insertErr } = await supabase.from('requests').insert([{
          album_id: id,
          artist: album.artist,
          title: album.title,
          side: side,
          event_id: eventId,
          votes: 1,
          status: 'open'
        }]);

        if (insertErr) throw insertErr;

        setRequestStatus(`Added ${album.title} — Side ${side} to queue! Votes: x1`);
      }
    } catch (e) {
      console.error(e);
      setRequestStatus('Failed to add to queue');
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Handler for track-based queue
  const handleAddTrackToQueue = async (track) => {
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
      const { data: existingRows, error: findErr } = await supabase
        .from('requests')
        .select('id, votes')
        .eq('event_id', eventId)
        .eq('album_id', id)
        .eq('track_number', track.position || '')
        .order('timestamp', { ascending: true })
        .limit(1);

      if (findErr) throw findErr;

      const existing = Array.isArray(existingRows) ? existingRows[0] : null;

      if (existing) {
        const newVotes = (existing.votes ?? 0) + 1;
        const { error: updateErr } = await supabase
          .from('requests')
          .update({ votes: newVotes })
          .eq('id', existing.id);

        if (updateErr) throw updateErr;

        setRequestStatus(`Added vote: ${track.title || track.name}. Votes: x${newVotes}`);
      } else {
        const { error: insertErr } = await supabase.from('requests').insert([{
          album_id: id,
          artist: track.artist || album.artist,
          title: track.title || track.name,
          track_number: track.position || '',
          track_name: track.title || track.name,
          track_duration: track.duration || '',
          event_id: eventId,
          votes: 1,
          status: 'open',
          side: null
        }]);

        if (insertErr) throw insertErr;

        setRequestStatus(`Added "${track.title || track.name}" to queue! Votes: x1`);
      }
    } catch (e) {
      console.error(e);
      setRequestStatus('Failed to add to queue');
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Handler for album-based queue
  const handleAddAlbumToQueue = async () => {
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
      const { data: existingRows, error: findErr } = await supabase
        .from('requests')
        .select('id, votes')
        .eq('event_id', eventId)
        .eq('album_id', id)
        .is('side', null)
        .is('track_number', null)
        .order('timestamp', { ascending: true })
        .limit(1);

      if (findErr) throw findErr;

      const existing = Array.isArray(existingRows) ? existingRows[0] : null;

      if (existing) {
        const newVotes = (existing.votes ?? 0) + 1;
        const { error: updateErr } = await supabase
          .from('requests')
          .update({ votes: newVotes })
          .eq('id', existing.id);

        if (updateErr) throw updateErr;

        setRequestStatus(`Added vote for full album: ${album.title}. Votes: x${newVotes}`);
      } else {
        const { error: insertErr } = await supabase.from('requests').insert([{
          album_id: id,
          artist: album.artist,
          title: album.title,
          side: null,
          track_number: null,
          track_name: null,
          event_id: eventId,
          votes: 1,
          status: 'open'
        }]);

        if (insertErr) throw insertErr;

        setRequestStatus(`Added full album "${album.title}" to queue! Votes: x1`);
      }
    } catch (e) {
      console.error(e);
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
        const trackLines = album.tracklists.split('\n').filter(track => track.trim());
        trackLines.forEach(track => {
          const sideMatch = track.match(/^([A-Z])\d+/);
          if (sideMatch) {
            sides.add(sideMatch[1]);
          }
        });
      }
    }
    
    if (sides.size === 0 && album?.sides) {
      Object.keys(album.sides).forEach(side => {
        sides.add(side.toUpperCase());
      });
    }
    
    if (sides.size === 0) {
      sides.add('A');
      sides.add('B');
    }
    
    return Array.from(sides).sort();
  };

  const getTracksList = () => {
    if (!album?.tracklists) return [];

    try {
      const parsedTracks = JSON.parse(album.tracklists);
      
      if (Array.isArray(parsedTracks)) {
        return parsedTracks;
      }
      return [];
    } catch {
      // Parse plain text format
      return album.tracklists.split('\n').filter(track => track.trim()).map((track, index) => {
        const trackMatch = track.trim().match(/^(\d+\.?\s*)?(.+)$/);
        const trackName = trackMatch ? trackMatch[2] : track.trim();
        
        return {
          position: index + 1,
          title: trackName,
          artist: album.artist,
          duration: '--:--'
        };
      });
    }
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

  // Handle both old queue_type (singular) and new queue_types (array)
  const queueTypes = eventData?.queue_types || (eventData?.queue_type ? [eventData.queue_type] : ['side']);
  const queueTypesArray = Array.isArray(queueTypes) ? queueTypes : [queueTypes];

  return (
    <div className="album-detail">
      <div 
        className="background-blur"
        style={{ backgroundImage: `url(${imageUrl})` }}
      />

      {eventId && (
        <div style={{
          position: 'relative',
          zIndex: 10,
          background: 'rgba(0, 0, 0, 0.8)',
          padding: '12px 24px',
          paddingLeft: '60px',
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={goToBrowse}
            style={{
              background: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ← Browse Collection
          </button>
          
          <button
            onClick={goToQueue}
            style={{
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            🎵 View Queue
          </button>

          <button
            onClick={goToEvent}
            style={{
              background: '#9333ea',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            📅 Event Details
          </button>

          {eventData && (
            <span style={{
              color: '#fff',
              fontSize: '14px',
              marginLeft: 'auto',
              opacity: 0.9
            }}>
              Event: {eventData.title}
            </span>
          )}
        </div>
      )}

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
          <h1 className="title">
            {album.title}
            {album.is_1001 ? (
              <span title="On the 1001 Albums list" style={badge1001}>
                1001
              </span>
            ) : null}
          </h1>
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
          
          {album.notes && (
            <div style={{ 
              marginTop: '16px',
              padding: '12px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              backdropFilter: 'blur(10px)'
            }}>
              <strong>Notes:</strong> {album.notes}
            </div>
          )}

          {/* Queue Actions - Adaptive based on queue types */}
          {eventId && eventData?.has_queue && (
            <div style={{ marginTop: '20px' }}>
              {queueTypesArray.includes('side') && (
                <>
                  <h3 style={{ color: '#fff', marginBottom: '12px', fontSize: '18px' }}>
                    Add to Event Queue (By Side):
                  </h3>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    {getAvailableSides().map((side, index) => (
                      <button
                        key={side}
                        onClick={() => handleAddToQueue(side)}
                        disabled={submittingRequest}
                        style={{
                          background: index % 4 === 0 ? '#3b82f6' : 
                                     index % 4 === 1 ? '#10b981' : 
                                     index % 4 === 2 ? '#f59e0b' : '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          padding: '12px 24px',
                          cursor: submittingRequest ? 'not-allowed' : 'pointer',
                          fontSize: 16,
                          fontWeight: 'bold',
                          opacity: submittingRequest ? 0.7 : 1
                        }}
                      >
                        Side {side}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {queueTypesArray.includes('album') && (
                <>
                  <h3 style={{ color: '#fff', marginBottom: '12px', fontSize: '18px' }}>
                    Add Full Album to Queue:
                  </h3>
                  <button
                    onClick={handleAddAlbumToQueue}
                    disabled={submittingRequest}
                    style={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      padding: '16px 32px',
                      cursor: submittingRequest ? 'not-allowed' : 'pointer',
                      fontSize: 18,
                      fontWeight: 'bold',
                      opacity: submittingRequest ? 0.7 : 1,
                      boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                      marginBottom: '16px'
                    }}
                  >
                    💿 Add Full Album to Queue
                  </button>
                </>
              )}
              
              {requestStatus && (
                <p style={{ 
                  color: requestStatus.includes('Error') || requestStatus.includes('Failed') ? '#ef4444' : '#10b981',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  marginTop: '12px'
                }}>
                  {requestStatus}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Track Listings */}
      {album?.tracklists && (
        <div className="tracklist">
          <h3 style={{ 
            color: '#fff', 
            marginBottom: '20px', 
            fontSize: '20px',
            fontWeight: 'bold'
          }}>
            Track Listing
            {queueTypesArray.includes('track') && eventId && eventData?.has_queue && (
              <span style={{ fontSize: '14px', marginLeft: '12px', opacity: 0.8 }}>
                (Click any track to add to queue)
              </span>
            )}
          </h3>
          
          <div className="tracklist-header">
            <div>#</div>
            <div>Title</div>
            <div>Artist</div>
            <div>Duration</div>
            {queueTypesArray.includes('track') && eventId && eventData?.has_queue && (
              <div>Add</div>
            )}
          </div>
          
          {(() => {
            const tracks = getTracksList();
            const blockedTracks = album.blocked_tracks || [];
            
            return tracks.map((track, index) => {
              const blockedInfo = blockedTracks.find(bt => bt.position === track.position);
              const isBlocked = !!blockedInfo;
              
              return (
                <div 
                  key={index} 
                  className="track"
                  style={{
                    cursor: queueTypesArray.includes('track') && eventId && eventData?.has_queue ? 'pointer' : 'default',
                    transition: 'background-color 0.2s',
                    opacity: isBlocked ? 0.6 : 1,
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {track.position || index + 1}
                    {isBlocked && (
                      <span 
                        title={blockedInfo.reason || 'Track blocked'}
                        style={{
                          display: 'inline-block',
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          background: '#ef4444',
                          color: 'white',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          textAlign: 'center',
                          lineHeight: '16px',
                          cursor: 'help'
                        }}
                      >
                        !
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#fff', fontWeight: '500' }}>
                    {track.title || track.name || 'Unknown Track'}
                    {isBlocked && (
                      <span style={{
                        marginLeft: '8px',
                        fontSize: '11px',
                        color: '#fca5a5',
                        fontStyle: 'italic'
                      }}>
                        ({blockedInfo.reason || 'Blocked'})
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#ccc' }}>
                    {track.artist || album.artist}
                  </div>
                  <div style={{ color: '#aaa', fontSize: '14px' }}>
                    {track.duration || '--:--'}
                  </div>
                  {queueTypesArray.includes('track') && eventId && eventData?.has_queue && (
                    <div>
                      <button
                        onClick={() => handleAddTrackToQueue(track)}
                        disabled={submittingRequest || isBlocked}
                        style={{
                          background: isBlocked ? '#9ca3af' : '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: submittingRequest || isBlocked ? 'not-allowed' : 'pointer',
                          opacity: submittingRequest || isBlocked ? 0.7 : 1
                        }}
                        title={isBlocked ? blockedInfo.reason || 'Track blocked' : 'Add to queue'}
                      >
                        {isBlocked ? '🚫' : '+ Add'}
                      </button>
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      )}

      {!album?.tracklists && album?.sides && (
        <div className="tracklist">
          <h3 style={{ 
            color: '#fff', 
            marginBottom: '20px', 
            fontSize: '20px',
            fontWeight: 'bold'
          }}>
            Album Sides
          </h3>
          
          {Object.entries(album.sides).map(([sideName, tracks]) => {
            const blockedTracks = album.blocked_tracks || [];
            
            return (
              <div key={sideName} style={{ marginBottom: '24px' }}>
                <h4 style={{ 
                  color: '#fff', 
                  fontSize: '16px', 
                  marginBottom: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  Side {sideName}
                </h4>
                
                <div className="tracklist-header">
                  <div>#</div>
                  <div>Title</div>
                  <div>Artist</div>
                  <div>Duration</div>
                </div>
                
                {Array.isArray(tracks) ? tracks.map((track, index) => {
                  const trackPosition = `${sideName}${index + 1}`;
                  const blockedInfo = blockedTracks.find(bt => bt.position === trackPosition);
                  const isBlocked = !!blockedInfo;
                  
                  return (
                    <div 
                      key={index} 
                      className="track"
                      style={{
                        opacity: isBlocked ? 0.6 : 1
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {index + 1}
                        {isBlocked && (
                          <span 
                            title={blockedInfo.reason || 'Track blocked'}
                            style={{
                              display: 'inline-block',
                              width: '16px',
                              height: '16px',
                              borderRadius: '50%',
                              background: '#ef4444',
                              color: 'white',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              textAlign: 'center',
                              lineHeight: '16px',
                              cursor: 'help'
                            }}
                          >
                            !
                          </span>
                        )}
                      </div>
                      <div style={{ color: '#fff', fontWeight: '500' }}>
                        {typeof track === 'string' ? track : track.title || track.name || 'Unknown Track'}
                        {isBlocked && (
                          <span style={{
                            marginLeft: '8px',
                            fontSize: '11px',
                            color: '#fca5a5',
                            fontStyle: 'italic'
                          }}>
                            ({blockedInfo.reason || 'Blocked'})
                          </span>
                        )}
                      </div>
                      <div style={{ color: '#ccc' }}>
                        {typeof track === 'object' && track.artist ? track.artist : album.artist}
                      </div>
                      <div style={{ color: '#aaa', fontSize: '14px' }}>
                        {typeof track === 'object' && track.duration ? track.duration : '--:--'}
                      </div>
                    </div>
                  );
                }) : (
                  <div className="track">
                    <div>1</div>
                    <div style={{ color: '#fff', fontWeight: '500' }}>
                      {typeof tracks === 'string' ? tracks : 'No track information'}
                    </div>
                    <div style={{ color: '#ccc' }}>
                      {album.artist}
                    </div>
                    <div style={{ color: '#aaa', fontSize: '14px' }}>
                      --:--
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
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