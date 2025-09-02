// src/app/admin/audio-recognition/page.tsx - ADAPTIVE SILENCE + HYSTERESIS + RELIABLE TRIGGERS (v3, ESLint-clean)
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
  absoluteFloor: number;
  silenceDuration: number;
  postRecognitionCooldown: number;
  emaAlpha: number;
  enterFactor: number;
  exitFactor: number;
  spikeToleranceMs: number;
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

  // Monitoring state
  const [audioLevel, setAudioLevel] = useState(0);
  const [rawAudioLevel, setRawAudioLevel] = useState(0);
  const [isInSilence, setIsInSilence] = useState(false);
  const [silenceDuration, setSilenceDuration] = useState(0);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [baselineRMS, setBaselineRMS] = useState(0);

  const [config, setConfig] = useState<SilenceConfig>({
    absoluteFloor: 0.004,
    silenceDuration: 2500,
    postRecognitionCooldown: 12000,
    emaAlpha: 0.05,
    enterFactor: 0.35,
    exitFactor: 0.60,
    spikeToleranceMs: 250
  });

  // Refs
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceStartTimeRef = useRef<number | null>(null);
  const lastRecognitionTimeRef = useRef<number>(0);
  const monitoringIntervalRef = useRef<number | null>(null); // browser setInterval id
  const isRunningRef = useRef<boolean>(false);
  const lastSpikeTimeRef = useRef<number | null>(null);
  const removeVisibilityHandlerRef = useRef<(() => void) | null>(null);

  const addDebugLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
      // Safe dev-only logging
      console.log(`[${timestamp}] ${message}`);
    }
    setDebugInfo(prev => [`${timestamp}: ${message}`, ...prev.slice(0, 49)]);
  }, []);

  const convertAudioBufferToRawPCM = useCallback(async (audioBuffer: AudioBuffer): Promise<ArrayBuffer> => {
    // mono, max 3s
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
      // cooldown starts when recognition finishes, not when it starts
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

      // Safety timeout
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

  // Adaptive monitoring loop
  const runMonitoringLoop = useCallback(() => {
    if (!isRunningRef.current || !analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    // RMS of time-domain (0..255 around 128)
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / bufferLength);

    // update visible meters
    setRawAudioLevel(rms);
    setAudioLevel(rms * 100);

    // Update EMA baseline (avoid learning during silence windows)
    setBaselineRMS(prev => {
      const target = rms;
      return prev ? (prev + config.emaAlpha * (target - prev)) : target;
    });

    const now = Date.now();
    const timeSinceLast = now - lastRecognitionTimeRef.current;

    // Cooldown window
    if (timeSinceLast < config.postRecognitionCooldown) {
      const remain = Math.ceil((config.postRecognitionCooldown - timeSinceLast) / 1000);
      setStatus(`⏱️ Cooldown: ${remain}s (level: ${(rms*100).toFixed(1)})`);
      // reset silence state
      setIsInSilence(false);
      setSilenceDuration(0);
      silenceStartTimeRef.current = null;
      lastSpikeTimeRef.current = null;
      return;
    }

    // adaptive thresholds (hysteresis)
    const dynamicFloor = Math.max(config.absoluteFloor, baselineRMS * config.enterFactor);
    const dynamicExit  = Math.max(config.absoluteFloor, baselineRMS * config.exitFactor);

    // treat micro-spikes during silence window as tolerable if brief
    if (isInSilence) {
      if (rms > dynamicExit) {
        // spike: if within tolerance, don't exit silence immediately
        if (!lastSpikeTimeRef.current) lastSpikeTimeRef.current = now;
        const spikeAge = now - (lastSpikeTimeRef.current || now);
        if (spikeAge <= config.spikeToleranceMs) {
          // tolerate brief spike
        } else {
          // sustained audio -> exit silence
          addDebugLog(`🔊 Exit silence (rms ${(rms*100).toFixed(2)} > exit ${(dynamicExit*100).toFixed(2)})`);
          setIsInSilence(false);
          silenceStartTimeRef.current = null;
          setSilenceDuration(0);
          lastSpikeTimeRef.current = null;
        }
      } else {
        lastSpikeTimeRef.current = null; // no spike
      }
    }

    if (!isInSilence) {
      if (rms < dynamicFloor) {
        setIsInSilence(true);
        silenceStartTimeRef.current = now;
        setSilenceDuration(0);
        addDebugLog(`🔇 Enter silence (rms ${(rms*100).toFixed(2)} < floor ${(dynamicFloor*100).toFixed(2)}; baseline ${(baselineRMS*100).toFixed(2)})`);
        setStatus(`🔇 Silence...`);
      } else {
        setStatus(`🎧 Audio ${(rms*100).toFixed(1)}; baseline ${(baselineRMS*100).toFixed(1)} — waiting for drop`);
      }
    } else {
      const elapsed = now - (silenceStartTimeRef.current || now);
      setSilenceDuration(elapsed);

      let effectiveElapsed = elapsed;
      if (lastSpikeTimeRef.current) {
        const sinceSpike = now - lastSpikeTimeRef.current;
        if (sinceSpike <= config.spikeToleranceMs) {
          effectiveElapsed = Math.max(0, effectiveElapsed - config.spikeToleranceMs);
        } else {
          lastSpikeTimeRef.current = null;
        }
      }

      const remain = Math.max(0, config.silenceDuration - effectiveElapsed);
      setStatus(`🔇 Silence ${Math.floor(effectiveElapsed/1000)}s / ${Math.floor(config.silenceDuration/1000)}s (${Math.ceil(remain/1000)}s)`);

      if (effectiveElapsed >= config.silenceDuration) {
        addDebugLog(`🎯 Silence window reached -> trigger recognition`);
        setIsInSilence(false);
        silenceStartTimeRef.current = null;
        setSilenceDuration(0);
        lastSpikeTimeRef.current = null;

        if (!isProcessing) {
          triggerRecognition('Silence detection');
        } else {
          addDebugLog(`⚠️ Recognition already running; skip`);
        }
      }
    }
  }, [addDebugLog, baselineRMS, config.absoluteFloor, config.emaAlpha, config.enterFactor, config.exitFactor, config.postRecognitionCooldown, config.silenceDuration, config.spikeToleranceMs, isInSilence, isProcessing, triggerRecognition]);

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
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      isRunningRef.current = true;

      setIsListening(true);
      setDebugInfo([]);
      setStatus('🎤 System started - initial recognition...');

      const onVisibility = () => {
        if (document.visibilityState === 'visible') {
          audioContext.resume().catch(() => {});
        }
      };
      document.addEventListener('visibilitychange', onVisibility, { passive: true });
      removeVisibilityHandlerRef.current = () => {
        document.removeEventListener('visibilitychange', onVisibility);
      };

      // kick off immediately
      window.setTimeout(() => triggerRecognition('Initial recognition'), 1000);

      // start monitoring a few seconds later to avoid learning the first capture as "silence"
      window.setTimeout(() => {
        addDebugLog('📊 Starting adaptive silence monitoring loop...');
        monitoringIntervalRef.current = window.setInterval(runMonitoringLoop, 100);
      }, 6000);

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      addDebugLog(`❌ Microphone error: ${msg}`);
      setStatus(`❌ Microphone access failed: ${msg}`);
    }
  }, [addDebugLog, runMonitoringLoop, triggerRecognition]);

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
    setRawAudioLevel(0);
    setBaselineRMS(0);
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

  useEffect(() => {
    void loadCurrentTrack();
    void loadRecentHistory();
    return () => { stopListening(); };
  }, [loadCurrentTrack, loadRecentHistory, stopListening]);

  return (
    <div style={{ padding: 24, background: '#fff', color: '#222', minHeight: '100vh', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 8 }}>🎵 Audio Recognition Control</h1>
        <p style={{ color: '#666', fontSize: 16 }}>Adaptive silence detection (EMA + hysteresis) and safer trigger timing</p>
      </div>

      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={isProcessing}
            style={{ background: isListening ? '#dc2626' : '#16a34a', color: 'white', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 16, fontWeight: 600, cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.6 : 1 }}>
            {isListening ? '🛑 Stop Listening' : '🎤 Start Listening'}
          </button>

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
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#374151', minWidth: 100 }}>Audio Level:</span>
              <div style={{ flex: 1, height: 24, background: '#f3f4f6', borderRadius: 12, overflow: 'hidden', border: '2px solid #e5e7eb', position: 'relative' }}>
                <div style={{ width: `${Math.min(audioLevel * 2, 100)}%`, height: '100%', background: rawAudioLevel < Math.max(config.absoluteFloor, baselineRMS * config.enterFactor) ? 'linear-gradient(90deg, #ef4444, #f87171)' : 'linear-gradient(90deg, #22c55e, #4ade80)', transition: 'width 0.1s ease' }}></div>
                <div title="dynamic enter-floor" style={{ position: 'absolute', left: `${Math.max(config.absoluteFloor, baselineRMS * config.enterFactor) * 200}%`, top: 0, bottom: 0, width: 2, background: '#1f2937', zIndex: 10 }}></div>
                <div title="dynamic exit-thresh" style={{ position: 'absolute', left: `${Math.max(config.absoluteFloor, baselineRMS * config.exitFactor) * 200}%`, top: 0, bottom: 0, width: 2, background: '#6b7280', zIndex: 10 }}></div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: rawAudioLevel < Math.max(config.absoluteFloor, baselineRMS * config.enterFactor) ? '#dc2626' : '#16a34a', minWidth: 110, textAlign: 'center', padding: '2px 8px', borderRadius: 4, background: rawAudioLevel < Math.max(config.absoluteFloor, baselineRMS * config.enterFactor) ? '#fef2f2' : '#f0fdf4' }}>
                {rawAudioLevel < Math.max(config.absoluteFloor, baselineRMS * config.enterFactor) ? '🔇 SILENCE' : '🔊 AUDIO'}
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
              Raw: {(rawAudioLevel*100).toFixed(3)} | Baseline: {(baselineRMS*100).toFixed(3)} | Enter floor: {(Math.max(config.absoluteFloor, baselineRMS*config.enterFactor)*100).toFixed(2)} | Exit: {(Math.max(config.absoluteFloor, baselineRMS*config.exitFactor)*100).toFixed(2)}
            </div>

            {isInSilence && (
              <div style={{ fontSize: 14, color: '#7c3aed', background: 'linear-gradient(90deg, #faf5ff, #f3e8ff)', border: '2px solid #d8b4fe', padding: '8px 12px', borderRadius: 8, display: 'inline-block', fontWeight: 600 }}>
                🔇 Silence Duration: {formatTime(Math.floor(silenceDuration / 1000))} / {formatTime(Math.floor(config.silenceDuration / 1000))}
                {silenceDuration >= config.silenceDuration * 0.8 && (<span style={{ color: '#dc2626', marginLeft: 8 }}>⚡ ALMOST TRIGGERING!</span>)}
              </div>
            )}
          </div>
        )}

        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>🔧 Silence Detection Settings</summary>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginTop: 16, padding: 16, background: '#f3f4f6', borderRadius: 8 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Absolute Floor: {(config.absoluteFloor * 100).toFixed(3)}</label>
              <input type="range" min="0.001" max="0.02" step="0.001" value={config.absoluteFloor} onChange={(e) => setConfig(prev => ({ ...prev, absoluteFloor: parseFloat(e.target.value) }))} style={{ width: '100%' }}/>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Silence Duration: {formatTime(Math.floor(config.silenceDuration / 1000))}</label>
              <input type="range" min="1500" max="8000" step="250" value={config.silenceDuration} onChange={(e) => setConfig(prev => ({ ...prev, silenceDuration: parseInt(e.target.value, 10) }))} style={{ width: '100%' }}/>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Cooldown: {formatTime(Math.floor(config.postRecognitionCooldown / 1000))}</label>
              <input type="range" min="8000" max="30000" step="1000" value={config.postRecognitionCooldown} onChange={(e) => setConfig(prev => ({ ...prev, postRecognitionCooldown: parseInt(e.target.value, 10) }))} style={{ width: '100%' }}/>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>EMA Alpha: {config.emaAlpha.toFixed(2)}</label>
              <input type="range" min="0.02" max="0.20" step="0.01" value={config.emaAlpha} onChange={(e) => setConfig(prev => ({ ...prev, emaAlpha: parseFloat(e.target.value) }))} style={{ width: '100%' }}/>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Enter Factor: {config.enterFactor.toFixed(2)}</label>
              <input type="range" min="0.20" max="0.90" step="0.05" value={config.enterFactor} onChange={(e) => setConfig(prev => ({ ...prev, enterFactor: parseFloat(e.target.value) }))} style={{ width: '100%' }}/>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Exit Factor: {config.exitFactor.toFixed(2)}</label>
              <input type="range" min="0.30" max="0.95" step="0.05" value={config.exitFactor} onChange={(e) => setConfig(prev => ({ ...prev, exitFactor: parseFloat(e.target.value) }))} style={{ width: '100%' }}/>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Spike Tolerance (ms): {config.spikeToleranceMs} </label>
              <input type="range" min="0" max="750" step="50" value={config.spikeToleranceMs} onChange={(e) => setConfig(prev => ({ ...prev, spikeToleranceMs: parseInt(e.target.value, 10) }))} style={{ width: '100%' }}/>
            </div>
          </div>
        </details>

        <div style={{ marginTop: 12, padding: 12, background: '#f0fdf4', border: '1px solid #22c55e', borderRadius: 8, fontSize: 12, color: '#15803d' }}>
          <strong>📊 VISUAL GUIDE:</strong>
          🔴 RED = below dynamic floor (likely silence) • 🟢 GREEN = above • Black line = enter-floor • Gray line = exit (hysteresis)
        </div>
      </div>

      {debugInfo.length > 0 && (
        <div style={{ background: '#000', color: '#fff', borderRadius: 12, padding: 20, marginBottom: 32, maxHeight: 300, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 12, color: '#22c55e', borderBottom: '1px solid #333', paddingBottom: 8 }}>
            🔍 Debug Log (Last 50 entries)
          </div>
          {debugInfo.map((log, idx) => (
            <div key={idx} style={{ marginBottom: 4, color: log.includes('❌') ? '#ef4444' : log.includes('✅') ? '#22c55e' : log.includes('🎯') || log.includes('🔇') || log.includes('🔊') ? '#fbbf24' : log.includes('🆕') ? '#a78bfa' : '#d1d5db' }}>
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