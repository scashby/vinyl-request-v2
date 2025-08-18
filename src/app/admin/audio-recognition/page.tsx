// src/app/admin/audio-recognition/page.tsx - COMPLETE WITH FIXED TIMING
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
}

interface ShazamTrackSection {
  type?: string;
  metadata?: Array<{
    title?: string;
    text?: string;
  }>;
}

interface ShazamResult {
  matches?: Array<{ offset?: number }>;
  track?: {
    sections?: ShazamTrackSection[];
  };
}

export default function AudioRecognitionPage() {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<NowPlayingState | null>(null);
  const [recognitionHistory, setRecognitionHistory] = useState<RecognitionResult[]>([]);
  const [status, setStatus] = useState('Ready to listen');
  const [nextRecognitionCountdown, setNextRecognitionCountdown] = useState(0);
  
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
      console.log(`📁 WebM file size: ${arrayBuffer.byteLength} bytes`);
      
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      console.log(`🎵 Decoded audio: ${audioBuffer.numberOfChannels} channels, ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.sampleRate}Hz`);
      
      // Convert to mono and limit to 3 seconds to reduce size
      const maxSamples = Math.min(audioBuffer.length, 3 * audioBuffer.sampleRate);
      const channelData = audioBuffer.numberOfChannels > 1 
        ? audioBuffer.getChannelData(0) // Use left channel for mono
        : audioBuffer.getChannelData(0);
      
      console.log(`🔧 Trimming to 3 seconds max: ${maxSamples} samples`);
      
      // Convert Float32Array to 16-bit PCM (little endian) - limited samples
      const pcmData = new Int16Array(maxSamples);
      for (let i = 0; i < maxSamples; i++) {
        // Convert from -1.0 to 1.0 range to -32768 to 32767 range
        const sample = Math.max(-1, Math.min(1, channelData[i]));
        pcmData[i] = Math.round(sample * 32767);
      }
      
      console.log(`✅ Converted to RAW PCM: ${pcmData.buffer.byteLength} bytes (${pcmData.length} samples)`);
      
      await audioContext.close();
      return pcmData.buffer;
    } catch (error) {
      await audioContext.close();
      console.error(`❌ Audio conversion failed:`, error);
      throw error;
    }
  }, []);

  // FIXED: Better error handling for RLS issues
  const loadCurrentTrack = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('now_playing')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows - this is fine
          setCurrentTrack(null);
        } else {
          console.warn('Database access issue:', error.message);
          // Don't crash, just log it
        }
      } else if (data) {
        setCurrentTrack(data);
        // Calculate remaining time for next recognition
        if (data.next_recognition_in) {
          const elapsed = Math.floor((Date.now() - new Date(data.started_at).getTime()) / 1000);
          const remaining = Math.max(0, data.next_recognition_in - elapsed);
          setNextRecognitionCountdown(remaining);
        }
      }
    } catch (error) {
      console.warn('Error loading current track:', error);
    }
  }, []);

  // FIXED: Better error handling for RLS issues
  const loadRecentHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('audio_recognition_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.warn('Cannot load history:', error.message);
        // Set some placeholder data so UI doesn't break
        setRecognitionHistory([
          {
            artist: 'Recent recognition',
            title: 'Check browser console for details',
            confidence: 0,
            service: 'Note: Database permission issue',
            created_at: new Date().toISOString()
          }
        ]);
      } else if (data) {
        setRecognitionHistory(data);
      }
    } catch (error) {
      console.warn('Error loading history:', error);
    }
  }, []);

  // FIXED: Extract song length from Shazam metadata, then simple math
  const calculateIntelligentDelay = useCallback((shazamResult: ShazamResult, isNewTrack: boolean) => {
    if (!isNewTrack) {
      // Same track, wait 60 seconds
      return 60;
    }

    const matches = shazamResult.matches || [];
    if (matches.length === 0) {
      return 120; // fallback
    }

    const offsetInSong = matches[0].offset || 0; // where we are in the song
    
    // Extract actual song duration from Shazam metadata
    let songDurationSeconds = null;
    
    if (shazamResult.track?.sections) {
      for (const section of shazamResult.track.sections) {
        if (section.metadata) {
          for (const meta of section.metadata) {
            // Look for duration in various possible fields
            if (meta.title?.toLowerCase().includes('duration') || 
                meta.title?.toLowerCase().includes('length') ||
                meta.title?.toLowerCase().includes('time')) {
              
              const durationText = meta.text;
              console.log('🔍 Found duration metadata:', meta.title, '=', durationText);
              
              // Parse formats like "5:16", "316", or "5m 16s"
              const timeMatch = durationText?.match(/(\d+):(\d+)/);
              if (timeMatch) {
                songDurationSeconds = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
                console.log(`✅ Parsed song duration: ${songDurationSeconds}s (${timeMatch[1]}:${timeMatch[2]})`);
                break;
              }
              
              // Try parsing just seconds
              const secondsMatch = durationText?.match(/^\d+$/);
              if (secondsMatch) {
                songDurationSeconds = parseInt(durationText);
                console.log(`✅ Parsed song duration: ${songDurationSeconds}s`);
                break;
              }
            }
          }
          if (songDurationSeconds) break;
        }
      }
    }
    
    // If we couldn't find duration in metadata, fallback to estimation
    if (!songDurationSeconds) {
      console.log('⚠️ Could not find song duration in Shazam metadata, using fallback');
      songDurationSeconds = Math.max(240, offsetInSong * 4); // Conservative estimate
    }
    
    // Simple math: song length - (current position + buffer time)
    const timeRemaining = Math.max(30, songDurationSeconds - offsetInSong - 30);
    
    console.log(`🎵 TIMING: ${offsetInSong}s into ${Math.floor(songDurationSeconds/60)}:${(songDurationSeconds%60).toString().padStart(2,'0')} song, wait ${Math.floor(timeRemaining/60)}:${(timeRemaining%60).toString().padStart(2,'0')}`);
    
    return Math.min(480, timeRemaining); // cap at 8 minutes
  }, []);

  // UPDATED: Process audio with FIXED Shazam timing data
  const processAudioSample = useCallback(async (audioBlob: Blob) => {
    setStatus('Converting and processing audio with Shazam...');

    try {
      console.log('🎵 Converting WebM to RAW PCM for recognition:', {
        size: audioBlob.size,
        type: audioBlob.type
      });

      // Convert WebM to RAW PCM format
      const rawPCMAudio = await convertToRawPCM(audioBlob);
      
      console.log(`📤 Sending ${rawPCMAudio.byteLength} bytes of RAW PCM to API...`);

      // Send as raw binary data with proper content type
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
        
        // Log the full Shazam response for timing analysis
        console.log('🔍 Full Shazam response for timing analysis:', result.rawResponse || result);
        
        // Add to local history immediately (in case DB has issues)
        const newHistoryEntry: RecognitionResult = {
          id: Date.now(), // Temporary ID
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
        
        // Check if this is a new track BEFORE updating database
        const isNewTrack = !currentTrack || 
          currentTrack.artist?.toLowerCase() !== result.track.artist?.toLowerCase() || 
          currentTrack.title?.toLowerCase() !== result.track.title?.toLowerCase();
        
        // Use FIXED Shazam timing data to calculate next recognition
        const nextDelay = calculateIntelligentDelay(result.rawResponse || result, isNewTrack);
        setNextRecognitionCountdown(nextDelay);

        if (isNewTrack) {
          console.log(`🆕 NEW TRACK: ${result.track.artist} - ${result.track.title}`);
        } else {
          console.log(`🔄 SAME TRACK: ${result.track.artist} - ${result.track.title}`);
        }

        // Try to load from DB but don't fail if it doesn't work
        setTimeout(() => {
          loadCurrentTrack();
          loadRecentHistory();
        }, 1000);

        console.log(`🎯 Recognition successful: ${result.track.artist} - ${result.track.title}`);
      } else {
        setStatus(result.error || 'No match found');
        // On no match, try again in 30 seconds (could be between songs)
        setNextRecognitionCountdown(30);
        console.log('❌ No match, could be between songs - retrying in 30s');
      }

    } catch (error) {
      console.error('Recognition error:', error);
      setStatus(`Recognition error: ${error instanceof Error ? error.message : 'Unknown error'} - retrying in 45 seconds`);
      // On error, wait 45 seconds before retry
      setNextRecognitionCountdown(45);
    }
  }, [convertToRawPCM, loadCurrentTrack, loadRecentHistory, currentTrack, calculateIntelligentDelay]);

  const triggerRecognition = useCallback(async () => {
    if (!mediaRecorderRef.current || isProcessing) return;

    setIsProcessing(true);
    setStatus('🎤 Capturing audio for recognition...');

    try {
      // Create a short recording just for recognition
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      });

      // Try different MIME types for better compatibility
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
      
      // Record for 5 seconds (reduced for smaller file size)
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
        console.log('⚠️ Opus codec not supported, using basic WebM');
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
        console.log('⚠️ WebM not supported, using MP4');
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = '';
        console.log('⚠️ Using default audio format');
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

      // Start first recognition immediately
      setTimeout(() => {
        triggerRecognition();
      }, 2000); // Start after 2 seconds

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
  }, []);

  const clearCurrentTrack = useCallback(async () => {
    try {
      await supabase.from('now_playing').delete().neq('id', 0);
      setCurrentTrack(null);
      setStatus('Cleared current track');
    } catch (error) {
      console.error('Error clearing track:', error);
    }
  }, []);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Load current state on mount
  useEffect(() => {
    loadCurrentTrack();
    loadRecentHistory();
  }, [loadCurrentTrack, loadRecentHistory]);

  // FIXED: Countdown timer with intelligent timing
  useEffect(() => {
    if (nextRecognitionCountdown > 0 && isListening) {
      countdownIntervalRef.current = setInterval(() => {
        setNextRecognitionCountdown(prev => {
          if (prev <= 1) {
            // Don't trigger if already processing
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
          Listen for vinyl and cassette audio, identify tracks with Shazam (uses song duration from metadata)
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

          {/* TV Display Link */}
          <a
            href="/tv-display"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              console.log('TV Display link clicked, going to:', '/tv-display');
            }}
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
          <div style={{ fontSize: 14, color: '#2563eb' }}>
            Next recognition in: {formatTime(nextRecognitionCountdown)}
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
          ✅ <strong>Fixed Timing:</strong> Now extracts actual song duration from Shazam metadata and calculates: Song Length - (Current Position + Buffer) = Next Sample Time
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
              No recognition history yet. Database connection may need setup.
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