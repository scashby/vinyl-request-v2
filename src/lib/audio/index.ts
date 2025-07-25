// src/lib/audio/index.ts
// Central exports for audio library

export { AudioCapture } from './AudioCapture';
export type { AudioCaptureConfig, AudioMetrics } from './AudioCapture';

export { AudioProcessor } from './AudioProcessor';
export type { 
  AudioProcessorConfig, 
  AudioFeatures, 
  AudioFingerprint 
} from './AudioProcessor';

export { RecognitionEngine } from './RecognitionEngine';
export type { 
  RecognitionConfig, 
  RecognitionResult, 
  RecognitionStatus 
} from './RecognitionEngine';

// Re-export the hook
export { useAudioCapture } from '../../hooks/useAudioCapture';
export type { 
  UseAudioCaptureState, 
  UseAudioCaptureOptions 
} from '../../hooks/useAudioCapture';