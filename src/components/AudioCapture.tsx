// src/components/AudioCapture.tsx - Fixed TypeScript implementation
"use client";

import { useState, useRef, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from 'types/supabase';

interface AudioCaptureProps {
  onRecognitionResult?: (result: RecognitionResult) => void;
  onError?: (error: string) => void;
  duration?: number;
}

interface RecognitionResult {
  artist: string;
  title: string;
  album: string;
  confidence: number;
  source: string;
}

export default function AudioCapture({ 
  onRecognitionResult, 
  onError,
  duration = 10 
}: AudioCaptureProps) {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Fixed Supabase client with proper typing
  const supabase = createClientComponentClient<Database>();

  const startAudioLevelMonitoring = useCallback(() => {
    if (!audioStreamRef.current) return;

    try {
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(audioStreamRef.current);
      analyzerRef.current = audioContextRef.current.createAnalyser();
      
      analyzerRef.current.fftSize = 256;
      source.connect(analyzerRef.current);

      const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);

      const updateAudioLevel = () => {
        if (!analyzerRef.current) return;
        
        analyzerRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const normalizedLevel = Math.min(100, (average / 255) * 100);
        
        setAudioLevel(normalizedLevel);
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };

      updateAudioLevel();
    } catch (error) {
      console.error('Error setting up audio level monitoring:', error);
    }
  }, []);

  const stopAudioLevelMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setAudioLevel(0);
  }, []);

  const startRecording = async (): Promise<void> => {
    try {
      setStatus('Requesting microphone access...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      });

      audioStreamRef.current = stream;
      startAudioLevelMonitoring();

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        setIsProcessing(true);
        setStatus('Processing audio...');
        stopAudioLevelMonitoring();

        try {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          await processAudioForRecognition(audioBlob);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
          setStatus(`Processing error: ${errorMessage}`);
          onError?.(errorMessage);
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setStatus(`Recording audio for ${duration} seconds...`);

      // Auto-stop after duration
      setTimeout(() => {
        if (mediaRecorderRef.current && isRecording) {
          stopRecording();
        }
      }, duration * 1000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Microphone access denied';
      setStatus(`Error: ${errorMessage}`);
      onError?.(errorMessage);
    }
  };

  const stopRecording = (): void => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      
      // Stop all tracks
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
    }
  };

  const processAudioForRecognition = async (audioBlob: Blob): Promise<void> => {
    try {
      setStatus('Sending to recognition service...');

      // Convert blob to base64 for API
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      const response = await fetch('/api/audio-recognition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioData: base64Audio,
          triggeredBy: 'manual_capture',
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.result) {
        setStatus('✅ Recognition successful!');
        onRecognitionResult?.(result.result);
        
        // Log the result to Supabase
        await supabase.from('audio_recognition_logs').insert({
          artist: result.result.artist,
          title: result.result.title,
          album: result.result.album,
          source: result.result.source,
          service: result.result.source,
          confidence: result.result.confidence,
          confirmed: false,
          created_at: new Date().toISOString()
        });
        
      } else {
        setStatus('❌ No match found');
        onError?.('No match found');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Recognition failed';
      setStatus(`❌ Error: ${errorMessage}`);
      onError?.(errorMessage);
    }
  };

  return (
    <div style={{
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '24px'
    }}>
      <h3 style={{ 
        margin: '0 0 16px 0', 
        fontSize: '18px', 
        fontWeight: '600',
        color: '#374151'
      }}>
        Audio Capture & Recognition
      </h3>

      {/* Audio Level Indicator */}
      {isRecording && (
        <div style={{
          marginBottom: '16px',
          padding: '12px',
          background: '#f0fdf4',
          border: '1px solid #22c55e',
          borderRadius: '8px'
        }}>
          <div style={{ 
            fontSize: '14px', 
            marginBottom: '8px',
            color: '#16a34a',
            fontWeight: '600'
          }}>
            🎤 Recording... Audio Level: {Math.round(audioLevel)}%
          </div>
          <div style={{
            width: '100%',
            height: '8px',
            background: '#e5e7eb',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${audioLevel}%`,
              height: '100%',
              background: audioLevel > 60 ? '#ef4444' : audioLevel > 30 ? '#f59e0b' : '#22c55e',
              transition: 'width 0.1s ease-out'
            }} />
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '16px',
        alignItems: 'center'
      }}>
        <button
          onClick={startRecording}
          disabled={isRecording || isProcessing}
          style={{
            background: isRecording || isProcessing ? '#9ca3af' : '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: isRecording || isProcessing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {isRecording ? '🔴 Recording...' : isProcessing ? '⏳ Processing...' : '🎤 Start Recording'}
        </button>

        {isRecording && (
          <button
            onClick={stopRecording}
            style={{
              background: '#374151',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            ⏹️ Stop
          </button>
        )}

        <div style={{
          fontSize: '12px',
          color: '#6b7280',
          fontStyle: 'italic'
        }}>
          Duration: {duration}s
        </div>
      </div>

      {/* Status Display */}
      {status && (
        <div style={{
          padding: '12px',
          borderRadius: '8px',
          fontSize: '14px',
          background: status.includes('❌') || status.includes('Error') ? '#fef2f2' : 
                     status.includes('✅') ? '#f0fdf4' : '#f0f9ff',
          color: status.includes('❌') || status.includes('Error') ? '#dc2626' : 
                 status.includes('✅') ? '#16a34a' : '#2563eb',
          border: `1px solid ${
            status.includes('❌') || status.includes('Error') ? '#fca5a5' : 
            status.includes('✅') ? '#bbf7d0' : '#bfdbfe'
          }`
        }}>
          {status}
        </div>
      )}

      {/* Browser Compatibility Info */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        background: '#fffbeb',
        border: '1px solid #f59e0b',
        borderRadius: '8px',
        fontSize: '12px',
        color: '#92400e'
      }}>
        <strong>💡 Requirements:</strong>
        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
          <li>Modern browser with microphone access</li>
          <li>HTTPS connection (required for microphone API)</li>
          <li>Allow microphone permissions when prompted</li>
        </ul>
      </div>
    </div>
  );
}