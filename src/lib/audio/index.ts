// src/lib/audio/index.ts - Server-safe exports only

// AudioProcessor exports (server-safe)
export {
  AudioProcessor,
  defaultAudioProcessorConfig,
  type AudioFeatures,
  type AudioFingerprint,
  type AudioProcessorConfig
} from './AudioProcessor';

// RecognitionEngine exports (server-safe)
export {
  RecognitionEngine,
  defaultRecognitionOptions,
  type RecognitionResult,
  type RecognitionOptions,
  type ProcessingResult
} from './RecognitionEngine';

// Types only from AudioCapture (no hook implementation)
export type {
  AudioMetrics,
  UseAudioCaptureReturn,
  UseAudioCaptureOptions,
  AudioCaptureConfig
} from './AudioCapture';