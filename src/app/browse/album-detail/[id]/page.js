// Fixed Album Detail page with track listings, event context, and navigation
// Replace: src/app/browse/album-detail/[id]/page.js

"use client";

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from 'src/lib/supabaseClient';
import AlbumSuggestionBox from 'components/AlbumSuggestionBox';
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
  const [showSuggestionBox, setShowSuggestionBox] = useState(false);

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

  const handleAddToQueue = async (side) => {
    if (!eventId) {
      setRequestStatus('No event selected');
      return;
    }

    setSubmittingRequest(true);
    try {
      const { error } = await supabase.from('requests').insert([
        {
          album_id: id,
          artist: album.artist,
          title: album.title,
          side: side,
          event_id: eventId,
          votes: 1,
          status: 'open'
        }
      ]);

      if (error) {
        setRequestStatus(`Error: ${error.message}`);
      } else {
        setRequestStatus(`Added ${album.title} - Side ${side} to queue!`);
      }
    } catch {
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
          <AlbumSuggestionBox 
            context="general" 
            eventId={eventId}
            eventTitle={eventData?.title}
          />
        </div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="page-wrapper">
        <div style={{ padding: 40, textAlign: 'center' }}>
          <p>Album not found</p>
          <AlbumSuggestionBox 
            context="general"
            eventId={eventId}
            eventTitle={eventData?.title}
          />
        </div>
      </div>
    );
  }

  const imageUrl = album.image_url && album.image_url.toLowerCase() !== 'no' 
    ? album.image_url 
    : '/images/coverplaceholder.png';

  return (
    <div className="album-detail">
      {/* Background blur effect */}
      <div 
        className="background-blur"
        style={{ backgroundImage: `url(${imageUrl})` }}
      />

      {/* Navigation Bar */}
      {eventId && (
        <div style={{
          position: 'relative',
          zIndex: 10,
          background: 'rgba(0, 0, 0, 0.8)',
          padding: '12px 24px',
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

          {/* Queue Actions */}
          {eventId && (
            <div style={{ marginTop: '20px' }}>
              <h3 style={{ color: '#fff', marginBottom: '12px', fontSize: '18px' }}>
                Add to Event Queue:
              </h3>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <button
                  onClick={() => handleAddToQueue('A')}
                  disabled={submittingRequest}
                  style={{
                    background: '#3b82f6',
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
                  Side A
                </button>
                <button
                  onClick={() => handleAddToQueue('B')}
                  disabled={submittingRequest}
                  style={{
                    background: '#10b981',
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
                  Side B
                </button>
              </div>
              
              {requestStatus && (
                <p style={{ 
                  color: requestStatus.includes('Error') ? '#ef4444' : '#10b981',
                  fontWeight: 'bold',
                  fontSize: '14px'
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
          </h3>
          
          <div className="tracklist-header">
            <div>#</div>
            <div>Title</div>
            <div>Artist</div>
            <div>Side</div>
          </div>
          
          {album.tracklists.split('\n').filter(track => track.trim()).map((track, index) => {
            // Parse track format: could be "1. Track Name" or just "Track Name"
            const trackMatch = track.trim().match(/^(\d+\.?\s*)?(.+)$/);
            const trackName = trackMatch ? trackMatch[2] : track.trim();
            
            return (
              <div key={index} className="track">
                <div>{index + 1}</div>
                <div style={{ color: '#fff', fontWeight: '500' }}>
                  {trackName}
                </div>
                <div style={{ color: '#ccc' }}>
                  {album.artist}
                </div>
                <div style={{ color: '#aaa', fontSize: '14px' }}>
                  {index < (album.tracklists.split('\n').length / 2) ? 'A' : 'B'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Alternative: Show sides data if available */}
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
          
          {Object.entries(album.sides).map(([sideName, tracks]) => (
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
              
              {Array.isArray(tracks) ? tracks.map((track, index) => (
                <div key={index} className="track">
                  <div>{index + 1}</div>
                  <div style={{ color: '#fff', fontWeight: '500' }}>
                    {typeof track === 'string' ? track : track.title || track.name || 'Unknown Track'}
                  </div>
                  <div style={{ color: '#ccc' }}>
                    {typeof track === 'object' && track.artist ? track.artist : album.artist}
                  </div>
                  <div style={{ color: '#aaa', fontSize: '14px' }}>
                    {typeof track === 'object' && track.duration ? track.duration : '--:--'}
                  </div>
                </div>
              )) : (
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
          ))}
        </div>
      )}

      {/* Album Suggestion Section */}
      <div style={{ 
        position: 'relative',
        zIndex: 10,
        maxWidth: '900px',
        margin: '40px auto',
        padding: '20px'
      }}>
        {!showSuggestionBox ? (
          <div style={{
            background: 'rgba(0, 0, 0, 0.7)',
            borderRadius: '12px',
            padding: '24px',
            textAlign: 'center',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <h3 style={{ 
              color: '#fff', 
              marginBottom: '12px', 
              fontSize: '20px' 
            }}>
              Don&apos;t see what you&apos;re looking for?
            </h3>
            <p style={{ 
              color: '#ccc', 
              marginBottom: '20px',
              fontSize: '16px'
            }}>
              Suggest an album for the Dead Wax Dialogues collection
            </p>
            <button
              onClick={() => setShowSuggestionBox(true)}
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}
            >
              💡 Suggest an Album
            </button>
          </div>
        ) : (
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '12px',
            padding: '4px',
            backdropFilter: 'blur(10px)'
          }}>
            <AlbumSuggestionBox 
              context="general"
              eventId={eventId}
              eventTitle={eventData?.title}
              onClose={() => setShowSuggestionBox(false)}
            />
          </div>
        )}
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