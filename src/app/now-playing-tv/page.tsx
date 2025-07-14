// src/app/now-playing-tv/page.tsx - Fixed TV Display
"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from 'lib/supabaseClient';
import Image from 'next/image';

interface CollectionAlbum {
  id: number;
  artist: string;
  title: string;
  year: string;
  image_url?: string;
  folder?: string;
}

interface AlbumContext {
  id: number;
  artist: string;
  title: string;
  year: string;
  image_url?: string;
  folder?: string;
  track_count?: number;
  track_listing?: string[];
  source?: string;
  created_at?: string;
}

interface NowPlayingData {
  id: number;
  artist?: string;
  title?: string;
  album_title?: string;
  recognition_image_url?: string;
  album_id?: number;
  track_number?: string;
  track_side?: string;
  started_at?: string;
  recognition_confidence?: number;
  service_used?: string;
  updated_at?: string;
  collection?: CollectionAlbum;
}

export default function EnhancedTVDisplay() {
  const [currentTrack, setCurrentTrack] = useState<NowPlayingData | null>(null);
  const [albumContext, setAlbumContext] = useState<AlbumContext | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Memoized fetch functions to prevent infinite loops
  const fetchNowPlaying = useCallback(async (): Promise<void> => {
    try {
      console.log('Fetching now playing data...');
      
      const { data, error } = await supabase
        .from('now_playing')
        .select(`
          *,
          collection (
            id,
            artist,
            title,
            year,
            image_url,
            folder
          )
        `)
        .eq('id', 1)
        .single();

      if (error) {
        console.error('Fetch error:', error);
        setIsConnected(false);
      } else {
        console.log('Successfully fetched now playing:', data);
        setCurrentTrack(data);
        setIsConnected(true);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Error fetching now playing:', error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAlbumContext = useCallback(async (): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('album_context')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.warn('Album context fetch error (non-critical):', error);
        // Don't set albumContext to null on error - keep existing value
        return;
      }

      if (data) {
        const contextAge = Date.now() - new Date(data.created_at).getTime();
        const maxAge = 2 * 60 * 60 * 1000; // 2 hours
        
        if (contextAge <= maxAge) {
          setAlbumContext(data);
        } else {
          setAlbumContext(null);
        }
      } else {
        setAlbumContext(null);
      }
    } catch (error) {
      console.warn('Album context fetch failed (non-critical):', error);
      // Don't crash the app or clear existing context on network errors
    }
  }, []);

  useEffect(() => {
    let nowPlayingChannel: ReturnType<typeof supabase.channel> | null = null;
    let albumContextChannel: ReturnType<typeof supabase.channel> | null = null;
    let intervalId: NodeJS.Timeout | null = null;

    // Initial fetch
    fetchNowPlaying();
    fetchAlbumContext();

    // Set up real-time subscriptions
    nowPlayingChannel = supabase
      .channel('now_playing_tv_simple')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'now_playing' },
        (payload) => {
          console.log('Now playing updated via real-time:', payload);
          fetchNowPlaying();
        }
      )
      .subscribe((status) => {
        console.log('Now playing subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    // Album context subscription (gracefully handles errors)
    albumContextChannel = supabase
      .channel('album_context_tv')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'album_context' },
        (payload) => {
          console.log('Album context updated via real-time:', payload);
          fetchAlbumContext();
        }
      )
      .subscribe((status) => {
        console.log('Album context subscription status:', status);
        // Don't affect main connection status if album context fails
      });

    // Polling fallback every 30 seconds
    intervalId = setInterval(() => {
      fetchNowPlaying();
      fetchAlbumContext();
    }, 30000);

    // Keyboard controls
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        setShowDebug(prev => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        fetchNowPlaying();
        fetchAlbumContext();
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      
      if (nowPlayingChannel) {
        supabase.removeChannel(nowPlayingChannel);
      }
      if (albumContextChannel) {
        supabase.removeChannel(albumContextChannel);
      }
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fetchNowPlaying, fetchAlbumContext]);

  // Loading state
  if (isLoading) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #7c3aed 100%)',
        color: 'white',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"Inter", sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎵</div>
          <div style={{ fontSize: '1.5rem' }}>Loading...</div>
        </div>
      </div>
    );
  }

  // No track state
  if (!currentTrack || (!currentTrack.artist && !currentTrack.title)) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #7c3aed 100%)',
        color: 'white',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"Inter", sans-serif',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        padding: '2rem'
      }}>
        {/* Logos */}
        <div style={{
          position: 'absolute',
          top: '30px',
          left: '30px',
          right: '30px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10
        }}>
          <Image
            src="/images/dwd-logo.PNG"
            alt="Dead Wax Dialogues"
            width={140}
            height={70}
            style={{ objectFit: 'contain', opacity: 0.9 }}
            unoptimized
          />
          <Image
            src="https://byo.com/wp-content/uploads/Devils-Purse-logo.jpg"
            alt="Devil's Purse"
            width={120}
            height={60}
            style={{ opacity: 0.8, borderRadius: '8px' }}
            unoptimized
          />
        </div>

        {/* Now Playing Header */}
        <div style={{
          position: 'absolute',
          top: '120px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '2.5rem',
          fontWeight: 'bold',
          opacity: 0.9,
          letterSpacing: '0.1em',
          textTransform: 'uppercase'
        }}>
          Now Playing
        </div>

        <div style={{ textAlign: 'center', opacity: 0.8, marginTop: '100px' }}>
          <div style={{ fontSize: '4rem', marginBottom: '2rem', opacity: 0.5 }}>🎵</div>
          <h1 style={{ 
            fontSize: '3rem', 
            fontWeight: 'bold', 
            margin: '0 0 1rem 0',
            letterSpacing: '-0.02em'
          }}>
            Waiting for Music
          </h1>
          <p style={{ 
            fontSize: '1.2rem', 
            margin: '0 0 2rem 0',
            fontStyle: 'italic',
            opacity: 0.7
          }}>
            Drop the needle. Let the side play.
          </p>

          {/* Connection Status */}
          <div style={{
            background: isConnected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            border: `1px solid ${isConnected ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`,
            borderRadius: 12,
            padding: '16px 24px',
            fontSize: '1rem',
            opacity: 0.9
          }}>
            {isConnected ? '🟢 System: Ready' : '🔴 System: Connecting...'}
          </div>
        </div>

        {/* Debug overlay */}
        {showDebug && (
          <div style={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            background: 'rgba(0,0,0,0.9)',
            padding: 16,
            borderRadius: 8,
            fontSize: 11,
            fontFamily: 'monospace',
            maxWidth: 400
          }}>
            <div><strong>Status:</strong> {isConnected ? 'Connected' : 'Disconnected'}</div>
            <div><strong>Last Update:</strong> {lastUpdate.toLocaleTimeString()}</div>
            <div><strong>Commands:</strong> D=debug, F=refresh</div>
          </div>
        )}
      </div>
    );
  }

  // Main display with track
  const displayArtist = currentTrack.artist;
  const displayTrackTitle = currentTrack.title;
  const displayAlbumTitle = currentTrack.album_title;
  const displayYear = currentTrack.collection?.year;
  const displayImage = currentTrack.collection?.image_url || currentTrack.recognition_image_url;
  const displayFormat = currentTrack.collection?.folder;
  const isFromCollection = !!(currentTrack.collection && currentTrack.album_id);
  const isGuestVinyl = !isFromCollection;

  // Determine if this track is part of the current album context
  const isFromAlbumContext = albumContext && 
    albumContext.artist.toLowerCase() === currentTrack.artist?.toLowerCase() &&
    (albumContext.title.toLowerCase() === currentTrack.album_title?.toLowerCase() ||
     albumContext.track_listing?.some(track => 
       track.toLowerCase() === currentTrack.title?.toLowerCase()
     ));

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e1b4b 0%, #7c3aed 100%)',
      color: 'white',
      height: '100vh',
      display: 'flex',
      fontFamily: '"Inter", sans-serif',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Background blur */}
      {displayImage && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `url(${displayImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(60px) brightness(0.3)',
          opacity: 0.6,
          zIndex: 0
        }} />
      )}

      {/* Logos */}
      <div style={{
        position: 'absolute',
        top: '30px',
        left: '30px',
        right: '30px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10
      }}>
        <Image
          src="/images/dwd-logo.PNG"
          alt="Dead Wax Dialogues"
          width={140}
          height={70}
          style={{ objectFit: 'contain', opacity: 0.9 }}
          unoptimized
        />
        <Image
          src="https://byo.com/wp-content/uploads/Devils-Purse-logo.jpg"
          alt="Devil's Purse"
          width={120}
          height={60}
          style={{ opacity: 0.8, borderRadius: '8px' }}
          unoptimized
        />
      </div>

      {/* Now Playing Header */}
      <div style={{
        position: 'absolute',
        top: '120px',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '2.5rem',
        fontWeight: 'bold',
        opacity: 0.9,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        zIndex: 10
      }}>
        Now Playing
      </div>

      {/* Main content */}
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        padding: '4rem',
        position: 'relative',
        zIndex: 1,
        maxWidth: '1400px',
        margin: '120px auto 0',
        height: 'calc(100vh - 240px)'
      }}>
        
        {/* Album Art */}
        <div style={{ marginRight: '4rem', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Image
              src={displayImage || '/images/coverplaceholder.png'}
              alt={displayAlbumTitle || 'Album cover'}
              width={450}
              height={450}
              style={{
                borderRadius: '20px',
                objectFit: 'cover',
                boxShadow: '0 25px 80px rgba(0,0,0,0.6)',
                border: '6px solid rgba(255,255,255,0.1)'
              }}
              unoptimized
              priority
            />
            
            {/* Collection/Guest status badge */}
            {isFromCollection && displayFormat ? (
              <div style={{
                position: 'absolute',
                top: '-15px',
                right: '-15px',
                background: '#22c55e',
                color: 'white',
                padding: '12px 20px',
                borderRadius: '25px',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {displayFormat}
              </div>
            ) : isGuestVinyl ? (
              <div style={{
                position: 'absolute',
                top: '-15px',
                right: '-15px',
                background: '#f59e0b',
                color: 'white',
                padding: '12px 20px',
                borderRadius: '25px',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                GUEST
              </div>
            ) : isFromCollection ? (
              <div style={{
                position: 'absolute',
                top: '-15px',
                right: '-15px',
                background: '#22c55e',
                color: 'white',
                padding: '12px 20px',
                borderRadius: '25px',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                COLLECTION
              </div>
            ) : null}

            {/* Album context indicator */}
            {isFromAlbumContext && (
              <div style={{
                position: 'absolute',
                bottom: '-15px',
                left: '-15px',
                background: '#22c55e',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                🎯 CONTEXT
              </div>
            )}
          </div>

          {/* Album context info */}
          {albumContext && (
            <div style={{
              background: 'rgba(34, 197, 94, 0.2)',
              border: '1px solid rgba(34, 197, 94, 0.5)',
              borderRadius: 12,
              padding: '16px 20px',
              fontSize: '1rem',
              opacity: 0.9,
              marginTop: '2rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🎯</span>
                <strong>Album Context: {albumContext.artist} - {albumContext.title}</strong>
                {isFromAlbumContext && (
                  <span style={{ 
                    background: '#22c55e',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    marginLeft: '8px'
                  }}>
                    MATCHED
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Track Info */}
        <div style={{ flex: 1, paddingTop: '2rem' }}>
          {/* Track Title */}
          <h1 style={{ 
            fontSize: '4.5rem', 
            fontWeight: 'bold', 
            margin: '0 0 1rem 0',
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            textShadow: '0 4px 20px rgba(0,0,0,0.5)'
          }}>
            {displayTrackTitle}
          </h1>
          
          {/* Album title */}
          {displayAlbumTitle && (
            <h2 style={{ 
              fontSize: '2.2rem', 
              margin: '0 0 1rem 0',
              opacity: 0.8,
              fontWeight: 400,
              fontStyle: 'italic',
              textShadow: '0 2px 10px rgba(0,0,0,0.5)'
            }}>
              from &ldquo;{displayAlbumTitle}&rdquo;
            </h2>
          )}
          
          {/* Artist */}
          <p style={{ 
            fontSize: '2.8rem', 
            margin: '0 0 2rem 0',
            opacity: 0.9,
            fontWeight: 500,
            textShadow: '0 2px 10px rgba(0,0,0,0.5)'
          }}>
            {displayArtist}
          </p>
          
          {/* Year and Collection Status */}
          <div style={{ 
            fontSize: '1.8rem', 
            margin: '0 0 2rem 0',
            opacity: 0.7,
            fontWeight: 400,
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <span>{displayYear || 'Unknown Year'}</span>
            {isFromCollection && (
              <span style={{
                background: 'rgba(34, 197, 94, 0.2)',
                color: '#10b981',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '1.2rem',
                fontWeight: 600,
                border: '1px solid rgba(34, 197, 94, 0.5)'
              }}>
                FROM COLLECTION
              </span>
            )}
            {isGuestVinyl && (
              <span style={{
                background: 'rgba(245, 158, 11, 0.2)',
                color: '#f59e0b',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '1.2rem',
                fontWeight: 600,
                border: '1px solid rgba(245, 158, 11, 0.5)'
              }}>
                GUEST VINYL
              </span>
            )}
          </div>

          {/* Live indicator and service info */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            fontSize: '1.2rem',
            opacity: 0.8
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                background: isConnected ? '#10b981' : '#ef4444',
                borderRadius: '50%',
                animation: isConnected ? 'pulse 2s infinite' : 'none'
              }} />
              <span>{isConnected ? 'Live' : 'Offline'}</span>
            </div>
            
            {currentTrack.service_used && (
              <div style={{ fontSize: '1rem', opacity: 0.6 }}>
                • {currentTrack.service_used}
              </div>
            )}
            
            {currentTrack.recognition_confidence && (
              <div style={{ fontSize: '1rem', opacity: 0.6 }}>
                • {Math.round(currentTrack.recognition_confidence * 100)}% confidence
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Debug overlay */}
      {showDebug && (
        <div style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          background: 'rgba(0,0,0,0.9)',
          padding: 16,
          borderRadius: 8,
          fontSize: 11,
          fontFamily: 'monospace',
          maxWidth: 400,
          zIndex: 10
        }}>
          <div><strong>Status:</strong> {isConnected ? 'Connected' : 'Disconnected'}</div>
          <div><strong>Collection Match:</strong> {isFromCollection ? 'Yes' : 'No'}</div>
          <div><strong>Album ID:</strong> {currentTrack.album_id || 'None'}</div>
          <div><strong>Guest Vinyl:</strong> {isGuestVinyl ? 'Yes' : 'No'}</div>
          <div><strong>Last Update:</strong> {lastUpdate.toLocaleTimeString()}</div>
          <div><strong>Commands:</strong> D=debug, F=refresh</div>
        </div>
      )}

      {/* CSS Animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `
      }} />
    </div>
  );
}