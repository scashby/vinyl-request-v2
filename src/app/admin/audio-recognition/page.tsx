// src/app/admin/audio-recognition/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from 'types/supabase';
import Link from 'next/link';

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
}

export default function AudioRecognitionPage() {
  const [logs, setLogs] = useState<RecognitionLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [status, setStatus] = useState('');

  const supabase = createClientComponentClient<Database>();

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('audio_recognition_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (!error && data) setLogs(data);
      setLoading(false);
    };
    fetchLogs();
  }, [supabase]);

  const confirmTrack = async (logId: number, artist: string, title: string, album: string) => {
    try {
      await supabase.from('now_playing').delete().neq('id', 0);
      await supabase.from('now_playing').insert({ 
        artist, 
        title, 
        album_title: album,
        started_at: new Date().toISOString(),
        service_used: 'confirmed_recognition'
      });
      await supabase.from('audio_recognition_logs').update({ confirmed: true }).eq('id', logId);
      
      // Update local state
      setLogs(prev => prev.map(log => 
        log.id === logId ? { ...log, confirmed: true } : log
      ));
      
      setStatus('✅ Track confirmed and set as now playing!');
      setTimeout(() => setStatus(''), 3000);
    } catch (error) {
      setStatus(`❌ Error confirming track: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const skipTrack = async (logId: number) => {
    try {
      await supabase.from('audio_recognition_logs').update({ confidence: 0 }).eq('id', logId);
      
      // Remove from local state
      setLogs(prev => prev.filter(log => log.id !== logId));
      setStatus('🗑 Track skipped');
      setTimeout(() => setStatus(''), 2000);
    } catch (error) {
      setStatus(`❌ Error skipping track: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const triggerManualRecognition = async () => {
    setIsRecognizing(true);
    setStatus('🎵 Starting audio recognition...');
    
    try {
      const response = await fetch('/api/audio-recognition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggeredBy: 'manual', timestamp: new Date().toISOString() })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setStatus('✅ Recognition completed successfully!');
        // Refresh logs to show new recognition
        const { data } = await supabase
          .from('audio_recognition_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);
        if (data) setLogs(data);
      } else {
        setStatus(`❌ Recognition failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      setStatus(`❌ Recognition error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    setIsRecognizing(false);
    setTimeout(() => setStatus(''), 5000);
  };

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
            Monitor and manage audio recognition logs
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
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
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#1f2937' }}>{logs.length}</p>
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
            {logs.filter(log => log.confirmed).length}
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
            {logs.filter(log => !log.confirmed).length}
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
            {logs.length > 0 ? Math.round((logs.filter(l => l.confidence && l.confidence > 0.8).length / logs.length) * 100) : 0}%
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
          borderBottom: '1px solid #e5e7eb'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>Recognition Logs</h2>
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
                      color: '#6b7280'
                    }}>
                      <span>Source: {log.source || log.service || 'Unknown'}</span>
                      <span>Confidence: {log.confidence ? Math.round(log.confidence * 100) : 0}%</span>
                      <span>Time: {log.created_at ? new Date(log.created_at).toLocaleString() : 'Unknown'}</span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
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
                        fontWeight: '600'
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
    </div>
  );
}