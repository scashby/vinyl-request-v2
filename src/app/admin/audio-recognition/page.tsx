// src/app/admin/audio-recognition/page.tsx - SIMPLIFIED SILENCE DETECTION
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

  // Simple monitoring state
  const [audioLevel, setAudioLevel] = useState(0); // 0-100 scale
  const [isInSilence, setIsInSilence] = useState(false);
  const [silenceDuration, setSilenceDuration] = useState(0);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  // Simple settings
  const [silenceThreshold, setSilenceThreshold] = useState(5); // 0-100 scale, lowered default for RMS
  const [silenceRequiredTime, setSilenceRequiredTime] = useState(3000); // ms
  const [cooldownTime, setCooldownTime] = useState(15000); // ms

  // Refs
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceStartTimeRef = useRef<number | null>(null);
  const lastRecognitionTimeRef = useRef<number>(0);
  const monitoringIntervalRef = useRef<number | null>(null);
  const isRunningRef = useRef<boolean>(false);
  const removeVisibilityHandlerRef = useRef<(() => void) | null>(null);

  const addDebugLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
      console.log(`[${timestamp}] ${message}`);
    }
    setDebugInfo(prev => [`${timestamp}: ${message}`, ...prev.slice(0, 49)]);
  }, []);

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

  const processAudioBuffer = useCallback(async (audioBuffer: AudioBuffer, reason: string) => {
    addDebugLog(`Processing captured audio: ${reason}`);
    try {
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
        addDebugLog(`✅ Recognized: ${result.track.artist} - ${result.track.title}`);
        setStatus(`✅ Recognized (${reason}): ${result.track.artist} - ${result.track.title}`);

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
          currentTrack.artist?.toLowerCase() != result.track.artist?.toLowerCase() ||
          currentTrack.title?.toLowerCase() != result.track.title?.toLowerCase();

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
          } catch (dbError: unknown) {
            const msg = dbError instanceof Error ? dbError.message : String(dbError);
            addDebugLog(`❌ Database error: ${msg}`);
          }
        } else {
          addDebugLog(`🔄 Same track confirmed (no DB update)`);
        }
      } else {
        addDebugLog(`❌ No match found: ${result.error || 'Unknown error'}`);
        setStatus(`❌ ${result.error || 'No match found'}`);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      addDebugLog(`❌ Processing error: ${msg}`);
      setStatus(`❌ Processing error: ${msg}`);
    } finally {
      lastRecognitionTimeRef.current = Date.now();
      setIsProcessing(false);
    }
  }, [addDebugLog, convertAudioBufferToRawPCM, currentTrack]);

  const triggerRecognition = useCallback(async (reason: string) => {
    if (isProcessing || !audioContextRef.current || !streamRef.current) {
      addDebugLog(`❌ Recognition blocked (processing=${isProcessing} ctx=${!!audioContextRef.current} stream=${!!streamRef.current})`);
      return;
    }
    addDebugLog(`🎵 TRIGGERING RECOGNITION: ${reason}`);
    setIsProcessing(true);
    setStatus(`🎤 Capturing audio for ${reason}...`);

    try {
      const AudioContextClass = window.AudioContext || (window as WindowWithWebkitAudioContext).webkitAudioContext;
      const captureContext = new AudioContextClass({ sampleRate: 44100 });
      await captureContext.resume().catch(() => {});

      const source = captureContext.createMediaStreamSource(streamRef.current);
      const processor = captureContext.createScriptProcessor(4096, 1, 1);
      const bufferSize = 3 * captureContext.sampleRate;
      const audioBuffer = captureContext.createBuffer(1, bufferSize, captureContext.sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      let sampleIndex = 0;

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        const input = e.inputBuffer.getChannelData(0);
        const n = Math.min(input.length, bufferSize - sampleIndex);
        channelData.set(input.subarray(0, n), sampleIndex);
        sampleIndex += n;

        if (sampleIndex >= bufferSize) {
          try {
            processor.disconnect();
            source.disconnect();
          } catch {}
          addDebugLog(`📊 Captured ${sampleIndex} samples -> processing`);
          processAudioBuffer(audioBuffer, reason).finally(() => {
            captureContext.close();
          });
        }
      };

      source.connect(processor);
      processor.connect(captureContext.destination);

      window.setTimeout(() => {
        if (sampleIndex < bufferSize / 2) {
          addDebugLog(`⚠️ Timeout: only ${sampleIndex}/${bufferSize} samples`);
          try { processor.disconnect(); source.disconnect(); } catch {}
          captureContext.close();
          setIsProcessing(false);
          setStatus('❌ Not enough audio captured (timeout)');
        }
      }, 5000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      addDebugLog(`❌ Recognition error: ${msg}`);
      setStatus(`❌ Recognition failed: ${msg}`);
      setIsProcessing(false);
    }
  }, [addDebugLog, isProcessing, processAudioBuffer]);

  // Simple monitoring loop - just check if we're in silence or not
  const runMonitoringLoop = useCallback(() => {
    if (!isRunningRef.current || !analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    
    // Use time-domain data for accurate volume detection
    analyser.getByteTimeDomainData(dataArray);
    
    // MUCH SIMPLER: Just measure how much the audio varies from silence (128)
    // Calculate the average deviation from the center point
    let totalDeviation = 0;
    for (let i = 0; i < bufferLength; i++) {
      totalDeviation += Math.abs(dataArray[i] - 128);
    }
    const avgDeviation = totalDeviation / bufferLength;
    
    // Scale aggressively for real-world audio levels
    // Typical audio might only deviate 1-10 points from 128, so multiply by 10-20
    let scaledLevel = Math.round(avgDeviation * 15); // Much more aggressive scaling
    
    // Cap at 100%
    scaledLevel = Math.min(scaledLevel, 100);
    
    setAudioLevel(scaledLevel);

    // Debug: Log simpler, clearer info
    if (Math.random() < 0.02) { // Log ~2% of the time
      const minVal = Math.min(...dataArray);
      const maxVal = Math.max(...dataArray);
      addDebugLog(`📊 Raw audio: min=${minVal} max=${maxVal} | Avg deviation from 128: ${avgDeviation.toFixed(2)} | Scaled level: ${scaledLevel}%`);
    }

    const now = Date.now();
    const timeSinceLast = now - lastRecognitionTimeRef.current;

    // Check if we're in cooldown period
    if (timeSinceLast < cooldownTime) {
      const remain = Math.ceil((cooldownTime - timeSinceLast) / 1000);
      setStatus(`⏱️ Cooldown: ${remain}s (level: ${scaledLevel}%)`);
      setIsInSilence(false);
      setSilenceDuration(0);
      silenceStartTimeRef.current = null;
      return;
    }

    // Simple silence detection
    const currentlyInSilence = scaledLevel < silenceThreshold;

    if (currentlyInSilence && !isInSilence) {
      // Just entered silence
      setIsInSilence(true);
      silenceStartTimeRef.current = now;
      setSilenceDuration(0);
      addDebugLog(`🔇 Entered silence (level ${scaledLevel}% < threshold ${silenceThreshold}%)`);
      setStatus(`🔇 Silence detected...`);
    } else if (!currentlyInSilence && isInSilence) {
      // Just exited silence
      setIsInSilence(false);
      silenceStartTimeRef.current = null;
      setSilenceDuration(0);
      addDebugLog(`🔊 Exited silence (level ${scaledLevel}% >= threshold ${silenceThreshold}%)`);
      setStatus(`🎧 Audio detected (level: ${scaledLevel}%)`);
    } else if (currentlyInSilence && isInSilence) {
      // Still in silence - check duration
      const elapsed = now - (silenceStartTimeRef.current || now);
      setSilenceDuration(elapsed);

      const remain = Math.max(0, silenceRequiredTime - elapsed);
      setStatus(`🔇 Silence ${Math.floor(elapsed/1000)}s / ${Math.floor(silenceRequiredTime/1000)}s (${Math.ceil(remain/1000)}s remaining)`);

      if (elapsed >= silenceRequiredTime) {
        addDebugLog(`🎯 Silence duration reached -> trigger recognition`);
        setIsInSilence(false);
        silenceStartTimeRef.current = null;
        setSilenceDuration(0);

        if (!isProcessing) {
          triggerRecognition('Silence detection');
        } else {
          addDebugLog(`⚠️ Recognition already running; skip`);
        }
      }
    } else {
      // Not in silence
      setStatus(`🎧 Audio level: ${scaledLevel}% (threshold: ${silenceThreshold}%)`);
    }
  }, [addDebugLog, cooldownTime, isInSilence, isProcessing, silenceRequiredTime, silenceThreshold, triggerRecognition]);

  const startListening = useCallback(async () => {
    addDebugLog('🎤 Starting audio recognition system...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      });
      addDebugLog('✅ Microphone access granted');

      const AudioContextClass = window.AudioContext || (window as WindowWithWebkitAudioContext).webkitAudioContext;
      const audioContext = new AudioContextClass({ sampleRate: 44100 });
      await audioContext.resume().catch(() => {});

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3; // Smooth out the levels
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      isRunningRef.current = true;

      setIsListening(true);
      setDebugInfo([]);
      setStatus('🎤 System started - listening for silence...');

      const onVisibility = () => {
        if (document.visibilityState === 'visible') {
          audioContext.resume().catch(() => {});
        }
      };
      document.addEventListener('visibilitychange', onVisibility, { passive: true });
      removeVisibilityHandlerRef.current = () => {
        document.removeEventListener('visibilitychange', onVisibility);
      };

      // Start monitoring immediately
      addDebugLog('📊 Starting simple silence monitoring...');
      monitoringIntervalRef.current = window.setInterval(runMonitoringLoop, 200); // Check every 200ms

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      addDebugLog(`❌ Microphone error: ${msg}`);
      setStatus(`❌ Microphone access failed: ${msg}`);
    }
  }, [addDebugLog, runMonitoringLoop]);

  const stopListening = useCallback(() => {
    addDebugLog('🛑 Stopping audio recognition system');
    isRunningRef.current = false;
    if (monitoringIntervalRef.current !== null) {
      window.clearInterval(monitoringIntervalRef.current);
      monitoringIntervalRef.current = null;
    }
    if (removeVisibilityHandlerRef.current) {
      removeVisibilityHandlerRef.current();
      removeVisibilityHandlerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      addDebugLog('🔇 Audio tracks stopped');
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close();
      audioContextRef.current = null;
      addDebugLog('🔇 Audio context closed');
    }
    analyserRef.current = null;
    setIsListening(false);
    setIsProcessing(false);
    setIsInSilence(false);
    setSilenceDuration(0);
    setAudioLevel(0);
    setStatus('🛑 Stopped listening');
  }, [addDebugLog]);

  const clearCurrentTrack = useCallback(async () => {
    try {
      await supabase.from('now_playing').delete().neq('id', 0);
      setCurrentTrack(null);
      setStatus('🗑️ Cleared current track');
      addDebugLog('🗑️ Current track cleared');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      addDebugLog(`❌ Error clearing track: ${msg}`);
    }
  }, [addDebugLog]);

  const loadCurrentTrack = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('now_playing')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (!error && data) setCurrentTrack(data);
      else setCurrentTrack(null);
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

  const formatTime = useCallback((seconds: number) => {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  }, []);

  // Create 10-box VU meter component
  const VUMeter = ({ level }: { level: number }) => {
    const boxes = [];
    for (let i = 0; i < 10; i++) {
      const threshold = (i + 1) * 10; // 10%, 20%, 30%, etc.
      const isActive = level >= threshold;
      const isSilence = i < 2; // First two boxes are silence indicators
      
      boxes.push(
        <div
          key={i}
          style={{
            width: 20,
            height: 40,
            backgroundColor: isActive 
              ? (isSilence ? '#ef4444' : '#22c55e') 
              : (isSilence ? '#fee2e2' : '#f0fdf4'),
            border: `1px solid ${isSilence ? '#fca5a5' : '#bbf7d0'}`,
            borderRadius: 2,
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
      <div style={{ display: 'flex', gap: 2, alignItems: 'end' }}>
        {boxes}
      </div>
    );
  };

  useEffect(() => {
    void loadCurrentTrack();
    void loadRecentHistory();
    return () => { stopListening(); };
  }, [loadCurrentTrack, loadRecentHistory, stopListening]);

  return (
    <div style={{ padding: 24, background: '#fff', color: '#222', minHeight: '100vh', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 8 }}>🎵 Audio Recognition Control</h1>
        <p style={{ color: '#666', fontSize: 16 }}>Simple silence detection with mixer-style VU meter</p>
      </div>

      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={isProcessing}
            style={{ background: isListening ? '#dc2626' : '#16a34a', color: 'white', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 16, fontWeight: 600, cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.6 : 1 }}>
            {isListening ? '🛑 Stop Listening' : '🎤 Start Listening'}
          </button>

          {/* Manual trigger button for testing */}
          {isListening && (
            <button
              onClick={() => triggerRecognition('Manual trigger')}
              disabled={isProcessing}
              style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 16, fontWeight: 600, cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.6 : 1 }}>
              {isProcessing ? '🎤 Processing...' : '🎯 Trigger Now'}
            </button>
          )}

          {currentTrack && (
            <button onClick={clearCurrentTrack} style={{ background: '#6b7280', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 14, cursor: 'pointer' }}>
              🗑️ Clear Current Track
            </button>
          )}

          <a href="/tv-display" target="_blank" rel="noopener noreferrer" style={{ background: '#2563eb', color: 'white', padding: '8px 16px', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
            📺 Open TV Display
          </a>
        </div>

        <div style={{ fontSize: 14, color: isProcessing ? '#ea580c' : isListening ? '#16a34a' : '#6b7280', marginBottom: 16, fontWeight: 600, padding: '8px 12px', background: isProcessing ? '#fef3c7' : isListening ? '#f0fdf4' : '#f9fafb', borderRadius: 6, border: `1px solid ${isProcessing ? '#f59e0b' : isListening ? '#22c55e' : '#e5e7eb'}` }}>
          {status}
        </div>

        {isListening && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#374151', minWidth: 80 }}>Audio Level:</span>
              <VUMeter level={audioLevel} />
              <div style={{ 
                fontSize: 24, 
                fontWeight: 'bold', 
                minWidth: 60,
                color: audioLevel < silenceThreshold ? '#dc2626' : '#16a34a' 
              }}>
                {audioLevel}%
              </div>
              <div style={{ 
                fontSize: 12, 
                fontWeight: 700, 
                color: audioLevel < silenceThreshold ? '#dc2626' : '#16a34a',
                padding: '4px 12px', 
                borderRadius: 4, 
                background: audioLevel < silenceThreshold ? '#fef2f2' : '#f0fdf4',
                border: `2px solid ${audioLevel < silenceThreshold ? '#fca5a5' : '#bbf7d0'}`
              }}>
                {audioLevel < silenceThreshold ? '🔇 SILENCE' : '🔊 AUDIO'}
              </div>
            </div>

            {isInSilence && (
              <div style={{ fontSize: 14, color: '#7c3aed', background: 'linear-gradient(90deg, #faf5ff, #f3e8ff)', border: '2px solid #d8b4fe', padding: '8px 12px', borderRadius: 8, display: 'inline-block', fontWeight: 600 }}>
                🔇 Silence Duration: {formatTime(Math.floor(silenceDuration / 1000))} / {formatTime(Math.floor(silenceRequiredTime / 1000))}
                {silenceDuration >= silenceRequiredTime * 0.8 && (<span style={{ color: '#dc2626', marginLeft: 8 }}>⚡ ALMOST TRIGGERING!</span>)}
              </div>
            )}
          </div>
        )}

        <div style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, padding: 16 }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#374151' }}>⚙️ Simple Settings</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#374151' }}>
                Silence Threshold: {silenceThreshold}%
              </label>
              <input 
                type="range" 
                min="5" 
                max="50" 
                value={silenceThreshold} 
                onChange={(e) => setSilenceThreshold(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                Audio below this level = silence
              </div>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#374151' }}>
                Silence Required: {formatTime(Math.floor(silenceRequiredTime / 1000))}
              </label>
              <input 
                type="range" 
                min="2000" 
                max="10000" 
                step="500"
                value={silenceRequiredTime} 
                onChange={(e) => setSilenceRequiredTime(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                How long to wait before triggering
              </div>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#374151' }}>
                Cooldown: {formatTime(Math.floor(cooldownTime / 1000))}
              </label>
              <input 
                type="range" 
                min="10000" 
                max="30000" 
                step="1000"
                value={cooldownTime} 
                onChange={(e) => setCooldownTime(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                Wait time between recognitions
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, padding: 12, background: '#f0fdf4', border: '1px solid #22c55e', borderRadius: 8, fontSize: 12, color: '#15803d' }}>
          <strong>📊 VU METER GUIDE:</strong> First 2 boxes (red) = silence detection zone. Remaining 8 boxes (green) = audio levels. 
          Adjust the silence threshold slider to set when recognition should trigger.<br/>
          <strong>🎯 MANUAL TRIGGER:</strong> Use the &quot;Trigger Now&quot; button to test recognition while debugging audio detection.
        </div>
      </div>

      {debugInfo.length > 0 && (
        <div style={{ background: '#000', color: '#fff', borderRadius: 12, padding: 20, marginBottom: 32, maxHeight: 300, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 12, color: '#22c55e', borderBottom: '1px solid #333', paddingBottom: 8 }}>
            🔍 Debug Log (Last 50 entries)
          </div>
          {debugInfo.map((log, idx) => (
            <div key={idx} style={{ marginBottom: 4, color: log.includes('❌') ? '#ef4444' : log.includes('✅') ? '#22c55e' : log.includes('🎯') || log.includes('🔇') || log.includes('🔊') ? '#fbbf24' : '#d1d5db' }}>
              {log}
            </div>
          ))}
        </div>
      )}

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
              Confidence: {Math.round(currentTrack.recognition_confidence * 100)}% • Source: {currentTrack.service_used} • Started: {new Date(currentTrack.started_at).toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ background: '#f9fafb', padding: '16px 24px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 16 }}>
          📋 Recent Recognition History
        </div>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {recognitionHistory.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>No recognition history yet. Start listening to see results.</div>
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