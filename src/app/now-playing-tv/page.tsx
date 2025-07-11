// Debug version of src/app/now-playing-tv/page.tsx
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
  format?: string;
}

interface NowPlayingData {
  id: number;
  artist?: string;
  title?: string;
  album_id?: number;
  started_at?: string;
  recognition_confidence?: number;
  service_used?: string;
  updated_at?: string;
  collection?: CollectionAlbum;
}

interface DebugInfo {
  lastQuery: string;
  lastError: string | null;
  dbRowCount: number;
  subscriptionActive: boolean;
  lastUpdateTime: string;
}

export default function NowPlayingTVDebugPage() {
  const [currentTrack, setCurrentTrack] = useState<NowPlayingData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    lastQuery: '',
    lastError: null,
    dbRowCount: 0,
    subscriptionActive: false,
    lastUpdateTime: ''
  });

  useEffect(() => {
    let subscriptionChannel: ReturnType<typeof supabase.channel> | null = null;

    // Fetch current now playing
    const fetchNowPlaying = async (): Promise<void> => {
      try {
        setDebugInfo(prev => ({ ...prev, lastQuery: 'Fetching now_playing...' }));
        
        // First, check if the table exists and has data
        const { count, error: countError } = await supabase
          .from('now_playing')
          .select('*', { count: 'exact', head: true });

        if (countError) {
          console.error('Count error:', countError);
          setDebugInfo(prev => ({ 
            ...prev, 
            lastError: `Count error: ${countError.message}`,
            dbRowCount: 0
          }));
          setIsConnected(false);
          return;
        }

        setDebugInfo(prev => ({ 
          ...prev, 
          dbRowCount: count || 0,
          lastError: null
        }));

        // Now fetch the actual data
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
              folder,
              format
            )
          `)
          .eq('id', 1)
          .single();

        if (error) {
          console.error('Fetch error:', error);
          setDebugInfo(prev => ({ 
            ...prev, 
            lastError: `Fetch error: ${error.message}`,
            lastQuery: 'Query failed',
            lastUpdateTime: new Date().toISOString()
          }));
          setIsConnected(false);
        } else {
          console.log('Successfully fetched now playing:', data);
          setCurrentTrack(data);
          setLastUpdated(new Date());
          setIsConnected(true);
          setDebugInfo(prev => ({ 
            ...prev, 
            lastError: null,
            lastQuery: 'Query successful',
            lastUpdateTime: new Date().toISOString()
          }));
        }
      } catch (error) {
        console.error('Error fetching now playing:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setDebugInfo(prev => ({ 
          ...prev, 
          lastError: `Exception: ${errorMessage}`,
          lastUpdateTime: new Date().toISOString()
        }));
        setIsConnected(false);
      }
    };

    // Initial fetch
    fetchNowPlaying();

    // Set up real-time subscription
    try {
      subscriptionChannel = supabase
        .channel('now_playing_changes_debug')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'now_playing' },
          (payload) => {
            console.log('Real-time update received:', payload);
            setDebugInfo(prev => ({ 
              ...prev, 
              subscriptionActive: true,
              lastUpdateTime: new Date().toISOString()
            }));
            fetchNowPlaying();
          }
        )
        .subscribe((status) => {
          console.log('Subscription status:', status);
          setDebugInfo(prev => ({ 
            ...prev, 
            subscriptionActive: status === 'SUBSCRIBED'
          }));
        });
    } catch (error) {
      console.error('Subscription error:', error);
      setDebugInfo(prev => ({ 
        ...prev, 
        lastError: `Subscription error: ${error}`
      }));
    }

    // Refresh every 10 seconds as backup
    const interval = setInterval(fetchNowPlaying, 10000);

    return () => {
      if (subscriptionChannel) {
        supabase.removeChannel(subscriptionChannel);
      }
      clearInterval(interval);
    };
  }, []);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercent = (): number => {
    if (!currentTrack?.started_at) return 0;
    
    const startTime = new Date(currentTrack.started_at);
    const now = new Date();
    const elapsed = (now.getTime() - startTime.getTime()) / 1000; // seconds
    const duration = 30 * 60; // assume 30 minutes for a side
    
    return Math.min((elapsed / duration) * 100, 100);
  };

  const getElapsedTime = (): string => {
    if (!currentTrack?.started_at) return '0:00';
    
    const startTime = new Date(currentTrack.started_at);
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
    
    return formatDuration(elapsed);
  };

  const testDatabaseConnection = async (): Promise<void> => {
    console.log('Testing database connection...');
    
    try {
      // Test basic connection
      const { data, error } = await supabase
        .from('now_playing')
        .select('*')
        .limit(1);

      if (error) {
        console.error('Database test failed:', error);
        alert(`Database test failed: ${error.message}`);
      } else {
        console.log('Database test successful:', data);
        alert(`Database test successful! Found ${data?.length || 0} rows.`);
      }
    } catch (error) {
      console.error('Database test exception:', error);
      alert(`Database test exception: ${error}`);
    }
  };

  return (
    <div 
      style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #7c3aed 100%)',
        color: 'white',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"Inter", sans-serif',
        overflow: 'hidden'
      }}
    >
      {/* Debug Panel */}
      <div style={{
        background: 'rgba(0,0,0,0.8)',
        padding: '12px 20px',
        fontSize: '12px',
        fontFamily: 'monospace',
        borderBottom: '1px solid rgba(255,255,255,0.2)'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '20px' }}>
          <div>
            <strong>Connection:</strong> {isConnected ? '🟢 Connected' : '🔴 Disconnected'}<br/>
            <strong>DB Rows:</strong> {debugInfo.dbRowCount}<br/>
            <strong>Subscription:</strong> {debugInfo.subscriptionActive ? '🟢 Active' : '🔴 Inactive'}
          </div>
          <div>
            <strong>Last Query:</strong> {debugInfo.lastQuery}<br/>
            <strong>Last Update:</strong> {debugInfo.lastUpdateTime ? new Date(debugInfo.lastUpdateTime).toLocaleTimeString() : 'Never'}
          </div>
          <div>
            <strong>Error:</strong> {debugInfo.lastError || 'None'}<br/>
            <strong>Page Load:</strong> {lastUpdated.toLocaleTimeString()}
          </div>
          <div>
            <button 
              onClick={testDatabaseConnection}
              style={{
                background: '#059669',
                color: 'white',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                cursor: 'pointer'
              }}
            >
              Test DB
            </button>
          </div>
        </div>
      </div>

      {/* Background blur effect */}
      {currentTrack?.collection?.image_url && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `url(${currentTrack.collection.image_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(60px) brightness(0.3)',
          opacity: 0.6,
          zIndex: 0
        }} />
      )}

      {/* Header */}
      <div style={{ 
        background: 'rgba(0,0,0,0.4)', 
        padding: '2rem 3rem',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '60px',
              height: '60px',
              background: 'white',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px'
            }}>
              🎵
            </div>
            <div>
              <h1 style={{ 
                fontSize: '2rem', 
                fontWeight: 'bold', 
                margin: 0,
                letterSpacing: '-0.02em'
              }}>
                Dead Wax Dialogues [DEBUG]
              </h1>
              <p style={{ 
                fontSize: '1.1rem', 
                margin: 0, 
                opacity: 0.8 
              }}>
                Now Playing
              </p>
            </div>
          </div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            opacity: 0.8 
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              background: isConnected ? '#10b981' : '#ef4444',
              borderRadius: '50%',
              animation: isConnected ? 'pulse 2s infinite' : 'none'
            }}></div>
            <span style={{ fontSize: '0.9rem' }}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {!currentTrack || (!currentTrack.artist && !currentTrack.title) ? (
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          textAlign: 'center',
          padding: '3rem',
          position: 'relative',
          zIndex: 1
        }}>
          <div>
            <div style={{ 
              fontSize: '8rem', 
              marginBottom: '2rem',
              opacity: 0.3 
            }}>
              🎵
            </div>
            <h2 style={{ 
              fontSize: '3rem', 
              fontWeight: 'bold', 
              marginBottom: '1rem',
              letterSpacing: '-0.02em'
            }}>
              Waiting for Music...
            </h2>
            <p style={{ 
              fontSize: '1.5rem', 
              opacity: 0.7,
              fontStyle: 'italic'
            }}>
              {debugInfo.lastError ? `Error: ${debugInfo.lastError}` : 'Drop the needle. Let the side play.'}
            </p>
          </div>
        </div>
      ) : (
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center', 
          padding: '3rem',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{ 
            maxWidth: '1200px', 
            margin: '0 auto', 
            display: 'grid', 
            gridTemplateColumns: '1fr 1.2fr', 
            gap: '4rem', 
            alignItems: 'center',
            width: '100%'
          }}>
            {/* Album Art */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Image
                  src={currentTrack.collection?.image_url || '/images/coverplaceholder.png'}
                  alt={currentTrack.collection?.title || currentTrack.title || 'Album cover'}
                  width={400}
                  height={400}
                  style={{
                    borderRadius: '20px',
                    objectFit: 'cover',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                    border: '4px solid rgba(255,255,255,0.1)'
                  }}
                  unoptimized
                />
                
                {/* Format Badge */}
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '-10px',
                  background: '#7c3aed',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}>
                  {currentTrack.collection?.folder || 'Audio'}
                </div>
              </div>
            </div>

            {/* Track Info */}
            <div style={{ paddingLeft: '2rem' }}>
              <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ 
                  fontSize: '3.5rem', 
                  fontWeight: 'bold', 
                  margin: '0 0 1rem 0',
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em'
                }}>
                  {currentTrack.collection?.title || currentTrack.title}
                </h2>
                <p style={{ 
                  fontSize: '2rem', 
                  margin: '0 0 0.5rem 0',
                  opacity: 0.9 
                }}>
                  {currentTrack.collection?.artist || currentTrack.artist}
                </p>
                <p style={{ 
                  fontSize: '1.3rem', 
                  margin: 0,
                  opacity: 0.7 
                }}>
                  {currentTrack.collection?.year || 'Unknown Year'} • {currentTrack.service_used || 'Unknown'}
                </p>
              </div>

              {/* Progress */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  marginBottom: '0.5rem',
                  fontSize: '1.1rem',
                  opacity: 0.8
                }}>
                  <span>{getElapsedTime()}</span>
                  <span>Playing</span>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  background: 'rgba(255,255,255,0.2)',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    background: 'linear-gradient(90deg, #7c3aed, #a855f7)',
                    width: `${getProgressPercent()}%`,
                    transition: 'width 1s ease-out',
                    borderRadius: '4px'
                  }} />
                </div>
              </div>

              {/* Additional Info */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '1rem' 
              }}>
                <div style={{
                  background: 'rgba(0,0,0,0.3)',
                  padding: '1rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  <p style={{ 
                    fontSize: '0.9rem', 
                    margin: '0 0 0.25rem 0',
                    opacity: 0.7,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Service
                  </p>
                  <p style={{ 
                    fontSize: '1.1rem', 
                    margin: 0,
                    fontWeight: 600
                  }}>
                    {currentTrack.service_used || 'Manual'}
                  </p>
                </div>
                
                <div style={{
                  background: 'rgba(0,0,0,0.3)',
                  padding: '1rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  <p style={{ 
                    fontSize: '0.9rem', 
                    margin: '0 0 0.25rem 0',
                    opacity: 0.7,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Confidence
                  </p>
                  <p style={{ 
                    fontSize: '1.1rem', 
                    margin: 0,
                    fontWeight: 600
                  }}>
                    {Math.round((currentTrack.recognition_confidence || 0.9) * 100)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ 
        background: 'rgba(0,0,0,0.4)', 
        padding: '1.5rem 3rem',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          fontSize: '0.9rem',
          opacity: 0.8
        }}>
          <span>deadwaxdialogues.com (DEBUG MODE)</span>
          <div style={{ display: 'flex', gap: '2rem' }}>
            <span>Last DB Check: {lastUpdated.toLocaleTimeString()}</span>
            <span>Rows: {debugInfo.dbRowCount}</span>
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