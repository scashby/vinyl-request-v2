// src/components/AudioRecognitionDebugger.tsx - FIXED WITH AUDIO VERIFICATION
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
  const [audioLevel, setAudioLevel] = useState(0);
  const [maxAudioLevel, setMaxAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelCheckRef = useRef<number | null>(null);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLog(prev => [...prev, { timestamp, message, type }]);
  };

  const clearLog = () => {
    setDebugLog([]);
    setResult(null);
    setAudioBlob(null);
    setAudioLevel(0);
    setMaxAudioLevel(0);
  };

  // Convert WebM audio to RAW PCM format that Shazam expects
  const convertToRawPCM = async (webmBlob: Blob): Promise<ArrayBuffer> => {
    addLog('Converting WebM to RAW PCM format for Shazam...', 'info');
    
    interface WindowWithWebkit extends Window {
      webkitAudioContext?: typeof AudioContext;
    }
    const AudioContextClass = window.AudioContext || (window as WindowWithWebkit).webkitAudioContext;
    const audioContext = new AudioContextClass({
      sampleRate: 44100
    });
    
    try {
      const arrayBuffer = await webmBlob.arrayBuffer();
      addLog(`WebM file size: ${arrayBuffer.byteLength} bytes`, 'info');
      
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      addLog(`Decoded audio: ${audioBuffer.numberOfChannels} channels, ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.sampleRate}Hz`, 'info');
      
      // Convert to mono and limit to 3 seconds to reduce size
      const maxSamples = Math.min(audioBuffer.length, 3 * audioBuffer.sampleRate);
      const channelData = audioBuffer.numberOfChannels > 1 
        ? audioBuffer.getChannelData(0) 
        : audioBuffer.getChannelData(0);
      
      addLog(`Trimming to 3 seconds max: ${maxSamples} samples`, 'info');
      
      // Convert Float32Array to 16-bit PCM (little endian)
      const pcmData = new Int16Array(maxSamples);
      for (let i = 0; i < maxSamples; i++) {
        const sample = Math.max(-1, Math.min(1, channelData[i]));
        pcmData[i] = Math.round(sample * 32767);
      }
      
      addLog(`Converted to RAW PCM: ${pcmData.buffer.byteLength} bytes (${pcmData.length} samples)`, 'success');
      
      await audioContext.close();
      return pcmData.buffer;
    } catch (error) {
      await audioContext.close();
      addLog(`Audio conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      throw error;
    }
  };

  const startRecording = async () => {
    try {
      addLog('Requesting microphone access...', 'info');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      });

      addLog('Microphone access granted', 'success');

      // Set up real-time audio level monitoring
      interface WindowWithWebkit extends Window {
        webkitAudioContext?: typeof AudioContext;
      }
      const AudioContextClass = window.AudioContext || (window as WindowWithWebkit).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      setMaxAudioLevel(0);
      
      const checkAudioLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const level = Math.max(...dataArray);
        setAudioLevel(level);
        setMaxAudioLevel(prev => Math.max(prev, level));
      };
      
      levelCheckRef.current = window.setInterval(checkAudioLevel, 50);

      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        addLog('Opus codec not supported, using basic WebM', 'info');
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
        addLog('WebM not supported, using MP4', 'info');
      }

      addLog(`Using MIME type: ${mimeType || 'default'}`, 'info');

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          addLog(`Audio chunk received: ${event.data.size} bytes`, 'info');
        }
      };

      mediaRecorder.onstop = () => {
        // Stop level monitoring
        if (levelCheckRef.current) {
          clearInterval(levelCheckRef.current);
          levelCheckRef.current = null;
        }
        audioContext.close();
        
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: audioChunksRef.current[0]?.type || 'audio/webm' 
        });
        setAudioBlob(audioBlob);
        
        // Audio verification
        addLog(`Recording complete: ${audioBlob.size} bytes (${audioBlob.type})`, 'success');
        addLog(`Max audio level: ${maxAudioLevel}/255`, maxAudioLevel < 10 ? 'error' : 'success');
        
        if (audioBlob.size < 5000) {
          addLog(`PROBLEM: File only ${audioBlob.size} bytes - likely silence`, 'error');
          addLog(`Fix: Increase speaker volume or move closer to speakers`, 'info');
        }
        
        if (maxAudioLevel < 10) {
          addLog(`PROBLEM: Max audio level ${maxAudioLevel}/255 - microphone not picking up speakers`, 'error');
          addLog(`Fix: Check microphone permissions, increase system input gain, or use external mic`, 'info');
        }
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      addLog('Recording started (5 seconds)...', 'info');

      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          addLog('Recording stopped automatically', 'info');
        }
      }, 5000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Microphone error: ${errorMessage}`, 'error');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      addLog('Recording stopped manually', 'info');
    }
  };

  const testRecognition = async () => {
    if (!audioBlob) {
      addLog('No audio recorded yet', 'error');
      return;
    }

    setIsProcessing(true);
    addLog('Starting audio recognition test...', 'info');

    try {
      const rawPCMAudio = await convertToRawPCM(audioBlob);
      
      addLog(`Sending ${rawPCMAudio.byteLength} bytes of RAW PCM to API...`, 'info');

      const response = await fetch('/api/audio-recognition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream'
        },
        body: rawPCMAudio
      });

      addLog(`API Response: ${response.status} ${response.statusText}`, 
        response.ok ? 'success' : 'error');

      const result: RecognitionResult = await response.json();
      
      addLog('Full API response:', 'info');
      addLog(JSON.stringify(result, null, 2), 'data');

      setResult(result);

      if (result.success) {
        addLog(`Recognition successful: ${result.track?.artist} - ${result.track?.title}`, 'success');
        if (result.debugInfo) {
          addLog(`Processing time: ${result.debugInfo.processingTime}ms`, 'info');
          addLog(`Matches found: ${result.debugInfo.matchesCount}`, 'info');
          addLog(`RAW PCM size: ${result.debugInfo.audioFileSize} bytes`, 'info');
          addLog(`Base64 length: ${result.debugInfo.base64Length}`, 'info');
        }
      } else {
        addLog(`Recognition failed: ${result.error}`, 'error');
        if (result.debugInfo) {
          addLog(`Debug info: ${JSON.stringify(result.debugInfo, null, 2)}`, 'data');
        }
        if (result.rawResponse) {
          addLog('Raw Shazam response for analysis:', 'info');
          addLog(JSON.stringify(result.rawResponse, null, 2), 'data');
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Request failed: ${errorMessage}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const uploadTestFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    addLog(`Testing with uploaded file: ${file.name} (${file.size} bytes, ${file.type})`, 'info');
    setIsProcessing(true);

    try {
      if (file.type.startsWith('audio/')) {
        addLog('Converting uploaded audio to RAW PCM...', 'info');
        const rawPCMAudio = await convertToRawPCM(file);
        
        const response = await fetch('/api/audio-recognition', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream'
          },
          body: rawPCMAudio
        });

        const result: RecognitionResult = await response.json();
        
        addLog(`Upload test result: ${response.status}`, response.ok ? 'success' : 'error');
        addLog(JSON.stringify(result, null, 2), 'data');
        
        setResult(result);
      } else {
        addLog('Uploaded file is not an audio file', 'error');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Upload test failed: ${errorMessage}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const testApiHealth = async () => {
    try {
      addLog('Testing API health...', 'info');
      const response = await fetch('/api/audio-recognition', {
        method: 'GET'
      });
      
      const result = await response.json();
      addLog(`API Health: ${response.status}`, response.ok ? 'success' : 'error');
      addLog(JSON.stringify(result, null, 2), 'data');
      
      if (result.environment?.hasShazamKey) {
        addLog('Shazam API key is configured', 'success');
      } else {
        addLog('Shazam API key is missing', 'error');
      }
      
      if (result.requirements) {
        addLog(`Audio requirements: ${result.requirements.audioFormat}, ${result.requirements.channels}`, 'info');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`API health check failed: ${errorMessage}`, 'error');
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
        Audio Recognition Debugger (RAW PCM - Size Optimized)
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
          Test API Health
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
          {isRecording ? 'Stop Recording' : 'Start Recording (5s)'}
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
          {isProcessing ? 'Testing...' : 'Test Recognition'}
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
          Upload Audio File
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
          Clear Log
        </button>
      </div>

      {/* Real-time audio level display */}
      {isRecording && (
        <div style={{
          background: '#f3f4f6',
          border: '1px solid #d1d5db',
          borderRadius: 6,
          padding: 12,
          marginBottom: 16,
          fontSize: 14
        }}>
          <div style={{ marginBottom: 8 }}>Audio Level: {audioLevel}/255 (Max: {maxAudioLevel}/255)</div>
          <div style={{
            width: '100%',
            height: 20,
            background: '#e5e7eb',
            borderRadius: 4,
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${(audioLevel / 255) * 100}%`,
              height: '100%',
              background: audioLevel < 10 ? '#ef4444' : '#22c55e',
              transition: 'width 0.1s ease'
            }}></div>
          </div>
          <div style={{ fontSize: 12, marginTop: 4, color: '#6b7280' }}>
            {audioLevel < 10 ? 'Too quiet - increase speaker volume' : 'Good audio level'}
          </div>
        </div>
      )}

      {/* Status */}
      {audioBlob && (
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #22c55e',
          borderRadius: 6,
          padding: 12,
          marginBottom: 16,
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            Audio ready: {audioBlob.size} bytes ({audioBlob.type}) - Max level: {maxAudioLevel}/255
          </div>
          <button
            onClick={() => {
              const audioUrl = URL.createObjectURL(audioBlob);
              const audio = new Audio(audioUrl);
              audio.play();
            }}
            style={{
              background: '#16a34a',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            Play Recording
          </button>
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
            {result.success ? 'Recognition Result' : 'Recognition Failed'}
          </div>
          {result.success && result.track && (
            <div>
              <div><strong>Artist:</strong> {result.track.artist}</div>
              <div><strong>Title:</strong> {result.track.title}</div>
              <div><strong>Confidence:</strong> {Math.round(result.track.confidence * 100)}%</div>
              {result.debugInfo && (
                <div>
                  <div><strong>Processing:</strong> {result.debugInfo.processingTime}ms</div>
                  <div><strong>RAW PCM Size:</strong> {result.debugInfo.audioFileSize} bytes</div>
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
          Debug Log ({debugLog.length} entries)
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
    </div>
  );
}