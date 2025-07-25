// src/lib/audio/AudioCapture.ts

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

export const useAudioCapture = (): UseAudioCaptureReturn => {
  // Implementation would go here
  // For now, returning a stub to fix the type errors
  return {
    isPermissionGranted: false,
    hasPermissionError: false,
    isSupported: true,
    error: null,
    metrics: null,
    audioData: null,
    fingerprint: null,
    requestPermission: async () => {},
    generateFingerprint: async () => null,
    isAudioPlaying: false,
    getCaptureState: () => 'idle'
  };
};