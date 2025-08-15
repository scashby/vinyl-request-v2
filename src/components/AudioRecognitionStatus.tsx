// src/components/AudioRecognitionStatus.tsx
"use client";

import { useState, useEffect } from 'react';
import { supabase } from 'lib/supabaseClient';
import Image from 'next/image';
import Link from 'next/link';

interface NowPlayingState {
  id: number;
  artist: string;
  title: string;
  album_title?: string;
  started_at: string;
  recognition_confidence: number;
  service_used: string;
  recognition_image_url?: string;
}

interface AudioRecognitionStatusProps {
  compact?: boolean;
}

export default function AudioRecognitionStatus({ compact = false }: AudioRecognitionStatusProps) {
  const [currentTrack, setCurrentTrack] = useState<NowPlayingState | null>(null);
  const [playingTime, setPlayingTime] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadCurrentTrack();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('now_playing_status')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'now_playing' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setCurrentTrack(payload.new as NowPlayingState);
            setHasError(false);
          } else if (payload.eventType === 'DELETE') {
            setCurrentTrack(null);
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Update playing time
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
      const { data, error } = await supabase
        .from('now_playing')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - this is fine
          setCurrentTrack(null);
          setHasError(false);
        } else {
          // Actual error (like table doesn't exist)
          setHasError(true);
          setErrorMessage('Audio recognition database not set up');
          console.error('Error loading current track:', error);
        }
      } else {
        setCurrentTrack(data || null);
        setHasError(false);
      }
    } catch (error) {
      setHasError(true);
      setErrorMessage('Failed to connect to audio recognition system');
      setCurrentTrack(null);
      console.error('Exception loading current track:', error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Show error state
  if (hasError) {
    if (compact) {
      return (
        <div style={{
          background: '#fef2f2',
          color: '#dc2626',
          borderRadius: 8,
          padding: 12,
          fontSize: 12,
          border: '2px solid #fca5a5'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div>⚠️</div>
            <div>{errorMessage}</div>
          </div>
        </div>
      );
    }

    return (
      <div style={{
        background: '#fff',
        border: '1px solid #fca5a5',
        borderRadius: 12,
        padding: 20,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: 16 
        }}>
          <h3 style={{ 
            margin: 0, 
            fontSize: 18, 
            fontWeight: 600,
            color: '#dc2626'
          }}>
            ⚠️ Audio Recognition Error
          </h3>
        </div>

        <div style={{
          background: '#fef2f2',
          color: '#dc2626',
          borderRadius: 12,
          padding: 20,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            {errorMessage}
          </div>
          <div style={{ fontSize: 14, marginBottom: 16 }}>
            The audio recognition database tables need to be created in Supabase
          </div>
          <Link
            href="/admin/audio-recognition"
            style={{
              display: 'inline-block',
              background: '#dc2626',
              color: 'white',
              padding: '8px 16px',
              borderRadius: 6,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 600
            }}
          >
            View Setup Instructions
          </Link>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div style={{
        background: currentTrack ? 'linear-gradient(135deg, #1e293b, #334155)' : '#f3f4f6',
        color: currentTrack ? 'white' : '#374151',
        borderRadius: 8,
        padding: 12,
        fontSize: 12,
        border: `2px solid ${isConnected ? '#22c55e' : '#ef4444'}`,
        position: 'relative'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: isConnected ? '#22c55e' : '#ef4444'
          }}></div>
          {currentTrack ? (
            <>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{currentTrack.title}</div>
                <div style={{ opacity: 0.8 }}>{currentTrack.artist}</div>
              </div>
              <div style={{ fontSize: 10 }}>
                {formatTime(playingTime)}
              </div>
            </>
          ) : (
            <div>No track playing</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      padding: 20,
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: 16 
      }}>
        <h3 style={{ 
          margin: 0, 
          fontSize: 18, 
          fontWeight: 600,
          color: '#1f2937'
        }}>
          🎵 Audio Recognition Status
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: isConnected ? '#22c55e' : '#ef4444'
          }}></div>
          <span style={{ 
            fontSize: 12, 
            color: isConnected ? '#22c55e' : '#ef4444',
            fontWeight: 600
          }}>
            {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>
      </div>

      {currentTrack ? (
        <div style={{
          background: 'linear-gradient(135deg, #1e293b, #334155)',
          color: 'white',
          borderRadius: 12,
          padding: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 16
        }}>
          {currentTrack.recognition_image_url && (
            <Image
              src={currentTrack.recognition_image_url}
              alt="Album artwork"
              width={60}
              height={60}
              style={{ borderRadius: 8, objectFit: 'cover' }}
              unoptimized
            />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
              {currentTrack.title}
            </div>
            <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 4 }}>
              {currentTrack.artist}
            </div>
            {currentTrack.album_title && (
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
                {currentTrack.album_title}
              </div>
            )}
            <div style={{ fontSize: 11, opacity: 0.8 }}>
              Playing for {formatTime(playingTime)} • 
              {Math.round(currentTrack.recognition_confidence * 100)}% confidence • 
              {currentTrack.service_used.toUpperCase()}
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          background: '#f9fafb',
          border: '2px dashed #d1d5db',
          borderRadius: 12,
          padding: 24,
          textAlign: 'center',
          color: '#6b7280'
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎧</div>
          <div>No track currently playing</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            Start audio recognition to see live track info
          </div>
        </div>
      )}

      <div style={{
        marginTop: 16,
        display: 'flex',
        gap: 12,
        justifyContent: 'center'
      }}>
        <Link
          href="/admin/audio-recognition"
          style={{
            background: '#2563eb',
            color: 'white',
            padding: '8px 16px',
            borderRadius: 6,
            textDecoration: 'none',
            fontSize: 12,
            fontWeight: 600
          }}
        >
          Control Panel
        </Link>
        <Link
          href="/admin/audio-recognition/display"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: '#6b7280',
            color: 'white',
            padding: '8px 16px',
            borderRadius: 6,
            textDecoration: 'none',
            fontSize: 12,
            fontWeight: 600
          }}
        >
          📺 TV Display
        </Link>
      </div>
    </div>
  );
}