// src/app/now-playing-tv/page.tsx - Clean, focused display
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
  album_id?: number;
  started_at?: string;
  collection?: CollectionAlbum;
}

export default function CleanNowPlayingTVPage() {
  const [currentTrack, setCurrentTrack] = useState<NowPlayingData | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [showDebug, setShowDebug] = useState<boolean>(false);

  useEffect(() => {
    let subscriptionChannel: ReturnType<typeof supabase.channel> | null = null;

    const fetchNowPlaying = async (): Promise<void> => {
      try {
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
          setCurrentTrack(data);
          setIsConnected(true);
        }
      } catch (error) {
        console.error('Error fetching now playing:', error);
        setIsConnected(false);
      }
    };

    // Initial fetch
    fetchNowPlaying();

    // Real-time subscription
    subscriptionChannel = supabase
      .channel('now_playing_clean')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'now_playing' },
        () => {
          console.log('Now playing updated');
          fetchNowPlaying();
        }
      )
      .subscribe();

    // Refresh every 15 seconds as backup
    const interval = setInterval(fetchNowPlaying, 15000);

    return () => {
      if (subscriptionChannel) {
        supabase.removeChannel(subscriptionChannel);
      }
      clearInterval(interval);
    };
  }, []);

  const getElapsedTime = (): string => {
    if (!currentTrack?.started_at) return '';
    
    const startTime = new Date(currentTrack.started_at);
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
    
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Toggle debug info with key press
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        setShowDebug(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
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
          justifyContent: 'center'
        }}
      >
        {/* Simple waiting state */}
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
            margin: 0,
            fontStyle: 'italic',
            opacity: 0.7
          }}>
            Drop the needle. Let the side play.
          </p>
          
          {showDebug && (
            <div style={{
              position: 'absolute',
              top: 20,
              right: 20,
              background: 'rgba(0,0,0,0.8)',
              padding: 12,
              borderRadius: 8,
              fontSize: 12,
              fontFamily: 'monospace'
            }}>
              Status: {isConnected ? 'Connected' : 'Disconnected'}
            </div>
          )}
        </div>
      </div>
    );
  }

  const displayArtist = currentTrack.collection?.artist || currentTrack.artist;
  const displayTitle = currentTrack.collection?.title || currentTrack.title;
  const displayYear = currentTrack.collection?.year;
  const displayImage = currentTrack.collection?.image_url;
  const displayFormat = currentTrack.collection?.folder;

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
              alt={displayTitle || 'Album cover'}
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
            
            {/* Format badge - only if we have format info */}
            {displayFormat && (
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
            )}
          </div>
        </div>

        {/* Track Info */}
        <div style={{ 
          flex: 1,
          paddingTop: '2rem'
        }}>
          {/* Title */}
          <h1 style={{ 
            fontSize: '4.5rem', 
            fontWeight: 'bold', 
            margin: '0 0 1.5rem 0',
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            textShadow: '0 4px 20px rgba(0,0,0,0.5)'
          }}>
            {displayTitle}
          </h1>
          
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
          
          {/* Year - only if we have it */}
          {displayYear && (
            <p style={{ 
              fontSize: '1.8rem', 
              margin: '0 0 3rem 0',
              opacity: 0.7,
              fontWeight: 400
            }}>
              {displayYear}
            </p>
          )}

          {/* Playing indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            fontSize: '1.4rem',
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
                background: '#10b981',
                borderRadius: '50%',
                animation: 'pulse 2s infinite'
              }} />
              <span>Now Playing</span>
            </div>
            
            {/* Elapsed time - only if meaningful */}
            {getElapsedTime() && getElapsedTime() !== '0:00' && (
              <>
                <span>•</span>
                <span>{getElapsedTime()}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Minimal footer */}
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
        <span style={{ fontSize: '0.8rem' }}>
          Press &apos;D&apos; for debug • {isConnected ? 'Live' : 'Offline'}
        </span>
      </div>

      {/* Debug overlay */}
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
          minWidth: 250
        }}>
          <div><strong>Connection:</strong> {isConnected ? '🟢' : '🔴'}</div>
          <div><strong>Album ID:</strong> {currentTrack.album_id || 'None'}</div>
          <div><strong>Has Collection:</strong> {currentTrack.collection ? 'Yes' : 'No'}</div>
          <div><strong>Image Source:</strong> {displayImage ? 'Collection' : 'Placeholder'}</div>
          <div><strong>Started:</strong> {currentTrack.started_at ? new Date(currentTrack.started_at).toLocaleTimeString() : 'Unknown'}</div>
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