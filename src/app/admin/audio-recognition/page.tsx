// src/app/admin/audio-recognition/page.tsx - WITH API CONSERVATION
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
  const [musicLevel, setMusicLevel] = useState(50);
  const [silenceLevel, setSilenceLevel] = useState(10);
  const [silenceThreshold, setSilenceThreshold] = useState(3);
  const [isInSilence, setIsInSilence] = useState(false);
  const [silenceCounter, setSilenceCounter] = useState(0);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [activityLog, setActivityLog] = useState<Array<{
    timestamp: string;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
  }>>([]);
  const [backgroundNoiseProfile, setBackgroundNoiseProfile] = useState<number | null>(null);
  const [isCalibratingBackground, setIsCalibratingBackground] = useState(false);
  const [debugUpdateInterval, setDebugUpdateInterval] = useState<number | null>(null);
  
  // NEW: API Conservation Features
  const [lastRecognitionTime, setLastRecognitionTime] = useState<number>(0);
  const [recognitionCooldown, setRecognitionCooldown] = useState<number>(180); // 3 minutes default
  const [lastRecognizedTrack, setLastRecognizedTrack] = useState<string | null>(null);
  const [apiCallsToday, setApiCallsToday] = useState<number>(0);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const isRunningRef = useRef<boolean>(false);
  const monitoringIntervalRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number>(0);

  const addLogEntry = useCallback((message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setActivityLog(prev => [{
      timestamp,
      message,
      type
    }, ...prev.slice(0, 99)]);
  }, []);

  const calibrateBackgroundNoise = useCallback(async () => {
    if (!analyserRef.current) {
      addLogEntry('Cannot calibrate - microphone not active', 'error');
      return;
    }

    setIsCalibratingBackground(true);
    addLogEntry('Starting background noise calibration - keep room quiet for 5 seconds', 'info');
    
    const samples: number[] = [];
    const sampleInterval = setInterval(() => {
      if (!analyserRef.current) return;
      
      const analyser = analyserRef.current;
      const bufferLength = analyser.fftSize;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteTimeDomainData(dataArray);
      
      let sumSquares = 0;
      for (let i = 0; i < bufferLength; i++) {
        const sample = (dataArray[i] - 128) / 128;
        sumSquares += sample * sample;
      }
      const rms = Math.sqrt(sumSquares / bufferLength);
      const decibels = 20 * Math.log10(rms + 0.0001);
      
      const minDB = -50;
      const maxDB = -20;
      const rawLevel = Math.max(0, Math.min(100, ((decibels - minDB) / (maxDB - minDB)) * 100));
      
      let calibratedLevel;
      if (rawLevel <= 9) {
        calibratedLevel = 35 + ((rawLevel - 6) / 6) * 5;
      } else if (rawLevel <= 18) {
        calibratedLevel = 40 + ((rawLevel - 9) / 9) * 10;
      } else if (rawLevel <= 56) {
        calibratedLevel = 50 + ((rawLevel - 18) / 38) * 25;
      } else {
        calibratedLevel = 75 + ((rawLevel - 56) / 44) * 25;
      }
      
      samples.push(Math.max(0, Math.min(100, calibratedLevel)));
    }, 100);

    setTimeout(() => {
      clearInterval(sampleInterval);
      
      if (samples.length > 0) {
        const average = samples.reduce((sum, level) => sum + level, 0) / samples.length;
        const backgroundProfile = Math.round(average + 5);
        
        setBackgroundNoiseProfile(backgroundProfile);
        addLogEntry(`Background noise profile set to ${backgroundProfile}dB (avg: ${Math.round(average)}dB + 5dB buffer)`, 'success');
        
        const newSilenceLevel = backgroundProfile + 10;
        const newMusicLevel = backgroundProfile + 25;
        
        setSilenceLevel(newSilenceLevel);
        setMusicLevel(newMusicLevel);
        addLogEntry(`Levels auto-adjusted - Silence: ${newSilenceLevel}dB, Music: ${newMusicLevel}dB`, 'info');
      } else {
        addLogEntry('Background calibration failed - no samples collected', 'error');
      }
      
      setIsCalibratingBackground(false);
    }, 5000);
  }, [addLogEntry]);

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

  const getCurrentAudioLevel = useCallback((): number => {
    if (!analyserRef.current) return 0;
    
    const analyser = analyserRef.current;
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);
    
    let sumSquares = 0;
    for (let i = 0; i < bufferLength; i++) {
      const sample = (dataArray[i] - 128) / 128;
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / bufferLength);
    const decibels = 20 * Math.log10(rms + 0.0001);
    
    const minDB = -50;
    const maxDB = -20;
    const rawLevel = Math.max(0, Math.min(100, ((decibels - minDB) / (maxDB - minDB)) * 100));
    
    let calibratedLevel;
    if (rawLevel <= 9) {
      calibratedLevel = 35 + ((rawLevel - 6) / 6) * 5;
    } else if (rawLevel <= 18) {
      calibratedLevel = 40 + ((rawLevel - 9) / 9) * 10;
    } else if (rawLevel <= 56) {
      calibratedLevel = 50 + ((rawLevel - 18) / 38) * 25;
    } else {
      calibratedLevel = 75 + ((rawLevel - 56) / 44) * 25;
    }
    
    const clampedLevel = Math.max(0, Math.min(100, calibratedLevel));
    
    // Calculate cooldown info
    const now = Date.now();
    const timeSinceLastRecognition = (now - lastRecognitionTime) / 1000;
    const cooldownRemaining = Math.max(0, recognitionCooldown - timeSinceLastRecognition);
    const canRecognize = cooldownRemaining === 0;
    
    setDebugInfo([
      `Raw level: ${Math.round(rawLevel)}`,
      `Calibrated dB: ${Math.round(clampedLevel)}`,
      `Music threshold: ${musicLevel}`,
      `Silence threshold: ${silenceLevel}`,
      `Above music? ${clampedLevel > musicLevel}`,
      `Below silence? ${clampedLevel < silenceLevel}`,
      `Is in silence: ${isInSilence}`,
      `Silence counter: ${silenceCounter}s`,
      `API cooldown: ${canRecognize ? 'READY' : `${Math.ceil(cooldownRemaining)}s left`}`,
      `Last track: ${lastRecognizedTrack ? 'Detected' : 'None'}`,
      `API calls today: ${apiCallsToday}`
    ]);
    
    return Math.round(clampedLevel);
  }, [musicLevel, silenceLevel, isInSilence, silenceCounter, lastRecognitionTime, recognitionCooldown, lastRecognizedTrack, apiCallsToday]);

  const processAudioBuffer = useCallback(async (audioBuffer: AudioBuffer, reason: string) => {
    try {
      // Check cooldown period
      const now = Date.now();
      const timeSinceLastRecognition = (now - lastRecognitionTime) / 1000;
      
      if (timeSinceLastRecognition < recognitionCooldown) {
        const remainingCooldown = Math.ceil(recognitionCooldown - timeSinceLastRecognition);
        addLogEntry(`🛡️ API Protection: Cooldown active (${remainingCooldown}s remaining)`, 'warning');
        setStatus(`API Cooldown: ${remainingCooldown}s remaining - prevents duplicate API calls`);
        return;
      }

      setStatus(`Processing audio for ${reason}...`);
      addLogEntry(`🔍 Processing audio for: ${reason} (last API call: ${Math.round(timeSinceLastRecognition)}s ago)`, 'info');
      
      // Update last recognition time immediately to prevent overlapping calls
      setLastRecognitionTime(now);
      setApiCallsToday(prev => prev + 1);
      
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
        const trackKey = `${result.track.artist?.toLowerCase()}-${result.track.title?.toLowerCase()}`;
        
        // Check if this is the same track as last recognition
        if (lastRecognizedTrack === trackKey) {
          addLogEntry(`🔄 Duplicate track detected: ${result.track.artist} - ${result.track.title} (skipping database update)`, 'warning');
          setStatus(`Same track still playing: ${result.track.artist} - ${result.track.title}`);
          return;
        }
        
        // Set the new track as last recognized
        setLastRecognizedTrack(trackKey);
        
        const albumText = result.track.album ? ` (${result.track.album})` : '';
        addLogEntry(`🎵 NEW track recognized: ${result.track.artist} - ${result.track.title}${albumText}`, 'success');
        setStatus(`Recognized: ${result.track.artist} - ${result.track.title}${albumText}`);
        
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

        // Always update database for new tracks
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
          
          addLogEntry(`💾 Database updated with new track and album info: ${result.track.album || 'No album'}`, 'success');
        } catch (dbError) {
          console.error('Database error:', dbError);
          addLogEntry(`❌ Database error: ${dbError}`, 'error');
        }
      } else {
        addLogEntry(`❌ No match found: ${result.error || 'Unknown error'}`, 'warning');
        setStatus(`No match found`);
        // Don't reset lastRecognitionTime on failed recognition to maintain cooldown
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      addLogEntry(`❌ Processing error: ${msg}`, 'error');
      setStatus(`Error: ${msg}`);
      // Reset lastRecognitionTime on error so we can try again sooner
      setLastRecognitionTime(0);
    } finally {
      setIsProcessing(false);
    }
  }, [convertAudioBufferToRawPCM, lastRecognitionTime, recognitionCooldown, lastRecognizedTrack, addLogEntry]);

  const captureAudio = useCallback(async (reason: string) => {
    if (isProcessing || !audioContextRef.current || !streamRef.current) {
      addLogEntry(`Skipping capture - ${isProcessing ? 'already processing' : 'no audio context'}`, 'warning');
      return;
    }
    
    setIsProcessing(true);
    addLogEntry(`🎤 Starting audio capture for: ${reason}`, 'info');

    try {
      const AudioContextClass = window.AudioContext || (window as WindowWithWebkitAudioContext).webkitAudioContext;
      const captureContext = new AudioContextClass({ sampleRate: 44100 });
      await captureContext.resume();

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
          addLogEntry('Audio capture complete - processing...', 'success');
          processor.disconnect();
          source.disconnect();
          processAudioBuffer(audioBuffer, reason).finally(() => {
            captureContext.close();
          });
        }
      };

      source.connect(processor);
      processor.connect(captureContext.destination);

      setTimeout(() => {
        if (sampleIndex < bufferSize / 2) {
          addLogEntry(`Capture timeout - only got ${sampleIndex}/${bufferSize} samples`, 'error');
          processor.disconnect();
          source.disconnect();
          captureContext.close();
          setIsProcessing(false);
          setStatus('Audio capture timeout');
        }
      }, 5000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      addLogEntry(`Capture error: ${msg}`, 'error');
      setStatus(`Capture failed: ${msg}`);
      setIsProcessing(false);
    }
  }, [isProcessing, processAudioBuffer, addLogEntry]);

  const runMonitoring = useCallback(() => {
    if (!isRunningRef.current || !analyserRef.current) return;

    const level = getCurrentAudioLevel();
    setCurrentLevel(level);

    const currentSilenceLevel = silenceLevel;
    const currentSilenceThreshold = silenceThreshold;

    if (level < currentSilenceLevel) {
      if (!isInSilence) {
        addLogEntry(`🔇 Entering silence - Level: ${level}dB (threshold: ${currentSilenceLevel}dB)`, 'warning');
        setIsInSilence(true);
        silenceStartRef.current = Date.now();
        setSilenceCounter(0);
      } else {
        const elapsed = Date.now() - silenceStartRef.current;
        const secondsElapsed = Math.floor(elapsed / 1000);
        setSilenceCounter(secondsElapsed);
        
        if (secondsElapsed >= currentSilenceThreshold) {
          addLogEntry(`⏰ Silence threshold reached (${currentSilenceThreshold}s) - Triggering recognition`, 'success');
          setIsInSilence(false);
          setSilenceCounter(0);
          captureAudio('Silence detected');
        }
      }
    } else {
      if (isInSilence) {
        addLogEntry(`🔊 Exiting silence - Level: ${level}dB`, 'info');
        setIsInSilence(false);
        setSilenceCounter(0);
      }
    }

    if (isProcessing) {
      setStatus('Processing audio...');
    } else if (isInSilence) {
      setStatus(`Silence: ${silenceCounter}s / ${currentSilenceThreshold}s (Level: ${level})`);
    } else {
      const timeSinceLastRecognition = (Date.now() - lastRecognitionTime) / 1000;
      const cooldownRemaining = Math.max(0, recognitionCooldown - timeSinceLastRecognition);
      const cooldownStatus = cooldownRemaining > 0 ? ` | API Cooldown: ${Math.ceil(cooldownRemaining)}s` : ' | API Ready';
      setStatus(`Monitoring (Level: ${level} | Music: ${musicLevel} | Silence: ${currentSilenceLevel}${cooldownStatus})`);
    }
  }, [getCurrentAudioLevel, isInSilence, isProcessing, musicLevel, silenceLevel, silenceThreshold, silenceCounter, captureAudio, addLogEntry, lastRecognitionTime, recognitionCooldown]);

  const setupMicrophone = useCallback(async () => {
    try {
      addLogEntry('🎤 Setting up microphone...', 'info');
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

      addLogEntry('✅ Microphone setup complete', 'success');
      setStatus('Microphone ready - adjust levels and start monitoring');
      
      const debugInterval = window.setInterval(() => {
        getCurrentAudioLevel();
      }, 250);
      setDebugUpdateInterval(debugInterval);
      
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      addLogEntry(`❌ Microphone setup failed: ${msg}`, 'error');
      setStatus(`Microphone error: ${msg}`);
    }
  }, [addLogEntry, getCurrentAudioLevel]);

  const startMonitoring = useCallback(() => {
    if (!audioContextRef.current) {
      setStatus('Setup microphone first');
      return;
    }

    addLogEntry(`🟢 Starting monitoring - Music: ${musicLevel}dB, Silence: ${silenceLevel}dB, Duration: ${silenceThreshold}s, API Cooldown: ${recognitionCooldown}s`, 'success');
    isRunningRef.current = true;
    setIsListening(true);

    setTimeout(() => captureAudio('Initial recognition'), 1000);
    monitoringIntervalRef.current = window.setInterval(runMonitoring, 250);
  }, [musicLevel, silenceLevel, silenceThreshold, recognitionCooldown, captureAudio, runMonitoring, addLogEntry]);

  const stopMonitoring = useCallback(() => {
    addLogEntry('🔴 Stopping monitoring system', 'info');
    isRunningRef.current = false;
    setIsListening(false);
    setIsInSilence(false);
    setSilenceCounter(0);
    
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
      monitoringIntervalRef.current = null;
    }

    setStatus('Monitoring stopped - microphone still active');
  }, [addLogEntry]);

  const releaseMicrophone = useCallback(() => {
    addLogEntry('🔧 Releasing microphone and cleaning up audio system...', 'info');
    
    // Stop monitoring first
    stopMonitoring();
    
    // Stop all audio tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        addLogEntry(`🛑 Stopped audio track: ${track.kind}`, 'info');
      });
      streamRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close().then(() => {
        addLogEntry('🔧 Audio context closed successfully', 'success');
      }).catch((error) => {
        addLogEntry(`❌ Error closing audio context: ${error}`, 'error');
      });
      audioContextRef.current = null;
    }
    
    // Clear analyser reference
    analyserRef.current = null;
    
    // Clear debug update interval
    if (debugUpdateInterval) {
      clearInterval(debugUpdateInterval);
      setDebugUpdateInterval(null);
    }
    
    // Reset all states to initial values
    setCurrentLevel(0);
    setIsInSilence(false);
    setSilenceCounter(0);
    setDebugInfo([]);
    setBackgroundNoiseProfile(null);
    setIsCalibratingBackground(false);
    setLastRecognitionTime(0);
    setLastRecognizedTrack(null);
    setStatus('Microphone released - click "Enable Microphone" to restart');
    
    addLogEntry('✅ Microphone and audio system fully released', 'success');
  }, [stopMonitoring, debugUpdateInterval, addLogEntry]);

  const cleanup = useCallback(() => {
    releaseMicrophone();
  }, [releaseMicrophone]);

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
    return cleanup;
  }, [loadCurrentTrack, loadRecentHistory, cleanup]);

  useEffect(() => {
    if (isListening && monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
      monitoringIntervalRef.current = window.setInterval(runMonitoring, 250);
      addLogEntry(`⚙️ Settings updated - Music: ${musicLevel}dB, Silence: ${silenceLevel}dB, Duration: ${silenceThreshold}s, API Cooldown: ${recognitionCooldown}s`, 'info');
    }
  }, [musicLevel, silenceLevel, silenceThreshold, recognitionCooldown, isListening, runMonitoring, addLogEntry]);

  const VUMeter = ({ level }: { level: number }) => {
    const boxes = [];
    for (let i = 0; i < 10; i++) {
      const threshold = (i + 1) * 10;
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
        <h1 style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 8 }}>🛡️ API-Protected Audio Recognition</h1>
        <p style={{ color: '#666', fontSize: 16 }}>Smart duplicate detection and cooldown system to conserve Shazam API credits</p>
      </div>

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
            🎤 Enable Microphone
          </button>
        </div>
      )}

      {audioContextRef.current && !backgroundNoiseProfile && (
        <div style={{ background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, color: '#92400e' }}>
            Step 2: Calibrate Background Noise
          </h2>
          <p style={{ marginBottom: 16, color: '#92400e' }}>
            Keep your room quiet and click below to measure ambient noise levels. This will automatically set optimal thresholds.
          </p>
          <button
            onClick={calibrateBackgroundNoise}
            disabled={isCalibratingBackground}
            style={{
              background: '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '12px 24px',
              fontSize: 16,
              fontWeight: 600,
              cursor: isCalibratingBackground ? 'not-allowed' : 'pointer',
              opacity: isCalibratingBackground ? 0.6 : 1
            }}
          >
            {isCalibratingBackground ? '⏳ Sampling Environment...' : '🎯 Calibrate Background Noise'}
          </button>
        </div>
      )}

      {audioContextRef.current && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>🎛️ Controls</h2>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Current Level:</span>
            <VUMeter level={currentLevel} />
            <span style={{ fontSize: 24, fontWeight: 'bold', color: '#16a34a' }}>
              {currentLevel}
            </span>
          </div>

          {/* API Conservation Alert */}
          <div style={{
            background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)',
            border: '2px solid #059669',
            borderRadius: 8,
            padding: 16,
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <div style={{ fontSize: 24 }}>🛡️</div>
            <div>
              <div style={{ fontWeight: 600, color: '#059669', marginBottom: 4 }}>
                API Protection Active - API Calls Today: {apiCallsToday}
              </div>
              <div style={{ fontSize: 14, color: '#047857' }}>
                Cooldown prevents duplicate calls. Set to 3+ minutes for DJ sets to maximize API efficiency.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                🎵 Music Level (75-85dB):
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
                🔇 Silence Level (ambient):
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
                ⏰ Silence Duration (s):
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
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                🛡️ API Cooldown (s):
              </label>
              <input
                type="number"
                min="30"
                max="600"
                value={recognitionCooldown}
                onChange={(e) => setRecognitionCooldown(parseInt(e.target.value) || 180)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '2px solid #f59e0b',
                  borderRadius: 6,
                  fontSize: 16,
                  fontWeight: 600,
                  textAlign: 'center',
                  backgroundColor: recognitionCooldown < 120 ? '#fef3c7' : '#fff'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
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
              {isListening ? '🔴 Stop Monitoring' : '🟢 Start Monitoring'}
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
              🎯 Recognize Now
            </button>

            <button
              onClick={calibrateBackgroundNoise}
              disabled={!audioContextRef.current || isCalibratingBackground}
              style={{
                background: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 600,
                cursor: (!audioContextRef.current || isCalibratingBackground) ? 'not-allowed' : 'pointer',
                opacity: (!audioContextRef.current || isCalibratingBackground) ? 0.6 : 1
              }}
            >
              {isCalibratingBackground ? '⏳ Sampling...' : '🎯 Calibrate Background'}
            </button>

            <button
              onClick={releaseMicrophone}
              disabled={!audioContextRef.current}
              style={{
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 600,
                cursor: !audioContextRef.current ? 'not-allowed' : 'pointer',
                opacity: !audioContextRef.current ? 0.6 : 1
              }}
            >
              🔧 Release Microphone
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
            fontSize: 12,
            color: '#6b7280',
            marginBottom: 16,
            padding: '12px 16px',
            background: '#f0f9ff',
            borderRadius: 6,
            border: '1px solid #0284c7'
          }}>
            🛡️ <strong>API Protection:</strong> Cooldown prevents duplicate API calls for the same song. Set to 3+ minutes for DJ sets to save credits.
            <br />
            🎙️ <strong>Microphone:</strong> Use &ldquo;Release Microphone&rdquo; to fully stop audio capture without refreshing the page.
            <br />
            🔄 <strong>Smart Detection:</strong> System automatically skips recognition if the same song is still playing.
          </div>

          {backgroundNoiseProfile && (
            <div style={{
              marginBottom: 16,
              padding: '12px 16px',
              background: '#f0f9ff',
              border: '2px solid #0284c7',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              color: '#0c4a6e'
            }}>
              🎯 Background noise profile: {backgroundNoiseProfile}dB (ambient + 5dB buffer)
            </div>
          )}

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

          {audioContextRef.current && (
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
              <div style={{ fontWeight: 600, marginBottom: 8, color: '#10b981' }}>📊 Live Monitor:</div>
              {debugInfo.length > 0 ? (
                debugInfo.map((info, i) => (
                  <div key={i} style={{ marginBottom: 2, color: '#e5e7eb' }}>{info}</div>
                ))
              ) : (
                <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>Starting audio level monitoring...</div>
              )}
            </div>
          )}

          {isListening && (
            <div style={{
              marginTop: 16,
              background: '#111827',
              border: '2px solid #374151',
              borderRadius: 8,
              overflow: 'hidden'
            }}>
              <div style={{ 
                background: '#1f2937', 
                color: '#10b981', 
                padding: '12px 16px', 
                fontWeight: 600, 
                fontSize: 14,
                borderBottom: '1px solid #374151'
              }}>
                📋 Activity Log
              </div>
              <div style={{ 
                maxHeight: 200, 
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: 11,
                minHeight: 60
              }}>
                {activityLog.length === 0 ? (
                  <div style={{ padding: '16px', color: '#9ca3af', textAlign: 'center' }}>
                    No activity yet - monitoring for audio changes...
                  </div>
                ) : (
                  activityLog.map((entry, i) => (
                    <div 
                      key={i} 
                      style={{ 
                        padding: '8px 16px', 
                        borderBottom: i < activityLog.length - 1 ? '1px solid #374151' : 'none',
                        color: entry.type === 'error' ? '#f87171' : 
                               entry.type === 'warning' ? '#fbbf24' :
                               entry.type === 'success' ? '#34d399' : '#e5e7eb'
                      }}
                    >
                      <span style={{ color: '#9ca3af', marginRight: 8 }}>[{entry.timestamp}]</span>
                      {entry.message}
                    </div>
                  ))
                )}
              </div>
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

      {currentTrack && (
        <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', color: 'white', borderRadius: 16, padding: 32, marginBottom: 32, display: 'flex', alignItems: 'center', gap: 24 }}>
          {currentTrack.recognition_image_url && (
            <Image src={currentTrack.recognition_image_url} alt="Album artwork" width={120} height={120} style={{ borderRadius: 12, objectFit: 'cover' }} unoptimized />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>{currentTrack.title}</div>
            <div style={{ fontSize: 18, opacity: 0.9, marginBottom: 4 }}>{currentTrack.artist}</div>
            {currentTrack.album_title && (
              <div style={{ fontSize: 16, opacity: 0.7, marginBottom: 8, fontStyle: 'italic' }}>
                📀 Album: {currentTrack.album_title}
              </div>
            )}
            <div style={{ fontSize: 14, opacity: 0.8 }}>
              🎯 Confidence: {Math.round(currentTrack.recognition_confidence * 100)}% • ⏰ Started: {new Date(currentTrack.started_at).toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ background: '#f9fafb', padding: '16px 24px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 16 }}>
          📜 Recent Recognition History
        </div>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {recognitionHistory.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>No recognition history yet.</div>
          ) : (
            recognitionHistory.map((track, i) => (
              <div key={track.id || i} style={{ padding: '16px 24px', borderBottom: i < recognitionHistory.length - 1 ? '1px solid #f3f4f6' : 'none', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{track.artist || 'Unknown Artist'} - {track.title || 'Unknown Title'}</div>
                  {track.album && (
                    <div style={{ fontSize: 14, color: '#2563eb', marginBottom: 4, fontStyle: 'italic' }}>
                      📀 Album: {track.album}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>🎯 {Math.round((track.confidence || 0) * 100)}% confidence • 🔧 {track.service || 'unknown'}</div>
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>⏰ {track.created_at ? new Date(track.created_at).toLocaleString() : 'Unknown time'}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}