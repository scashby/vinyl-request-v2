// src/app/now-playing-tv/page.tsx - Enhanced TV Display with better debugging
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
  const [recognitionMode, setRecognitionMode] = useState<string>('unknown');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [connectionAttempts, setConnectionAttempts] = useState<number>(0);
  const [forceRefreshCount, setForceRefreshCount] = useState<number>(0);

  useEffect(() => {
    let nowPlayingChannel: ReturnType<typeof supabase.channel> | null = null;
    let albumContextChannel: ReturnType<typeof supabase.channel> | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const fetchNowPlaying = async (): Promise<void> => {
      try {
        console.log('Fetching now playing data...');
        setConnectionAttempts(prev => prev + 1);
        
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
            setRecognitionMode('Album Context Active');
          } else {
            setAlbumContext(null);
            setRecognitionMode('General Recognition');
          }
        } else {
          setAlbumContext(null);
          setRecognitionMode('General Recognition');
        }
      } catch (error) {
        console.error('Error fetching album context:', error);
        setAlbumContext(null);
        setRecognitionMode('General Recognition');
      }
    };

    // Initial fetch
    fetchNowPlaying();
    fetchAlbumContext();

    // Enhanced real-time subscriptions with better error handling
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
          console.log('Subscription error, will attempt manual refresh');
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
      .subscribe((status) => {
        console.log('Album context subscription status:', status);
      });

    // Aggressive refresh as backup - every 10 seconds
    const interval = setInterval(() => {
      console.log('Performing scheduled refresh...');
      fetchNowPlaying();
      fetchAlbumContext();
    }, 10000);

    // Force refresh with 'F' key
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        setShowDebug(prev => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        console.log('Force refresh triggered by user');
        setForceRefreshCount(prev => prev + 1);
        fetchNowPlaying();
        fetchAlbumContext();
      } else if (e.key === 'c' || e.key === 'C') {
        // Clear now playing
        clearNowPlaying();
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

  const clearNowPlaying = async (): Promise<void> => {
    try {
      console.log('Clearing now playing...');
      const { error } = await supabase
        .from('now_playing')
        .update({
          artist: null,
          title: null,
          album_title: null,
          recognition_image_url: null,
          album_id: null,
          track_number: null,
          track_side: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      if (error) {
        console.error('Error clearing now playing:', error);
      } else {
        console.log('Now playing cleared successfully');
      }
    } catch (error) {
      console.error('Error clearing now playing:', error);
    }
  };

  const getElapsedTime = (): string => {
    if (!currentTrack?.started_at) return '';
    
    const startTime = new Date(currentTrack.started_at);
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
    
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getAlbumContextAge = (): string => {
    if (!albumContext?.created_at) return '';
    
    const age = Date.now() - new Date(albumContext.created_at).getTime();
    const minutes = Math.floor(age / (1000 * 60));
    
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ago`;
  };

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
          justifyContent: 'center'
        }}
      >
        <div style={{ 
          textAlign: 'center',
          opacity: 0.8
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
            {isConnected ? '🟢' : '🔴'} Database: {isConnected ? 'Connected' : 'Reconnecting...'}
            <br />
            <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
              Last update: {lastUpdate.toLocaleTimeString()} • Attempts: {connectionAttempts}
            </span>
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
              <br />
              <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                Set {getAlbumContextAge()} • Ready for track recognition
              </span>
            </div>
          )}

          <div style={{
            fontSize: '0.9rem',
            opacity: 0.6,
            background: 'rgba(255,255,255,0.1)',
            padding: '12px 20px',
            borderRadius: 8,
            display: 'inline-block'
          }}>
            Mode: {recognitionMode} • Press &apos;F&apos; to force refresh • Press &apos;C&apos; to clear • Press &apos;D&apos; for debug
          </div>
        </div>

        {/* Enhanced Debug overlay */}
        {showDebug && (
          <div style={{
            position: 'absolute',
            top: 20,
            right: 20,
            background: 'rgba(0,0,0,0.9)',
            padding: 16,
            borderRadius: 8,
            fontSize: 11,
            fontFamily: 'monospace',
            zIndex: 10,
            minWidth: 400,
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <div><strong>Connection Status:</strong> {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</div>
            <div><strong>Recognition Mode:</strong> {recognitionMode}</div>
            <div><strong>Last Update:</strong> {lastUpdate.toLocaleString()}</div>
            <div><strong>Connection Attempts:</strong> {connectionAttempts}</div>
            <div><strong>Force Refreshes:</strong> {forceRefreshCount}</div>
            <hr style={{ margin: '8px 0', opacity: 0.3 }} />
            <div><strong>Current Track Data:</strong></div>
            <pre style={{ fontSize: 10, maxHeight: 200, overflow: 'auto', background: 'rgba(255,255,255,0.1)', padding: 8, borderRadius: 4 }}>
              {JSON.stringify(currentTrack, null, 2)}
            </pre>
            <hr style={{ margin: '8px 0', opacity: 0.3 }} />
            <div><strong>Album Context:</strong> {albumContext ? 'Active' : 'None'}</div>
            {albumContext && (
              <pre style={{ fontSize: 10, maxHeight: 150, overflow: 'auto', background: 'rgba(255,255,255,0.1)', padding: 8, borderRadius: 4 }}>
                {JSON.stringify(albumContext, null, 2)}
              </pre>
            )}
            <hr style={{ margin: '8px 0', opacity: 0.3 }} />
            <div><strong>Keyboard Commands:</strong></div>
            <div style={{ fontSize: 10 }}>
              • F: Force refresh<br/>
              • C: Clear now playing<br/>
              • D: Toggle debug
            </div>
          </div>
        )}
      </div>
    );
  }

  // Display logic: ALWAYS use recognition data for track/album/artist names
  const displayArtist = currentTrack.artist;
  const displayTrackTitle = currentTrack.title;
  const displayAlbumTitle = currentTrack.album_title;
  const displayYear = currentTrack.collection?.year;
  const displayImage = currentTrack.recognition_image_url || currentTrack.collection?.image_url;
  const displayFormat = currentTrack.collection?.folder;
  const isGuestVinyl = !currentTrack.collection;

  // Determine if this track is part of the current album context
  const isFromAlbumContext = albumContext && 
    albumContext.artist.toLowerCase() === currentTrack.artist?.toLowerCase() &&
    (albumContext.title.toLowerCase() === currentTrack.album_title?.toLowerCase() ||
     albumContext.track_listing?.some(track => 
       track.toLowerCase() === currentTrack.title?.toLowerCase()
     ));

  // Format track info
  const trackInfo = [];
  if (currentTrack.track_side) {
    trackInfo.push(`Side ${currentTrack.track_side}`);
  }
  if (currentTrack.track_number) {
    trackInfo.push(`Track ${currentTrack.track_number}`);
  }
  const trackInfoString = trackInfo.length > 0 ? trackInfo.join(' • ') : '';

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

      {/* Main content */}
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        padding: '4rem',
        position: 'relative',
        zIndex: 1,
        maxWidth: '1400px',
        margin: '0 auto'
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
            
            {/* Format/Context badge */}
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
            margin: '0 0 1rem 0',
            opacity: 0.9,
            fontWeight: 500,
            textShadow: '0 2px 10px rgba(0,0,0,0.5)'
          }}>
            {displayArtist}
          </p>
          
          {/* Track/Side Info */}
          {trackInfoString && (
            <p style={{ 
              fontSize: '1.6rem', 
              margin: '0 0 1rem 0',
              opacity: 0.7,
              fontWeight: 400,
              color: '#fbbf24'
            }}>
              {trackInfoString}
            </p>
          )}
          
          {/* Year */}
          <p style={{ 
            fontSize: '1.8rem', 
            margin: '0 0 2rem 0',
            opacity: 0.7,
            fontWeight: 400
          }}>
            {displayYear || (isGuestVinyl ? 'Guest Vinyl' : 'Unknown Year')}
          </p>

          {/* Recognition info */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2rem',
            fontSize: '1.2rem',
            opacity: 0.8,
            marginBottom: '2rem'
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
              <span>{isConnected ? 'Live' : 'Offline'} • Now Playing</span>
            </div>
            
            {/* Elapsed time */}
            {getElapsedTime() && getElapsedTime() !== '0:00' && (
              <>
                <span>•</span>
                <span>{getElapsedTime()}</span>
              </>
            )}

            {/* Confidence indicator */}
            {currentTrack.recognition_confidence && (
              <>
                <span>•</span>
                <span>{Math.round(currentTrack.recognition_confidence * 100)}% confidence</span>
              </>
            )}

            {/* Update info */}
            <span>•</span>
            <span style={{ fontSize: '1rem' }}>
              Updated: {new Date(currentTrack.updated_at || Date.now()).toLocaleTimeString()}
            </span>
          </div>

          {/* Album context info */}
          {albumContext && (
            <div style={{
              background: 'rgba(34, 197, 94, 0.2)',
              border: '1px solid rgba(34, 197, 94, 0.5)',
              borderRadius: 12,
              padding: '16px 20px',
              fontSize: '1rem',
              opacity: 0.9
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span>🎯</span>
                <strong>Album Context Active</strong>
                {isFromAlbumContext && (
                  <span style={{ 
                    background: '#22c55e',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold'
                  }}>
                    MATCHED
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                {albumContext.artist} - {albumContext.title}
                {albumContext.track_count && ` (${albumContext.track_count} tracks)`}
              </div>
              <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '4px' }}>
                Set {getAlbumContextAge()} • Source: {albumContext.source || 'unknown'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced footer */}
      <div style={{ 
        position: 'absolute',
        bottom: '2rem',
        left: '2rem',
        right: '2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.9rem',
        opacity: 0.6,
        zIndex: 1
      }}>
        <span>Dead Wax Dialogues</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem' }}>
          <span>Mode: {recognitionMode}</span>
          <span>•</span>
          <span>F=refresh, C=clear, D=debug</span>
          <span>•</span>
          <span>{isConnected ? '🟢 Live' : '🔴 Offline'}</span>
          <span>•</span>
          <span>Refreshes: {forceRefreshCount}</span>
        </div>
      </div>

      {/* Enhanced Debug overlay */}
      {showDebug && (
        <div style={{
          position: 'absolute',
          top: 20,
          right: 20,
          background: 'rgba(0,0,0,0.95)',
          padding: 20,
          borderRadius: 12,
          fontSize: 11,
          fontFamily: 'monospace',
          zIndex: 10,
          minWidth: 400,
          maxHeight: '80vh',
          overflowY: 'auto',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 'bold', color: '#fbbf24' }}>🔧 TV Display Debug</div>
          
          <div><strong>Connection:</strong> {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</div>
          <div><strong>Last Update:</strong> {lastUpdate.toLocaleString()}</div>
          <div><strong>Connection Attempts:</strong> {connectionAttempts}</div>
          <div><strong>Force Refreshes:</strong> {forceRefreshCount}</div>
          <div><strong>Recognition Mode:</strong> {recognitionMode}</div>
          <div><strong>Source:</strong> {isGuestVinyl ? 'Guest Vinyl' : 'Collection'}</div>
          <div><strong>Album ID:</strong> {currentTrack.album_id || 'None'}</div>
          <div><strong>Track Title:</strong> {displayTrackTitle || 'None'}</div>
          <div><strong>Album Title:</strong> {displayAlbumTitle || 'None'}</div>
          <div><strong>Track Info:</strong> {trackInfoString || 'None'}</div>
          <div><strong>Recognition Art:</strong> {currentTrack.recognition_image_url ? 'Yes' : 'No'}</div>
          <div><strong>Collection Art:</strong> {currentTrack.collection?.image_url ? 'Yes' : 'No'}</div>
          <div><strong>Using:</strong> {displayImage ? (currentTrack.recognition_image_url ? 'Recognition' : 'Collection') : 'Placeholder'}</div>
          <div><strong>Service:</strong> {currentTrack.service_used || 'Unknown'}</div>
          <div><strong>Confidence:</strong> {currentTrack.recognition_confidence ? Math.round(currentTrack.recognition_confidence * 100) + '%' : 'Unknown'}</div>
          <div><strong>Started:</strong> {currentTrack.started_at ? new Date(currentTrack.started_at).toLocaleTimeString() : 'Unknown'}</div>
          <div><strong>Updated:</strong> {currentTrack.updated_at ? new Date(currentTrack.updated_at).toLocaleTimeString() : 'Unknown'}</div>
          
          <hr style={{ margin: '12px 0', opacity: 0.3 }} />
          <div><strong>Album Context:</strong> {albumContext ? 'Active' : 'None'}</div>
          {albumContext && (
            <>
              <div><strong>Context Album:</strong> {albumContext.title}</div>
              <div><strong>Context Artist:</strong> {albumContext.artist}</div>
              <div><strong>Track Count:</strong> {albumContext.track_count || 'Unknown'}</div>
              <div><strong>From Context:</strong> {isFromAlbumContext ? 'Yes' : 'No'}</div>
              <div><strong>Context Age:</strong> {getAlbumContextAge()}</div>
            </>
          )}
          
          <hr style={{ margin: '12px 0', opacity: 0.3 }} />
          <div><strong>Raw Data:</strong></div>
          <pre style={{ 
            fontSize: 9, 
            maxHeight: 200, 
            overflow: 'auto', 
            background: 'rgba(255,255,255,0.1)', 
            padding: 8, 
            borderRadius: 4,
            margin: '8px 0'
          }}>
            {JSON.stringify(currentTrack, null, 2)}
          </pre>
          
          <div style={{ marginTop: 12, fontSize: 10, color: '#888' }}>
            <strong>Keyboard Commands:</strong><br/>
            • F: Force refresh all data<br/>
            • C: Clear now playing<br/>
            • D: Toggle this debug panel
          </div>
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