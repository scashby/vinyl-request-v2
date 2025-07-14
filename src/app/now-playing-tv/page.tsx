// src/app/now-playing-tv/page.tsx - FIXED TV Display with Enhanced Real-time Updates
"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
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
  track_duration?: number;
  next_recognition_in?: number;
  collection?: CollectionAlbum;
}

export default function FixedTVDisplay() {
  const [currentTrack, setCurrentTrack] = useState<NowPlayingData | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [updateCount, setUpdateCount] = useState<number>(0);
  const [connectionRetries, setConnectionRetries] = useState<number>(0);
  
  // Refs to prevent memory leaks and manage subscriptions
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataRef = useRef<string>('');

  // Enhanced data fetching with change detection
  const fetchNowPlaying = useCallback(async (source: string = 'manual'): Promise<void> => {
    try {
      console.log(`🔄 [${source}] Fetching now playing data... (attempt ${updateCount + 1})`);
      
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
        
        // Retry logic for connection errors
        if (connectionRetries < 5) {
          const retryDelay = Math.min(1000 * Math.pow(2, connectionRetries), 10000);
          console.log(`🔄 Retrying in ${retryDelay}ms... (retry ${connectionRetries + 1}/5)`);
          
          retryTimeoutRef.current = setTimeout(() => {
            setConnectionRetries(prev => prev + 1);
            fetchNowPlaying(`${source}-retry-${connectionRetries + 1}`);
          }, retryDelay);
        }
        return;
      }

      // Check if data actually changed
      const dataString = JSON.stringify(data);
      const hasDataChanged = dataString !== lastDataRef.current;
      
      if (hasDataChanged || source === 'manual') {
        console.log(`✅ [${source}] Data ${hasDataChanged ? 'changed' : 'fetched'}, updating display:`, {
          artist: data?.artist,
          title: data?.title,
          album: data?.album_title,
          collection_id: data?.album_id,
          service: data?.service_used,
          updated_at: data?.updated_at
        });
        
        setCurrentTrack(data);
        setLastUpdate(new Date());
        setUpdateCount(prev => prev + 1);
        setConnectionRetries(0); // Reset retry counter on success
        lastDataRef.current = dataString;
      } else {
        console.log(`📍 [${source}] No data changes detected`);
      }
      
      setIsConnected(true);
      
    } catch (error) {
      console.error(`❌ [${source}] Error fetching now playing:`, error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [updateCount, connectionRetries]);

  // Enhanced real-time subscription setup
  const setupRealtimeSubscription = useCallback(() => {
    console.log('🔗 Setting up enhanced real-time subscription...');
    
    // Clean up existing subscription
    if (channelRef.current) {
      console.log('🧹 Cleaning up existing subscription');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Create new subscription with multiple event listeners
    channelRef.current = supabase
      .channel('now_playing_tv_enhanced', {
        config: {
          broadcast: { self: true },
          presence: { key: `tv-display-${Date.now()}` }
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
          console.log('📡 Real-time update received:', {
            eventType: payload.eventType,
            new: payload.new,
            old: payload.old,
            timestamp: new Date().toISOString()
          });
          
          // Immediate fetch on any change
          fetchNowPlaying(`realtime-${payload.eventType}`);
        }
      )
      .on('broadcast', 
        { event: 'now_playing_update' }, 
        (payload) => {
          console.log('📢 Broadcast update received:', payload);
          fetchNowPlaying('broadcast');
        }
      )
      .subscribe((status, err) => {
        console.log('📡 Subscription status changed:', status, err);
        setIsConnected(status === 'SUBSCRIBED');
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time subscription active');
          setConnectionRetries(0);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel error, will retry...', err);
          
          // Retry subscription after a delay
          setTimeout(() => {
            setupRealtimeSubscription();
          }, 2000);
        }
      });
  }, [fetchNowPlaying]);

  // Setup polling fallback
  const setupPollingFallback = useCallback(() => {
    console.log('⏰ Setting up polling fallback (every 15 seconds)...');
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(() => {
      fetchNowPlaying('polling');
    }, 15000); // More frequent polling
  }, [fetchNowPlaying]);

  // Main initialization effect
  useEffect(() => {
    console.log('🚀 Initializing TV Display with enhanced real-time updates...');
    
    // Initial fetch
    fetchNowPlaying('initial');
    
    // Setup real-time subscription
    setupRealtimeSubscription();
    
    // Setup polling fallback
    setupPollingFallback();

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up TV Display...');
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [fetchNowPlaying, setupRealtimeSubscription, setupPollingFallback]);

  // Keyboard controls for refresh and reconnect
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        console.log('🔄 Manual refresh requested');
        fetchNowPlaying('manual-keyboard');
      } else if (e.key === 'r' || e.key === 'R') {
        console.log('🔄 Reconnecting real-time subscription...');
        setupRealtimeSubscription();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [fetchNowPlaying, setupRealtimeSubscription]);

  // Format duration helper
  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
          <div style={{ fontSize: '1.5rem' }}>Loading Enhanced TV Display...</div>
          <div style={{ fontSize: '1rem', opacity: 0.8, marginTop: '0.5rem' }}>
            Setting up real-time updates...
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

          {/* Enhanced Connection Status */}
          <div style={{
            background: isConnected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            border: `1px solid ${isConnected ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`,
            borderRadius: 12,
            padding: '16px 24px',
            fontSize: '1rem',
            opacity: 0.9,
            marginBottom: '1rem'
          }}>
            {isConnected ? '🟢 System: Ready & Listening' : '🔴 System: Connecting...'}
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
            <span>Last Check: {lastUpdate.toLocaleTimeString()}</span>
            {connectionRetries > 0 && <span>Retries: {connectionRetries}</span>}
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
  const isGuestVinyl = !isFromCollection;
  const trackDuration = currentTrack.track_duration;
  const nextRecognition = currentTrack.next_recognition_in;

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
            
            {/* Enhanced Collection/Guest status badge */}
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
                🏆 {displayFormat}
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
                👤 GUEST
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
          
          {/* Enhanced metadata */}
          <div style={{ 
            fontSize: '1.8rem', 
            margin: '0 0 2rem 0',
            opacity: 0.7,
            fontWeight: 400,
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap'
          }}>
            <span>{displayYear || 'Unknown Year'}</span>
            {trackDuration && (
              <span style={{
                background: 'rgba(59, 130, 246, 0.2)',
                color: '#60a5fa',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '1.2rem',
                fontWeight: 600,
                border: '1px solid rgba(59, 130, 246, 0.5)'
              }}>
                ⏱️ {formatDuration(trackDuration)}
              </span>
            )}
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
                🏆 FROM COLLECTION
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
                👤 GUEST VINYL
              </span>
            )}
            {nextRecognition && (
              <span style={{
                background: 'rgba(147, 51, 234, 0.2)',
                color: '#a855f7',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '1.2rem',
                fontWeight: 600,
                border: '1px solid rgba(147, 51, 234, 0.5)'
              }}>
                🧠 Next: {nextRecognition}s
              </span>
            )}
          </div>

          {/* Connection Status Indicator */}
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
              animation: isConnected ? 'pulse 2s infinite' : 'none'
            }} />
            <span>Live Updates {isConnected ? 'Active' : 'Disconnected'}</span>
            <span>• Updates: {updateCount}</span>
          </div>
        </div>
      </div>

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