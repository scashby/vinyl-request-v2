// src/app/admin/audio-recognition/page.tsx - FINAL PRECISE TIMING
"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from 'src/lib/supabaseClient';
import Image from 'next/image';

interface RecognitionResult {
  id?: number;
  artist: string | null;
  title: string | null;
  album?: string | null;
  image_url?: string;
  confidence: number | null;
  service: string | null;
  duration?: number;
  created_at?: string | null;
  source?: string | null;
  confirmed?: boolean | null;
  match_source?: string | null;
  matched_id?: number | null;
}

interface NowPlayingState {
  id?: number;
  artist: string;
  title: string;
  album_title?: string;
  album_id?: number;
  started_at: string;
  recognition_confidence: number;
  service_used: string;
  recognition_image_url?: string;
  next_recognition_in?: number;
  song_duration?: number;
  song_offset?: number;
}

interface ShazamMetadata {
  title?: string;
  text?: string;
}

interface ShazamSection {
  type?: string;
  metadata?: ShazamMetadata[];
}

interface ShazamTrack {
  sections?: ShazamSection[];
}

interface ShazamResult {
  matches?: Array<{ offset?: number }>;
  track?: ShazamTrack;
}

export default function AudioRecognitionPage() {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<NowPlayingState | null>(null);
  const [recognitionHistory, setRecognitionHistory] = useState<RecognitionResult[]>([]);
  const [status, setStatus] = useState('Ready to listen');
  const [nextRecognitionCountdown, setNextRecognitionCountdown] = useState(0);
  const [currentSongPosition, setCurrentSongPosition] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // RAW PCM Conversion Function
  const convertToRawPCM = useCallback(async (webmBlob: Blob): Promise<ArrayBuffer> => {
    console.log('🔄 Converting WebM to RAW PCM format for Shazam...');
    
    interface WindowWithWebkit extends Window {
      webkitAudioContext?: typeof AudioContext;
    }
    const AudioContextClass = window.AudioContext || (window as WindowWithWebkit).webkitAudioContext;
    
    if (!AudioContextClass) {
      throw new Error('AudioContext not supported in this browser');
    }
    
    const audioContext = new AudioContextClass({
      sampleRate: 44100
    });
    
    try {
      const arrayBuffer = await webmBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Convert to mono and limit to 3 seconds to reduce size
      const maxSamples = Math.min(audioBuffer.length, 3 * audioBuffer.sampleRate);
      const channelData = audioBuffer.numberOfChannels > 1 
        ? audioBuffer.getChannelData(0) 
        : audioBuffer.getChannelData(0);
      
      // Convert Float32Array to 16-bit PCM (little endian)
      const pcmData = new Int16Array(maxSamples);
      for (let i = 0; i < maxSamples; i++) {
        const sample = Math.max(-1, Math.min(1, channelData[i]));
        pcmData[i] = Math.round(sample * 32767);
      }
      
      await audioContext.close();
      return pcmData.buffer;
    } catch (error) {
      await audioContext.close();
      throw error;
    }
  }, []);

  // FIXED: Extract ACTUAL song duration from Shazam metadata
  const extractSongDuration = useCallback((shazamResult: ShazamResult): number | null => {
    if (!shazamResult.track?.sections) {
      console.log('❌ No track sections in Shazam response');
      return null;
    }

    for (const section of shazamResult.track.sections) {
      if (section.metadata) {
        for (const meta of section.metadata) {
          // Look for duration in metadata
          if (meta.title?.toLowerCase().includes('duration') || 
              meta.title?.toLowerCase().includes('length')) {
            
            const durationText = meta.text;
            console.log(`🔍 Found duration metadata: ${meta.title} = ${durationText}`);
            
            // Parse "MM:SS" format
            const timeMatch = durationText?.match(/(\d+):(\d+)/);
            if (timeMatch) {
              const minutes = parseInt(timeMatch[1]);
              const seconds = parseInt(timeMatch[2]);
              const totalSeconds = minutes * 60 + seconds;
              console.log(`✅ Extracted song duration: ${totalSeconds}s (${minutes}:${seconds.toString().padStart(2, '0')})`);
              return totalSeconds;
            }
            
            // Parse seconds only
            const secondsMatch = durationText?.match(/^\d+$/);
            if (secondsMatch) {
              const totalSeconds = parseInt(durationText);
              console.log(`✅ Extracted song duration: ${totalSeconds}s`);
              return totalSeconds;
            }
          }
        }
      }
    }
    
    console.log('❌ Could not find song duration in Shazam metadata');
    return null;
  }, []);

  // PRECISE timing calculation using actual Shazam data
  const calculatePreciseTiming = useCallback((shazamResult: ShazamResult, isNewTrack: boolean): number => {
    if (!isNewTrack) {
      return 60; // Same track, wait 1 minute
    }

    const matches = shazamResult.matches || [];
    if (matches.length === 0) {
      console.log('⚠️ No Shazam matches, using 120s fallback');
      return 120;
    }

    const offsetInSong = matches[0].offset || 0;
    const actualSongDuration = extractSongDuration(shazamResult);
    
    if (!actualSongDuration) {
      console.log('⚠️ No song duration found, using estimation');
      return Math.max(60, 240 - offsetInSong - 30); // 4min estimate
    }

    // PRECISE CALCULATION: Song Duration - Current Position - Buffer
    const timeRemaining = actualSongDuration - offsetInSong - 30; // 30s buffer
    const waitTime = Math.max(30, timeRemaining);
    
    console.log(`🎵 PRECISE TIMING:`);
    console.log(`   • Song duration: ${actualSongDuration}s`);
    console.log(`   • Current position: ${offsetInSong}s`);
    console.log(`   • Time remaining: ${timeRemaining}s`);
    console.log(`   • Wait time: ${waitTime}s`);
    
    return Math.round(waitTime);
  }, [extractSongDuration]);

  // Load current track
  const loadCurrentTrack = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('now_playing')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.warn('Database access issue:', error.message);
      } else if (data) {
        setCurrentTrack(data);
        if (data.next_recognition_in) {
          const elapsed = Math.floor((Date.now() - new Date(data.started_at).getTime()) / 1000);
          const remaining = Math.max(0, data.next_recognition_in - elapsed);
          setNextRecognitionCountdown(remaining);
        }
      } else {
        setCurrentTrack(null);
      }
    } catch (error) {
      console.warn('Error loading current track:', error);
    }
  }, []);

  // Load recognition history
  const loadRecentHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('audio_recognition_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.warn('Cannot load history:', error.message);
      } else if (data) {
        setRecognitionHistory(data);
      }
    } catch (error) {
      console.warn('Error loading history:', error);
    }
  }, []);

  // Process audio sample
  const processAudioSample = useCallback(async (audioBlob: Blob) => {
    setStatus('Converting and processing audio with Shazam...');

    try {
      const rawPCMAudio = await convertToRawPCM(audioBlob);
      
      const response = await fetch('/api/audio-recognition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream'
        },
        body: rawPCMAudio
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Recognition failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (result.success && result.track) {
        setStatus(`✅ Recognized: ${result.track.artist} - ${result.track.title}`);
        
        // Add to history immediately
        const newHistoryEntry: RecognitionResult = {
          id: Date.now(),
          artist: result.track.artist,
          title: result.track.title,
          album: result.track.album,
          confidence: result.track.confidence,
          service: result.track.service,
          created_at: new Date().toISOString(),
          source: 'microphone',
          confirmed: true
        };
        
        setRecognitionHistory(prev => [newHistoryEntry, ...prev.slice(0, 9)]);
        
        // Check if new track
        const isNewTrack = !currentTrack || 
          currentTrack.artist?.toLowerCase() !== result.track.artist?.toLowerCase() || 
          currentTrack.title?.toLowerCase() !== result.track.title?.toLowerCase();
        
        // Calculate precise timing
        const nextDelay = calculatePreciseTiming(result.rawResponse || result, isNewTrack);
        setNextRecognitionCountdown(nextDelay);

        // Extract song info for display
        const shazamResult = result.rawResponse || result;
        const offsetInSong = shazamResult.matches?.[0]?.offset || 0;
        const songDuration = extractSongDuration(shazamResult);
        
        if (isNewTrack) {
          console.log(`🆕 NEW TRACK: ${result.track.artist} - ${result.track.title}`);
          
          // Update database with song info
          try {
            await supabase.from('now_playing').delete().neq('id', 0);
            
            const { data: newTrack } = await supabase
              .from('now_playing')
              .insert({
                artist: result.track.artist,
                title: result.track.title,
                album_title: result.track.album || null,
                started_at: new Date().toISOString(),
                recognition_confidence: result.track.confidence || 0.7,
                service_used: result.track.service.toLowerCase(),
                recognition_image_url: result.track.image_url || null,
                next_recognition_in: nextDelay,
                song_duration: songDuration,
                song_offset: offsetInSong,
                created_at: new Date().toISOString()
              })
              .select()
              .single();

            if (newTrack) {
              setCurrentTrack(newTrack);
            }

            await supabase.from('audio_recognition_logs').insert({
              artist: result.track.artist,
              title: result.track.title,
              album: result.track.album || null,
              source: 'microphone',
              service: result.track.service.toLowerCase(),
              confidence: result.track.confidence || 0.7,
              confirmed: true,
              created_at: new Date().toISOString()
            });

          } catch (dbError) {
            console.error('Database update error:', dbError);
          }
        } else {
          console.log(`🔄 SAME TRACK: ${result.track.artist} - ${result.track.title}`);
        }

      } else {
        setStatus(result.error || 'No match found');
        setNextRecognitionCountdown(30);
      }

    } catch (error) {
      console.error('Recognition error:', error);
      setStatus(`Recognition error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setNextRecognitionCountdown(45);
    }
  }, [convertToRawPCM, currentTrack, calculatePreciseTiming, extractSongDuration]);

  const triggerRecognition = useCallback(async () => {
    if (!mediaRecorderRef.current || isProcessing) return;

    setIsProcessing(true);
    setStatus('🎤 Capturing audio for recognition...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      });

      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = '';
      }

      const sampleRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const sampleChunks: Blob[] = [];

      sampleRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          sampleChunks.push(event.data);
        }
      };

      sampleRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        
        if (sampleChunks.length > 0) {
          const audioBlob = new Blob(sampleChunks, { 
            type: sampleChunks[0]?.type || 'audio/webm' 
          });
          await processAudioSample(audioBlob);
        }
        setIsProcessing(false);
      };

      sampleRecorder.start();
      
      setTimeout(() => {
        if (sampleRecorder.state === 'recording') {
          sampleRecorder.stop();
        }
      }, 5000);

    } catch (error) {
      console.error('Error during recognition:', error);
      setStatus(`Recognition failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsProcessing(false);
    }
  }, [isProcessing, processAudioSample]);

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      });

      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = '';
      }

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsListening(true);
      setStatus('🎧 Listening for audio...');

      setTimeout(() => {
        triggerRecognition();
      }, 2000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      setStatus('Error: Could not access microphone');
    }
  }, [triggerRecognition]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    
    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
    }

    setIsListening(false);
    setIsProcessing(false);
    setStatus('Stopped listening');
    setNextRecognitionCountdown(0);
    setCurrentSongPosition(0);
  }, []);

  const clearCurrentTrack = useCallback(async () => {
    try {
      await supabase.from('now_playing').delete().neq('id', 0);
      setCurrentTrack(null);
      setCurrentSongPosition(0);
      setStatus('Cleared current track');
    } catch (error) {
      console.error('Error clearing track:', error);
    }
  }, []);

  const formatTime = useCallback((seconds: number) => {
    const validSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
    const mins = Math.floor(validSeconds / 60);
    const secs = validSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Update current song position every second
  useEffect(() => {
    if (currentTrack && currentTrack.started_at && currentTrack.song_offset !== undefined) {
      const interval = setInterval(() => {
        const elapsedSinceRecognition = Math.floor((Date.now() - new Date(currentTrack.started_at).getTime()) / 1000);
        const currentPosition = (currentTrack.song_offset || 0) + elapsedSinceRecognition;
        setCurrentSongPosition(currentPosition);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [currentTrack]);

  // Load current state on mount
  useEffect(() => {
    loadCurrentTrack();
    loadRecentHistory();
  }, [loadCurrentTrack, loadRecentHistory]);

  // Countdown timer
  useEffect(() => {
    if (nextRecognitionCountdown > 0 && isListening) {
      countdownIntervalRef.current = setInterval(() => {
        setNextRecognitionCountdown(prev => {
          if (prev <= 1) {
            if (!isProcessing) {
              triggerRecognition();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [nextRecognitionCountdown, isListening, triggerRecognition, isProcessing]);

  return (
    <div style={{ 
      padding: 24, 
      background: '#fff', 
      color: '#222', 
      minHeight: '100vh',
      maxWidth: 1200,
      margin: '0 auto'
    }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 8 }}>
          Audio Recognition Control
        </h1>
        <p style={{ color: '#666', fontSize: 16 }}>
          Listen for vinyl and cassette audio, identify tracks with Shazam (PRECISE timing using actual song duration)
        </p>
      </div>

      {/* Control Panel */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: 24,
        marginBottom: 32
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={isProcessing}
            style={{
              background: isListening ? '#dc2626' : '#16a34a',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '12px 24px',
              fontSize: 16,
              fontWeight: 600,
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              opacity: isProcessing ? 0.6 : 1
            }}
          >
            {isListening ? '🛑 Stop Listening' : '🎧 Start Listening'}
          </button>

          {currentTrack && (
            <button
              onClick={clearCurrentTrack}
              style={{
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 14,
                cursor: 'pointer'
              }}
            >
              Clear Current Track
            </button>
          )}

          <a
            href="/tv-display"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#2563eb',
              color: 'white',
              padding: '8px 16px',
              borderRadius: 8,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 600
            }}
          >
            📺 Open TV Display
          </a>
        </div>

        <div style={{ 
          fontSize: 14, 
          color: isProcessing ? '#ea580c' : '#16a34a',
          marginBottom: 12 
        }}>
          Status: {status}
        </div>

        {nextRecognitionCountdown > 0 && isListening && (
          <div style={{ fontSize: 14, color: '#2563eb', marginBottom: 8 }}>
            Next recognition in: {formatTime(nextRecognitionCountdown)}
          </div>
        )}

        {/* ADDED: Current song position countdown */}
        {currentTrack && currentTrack.song_duration && (
          <div style={{ 
            fontSize: 14, 
            color: '#7c3aed',
            background: '#f3f4f6',
            padding: '8px 12px',
            borderRadius: 6,
            marginBottom: 8
          }}>
            Song position: {formatTime(currentSongPosition)} / {formatTime(currentTrack.song_duration)}
            {currentTrack.song_duration - currentSongPosition > 0 && (
              <span style={{ marginLeft: 8, color: '#059669' }}>
                ({formatTime(currentTrack.song_duration - currentSongPosition)} remaining)
              </span>
            )}
          </div>
        )}

        <div style={{
          marginTop: 12,
          padding: 12,
          background: '#f0fdf4',
          border: '1px solid #22c55e',
          borderRadius: 8,
          fontSize: 12,
          color: '#15803d'
        }}>
          ✅ <strong>PRECISE TIMING:</strong> Now uses actual song duration from Shazam metadata. Formula: Song Duration - (Current Position + 30s buffer) = Next Sample Time
        </div>
      </div>

      {/* Current Track Display */}
      {currentTrack && (
        <div style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          color: 'white',
          borderRadius: 16,
          padding: 32,
          marginBottom: 32,
          display: 'flex',
          alignItems: 'center',
          gap: 24
        }}>
          {currentTrack.recognition_image_url && (
            <Image
              src={currentTrack.recognition_image_url}
              alt="Album artwork"
              width={120}
              height={120}
              style={{ borderRadius: 12, objectFit: 'cover' }}
              unoptimized
            />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>
              {currentTrack.title}
            </div>
            <div style={{ fontSize: 18, opacity: 0.9, marginBottom: 4 }}>
              {currentTrack.artist}
            </div>
            {currentTrack.album_title && (
              <div style={{ fontSize: 16, opacity: 0.7, marginBottom: 8 }}>
                {currentTrack.album_title}
              </div>
            )}
            <div style={{ fontSize: 14, opacity: 0.8 }}>
              Confidence: {Math.round(currentTrack.recognition_confidence * 100)}% • 
              Source: {currentTrack.service_used} • 
              Started: {new Date(currentTrack.started_at).toLocaleTimeString()}
              {currentTrack.song_duration && (
                <>
                  <br />
                  Song: {formatTime(currentTrack.song_duration)} • 
                  Offset: {formatTime(currentTrack.song_offset || 0)}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recognition History */}
      <div style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        overflow: 'hidden'
      }}>
        <div style={{
          background: '#f9fafb',
          padding: '16px 24px',
          borderBottom: '1px solid #e5e7eb',
          fontWeight: 600,
          fontSize: 16
        }}>
          Recent Recognition History
        </div>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {recognitionHistory.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
              No recognition history yet. Check database permissions.
            </div>
          ) : (
            recognitionHistory.map((track, index) => (
              <div 
                key={track.id || index}
                style={{
                  padding: '16px 24px',
                  borderBottom: index < recognitionHistory.length - 1 ? '1px solid #f3f4f6' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    {track.artist || 'Unknown Artist'} - {track.title || 'Unknown Title'}
                  </div>
                  {track.album && (
                    <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>
                      {track.album}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>
                    {Math.round((track.confidence || 0) * 100)}% confidence • {track.service || 'unknown'}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>
                  {track.created_at ? new Date(track.created_at).toLocaleString() : 'Unknown time'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}