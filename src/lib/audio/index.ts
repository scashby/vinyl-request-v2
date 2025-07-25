// src/lib/audio/index.ts

// AudioCapture exports
export {
  useAudioCapture,
  defaultAudioCaptureConfig,
  type AudioMetrics,
  type UseAudioCaptureReturn,
  type UseAudioCaptureOptions,
  type AudioCaptureConfig
} from './AudioCapture';

// AudioProcessor exports
export {
  AudioProcessor,
  defaultAudioProcessorConfig,
  type AudioFeatures,
  type AudioFingerprint,
  type AudioProcessorConfig
} from './AudioProcessor';