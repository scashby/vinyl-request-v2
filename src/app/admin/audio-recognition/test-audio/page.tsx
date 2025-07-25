// src/app/admin/audio-recognition/test-audio/page.tsx
// Test interface for audio capture and recognition - Phase 1 Implementation

"use client";

import { useState, useEffect, useRef } from 'react';
import { useAudioCapture } from 'hooks/useAudioCapture';
import { RecognitionEngine } from 'lib/audio/RecognitionEngine';
import { AudioMetrics } from 'lib/audio/AudioCapture';
import { AudioFingerprint } from 'lib/audio/AudioProcessor';

interface TestResults {
  timestamp: string;
  type: 'fingerprint' | 'recognition' | 'error';
  data: any;
}

export default function AudioTestPage() {
  const [isEngineRunning, setIsEngineRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResults[]>([]);
  const [engineStatus, setEngineStatus] = useState<string>('Stopped');
  const [autoRecognition, setAutoRecognition] = useState(false);
  const [recognitionInterval, setRecognitionInterval] = useState(10);

  const engineRef = useRef<RecognitionEngine | null>(null);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Audio capture hook
  const {
    isCapturing,
    isPermissionGranted,
    hasPermissionError,
    isSupported,
    error,
    metrics,
    audioData,
    fingerprint,
    startCapture,
    stopCapture,
    requestPermission,
    generateFingerprint,
    isAudioPlaying,
    getCaptureState
  } = useAudioCapture({
    autoStart: false,
    sampleRate: 44100,
    bufferSize: 4096,
    fingerprintInterval: 5000,
    onError: (error) => {
      addTestResult('error', { message: error });
    },
    onFingerprint: (fp) => {
      addTestResult('fingerprint', fp);
    }
  });

  // Initialize recognition engine
  useEffect(() => {
    engineRef.current = new RecognitionEngine({
      recognitionInterval: recognitionInterval,
      confidenceThreshold: 0.7,
      enableCollectionMatching: true,
      enableExternalAPIs: true
    });

    return () => {
      if (engineRef.current) {
        engineRef.current.stopRecognitionLoop();
      }
    };
  }, [recognitionInterval]);

  // Status monitoring
  useEffect(() => {
    if (isEngineRunning && engineRef.current) {
      statusIntervalRef.current = setInterval(() => {
        const status = engineRef.current?.getStatus();
        if (status) {
          setEngineStatus(`Running - Next: ${status.nextRecognitionIn}s | Total: ${status.totalRecognitions} | Success: ${status.successfulRecognitions}`);
        }
      }, 1000);
    } else {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
      setEngineStatus('Stopped');
    }

    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
    };
  }, [isEngineRunning]);

  const addTestResult = (type: TestResults['type'], data: any) => {
    setTestResults(prev => [
      {
        timestamp: new Date().toLocaleTimeString(),
        type,
        data
      },
      ...prev.slice(0, 19) // Keep last 20 results
    ]);
  };

  const handleStartEngine = async () => {
    if (!engineRef.current) return;

    try {
      const success = await engineRef.current.startRecognitionLoop();
      setIsEngineRunning(success);
      if (success) {
        addTestResult('recognition', { message: 'Recognition engine started' });
      }
    } catch (error) {
      addTestResult('error', { message: `Failed to start engine: ${error}` });
    }
  };

  const handleStopEngine = () => {
    if (engineRef.current) {
      engineRef.current.stopRecognitionLoop();
      setIsEngineRunning(false);
      addTestResult('recognition', { message: 'Recognition engine stopped' });
    }
  };

  const handleManualRecognition = async () => {
    if (!engineRef.current) return;

    try {
      const result = await engineRef.current.triggerManualRecognition();
      addTestResult('recognition', result || { message: 'No match found' });
    } catch (error) {
      addTestResult('error', { message: `Manual recognition failed: ${error}` });
    }
  };

  const handleManualFingerprint = () => {
    const fp = generateFingerprint();
    if (fp) {
      addTestResult('fingerprint', fp);
    } else {
      addTestResult('error', { message: 'Could not generate fingerprint' });
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const formatAudioMetrics = (metrics: AudioMetrics | null) => {
    if (!metrics) return 'No metrics';
    
    return `Volume: ${(metrics.volume * 100).toFixed(1)}% | Freq: ${metrics.frequency.toFixed(0)}Hz | Playing: ${metrics.isPlaying ? '🔊' : '🔇'}`;
  };

  const formatFingerprint = (fp: AudioFingerprint | null) => {
    if (!fp) return 'No fingerprint';
    
    return `Hash: ${fp.hash.substring(0, 8)}... | Confidence: ${(fp.confidence * 100).toFixed(1)}% | Energy: ${fp.features.energy.toFixed(4)}`;
  };

  return (
    <div style={{
      padding: '2rem',
      maxWidth: '1200px',
      margin: '0 auto',
      background: '#fff',
      color: '#000',
      borderRadius: 12,
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '2px solid #e5e7eb' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>
          Audio Recognition Test Interface
        </h1>
        <p style={{ color: '#6b7280', margin: 0 }}>
          Test audio capture, fingerprinting, and recognition functionality
        </p>
      </div>

      {/* Browser Support Check */}
      {!isSupported && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
          color: '#dc2626'
        }}>
          <strong>❌ Audio capture not supported in this browser</strong>
          <p>Please use a modern browser with Web Audio API support.</p>
        </div>
      )}

      {/* Permission Status */}
      {isSupported && (
        <div style={{
          background: hasPermissionError ? '#fef2f2' : isPermissionGranted ? '#f0fdf4' : '#fffbeb',
          border: `1px solid ${hasPermissionError ? '#fca5a5' : isPermissionGranted ? '#bbf7d0' : '#fcd34d'}`,
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
          color: hasPermissionError ? '#dc2626' : isPermissionGranted ? '#16a34a' : '#92400e'
        }}>
          <strong>
            {hasPermissionError ? '❌ Permission Denied' : 
             isPermissionGranted ? '✅ Permission Granted' : 
             '⚠️ Permission Required'}
          </strong>
          <p>
            {hasPermissionError ? 'Microphone access was denied. Please refresh and allow microphone access.' :
             isPermissionGranted ? 'Microphone access granted and ready.' :
             'Microphone permission is required for audio capture.'}
          </p>
          {!isPermissionGranted && !hasPermissionError && (
            <button
              onClick={requestPermission}
              style={{
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                cursor: 'pointer',
                marginTop: 8
              }}
            >
              Request Permission
            </button>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
          color: '#dc2626'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Controls Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 24,
        marginBottom: 32
      }}>
        
        {/* Audio Capture Controls */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 20
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: 16, color: '#1f2937' }}>
            Audio Capture
          </h3>
          
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: 8 }}>
              Status: <strong style={{ color: isCapturing ? '#16a34a' : '#dc2626' }}>
                {isCapturing ? 'Capturing' : 'Stopped'}
              </strong>
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: 12 }}>
              {formatAudioMetrics(metrics)}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={startCapture}
              disabled={!isSupported || !isPermissionGranted || isCapturing}
              style={{
                background: isCapturing ? '#9ca3af' : '#16a34a',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                cursor: isCapturing ? 'not-allowed' : 'pointer',
                fontSize: 14
              }}
            >
              {isCapturing ? 'Capturing...' : 'Start Capture'}
            </button>
            
            <button
              onClick={stopCapture}
              disabled={!isCapturing}
              style={{
                background: !isCapturing ? '#9ca3af' : '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                cursor: !isCapturing ? 'not-allowed' : 'pointer',
                fontSize: 14
              }}
            >
              Stop Capture
            </button>

            <button
              onClick={handleManualFingerprint}
              disabled={!isCapturing}
              style={{
                background: !isCapturing ? '#9ca3af' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                cursor: !isCapturing ? 'not-allowed' : 'pointer',
                fontSize: 14
              }}
            >
              Generate Fingerprint
            </button>
          </div>

          {/* Fingerprint Display */}
          {fingerprint && (
            <div style={{
              marginTop: 12,
              padding: 12,
              background: '#e0f2fe',
              borderRadius: 6,
              fontSize: 12,
              fontFamily: 'monospace'
            }}>
              <strong>Latest Fingerprint:</strong><br/>
              {formatFingerprint(fingerprint)}
            </div>
          )}
        </div>

        {/* Recognition Engine Controls */}
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #16a34a',
          borderRadius: 12,
          padding: 20
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: 16, color: '#1f2937' }}>
            Recognition Engine
          </h3>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: 8 }}>
              Status: <strong style={{ color: isEngineRunning ? '#16a34a' : '#dc2626' }}>
                {engineStatus}
              </strong>
            </div>
            
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '14px', color: '#374151', display: 'block', marginBottom: 4 }}>
                Recognition Interval (seconds):
              </label>
              <input
                type="number"
                min="5"
                max="60"
                value={recognitionInterval}
                onChange={(e) => setRecognitionInterval(parseInt(e.target.value) || 10)}
                disabled={isEngineRunning}
                style={{
                  width: '80px',
                  padding: '4px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  fontSize: 14
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={handleStartEngine}
              disabled={isEngineRunning || !isCapturing}
              style={{
                background: isEngineRunning || !isCapturing ? '#9ca3af' : '#16a34a',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                cursor: isEngineRunning || !isCapturing ? 'not-allowed' : 'pointer',
                fontSize: 14
              }}
            >
              Start Engine
            </button>
            
            <button
              onClick={handleStopEngine}
              disabled={!isEngineRunning}
              style={{
                background: !isEngineRunning ? '#9ca3af' : '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                cursor: !isEngineRunning ? 'not-allowed' : 'pointer',
                fontSize: 14
              }}
            >
              Stop Engine
            </button>

            <button
              onClick={handleManualRecognition}
              disabled={!isCapturing}
              style={{
                background: !isCapturing ? '#9ca3af' : '#7c3aed',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                cursor: !isCapturing ? 'not-allowed' : 'pointer',
                fontSize: 14
              }}
            >
              Manual Recognition
            </button>
          </div>
        </div>
      </div>

      {/* Test Results */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: 20
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: '#1f2937' }}>
            Test Results ({testResults.length})
          </h3>
          <button
            onClick={clearResults}
            style={{
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 12
            }}
          >
            Clear Results
          </button>
        </div>

        <div style={{
          maxHeight: 400,
          overflowY: 'auto',
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: 12
        }}>
          {testResults.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#6b7280', padding: 20 }}>
              No test results yet. Start capturing audio to see results.
            </div>
          ) : (
            testResults.map((result, index) => (
              <div
                key={index}
                style={{
                  marginBottom: 12,
                  padding: 12,
                  background: result.type === 'error' ? '#fef2f2' : 
                             result.type === 'fingerprint' ? '#eff6ff' : '#f0fdf4',
                  border: `1px solid ${result.type === 'error' ? '#fca5a5' : 
                                      result.type === 'fingerprint' ? '#bfdbfe' : '#bbf7d0'}`,
                  borderRadius: 6,
                  fontSize: 12,
                  fontFamily: 'monospace'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  marginBottom: 4,
                  fontWeight: 'bold'
                }}>
                  <span style={{
                    color: result.type === 'error' ? '#dc2626' : 
                           result.type === 'fingerprint' ? '#2563eb' : '#16a34a'
                  }}>
                    {result.type.toUpperCase()}
                  </span>
                  <span style={{ color: '#6b7280' }}>{result.timestamp}</span>
                </div>
                <div style={{ color: '#374151' }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 11 }}>
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Debug Information */}
      <div style={{
        marginTop: 24,
        padding: 16,
        background: '#f1f5f9',
        border: '1px solid #cbd5e1',
        borderRadius: 8,
        fontSize: 12,
        fontFamily: 'monospace'
      }}>
        <strong>Debug Info:</strong><br/>
        Audio Playing: {isAudioPlaying() ? '🔊 Yes' : '🔇 No'} | 
        Capture State: {JSON.stringify(getCaptureState())} | 
        Audio Data Length: {audioData?.length || 0}
      </div>
    </div>
  );
}