// src/app/admin/audio-recognition/page.tsx
// COMPREHENSIVE FIX: Real microphone access + full audio recognition functionality

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

type ListeningStatus = 'idle' | 'requesting-permission' | 'permission-denied' | 'listening' | 'recording' | 'searching' | 'results' | 'error';
type PermissionState = 'unknown' | 'granted' | 'denied' | 'prompt' | 'not-supported';

export default function CompleteFixedAudioRecognition() {
  // Core state
  const [status, setStatus] = useState<ListeningStatus>('idle');
  const [isListening, setIsListening] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState>('unknown');
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

  // Browser capabilities
  const [isSecureContext, setIsSecureContext] = useState(false);
  const [browserSupport, setBrowserSupport] = useState({
    getUserMedia: false,
    mediaDevices: false,
    permissions: false
  });

  // Refs
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(true);
  const supabase = createClientComponentClient();

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setLogs(prev => [logEntry, ...prev.slice(0, 19)]);
    
    const emoji = {
      info: '🎵',
      success: '✅',
      error: '❌',
      warning: '⚠️'
    }[type];
    
    console.log(`${emoji} ${logEntry}`);
  }, []);

  // CRITICAL: Check browser capabilities and security context
  const checkBrowserSupport = useCallback(() => {
    const secure = window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost';
    setIsSecureContext(secure);
    
    const support = {
      getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      mediaDevices: !!navigator.mediaDevices,
      permissions: !!(navigator.permissions && navigator.permissions.query)
    };
    setBrowserSupport(support);
    
    addLog(`Browser check: HTTPS=${secure}, getUserMedia=${support.getUserMedia}, Permissions=${support.permissions}`, 'info');
    
    if (!secure) {
      addLog('WARNING: Not in secure context - microphone access may be blocked!', 'warning');
      setPermissionError('Site must be accessed via HTTPS for microphone access');
    }
    
    if (!support.getUserMedia) {
      addLog('ERROR: getUserMedia not supported', 'error');
      setPermissionError('Browser does not support microphone access');
    }
    
    return secure && support.getUserMedia;
  }, [addLog]);

  // CRITICAL: Check permission state using Permissions API
  const checkPermissionState = useCallback(async (): Promise<PermissionState> => {
    try {
      if (!browserSupport.permissions) {
        addLog('Permissions API not available - will try direct getUserMedia', 'warning');
        return 'unknown';
      }

      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      addLog(`Current microphone permission: ${result.state}`, 'info');
      
      const state = result.state as PermissionState;
      setPermissionState(state);
      
      result.addEventListener('change', () => {
        addLog(`Permission changed to: ${result.state}`, 'info');
        setPermissionState(result.state as PermissionState);
      });
      
      return state;
    } catch (error) {
      addLog(`Permission check failed: ${error instanceof Error ? error.message : 'Unknown'}`, 'warning');
      return 'unknown';
    }
  }, [browserSupport.permissions, addLog]);

  // Monitor now playing status
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
      // Silent error handling
    }
  }, [supabase]);

  // CRITICAL: Enhanced microphone permission request
  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    try {
      setStatus('requesting-permission');
      setPermissionError(null);
      addLog('🎤 Requesting microphone permission...', 'info');

      // Clean up existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Check permission state first
      const permState = await checkPermissionState();
      
      if (permState === 'denied') {
        const message = 'Microphone blocked. Click microphone icon in address bar to allow, then refresh.';
        setPermissionError(message);
        addLog(message, 'error');
        setStatus('permission-denied');
        return false;
      }

      addLog('Showing microphone permission dialog...', 'info');
      
      // Request with timeout
      const permissionTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Permission request timed out'));
        }, 30000);
      });

      const streamPromise = navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      const stream = await Promise.race([streamPromise, permissionTimeout]);

      // Verify stream
      if (stream.getAudioTracks().length === 0) {
        throw new Error('No audio tracks in stream');
      }

      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack.enabled || audioTrack.readyState !== 'live') {
        throw new Error('Audio track not active');
      }

      addLog(`✅ Microphone access granted! Device: ${audioTrack.label || 'Default'}`, 'success');

      streamRef.current = stream;
      setPermissionState('granted');
      setStatus('idle');
      
      return true;

    } catch (err) {
      const error = err as Error;
      let errorMessage = 'Failed to access microphone';
      let userHelp = '';

      if (error.name === 'NotAllowedError') {
        errorMessage = 'Microphone access denied';
        userHelp = 'Click the microphone icon in the address bar to allow';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No microphone found';
        userHelp = 'Connect a microphone and try again';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Microphone busy or unavailable';
        userHelp = 'Close other apps using the microphone';
      } else if (error.name === 'SecurityError') {
        errorMessage = 'Security error - blocked';
        userHelp = 'Must use HTTPS';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Permission dialog timed out';
        userHelp = 'Try again and click Allow';
      }

      addLog(`❌ ${errorMessage}: ${error.message}`, 'error');
      setPermissionError(`${errorMessage}. ${userHelp}`);
      setPermissionState('denied');
      setStatus('permission-denied');
      
      return false;
    }
  }, [addLog, checkPermissionState]);

  // Enhanced cleanup
  const cleanup = useCallback(() => {
    addLog('Cleaning up audio resources...', 'info');
    
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          addLog(`Stopped track: ${track.kind} (${track.label || 'unnamed'})`, 'info');
        });
        streamRef.current = null;
      }
      
      [intervalRef, countdownRef].forEach(ref => {
        if (ref.current) {
          clearInterval(ref.current);
          ref.current = null;
        }
      });

      setIsListening(false);
      setStatus('idle');
      setNextRecognitionIn(null);
      
      addLog('Cleanup complete', 'success');
    } catch (error) {
      addLog(`Cleanup error: ${error instanceof Error ? error.message : 'Unknown'}`, 'error');
    }
  }, [addLog]);

  // Stack-safe base64 conversion
  const arrayBufferToBase64 = useCallback((buffer: ArrayBuffer): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        addLog(`Converting ${Math.round(buffer.byteLength / 1024)}KB to base64...`, 'info');
        
        const blob = new Blob([buffer]);
        const reader = new FileReader();
        
        reader.onload = () => {
          try {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            addLog(`Base64 conversion complete: ${Math.round(base64.length / 1024)}KB`, 'success');
            resolve(base64);
          } catch (processingError) {
            addLog(`Base64 processing failed: ${processingError instanceof Error ? processingError.message : 'Unknown'}`, 'error');
            reject(new Error('Failed to process base64 result'));
          }
        };
        
        reader.onerror = () => reject(new Error('FileReader failed'));
        reader.readAsDataURL(blob);
        
      } catch (conversionError) {
        reject(conversionError);
      }
    });
  }, [addLog]);

  // COMPLETE: Enhanced audio recording with microphone verification
  const performRecognition = useCallback(async (triggeredBy: string = 'manual') => {
    // Ensure microphone access
    if (!streamRef.current || streamRef.current.getTracks().length === 0) {
      addLog('No active microphone stream - requesting permission...', 'warning');
      const granted = await requestMicrophonePermission();
      if (!granted) {
        addLog('Cannot proceed without microphone access', 'error');
        return;
      }
    }

    // Verify stream is still active
    const audioTracks = streamRef.current!.getAudioTracks();
    if (audioTracks.length === 0 || !audioTracks[0].enabled || audioTracks[0].readyState !== 'live') {
      addLog('Microphone stream inactive - refreshing...', 'warning');
      const granted = await requestMicrophonePermission();
      if (!granted) return;
    }

    setStatus('recording');
    addLog(`🎤 Starting REAL microphone recognition (${triggeredBy})...`, 'info');
    setRecognitionCount(prev => prev + 1);
    
    const startTime = Date.now();

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current!, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      const audioChunks: Blob[] = [];
      let recordingProgress = 0;
      let totalSize = 0;
      const MAX_AUDIO_SIZE = 8 * 1024 * 1024;
      
      const progressInterval = setInterval(() => {
        recordingProgress += 1;
        if (recordingProgress <= 10) {
          addLog(`🔴 Recording REAL audio... ${recordingProgress}/10 seconds (${Math.round(totalSize / 1024)}KB)`, 'info');
        }
      }, 1000);
      
      const recordingPromise = new Promise<Blob>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Recording timeout'));
        }, 12000);

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            totalSize += event.data.size;
            
            if (totalSize > MAX_AUDIO_SIZE) {
              clearTimeout(timeout);
              clearInterval(progressInterval);
              mediaRecorder.stop();
              reject(new Error(`Audio too large: ${Math.round(totalSize / 1024 / 1024)}MB`));
              return;
            }
            
            audioChunks.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          clearTimeout(timeout);
          clearInterval(progressInterval);
          
          if (totalSize === 0) {
            reject(new Error('No audio data captured - check microphone'));
            return;
          }
          
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          addLog(`✅ REAL audio recorded: ${Math.round(audioBlob.size / 1024)}KB`, 'success');
          resolve(audioBlob);
        };

        mediaRecorder.onerror = (event) => {
          clearTimeout(timeout);
          clearInterval(progressInterval);
          const error = (event as ErrorEvent).error || new Error('Recording failed');
          reject(error);
        };
      });

      mediaRecorder.start(100);
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 10000);

      const audioBlob = await recordingPromise;
      
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = await arrayBufferToBase64(arrayBuffer);
      
      setStatus('searching');
      addLog('🔍 Sending REAL audio to recognition engine...', 'info');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      const response = await fetch('/api/audio-recognition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioData: base64Audio,
          triggeredBy: `real_microphone_${triggeredBy}`,
          timestamp: new Date().toISOString()
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const result: RecognitionResponse = await response.json();
      const processingTime = Date.now() - startTime;
      
      if (result.success && result.autoSelected) {
        setStatus('results');
        setSuccessCount(prev => prev + 1);
        addLog(`🎉 SUCCESS: ${result.autoSelected.artist} - ${result.autoSelected.title}`, 'success');
        addLog(`Source: ${result.autoSelected.source} (${Math.round(result.autoSelected.confidence * 100)}% confidence)`, 'success');
        
        if (result.stats?.realAudioProcessing) {
          addLog('✅ Real audio fingerprinting completed', 'success');
        }
        
        if (result.stats?.spotifyEnhanced) {
          addLog('Enhanced with Spotify metadata', 'success');
        }
        
        // Monitor TV display update
        setTimeout(() => {
          monitorNowPlaying();
          addLog('TV display should be updated', 'info');
        }, 1000);
        
      } else {
        setStatus('error');
        addLog(`❌ No match found: ${result.error || 'Unknown error'}`, 'error');
        addLog(`Sources checked: ${result.sourcesChecked.join(', ')}`, 'warning');
      }

      addLog(`Total processing: ${processingTime}ms`, 'info');
      setLastResult(result);

    } catch (err) {
      setStatus('error');
      const errorMessage = err instanceof Error ? err.message : 'Recognition failed';
      addLog(`❌ Recognition error: ${errorMessage}`, 'error');
      
      setLastResult({
        success: false,
        error: errorMessage,
        processingTime: Date.now() - startTime,
        sourcesChecked: []
      });
    }
  }, [addLog, requestMicrophonePermission, arrayBufferToBase64, monitorNowPlaying]);

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

  // COMPLETE: Auto-recognition loop with enhanced error handling
  const startAutoRecognition = useCallback(async () => {
    if (permissionState !== 'granted') {
      const granted = await requestMicrophonePermission();
      if (!granted) {
        addLog('Cannot start auto-recognition without microphone access', 'error');
        return;
      }
    }

    setIsListening(true);
    setStatus('listening');
    addLog(`🎤 Auto-recognition started (every ${autoInterval}s) with REAL microphone`, 'success');

    // Immediate recognition
    await performRecognition('auto_initial');

    // Set up interval
    intervalRef.current = setInterval(async () => {
      if (isActiveRef.current && isListening) {
        try {
          await performRecognition('auto_interval');
          startCountdown();
        } catch (error) {
          addLog(`Auto-recognition error: ${error instanceof Error ? error.message : 'Unknown'}`, 'error');
          // Continue despite errors
        }
      }
    }, autoInterval * 1000);

    startCountdown();
  }, [permissionState, requestMicrophonePermission, autoInterval, performRecognition, isListening, startCountdown, addLog]);

  // Stop listening
  const stopListening = useCallback(() => {
    cleanup();
    addLog('Auto-recognition stopped', 'warning');
  }, [cleanup, addLog]);

  // Select alternative result
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

  // Force TV refresh
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

  // Initialize
  useEffect(() => {
    isActiveRef.current = true;
    
    const supported = checkBrowserSupport();
    if (supported) {
      checkPermissionState();
    }

    return () => {
      isActiveRef.current = false;
      cleanup();
    };
  }, [checkBrowserSupport, checkPermissionState, cleanup]);

  // Calculate success rate
  const successRate = recognitionCount > 0 ? Math.round((successCount / recognitionCount) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🎤 REAL Microphone Audio Recognition</h1>
              <p className="text-gray-600">Complete system with fixed microphone access</p>
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
        
        {/* CRITICAL: Microphone Status */}
        {(!isSecureContext || !browserSupport.getUserMedia || permissionState === 'denied') && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg">
            <h3 className="text-red-800 font-semibold">🚨 Microphone Access Issue</h3>
            {!isSecureContext && <p className="text-red-700">• Site must use HTTPS for microphone access</p>}
            {!browserSupport.getUserMedia && <p className="text-red-700">• Browser doesn&apos;t support microphone access</p>}
            {permissionState === 'denied' && <p className="text-red-700">• Microphone access is blocked</p>}
            {permissionError && <p className="text-red-700">• {permissionError}</p>}
            <button
              onClick={requestMicrophonePermission}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              🔄 Fix Microphone Access
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
              permissionState === 'granted' ? 'text-blue-600' : 
              'text-gray-400'
            }`}>
              {isListening ? '🎤 LIVE' : permissionState === 'granted' ? '🟢 READY' : '⏸️ SETUP'}
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
              {status === 'requesting-permission' && <div className="text-6xl animate-pulse">🎤</div>}
              {status === 'listening' && <div className="text-6xl animate-pulse">🎤</div>}
              {status === 'recording' && <div className="text-6xl animate-bounce">🔴</div>}
              {status === 'searching' && <div className="text-6xl animate-spin">🔍</div>}
              {status === 'results' && <div className="text-6xl">✅</div>}
              {status === 'error' && <div className="text-6xl">❌</div>}
            </div>

            {/* Status Message */}
            <div className="mb-6">
              <div className="text-lg font-medium text-gray-900 mb-2">
                {status === 'idle' && (permissionState === 'granted' ? 'Ready for REAL Audio Processing' : 'Click to Enable Microphone')}
                {status === 'requesting-permission' && 'Requesting Microphone Permission...'}
                {status === 'listening' && 'Listening for Music with REAL Microphone...'}
                {status === 'recording' && 'Recording REAL Audio (10 seconds)...'}
                {status === 'searching' && 'Processing REAL Audio...'}
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
                  disabled={!isSecureContext || !browserSupport.getUserMedia}
                  className="w-full py-4 text-lg font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                >
                  🎤 Start REAL Microphone Recognition
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
                  disabled={status === 'recording' || status === 'searching' || permissionState !== 'granted'}
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