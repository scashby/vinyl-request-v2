// src/app/admin/audio-recognition/page.tsx - SIMPLE CALIBRATION SYSTEM
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
  const [status, setStatus] = useState('System ready - calibrate first');
  const [audioLevel, setAudioLevel] = useState(0);
  const [isInSilence, setIsInSilence] = useState(false);
  const [silenceDuration, setSilenceDuration] = useState(0);
  const [musicLevel, setMusicLevel] = useState<number | null>(null);
  const [silenceLevel, setSilenceLevel] = useState<number | null>(null);
  const [silenceThreshold, setSilenceThreshold] = useState(5);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const isRunningRef = useRef<boolean>(false);
  const silenceStartTimeRef = useRef<number | null>(null);
  const lastRecognitionTimeRef = useRef<number>(0);
  const monitoringIntervalRef = useRef<number | null>(null);

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
    try {
      setStatus(`Processing audio for ${reason}...`);
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
        setStatus(`Recognized: ${result.track.artist} - ${result.track.title}`);
        
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
        setStatus(`No match found: ${result.error || 'Unknown error'}`);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      setStatus(`Processing error: ${msg}`);
    } finally {
      lastRecognitionTimeRef.current = Date.now();
      setIsProcessing(false);
    }
  }, [convertAudioBufferToRawPCM, currentTrack]);

  const triggerRecognition = useCallback(async (reason: string) => {
    if (isProcessing || !audioContextRef.current || !streamRef.current) return;
    
    setIsProcessing(true);

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
          } catch {
            // ignore
          }
          processAudioBuffer(audioBuffer, reason).finally(() => {
            captureContext.close();
          });
        }
      };

      source.connect(processor);
      processor.connect(captureContext.destination);

      setTimeout(() => {
        if (sampleIndex < bufferSize / 2) {
          try { 
            processor.disconnect(); 
            source.disconnect(); 
          } catch {
            // ignore
          }
          captureContext.close();
          setIsProcessing(false);
          setStatus('Audio capture timeout');
        }
      }, 5000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(`Recognition failed: ${msg}`);
      setIsProcessing(false);
    }
  }, [isProcessing, processAudioBuffer]);

  const runMonitoring = useCallback(() => {
    if (!isRunningRef.current || !analyserRef.current || musicLevel === null || silenceLevel === null) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += Math.abs(dataArray[i] - 128);
    }
    const rawLevel = Math.round(sum / bufferLength * 50);

    const range = musicLevel - silenceLevel;
    let scaledPercentage = 0;
    if (range > 0) {
      scaledPercentage = Math.max(0, Math.min(50, ((rawLevel - silenceLevel) / range) * 50));
    }

    setAudioLevel(Math.round(scaledPercentage));

    const currentlyInSilence = scaledPercentage < silenceThreshold;
    const now = Date.now();
    const timeSinceLast = now - lastRecognitionTimeRef.current;

    if (timeSinceLast < 15000) {
      const remain = Math.ceil((15000 - timeSinceLast) / 1000);
      setStatus(`Cooldown: ${remain}s (${scaledPercentage.toFixed(1)}%)`);
      setIsInSilence(false);
      setSilenceDuration(0);
      silenceStartTimeRef.current = null;
      return;
    }

    if (currentlyInSilence && !isInSilence) {
      setIsInSilence(true);
      silenceStartTimeRef.current = now;
      setSilenceDuration(0);
      setStatus(`Silence detected (${scaledPercentage.toFixed(1)}% < ${silenceThreshold}%)`);
    } else if (!currentlyInSilence && isInSilence) {
      setIsInSilence(false);
      silenceStartTimeRef.current = null;
      setSilenceDuration(0);
      setStatus(`Audio: ${scaledPercentage.toFixed(1)}%`);
    } else if (currentlyInSilence && isInSilence) {
      const elapsed = now - (silenceStartTimeRef.current || now);
      setSilenceDuration(elapsed);

      if (elapsed >= 3000) {
        setIsInSilence(false);
        silenceStartTimeRef.current = null;
        setSilenceDuration(0);
        if (!isProcessing) {
          triggerRecognition('Silence detection');
        }
      } else {
        setStatus(`Silence: ${Math.floor(elapsed/1000)}s / 3s (${scaledPercentage.toFixed(1)}%)`);
      }
    } else {
      setStatus(`Audio: ${scaledPercentage.toFixed(1)}% (threshold: ${silenceThreshold}%)`);
    }
  }, [isInSilence, isProcessing, musicLevel, silenceLevel, silenceThreshold, triggerRecognition]);

  const calibrateMusic = useCallback(() => {
    if (!audioContextRef.current) return;
    setMusicLevel(audioLevel);
    setStatus(`Music level set to: ${audioLevel}`);
  }, [audioLevel]);

  const calibrateSilence = useCallback(() => {
    if (!audioContextRef.current) return;
    setSilenceLevel(audioLevel);
    setStatus(`Silence level set to: ${audioLevel}`);
  }, [audioLevel]);

  const setupAudioMonitoring = useCallback(async () => {
    try {
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
      await audioContext.resume().catch(() => {});

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const updateLevel = () => {
        if (!analyser) return;
        const bufferLength = analyser.fftSize;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(dataArray);
        
        let totalDev = 0;
        for (let i = 0; i < bufferLength; i++) {
          totalDev += Math.abs(dataArray[i] - 128);
        }
        const level = Math.round(totalDev / bufferLength * 50);
        setAudioLevel(Math.min(level, 100));
      };

      setInterval(updateLevel, 100);
      setStatus('Audio monitoring active - ready to calibrate');
      
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      setStatus(`Microphone error: ${msg}`);
    }
  }, []);

  const startRecognition = useCallback(() => {
    if (musicLevel === null || silenceLevel === null) {
      setStatus('Please calibrate music and silence levels first');
      return;
    }

    isRunningRef.current = true;
    setIsListening(true);
    setStatus('Starting recognition system...');

    setTimeout(() => {
      triggerRecognition('Initial recognition');
    }, 1000);

    monitoringIntervalRef.current = window.setInterval(runMonitoring, 200);
  }, [musicLevel, runMonitoring, silenceLevel, triggerRecognition]);

  const stopRecognition = useCallback(() => {
    isRunningRef.current = false;
    setIsListening(false);
    
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
    setStatus('Recognition stopped');
  }, []);

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

  const VUMeter = ({ level }: { level: number }) => {
    const boxes = [];
    for (let i = 0; i < 10; i++) {
      const threshold = (i + 1) * 5; // 0-50% scale, so each box is 5%
      const isActive = level >= threshold;
      const isSilence = i < 2;
      
      boxes.push(
        <div
          key={i}
          style={{
            width: 25,
            height: 40,
            backgroundColor: isActive 
              ? (isSilence ? '#ef4444' : '#22c55e') 
              : (isSilence ? '#fee2e2' : '#f0fdf4'),
            border: `2px solid ${isSilence ? '#fca5a5' : '#bbf7d0'}`,
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

  useEffect(() => {
    void loadCurrentTrack();
    void loadRecentHistory();
    return stopRecognition;
  }, [loadCurrentTrack, loadRecentHistory, stopRecognition]);

  const isCalibrated = musicLevel !== null && silenceLevel !== null;

  return (
    <div style={{ padding: 24, background: '#fff', color: '#222', minHeight: '100vh', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 8 }}>Audio Recognition Control</h1>
        <p style={{ color: '#666', fontSize: 16 }}>Simple calibration-based silence detection</p>
      </div>

      {!audioContextRef.current && (
        <div style={{ background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, color: '#92400e' }}>
            Step 1: Setup Audio Monitoring
          </h2>
          <button
            onClick={setupAudioMonitoring}
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
            Enable Microphone
          </button>
        </div>
      )}

      {audioContextRef.current && !isCalibrated && (
        <div style={{ background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, color: '#92400e' }}>
            Step 2: Calibrate System
          </h2>
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 600, marginRight: 16 }}>Current Audio Level:</span>
            <span style={{ fontSize: 24, fontWeight: 'bold' }}>{audioLevel}</span>
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <button
              onClick={calibrateMusic}
              style={{
                background: '#16a34a',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Set Music Level
            </button>
            <button
              onClick={calibrateSilence}
              style={{
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Set Silence Level
            </button>
          </div>
          <div style={{ fontSize: 14, color: '#92400e' }}>
            <strong>Instructions:</strong> Play music at normal volume, click &quot;Set Music Level&quot;. 
            Then pause music and click &quot;Set Silence Level&quot;.
          </div>
          {musicLevel !== null && (
            <div style={{ marginTop: 8, color: '#16a34a', fontWeight: 600 }}>
              Music level set: {musicLevel}
            </div>
          )}
          {silenceLevel !== null && (
            <div style={{ marginTop: 4, color: '#dc2626', fontWeight: 600 }}>
              Silence level set: {silenceLevel}
            </div>
          )}
        </div>
      )}

      {isCalibrated && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <button
              onClick={isListening ? stopRecognition : startRecognition}
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
              {isListening ? 'Stop Recognition' : 'Start Recognition'}
            </button>

            {isListening && (
              <button
                onClick={() => triggerRecognition('Manual trigger')}
                disabled={isProcessing}
                style={{
                  background: '#7c3aed',
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
                Trigger Now
              </button>
            )}

            <a href="/tv-display" target="_blank" rel="noopener noreferrer" style={{ background: '#2563eb', color: 'white', padding: '8px 16px', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
              TV Display
            </a>
          </div>

          <div style={{ fontSize: 14, color: isProcessing ? '#ea580c' : isListening ? '#16a34a' : '#6b7280', marginBottom: 16, fontWeight: 600, padding: '8px 12px', background: isProcessing ? '#fef3c7' : isListening ? '#f0fdf4' : '#f9fafb', borderRadius: 6 }}>
            {status}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Audio Level:</span>
            <VUMeter level={audioLevel} />
            <span style={{ fontSize: 20, fontWeight: 'bold', color: musicLevel !== null && silenceLevel !== null && audioLevel < silenceThreshold ? '#dc2626' : '#16a34a' }}>
              {audioLevel}%
            </span>
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'center' }}>
            <button
              onClick={calibrateMusic}
              style={{
                background: '#16a34a',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Set Music Level ({musicLevel || '--'})
            </button>
            <button
              onClick={calibrateSilence}
              style={{
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Set Silence Level ({silenceLevel || '--'})
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Silence Threshold:</span>
              <input
                type="number"
                min="1"
                max="20"
                value={silenceThreshold}
                onChange={(e) => setSilenceThreshold(parseInt(e.target.value) || 5)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                style={{
                  width: 60,
                  padding: '4px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  fontSize: 14,
                  textAlign: 'center'
                }}
              />
              <span style={{ fontSize: 14 }}>%</span>
            </div>
          </div>

          {isInSilence && (
            <div style={{ fontSize: 14, color: '#7c3aed', background: '#faf5ff', border: '2px solid #d8b4fe', padding: '8px 12px', borderRadius: 8, display: 'inline-block', fontWeight: 600 }}>
              Silence Duration: {Math.floor(silenceDuration / 1000)}s / 3s
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
            {currentTrack.album_title && (<div style={{ fontSize: 16, opacity: 0.7, marginBottom: 8 }}>{currentTrack.album_title}</div>)}
            <div style={{ fontSize: 14, opacity: 0.8 }}>
              Confidence: {Math.round(currentTrack.recognition_confidence * 100)}% • Started: {new Date(currentTrack.started_at).toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ background: '#f9fafb', padding: '16px 24px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 16 }}>
          Recent Recognition History
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