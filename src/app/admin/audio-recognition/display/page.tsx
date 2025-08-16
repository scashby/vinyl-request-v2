// src/app/admin/audio-recognition/display/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { supabase } from 'src/lib/supabaseClient';
import Image from 'next/image';

interface NowPlayingState {
  id: number;
  artist: string;
  title: string;
  album_title?: string;
  album_id?: number;
  started_at: string;
  recognition_confidence: number;
  service_used: string;
  recognition_image_url?: string;
  next_recognition_in?: number;
}

export default function TVDisplayPage() {
  const [currentTrack, setCurrentTrack] = useState<NowPlayingState | null>(null);
  const [playingTime, setPlayingTime] = useState(0);
  const [isConnected, setIsConnected] = useState(true);

  // Load current track and set up real-time subscription
  useEffect(() => {
    loadCurrentTrack();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('now_playing_display')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'now_playing' },
        (payload) => {
          console.log('Now playing updated:', payload);
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setCurrentTrack(payload.new as NowPlayingState);
          } else if (payload.eventType === 'DELETE') {
            setCurrentTrack(null);
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Update playing time every second
  useEffect(() => {
    if (!currentTrack) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(currentTrack.started_at).getTime()) / 1000);
      setPlayingTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentTrack]);

  const loadCurrentTrack = async () => {
    try {
      const { data } = await supabase
        .from('now_playing')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setCurrentTrack(data);
      } else {
        setCurrentTrack(null);
      }
    } catch {
      console.log('No current track');
      setCurrentTrack(null);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // TV-optimized styles
  const tvStyles = {
    container: {
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
      minHeight: '100vh',
      color: 'white',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
      flexDirection: 'column' as const,
      justifyContent: 'center',
      alignItems: 'center',
      padding: '48px',
      position: 'relative' as const,
      overflow: 'hidden'
    },
    backgroundPattern: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.1,
      backgroundImage: `
        radial-gradient(circle at 25% 25%, #60a5fa 0%, transparent 50%),
        radial-gradient(circle at 75% 75%, #a78bfa 0%, transparent 50%)
      `
    },
    brandHeader: {
      position: 'absolute' as const,
      top: 48,
      left: 48,
      fontSize: '32px',
      fontWeight: 'bold',
      color: 'rgba(255, 255, 255, 0.8)',
      letterSpacing: '2px'
    },
    connectionStatus: {
      position: 'absolute' as const,
      top: 48,
      right: 48,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      fontSize: '18px',
      color: isConnected ? '#22c55e' : '#ef4444'
    },
    mainContent: {
      textAlign: 'center' as const,
      maxWidth: '1200px',
      width: '100%',
      zIndex: 1
    },
    albumArt: {
      width: '400px',
      height: '400px',
      borderRadius: '24px',
      objectFit: 'cover' as const,
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      marginBottom: '48px',
      border: '4px solid rgba(255, 255, 255, 0.1)'
    },
    placeholderArt: {
      width: '400px',
      height: '400px',
      borderRadius: '24px',
      background: 'linear-gradient(45deg, #374151, #4b5563)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '120px',
      marginBottom: '48px',
      border: '4px solid rgba(255, 255, 255, 0.1)'
    },
    trackTitle: {
      fontSize: '72px',
      fontWeight: 'bold',
      marginBottom: '24px',
      lineHeight: '1.1',
      textShadow: '0 4px 8px rgba(0, 0, 0, 0.3)'
    },
    artistName: {
      fontSize: '48px',
      color: 'rgba(255, 255, 255, 0.9)',
      marginBottom: '32px',
      fontWeight: '500'
    },
    albumName: {
      fontSize: '32px',
      color: 'rgba(255, 255, 255, 0.7)',
      marginBottom: '48px',
      fontStyle: 'italic'
    },
    playingInfo: {
      display: 'flex',
      justifyContent: 'center',
      gap: '48px',
      fontSize: '24px',
      color: 'rgba(255, 255, 255, 0.8)'
    },
    noTrackMessage: {
      fontSize: '36px',
      color: 'rgba(255, 255, 255, 0.6)',
      textAlign: 'center' as const
    }
  };

  return (
    <div style={tvStyles.container}>
      <div style={tvStyles.backgroundPattern}></div>
      
      <div style={tvStyles.brandHeader}>
        DEAD WAX DIALOGUES
      </div>

      <div style={tvStyles.connectionStatus}>
        <div style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          backgroundColor: isConnected ? '#22c55e' : '#ef4444'
        }}></div>
        {isConnected ? 'LIVE' : 'DISCONNECTED'}
      </div>

      <div style={tvStyles.mainContent}>
        {currentTrack ? (
          <>
            {/* Album Artwork */}
            {currentTrack.recognition_image_url ? (
              <Image
                src={currentTrack.recognition_image_url}
                alt="Album artwork"
                width={400}
                height={400}
                style={tvStyles.albumArt}
                unoptimized
                priority
              />
            ) : (
              <div style={tvStyles.placeholderArt}>
                🎵
              </div>
            )}

            {/* Track Information */}
            <div style={tvStyles.trackTitle}>
              {currentTrack.title}
            </div>

            <div style={tvStyles.artistName}>
              {currentTrack.artist}
            </div>

            {currentTrack.album_title && (
              <div style={tvStyles.albumName}>
                {currentTrack.album_title}
              </div>
            )}

            {/* Playing Information */}
            <div style={tvStyles.playingInfo}>
              <div>
                ⏱️ {formatTime(playingTime)}
              </div>
              <div>
                🎯 {Math.round(currentTrack.recognition_confidence * 100)}%
              </div>
              <div>
                📡 {currentTrack.service_used.toUpperCase()}
              </div>
            </div>
          </>
        ) : (
          <div style={tvStyles.noTrackMessage}>
            <div style={{ fontSize: '120px', marginBottom: '32px' }}>🎧</div>
            <div>Listening for music...</div>
            <div style={{ fontSize: '24px', marginTop: '16px', color: 'rgba(255, 255, 255, 0.5)' }}>
              Start audio recognition from the control panel
            </div>
          </div>
        )}
      </div>

      {/* Subtle animation for visual interest */}
      <style jsx>{`
        @keyframes gentle-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        
        .album-art {
          animation: gentle-pulse 8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}