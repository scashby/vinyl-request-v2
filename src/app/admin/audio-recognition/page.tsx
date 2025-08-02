// src/app/admin/audio-recognition/page.tsx
// IMPROVED: Better Real-time Status and TV Display Integration - FIXED ESLint Issues

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

export default function ImprovedAdminInterface() {
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
      console.error('Error monitoring now playing');
    }
  }, [supabase]);

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
      addLog('Requesting microphone permission...', 'info');
      
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
      addLog(`Permission error: ${errorMessage}`, 'error');
      return false;
    }
  }, [addLog]);

  // IMPROVED: Better audio recording with progress feedback
  const performRecognition = useCallback(async (triggeredBy: string = 'manual') => {
    if (!streamRef.current) {
      addLog('No audio stream available', 'error');
      return;
    }

    setStatus('recording');
    addLog(`Starting recognition (${triggeredBy}) with real audio processing...`, 'info');
    setRecognitionCount(prev => prev + 1);
    
    const startTime = Date.now();

    try {
      // Enhanced recording with progress feedback
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

        mediaRecorder.onerror = () => {
          clearTimeout(timeout);
          clearInterval(progressInterval);
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
      
      // Convert to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      setStatus('searching');
      addLog('Sending to IMPROVED multi-source recognition engine...', 'info');

      // Call the improved recognition API
      const response = await fetch('/api/audio-recognition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioData: base64Audio,
          triggeredBy: `improved_interface_${triggeredBy}`,
          timestamp: new Date().toISOString()
        })
      });

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
      setLastResult({
        success: false,
        error: errorMessage,
        processingTime: Date.now() - startTime,
        sourcesChecked: []
      });
    }
  }, [addLog, monitorNowPlaying]);

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
    addLog(`Auto-recognition started (every ${autoInterval}s) with IMPROVED engine`, 'success');

    // Immediate recognition
    await performRecognition('auto_initial');

    // Set up interval
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
    } catch (err) {
      addLog(`Override error: ${err instanceof Error ? err.message : 'Unknown'}`, 'error');
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
    } catch (err) {
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
              <h1 className="text-2xl font-bold text-gray-900">🎵 IMPROVED Audio Recognition</h1>
              <p className="text-gray-600">Real audio fingerprinting with Spotify enhancement</p>
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
            <div className={`text-2xl font-bold ${isListening ? 'text-green-600' : 'text-gray-400'}`}>
              {isListening ? '🎤 LIVE' : '⏸️ IDLE'}
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
                {status === 'idle' && 'Ready for Real Audio Processing'}
                {status === 'listening' && 'Listening for Music...'}
                {status === 'recording' && 'Recording Audio (10 seconds)...'}
                {status === 'searching' && 'Processing with IMPROVED Engine...'}
                {status === 'results' && 'Match Found & TV Updated!'}
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
                  🎵 Start IMPROVED Recognition
                </button>
              ) : (
                <button
                  onClick={stopListening}
                  className="w-full py-4 text-lg font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  ⏹️ Stop Recognition
                </button>
              )}

              {!isListening && hasPermission && (
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