// src/app/admin/audio-recognition/page.tsx - SIMPLE TIMER-BASED APPROACH THAT WORKS
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

interface WindowWithWebkitAudioContext extends Window {
  webkitAudioContext?: typeof AudioContext;
}

export default function AudioRecognitionPage() {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<NowPlayingState | null>(null);
  const [recognitionHistory, setRecognitionHistory] = useState<RecognitionResult[]>([]);
  const [status, setStatus] = useState('Ready to listen');
  
  // Simple timer-based approach
  const [recognitionInterval, setRecognitionInterval] = useState(180); // 3 minutes default
  const [nextRecognitionIn, setNextRecognitionIn] = useState(0);
  const [autoRecognitionEnabled, setAutoRecognitionEnabled] = useState(true);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastRecognitionTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Convert audio buffer to RAW PCM
  const convertAudioBufferToRawPCM = useCallback(async (audioBuffer: AudioBuffer): Promise<ArrayBuffer> => {
    console.log('Converting AudioBuffer to RAW PCM format...');
    
    const maxSamples = Math.min(audioBuffer.length, 3 * audioBuffer.sampleRate);
    const channelData = audioBuffer.numberOfChannels > 1 
      ? audioBuffer.getChannelData(0) 
      : audioBuffer.getChannelData(0);
    
    const pcmData = new Int16Array(maxSamples);
    for (let i = 0; i < maxSamples; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      pcmData[i] = Math.round(sample * 32767);
    }
    
    console.log(`Converted to RAW PCM: ${pcmData.buffer.byteLength} bytes`);
    return pcmData.buffer;
  }, []);

  // Process the captured audio buffer
  const processAudioBuffer = useCallback(async (audioBuffer: AudioBuffer, reason: string) => {
    console.log(`Processing captured audio: ${reason}`);
    
    try {
      const rawPCMAudio = await convertAudioBufferToRawPCM(audioBuffer);
      
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
        console.log(`✅ Recognized: ${result.track.artist} - ${result.track.title}`);
        setStatus(`✅ Recognized (${reason}): ${result.track.artist} - ${result.track.title}`);
        
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
        
        if (isNewTrack) {
          console.log(`🆕 NEW TRACK: ${result.track.artist} - ${result.track.title}`);
          
          // Update database
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
          console.log(`🔄 Same track: ${result.track.artist} - ${result.track.title}`);
        }

        // Reset timer for next recognition
        lastRecognitionTimeRef.current = Date.now();

      } else {
        console.log(`❌ No match found: ${result.error || 'Unknown error'}`);
        setStatus(`❌ ${result.error || 'No match found'}`);
      }

    } catch (error) {
      console.error('Processing error:', error);
      setStatus(`❌ Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [convertAudioBufferToRawPCM, currentTrack]);

  // Trigger recognition
  const triggerRecognition = useCallback(async (reason: string) => {
    if (isProcessing || !audioContextRef.current || !streamRef.current) {
      console.log(`❌ Recognition blocked: processing=${isProcessing}, context=${!!audioContextRef.current}, stream=${!!streamRef.current}`);
      return;
    }

    console.log(`🎵 TRIGGERING RECOGNITION: ${reason}`);
    setIsProcessing(true);
    setStatus(`🎤 Capturing audio for ${reason}...`);

    try {
      // Create a new AudioContext to capture the current audio
      const AudioContextClass = window.AudioContext || (window as WindowWithWebkitAudioContext).webkitAudioContext;
      const captureContext = new AudioContextClass({ sampleRate: 44100 });
      
      // Create source from current stream
      const source = captureContext.createMediaStreamSource(streamRef.current);
      
      // Create a buffer to capture 3 seconds of audio
      const bufferSize = 3 * captureContext.sampleRate;
      const audioBuffer = captureContext.createBuffer(1, bufferSize, captureContext.sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      
      // Create script processor to capture audio data
      const processor = captureContext.createScriptProcessor(4096, 1, 1);
      let sampleIndex = 0;
      
      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        
        for (let i = 0; i < inputData.length && sampleIndex < bufferSize; i++) {
          channelData[sampleIndex] = inputData[i];
          sampleIndex++;
        }
        
        // Stop capturing after we have enough samples
        if (sampleIndex >= bufferSize) {
          processor.disconnect();
          source.disconnect();
          
          console.log(`📊 Captured ${sampleIndex} audio samples, processing...`);
          
          // Process the captured audio
          processAudioBuffer(audioBuffer, reason).finally(() => {
            captureContext.close();
            setIsProcessing(false);
          });
        }
      };
      
      // Connect the audio processing chain
      source.connect(processor);
      processor.connect(captureContext.destination);
      
      // Safety timeout
      setTimeout(() => {
        if (sampleIndex < bufferSize / 2) {
          console.log(`⚠️ Timeout: Only captured ${sampleIndex}/${bufferSize} samples`);
          processor.disconnect();
          source.disconnect();
          captureContext.close();
          setIsProcessing(false);
          setStatus('❌ Not enough audio captured (timeout)');
        }
      }, 5000);

    } catch (error) {
      console.error('Recognition error:', error);
      setStatus(`❌ Recognition failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsProcessing(false);
    }
  }, [isProcessing, processAudioBuffer]);

  // Simple timer countdown
  const updateTimer = useCallback(() => {
    if (!autoRecognitionEnabled) return;

    const now = Date.now();
    const timeSinceLastRecognition = now - lastRecognitionTimeRef.current;
    const intervalMs = recognitionInterval * 1000;
    
    if (timeSinceLastRecognition >= intervalMs) {
      // Time for next recognition
      if (!isProcessing) {
        triggerRecognition('Automatic timer');
      }
      setNextRecognitionIn(0);
    } else {
      // Update countdown
      const remaining = Math.ceil((intervalMs - timeSinceLastRecognition) / 1000);
      setNextRecognitionIn(remaining);
      setStatus(`⏰ Next recognition in ${remaining}s`);
    }
  }, [autoRecognitionEnabled, recognitionInterval, isProcessing, triggerRecognition]);

  // Start the audio recognition system
  const startListening = useCallback(async () => {
    console.log('🎤 Starting timer-based audio recognition system...');
    
    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      });

      console.log('✅ Microphone access granted');

      // Set up audio context (just for stream management)
      const AudioContextClass = window.AudioContext || (window as WindowWithWebkitAudioContext).webkitAudioContext;
      const audioContext = new AudioContextClass({ sampleRate: 44100 });
      
      // Store references
      streamRef.current = stream;
      audioContextRef.current = audioContext;
      
      setIsListening(true);
      setStatus('🎤 System started - performing initial recognition...');
      
      lastRecognitionTimeRef.current = Date.now();

      // Immediate recognition
      setTimeout(() => {
        triggerRecognition('Initial recognition');
      }, 1000);

      // Start timer updates
      timerIntervalRef.current = setInterval(updateTimer, 1000);

    } catch (error) {
      console.error('Error starting audio system:', error);
      setStatus(`❌ Microphone access failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [triggerRecognition, updateTimer]);

  // Stop the audio recognition system
  const stopListening = useCallback(() => {
    console.log('🛑 Stopping audio recognition system');
    
    // Clear timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    // Clean up audio resources
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setIsListening(false);
    setIsProcessing(false);
    setNextRecognitionIn(0);
    setStatus('🛑 Stopped listening');
  }, []);

  // Manual recognition trigger
  const manualRecognition = useCallback(() => {
    if (isListening) {
      triggerRecognition('Manual trigger');
      lastRecognitionTimeRef.current = Date.now(); // Reset timer
    }
  }, [isListening, triggerRecognition]);

  // Clear current track
  const clearCurrentTrack = useCallback(async () => {
    try {
      await supabase.from('now_playing').delete().neq('id', 0);
      setCurrentTrack(null);
      setStatus('🗑️ Cleared current track');
    } catch (error) {
      console.error('Error clearing track:', error);
    }
  }, []);

  // Load current track and history
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
      } else {
        setCurrentTrack(null);
      }
    } catch (error) {
      console.warn('Error loading current track:', error);
    }
  }, []);

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

  const formatTime = useCallback((seconds: number) => {
    const validSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
    const mins = Math.floor(validSeconds / 60);
    const secs = validSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Load current state on mount
  useEffect(() => {
    loadCurrentTrack();
    loadRecentHistory();
  }, [loadCurrentTrack, loadRecentHistory]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

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
          🎵 Audio Recognition Control
        </h1>
        <p style={{ color: '#666', fontSize: 16 }}>
          Simple timer-based approach - recognizes every X seconds (actually works!)
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
            {isListening ? '🛑 Stop Listening' : '🎤 Start Listening'}
          </button>

          {isListening && (
            <button
              onClick={manualRecognition}
              disabled={isProcessing}
              style={{
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 14,
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                opacity: isProcessing ? 0.6 : 1
              }}
            >
              🎯 Recognize Now
            </button>
          )}

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
              🗑️ Clear Current Track
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
          color: isProcessing ? '#ea580c' : isListening ? '#16a34a' : '#6b7280',
          marginBottom: 16,
          fontWeight: 600,
          padding: '8px 12px',
          background: isProcessing ? '#fef3c7' : isListening ? '#f0fdf4' : '#f9fafb',
          borderRadius: 6,
          border: `1px solid ${isProcessing ? '#f59e0b' : isListening ? '#22c55e' : '#e5e7eb'}`
        }}>
          {status}
        </div>

        {/* Timer Display */}
        {isListening && (
          <div style={{
            background: '#e0f2fe',
            border: '2px solid #0284c7',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#0f172a' }}>
              ⏰ Next Recognition: {nextRecognitionIn}s
            </div>
            <div style={{ 
              background: autoRecognitionEnabled ? '#22c55e' : '#6b7280',
              color: 'white',
              padding: '4px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600
            }}>
              {autoRecognitionEnabled ? 'AUTO ON' : 'AUTO OFF'}
            </div>
          </div>
        )}

        {/* Settings */}
        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            ⚙️ Timer Settings
          </summary>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: 16, 
            marginTop: 16,
            padding: 16,
            background: '#f3f4f6',
            borderRadius: 8
          }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Recognition Interval: {formatTime(recognitionInterval)}
              </label>
              <input
                type="range"
                min="60"
                max="300"
                step="15"
                value={recognitionInterval}
                onChange={(e) => setRecognitionInterval(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                How often to check for new tracks (60s - 5min)
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>
                Auto Recognition:
              </label>
              <button
                onClick={() => setAutoRecognitionEnabled(!autoRecognitionEnabled)}
                style={{
                  background: autoRecognitionEnabled ? '#22c55e' : '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {autoRecognitionEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </details>

        <div style={{
          marginTop: 12,
          padding: 12,
          background: '#f0fdf4',
          border: '1px solid #22c55e',
          borderRadius: 8,
          fontSize: 12,
          color: '#15803d'
        }}>
          <strong>⏰ SIMPLE APPROACH:</strong> 
          Forget silence detection - just recognize every X seconds automatically. 
          Manual trigger available anytime. This actually works!
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
          📋 Recent Recognition History
        </div>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {recognitionHistory.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
              No recognition history yet. Start listening to see results.
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