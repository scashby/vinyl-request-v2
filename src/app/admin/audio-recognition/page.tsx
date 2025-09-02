// src/app/admin/audio-recognition/page.tsx - SIMPLE WORKING SYSTEM
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
  created_at?: string | null;
  source?: string | null;
  confirmed?: boolean | null;
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
}

interface WindowWithWebkitAudioContext extends Window {
  webkitAudioContext?: typeof AudioContext;
}

export default function AudioRecognitionPage() {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<NowPlayingState | null>(null);
  const [recognitionHistory, setRecognitionHistory] = useState<RecognitionResult[]>([]);
  const [status, setStatus] = useState('Enable microphone to start');
  const [currentLevel, setCurrentLevel] = useState(0);
  
  // Simple manual controls
  const [musicLevel, setMusicLevel] = useState(50); // Manual input for music level (75-85dB range)
  const [silenceLevel, setSilenceLevel] = useState(10); // Manual input for silence level (ambient)
  const [silenceThreshold, setSilenceThreshold] = useState(3); // Seconds to wait in silence
  const [isInSilence, setIsInSilence] = useState(false);
  const [silenceCounter, setSilenceCounter] = useState(0);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const isRunningRef = useRef<boolean>(false);
  const monitoringIntervalRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number>(0);

  // PROPER amplitude detection using time domain data
  const getCurrentAudioLevel = useCallback((): number => {
    if (!analyserRef.current) return 0;
    
    const analyser = analyserRef.current;
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray); // Use TIME DOMAIN data for amplitude
    
    // Calculate RMS (Root Mean Square) for proper amplitude measurement
    let sumSquares = 0;
    for (let i = 0; i < bufferLength; i++) {
      const sample = (dataArray[i] - 128) / 128; // Convert to -1 to 1 range
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / bufferLength);
    
    // Convert to decibels (logarithmic scale)
    const decibels = 20 * Math.log10(rms + 0.0001); // Add small value to avoid log(0)
    
    // Map decibels to 0-100 scale
    // Typical range: -60dB (quiet) to -10dB (loud)
    // Map -60dB = 0, -10dB = 100
    const minDB = -60;
    const maxDB = -10;
    const level = Math.max(0, Math.min(100, ((decibels - minDB) / (maxDB - minDB)) * 100));
    
    console.log('=== AUDIO LEVEL ===');
    console.log('RMS:', rms.toFixed(4));
    console.log('Decibels:', decibels.toFixed(1), 'dB');
    console.log('Scaled level (0-100):', Math.round(level));
    console.log('Music threshold:', musicLevel);
    console.log('Silence threshold:', silenceLevel);
    console.log('Currently above music level?', level > musicLevel);
    console.log('Currently below silence level?', level < silenceLevel);
    console.log('==================');
    
    // Update debug info for on-page console
    setDebugInfo([
      `RMS: ${rms.toFixed(4)}`,
      `Decibels: ${decibels.toFixed(1)} dB`,
      `Scaled level: ${Math.round(level)}`,
      `Music threshold: ${musicLevel}`,
      `Silence threshold: ${silenceLevel}`,
      `Above music? ${level > musicLevel}`,
      `Below silence? ${level < silenceLevel}`,
      `Is in silence: ${isInSilence}`,
      `Silence counter: ${silenceCounter}s`
    ]);
    
    return Math.round(level);
  }, [musicLevel, silenceLevel, isInSilence, silenceCounter]);

  // Convert audio buffer for recognition API
  const convertAudioBufferToRawPCM = useCallback(async (audioBuffer: AudioBuffer): Promise<ArrayBuffer> => {
    const maxSamples = Math.min(audioBuffer.length, Math.floor(3 * audioBuffer.sampleRate));
    const channelData = audioBuffer.getChannelData(0);
    const pcmData = new Int16Array(maxSamples);
    for (let i = 0; i < maxSamples; i++) {
      const s = Math.max(-1, Math.min(1, channelData[i]));
      pcmData[i] = Math.round(s * 32767);
    }
    return pcmData.buffer;
  }, []);

  // Process audio for recognition
  const processAudioBuffer = useCallback(async (audioBuffer: AudioBuffer, reason: string) => {
    try {
      setStatus(`Processing audio for ${reason}...`);
      console.log('=== PROCESSING AUDIO ===');
      console.log('Reason:', reason);
      console.log('Buffer length:', audioBuffer.length);
      console.log('Sample rate:', audioBuffer.sampleRate);
      
      const rawPCMAudio = await convertAudioBufferToRawPCM(audioBuffer);
      
      const response = await fetch('/api/audio-recognition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: rawPCMAudio
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Recognition failed: ${response.status} - ${errorText}`);
      }
      
      const result: {
        success: boolean;
        track?: {
          artist: string;
          title: string;
          album?: string | null;
          confidence?: number;
          service: string;
          image_url?: string;
        };
        error?: string;
      } = await response.json();

      if (result.success && result.track) {
        console.log('SUCCESS:', result.track);
        setStatus(`✅ ${result.track.artist} - ${result.track.title}`);
        
        const newHistoryEntry: RecognitionResult = {
          id: Date.now(),
          artist: result.track.artist,
          title: result.track.title,
          album: result.track.album ?? null,
          confidence: result.track.confidence ?? null,
          service: result.track.service,
          created_at: new Date().toISOString(),
          source: 'microphone',
          confirmed: true
        };
        setRecognitionHistory(prev => [newHistoryEntry, ...prev.slice(0, 19)]);

        const isNewTrack = !currentTrack ||
          currentTrack.artist?.toLowerCase() !== result.track.artist?.toLowerCase() ||
          currentTrack.title?.toLowerCase() !== result.track.title?.toLowerCase();

        if (isNewTrack) {
          try {
            await supabase.from('now_playing').delete().neq('id', 0);
            const insertResp = await supabase
              .from('now_playing')
              .insert({
                artist: result.track.artist,
                title: result.track.title,
                album_title: result.track.album ?? null,
                started_at: new Date().toISOString(),
                recognition_confidence: result.track.confidence ?? 0.7,
                service_used: result.track.service.toLowerCase(),
                recognition_image_url: result.track.image_url ?? null,
                created_at: new Date().toISOString()
              })
              .select()
              .single();
            if (insertResp.data) setCurrentTrack(insertResp.data);

            await supabase.from('audio_recognition_logs').insert({
              artist: result.track.artist,
              title: result.track.title,
              album: result.track.album ?? null,
              source: 'microphone',
              service: result.track.service.toLowerCase(),
              confidence: result.track.confidence ?? 0.7,
              confirmed: true,
              created_at: new Date().toISOString()
            });
          } catch (dbError) {
            console.error('Database error:', dbError);
          }
        }
      } else {
        console.log('NO MATCH:', result.error);
        setStatus(`❌ No match found`);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log('PROCESSING ERROR:', error);
      setStatus(`❌ Error: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  }, [convertAudioBufferToRawPCM, currentTrack]);

  // Capture 3 seconds of audio for recognition
  const captureAudio = useCallback(async (reason: string) => {
    if (isProcessing || !audioContextRef.current || !streamRef.current) {
      console.log('SKIPPING CAPTURE - processing or no audio context');
      return;
    }
    
    setIsProcessing(true);
    console.log('=== STARTING AUDIO CAPTURE ===');
    console.log('Reason:', reason);

    try {
      const AudioContextClass = window.AudioContext || (window as WindowWithWebkitAudioContext).webkitAudioContext;
      const captureContext = new AudioContextClass({ sampleRate: 44100 });
      await captureContext.resume();

      const source = captureContext.createMediaStreamSource(streamRef.current);
      const processor = captureContext.createScriptProcessor(4096, 1, 1);
      const bufferSize = 3 * captureContext.sampleRate; // 3 seconds
      const audioBuffer = captureContext.createBuffer(1, bufferSize, captureContext.sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      let sampleIndex = 0;

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        const input = e.inputBuffer.getChannelData(0);
        const n = Math.min(input.length, bufferSize - sampleIndex);
        channelData.set(input.subarray(0, n), sampleIndex);
        sampleIndex += n;

        if (sampleIndex >= bufferSize) {
          console.log('CAPTURE COMPLETE - processing audio');
          processor.disconnect();
          source.disconnect();
          processAudioBuffer(audioBuffer, reason).finally(() => {
            captureContext.close();
          });
        }
      };

      source.connect(processor);
      processor.connect(captureContext.destination);

      // Timeout fallback
      setTimeout(() => {
        if (sampleIndex < bufferSize / 2) {
          console.log('CAPTURE TIMEOUT');
          processor.disconnect();
          source.disconnect();
          captureContext.close();
          setIsProcessing(false);
          setStatus('❌ Audio capture timeout');
        }
      }, 5000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('CAPTURE ERROR:', e);
      setStatus(`❌ Capture failed: ${msg}`);
      setIsProcessing(false);
    }
  }, [isProcessing, processAudioBuffer]);

  // Main monitoring loop
  const runMonitoring = useCallback(() => {
    if (!isRunningRef.current || !analyserRef.current) return;

    const level = getCurrentAudioLevel();
    setCurrentLevel(level);

    // Simple silence detection logic
    if (level < silenceLevel) {
      if (!isInSilence) {
        console.log('ENTERING SILENCE');
        setIsInSilence(true);
        silenceStartRef.current = Date.now();
        setSilenceCounter(0);
      } else {
        const elapsed = Date.now() - silenceStartRef.current;
        const secondsElapsed = Math.floor(elapsed / 1000);
        setSilenceCounter(secondsElapsed);
        
        if (secondsElapsed >= silenceThreshold) {
          console.log(`SILENCE THRESHOLD REACHED (${silenceThreshold}s) - TRIGGERING RECOGNITION`);
          setIsInSilence(false);
          setSilenceCounter(0);
          captureAudio('Silence detected');
        }
      }
    } else {
      if (isInSilence) {
        console.log('EXITING SILENCE');
        setIsInSilence(false);
        setSilenceCounter(0);
      }
    }

    // Update status
    if (isProcessing) {
      setStatus('🎙️ Processing audio...');
    } else if (isInSilence) {
      setStatus(`🔇 Silence: ${silenceCounter}s / ${silenceThreshold}s (Level: ${level})`);
    } else {
      setStatus(`🎵 Monitoring (Level: ${level} | Music: ${musicLevel} | Silence: ${silenceLevel})`);
    }
  }, [getCurrentAudioLevel, isInSilence, isProcessing, musicLevel, silenceLevel, silenceThreshold, silenceCounter, captureAudio]);

  // Setup microphone
  const setupMicrophone = useCallback(async () => {
    try {
      console.log('=== SETTING UP MICROPHONE ===');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      });

      const AudioContextClass = window.AudioContext || (window as WindowWithWebkitAudioContext).webkitAudioContext;
      const audioContext = new AudioContextClass({ sampleRate: 44100 });
      await audioContext.resume();

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      console.log('MICROPHONE SETUP COMPLETE');
      setStatus('🎙️ Microphone ready - adjust levels and start monitoring');
      
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log('MICROPHONE ERROR:', error);
      setStatus(`❌ Microphone error: ${msg}`);
    }
  }, []);

  // Start/stop monitoring
  const startMonitoring = useCallback(() => {
    if (!audioContextRef.current) {
      setStatus('❌ Setup microphone first');
      return;
    }

    console.log('=== STARTING MONITORING ===');
    console.log('Music level:', musicLevel);
    console.log('Silence level:', silenceLevel);
    console.log('Silence threshold:', silenceThreshold, 'seconds');

    isRunningRef.current = true;
    setIsListening(true);

    // Start with initial recognition
    setTimeout(() => captureAudio('Initial recognition'), 1000);

    // Start monitoring loop
    monitoringIntervalRef.current = window.setInterval(runMonitoring, 250);
  }, [musicLevel, silenceLevel, silenceThreshold, captureAudio, runMonitoring]);

  const stopMonitoring = useCallback(() => {
    console.log('=== STOPPING MONITORING ===');
    isRunningRef.current = false;
    setIsListening(false);
    setIsInSilence(false);
    setSilenceCounter(0);
    
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
      monitoringIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setStatus('⏹️ Monitoring stopped');
  }, []);

  // Load existing data
  const loadCurrentTrack = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('now_playing')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (!error && data) setCurrentTrack(data);
    } catch {
      // ignore
    }
  }, []);

  const loadRecentHistory = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('audio_recognition_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) setRecognitionHistory(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadCurrentTrack();
    void loadRecentHistory();
    return stopMonitoring;
  }, [loadCurrentTrack, loadRecentHistory, stopMonitoring]);

  const VUMeter = ({ level }: { level: number }) => {
    const boxes = [];
    for (let i = 0; i < 10; i++) {
      const threshold = (i + 1) * 10; // 0-100 scale, each box is 10%
      const isActive = level >= threshold;
      
      boxes.push(
        <div
          key={i}
          style={{
            width: 30,
            height: 40,
            backgroundColor: isActive ? '#22c55e' : '#f0fdf4',
            border: '2px solid #bbf7d0',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 'bold',
            color: isActive ? 'white' : '#6b7280'
          }}
        >
          {threshold}
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', gap: 4, alignItems: 'end' }}>
        {boxes}
      </div>
    );
  };

  return (
    <div style={{ padding: 24, background: '#fff', color: '#222', minHeight: '100vh', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 8 }}>🎵 Audio Recognition Control</h1>
        <p style={{ color: '#666', fontSize: 16 }}>Simple, working audio monitoring system</p>
      </div>

      {/* Microphone Setup */}
      {!audioContextRef.current && (
        <div style={{ background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, color: '#92400e' }}>
            Step 1: Enable Microphone
          </h2>
          <button
            onClick={setupMicrophone}
            style={{
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '12px 24px',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            🎙️ Enable Microphone
          </button>
        </div>
      )}

      {/* Manual Controls */}
      {audioContextRef.current && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Controls</h2>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Current Level:</span>
            <VUMeter level={currentLevel} />
            <span style={{ fontSize: 24, fontWeight: 'bold', color: '#16a34a' }}>
              {currentLevel}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                Music Level (75-85dB range):
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={musicLevel}
                onChange={(e) => setMusicLevel(parseInt(e.target.value) || 50)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '2px solid #16a34a',
                  borderRadius: 6,
                  fontSize: 16,
                  fontWeight: 600,
                  textAlign: 'center'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                Silence Level (ambient noise):
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={silenceLevel}
                onChange={(e) => setSilenceLevel(parseInt(e.target.value) || 10)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '2px solid #dc2626',
                  borderRadius: 6,
                  fontSize: 16,
                  fontWeight: 600,
                  textAlign: 'center'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                Silence Duration (seconds):
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={silenceThreshold}
                onChange={(e) => setSilenceThreshold(parseInt(e.target.value) || 3)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '2px solid #7c3aed',
                  borderRadius: 6,
                  fontSize: 16,
                  fontWeight: 600,
                  textAlign: 'center'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <button
              onClick={isListening ? stopMonitoring : startMonitoring}
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
              {isListening ? '⏹️ Stop Monitoring' : '▶️ Start Monitoring'}
            </button>

            <button
              onClick={() => captureAudio('Manual trigger')}
              disabled={isProcessing || !audioContextRef.current}
              style={{
                background: '#7c3aed',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 600,
                cursor: (isProcessing || !audioContextRef.current) ? 'not-allowed' : 'pointer',
                opacity: (isProcessing || !audioContextRef.current) ? 0.6 : 1
              }}
            >
              🎙️ Recognize Now
            </button>

            <a href="/tv-display" target="_blank" rel="noopener noreferrer" style={{ 
              background: '#2563eb', 
              color: 'white', 
              padding: '12px 24px', 
              borderRadius: 8, 
              textDecoration: 'none', 
              fontSize: 16, 
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center'
            }}>
              📺 TV Display
            </a>
          </div>

          <div style={{ 
            fontSize: 14, 
            fontWeight: 600, 
            padding: '12px 16px', 
            background: isProcessing ? '#fef3c7' : isListening ? '#f0fdf4' : '#f9fafb', 
            color: isProcessing ? '#ea580c' : isListening ? '#16a34a' : '#6b7280',
            borderRadius: 8,
            border: `2px solid ${isProcessing ? '#f59e0b' : isListening ? '#bbf7d0' : '#e5e7eb'}`
          }}>
            {status}
          </div>

          {/* Debug Console */}
          {debugInfo.length > 0 && (
            <div style={{ 
              marginTop: 16,
              background: '#1f2937', 
              color: '#f9fafb', 
              padding: 16, 
              borderRadius: 8, 
              fontFamily: 'monospace', 
              fontSize: 12,
              border: '2px solid #374151'
            }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: '#10b981' }}>🖥️ Debug Console:</div>
              {debugInfo.map((info, i) => (
                <div key={i} style={{ marginBottom: 2, color: '#e5e7eb' }}>{info}</div>
              ))}
            </div>
          )}

          {isInSilence && (
            <div style={{ 
              marginTop: 16, 
              fontSize: 16, 
              color: '#7c3aed', 
              background: '#faf5ff', 
              border: '2px solid #d8b4fe', 
              padding: '12px 16px', 
              borderRadius: 8, 
              fontWeight: 600 
            }}>
              🔇 Silence detected: {silenceCounter}s / {silenceThreshold}s
            </div>
          )}
        </div>
      )}

      {/* Current Track */}
      {currentTrack && (
        <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', color: 'white', borderRadius: 16, padding: 32, marginBottom: 32, display: 'flex', alignItems: 'center', gap: 24 }}>
          {currentTrack.recognition_image_url && (
            <Image src={currentTrack.recognition_image_url} alt="Album artwork" width={120} height={120} style={{ borderRadius: 12, objectFit: 'cover' }} unoptimized />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>{currentTrack.title}</div>
            <div style={{ fontSize: 18, opacity: 0.9, marginBottom: 4 }}>{currentTrack.artist}</div>
            {currentTrack.album_title && (<div style={{ fontSize: 16, opacity: 0.7, marginBottom: 8 }}>{currentTrack.album_title}</div>)}
            <div style={{ fontSize: 14, opacity: 0.8 }}>
              Confidence: {Math.round(currentTrack.recognition_confidence * 100)}% • Started: {new Date(currentTrack.started_at).toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}

      {/* Recognition History */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ background: '#f9fafb', padding: '16px 24px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 16 }}>
          Recent Recognition History
        </div>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {recognitionHistory.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>No recognition history yet.</div>
          ) : (
            recognitionHistory.map((track, i) => (
              <div key={track.id || i} style={{ padding: '16px 24px', borderBottom: i < recognitionHistory.length - 1 ? '1px solid #f3f4f6' : 'none', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{track.artist || 'Unknown Artist'} - {track.title || 'Unknown Title'}</div>
                  {track.album && (<div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>{track.album}</div>)}
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{Math.round((track.confidence || 0) * 100)}% confidence • {track.service || 'unknown'}</div>
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{track.created_at ? new Date(track.created_at).toLocaleString() : 'Unknown time'}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}