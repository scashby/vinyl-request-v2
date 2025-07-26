// src/components/AudioRecognitionComponent.tsx

import React, { useState, useCallback, useMemo } from 'react';
import { useAudioCapture, RecognitionEngine, ProcessingResult } from 'lib/audio/client';

interface AudioRecognitionComponentProps {
  onResult?: (result: ProcessingResult) => void;
  className?: string;
}

const AudioRecognitionComponent: React.FC<AudioRecognitionComponentProps> = ({
  onResult,
  className = ''
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<ProcessingResult | null>(null);
  
  const {
    isPermissionGranted,
    hasPermissionError,
    isSupported,
    error,
    metrics,
    audioData,
    requestPermission,
    isAudioPlaying
  } = useAudioCapture();

  const recognitionEngine = useMemo(() => new RecognitionEngine(), []);

  const handleStartRecognition = useCallback(async () => {
    if (!audioData || !isPermissionGranted) {
      await requestPermission();
      return;
    }

    setIsProcessing(true);
    try {
      const result = await recognitionEngine.processAudio(audioData);
      setLastResult(result);
      onResult?.(result);
    } catch (err) {
      const errorResult: ProcessingResult = {
        success: false,
        error: err instanceof Error ? err.message : 'Processing failed',
        processingTime: 0
      };
      setLastResult(errorResult);
      onResult?.(errorResult);
    } finally {
      setIsProcessing(false);
    }
  }, [audioData, isPermissionGranted, requestPermission, onResult, recognitionEngine]);

  if (!isSupported) {
    return (
      <div className={`audio-recognition-error ${className}`}>
        Audio capture is not supported in this browser.
      </div>
    );
  }

  if (hasPermissionError || error) {
    return (
      <div className={`audio-recognition-error ${className}`}>
        <p>Error: {error || 'Permission denied'}</p>
        <button onClick={requestPermission}>Retry Permission</button>
      </div>
    );
  }

  return (
    <div className={`audio-recognition ${className}`}>
      <div className="controls">
        <button 
          onClick={handleStartRecognition}
          disabled={isProcessing || !isPermissionGranted}
        >
          {isProcessing ? 'Processing...' : 'Start Recognition'}
        </button>
        
        {!isPermissionGranted && (
          <button onClick={requestPermission}>
            Grant Microphone Permission
          </button>
        )}
      </div>

      {metrics && (
        <div className="metrics">
          <div>Volume: {metrics.volume.toFixed(2)}</div>
          <div>Frequency: {metrics.frequency.toFixed(2)} Hz</div>
          <div>Clarity: {metrics.clarity.toFixed(2)}</div>
        </div>
      )}

      {isAudioPlaying && (
        <div className="status">
          🎵 Audio detected
        </div>
      )}

      {lastResult && (
        <div className="results">
          <h3>Recognition Result</h3>
          {lastResult.success ? (
            <div>
              <p>Confidence: {lastResult.result?.confidence.toFixed(2)}</p>
              <p>Matches: {lastResult.result?.matches.join(', ')}</p>
              <p>Processing Time: {lastResult.processingTime.toFixed(2)}ms</p>
            </div>
          ) : (
            <div className="error">
              Error: {lastResult.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AudioRecognitionComponent;