// src/app/admin/audio-recognition/page.tsx
// Phase 3: Simple Shazam-like Interface with Auto-Recognition

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

interface AutoSelectedResult {
  artist: string;
  title: string;
  album: string;
  confidence: number;
  source: 'collection' | 'acrcloud' | 'audd' | 'acoustid' | 'shazam';
  service: string;
  image_url?: string;
  albumId?: number;
}

interface AlternativeResult {
  artist: string;
  title: string;
  album: string;
  confidence: number;
  source: string;
  service: string;
}

interface RecognitionResponse {
  success: boolean;
  autoSelected?: AutoSelectedResult;
  alternatives?: AlternativeResult[];
  processingTime: number;
  sourcesChecked: string[];
  stats?: {
    totalMatches: number;
    collectionMatches: number;
    externalMatches: number;
    autoSelectedSource: string;
    autoSelectedConfidence: number;
  };
  error?: string;
}

type ListeningStatus = 'idle' | 'listening' | 'searching' | 'results' | 'error';

export default function SimpleShazamInterface() {
  // Core state
  const [status, setStatus] = useState<ListeningStatus>('idle');
  const [isListening, setIsListening] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Recognition results
  const [lastResult, setLastResult] = useState<RecognitionResponse | null>(null);

  // Auto-recognition settings
  const [autoInterval, setAutoInterval] = useState(15); // seconds
  const [nextRecognitionIn, setNextRecognitionIn] = useState<number | null>(null);

  // Activity logs
  const [logs, setLogs] = useState<string[]>([]);

  // Refs for cleanup
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(true);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setLogs(prev => [...prev.slice(-9), logEntry]); // Keep last 10 logs
    console.log(`🎵 ${logEntry}`);
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    setIsListening(false);
    setStatus('idle');
    setNextRecognitionIn(null);
  }, []);

  // Request microphone permission
  const requestPermission = useCallback(async () => {
    try {
      addLog('Requesting microphone permission...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      streamRef.current = stream;
      setHasPermission(true);
      setPermissionError(null);
      addLog('✅ Microphone permission granted');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Permission denied';
      setPermissionError(errorMessage);
      addLog(`❌ Permission error: ${errorMessage}`);
      return false;
    }
  }, [addLog]);

  // Perform single recognition
  const performRecognition = useCallback(async (triggeredBy: string = 'manual') => {
    if (!streamRef.current) {
      addLog('❌ No audio stream available');
      return;
    }

    setStatus('searching');
    addLog(`🔍 Starting recognition (${triggeredBy})...`);
    
    const startTime = Date.now();

    try {
      // Record audio for 10 seconds
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      const audioChunks: Blob[] = [];
      
      const recordingPromise = new Promise<Blob>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Recording timeout'));
        }, 12000);

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          clearTimeout(timeout);
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          resolve(audioBlob);
        };

        mediaRecorder.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Recording failed'));
        };
      });

      mediaRecorder.start(100);
      addLog('🎤 Recording audio (10 seconds)...');
      
      // Record for 10 seconds
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 10000);

      const audioBlob = await recordingPromise;
      
      // Convert to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      addLog('📡 Sending to multi-source recognition...');

      // Call the new multi-source API
      const response = await fetch('/api/audio-recognition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioData: base64Audio,
          triggeredBy: `simple_interface_${triggeredBy}`,
          timestamp: new Date().toISOString()
        })
      });

      const result: RecognitionResponse = await response.json();
      
      if (result.success && result.autoSelected) {
        setStatus('results');
        addLog(`✅ Found: ${result.autoSelected.artist} - ${result.autoSelected.title} (${result.autoSelected.source})`);
      } else {
        setStatus('error');
        addLog(`❌ No match found: ${result.error || 'Unknown error'}`);
      }

      setLastResult(result);

    } catch (error) {
      setStatus('error');
      const errorMessage = error instanceof Error ? error.message : 'Recognition failed';
      addLog(`❌ Recognition error: ${errorMessage}`);
      setLastResult({
        success: false,
        error: errorMessage,
        processingTime: Date.now() - startTime,
        sourcesChecked: []
      });
    }
  }, [addLog]);

  // Start countdown for next recognition
  const startCountdown = useCallback(() => {
    setNextRecognitionIn(autoInterval);
    
    countdownRef.current = setInterval(() => {
      setNextRecognitionIn(prev => {
        if (prev === null || prev <= 1) {
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [autoInterval]);

  // Auto-recognition loop
  const startAutoRecognition = useCallback(async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) return;
    }

    setIsListening(true);
    setStatus('listening');
    addLog(`🎵 Auto-recognition started (every ${autoInterval} seconds)`);

    // Immediate recognition
    await performRecognition('auto_initial');

    // Set up interval for continuous recognition
    intervalRef.current = setInterval(async () => {
      if (isActiveRef.current && isListening) {
        await performRecognition('auto_interval');
        startCountdown();
      }
    }, autoInterval * 1000);

    startCountdown();
  }, [hasPermission, requestPermission, autoInterval, performRecognition, isListening, startCountdown, addLog]);

  // Stop listening
  const stopListening = useCallback(() => {
    cleanup();
    addLog('⏹️ Auto-recognition stopped');
  }, [cleanup, addLog]);

  // Override with alternative
  const selectAlternative = useCallback(async (alternative: AlternativeResult) => {
    try {
      addLog(`🔄 Overriding with: ${alternative.artist} - ${alternative.title}`);
      
      // Call manual recognition API to set this as now playing
      const response = await fetch('/api/manual-recognition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist: alternative.artist,
          title: alternative.title,
          album: alternative.album,
          confidence: alternative.confidence,
          source: 'manual_override_alternative'
        })
      });

      if (response.ok) {
        addLog(`✅ Override successful - TV updated`);
      } else {
        addLog(`❌ Override failed`);
      }
    } catch (error) {
      addLog(`❌ Override error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }, [addLog]);

  // Manual override button
  const handleManualOverride = useCallback(() => {
    window.open('/admin/audio-recognition/collection', '_blank');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    isActiveRef.current = true;
    return () => {
      isActiveRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🎵 Audio Recognition</h1>
              <p className="text-gray-600">Shazam-like automatic music recognition</p>
            </div>
            <div className="flex gap-3">
              <Link 
                href="/admin/audio-recognition/collection"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                🔍 Collection
              </Link>
              <Link 
                href="/now-playing-tv"
                target="_blank"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                📺 TV Display
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Main Control */}
        <div className="bg-white rounded-lg shadow border p-8 mb-6">
          <div className="text-center">
            {/* Status Icon */}
            <div className="mb-6">
              {status === 'idle' && <div className="text-6xl">🎵</div>}
              {status === 'listening' && <div className="text-6xl animate-pulse">🎤</div>}
              {status === 'searching' && <div className="text-6xl animate-spin">🔍</div>}
              {status === 'results' && <div className="text-6xl">✅</div>}
              {status === 'error' && <div className="text-6xl">❌</div>}
            </div>

            {/* Status Message */}
            <div className="mb-6">
              <div className="text-lg font-medium text-gray-900 mb-2">
                {status === 'idle' && 'Ready to Listen'}
                {status === 'listening' && 'Listening for Music...'}
                {status === 'searching' && 'Searching for Match...'}
                {status === 'results' && 'Found Match!'}
                {status === 'error' && 'No Match Found'}
              </div>
              
              {nextRecognitionIn && (
                <div className="text-sm text-gray-600">
                  Next recognition in {nextRecognitionIn} seconds
                </div>
              )}
              
              {permissionError && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  Microphone Error: {permissionError}
                </div>
              )}
            </div>

            {/* Main Control Buttons */}
            <div className="space-y-4">
              {!isListening ? (
                <button
                  onClick={startAutoRecognition}
                  className="w-full py-4 text-lg font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  🎵 Start Listening
                </button>
              ) : (
                <button
                  onClick={stopListening}
                  className="w-full py-4 text-lg font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  ⏹️ Stop Listening
                </button>
              )}

              {!isListening && hasPermission && (
                <button
                  onClick={() => performRecognition('manual_single')}
                  disabled={status === 'searching'}
                  className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                >
                  {status === 'searching' ? '🔄 Searching...' : '🎯 Recognize Now'}
                </button>
              )}
            </div>

            {/* Settings */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-center gap-4">
                <label className="text-sm text-gray-600">Auto-recognition interval:</label>
                <select
                  value={autoInterval}
                  onChange={(e) => setAutoInterval(parseInt(e.target.value))}
                  disabled={isListening}
                  className="px-3 py-1 border border-gray-300 rounded text-gray-900"
                >
                  <option value={10}>10 seconds</option>
                  <option value={15}>15 seconds</option>
                  <option value={20}>20 seconds</option>
                  <option value={30}>30 seconds</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Results Section */}
        {lastResult && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Auto-Selected Result */}
            {lastResult.success && lastResult.autoSelected && (
              <div className="bg-white rounded-lg shadow border p-6">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-lg font-semibold">🏆 Auto-Selected & Applied to TV</h3>
                  <span className={`px-2 py-1 text-xs rounded ${
                    lastResult.autoSelected.source === 'collection' 
                      ? 'bg-purple-100 text-purple-700' 
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {lastResult.autoSelected.source === 'collection' ? 'Collection' : 'External'}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className="font-medium text-lg">{lastResult.autoSelected.artist}</div>
                  <div className="text-gray-900">{lastResult.autoSelected.title}</div>
                  <div className="text-gray-600 text-sm">{lastResult.autoSelected.album}</div>
                  <div className="text-xs text-gray-500">
                    {Math.round(lastResult.autoSelected.confidence * 100)}% confidence • {lastResult.autoSelected.service}
                  </div>
                </div>
              </div>
            )}

            {/* Alternative Results */}
            {lastResult.alternatives && lastResult.alternatives.length > 0 && (
              <div className="bg-white rounded-lg shadow border p-6">
                <h3 className="text-lg font-semibold mb-3">Other Possibilities</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {lastResult.alternatives.map((alt, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded hover:bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{alt.artist}</div>
                        <div className="text-sm text-gray-600 truncate">{alt.title}</div>
                        <div className="text-xs text-gray-500">
                          {Math.round(alt.confidence * 100)}% • {alt.source}
                        </div>
                      </div>
                      <button
                        onClick={() => selectAlternative(alt)}
                        className="ml-3 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        ✓ Use This
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow border p-6 mb-6">
          <h3 className="text-lg font-semibold mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleManualOverride}
              className="p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              ❌ Manual Override
            </button>
            <button
              onClick={() => window.open('/now-playing-tv', '_blank')}
              className="p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              📺 View TV Display
            </button>
          </div>
        </div>

        {/* Activity Log */}
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold">Activity Log</h3>
            <button
              onClick={() => setLogs([])}
              className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
            >
              Clear
            </button>
          </div>
          
          <div className="h-32 overflow-y-auto bg-gray-50 rounded p-3 font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-gray-500">No activity yet...</div>
            ) : (
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div key={index} className="text-gray-700">{log}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}