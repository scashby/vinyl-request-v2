// src/app/now-playing-tv/page.tsx
// FIXED: Real-time updates that actually work - TypeScript/ESLint compliant

"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from 'lib/supabaseClient';
import Image from 'next/image';
import type { RealtimeChannel } from '@supabase/supabase-js';

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
  started_at?: string;
  recognition_confidence?: number;
  service_used?: string;
  updated_at?: string;
  collection?: CollectionAlbum;
}

export default function FixedTVDisplay() {
  const [currentTrack, setCurrentTrack] = useState<NowPlayingData | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [updateCount, setUpdateCount] = useState<number>(0);
  
  // Refs for cleanup and state management
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataRef = useRef<string>('');
  const isActiveRef = useRef<boolean>(true);
  const connectionAttemptsRef = useRef<number>(0);

  // FIXED: Enhanced data fetching with proper change detection
  const fetchNowPlaying = useCallback(async (source: string = 'manual'): Promise<void> => {
    if (!isActiveRef.current) return;
    
    try {
      console.log(`🔄 [${source}] Fetching now playing data...`);
      
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
        console.error(`❌ [${source}] Fetch error:`, error);
        setIsConnected(false);
        return;
      }

      // FIXED: Complete change detection using all critical fields
      const currentDataString = JSON.stringify({
        artist: data?.artist || null,
        title: data?.title || null,
        album_title: data?.album_title || null,
        album_id: data?.album_id || null,
        recognition_image_url: data?.recognition_image_url || null,
        service_used: data?.service_used || null,
        recognition_confidence: data?.recognition_confidence || null,
        updated_at: data?.updated_at || null,
        started_at: data?.started_at || null,
        collection_artist: data?.collection?.artist || null,
        collection_title: data?.collection?.title || null,
        collection_image: data?.collection?.image_url || null
      });
      
      const hasChange = currentDataString !== lastDataRef.current;
      
      if (hasChange || source === 'manual' || source === 'initial') {
        console.log(`✅ [${source}] DATA CHANGED:`, {
          artist: data?.artist,
          title: data?.title,
          album: data?.album_title,
          updated_at: data?.updated_at,
          service: data?.service_used,
          confidence: data?.recognition_confidence
        });
        
        setCurrentTrack(data);
        setLastUpdate(new Date());
        setUpdateCount(prev => prev + 1);
        lastDataRef.current = currentDataString;
        
        console.log(`🎵 TV Display updated: ${data?.artist || 'Unknown'} - ${data?.title || 'Unknown'}`);
      } else {
        console.log(`📍 [${source}] No changes detected`);
      }
      
      setIsConnected(true);
      connectionAttemptsRef.current = 0; // Reset connection attempts on success
      
    } catch (error) {
      console.error(`❌ [${source}] Error:`, error);
      setIsConnected(false);
      connectionAttemptsRef.current++;
    } finally {
      if (source === 'initial') {
        setIsLoading(false);
      }
    }
  }, []);

  // FIXED: Robust real-time subscription with automatic reconnection
  const setupRealtimeSubscription = useCallback(() => {
    if (!isActiveRef.current) return;
    
    console.log('🔗 Setting up real-time subscription...');
    
    // Clean up existing subscription
    if (channelRef.current) {
      console.log('🧹 Cleaning up existing subscription');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Create new channel with unique name
    const channelName = `tv_display_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    channelRef.current = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: false },
          presence: { key: `tv-${Date.now()}` }
        }
      })
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'now_playing',
          filter: 'id=eq.1'
        },
        (payload) => {
          if (!isActiveRef.current) return;
          
          console.log('📡 REAL-TIME UPDATE RECEIVED:', {
            eventType: payload.eventType,
            timestamp: new Date().toISOString(),
            new_data: payload.new,
            old_data: payload.old
          });
          
          // Force immediate fetch on any database change
          setTimeout(() => {
            if (isActiveRef.current) {
              void fetchNowPlaying(`realtime-${payload.eventType}`);
            }
          }, 100); // Small delay to ensure database consistency
        }
      )
      .subscribe((status, err) => {
        console.log(`📡 Subscription status: ${status}`, err ? `Error: ${err}` : '');
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time subscription ACTIVE');
          setIsConnected(true);
          connectionAttemptsRef.current = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          console.error('❌ Channel error, will reconnect...', err);
          setIsConnected(false);
          
          // Exponential backoff for reconnection
          if (isActiveRef.current && connectionAttemptsRef.current < 5) {
            const delay = Math.min(1000 * Math.pow(2, connectionAttemptsRef.current), 30000);
            console.log(`🔄 Reconnecting in ${delay}ms (attempt ${connectionAttemptsRef.current + 1})`);
            
            setTimeout(() => {
              if (isActiveRef.current) {
                connectionAttemptsRef.current++;
                setupRealtimeSubscription();
              }
            }, delay);
          }
        }
      });
  }, [fetchNowPlaying]);

  // FIXED: More frequent polling as backup
  const setupPolling = useCallback(() => {
    if (!isActiveRef.current) return;
    
    console.log('⏰ Setting up backup polling (every 2 seconds)...');
    
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    pollIntervalRef.current = setInterval(() => {
      if (isActiveRef.current) {
        void fetchNowPlaying('polling-backup');
      }
    }, 2000); // More frequent polling for immediate updates
  }, [fetchNowPlaying]);

  // FIXED: Initialize with proper cleanup
  useEffect(() => {
    isActiveRef.current = true;
    connectionAttemptsRef.current = 0;
    console.log('🚀 Initializing Fixed TV Display...');
    
    // Initial fetch
    void fetchNowPlaying('initial');
    
    // Setup real-time with delay to ensure initial data is loaded
    setTimeout(() => {
      if (isActiveRef.current) {
        setupRealtimeSubscription();
      }
    }, 1000);
    
    // Setup backup polling
    setupPolling();

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up Fixed TV Display...');
      isActiveRef.current = false;
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [fetchNowPlaying, setupRealtimeSubscription, setupPolling]);

  // FIXED: Manual refresh and visibility handling
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F' || e.key === 'r' || e.key === 'R') {
        console.log('🔄 Manual refresh triggered');
        void fetchNowPlaying('manual-refresh');
        
        // Also restart real-time connection
        if (e.key === 'r' || e.key === 'R') {
          setupRealtimeSubscription();
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isActiveRef.current) {
        console.log('👀 Page became visible, refreshing...');
        void fetchNowPlaying('visibility-change');
        setupRealtimeSubscription();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchNowPlaying, setupRealtimeSubscription]);

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
          <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'pulse 2s infinite' }}>🎵</div>
          <div style={{ fontSize: '1.5rem' }}>Loading Fixed TV Display...</div>
          <div style={{ fontSize: '1rem', opacity: 0.8, marginTop: '0.5rem' }}>
            Real-time updates with 2-second polling backup...
          </div>
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

        {/* Header */}
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
          <div style={{ fontSize: '4rem', marginBottom: '2rem', opacity: 0.5, animation: 'pulse 3s infinite' }}>🎵</div>
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

          {/* Enhanced connection status */}
          <div style={{
            background: isConnected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            border: `1px solid ${isConnected ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`,
            borderRadius: 12,
            padding: '16px 24px',
            fontSize: '1rem',
            opacity: 0.9,
            marginBottom: '1rem'
          }}>
            <div>
              {isConnected ? '🟢 Real-time Connected' : '🔴 Reconnecting...'}
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '4px' }}>
              Connection attempts: {connectionAttemptsRef.current}
            </div>
          </div>
          
          <div style={{
            fontSize: '0.9rem',
            opacity: 0.6,
            display: 'flex',
            justifyContent: 'center',
            gap: '2rem',
            flexWrap: 'wrap'
          }}>
            <span>Updates: {updateCount}</span>
            <span>Last: {lastUpdate.toLocaleTimeString()}</span>
            <span>Real-time + 2s Polling</span>
          </div>
          
          <div style={{
            fontSize: '0.8rem',
            opacity: 0.5,
            marginTop: '1rem'
          }}>
            Press F to refresh • Press R to reconnect
          </div>
        </div>
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
  const recognitionConfidence = currentTrack.recognition_confidence;
  const serviceUsed = currentTrack.service_used;

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

      {/* Header */}
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
            
            {/* Collection/Recognition badge */}
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
                textTransform: 'uppercase'
              }}>
                🏆 {displayFormat}
              </div>
            ) : (
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
                textTransform: 'uppercase'
              }}>
                🎤 RECOGNIZED
              </div>
            )}
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
          
          {/* Album */}
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
          
          {/* Enhanced metadata */}
          <div style={{ 
            fontSize: '1.4rem', 
            margin: '0 0 2rem 0',
            opacity: 0.7,
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap'
          }}>
            <span>{displayYear || 'Year Unknown'}</span>
            {recognitionConfidence && (
              <span style={{
                background: 'rgba(59, 130, 246, 0.2)',
                color: '#60a5fa',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: 600
              }}>
                🎯 {Math.round(recognitionConfidence * 100)}%
              </span>
            )}
            {serviceUsed && (
              <span style={{
                background: 'rgba(147, 51, 234, 0.2)',
                color: '#a855f7',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: 600
              }}>
                🤖 {serviceUsed}
              </span>
            )}
          </div>

          {/* Enhanced connection status */}
          <div style={{
            position: 'absolute',
            bottom: '2rem',
            right: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.9rem',
            opacity: 0.6
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isConnected ? '#10b981' : '#ef4444',
              animation: 'pulse 2s infinite'
            }} />
            <span>Real-time {isConnected ? 'Connected' : 'Reconnecting'}</span>
            <span>• #{updateCount}</span>
            <span>• {lastUpdate.toLocaleTimeString()}</span>
            <span>• Polling: 2s</span>
          </div>
        </div>
      </div>

      {/* CSS */}
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