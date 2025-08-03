// src/app/admin/audio-recognition/page.tsx
// CRITICAL FIX: Base64 conversion and stream management

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface AutoSelectedResult {
  artist: string;
  title: string;
  album: string;
  confidence: number;
  source: 'collection' | 'acrcloud' | 'audd' | 'acoustid' | 'shazam' | 'spotify';
  service: string;
  image_url?: string;
  albumId?: number;
  spotify_id?: string;
  duration_ms?: number;
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
    spotifyEnhanced?: boolean;
    realAudioProcessing?: boolean;
  };
  error?: string;
}

interface NowPlayingStatus {
  artist?: string;
  title?: string;
  album_title?: string;
  service_used?: string;
  recognition_confidence?: number;
  updated_at?: string;
}

type ListeningStatus = 'idle' | 'listening' | 'recording' | 'searching' | 'results' | 'error';

export default function FixedAudioRecognitionInterface() {
  // Core state
  const [status, setStatus] = useState<ListeningStatus>('idle');
  const [isListening, setIsListening] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Recognition results
  const [lastResult, setLastResult] = useState<RecognitionResponse | null>(null);
  const [nowPlayingStatus, setNowPlayingStatus] = useState<NowPlayingStatus | null>(null);

  // Settings
  const [autoInterval, setAutoInterval] = useState(15);
  const [nextRecognitionIn, setNextRecognitionIn] = useState<number | null>(null);

  // Activity logs and stats
  const [logs, setLogs] = useState<string[]>([]);
  const [recognitionCount, setRecognitionCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);

  // Refs
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(true);
  const supabase = createClientComponentClient();

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setLogs(prev => [logEntry, ...prev.slice(0, 19)]); // Keep last 20 logs, newest first
    
    const emoji = {
      info: '🎵',
      success: '✅',
      error: '❌',
      warning: '⚠️'
    }[type];
    
    console.log(`${emoji} ${logEntry}`);
  }, []);

  // FIXED: Proper base64 conversion for large audio files
  const arrayBufferToBase64 = useCallback((buffer: ArrayBuffer): string => {
    try {
      addLog(`Converting ${buffer.byteLength} bytes to base64...`, 'info');
      
      const bytes = new Uint8Array(buffer);
      const chunkSize = 8192; // Process in 8KB chunks to avoid stack overflow
      let binary = '';
      
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      
      const base64 = btoa(binary);
      addLog(`Base64 conversion complete: ${base64.length} characters`, 'success');
      return base64;
    } catch (error) {
      addLog(`Base64 conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      throw new Error('Failed to convert audio to base64');
    }
  }, [addLog]);

  // Monitor now playing status for TV display verification
  const monitorNowPlaying = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('now_playing')
        .select('artist, title, album_title, service_used, recognition_confidence, updated_at')
        .eq('id', 1)
        .single();

      if (!error && data) {
        setNowPlayingStatus(data);
      }
    } catch {
      // Silent error handling for monitoring
    }
  }, [supabase]);

  // FIXED: Better cleanup function with proper stream management
  const cleanup = useCallback(() => {
    addLog('Cleaning up audio resources...', 'info');
    
    // Stop all tracks in the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        addLog(`Stopped track: ${track.kind}`, 'info');
      });
      streamRef.current = null;
    }
    
    // Clear intervals
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
    setHasPermission(false); // Reset permission to force re-request
    
    addLog('Cleanup complete', 'success');
  }, [addLog]);

  // FIXED: Better permission request with error recovery
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      addLog('Requesting microphone permission...', 'info');
      
      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
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
      addLog('Microphone permission granted - ready for real audio processing', 'success');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Permission denied';
      setPermissionError(errorMessage);
      setHasPermission(false);
      addLog(`Permission error: ${errorMessage}`, 'error');
      return false;
    }
  }, [addLog]);

  // FIXED: Better audio recording with improved error handling
  const performRecognition = useCallback(async (triggeredBy: string = 'manual') => {
    if (!streamRef.current) {
      addLog('No audio stream available - requesting permission...', 'warning');
      const granted = await requestPermission();
      if (!granted) {
        addLog('Cannot proceed without microphone access', 'error');
        return;
      }
    }

    setStatus('recording');
    addLog(`Starting recognition (${triggeredBy}) with FIXED audio processing...`, 'info');
    setRecognitionCount(prev => prev + 1);
    
    const startTime = Date.now();

    try {
      // Enhanced recording with better error handling
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      const audioChunks: Blob[] = [];
      let recordingProgress = 0;
      
      const progressInterval = setInterval(() => {
        recordingProgress += 1;
        if (recordingProgress <= 10) {
          addLog(`Recording... ${recordingProgress}/10 seconds`, 'info');
        }
      }, 1000);
      
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
          clearInterval(progressInterval);
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          addLog(`Recording complete: ${audioBlob.size} bytes captured`, 'success');
          resolve(audioBlob);
        };

        mediaRecorder.onerror = (event) => {
          clearTimeout(timeout);
          clearInterval(progressInterval);
          addLog(`Recording error: ${event.error?.message || 'Unknown error'}`, 'error');
          reject(new Error('Recording failed'));
        };
      });

      mediaRecorder.start(100);
      
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 10000);

      const audioBlob = await recordingPromise;
      
      // FIXED: Use the improved base64 conversion
      const arrayBuffer = await audioBlob.arrayBuffer();
      addLog('Converting audio to base64 (this may take a moment)...', 'info');
      const base64Audio = arrayBufferToBase64(arrayBuffer);
      
      setStatus('searching');
      addLog('Sending to FIXED multi-source recognition engine...', 'info');

      // Call the improved recognition API
      const response = await fetch('/api/audio-recognition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioData: base64Audio,
          triggeredBy: `fixed_interface_${triggeredBy}`,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const result: RecognitionResponse = await response.json();
      const processingTime = Date.now() - startTime;
      
      if (result.success && result.autoSelected) {
        setStatus('results');
        setSuccessCount(prev => prev + 1);
        addLog(`SUCCESS: ${result.autoSelected.artist} - ${result.autoSelected.title}`, 'success');
        addLog(`Source: ${result.autoSelected.source} (${Math.round(result.autoSelected.confidence * 100)}% confidence)`, 'success');
        
        if (result.stats?.realAudioProcessing) {
          addLog('Real audio fingerprinting used', 'success');
        }
        
        if (result.stats?.spotifyEnhanced) {
          addLog('Enhanced with Spotify metadata', 'success');
        }
        
        // Monitor TV display update
        setTimeout(() => {
          monitorNowPlaying();
          addLog('TV display should be updated - check the display', 'info');
        }, 1000);
        
      } else {
        setStatus('error');
        addLog(`No match found: ${result.error || 'Unknown error'}`, 'error');
        addLog(`Checked sources: ${result.sourcesChecked.join(', ')}`, 'warning');
      }

      addLog(`Total processing time: ${processingTime}ms`, 'info');
      setLastResult(result);

    } catch (err) {
      setStatus('error');
      const errorMessage = err instanceof Error ? err.message : 'Recognition failed';
      addLog(`Recognition error: ${errorMessage}`, 'error');
      
      // FIXED: Better error recovery
      if (errorMessage.includes('call stack') || errorMessage.includes('memory')) {
        addLog('Memory/stack error detected - cleaning up...', 'warning');
        cleanup();
      }
      
      setLastResult({
        success: false,
        error: errorMessage,
        processingTime: Date.now() - startTime,
        sourcesChecked: []
      });
    }
  }, [addLog, monitorNowPlaying, arrayBufferToBase64, requestPermission, cleanup]);

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

  // FIXED: Better auto-recognition loop with error recovery
  const startAutoRecognition = useCallback(async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        addLog('Cannot start auto-recognition without microphone access', 'error');
        return;
      }
    }

    setIsListening(true);
    setStatus('listening');
    addLog(`Auto-recognition started (every ${autoInterval}s) with FIXED engine`, 'success');

    // Immediate recognition
    await performRecognition('auto_initial');

    // Set up interval with error handling
    intervalRef.current = setInterval(async () => {
      if (isActiveRef.current && isListening) {
        try {
          await performRecognition('auto_interval');
          startCountdown();
        } catch (error) {
          addLog(`Auto-recognition error: ${error instanceof Error ? error.message : 'Unknown'}`, 'error');
          // Continue running despite errors
        }
      }
    }, autoInterval * 1000);

    startCountdown();
  }, [hasPermission, requestPermission, autoInterval, performRecognition, isListening, startCountdown, addLog]);

  // Stop listening
  const stopListening = useCallback(() => {
    cleanup();
    addLog('Auto-recognition stopped', 'warning');
  }, [cleanup, addLog]);

  // Override with alternative
  const selectAlternative = useCallback(async (alternative: AlternativeResult) => {
    try {
      addLog(`Overriding with: ${alternative.artist} - ${alternative.title}`, 'info');
      
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
        addLog('Override successful - TV display updated', 'success');
        setTimeout(monitorNowPlaying, 1000);
      } else {
        addLog('Override failed', 'error');
      }
    } catch {
      addLog('Override error occurred', 'error');
    }
  }, [addLog, monitorNowPlaying]);

  // Manual override
  const handleManualOverride = useCallback(() => {
    addLog('Opening collection search for manual override', 'info');
    window.open('/admin/audio-recognition/collection', '_blank');
  }, [addLog]);

  // Force TV display refresh
  const forceRefreshTV = useCallback(async () => {
    try {
      addLog('Forcing TV display refresh...', 'info');
      await supabase.channel('now_playing_updates').send({
        type: 'broadcast',
        event: 'force_refresh',
        payload: { timestamp: new Date().toISOString() }
      });
      addLog('TV refresh signal sent', 'success');
    } catch {
      addLog('TV refresh failed', 'error');
    }
  }, [addLog, supabase]);

  // Monitor now playing changes
  useEffect(() => {
    monitorNowPlaying();
    const interval = setInterval(monitorNowPlaying, 5000);
    return () => clearInterval(interval);
  }, [monitorNowPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    isActiveRef.current = true;
    return () => {
      isActiveRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  // Calculate success rate
  const successRate = recognitionCount > 0 ? Math.round((successCount / recognitionCount) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🎵 FIXED Audio Recognition</h1>
              <p className="text-gray-600">Real audio fingerprinting with fixed base64 conversion</p>
            </div>
            <div className="flex gap-3">
              <Link 
                href="/admin/audio-recognition/collection"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                🔍 Collection
              </Link>
              <button
                onClick={forceRefreshTV}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                🔄 Refresh TV
              </button>
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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* FIXED: Error detection warning */}
        {permissionError && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg">
            <h3 className="text-red-800 font-semibold">Microphone Issue Detected</h3>
            <p className="text-red-700">{permissionError}</p>
            <button
              onClick={requestPermission}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              🔄 Retry Permission
            </button>
          </div>
        )}

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow border p-6">
            <div className="text-2xl font-bold text-blue-600">{recognitionCount}</div>
            <div className="text-sm text-gray-600">Recognitions Attempted</div>
          </div>
          <div className="bg-white rounded-lg shadow border p-6">
            <div className="text-2xl font-bold text-green-600">{successCount}</div>
            <div className="text-sm text-gray-600">Successful Matches</div>
          </div>
          <div className="bg-white rounded-lg shadow border p-6">
            <div className="text-2xl font-bold text-purple-600">{successRate}%</div>
            <div className="text-sm text-gray-600">Success Rate</div>
          </div>
          <div className="bg-white rounded-lg shadow border p-6">
            <div className={`text-2xl font-bold ${
              isListening ? 'text-green-600' : 
              hasPermission ? 'text-blue-600' : 
              'text-gray-400'
            }`}>
              {isListening ? '🎤 LIVE' : hasPermission ? '🟢 READY' : '⏸️ IDLE'}
            </div>
            <div className="text-sm text-gray-600">Status</div>
          </div>
        </div>

        {/* Current TV Display Status */}
        {nowPlayingStatus && (
          <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-green-800 mb-3">📺 Current TV Display</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="font-medium text-green-900">{nowPlayingStatus.artist}</div>
                <div className="text-green-700">{nowPlayingStatus.title}</div>
                <div className="text-sm text-green-600">{nowPlayingStatus.album_title}</div>
              </div>
              <div className="text-sm text-green-600">
                <div>Service: {nowPlayingStatus.service_used}</div>
                <div>Confidence: {nowPlayingStatus.recognition_confidence ? Math.round(nowPlayingStatus.recognition_confidence * 100) : 'N/A'}%</div>
                <div>Updated: {nowPlayingStatus.updated_at ? new Date(nowPlayingStatus.updated_at).toLocaleTimeString() : 'N/A'}</div>
              </div>
            </div>
          </div>
        )}

        {/* Main Control */}
        <div className="bg-white rounded-lg shadow border p-8 mb-6">
          <div className="text-center">
            {/* Status Icon */}
            <div className="mb-6">
              {status === 'idle' && <div className="text-6xl">🎵</div>}
              {status === 'listening' && <div className="text-6xl animate-pulse">🎤</div>}
              {status === 'recording' && <div className="text-6xl animate-bounce">🔴</div>}
              {status === 'searching' && <div className="text-6xl animate-spin">🔍</div>}
              {status === 'results' && <div className="text-6xl">✅</div>}
              {status === 'error' && <div className="text-6xl">❌</div>}
            </div>

            {/* Status Message */}
            <div className="mb-6">
              <div className="text-lg font-medium text-gray-900 mb-2">
                {status === 'idle' && (hasPermission ? 'Ready for FIXED Audio Processing' : 'Click to Grant Microphone Access')}
                {status === 'listening' && 'Listening for Music...'}
                {status === 'recording' && 'Recording Audio (10 seconds)...'}
                {status === 'searching' && 'Processing with FIXED Engine...'}
                {status === 'results' && 'Match Found & TV Updated!'}
                {status === 'error' && 'No Match Found'}
              </div>
              
              {nextRecognitionIn && (
                <div className="text-sm text-gray-600">
                  Next recognition in {nextRecognitionIn} seconds
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
                  🎵 Start FIXED Recognition
                </button>
              ) : (
                <button
                  onClick={stopListening}
                  className="w-full py-4 text-lg font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  ⏹️ Stop Recognition
                </button>
              )}

              {!isListening && (
                <button
                  onClick={() => performRecognition('manual_single')}
                  disabled={status === 'recording' || status === 'searching'}
                  className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                >
                  {status === 'recording' ? '🔴 Recording...' : 
                   status === 'searching' ? '🔄 Processing...' : 
                   '🎯 Single Recognition'}
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
                  <h3 className="text-lg font-semibold">🏆 Auto-Selected & TV Updated</h3>
                  <span className={`px-2 py-1 text-xs rounded ${
                    lastResult.autoSelected.source === 'collection' 
                      ? 'bg-purple-100 text-purple-700' 
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {lastResult.autoSelected.source}
                  </span>
                  {lastResult.stats?.spotifyEnhanced && (
                    <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-700">
                      Spotify Enhanced
                    </span>
                  )}
                </div>
                
                <div className="space-y-2">
                  <div className="font-medium text-lg">{lastResult.autoSelected.artist}</div>
                  <div className="text-gray-900">{lastResult.autoSelected.title}</div>
                  <div className="text-gray-600 text-sm">{lastResult.autoSelected.album}</div>
                  <div className="text-xs text-gray-500">
                    {Math.round(lastResult.autoSelected.confidence * 100)}% confidence • {lastResult.autoSelected.service}
                  </div>
                  {lastResult.autoSelected.duration_ms && (
                    <div className="text-xs text-blue-600">
                      Duration: {Math.floor(lastResult.autoSelected.duration_ms / 1000 / 60)}:{String(Math.floor((lastResult.autoSelected.duration_ms / 1000) % 60)).padStart(2, '0')}
                    </div>
                  )}
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={handleManualOverride}
              className="p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              ❌ Manual Override
            </button>
            <button
              onClick={forceRefreshTV}
              className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              🔄 Refresh TV
            </button>
            <button
              onClick={() => window.open('/now-playing-tv', '_blank')}
              className="p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              📺 View TV Display
            </button>
            <button
              onClick={() => setLogs([])}
              className="p-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              🗑️ Clear Logs
            </button>
          </div>
        </div>

        {/* Activity Log */}
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold">Activity Log</h3>
            <div className="text-sm text-gray-500">
              {logs.length} entries (newest first)
            </div>
          </div>
          
          <div className="h-40 overflow-y-auto bg-gray-50 rounded p-3 font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-gray-500">No activity yet...</div>
            ) : (
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div key={index} className={`${
                    log.includes('✅') ? 'text-green-700' :
                    log.includes('❌') ? 'text-red-700' :
                    log.includes('⚠️') ? 'text-yellow-700' :
                    'text-gray-700'
                  }`}>
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}