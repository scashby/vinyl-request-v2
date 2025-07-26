// src/lib/audio/AudioCapture.ts

import { useState, useRef, useCallback, useEffect } from 'react';

export interface AudioMetrics {
  volume: number;
  frequency: number;
  clarity: number;
}

export interface UseAudioCaptureReturn {
  isPermissionGranted: boolean;
  hasPermissionError: boolean;
  isSupported: boolean;
  error: string | null;
  metrics: AudioMetrics | null;
  audioData: Float32Array | null;
  fingerprint: string | null;
  requestPermission: () => Promise<void>;
  generateFingerprint: () => Promise<string | null>;
  isAudioPlaying: boolean;
  getCaptureState: () => string;
}

export interface UseAudioCaptureOptions {
  sampleRate?: number;
  bufferSize?: number;
}

export interface AudioCaptureConfig {
  sampleRate: number;
  bufferSize: number;
  constraints: MediaStreamConstraints;
}

export const defaultAudioCaptureConfig: AudioCaptureConfig = {
  sampleRate: 44100,
  bufferSize: 4096,
  constraints: {
    audio: {
      sampleRate: 44100,
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    }
  }
};

export const useAudioCapture = (options: UseAudioCaptureOptions = {}): UseAudioCaptureReturn => {
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [hasPermissionError, setHasPermissionError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<AudioMetrics | null>(null);
  const [audioData, setAudioData] = useState<Float32Array | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const isSupported = typeof navigator !== 'undefined' && 
                     !!navigator.mediaDevices && 
                     !!navigator.mediaDevices.getUserMedia;

  const requestPermission = useCallback(async (): Promise<void> => {
    if (!isSupported) {
      setError('Audio capture not supported');
      setHasPermissionError(true);
      return;
    }

    try {
      setError(null);
      setHasPermissionError(false);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: options.sampleRate || 44100,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      streamRef.current = stream;
      setIsPermissionGranted(true);

      // Setup audio context for analysis
      const audioContext = new AudioContext({ sampleRate: options.sampleRate || 44100 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = options.bufferSize || 4096;
      analyzer.smoothingTimeConstant = 0.8;

      analyzerRef.current = analyzer;
      source.connect(analyzer);

      // Start audio analysis
      startAudioAnalysis();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Permission denied');
      setHasPermissionError(true);
      setIsPermissionGranted(false);
    }
  }, [isSupported, options.sampleRate, options.bufferSize]);

  const startAudioAnalysis = useCallback(() => {
    if (!analyzerRef.current) return;

    const bufferLength = analyzerRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const timeDataArray = new Float32Array(bufferLength);

    const analyze = () => {
      if (!analyzerRef.current) return;

      analyzerRef.current.getByteFrequencyData(dataArray);
      analyzerRef.current.getFloatTimeDomainData(timeDataArray);

      // Calculate volume (RMS)
      let sum = 0;
      for (let i = 0; i < timeDataArray.length; i++) {
        sum += timeDataArray[i] * timeDataArray[i];
      }
      const volume = Math.sqrt(sum / timeDataArray.length);

      // Find dominant frequency
      let maxIndex = 0;
      let maxValue = 0;
      for (let i = 0; i < dataArray.length; i++) {
        if (dataArray[i] > maxValue) {
          maxValue = dataArray[i];
          maxIndex = i;
        }
      }
      const frequency = (maxIndex * (audioContextRef.current?.sampleRate || 44100)) / (bufferLength * 2);

      // Calculate clarity (simplified)
      const clarity = maxValue / 255;

      setMetrics({ volume: volume * 100, frequency, clarity });
      setIsAudioPlaying(volume > 0.01);
      setAudioData(timeDataArray.slice()); // Copy the array

      animationFrameRef.current = requestAnimationFrame(analyze);
    };

    analyze();
  }, []);

  const generateFingerprint = useCallback(async (): Promise<string | null> => {
    if (!audioData) return null;

    // Simple fingerprint generation
    const hash = Array.from(audioData)
      .slice(0, 100) // Use first 100 samples
      .map(val => Math.round(val * 1000))
      .join('');

    const fingerprint = btoa(hash).slice(0, 32);
    setFingerprint(fingerprint);
    return fingerprint;
  }, [audioData]);

  const getCaptureState = useCallback((): string => {
    if (!isSupported) return 'unsupported';
    if (hasPermissionError) return 'permission_error';
    if (!isPermissionGranted) return 'permission_pending';
    if (isAudioPlaying) return 'active';
    return 'idle';
  }, [isSupported, hasPermissionError, isPermissionGranted, isAudioPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    isPermissionGranted,
    hasPermissionError,
    isSupported,
    error,
    metrics,
    audioData,
    fingerprint,
    requestPermission,
    generateFingerprint,
    isAudioPlaying,
    getCaptureState
  };
};