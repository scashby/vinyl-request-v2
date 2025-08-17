// src/components/AudioRecognitionDebugger.tsx
"use client";

import React, { useState, useRef } from 'react';

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'data';
}

interface RecognitionResult {
  success: boolean;
  error?: string;
  track?: {
    artist: string;
    title: string;
    album?: string;
    confidence: number;
  };
  debugInfo?: {
    processingTime: number;
    matchesCount: number;
    audioFileSize: number;
    base64Length: number;
  };
  rawResponse?: unknown;
}

export default function AudioRecognitionDebugger() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [debugLog, setDebugLog] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLog(prev => [...prev, { timestamp, message, type }]);
  };

  const clearLog = () => {
    setDebugLog([]);
    setResult(null);
    setAudioBlob(null);
  };

  const startRecording = async () => {
    try {
      addLog('🎤 Requesting microphone access...', 'info');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      });

      addLog('✅ Microphone access granted', 'success');
      addLog('📊 Audio constraints: sampleRate=44100, no processing', 'info');

      // Try different MIME types for better compatibility
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        addLog('⚠️ Opus codec not supported, using basic WebM', 'info');
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
        addLog('⚠️ WebM not supported, using MP4', 'info');
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = '';
        addLog('⚠️ Using default audio format', 'info');
      }

      addLog(`🎵 Using MIME type: ${mimeType || 'default'}`, 'info');

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          addLog(`📦 Audio chunk received: ${event.data.size} bytes (type: ${event.data.type})`, 'info');
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: audioChunksRef.current[0]?.type || 'audio/webm' 
        });
        setAudioBlob(audioBlob);
        addLog(`🎵 Recording complete: ${audioBlob.size} bytes total (${audioBlob.type})`, 'success');
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      addLog('🔴 Recording started (10 seconds)...', 'info');

      // Auto-stop after 10 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          addLog('⏹️ Recording stopped automatically', 'info');
        }
      }, 10000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Microphone error: ${errorMessage}`, 'error');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      addLog('⏹️ Recording stopped manually', 'info');
    }
  };

  const testRecognition = async () => {
    if (!audioBlob) {
      addLog('❌ No audio recorded yet', 'error');
      return;
    }

    setIsProcessing(true);
    addLog('🚀 Starting audio recognition test...', 'info');

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'test-sample.' + (audioBlob.type.includes('webm') ? 'webm' : 'mp4'));
      
      addLog(`📤 Sending ${audioBlob.size} bytes (${audioBlob.type}) to API...`, 'info');

      const response = await fetch('/api/audio-recognition', {
        method: 'POST',
        body: formData
      });

      addLog(`📡 API Response: ${response.status} ${response.statusText}`, 
        response.ok ? 'success' : 'error');

      const result: RecognitionResult = await response.json();
      
      addLog('📄 Full API response:', 'info');
      addLog(JSON.stringify(result, null, 2), 'data');

      setResult(result);

      if (result.success) {
        addLog(`🎯 Recognition successful: ${result.track?.artist} - ${result.track?.title}`, 'success');
        if (result.debugInfo) {
          addLog(`⏱️ Processing time: ${result.debugInfo.processingTime}ms`, 'info');
          addLog(`📊 Matches found: ${result.debugInfo.matchesCount}`, 'info');
          addLog(`📁 Audio file size: ${result.debugInfo.audioFileSize} bytes`, 'info');
          addLog(`🔤 Base64 length: ${result.debugInfo.base64Length}`, 'info');
        }
      } else {
        addLog(`❌ Recognition failed: ${result.error}`, 'error');
        if (result.debugInfo) {
          addLog(`📊 Debug info: ${JSON.stringify(result.debugInfo, null, 2)}`, 'data');
        }
        if (result.rawResponse) {
          addLog('🔍 Raw Shazam response for analysis:', 'info');
          addLog(JSON.stringify(result.rawResponse, null, 2), 'data');
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`💥 Request failed: ${errorMessage}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const uploadTestFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    addLog(`📁 Testing with uploaded file: ${file.name} (${file.size} bytes, ${file.type})`, 'info');
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('audio', file);

      const response = await fetch('/api/audio-recognition', {
        method: 'POST',
        body: formData
      });

      const result: RecognitionResult = await response.json();
      
      addLog(`📡 Upload test result: ${response.status}`, response.ok ? 'success' : 'error');
      addLog(JSON.stringify(result, null, 2), 'data');
      
      setResult(result);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`💥 Upload test failed: ${errorMessage}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const testApiHealth = async () => {
    try {
      addLog('🔍 Testing API health...', 'info');
      const response = await fetch('/api/audio-recognition', {
        method: 'GET'
      });
      
      const result = await response.json();
      addLog(`🔍 API Health: ${response.status}`, response.ok ? 'success' : 'error');
      addLog(JSON.stringify(result, null, 2), 'data');
      
      if (result.environment) {
        if (result.environment.hasShazamKey) {
          addLog('✅ Shazam API key is configured', 'success');
        } else {
          addLog('❌ Shazam API key is missing', 'error');
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`💥 API health check failed: ${errorMessage}`, 'error');
    }
  };

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      padding: 24,
      margin: 24,
      fontFamily: 'monospace'
    }}>
      <h2 style={{ 
        margin: '0 0 20px 0', 
        fontSize: '20px', 
        fontWeight: 'bold',
        color: '#1f2937'
      }}>
        🔧 Audio Recognition Debugger
      </h2>

      {/* Controls */}
      <div style={{
        display: 'flex',
        gap: 12,
        marginBottom: 20,
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <button
          onClick={testApiHealth}
          style={{
            background: '#6366f1',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          🔍 Test API Health
        </button>

        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          style={{
            background: isRecording ? '#dc2626' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            opacity: isProcessing ? 0.6 : 1
          }}
        >
          {isRecording ? '⏹️ Stop Recording' : '🎤 Start Recording (10s)'}
        </button>

        <button
          onClick={testRecognition}
          disabled={!audioBlob || isProcessing || isRecording}
          style={{
            background: '#16a34a',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            cursor: (!audioBlob || isProcessing || isRecording) ? 'not-allowed' : 'pointer',
            opacity: (!audioBlob || isProcessing || isRecording) ? 0.6 : 1
          }}
        >
          {isProcessing ? '⏳ Testing...' : '🔍 Test Recognition'}
        </button>

        <label style={{
          background: '#f59e0b',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          padding: '8px 16px',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer'
        }}>
          📁 Upload Audio File
          <input
            type="file"
            accept="audio/*"
            onChange={uploadTestFile}
            disabled={isProcessing}
            style={{ display: 'none' }}
          />
        </label>

        <button
          onClick={clearLog}
          style={{
            background: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          🗑️ Clear Log
        </button>
      </div>

      {/* Status */}
      {audioBlob && (
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #22c55e',
          borderRadius: 6,
          padding: 12,
          marginBottom: 16,
          fontSize: 14
        }}>
          ✅ Audio ready: {audioBlob.size} bytes ({audioBlob.type})
        </div>
      )}

      {/* Results Summary */}
      {result && (
        <div style={{
          background: result.success ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${result.success ? '#22c55e' : '#ef4444'}`,
          borderRadius: 8,
          padding: 16,
          marginBottom: 16
        }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            {result.success ? '✅ Recognition Result' : '❌ Recognition Failed'}
          </div>
          {result.success && result.track && (
            <div>
              <div><strong>Artist:</strong> {result.track.artist}</div>
              <div><strong>Title:</strong> {result.track.title}</div>
              <div><strong>Confidence:</strong> {Math.round(result.track.confidence * 100)}%</div>
              {result.debugInfo && (
                <div>
                  <div><strong>Processing:</strong> {result.debugInfo.processingTime}ms</div>
                  <div><strong>Audio Size:</strong> {result.debugInfo.audioFileSize} bytes</div>
                  <div><strong>Base64 Length:</strong> {result.debugInfo.base64Length}</div>
                </div>
              )}
            </div>
          )}
          {!result.success && (
            <div style={{ color: '#dc2626' }}>
              <strong>Error:</strong> {result.error}
            </div>
          )}
        </div>
      )}

      {/* Debug Log */}
      <div style={{
        background: '#000',
        color: '#fff',
        borderRadius: 8,
        padding: 16,
        maxHeight: 400,
        overflowY: 'auto',
        fontSize: 12,
        lineHeight: 1.4
      }}>
        <div style={{ 
          marginBottom: 12, 
          fontWeight: 600,
          borderBottom: '1px solid #333',
          paddingBottom: 8
        }}>
          📋 Debug Log ({debugLog.length} entries)
        </div>
        
        {debugLog.length === 0 ? (
          <div style={{ color: '#6b7280', fontStyle: 'italic' }}>
            Click &quot;Test API Health&quot; or &quot;Start Recording&quot; to begin debugging...
          </div>
        ) : (
          debugLog.map((log, index) => (
            <div key={index} style={{ marginBottom: 4 }}>
              <span style={{ color: '#6b7280' }}>[{log.timestamp}]</span>{' '}
              <span style={{ 
                color: log.type === 'error' ? '#ef4444' : 
                       log.type === 'success' ? '#22c55e' : 
                       log.type === 'data' ? '#8b5cf6' : '#60a5fa'
              }}>
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Instructions */}
      <div style={{
        marginTop: 16,
        padding: 16,
        background: '#fef3c7',
        border: '1px solid #f59e0b',
        borderRadius: 8,
        fontSize: 14
      }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>🔍 Debugging Steps:</div>
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          <li><strong>Test API Health first</strong> - Check if Shazam API key is configured</li>
          <li><strong>Record clear audio</strong> - Try &quot;Dancing Queen&quot; by ABBA (very recognizable)</li>
          <li><strong>Check debug log</strong> - Look for exact error messages</li>
          <li><strong>Try uploading a file</strong> - Test with a short MP3 of a popular song</li>
          <li><strong>Monitor processing time</strong> - Very fast responses might indicate API issues</li>
        </ol>
      </div>
    </div>
  );
}