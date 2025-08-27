// src/app/admin/audio-recognition/page.tsx - IMMEDIATE RECOGNITION + SILENCE TRIGGERS
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

interface SilenceConfig {
  silenceThreshold: number;
  silenceDuration: number;
  postRecognitionCooldown: number;
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
  
  // Silence detection state
  const [silenceLevel, setSilenceLevel] = useState(0);
  const [isInSilence, setIsInSilence] = useState(false);
  const [silenceDuration, setSilenceDuration] = useState(0);
  const [silenceMonitoringActive, setSilenceMonitoringActive] = useState(false);

  const [config, setConfig] = useState<SilenceConfig>({
    silenceThreshold: 0.02,
    silenceDuration: 3000,
    postRecognitionCooldown: 15000
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // Silence monitoring refs
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceStartTimeRef = useRef<number | null>(null);
  const lastRecognitionTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const monitoringRef = useRef<boolean>(false);

  // RAW PCM Conversion Function
  const convertToRawPCM = useCallback(async (webmBlob: Blob): Promise<ArrayBuffer> => {
    console.log('Converting WebM to RAW PCM format for Shazam...');
    
    const AudioContextClass = window.AudioContext || (window as WindowWithWebkitAudioContext).webkitAudioContext;
    
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

  // Process audio sample with Shazam
  const processAudioSample = useCallback(async (audioBlob: Blob, reason: string) => {
    console.log(`Processing audio: ${reason}`);
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
        setStatus(`Recognized (${reason}): ${result.track.artist} - ${result.track.title}`);
        
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
          console.log(`NEW TRACK: ${result.track.artist} - ${result.track.title}`);
          
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
          console.log(`SAME TRACK: ${result.track.artist} - ${result.track.title}`);
        }

      } else {
        setStatus(result.error || 'No match found');
      }

    } catch (error) {
      console.error('Recognition error:', error);
      setStatus(`Recognition error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [convertToRawPCM, currentTrack]);

  // MAIN RECOGNITION FUNCTION - Does immediate recognition (from working code)
  const triggerRecognition = useCallback(async (reason: string) => {
    if (isProcessing) return;

    console.log(`Triggering recognition: ${reason}`);
    setIsProcessing(true);
    setStatus(`Capturing audio for ${reason}...`);
    lastRecognitionTimeRef.current = Date.now();

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
          await processAudioSample(audioBlob, reason);
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

  // Silence monitoring function
  const checkAudioLevel = useCallback(() => {
    const analyser = analyserRef.current;
    if (!monitoringRef.current || !analyser || !silenceMonitoringActive) return;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    
    // Calculate RMS for audio level
    let sum = 0;
    let validSamples = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const value = dataArray[i];
      if (value > 0) {
        sum += (value / 255) * (value / 255);
        validSamples++;
      }
    }
    const rms = validSamples > 0 ? Math.sqrt(sum / validSamples) : 0;
    setSilenceLevel(rms);

    const now = Date.now();
    const timeSinceLastRecognition = now - lastRecognitionTimeRef.current;
    
    // Only detect silence if we're past the cooldown period
    if (timeSinceLastRecognition > config.postRecognitionCooldown) {
      if (rms < config.silenceThreshold) {
        // We're in silence
        if (!isInSilence) {
          console.log('Silence started');
          setIsInSilence(true);
          silenceStartTimeRef.current = now;
          setStatus('Silence detected, monitoring...');
        } else if (silenceStartTimeRef.current) {
          const currentSilenceDuration = now - silenceStartTimeRef.current;
          setSilenceDuration(currentSilenceDuration);
          
          // If silence has lasted long enough, trigger recognition
          if (currentSilenceDuration >= config.silenceDuration && !isProcessing) {
            console.log('Silence duration reached, triggering recognition');
            setIsInSilence(false);
            silenceStartTimeRef.current = null;
            setSilenceDuration(0);
            triggerRecognition('Silence detection triggered');
          }
        }
      } else {
        // Audio detected, reset silence tracking
        if (isInSilence) {
          console.log('Audio detected, stopping silence tracking');
          setIsInSilence(false);
          silenceStartTimeRef.current = null;
          setSilenceDuration(0);
          setStatus('Audio detected, listening...');
        }
      }
    } else {
      // During cooldown period
      const cooldownRemaining = Math.ceil((config.postRecognitionCooldown - timeSinceLastRecognition) / 1000);
      setStatus(`Cooldown: ${cooldownRemaining}s remaining`);
    }

    // Continue monitoring
    if (monitoringRef.current && silenceMonitoringActive) {
      animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
    }
  }, [config.postRecognitionCooldown, config.silenceThreshold, config.silenceDuration, isInSilence, isProcessing, silenceMonitoringActive, triggerRecognition]);

  // MAIN START FUNCTION - Immediate recognition first (from working code)
  const startListening = useCallback(async () => {
    console.log('Starting audio recognition system...');
    
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
      streamRef.current = stream; // Store stream for silence monitoring
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsListening(true);
      setStatus('Listening for audio...');

      // IMMEDIATE RECOGNITION (from working code)
      setTimeout(() => {
        triggerRecognition('Initial recognition');
      }, 2000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      setStatus('Error: Could not access microphone');
    }
  }, [triggerRecognition]);

  // Stop everything
  const stopListening = useCallback(() => {
    console.log('Stopping audio recognition system');
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    
    // Stop silence monitoring
    monitoringRef.current = false;
    setSilenceMonitoringActive(false);
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
    
    setIsListening(false);
    setIsProcessing(false);
    setIsInSilence(false);
    setSilenceDuration(0);
    setStatus('Stopped listening');
    setSilenceLevel(0);
  }, []);

  // Clear current track
  const clearCurrentTrack = useCallback(async () => {
    try {
      await supabase.from('now_playing').delete().neq('id', 0);
      setCurrentTrack(null);
      setStatus('Cleared current track');
    } catch (error) {
      console.error('Error clearing track:', error);
    }
  }, []);

  // Load current track and history (from working code)
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
          Recognizes tracks immediately, then uses silence detection for subsequent tracks
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
            {isListening ? 'Stop Listening' : 'Start Listening'}
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
            Open TV Display
          </a>
        </div>

        <div style={{ 
          fontSize: 14, 
          color: isProcessing ? '#ea580c' : '#16a34a',
          marginBottom: 12 
        }}>
          Status: {status}
        </div>

        {/* Silence Monitoring Status */}
        <div style={{
          background: silenceMonitoringActive ? '#f0fdf4' : '#f3f4f6',
          color: silenceMonitoringActive ? '#15803d' : '#6b7280',
          padding: '8px 12px',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 16,
          border: `1px solid ${silenceMonitoringActive ? '#22c55e' : '#d1d5db'}`
        }}>
          Silence Monitoring: {silenceMonitoringActive ? 'ACTIVE' : 'INACTIVE'}
          {silenceMonitoringActive && ` | Level: ${silenceLevel.toFixed(4)} | Threshold: ${config.silenceThreshold}`}
        </div>

        {/* Audio Level Indicators */}
        {silenceMonitoringActive && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Audio Level: </span>
              <div style={{
                display: 'inline-block',
                width: 300,
                height: 16,
                background: '#e5e7eb',
                borderRadius: 6,
                overflow: 'hidden',
                verticalAlign: 'middle',
                marginLeft: 8,
                border: '1px solid #d1d5db'
              }}>
                <div style={{
                  width: `${Math.min(silenceLevel * 1000, 100)}%`,
                  height: '100%',
                  background: silenceLevel < config.silenceThreshold ? '#ef4444' : '#22c55e',
                  transition: 'width 0.1s ease'
                }}></div>
              </div>
              <span style={{ 
                fontSize: 12, 
                color: silenceLevel < config.silenceThreshold ? '#ef4444' : '#22c55e',
                marginLeft: 8,
                fontWeight: 600
              }}>
                {silenceLevel < config.silenceThreshold ? 'SILENCE' : 'AUDIO'}
              </span>
            </div>
            
            {isInSilence && (
              <div style={{ 
                fontSize: 12, 
                color: '#7c3aed',
                background: '#f3f4f6',
                padding: '4px 8px',
                borderRadius: 4,
                display: 'inline-block'
              }}>
                Silence: {formatTime(Math.floor(silenceDuration / 1000))} / {formatTime(Math.floor(config.silenceDuration / 1000))}
                {silenceDuration >= config.silenceDuration && (
                  <span style={{ color: '#16a34a', marginLeft: 8 }}>→ Triggering recognition!</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Configuration Controls */}
        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            Silence Detection Settings
          </summary>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: 16, 
            marginTop: 16,
            padding: 16,
            background: '#f3f4f6',
            borderRadius: 8
          }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Silence Threshold: {config.silenceThreshold.toFixed(3)}
              </label>
              <input
                type="range"
                min="0.005"
                max="0.1"
                step="0.005"
                value={config.silenceThreshold}
                onChange={(e) => setConfig(prev => ({ ...prev, silenceThreshold: parseFloat(e.target.value) }))}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Silence Duration: {formatTime(Math.floor(config.silenceDuration / 1000))}
              </label>
              <input
                type="range"
                min="2000"
                max="10000"
                step="500"
                value={config.silenceDuration}
                onChange={(e) => setConfig(prev => ({ ...prev, silenceDuration: parseInt(e.target.value) }))}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Post-Recognition Cooldown: {formatTime(Math.floor(config.postRecognitionCooldown / 1000))}
              </label>
              <input
                type="range"
                min="10000"
                max="30000"
                step="1000"
                value={config.postRecognitionCooldown}
                onChange={(e) => setConfig(prev => ({ ...prev, postRecognitionCooldown: parseInt(e.target.value) }))}
                style={{ width: '100%' }}
              />
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
          <strong>HYBRID APPROACH:</strong> Immediate recognition on start, then silence detection triggers subsequent recognitions. 
          No more guessing song duration - uses actual silence between tracks.
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