// src/app/tv-display/page.tsx - FIXED TV DISPLAY PAGE
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
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  // Load current track and set up real-time subscription
  useEffect(() => {
    loadCurrentTrack();

    // Enhanced subscription with better error handling and debugging
    const channel = supabase
      .channel('tv_display_now_playing', {
        config: {
          broadcast: { self: false },
          presence: { key: 'tv_display' }
        }
      })
      .on('postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'now_playing' 
        },
        (payload) => {
          console.log('[TV Display] Real-time update received:', payload);
          setLastUpdate(new Date().toLocaleTimeString());
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newTrack = payload.new as NowPlayingState;
            console.log('[TV Display] Setting new track:', newTrack);
            setCurrentTrack(newTrack);
          } else if (payload.eventType === 'DELETE') {
            console.log('[TV Display] Track deleted');
            setCurrentTrack(null);
          }
        }
      )
      .subscribe((status, err) => {
        console.log('[TV Display] Subscription status:', status);
        if (err) console.error('[TV Display] Subscription error:', err);
        setIsConnected(status === 'SUBSCRIBED');
      });

    // Also poll every 5 seconds as backup
    const pollInterval = setInterval(() => {
      console.log('[TV Display] Polling for updates...');
      loadCurrentTrack();
    }, 5000);

    return () => {
      console.log('[TV Display] Cleaning up subscription');
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  const loadCurrentTrack = async () => {
    try {
      const { data, error } = await supabase
        .from('now_playing')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') { // Not "no rows" error
          console.error('[TV Display] Error loading track:', error);
        }
        setCurrentTrack(null);
      } else {
        console.log('[TV Display] Loaded track:', data);
        setCurrentTrack(data);
      }
    } catch (error) {
      console.error('[TV Display] Exception loading track:', error);
      setCurrentTrack(null);
    }
  };

  return (
    <>
      {/* Hide the navigation completely with CSS */}
      <style jsx global>{`
        nav, header, .header-bar, .navigation, .menu-toggle, .hamburger, [role="navigation"] {
          display: none !important;
        }
        body {
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
        }
        main {
          padding: 0 !important;
          margin: 0 !important;
        }
      `}</style>
      
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
        color: 'white',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0',
        overflow: 'hidden',
        zIndex: 9999
      }}>
        {/* Background Pattern */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.15,
          backgroundImage: `
            radial-gradient(circle at 20% 30%, #60a5fa 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, #a78bfa 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, #34d399 0%, transparent 50%)
          `
        }}></div>
        
        {/* Brand Header */}
        <div style={{
          position: 'absolute',
          top: 48,
          left: 48,
          fontSize: '32px',
          fontWeight: 'bold',
          color: 'rgba(255, 255, 255, 0.8)',
          letterSpacing: '2px',
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
          zIndex: 10000
        }}>
          DEAD WAX DIALOGUES
        </div>

        {/* Connection Status */}
        <div style={{
          position: 'absolute',
          top: 48,
          right: 48,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: '18px',
          color: isConnected ? '#22c55e' : '#ef4444',
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
          zIndex: 10000
        }}>
          <div style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: isConnected ? '#22c55e' : '#ef4444',
            boxShadow: isConnected ? '0 0 10px #22c55e' : '0 0 10px #ef4444'
          }}></div>
          {isConnected ? 'LIVE' : 'DISCONNECTED'}
        </div>

        {/* Main Content */}
        <div style={{
          textAlign: 'center',
          maxWidth: '900px',
          width: '100%',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh'
        }}>
          {currentTrack ? (
            <>
              {/* Album Artwork */}
              {currentTrack.recognition_image_url ? (
                <Image
                  src={currentTrack.recognition_image_url}
                  alt="Album artwork"
                  width={400}
                  height={400}
                  style={{
                    borderRadius: '24px',
                    objectFit: 'cover',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    marginBottom: '48px',
                    border: '4px solid rgba(255, 255, 255, 0.2)'
                  }}
                  unoptimized
                  priority
                />
              ) : (
                <div style={{
                  width: '400px',
                  height: '400px',
                  borderRadius: '24px',
                  background: 'linear-gradient(45deg, #374151, #4b5563)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '120px',
                  marginBottom: '48px',
                  border: '4px solid rgba(255, 255, 255, 0.2)',
                  textShadow: '0 4px 8px rgba(0, 0, 0, 0.3)'
                }}>
                  🎵
                </div>
              )}

              {/* Track Information */}
              <div style={{
                fontSize: '60px',
                fontWeight: 'bold',
                marginBottom: '24px',
                lineHeight: '1.1',
                textShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
                maxWidth: '100%',
                wordWrap: 'break-word',
                textAlign: 'center'
              }}>
                {currentTrack.title}
              </div>

              <div style={{
                fontSize: '42px',
                color: 'rgba(255, 255, 255, 0.9)',
                marginBottom: '20px',
                fontWeight: '500',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                textAlign: 'center'
              }}>
                {currentTrack.artist}
              </div>

              {currentTrack.album_title && (
                <div style={{
                  fontSize: '28px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  marginBottom: '48px',
                  fontStyle: 'italic',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                  textAlign: 'center'
                }}>
                  {currentTrack.album_title}
                </div>
              )}
            </>
          ) : (
            <div style={{
              fontSize: '36px',
              color: 'rgba(255, 255, 255, 0.6)',
              textAlign: 'center',
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
            }}>
              <div style={{ fontSize: '120px', marginBottom: '32px' }}>🎧</div>
              <div>Listening for music...</div>
              <div style={{ fontSize: '24px', marginTop: '16px', color: 'rgba(255, 255, 255, 0.5)' }}>
                Start audio recognition from the control panel
              </div>
            </div>
          )}
        </div>

        {/* Debug info for development */}
        {process.env.NODE_ENV === 'development' && (
          <div style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.5)',
            fontFamily: 'monospace',
            zIndex: 10000
          }}>
            Connected: {isConnected ? 'Yes' : 'No'} | 
            Last Update: {lastUpdate || 'None'} | 
            Track ID: {currentTrack?.id || 'None'}
          </div>
        )}
      </div>
    </>
  );
}