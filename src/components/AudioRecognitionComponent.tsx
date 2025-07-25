// src/components/AudioRecognitionComponent.tsx
// Complete implementation with proper TypeScript types and React hooks

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAudioCapture, AudioCaptureConfig } from 'hooks/useAudioCapture';
import { AudioProcessor, ProcessingResult, AudioMetrics } from 'lib/audio/AudioProcessor';
import { RecognitionEngine, RecognitionResult } from 'lib/audio/RecognitionEngine';

interface AudioRecognitionState {
  isActive: boolean;
  isProcessing: boolean;
  currentResult: RecognitionResult | null;
  error: string | null;
  metrics: AudioMetrics | null;
}

interface AudioRecognitionProps {
  onRecognitionResult?: (result: RecognitionResult) => void;
  onError?: (error: string) => void;
  autoStart?: boolean;
  config?: AudioCaptureConfig;
}

const AudioRecognitionComponent: React.FC<AudioRecognitionProps> = ({
  onRecognitionResult,
  onError,
  autoStart = false,
  config = {
    sampleRate: 44100,
    channels: 2,
    bitDepth: 16,
    bufferSize: 1024
  }
}) => {
  // State management with proper typing
  const [state, setState] = useState<AudioRecognitionState>({
    isActive: false,
    isProcessing: false,
    currentResult: null,
    error: null,
    metrics: null
  });

  // Refs for audio processing
  const processorRef = useRef<AudioProcessor | null>(null);
  const recognitionEngineRef = useRef<RecognitionEngine | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio processing engines
  useEffect(() => {
    processorRef.current = new AudioProcessor(config.sampleRate);
    recognitionEngineRef.current = new RecognitionEngine();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [config.sampleRate]);

  // Audio capture hook
  const {
    isCapturing,
    devices,
    selectedDevice,
    startCapture,
    stopCapture,
    getAudioData
  } = useAudioCapture(config);

  // Periodic audio processing function
  const startPeriodicProcessing = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(async () => {
      if (!isCapturing || !processorRef.current || !recognitionEngineRef.current) {
        return;
      }

      try {
        setState(prev => ({ ...prev, isProcessing: true, error: null }));

        const audioData = getAudioData();
        if (!audioData) {
          return;
        }

        // Process audio and get metrics
        const metrics = processorRef.current.getAudioMetrics(audioData);
        setState(prev => ({ ...prev, metrics }));

        // Only proceed with recognition if audio level is sufficient
        if (metrics.volume > 0.1) {
          const result = await recognitionEngineRef.current.recognizeAudio(audioData);
          
          if (result) {
            setState(prev => ({ ...prev, currentResult: result }));
            onRecognitionResult?.(result);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Recognition failed';
        setState(prev => ({ ...prev, error: errorMessage }));
        onError?.(errorMessage);
      } finally {
        setState(prev => ({ ...prev, isProcessing: false }));
      }
    }, 3000); // Process every 3 seconds
  }, [isCapturing, getAudioData, onRecognitionResult, onError]);

  // Stop periodic processing
  const stopPeriodicProcessing = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Start recognition process
  const startRecognition = useCallback(async (deviceId?: string) => {
    try {
      setState(prev => ({ ...prev, error: null }));
      await startCapture(deviceId);
      startPeriodicProcessing();
      setState(prev => ({ ...prev, isActive: true }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recognition';
      setState(prev => ({ ...prev, error: errorMessage }));
      onError?.(errorMessage);
    }
  }, [startCapture, startPeriodicProcessing, onError]);

  // Stop recognition process
  const stopRecognition = useCallback(() => {
    stopPeriodicProcessing();
    stopCapture();
    setState(prev => ({ 
      ...prev, 
      isActive: false, 
      isProcessing: false,
      currentResult: null,
      metrics: null
    }));
  }, [stopPeriodicProcessing, stopCapture]);

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart && devices.length > 0 && !state.isActive) {
      startRecognition();
    }
  }, [autoStart, devices.length, state.isActive, startRecognition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecognition();
    };
  }, [stopRecognition]);

  // Render component
  return (
    <div className="audio-recognition-container">
      <div className="controls">
        <h3>Audio Recognition</h3>
        
        {/* Device Selection */}
        <div className="device-selection">
          <label htmlFor="device-select">Audio Input Device:</label>
          <select 
            id="device-select"
            value={selectedDevice || ''}
            onChange={(e) => {
              if (state.isActive) {
                stopRecognition();
                startRecognition(e.target.value);
              }
            }}
            disabled={state.isActive}
          >
            <option value="">Default Device</option>
            {devices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Device ${device.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>

        {/* Control Buttons */}
        <div className="control-buttons">
          {!state.isActive ? (
            <button 
              onClick={() => startRecognition(selectedDevice || undefined)}
              disabled={devices.length === 0}
            >
              Start Recognition
            </button>
          ) : (
            <button onClick={stopRecognition}>
              Stop Recognition
            </button>
          )}
        </div>
      </div>

      {/* Status Display */}
      <div className="status">
        <div className="status-indicators">
          <div className={`indicator ${state.isActive ? 'active' : 'inactive'}`}>
            {state.isActive ? '🟢 Active' : '🔴 Inactive'}
          </div>
          {state.isProcessing && (
            <div className="indicator processing">
              🔄 Processing...
            </div>
          )}
        </div>

        {/* Error Display */}
        {state.error && (
          <div className="error-message">
            ❌ {state.error}
          </div>
        )}

        {/* Audio Metrics */}
        {state.metrics && (
          <div className="metrics">
            <h4>Audio Metrics</h4>
            <div className="metric-grid">
              <div className="metric">
                <label>Volume:</label>
                <div className="meter">
                  <div 
                    className="meter-fill" 
                    style={{ width: `${state.metrics.volume * 100}%` }}
                  />
                </div>
                <span>{Math.round(state.metrics.volume * 100)}%</span>
              </div>
              <div className="metric">
                <label>Quality:</label>
                <span>{Math.round(state.metrics.quality * 100)}%</span>
              </div>
              <div className="metric">
                <label>Frequency:</label>
                <span>{Math.round(state.metrics.frequency)}Hz</span>
              </div>
            </div>
          </div>
        )}

        {/* Recognition Result */}
        {state.currentResult && (
          <div className="recognition-result">
            <h4>Recognized Track</h4>
            <div className="track-info">
              <div className="artist">{state.currentResult.artist}</div>
              <div className="title">{state.currentResult.title}</div>
              <div className="album">{state.currentResult.album}</div>
              <div className="confidence">
                Confidence: {Math.round(state.currentResult.confidence * 100)}%
              </div>
              <div className="service">
                Service: {state.currentResult.service}
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .audio-recognition-container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: white;
        }

        .controls {
          margin-bottom: 20px;
        }

        .device-selection {
          margin: 10px 0;
        }

        .device-selection label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
        }

        .device-selection select {
          width: 100%;
          padding: 8px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
        }

        .control-buttons {
          margin: 15px 0;
        }

        .control-buttons button {
          padding: 10px 20px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        }

        .control-buttons button:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        .status-indicators {
          display: flex;
          gap: 10px;
          margin-bottom: 10px;
        }

        .indicator {
          padding: 5px 10px;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
        }

        .indicator.active {
          background: #dcfce7;
          color: #166534;
        }

        .indicator.inactive {
          background: #fef2f2;
          color: #991b1b;
        }

        .indicator.processing {
          background: #fef3c7;
          color: #92400e;
        }

        .error-message {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          padding: 10px;
          border-radius: 4px;
          margin: 10px 0;
        }

        .metrics {
          margin: 15px 0;
          padding: 15px;
          background: #f8fafc;
          border-radius: 4px;
        }

        .metric-grid {
          display: grid;
          gap: 10px;
        }

        .metric {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .metric label {
          min-width: 80px;
          font-weight: 500;
        }

        .meter {
          flex: 1;
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
        }

        .meter-fill {
          height: 100%;
          background: #10b981;
          transition: width 0.3s;
        }

        .recognition-result {
          margin: 15px 0;
          padding: 15px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 4px;
        }

        .track-info {
          margin-top: 10px;
        }

        .track-info .artist {
          font-size: 18px;
          font-weight: 600;
          color: #374151;
        }

        .track-info .title {
          font-size: 16px;
          color: #6b7280;
          margin: 2px 0;
        }

        .track-info .album {
          font-size: 14px;
          color: #9ca3af;
          margin: 2px 0;
        }

        .track-info .confidence,
        .track-info .service {
          font-size: 12px;
          color: #6b7280;
          margin: 2px 0;
        }
      `}</style>
    </div>
  );
};

export default AudioRecognitionComponent;