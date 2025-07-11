// src/app/now-playing-tv/page.tsx - Enhanced TV Display with clean UI
"use client";

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    let nowPlayingChannel: ReturnType<typeof supabase.channel> | null = null;
    let albumContextChannel: ReturnType<typeof supabase.channel> | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const fetchNowPlaying = async (): Promise<void> => {
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
          
          // Try to reconnect after a delay
          if (reconnectTimeout) clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(() => {
            console.log('Attempting to reconnect...');
            fetchNowPlaying();
          }, 5000);
        } else {
          console.log('Successfully fetched now playing:', data);
          setCurrentTrack(data);
          setIsConnected(true);
          setLastUpdate(new Date());
          
          // Clear any pending reconnect attempts
          if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
          }
        }
      } catch (error) {
        console.error('Error fetching now playing:', error);
        setIsConnected(false);
      }
    };

    const fetchAlbumContext = async (): Promise<void> => {
      try {
        const { data, error } = await supabase
          .from('album_context')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!error && data) {
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
        console.error('Error fetching album context:', error);
        setAlbumContext(null);
      }
    };

    // Initial fetch
    fetchNowPlaying();
    fetchAlbumContext();

    // Enhanced real-time subscriptions
    nowPlayingChannel = supabase
      .channel('now_playing_enhanced_tv')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'now_playing' },
        (payload) => {
          console.log('Now playing updated via real-time:', payload);
          fetchNowPlaying();
        }
      )
      .subscribe((status) => {
        console.log('Now playing subscription status:', status);
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsConnected(false);
        }
      });

    albumContextChannel = supabase
      .channel('album_context_changes_tv')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'album_context' },
        (payload) => {
          console.log('Album context updated via real-time:', payload);
          fetchAlbumContext();
        }
      )
      .subscribe();

    // Refresh every 10 seconds
    const interval = setInterval(() => {
      fetchNowPlaying();
      fetchAlbumContext();
    }, 10000);

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
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      clearInterval(interval);
    };
  }, []);

  if (!currentTrack || (!currentTrack.artist && !currentTrack.title)) {
    return (
      <div 
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #7c3aed 100%)',
          color: 'white',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: '"Inter", sans-serif',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}
      >
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
            src="https://drive.google.com/uc?export=view&id=1SHEq1g_k_0ooTYsDEqcUXN_vVsuwiBNQ"
            alt="Dead Wax Dialogues"
            width={120}
            height={60}
            style={{
              filter: 'brightness(0) invert(1)',
              opacity: 0.8
            }}
            unoptimized
          />
          <Image
            src="https://byo.com/wp-content/uploads/Devils-Purse-logo.jpg"
            alt="Devil's Purse"
            width={120}
            height={60}
            style={{
              opacity: 0.8,
              borderRadius: '8px'
            }}
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

        <div style={{ 
          textAlign: 'center',
          opacity: 0.8,
          marginTop: '100px'
        }}>
          <div style={{ 
            fontSize: '4rem', 
            marginBottom: '2rem',
            opacity: 0.5 
          }}>
            🎵
          </div>
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
            marginBottom: '1rem',
            fontSize: '1rem',
            opacity: 0.9
          }}>
            {isConnected ? '🟢' : '🔴'} System: {isConnected ? 'Ready' : 'Connecting...'}
          </div>

          {/* Album context status */}
          {albumContext && (
            <div style={{
              background: 'rgba(34, 197, 94, 0.2)',
              border: '1px solid rgba(34, 197, 94, 0.5)',
              borderRadius: 12,
              padding: '16px 24px',
              marginBottom: '1rem',
              fontSize: '1rem',
              opacity: 0.9
            }}>
              🎯 Album Context: <strong>{albumContext.artist} - {albumContext.title}</strong>
            </div>
          )}
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

  // Display logic with enhanced collection matching
  const displayArtist = currentTrack.artist;
  const displayTrackTitle = currentTrack.title;
  const displayAlbumTitle = currentTrack.album_title;
  const displayYear = currentTrack.collection?.year;
  
  // Use collection image if available, otherwise recognition image
  const displayImage = currentTrack.collection?.image_url || currentTrack.recognition_image_url;
  const displayFormat = currentTrack.collection?.folder;
  
  // Determine if this is guest vinyl or from collection
  const isGuestVinyl = !currentTrack.collection;

  // Determine if this track is part of the current album context
  const isFromAlbumContext = albumContext && 
    albumContext.artist.toLowerCase() === currentTrack.artist?.toLowerCase() &&
    (albumContext.title.toLowerCase() === currentTrack.album_title?.toLowerCase() ||
     albumContext.track_listing?.some(track => 
       track.toLowerCase() === currentTrack.title?.toLowerCase()
     ));

  return (
    <div 
      style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #7c3aed 100%)',
        color: 'white',
        height: '100vh',
        display: 'flex',
        fontFamily: '"Inter", sans-serif',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
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
          src="https://drive.google.com/uc?export=view&id=1SHEq1g_k_0ooTYsDEqcUXN_vVsuwiBNQ"
          alt="Dead Wax Dialogues"
          width={120}
          height={60}
          style={{
            filter: 'brightness(0) invert(1)',
            opacity: 0.8
          }}
          unoptimized
        />
        <Image
          src="https://byo.com/wp-content/uploads/Devils-Purse-logo.jpg"
          alt="Devil's Purse"
          width={120}
          height={60}
          style={{
            opacity: 0.8,
            borderRadius: '8px'
          }}
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
        <div style={{ 
          marginRight: '4rem',
          flexShrink: 0
        }}>
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
            
            {/* Format/Status badge */}
            {displayFormat ? (
              <div style={{
                position: 'absolute',
                top: '-15px',
                right: '-15px',
                background: '#7c3aed',
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
        </div>

        {/* Track Info */}
        <div style={{ 
          flex: 1,
          paddingTop: '2rem'
        }}>
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
          
          {/* Album Title - if different from track title */}
          {displayAlbumTitle && displayAlbumTitle !== displayTrackTitle && (
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
          
          {/* Year */}
          <p style={{ 
            fontSize: '1.8rem', 
            margin: '0 0 2rem 0',
            opacity: 0.7,
            fontWeight: 400
          }}>
            {displayYear || (isGuestVinyl ? 'Guest Vinyl' : 'Unknown Year')}
          </p>

          {/* Live indicator */}
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
          </div>

          {/* Album context info (simplified) */}
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
          <div><strong>Collection Match:</strong> {currentTrack.collection ? 'Yes' : 'No'}</div>
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