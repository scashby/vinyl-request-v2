// src/app/admin/audio-recognition/page.tsx - Fixed TypeScript implementation
'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from 'types/supabase';
import Link from 'next/link';
import AudioTestInterface from 'components/AudioTestInterface';
import ManualNowPlayingOverride from 'components/ManualNowPlayingOverride';
import RecognitionDebugPanel from 'components/RecognitionDebugPanel';

// Fixed interfaces with proper typing
interface RecognitionLog {
  id: number;
  artist: string | null;
  title: string | null;
  album: string | null;
  source: string | null;
  service: string | null;
  confidence: number | null;
  confirmed: boolean | null;
  created_at: string | null;
  match_source?: string | null;
  matched_id?: number | null;
  now_playing?: boolean | null;
}

interface SystemStats {
  totalRecognitions: number;
  confirmedCount: number;
  pendingCount: number;
  successRate: number;
  lastRecognition?: string;
}

export default function AudioRecognitionPage() {
  const [logs, setLogs] = useState<RecognitionLog[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isRecognizing, setIsRecognizing] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('');
  const [systemStats, setSystemStats] = useState<SystemStats>({
    totalRecognitions: 0,
    confirmedCount: 0,
    pendingCount: 0,
    successRate: 0
  });
  const [showTestInterface, setShowTestInterface] = useState<boolean>(true);
  const [showDebugPanel, setShowDebugPanel] = useState<boolean>(false);

  const supabase = createClientComponentClient<Database>();

  const fetchLogs = async (): Promise<void> => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audio_recognition_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        // Fixed type conversion with proper validation
        const typedLogs: RecognitionLog[] = data.map(item => ({
          id: item.id,
          artist: item.artist,
          title: item.title,
          album: item.album,
          source: item.source,
          service: item.service,
          confidence: item.confidence,
          confirmed: item.confirmed,
          created_at: item.created_at,
          match_source: item.match_source,
          matched_id: item.matched_id,
          now_playing: item.now_playing
        }));

        setLogs(typedLogs);
        calculateStats(typedLogs);
      } else {
        console.error('Error fetching logs:', error);
        setStatus('❌ Error loading recognition logs');
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      setStatus('❌ Error loading recognition logs');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (logData: RecognitionLog[]): void => {
    const totalRecognitions = logData.length;
    const confirmedCount = logData.filter(log => log.confirmed === true).length;
    const pendingCount = logData.filter(log => log.confirmed === false || log.confirmed === null).length;
    const highConfidenceCount = logData.filter(log => log.confidence && log.confidence > 0.8).length;
    const successRate = totalRecognitions > 0 ? Math.round((highConfidenceCount / totalRecognitions) * 100) : 0;
    const lastRecognition = logData.length > 0 && logData[0].created_at 
      ? new Date(logData[0].created_at).toLocaleString() 
      : undefined;

    setSystemStats({
      totalRecognitions,
      confirmedCount,
      pendingCount,
      successRate,
      lastRecognition
    });
  };

  const confirmTrack = async (logId: number, artist: string, title: string, album: string): Promise<void> => {
    try {
      // Clear existing now playing
      await supabase.from('now_playing').delete().neq('id', 0);
      
      // Set new now playing
      const { error: nowPlayingError } = await supabase.from('now_playing').insert({ 
        artist, 
        title, 
        album_title: album,
        started_at: new Date().toISOString(),
        service_used: 'confirmed_recognition',
        updated_at: new Date().toISOString()
      });

      if (nowPlayingError) {
        throw nowPlayingError;
      }

      // Mark as confirmed
      const { error: confirmError } = await supabase
        .from('audio_recognition_logs')
        .update({ confirmed: true, now_playing: true })
        .eq('id', logId);

      if (confirmError) {
        throw confirmError;
      }
      
      // Update local state
      setLogs(prev => prev.map(log => 
        log.id === logId ? { ...log, confirmed: true, now_playing: true } : log
      ));
      
      setStatus('✅ Track confirmed and set as now playing!');
      setTimeout(() => setStatus(''), 3000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`❌ Error confirming track: ${errorMessage}`);
      console.error('Error confirming track:', error);
    }
  };

  const skipTrack = async (logId: number): Promise<void> => {
    try {
      const { error } = await supabase
        .from('audio_recognition_logs')
        .update({ confidence: 0 })
        .eq('id', logId);

      if (error) {
        throw error;
      }
      
      // Remove from local state
      setLogs(prev => prev.filter(log => log.id !== logId));
      setStatus('🗑 Track skipped');
      setTimeout(() => setStatus(''), 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`❌ Error skipping track: ${errorMessage}`);
      console.error('Error skipping track:', error);
    }
  };

  const triggerManualRecognition = async (): Promise<void> => {
    setIsRecognizing(true);
    setStatus('🎵 Starting audio recognition...');
    
    try {
      const response = await fetch('/api/audio-recognition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          triggeredBy: 'manual_admin', 
          timestamp: new Date().toISOString() 
        })
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        setStatus('✅ Recognition completed successfully!');
        // Refresh logs to show new recognition
        await fetchLogs();
      } else {
        setStatus(`❌ Recognition failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`❌ Recognition error: ${errorMessage}`);
      console.error('Recognition error:', error);
    } finally {
      setIsRecognizing(false);
      setTimeout(() => setStatus(''), 5000);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Auto-refresh logs every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2rem',
        paddingBottom: '1rem',
        borderBottom: '2px solid #e5e7eb'
      }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>
            Audio Recognition System
          </h1>
          <p style={{ color: '#6b7280', margin: 0 }}>
            Monitor and manage audio recognition with live capture testing
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => setShowTestInterface(!showTestInterface)}
            style={{
              padding: '8px 16px',
              backgroundColor: showTestInterface ? '#059669' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            {showTestInterface ? '🧪 Hide Test Interface' : '🧪 Show Test Interface'}
          </button>
          
          <button
            onClick={() => setShowDebugPanel(!showDebugPanel)}
            style={{
              padding: '8px 16px',
              backgroundColor: showDebugPanel ? '#7c2d12' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            {showDebugPanel ? '🔧 Hide Debug' : '🔧 Show Debug'}
          </button>

          <button
            onClick={triggerManualRecognition}
            disabled={isRecognizing}
            style={{
              padding: '12px 24px',
              backgroundColor: isRecognizing ? '#9ca3af' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: isRecognizing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isRecognizing ? '🔄 Recognizing...' : '🎵 Manual Recognition'}
          </button>
          
          <Link 
            href="/admin/admin-dashboard"
            style={{
              padding: '12px 24px',
              backgroundColor: '#6b7280',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            ← Back to Admin
          </Link>
        </div>
      </div>

      {/* Status Message */}
      {status && (
        <div style={{
          padding: '16px',
          marginBottom: '2rem',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '500',
          backgroundColor: status.includes('❌') ? '#fef2f2' : '#f0fdf4',
          color: status.includes('❌') ? '#dc2626' : '#16a34a',
          border: `1px solid ${status.includes('❌') ? '#fca5a5' : '#bbf7d0'}`
        }}>
          {status}
        </div>
      )}

      {/* Test Interface */}
      {showTestInterface && <AudioTestInterface />}

      {/* Quick Navigation */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '2rem',
        padding: '1rem',
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0'
      }}>
        <Link href="/admin/audio-recognition/collection" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '14px' }}>
          💿 Collection Match
        </Link>
        <Link href="/admin/audio-recognition/override" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '14px' }}>
          ✏️ Manual Override
        </Link>
        <Link href="/admin/audio-recognition/settings" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '14px' }}>
          ⚙️ Settings
        </Link>
        <Link href="/admin/audio-recognition/service-test" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '14px' }}>
          🔧 Service Test
        </Link>
        <Link href="/now-playing-tv" target="_blank" style={{ color: '#7c3aed', textDecoration: 'none', fontSize: '14px' }}>
          🖥️ TV Display
        </Link>
      </div>

      {/* Recognition Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          padding: '1.5rem',
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '14px', color: '#6b7280' }}>Total Recognitions</h3>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#1f2937' }}>{systemStats.totalRecognitions}</p>
        </div>
        <div style={{
          padding: '1.5rem',
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '14px', color: '#6b7280' }}>Confirmed</h3>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#059669' }}>
            {systemStats.confirmedCount}
          </p>
        </div>
        <div style={{
          padding: '1.5rem',
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '14px', color: '#6b7280' }}>Pending Review</h3>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#dc2626' }}>
            {systemStats.pendingCount}
          </p>
        </div>
        <div style={{
          padding: '1.5rem',
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '14px', color: '#6b7280' }}>Success Rate</h3>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#2563eb' }}>
            {systemStats.successRate}%
          </p>
        </div>
      </div>

      {/* Recognition Logs */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>Recognition Logs</h2>
          <button
            onClick={fetchLogs}
            disabled={loading}
            style={{
              background: '#374151',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 12px',
              fontSize: '12px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? '🔄 Loading...' : '🔄 Refresh'}
          </button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {loading && <p style={{ textAlign: 'center', color: '#6b7280' }}>Loading...</p>}
          
          {!loading && logs.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
              <p style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>No recognition logs found.</p>
              <button
                onClick={triggerManualRecognition}
                disabled={isRecognizing}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Start First Recognition
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {logs.map((log) => (
              <div key={log.id} style={{
                padding: '1.5rem',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                backgroundColor: '#f8fafc'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      marginBottom: '0.5rem'
                    }}>
                      <h3 style={{
                        margin: 0,
                        fontSize: '1.125rem',
                        fontWeight: 'bold'
                      }}>
                        {log.artist || 'Unknown Artist'} – {log.title || 'Unknown Title'}
                      </h3>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        backgroundColor: log.confirmed ? '#dcfce7' : '#fef3c7',
                        color: log.confirmed ? '#166534' : '#92400e'
                      }}>
                        {log.confirmed ? 'Confirmed' : 'Pending'}
                      </span>
                      {log.now_playing && (
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor: '#dbeafe',
                          color: '#1e40af'
                        }}>
                          Now Playing
                        </span>
                      )}
                    </div>
                    
                    <p style={{
                      margin: '0 0 0.5rem 0',
                      color: '#6b7280'
                    }}>
                      <strong>Album:</strong> {log.album || 'Unknown Album'}
                    </p>
                    
                    <div style={{
                      display: 'flex',
                      gap: '1rem',
                      fontSize: '14px',
                      color: '#6b7280',
                      flexWrap: 'wrap'
                    }}>
                      <span>Source: {log.source || log.service || 'Unknown'}</span>
                      <span>Confidence: {log.confidence ? Math.round(log.confidence * 100) : 0}%</span>
                      <span>Time: {log.created_at ? new Date(log.created_at).toLocaleString() : 'Unknown'}</span>
                      {log.match_source && <span>Match: {log.match_source}</span>}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem', flexWrap: 'wrap' }}>
                    {!log.confirmed && (
                      <>
                        <button
                          onClick={() => confirmTrack(log.id, log.artist || '', log.title || '', log.album || '')}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#059669',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          ✅ Confirm
                        </button>
                        <button
                          onClick={() => skipTrack(log.id)}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#dc2626',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          🗑 Skip
                        </button>
                      </>
                    )}
                    <Link
                      href={`/admin/audio-recognition/override?id=${log.id}`}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#6b7280',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        display: 'inline-block'
                      }}
                    >
                      🔧 Edit
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Manual Override Component */}
      <ManualNowPlayingOverride />

      {/* Debug Panel */}
      {showDebugPanel && <RecognitionDebugPanel />}
    </div>
  );
}