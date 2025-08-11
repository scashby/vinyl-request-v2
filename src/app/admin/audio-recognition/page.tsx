// src/app/admin/audio-recognition/page.tsx
// COMPLETE FUNCTIONAL INTERFACE - Manual override, TV updates, all results visible

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface ServiceResult {
  service: string;
  status: 'success' | 'failed' | 'error' | 'skipped';
  result?: {
    artist: string;
    title: string;
    album: string;
    confidence: number;
    source: string;
    service: string;
    image_url?: string;
    albumId?: number;
  };
  error?: string;
  processingTime: number;
}

interface RecognitionResponse {
  success: boolean;
  autoSelected?: ServiceResult['result'];
  alternatives?: ServiceResult['result'][];
  serviceResults: ServiceResult[];
  processingTime: number;
  error?: string;
}

type ListeningStatus = 'idle' | 'requesting-permission' | 'permission-denied' | 'listening' | 'recording' | 'searching' | 'results' | 'error';
type PermissionState = 'unknown' | 'granted' | 'denied' | 'prompt';

export default function FunctionalAudioRecognition() {
  // Core state
  const [status, setStatus] = useState<ListeningStatus>('idle');
  const [isListening, setIsListening] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState>('unknown');
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Recognition results
  const [lastResult, setLastResult] = useState<RecognitionResponse | null>(null);
  const [selectedResult, setSelectedResult] = useState<ServiceResult['result'] | null>(null);
  const [isUpdatingTV, setIsUpdatingTV] = useState(false);

  // Settings
  const [autoInterval, setAutoInterval] = useState(15);
  const [nextRecognitionIn, setNextRecognitionIn] = useState<number | null>(null);

  // Activity and stats
  const [recognitionCount, setRecognitionCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

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

  // Check browser capabilities
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
    
    return secure && support.getUserMedia;
  }, [addLog]);

  // Check permission state
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
      
      return state;
    } catch (error) {
      addLog(`Permission check failed: ${error instanceof Error ? error.message : 'Unknown'}`, 'warning');
      return 'unknown';
    }
  }, [browserSupport.permissions, addLog]);

  // Request microphone permission
  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    try {
      setStatus('requesting-permission');
      setPermissionError(null);
      addLog('🎤 Requesting microphone permission...', 'info');

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      const permState = await checkPermissionState();
      
      if (permState === 'denied') {
        const message = 'Microphone blocked. Click microphone icon in address bar to allow, then refresh.';
        setPermissionError(message);
        addLog(message, 'error');
        setStatus('permission-denied');
        return false;
      }

      addLog('Showing microphone permission dialog...', 'info');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      if (stream.getAudioTracks().length === 0) {
        throw new Error('No audio tracks in stream');
      }

      const audioTrack = stream.getAudioTracks()[0];
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
      }

      addLog(`❌ ${errorMessage}: ${error.message}`, 'error');
      setPermissionError(`${errorMessage}. ${userHelp}`);
      setPermissionState('denied');
      setStatus('permission-denied');
      
      return false;
    }
  }, [addLog, checkPermissionState]);

  // Base64 conversion
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

  // Audio recording and recognition
  const performRecognition = useCallback(async (triggeredBy: string = 'manual') => {
    if (!streamRef.current || streamRef.current.getTracks().length === 0) {
      addLog('No active microphone stream - requesting permission...', 'warning');
      const granted = await requestMicrophonePermission();
      if (!granted) {
        addLog('Cannot proceed without microphone access', 'error');
        return;
      }
    }

    setStatus('recording');
    addLog(`🎤 Starting recognition (${triggeredBy})...`, 'info');
    setRecognitionCount(prev => prev + 1);
    
    const startTime = Date.now();

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current!, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      const audioChunks: Blob[] = [];
      let recordingProgress = 0;
      let totalSize = 0;
      
      const progressInterval = setInterval(() => {
        recordingProgress += 1;
        if (recordingProgress <= 10) {
          addLog(`🔴 Recording audio... ${recordingProgress}/10 seconds (${Math.round(totalSize / 1024)}KB)`, 'info');
        }
      }, 1000);
      
      const recordingPromise = new Promise<Blob>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Recording timeout'));
        }, 12000);

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            totalSize += event.data.size;
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
          addLog(`✅ Audio recorded: ${Math.round(audioBlob.size / 1024)}KB`, 'success');
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
      addLog('🔍 Sending audio to recognition services...', 'info');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch('/api/audio-recognition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioData: base64Audio,
          triggeredBy: `microphone_${triggeredBy}`,
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
      
      // Log individual service results
      if (result.serviceResults) {
        addLog('🔍 Service results received:', 'info');
        result.serviceResults.forEach(serviceResult => {
          if (serviceResult.status === 'success') {
            addLog(`✅ ${serviceResult.service}: ${serviceResult.result!.artist} - ${serviceResult.result!.title}`, 'success');
          } else if (serviceResult.status === 'failed') {
            addLog(`⚠️ ${serviceResult.service}: No match found`, 'warning');
          } else if (serviceResult.status === 'error') {
            addLog(`❌ ${serviceResult.service}: ${serviceResult.error}`, 'error');
          } else {
            addLog(`⏸️ ${serviceResult.service}: Skipped - ${serviceResult.error}`, 'info');
          }
        });
      }
      
      if (result.success && result.autoSelected) {
        setStatus('results');
        setSuccessCount(prev => prev + 1);
        setSelectedResult(result.autoSelected);
        addLog(`🎉 Recognition successful: ${result.autoSelected.artist} - ${result.autoSelected.title}`, 'success');
        addLog(`Auto-selected from: ${result.autoSelected.service} (${Math.round(result.autoSelected.confidence * 100)}% confidence)`, 'success');
      } else {
        setStatus('error');
        addLog(`❌ Recognition failed: No matches found`, 'error');
        if (result.error) {
          addLog(`Details: ${result.error}`, 'error');
        }
      }

      addLog(`Total processing: ${processingTime}ms`, 'info');
      setLastResult(result);

    } catch (err) {
      setStatus('error');
      const errorMessage = err instanceof Error ? err.message : 'Recognition failed';
      addLog(`❌ Recognition error: ${errorMessage}`, 'error');
      setLastResult(null);
    }
  }, [addLog, requestMicrophonePermission, arrayBufferToBase64]);

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
    if (permissionState !== 'granted') {
      const granted = await requestMicrophonePermission();
      if (!granted) {
        addLog('Cannot start auto-recognition without microphone access', 'error');
        return;
      }
    }

    setIsListening(true);
    setStatus('listening');
    addLog(`🎤 Auto-recognition started (every ${autoInterval}s)`, 'success');

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

  // Update TV with selected result
  const updateTV = useCallback(async (result: ServiceResult['result']) => {
    if (!result) return;
    
    setIsUpdatingTV(true);
    addLog(`📺 Updating TV display with: ${result.artist} - ${result.title}`, 'info');
    
    try {
      // Update now_playing table
      const { error: nowPlayingError } = await supabase
        .from('now_playing')
        .upsert({
          id: 1,
          artist: result.artist,
          title: result.title,
          album_title: result.album,
          album_id: result.albumId || null,
          recognition_image_url: result.image_url,
          started_at: new Date().toISOString(),
          recognition_confidence: result.confidence,
          service_used: result.service,
          updated_at: new Date().toISOString()
        });
      
      if (nowPlayingError) {
        throw nowPlayingError;
      }
      
      // Log the manual selection
      await supabase
        .from('audio_recognition_logs')
        .insert({
          artist: result.artist,
          title: result.title,
          album: result.album,
          source: result.source,
          service: result.service,
          confidence: result.confidence,
          confirmed: true, // Manual selection is confirmed
          match_source: result.source === 'collection' ? 'collection' : 'external',
          matched_id: result.albumId || null,
          now_playing: true,
          raw_response: { manual_selection: true, original_result: result },
          created_at: new Date().toISOString()
        });
      
      addLog(`✅ TV display updated successfully!`, 'success');
      
    } catch (error) {
      addLog(`❌ Failed to update TV: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsUpdatingTV(false);
    }
  }, [supabase, addLog]);

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

  // Get all available results for selection
  const getAllResults = (): ServiceResult['result'][] => {
    if (!lastResult) return [];
    
    const results: ServiceResult['result'][] = [];
    
    if (lastResult.autoSelected) {
      results.push(lastResult.autoSelected);
    }
    
    if (lastResult.alternatives) {
      results.push(...lastResult.alternatives);
    }
    
    return results;
  };

  const allResults = getAllResults();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🎤 Audio Recognition with Manual Override</h1>
              <p className="text-gray-600">Record audio, see all results, choose the best match, update TV display</p>
            </div>
            <div className="flex gap-3">
              <Link 
                href="/admin/audio-recognition/collection"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                🔍 Collection Match
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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Microphone Status Warning */}
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
                {status === 'idle' && (permissionState === 'granted' ? 'Ready for Audio Recognition' : 'Click to Enable Microphone')}
                {status === 'requesting-permission' && 'Requesting Microphone Permission...'}
                {status === 'listening' && 'Listening - Results Will Appear Below...'}
                {status === 'recording' && 'Recording Audio (10 seconds)...'}
                {status === 'searching' && 'Checking All Recognition Services...'}
                {status === 'results' && 'Recognition Complete - Choose Your Result Below!'}
                {status === 'error' && 'Recognition Complete - Check Results Below'}
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
                  🎤 Start Audio Recognition
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

        {/* RECOGNITION RESULTS - ALL SERVICES */}
        {lastResult && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
            
            {/* Left Column - All Results for Manual Selection */}
            <div className="xl:col-span-2">
              <div className="bg-white rounded-lg shadow border">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold">🎵 All Recognition Results - Choose Your Match</h3>
                  <p className="text-sm text-gray-600 mt-1">Click any result to select it, then update the TV display</p>
                </div>

                {allResults.length > 0 ? (
                  <div className="p-6 space-y-4">
                    {allResults.map((result, index) => (
                      <div
                        key={index}
                        onClick={() => setSelectedResult(result)}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          selectedResult === result
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="font-medium text-lg text-gray-900 truncate">
                                {result.artist}
                              </div>
                              <span className={`px-2 py-1 text-xs rounded font-medium ${
                                result.source === 'collection' 
                                  ? 'bg-purple-100 text-purple-700' 
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {result.service}
                              </span>
                            </div>
                            <div className="text-gray-900 font-medium truncate mb-1">
                              {result.title}
                            </div>
                            <div className="text-sm text-gray-600 truncate mb-2">
                              {result.album}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-xs font-medium text-green-600">
                                {Math.round(result.confidence * 100)}% confidence
                              </div>
                              <div className="text-xs text-gray-500">
                                {result.source === 'collection' ? '🏆 Your Collection' : '🌐 External Service'}
                              </div>
                            </div>
                          </div>
                          
                          {result.image_url && (
                            <div className="ml-4 flex-shrink-0">
                              <Image
                                src={result.image_url}
                                alt={result.album}
                                width={64}
                                height={64}
                                className="object-cover rounded-lg"
                                unoptimized
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                          
                          <div className="ml-4 flex-shrink-0">
                            {selectedResult === result && (
                              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Update TV Button */}
                    {selectedResult && (
                      <div className="pt-4 border-t border-gray-200">
                        <button
                          onClick={() => updateTV(selectedResult)}
                          disabled={isUpdatingTV}
                          className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors font-medium"
                        >
                          {isUpdatingTV ? '📺 Updating TV Display...' : '📺 Update TV Display'}
                        </button>
                        
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <div className="text-sm font-medium text-gray-700 mb-1">Selected:</div>
                          <div className="text-sm text-gray-600">
                            {selectedResult.artist} - {selectedResult.title}
                          </div>
                          <div className="text-xs text-gray-500">
                            from {selectedResult.service} ({Math.round(selectedResult.confidence * 100)}% confidence)
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    No recognition results yet. Start a recognition to see matches here.
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Individual Service Results */}
            <div>
              <div className="bg-white rounded-lg shadow border">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold">🔍 Individual Service Results</h3>
                  <p className="text-sm text-gray-600 mt-1">Status from each recognition service</p>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {lastResult.serviceResults.map((service, index) => (
                    <div key={index} className={`p-4 border-b border-gray-100 ${
                      service.status === 'success' ? 'bg-green-50' :
                      service.status === 'failed' ? 'bg-yellow-50' :
                      service.status === 'error' ? 'bg-red-50' :
                      'bg-gray-50'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{service.service}</span>
                          <span className={`px-2 py-1 text-xs rounded ${
                            service.status === 'success' ? 'bg-green-100 text-green-700' :
                            service.status === 'failed' ? 'bg-yellow-100 text-yellow-700' :
                            service.status === 'error' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {service.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">
                          {service.processingTime}ms
                        </div>
                      </div>
                      
                      {service.status === 'success' && service.result && (
                        <div className="mt-2">
                          <div className="text-sm font-medium text-gray-900">{service.result.artist}</div>
                          <div className="text-sm text-gray-700">{service.result.title}</div>
                          <div className="text-xs text-gray-600">{service.result.album}</div>
                          <div className="text-xs text-blue-600 mt-1">
                            {Math.round(service.result.confidence * 100)}% confidence
                          </div>
                        </div>
                      )}
                      
                      {(service.status === 'failed' || service.status === 'error' || service.status === 'skipped') && (
                        <div className="mt-2 text-sm text-gray-600">
                          {service.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Activity Log */}
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold">Activity Log</h3>
            <div className="flex gap-2">
              <div className="text-sm text-gray-500">
                {logs.length} entries (newest first)
              </div>
              <button
                onClick={() => setLogs([])}
                className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
              >
                Clear
              </button>
            </div>
          </div>
          
          <div className="h-48 overflow-y-auto bg-gray-50 rounded p-3 font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-gray-500">No activity yet...</div>
            ) : (
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div key={index} className={`${
                    log.includes('✅') ? 'text-green-700' :
                    log.includes('❌') ? 'text-red-700' :
                    log.includes('⚠️') ? 'text-yellow-700' :
                    log.includes('📺') ? 'text-purple-700' :
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