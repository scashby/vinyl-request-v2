// src/app/admin/audio-recognition/page.tsx - WORKING VERSION

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

interface AudioRecognitionResult {
  artist?: string;
  title?: string;
  album?: string;
  confidence?: number;
  service?: string;
  success: boolean;
  error?: string;
  processingTime: number;
}

interface AudioMetrics {
  volume: number;
  frequency: number;
  isPlaying: boolean;
}

export default function WorkingAudioRecognitionPage() {
  // Audio capture state
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [audioMetrics, setAudioMetrics] = useState<AudioMetrics | null>(null);
  const [status, setStatus] = useState<string>('Click "Start Audio Capture" to begin');
  
  // Recognition results
  const [results, setResults] = useState<AudioRecognitionResult[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  
  // Refs for audio processing
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-19), `[${timestamp}] ${message}`]);
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
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

  // Audio analysis function
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const timeDataArray = new Float32Array(bufferLength);
    
    analyserRef.current.getByteFrequencyData(dataArray);
    analyserRef.current.getFloatTimeDomainData(timeDataArray);

    // Calculate volume (RMS)
    let sum = 0;
    for (let i = 0; i < timeDataArray.length; i++) {
      sum += timeDataArray[i] * timeDataArray[i];
    }
    const volume = Math.sqrt(sum / timeDataArray.length);

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
    
    setAudioMetrics({
      volume: volume * 100,
      frequency,
      isPlaying: volume > 0.01
    });

    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
    }
  }, [isRecording]);

  // Start audio capture
  const startCapture = useCallback(async () => {
    try {
      setStatus('Requesting microphone permission...');
      addLog('Requesting microphone access');
      
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
      
      // Set up audio context for analysis
      const audioContext = new AudioContext({ sampleRate: 44100 });
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      
      analyserRef.current = analyser;
      source.connect(analyser);
      
      // Set up media recorder for actual audio capture
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      setIsRecording(true);
      setStatus('🎤 Listening for audio... (Click "Recognize Audio" when ready)');
      addLog('Audio capture started successfully');
      
      // Start audio analysis
      analyzeAudio();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Permission denied';
      setStatus(`❌ Error: ${errorMessage}`);
      addLog(`Error starting capture: ${errorMessage}`);
      setHasPermission(false);
    }
  }, [addLog, analyzeAudio]);

  // Stop audio capture
  const stopCapture = useCallback(() => {
    cleanup();
    setStatus('Audio capture stopped');
    addLog('Audio capture stopped');
  }, [cleanup, addLog]);

  // Recognize audio
  const recognizeAudio = useCallback(async () => {
    if (!mediaRecorderRef.current || !isRecording) {
      setStatus('❌ No audio recording available');
      return;
    }

    setIsProcessing(true);
    setStatus('🔍 Processing audio for recognition...');
    addLog('Starting audio recognition');
    
    const startTime = Date.now();

    try {
      // Start recording for recognition
      mediaRecorderRef.current.start();
      
      // Record for 10 seconds
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }

      // Wait for the recording to be available
      await new Promise<void>((resolve) => {
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.onstop = () => resolve();
        }
      });

      // Convert audio to base64
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      addLog('Sending audio to recognition service...');
      setStatus('📡 Sending to recognition service...');

      // Call recognition API with proper format
      const response = await fetch('/api/audio-recognition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioData: base64Audio, // Send as base64 string
          timestamp: new Date().toISOString(),
          triggeredBy: 'manual_admin'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      const processingTime = Date.now() - startTime;

      const recognitionResult: AudioRecognitionResult = {
        success: result.success || false,
        processingTime,
        artist: result.result?.artist,
        title: result.result?.title,
        album: result.result?.album,
        confidence: result.result?.confidence,
        service: result.result?.service,
        error: result.error
      };

      setResults(prev => [recognitionResult, ...prev.slice(0, 9)]);

      if (recognitionResult.success) {
        setStatus(`✅ Found: ${recognitionResult.artist} - ${recognitionResult.title}`);
        addLog(`Recognition successful: ${recognitionResult.artist} - ${recognitionResult.title}`);
      } else {
        setStatus(`❌ No match found: ${recognitionResult.error}`);
        addLog(`Recognition failed: ${recognitionResult.error}`);
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
    } finally {
      setIsProcessing(false);
      audioChunksRef.current = []; // Clear chunks for next recording
    }
  }, [isRecording, addLog]);

  // Test service connectivity
  const testServices = useCallback(async () => {
    setStatus('🔧 Testing recognition services...');
    addLog('Testing service connectivity');
    
    try {
      const tests = [
        { name: 'Audio Recognition API', endpoint: '/api/audio-recognition' },
        { name: 'Manual Recognition API', endpoint: '/api/manual-recognition' },
        { name: 'Album Context API', endpoint: '/api/album-context' }
      ];

      for (const test of tests) {
        try {
          const response = await fetch(test.endpoint, { method: 'GET' });
          const statusText = response.ok ? '✅ Available' : `❌ Error ${response.status}`;
          addLog(`${test.name}: ${statusText}`);
        } catch {
          addLog(`${test.name}: ❌ Connection failed`);
        }
      }
      
      setStatus('🔧 Service test completed');
    } catch (error) {
      addLog(`Service test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
              <h1 className="text-2xl font-bold text-gray-900">Audio Recognition System</h1>
              <p className="text-gray-600">Live audio capture and music recognition</p>
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Display */}
        <div className={`mb-6 p-4 rounded-lg border ${
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Controls and Metrics */}
          <div className="space-y-6">
            {/* Control Panel */}
            <div className="bg-white rounded-lg shadow border p-6">
              <h2 className="text-lg font-semibold mb-4">Audio Capture Controls</h2>
              
              <div className="space-y-4">
                {!hasPermission ? (
                  <button
                    onClick={startCapture}
                    className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    🎤 Start Audio Capture
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <button
                        onClick={recognizeAudio}
                        disabled={!isRecording || isProcessing}
                        className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                          !isRecording || isProcessing
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {isProcessing ? '🔄 Processing...' : '🎵 Recognize Audio (10s)'}
                      </button>
                      <button
                        onClick={stopCapture}
                        className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        ⏹️ Stop
                      </button>
                    </div>
                    
                    <button
                      onClick={testServices}
                      className="w-full py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      🔧 Test Services
                    </button>
                  </div>
                )}
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
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Frequency:</span>
                      <div className="font-mono font-bold">{audioMetrics.frequency.toFixed(0)} Hz</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <div className={`font-bold ${audioMetrics.isPlaying ? 'text-green-600' : 'text-red-600'}`}>
                        {audioMetrics.isPlaying ? '🟢 Audio Detected' : '🔴 Silence'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recognition Results */}
            {results.length > 0 && (
              <div className="bg-white rounded-lg shadow border p-6">
                <h3 className="text-lg font-semibold mb-4">Recognition Results</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {results.map((result, index) => (
                    <div key={index} className={`p-3 rounded-md border ${
                      result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    }`}>
                      {result.success ? (
                        <div>
                          <div className="font-medium text-green-800">
                            {result.artist} - {result.title}
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
          </div>

          {/* Right Column - Activity Logs */}
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
            
            <div className="h-96 overflow-y-auto bg-gray-50 rounded-md p-3 font-mono text-sm">
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

        {/* Usage Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">How to Use</h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800">
            <li>Click "Start Audio Capture" and grant microphone permission</li>
            <li>Play music or speak near your microphone</li>
            <li>Watch the audio level indicator turn green when sound is detected</li>
            <li>Click "Recognize Audio" to capture and identify a 10-second sample</li>
            <li>View results in the Recognition Results panel</li>
            <li>Use "Test Services" to check API connectivity</li>
          </ol>
        </div>
      </div>
    </div>
  );
}