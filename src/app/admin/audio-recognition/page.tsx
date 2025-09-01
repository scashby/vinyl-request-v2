// src/app/admin/audio-recognition/page.tsx - FIXED SILENCE DETECTION + CLEAR FEEDBACK
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
  
  // Enhanced monitoring state
  const [audioLevel, setAudioLevel] = useState(0);
  const [rawAudioLevel, setRawAudioLevel] = useState(0);
  const [isInSilence, setIsInSilence] = useState(false);
  const [silenceDuration, setSilenceDuration] = useState(0);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const [config, setConfig] = useState<SilenceConfig>({
    silenceThreshold: 0.01, // Lower threshold
    silenceDuration: 4000,  // 4 seconds
    postRecognitionCooldown: 20000 // 20 seconds
  });

  // Single stream approach
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceStartTimeRef = useRef<number | null>(null);
  const lastRecognitionTimeRef = useRef<number>(0);
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef<boolean>(false);

  // Add debug log entries
  const addDebugLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${message}`);
    setDebugInfo(prev => [`${timestamp}: ${message}`, ...prev.slice(0, 9)]);
  }, []);

  // Convert audio buffer to RAW PCM
  const convertAudioBufferToRawPCM = useCallback(async (audioBuffer: AudioBuffer): Promise<ArrayBuffer> => {
    addDebugLog('Converting AudioBuffer to RAW PCM format...');
    
    // Convert to mono and limit to 3 seconds
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
    
    addDebugLog(`Converted to RAW PCM: ${pcmData.buffer.byteLength} bytes`);
    return pcmData.buffer;
  }, [addDebugLog]);

  // Process the captured audio buffer
  const processAudioBuffer = useCallback(async (audioBuffer: AudioBuffer, reason: string) => {
    addDebugLog(`Processing captured audio: ${reason}`);
    
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
        addDebugLog(`✅ Recognized: ${result.track.artist} - ${result.track.title}`);
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
          addDebugLog(`🆕 NEW TRACK DETECTED: ${result.track.artist} - ${result.track.title}`);
          
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
            addDebugLog(`❌ Database error: ${dbError}`);
          }
        } else {
          addDebugLog(`🔄 Same track confirmed: ${result.track.artist} - ${result.track.title}`);
        }

      } else {
        addDebugLog(`❌ No match found: ${result.error || 'Unknown error'}`);
        setStatus(`❌ ${result.error || 'No match found'}`);
      }

    } catch (error) {
      addDebugLog(`❌ Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStatus(`❌ Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [convertAudioBufferToRawPCM, currentTrack, addDebugLog]);

  // Capture audio from the live stream and recognize it
  const triggerRecognition = useCallback(async (reason: string) => {
    if (isProcessing || !audioContextRef.current || !streamRef.current) {
      addDebugLog(`❌ Recognition blocked: processing=${isProcessing}, context=${!!audioContextRef.current}, stream=${!!streamRef.current}`);
      return;
    }

    addDebugLog(`🎵 TRIGGERING RECOGNITION: ${reason}`);
    setIsProcessing(true);
    setStatus(`🎤 Capturing audio for ${reason}...`);
    lastRecognitionTimeRef.current = Date.now();

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
          
          addDebugLog(`📊 Captured ${sampleIndex} audio samples, processing...`);
          
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
      
      // Safety timeout in case we don't get enough samples
      setTimeout(() => {
        if (sampleIndex < bufferSize / 2) { // If we got less than 1.5 seconds
          addDebugLog(`⚠️ Timeout: Only captured ${sampleIndex}/${bufferSize} samples`);
          processor.disconnect();
          source.disconnect();
          captureContext.close();
          setIsProcessing(false);
          setStatus('❌ Not enough audio captured (timeout)');
        }
      }, 5000);

    } catch (error) {
      addDebugLog(`❌ Recognition error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStatus(`❌ Recognition failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsProcessing(false);
    }
  }, [isProcessing, processAudioBuffer, addDebugLog]);

  // IMPROVED Audio monitoring loop with better silence detection
  const runMonitoringLoop = useCallback(() => {
    if (!isRunningRef.current || !analyserRef.current) {
      return;
    }

    try {
      // Use time domain data for better silence detection
      const bufferLength = analyserRef.current.fftSize;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteTimeDomainData(dataArray);
      
      // Calculate RMS (Root Mean Square) - better for silence detection
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const normalized = (dataArray[i] - 128) / 128; // Convert to -1 to 1 range
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / bufferLength);
      
      setRawAudioLevel(rms); // Store raw value for debugging
      setAudioLevel(rms * 100); // Scale for display (0-100)

      const now = Date.now();
      const timeSinceLastRecognition = now - lastRecognitionTimeRef.current;
      
      // Check if we're in cooldown period
      if (timeSinceLastRecognition < config.postRecognitionCooldown) {
        const cooldownRemaining = Math.ceil((config.postRecognitionCooldown - timeSinceLastRecognition) / 1000);
        setStatus(`⏱️ Cooldown: ${cooldownRemaining}s remaining (level: ${(rms * 100).toFixed(1)})`);
        setIsInSilence(false);
        setSilenceDuration(0);
        silenceStartTimeRef.current = null;
        return;
      }

      // IMPROVED Silence detection logic
      const isSilent = rms < config.silenceThreshold;
      
      if (isSilent) {
        if (!isInSilence) {
          // Just entered silence
          addDebugLog(`🔇 SILENCE DETECTED: level ${(rms * 100).toFixed(3)} < threshold ${(config.silenceThreshold * 100).toFixed(3)}`);
          setIsInSilence(true);
          silenceStartTimeRef.current = now;
          setStatus(`🔇 Silence detected (level: ${(rms * 100).toFixed(1)})`);
          setSilenceDuration(0);
        } else if (silenceStartTimeRef.current) {
          // Still in silence - check duration
          const currentSilenceDuration = now - silenceStartTimeRef.current;
          setSilenceDuration(currentSilenceDuration);
          
          const remainingTime = Math.max(0, config.silenceDuration - currentSilenceDuration);
          setStatus(`🔇 Silence: ${Math.floor(currentSilenceDuration / 1000)}s/${Math.floor(config.silenceDuration / 1000)}s (${Math.ceil(remainingTime / 1000)}s remaining)`);
          
          if (currentSilenceDuration >= config.silenceDuration) {
            addDebugLog(`🎯 SILENCE THRESHOLD REACHED: ${currentSilenceDuration}ms >= ${config.silenceDuration}ms - TRIGGERING RECOGNITION!`);
            setIsInSilence(false);
            silenceStartTimeRef.current = null;
            setSilenceDuration(0);
            
            // Trigger recognition
            if (!isProcessing) {
              triggerRecognition('Silence detection');
            } else {
              addDebugLog(`⚠️ Recognition already in progress, skipping trigger`);
            }
          }
        }
      } else {
        // Audio detected
        if (isInSilence) {
          addDebugLog(`🔊 AUDIO DETECTED: level ${(rms * 100).toFixed(3)} > threshold ${(config.silenceThreshold * 100).toFixed(3)} - exiting silence`);
          setIsInSilence(false);
          silenceStartTimeRef.current = null;
          setSilenceDuration(0);
        }
        setStatus(`🎧 Audio detected (level: ${(rms * 100).toFixed(1)}) - listening for silence...`);
      }

    } catch (error) {
      addDebugLog(`❌ Monitoring error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [config.postRecognitionCooldown, config.silenceDuration, config.silenceThreshold, isInSilence, isProcessing, triggerRecognition, addDebugLog]);

  // Start the audio recognition system
  const startListening = useCallback(async () => {
    addDebugLog('🎤 Starting audio recognition system...');
    
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

      addDebugLog('✅ Microphone access granted');

      // Set up audio context and analyser
      const AudioContextClass = window.AudioContext || (window as WindowWithWebkitAudioContext).webkitAudioContext;
      const audioContext = new AudioContextClass({ sampleRate: 44100 });
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      source.connect(analyser);
      analyser.fftSize = 2048; // Higher resolution for better detection
      
      // Store references
      streamRef.current = stream;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      isRunningRef.current = true;
      
      setIsListening(true);
      addDebugLog('📊 Audio monitoring setup complete');
      setStatus('🎤 System started - performing initial recognition...');

      // Clear previous debug info
      setDebugInfo([]);

      // Immediate recognition
      setTimeout(() => {
        addDebugLog('⚡ Starting initial recognition...');
        triggerRecognition('Initial recognition');
      }, 1000);

      // Start monitoring loop after initial recognition
      setTimeout(() => {
        addDebugLog('📊 Starting silence monitoring loop...');
        setStatus('📊 Monitoring audio levels...');
        
        // Use setInterval for reliable monitoring
        monitoringIntervalRef.current = setInterval(() => {
          runMonitoringLoop();
        }, 100); // Check every 100ms
        
      }, 8000); // Wait 8 seconds after initial recognition

    } catch (error) {
      addDebugLog(`❌ Microphone error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStatus(`❌ Microphone access failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [triggerRecognition, runMonitoringLoop, addDebugLog]);

  // Stop the audio recognition system
  const stopListening = useCallback(() => {
    addDebugLog('🛑 Stopping audio recognition system');
    
    isRunningRef.current = false;
    
    // Clear monitoring interval
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
      monitoringIntervalRef.current = null;
    }
    
    // Clean up audio resources
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
      addDebugLog('🔇 Audio tracks stopped');
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
      addDebugLog('🔇 Audio context closed');
    }
    
    analyserRef.current = null;
    
    setIsListening(false);
    setIsProcessing(false);
    setIsInSilence(false);
    setSilenceDuration(0);
    setAudioLevel(0);
    setRawAudioLevel(0);
    setStatus('🛑 Stopped listening');
  }, [addDebugLog]);

  // Clear current track
  const clearCurrentTrack = useCallback(async () => {
    try {
      await supabase.from('now_playing').delete().neq('id', 0);
      setCurrentTrack(null);
      setStatus('🗑️ Cleared current track');
      addDebugLog('🗑️ Current track cleared');
    } catch (error) {
      addDebugLog(`❌ Error clearing track: ${error}`);
    }
  }, [addDebugLog]);

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
          Enhanced monitoring with detailed logging and improved silence detection
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

        {/* Enhanced Audio Level Display */}
        {isListening && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#374151', minWidth: 100 }}>Audio Level:</span>
              <div style={{
                flex: 1,
                height: 24,
                background: '#f3f4f6',
                borderRadius: 12,
                overflow: 'hidden',
                border: '2px solid #e5e7eb',
                position: 'relative'
              }}>
                {/* Audio level bar */}
                <div style={{
                  width: `${Math.min(audioLevel * 2, 100)}%`, // Scale up for visibility
                  height: '100%',
                  background: rawAudioLevel < config.silenceThreshold 
                    ? 'linear-gradient(90deg, #ef4444, #f87171)' // RED = SILENCE
                    : 'linear-gradient(90deg, #22c55e, #4ade80)', // GREEN = MUSIC/AUDIO
                  transition: 'width 0.1s ease'
                }}></div>
                {/* Threshold indicator */}
                <div style={{
                  position: 'absolute',
                  left: `${config.silenceThreshold * 200}%`, // Scale up to match bar
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: '#1f2937',
                  zIndex: 10
                }}></div>
              </div>
              <div style={{ 
                fontSize: 14, 
                fontWeight: 700,
                color: rawAudioLevel < config.silenceThreshold ? '#dc2626' : '#16a34a',
                minWidth: 80,
                textAlign: 'center',
                padding: '2px 8px',
                borderRadius: 4,
                background: rawAudioLevel < config.silenceThreshold ? '#fef2f2' : '#f0fdf4'
              }}>
                {rawAudioLevel < config.silenceThreshold ? '🔇 SILENCE' : '🔊 AUDIO'}
              </div>
            </div>
            
            {/* Technical details */}
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
              Raw level: {(rawAudioLevel * 100).toFixed(3)} | Threshold: {(config.silenceThreshold * 100).toFixed(3)} | 
              Scaled display: {audioLevel.toFixed(1)}
            </div>
            
            {isInSilence && (
              <div style={{ 
                fontSize: 14, 
                color: '#7c3aed',
                background: 'linear-gradient(90deg, #faf5ff, #f3e8ff)',
                border: '2px solid #d8b4fe',
                padding: '8px 12px',
                borderRadius: 8,
                display: 'inline-block',
                fontWeight: 600
              }}>
                🔇 Silence Duration: {formatTime(Math.floor(silenceDuration / 1000))} / {formatTime(Math.floor(config.silenceDuration / 1000))}
                {silenceDuration >= config.silenceDuration * 0.8 && (
                  <span style={{ color: '#dc2626', marginLeft: 8 }}>⚡ ALMOST TRIGGERING!</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Configuration Controls */}
        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            🔧 Silence Detection Settings
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
                Silence Threshold: {(config.silenceThreshold * 100).toFixed(3)}
              </label>
              <input
                type="range"
                min="0.001"
                max="0.05"
                step="0.001"
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
          <strong>📊 VISUAL GUIDE:</strong> 
          🔴 RED bar = SILENCE (below threshold) | 🟢 GREEN bar = AUDIO/MUSIC (above threshold) | 
          Black line = threshold marker | Enhanced logging shows exactly what&apos;s happening
        </div>
      </div>

      {/* Debug Information Panel */}
      {debugInfo.length > 0 && (
        <div style={{
          background: '#000',
          color: '#fff',
          borderRadius: 12,
          padding: 20,
          marginBottom: 32,
          maxHeight: 300,
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: 12
        }}>
          <div style={{ 
            fontWeight: 600, 
            marginBottom: 12,
            color: '#22c55e',
            borderBottom: '1px solid #333',
            paddingBottom: 8
          }}>
            🔍 Debug Log (Last 10 entries)
          </div>
          {debugInfo.map((log, index) => (
            <div key={index} style={{ 
              marginBottom: 4,
              color: log.includes('❌') ? '#ef4444' : 
                   log.includes('✅') ? '#22c55e' :
                   log.includes('🎯') || log.includes('🔇') || log.includes('🔊') ? '#fbbf24' :
                   log.includes('🆕') ? '#a78bfa' : '#d1d5db'
            }}>
              {log}
            </div>
          ))}
        </div>
      )}

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