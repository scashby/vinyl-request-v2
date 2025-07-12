// src/components/RecognitionDebugPanel.tsx - Debug and monitoring panel
"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from 'lib/supabaseClient';

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
  collection?: {
    id: number;
    artist: string;
    title: string;
    year: string;
    image_url?: string;
    folder?: string;
  };
}

interface AlbumContextData {
  id: number;
  artist: string;
  title: string;
  year: string;
  image_url?: string;
  folder?: string;
  collection_id?: number;
  track_count?: number;
  track_listing?: string[];
  source?: string;
  created_at: string;
  updated_at: string;
}

interface SystemStatus {
  database: boolean;
  recognitionAPI: boolean;
  manualAPI: boolean;
  services: string[];
}

interface TestResult {
  status: string;
  data?: unknown;
  error?: string;
  timestamp: string;
}

interface DebugData {
  nowPlaying: NowPlayingData | null;
  albumContext: AlbumContextData | null;
  recentRecognitions: NowPlayingData[];
  systemStatus: SystemStatus;
}

export default function RecognitionDebugPanel() {
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [testResults, setTestResults] = useState<Record<string, TestResult | string>>({});

  const loadDebugData = useCallback(async (): Promise<void> => {
    try {
      // Load now playing
      const { data: nowPlaying } = await supabase
        .from('now_playing')
        .select(`
          *,
          collection (
            id, artist, title, year, image_url, folder
          )
        `)
        .eq('id', 1)
        .single();

      // Load album context
      const { data: albumContext } = await supabase
        .from('album_context')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Load recent recognitions (if you have a recognition history table)
      // For now, we'll just use the current data
      const recentRecognitions = nowPlaying ? [nowPlaying] : [];

      // Test system status
      const systemStatus = await checkSystemStatus();

      setDebugData({
        nowPlaying,
        albumContext,
        recentRecognitions,
        systemStatus
      });

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading debug data:', error);
    }
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(loadDebugData, 5000);
      loadDebugData(); // Initial load
      
      return () => clearInterval(interval);
    }
  }, [autoRefresh, loadDebugData]);

  const checkSystemStatus = async (): Promise<SystemStatus> => {
    const status: SystemStatus = {
      database: false,
      recognitionAPI: false,
      manualAPI: false,
      services: []
    };

    try {
      // Test database connection
      const { error: dbError } = await supabase.from('now_playing').select('id').limit(1);
      status.database = !dbError;

      // Test recognition API
      try {
        const recognitionResponse = await fetch('/api/audio-recognition');
        status.recognitionAPI = recognitionResponse.ok;
        if (recognitionResponse.ok) {
          const recognitionData = await recognitionResponse.json();
          status.services = recognitionData.enabledServices || [];
        }
      } catch {
        status.recognitionAPI = false;
      }

      // Test manual API
      try {
        const manualResponse = await fetch('/api/manual-recognition');
        status.manualAPI = manualResponse.ok;
      } catch {
        status.manualAPI = false;
      }
    } catch (error) {
      console.error('Error checking system status:', error);
    }

    return status;
  };

  const testRecognitionAPI = async (): Promise<void> => {
    setTestResults({ ...testResults, recognition: 'testing...' });
    
    try {
      const response = await fetch('/api/audio-recognition');
      const data = await response.json();
      
      setTestResults({
        ...testResults,
        recognition: {
          status: response.ok ? 'OK' : 'Error',
          data: data,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      setTestResults({
        ...testResults,
        recognition: {
          status: 'Error',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  const testManualAPI = async (): Promise<void> => {
    setTestResults({ ...testResults, manual: 'testing...' });
    
    try {
      const response = await fetch('/api/manual-recognition');
      const data = await response.json();
      
      setTestResults({
        ...testResults,
        manual: {
          status: response.ok ? 'OK' : 'Error',
          data: data,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      setTestResults({
        ...testResults,
        manual: {
          status: 'Error',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  const clearAlbumContext = async (): Promise<void> => {
    try {
      await supabase.from('album_context').delete().neq('id', 0);
      await loadDebugData();
    } catch (error) {
      console.error('Error clearing album context:', error);
    }
  };

  const clearNowPlaying = async (): Promise<void> => {
    try {
      await supabase
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
      
      await loadDebugData();
    } catch (error) {
      console.error('Error clearing now playing:', error);
    }
  };

  if (!isExpanded) {
    return (
      <div style={{
        position: 'fixed',
        bottom: 20,
        left: 20,
        zIndex: 1000
      }}>
        <button
          onClick={() => {
            setIsExpanded(true);
            loadDebugData();
          }}
          style={{
            background: '#1f2937',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '12px 16px',
            fontSize: 14,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          🔧 Debug Panel
          {debugData?.systemStatus && (
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: debugData.systemStatus.database ? '#10b981' : '#ef4444'
            }} />
          )}
        </button>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: 20,
      right: 20,
      maxHeight: '70vh',
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      zIndex: 1000,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        background: '#1f2937',
        color: 'white',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Recognition System Debug</h3>
          <div style={{
            fontSize: 12,
            opacity: 0.8
          }}>
            Last update: {lastUpdate.toLocaleTimeString()}
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 6,
            fontSize: 12,
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          
          <button
            onClick={loadDebugData}
            style={{
              background: '#374151',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            Refresh
          </button>
          
          <button
            onClick={() => setIsExpanded(false)}
            style={{
              background: 'none',
              color: 'white',
              border: 'none',
              fontSize: 18,
              cursor: 'pointer',
              padding: 4
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{
        padding: 20,
        overflowY: 'auto',
        flex: 1
      }}>
        {debugData && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 20
          }}>
            {/* System Status */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: 16
            }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>
                System Status
              </h4>
              <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: debugData.systemStatus.database ? '#10b981' : '#ef4444'
                  }} />
                  Database: {debugData.systemStatus.database ? 'Connected' : 'Error'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: debugData.systemStatus.recognitionAPI ? '#10b981' : '#ef4444'
                  }} />
                  Recognition API: {debugData.systemStatus.recognitionAPI ? 'OK' : 'Error'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: debugData.systemStatus.manualAPI ? '#10b981' : '#ef4444'
                  }} />
                  Manual API: {debugData.systemStatus.manualAPI ? 'OK' : 'Error'}
                </div>
                <div style={{ marginTop: 8 }}>
                  <strong>Enabled Services:</strong><br/>
                  {debugData.systemStatus.services.length > 0 ? 
                    debugData.systemStatus.services.join(', ') : 
                    'None configured'}
                </div>
              </div>
              
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button
                  onClick={testRecognitionAPI}
                  style={{
                    background: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 8px',
                    fontSize: 11,
                    cursor: 'pointer'
                  }}
                >
                  Test Recognition
                </button>
                <button
                  onClick={testManualAPI}
                  style={{
                    background: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 8px',
                    fontSize: 11,
                    cursor: 'pointer'
                  }}
                >
                  Test Manual
                </button>
              </div>
            </div>

            {/* Now Playing */}
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #16a34a',
              borderRadius: 8,
              padding: 16
            }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>
                Current Now Playing
              </h4>
              {debugData.nowPlaying ? (
                <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                  <div><strong>Artist:</strong> {debugData.nowPlaying.artist || 'None'}</div>
                  <div><strong>Title:</strong> {debugData.nowPlaying.title || 'None'}</div>
                  <div><strong>Album:</strong> {debugData.nowPlaying.album_title || 'None'}</div>
                  <div><strong>Started:</strong> {debugData.nowPlaying.started_at ? 
                    new Date(debugData.nowPlaying.started_at).toLocaleString() : 'None'}</div>
                  <div><strong>Service:</strong> {debugData.nowPlaying.service_used || 'None'}</div>
                  <div><strong>Confidence:</strong> {debugData.nowPlaying.recognition_confidence ? 
                    Math.round(debugData.nowPlaying.recognition_confidence * 100) + '%' : 'None'}</div>
                  <div><strong>Album ID:</strong> {debugData.nowPlaying.album_id || 'None'}</div>
                  <div><strong>Collection:</strong> {debugData.nowPlaying.collection ? 
                    `${debugData.nowPlaying.collection.artist} - ${debugData.nowPlaying.collection.title}` : 'None'}</div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#666' }}>No current track</div>
              )}
              
              <button
                onClick={clearNowPlaying}
                style={{
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 8px',
                  fontSize: 11,
                  cursor: 'pointer',
                  marginTop: 8
                }}
              >
                Clear Now Playing
              </button>
            </div>

            {/* Album Context */}
            <div style={{
              background: '#fffbeb',
              border: '1px solid #f59e0b',
              borderRadius: 8,
              padding: 16
            }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>
                Album Context
              </h4>
              {debugData.albumContext ? (
                <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                  <div><strong>Artist:</strong> {debugData.albumContext.artist}</div>
                  <div><strong>Album:</strong> {debugData.albumContext.title}</div>
                  <div><strong>Track Count:</strong> {debugData.albumContext.track_count || 'Unknown'}</div>
                  <div><strong>Source:</strong> {debugData.albumContext.source || 'Unknown'}</div>
                  <div><strong>Created:</strong> {new Date(debugData.albumContext.created_at).toLocaleString()}</div>
                  <div><strong>Collection ID:</strong> {debugData.albumContext.collection_id || 'None'}</div>
                  {debugData.albumContext.track_listing && (
                    <div style={{ marginTop: 8 }}>
                      <strong>Tracks:</strong>
                      <div style={{ 
                        maxHeight: 60,
                        overflowY: 'auto',
                        marginTop: 4,
                        fontSize: 11,
                        background: 'rgba(245, 158, 11, 0.1)',
                        padding: 4,
                        borderRadius: 4
                      }}>
                        {debugData.albumContext.track_listing.map((track: string, index: number) => (
                          <div key={index}>{index + 1}. {track}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#666' }}>No album context set</div>
              )}
              
              {debugData.albumContext && (
                <button
                  onClick={clearAlbumContext}
                  style={{
                    background: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 8px',
                    fontSize: 11,
                    cursor: 'pointer',
                    marginTop: 8
                  }}
                >
                  Clear Context
                </button>
              )}
            </div>

            {/* Test Results */}
            {Object.keys(testResults).length > 0 && (
              <div style={{
                background: '#f1f5f9',
                border: '1px solid #64748b',
                borderRadius: 8,
                padding: 16,
                gridColumn: '1 / -1'
              }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>
                  Test Results
                </h4>
                <div style={{ fontSize: 11, fontFamily: 'monospace' }}>
                  <pre style={{ 
                    margin: 0, 
                    maxHeight: 200, 
                    overflowY: 'auto',
                    background: '#fff',
                    padding: 8,
                    borderRadius: 4
                  }}>
                    {JSON.stringify(testResults, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}