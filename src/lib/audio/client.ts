// src/lib/audio/client.ts - Client-only exports with React hooks
"use client";

// Re-export everything from main index
export * from './index';

// Client-only AudioCapture hook
export {
  useAudioCapture,
  defaultAudioCaptureConfig
} from './AudioCapture';