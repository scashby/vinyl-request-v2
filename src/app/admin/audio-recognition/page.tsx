// src/app/admin/audio-recognition/page.tsx - FIXED MediaRecorder Lifecycle + Enhanced Features

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

interface AudioRecognitionResult {
  artist?: string;
  title?: string;
  album?: string;
  confidence?: number;
  service?: string;
  source?: 'collection' | 'external';
  success: boolean;
  error?: string;
  processingTime: number;
  collectionId?: number;
}

interface AudioMetrics {
  volume: number;
  frequency: number;
  isPlaying: boolean;
  clarity: number;
}

interface AutoLoopSettings {
  enabled: boolean;
  interval: number; // seconds
  minVolume: number; // minimum volume threshold to trigger recognition
  collectionFirst: boolean; // check collection before external APIs
}

export default function EnhancedAudioRecognitionPage() {
  // Audio capture state
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [audioMetrics, setAudioMetrics] = useState<AudioMetrics | null>(null);
  const [status, setStatus] = useState<string>('Click "Start Auto Recognition" to begin');
  
  // Recognition results
  const [results, setResults] = useState<AudioRecognitionResult[]>([]);
  const [multiSourceResults, setMultiSourceResults] = useState<AudioRecognitionResult[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  
  // Auto-loop settings
  const [autoLoop, setAutoLoop] = useState<AutoLoopSettings>({
    enabled: false,
    interval: 10,
    minVolume: 5, // 5% minimum volume
    collectionFirst: true
  });
  
  // Refs for audio processing
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const autoLoopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastRecognitionRef = useRef<number>(0);
  const triggerRecognitionRef = useRef<((isAutoTrigger?: boolean) => Promise<void>) | null>(null);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-19), `[${timestamp}] ${message}`]);
    console.log(`🎵 [${timestamp}] ${message}`);
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (autoLoopTimeoutRef.current) {
      clearTimeout(autoLoopTimeoutRef.current);
      autoLoopTimeoutRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setIsRecording(false);
    setAudioMetrics(null);
  }, []);

  // Enhanced audio analysis with better volume detection
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const timeDataArray = new Float32Array(bufferLength);
    
    analyserRef.current.getByteFrequencyData(dataArray);
    analyserRef.current.getFloatTimeDomainData(timeDataArray);

    // Calculate RMS volume
    let sum = 0;
    for (let i = 0; i < timeDataArray.length; i++) {
      sum += timeDataArray[i] * timeDataArray[i];
    }
    const volume = Math.sqrt(sum / timeDataArray.length) * 100;

    // Find dominant frequency
    let maxIndex = 0;
    let maxValue = 0;
    for (let i = 0; i < dataArray.length; i++) {
      if (dataArray[i] > maxValue) {
        maxValue = dataArray[i];
        maxIndex = i;
      }
    }
    const frequency = (maxIndex * (audioContextRef.current?.sampleRate || 44100)) / (bufferLength * 2);
    
    // Calculate clarity (signal quality)
    const avgMagnitude = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
    const clarity = maxValue > 0 ? avgMagnitude / maxValue : 0;
    
    const isPlaying = volume > autoLoop.minVolume;
    
    setAudioMetrics({
      volume,
      frequency,
      isPlaying,
      clarity
    });

    // Auto-recognition trigger
    if (autoLoop.enabled && isPlaying && !isProcessing) {
      const now = Date.now();
      if (now - lastRecognitionRef.current >= autoLoop.interval * 1000) {
        lastRecognitionRef.current = now;
        addLog(`Auto-trigger: Volume ${volume.toFixed(1)}% >= ${autoLoop.minVolume}%`);
        triggerRecognitionRef.current?.(true);
      }
    }

    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
    }
  }, [isRecording, autoLoop.enabled, autoLoop.minVolume, autoLoop.interval, isProcessing, addLog]);

  // NEW: Helper function to refresh audio stream when needed
  const refreshAudioStream = useCallback(async (): Promise<void> => {
    addLog('🔄 Refreshing audio stream...');
    
    try {
      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Clean up audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      // Request new stream
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
      
      // Re-setup audio context for analysis
      const audioContext = new AudioContext({ sampleRate: 44100 });
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.3;
      
      analyserRef.current = analyser;
      source.connect(analyser);
      
      addLog('✅ Audio stream refreshed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Failed to refresh audio stream: ${errorMessage}`);
      throw error;
    }
  }, [addLog]);

  // FIXED: Start audio capture with enhanced setup
  const startCapture = useCallback(async () => {
    try {
      setStatus('Requesting microphone permission...');
      addLog('Requesting microphone access');
      
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Your browser does not support audio capture');
      }

      await refreshAudioStream(); // Use the new refresh function

      setHasPermission(true);
      setIsRecording(true);
      setStatus(autoLoop.enabled ? 
        `🎤 Auto-recognition active (every ${autoLoop.interval}s, min volume: ${autoLoop.minVolume}%)` :
        '🎤 Listening... Click "Recognize Now" when ready'
      );
      addLog('Audio capture started successfully');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Permission denied';
      setStatus(`❌ Error: ${errorMessage}`);
      addLog(`Error starting capture: ${errorMessage}`);
      setHasPermission(false);
      console.error('Audio capture error:', error);
    }
  }, [addLog, autoLoop.enabled, autoLoop.interval, autoLoop.minVolume, refreshAudioStream]);

  // Use effect to start analysis when recording begins
  useEffect(() => {
    if (isRecording) {
      analyzeAudio();
    }
  }, [isRecording, analyzeAudio]);

  // Stop audio capture
  const stopCapture = useCallback(() => {
    setAutoLoop(prev => ({ ...prev, enabled: false }));
    cleanup();
    setStatus('Audio capture stopped');
    addLog('Audio capture stopped');
  }, [cleanup, addLog]);

  // Multi-source recognition function
  const performMultiSourceRecognition = useCallback(async (base64Audio: string, isAutoTrigger: boolean) => {
    const results: AudioRecognitionResult[] = [];
    let bestResult: AudioRecognitionResult = {
      success: false,
      error: 'No recognition attempted',
      processingTime: 0
    };

    // Step 1: Check collection first (if enabled)
    if (autoLoop.collectionFirst) {
      try {
        addLog('Checking local collection...');
        const collectionResult = await fetch('/api/audio-recognition/collection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioData: base64Audio,
            triggeredBy: isAutoTrigger ? 'auto_collection' : 'manual_collection',
            timestamp: new Date().toISOString()
          })
        });

        if (collectionResult.ok) {
          const collectionData = await collectionResult.json();
          if (collectionData.success) {
            const result: AudioRecognitionResult = {
              ...collectionData.result,
              source: 'collection' as const,
              success: true,
              processingTime: 0
            };
            results.push(result);
            bestResult = result; // Collection match is always best
            addLog(`Collection match found: ${result.artist} - ${result.title}`);
            return { best: bestResult, all: results };
          }
        }
        addLog('No collection match found, trying external services...');
      } catch {
        addLog(`Collection check failed: Unknown error`);
      }
    }

    // Step 2: Try external recognition API
    try {
      const response = await fetch('/api/audio-recognition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioData: base64Audio,
          timestamp: new Date().toISOString(),
          triggeredBy: isAutoTrigger ? 'auto_external' : 'manual_external'
        })
      });

      const responseText = await response.text();
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = JSON.parse(responseText);

      if (result.success && result.result) {
        const externalResult: AudioRecognitionResult = {
          ...result.result,
          source: 'external' as const,
          success: true,
          processingTime: result.processingTime || 0
        };
        results.push(externalResult);
        
        if (!bestResult.success) {
          bestResult = externalResult;
        }
      }
    } catch {
      const errorMessage = 'External recognition failed';
      addLog(`External recognition error: ${errorMessage}`);
      
      if (!bestResult.success) {
        bestResult = {
          success: false,
          error: errorMessage,
          processingTime: 0
        };
      }
    }

    return { best: bestResult, all: results };
  }, [autoLoop.collectionFirst, addLog]);

  // FIXED: Enhanced recognition with proper MediaRecorder lifecycle
  const triggerRecognition = useCallback(async (isAutoTrigger = false) => {
    if (!streamRef.current || !isRecording) {
      setStatus('❌ No audio recording available');
      return;
    }

    setIsProcessing(true);
    const triggerType = isAutoTrigger ? 'Auto' : 'Manual';
    setStatus(`🔍 ${triggerType} recognition starting...`);
    addLog(`${triggerType} recognition triggered`);
    
    const startTime = Date.now();
    let mediaRecorder: MediaRecorder | null = null;

    try {
      // Ensure we have a fresh, active stream
      if (!streamRef.current.active) {
        addLog('Stream inactive, refreshing audio stream...');
        await refreshAudioStream();
        if (!streamRef.current) {
          throw new Error('Failed to refresh audio stream');
        }
      }

      // Create MediaRecorder with proper error handling
      try {
        mediaRecorder = new MediaRecorder(streamRef.current, {
          mimeType: 'audio/webm;codecs=opus'
        });
      } catch {
        // Fallback to default codec if opus not supported
        addLog('Opus codec not supported, falling back to default');
        mediaRecorder = new MediaRecorder(streamRef.current);
      }
      
      const audioChunks: Blob[] = [];
      
      // Set up event handlers BEFORE starting recording
      const dataAvailablePromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Recording timeout - no data received'));
        }, 12000); // 12 second timeout (10s record + 2s buffer)

        mediaRecorder!.ondataavailable = (event: BlobEvent) => {
          if (event.data && event.data.size > 0) {
            audioChunks.push(event.data);
            addLog(`Data chunk received: ${event.data.size} bytes`);
          }
        };

        mediaRecorder!.onstop = () => {
          clearTimeout(timeout);
          addLog(`Recording stopped. Total chunks: ${audioChunks.length}`);
          resolve();
        };

        mediaRecorder!.onerror = (event: Event) => {
          clearTimeout(timeout);
          const errorEvent = event as ErrorEvent;
          const error = errorEvent.error || new Error('MediaRecorder error');
          addLog(`MediaRecorder error: ${error.message}`);
          reject(error);
        };
      });

      // Start recording with data collection interval
      addLog('Starting MediaRecorder...');
      mediaRecorder.start(100); // Collect data every 100ms for better reliability
      
      // Verify recording started
      await new Promise(resolve => setTimeout(resolve, 100));
      if (mediaRecorder.state !== 'recording') {
        throw new Error(`MediaRecorder failed to start. State: ${mediaRecorder.state}`);
      }
      
      addLog(`Recording for 10 seconds... (State: ${mediaRecorder.state})`);
      
      // Record for 10 seconds
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Stop recording safely
      if (mediaRecorder.state === 'recording') {
        addLog('Stopping MediaRecorder...');
        mediaRecorder.stop();
      } else {
        addLog(`Unexpected recorder state when stopping: ${mediaRecorder.state}`);
      }

      // Wait for recording to complete
      await dataAvailablePromise;

      // Validate recording results
      if (audioChunks.length === 0) {
        throw new Error('No audio chunks received during recording');
      }

      const audioBlob = new Blob(audioChunks, { 
        type: audioChunks[0]?.type || 'audio/webm' 
      });
      
      if (audioBlob.size === 0) {
        throw new Error('Audio blob is empty despite having chunks');
      }

      const sizeKB = Math.round(audioBlob.size / 1024);
      addLog(`✅ Audio captured successfully: ${sizeKB}KB from ${audioChunks.length} chunks`);

      // Convert to base64 for API
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      setStatus('📡 Processing with collection-first matching...');

      // Enhanced recognition with multiple sources
      const recognitionResults = await performMultiSourceRecognition(base64Audio, isAutoTrigger);

      // Update results
      setResults(prev => [recognitionResults.best, ...prev.slice(0, 9)]);
      setMultiSourceResults(recognitionResults.all);

      if (recognitionResults.best.success) {
        const source = recognitionResults.best.source === 'collection' ? '🏆 Collection' : '🌐 External';
        setStatus(`✅ Found: ${recognitionResults.best.artist} - ${recognitionResults.best.title} (${source})`);
        addLog(`Recognition successful: ${recognitionResults.best.artist} - ${recognitionResults.best.title} from ${source}`);
      } else {
        setStatus(`❌ No match found: ${recognitionResults.best.error}`);
        addLog(`Recognition failed: ${recognitionResults.best.error}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Recognition failed';
      const processingTime = Date.now() - startTime;
      
      const errorResult: AudioRecognitionResult = {
        success: false,
        error: errorMessage,
        processingTime
      };
      
      setResults(prev => [errorResult, ...prev.slice(0, 9)]);
      setStatus(`❌ Error: ${errorMessage}`);
      addLog(`Recognition error: ${errorMessage}`);
      console.error('Recognition error:', error);
    } finally {
      // Cleanup MediaRecorder
      if (mediaRecorder) {
        try {
          if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
        } catch (cleanupError) {
          addLog(`Cleanup warning: ${cleanupError instanceof Error ? cleanupError.message : 'Unknown error'}`);
        }
        
        // Clear event handlers to prevent memory leaks
        mediaRecorder.ondataavailable = null;
        mediaRecorder.onstop = null;
        mediaRecorder.onerror = null;
      }
      
      setIsProcessing(false);
    }
  }, [isRecording, addLog, refreshAudioStream, performMultiSourceRecognition]);

  // Set the ref to the function for use in analyzeAudio
  triggerRecognitionRef.current = triggerRecognition;

  // Toggle auto-loop
  const toggleAutoLoop = useCallback(() => {
    if (autoLoop.enabled) {
      setAutoLoop(prev => ({ ...prev, enabled: false }));
      setStatus('🎤 Auto-recognition disabled - Manual mode');
      addLog('Auto-recognition disabled');
    } else {
      if (!isRecording) {
        startCapture();
      }
      setAutoLoop(prev => ({ ...prev, enabled: true }));
      setStatus(`🎤 Auto-recognition enabled (every ${autoLoop.interval}s)`);
      addLog('Auto-recognition enabled');
    }
  }, [autoLoop.enabled, isRecording, startCapture, addLog, autoLoop.interval]);

  // Test service connectivity
  const testServices = useCallback(async () => {
    setStatus('🔧 Testing all recognition services...');
    addLog('Testing service connectivity');
    
    try {
      const tests = [
        { name: 'Collection Match API', endpoint: '/api/audio-recognition/collection' },
        { name: 'External Recognition API', endpoint: '/api/audio-recognition' },
        { name: 'Manual Recognition API', endpoint: '/api/manual-recognition' },
        { name: 'Album Context API', endpoint: '/api/album-context' }
      ];

      for (const test of tests) {
        try {
          const response = await fetch(test.endpoint, { 
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          const statusText = response.ok ? '✅ Available' : `❌ Error ${response.status}`;
          addLog(`${test.name}: ${statusText}`);
        } catch {
          addLog(`${test.name}: ❌ Connection failed`);
        }
      }
      
      setStatus('🔧 Service test completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Service test failed: ${errorMessage}`);
    }
  }, [addLog]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Enhanced Audio Recognition System</h1>
              <p className="text-gray-600">Automatic recognition with collection-first matching</p>
            </div>
            <div className="flex gap-4">
              <Link 
                href="/admin/audio-recognition/collection"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                🔍 Collection Match
              </Link>
              <Link 
                href="/admin/admin-dashboard"
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                ← Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Status Display */}
      <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4`}>
        <div className={`p-4 rounded-lg border ${
          status.includes('❌') ? 'bg-red-50 border-red-200 text-red-800' :
          status.includes('✅') ? 'bg-green-50 border-green-200 text-green-800' :
          status.includes('🔍') || isProcessing ? 'bg-blue-50 border-blue-200 text-blue-800' :
          'bg-gray-50 border-gray-200 text-gray-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className="font-medium">{status}</span>
            {isProcessing && (
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Controls and Settings */}
          <div className="space-y-6">
            {/* Auto-Recognition Controls */}
            <div className="bg-white rounded-lg shadow border p-6">
              <h2 className="text-lg font-semibold mb-4">Auto-Recognition Controls</h2>
              
              <div className="space-y-4">
                <button
                  onClick={toggleAutoLoop}
                  className={`w-full py-3 rounded-lg font-medium transition-colors ${
                    autoLoop.enabled
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {autoLoop.enabled ? '⏹️ Stop Auto-Recognition' : '🎵 Start Auto-Recognition'}
                </button>

                {!autoLoop.enabled && hasPermission && (
                  <button
                    onClick={() => triggerRecognition(false)}
                    disabled={!isRecording || isProcessing}
                    className={`w-full py-3 rounded-lg font-medium transition-colors ${
                      !isRecording || isProcessing
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isProcessing ? '🔄 Processing...' : '🎵 Recognize Now (10s)'}
                  </button>
                )}

                {isRecording && (
                  <button
                    onClick={stopCapture}
                    className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    ⏹️ Stop Capture
                  </button>
                )}
                
                <button
                  onClick={testServices}
                  className="w-full py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  🔧 Test All Services
                </button>
              </div>
            </div>

            {/* Auto-Loop Settings */}
            <div className="bg-white rounded-lg shadow border p-6">
              <h3 className="text-lg font-semibold mb-4">Recognition Settings</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Recognition Interval: {autoLoop.interval} seconds
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    value={autoLoop.interval}
                    onChange={(e) => setAutoLoop(prev => ({ ...prev, interval: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>5s</span>
                    <span>30s</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Volume: {autoLoop.minVolume}%
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={autoLoop.minVolume}
                    onChange={(e) => setAutoLoop(prev => ({ ...prev, minVolume: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1%</span>
                    <span>20%</span>
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="collectionFirst"
                    checked={autoLoop.collectionFirst}
                    onChange={(e) => setAutoLoop(prev => ({ ...prev, collectionFirst: e.target.checked }))}
                    className="mr-2"
                  />
                  <label htmlFor="collectionFirst" className="text-sm font-medium text-gray-700">
                    Check collection first (recommended)
                  </label>
                </div>
              </div>
            </div>

            {/* Audio Metrics */}
            {audioMetrics && (
              <div className="bg-white rounded-lg shadow border p-6">
                <h3 className="text-lg font-semibold mb-4">Live Audio Metrics</h3>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Volume Level</span>
                      <span>{audioMetrics.volume.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full transition-all duration-200 ${
                          audioMetrics.isPlaying ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(100, audioMetrics.volume)}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Frequency:</span>
                      <div className="font-mono font-bold">{audioMetrics.frequency.toFixed(0)} Hz</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Clarity:</span>
                      <div className="font-mono font-bold">{(audioMetrics.clarity * 100).toFixed(1)}%</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <div className={`font-bold ${audioMetrics.isPlaying ? 'text-green-600' : 'text-red-600'}`}>
                        {audioMetrics.isPlaying ? '🟢 Audio' : '🔴 Silent'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Results and Logs */}
          <div className="space-y-6">
            {/* Recent Recognition Results */}
            {results.length > 0 && (
              <div className="bg-white rounded-lg shadow border p-6">
                <h3 className="text-lg font-semibold mb-4">Recent Recognition Results</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {results.map((result, index) => (
                    <div key={index} className={`p-3 rounded-md border ${
                      result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    }`}>
                      {result.success ? (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-green-800">
                              {result.artist} - {result.title}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded ${
                              result.source === 'collection' 
                                ? 'bg-purple-100 text-purple-700' 
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {result.source === 'collection' ? '🏆 Collection' : '🌐 External'}
                            </span>
                          </div>
                          {result.album && (
                            <div className="text-sm text-green-600">Album: {result.album}</div>
                          )}
                          <div className="text-xs text-green-600 mt-1">
                            Confidence: {Math.round((result.confidence || 0) * 100)}% • 
                            Service: {result.service} • 
                            Time: {result.processingTime}ms
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium text-red-800">Recognition Failed</div>
                          <div className="text-sm text-red-600">{result.error}</div>
                          <div className="text-xs text-red-600 mt-1">
                            Processing time: {result.processingTime}ms
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Multi-Source Results (when available) */}
            {multiSourceResults.length > 1 && (
              <div className="bg-white rounded-lg shadow border p-6">
                <h3 className="text-lg font-semibold mb-4">All Sources ({multiSourceResults.length} results)</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {multiSourceResults.map((result, index) => (
                    <div key={index} className="p-2 border rounded text-sm">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">
                          {result.source === 'collection' ? '🏆 Collection' : '🌐 External'}
                        </span>
                        <span className="text-green-600">
                          {Math.round((result.confidence || 0) * 100)}%
                        </span>
                      </div>
                      <div>{result.artist} - {result.title}</div>
                      {result.album && <div className="text-gray-600">{result.album}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* System Activity Logs */}
            <div className="bg-white rounded-lg shadow border p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">System Activity</h3>
                <button
                  onClick={() => setLogs([])}
                  className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                >
                  Clear Logs
                </button>
              </div>
              
              <div className="h-64 overflow-y-auto bg-gray-50 rounded-md p-3 font-mono text-sm">
                {logs.length === 0 ? (
                  <div className="text-gray-500">No activity yet...</div>
                ) : (
                  <div className="space-y-1">
                    {logs.map((log, index) => (
                      <div key={index} className="text-gray-700">
                        {log}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Instructions */}
        <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-900 mb-3">How to Use Enhanced Auto-Recognition</h3>
          <ol className="list-decimal list-inside space-y-2 text-green-800">
            <li><strong>Start Auto-Recognition:</strong> Click the green button to begin continuous listening</li>
            <li><strong>Automatic Detection:</strong> System will recognize audio every {autoLoop.interval} seconds when volume &gt; {autoLoop.minVolume}%</li>
            <li><strong>Collection-First Matching:</strong> Checks your vinyl collection database before external APIs</li>
            <li><strong>Multi-Source Results:</strong> View matches from both collection and external services</li>
            <li><strong>Adjust Settings:</strong> Fine-tune recognition interval and volume threshold</li>
            <li><strong>Manual Override:</strong> Use &ldquo;Recognize Now&rdquo; for immediate recognition</li>
          </ol>
          
          <div className="mt-4 p-3 bg-green-100 rounded-md">
            <strong>🏆 Collection Priority:</strong> When enabled, the system will first check your vinyl collection 
            for matches before querying external services. This provides faster, more accurate results for albums you own.
          </div>
        </div>
      </div>
    </div>
  );
}