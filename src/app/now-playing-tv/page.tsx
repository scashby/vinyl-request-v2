// src/app/now-playing-tv/page.tsx - Cleaned TV Display (removed unwanted features)
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

export default function CleanedTVDisplay() {
  const [currentTrack, setCurrentTrack] = useState<NowPlayingData | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let nowPlayingChannel: ReturnType<typeof supabase.channel> | null = null;
    let intervalId: NodeJS.Timeout | null = null;

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
    };

    // Initial fetch
    fetchNowPlaying();

    // Set up real-time subscription
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

    // Polling fallback every 30 seconds
    intervalId = setInterval(() => {
      fetchNowPlaying();
    }, 30000);

    // Keyboard controls
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        setShowDebug(prev => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        fetchNowPlaying();
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      
      if (nowPlayingChannel) {
        supabase.removeChannel(nowPlayingChannel);
      }
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

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
          </div>
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