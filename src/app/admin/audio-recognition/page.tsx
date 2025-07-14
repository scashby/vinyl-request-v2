// src/app/admin/audio-recognition/page.tsx - FIXED with Smart Timing & Collection Priority
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';

interface RecognitionResult {
  artist: string;
  title: string;
  album?: string;
  image_url?: string;
  confidence?: number;
  service?: string;
  duration?: number;
  next_recognition_delay?: number;
  collection_match?: {
    id: number;
    artist: string;
    title: string;
    year: string;
    image_url?: string;
    folder?: string;
  };
  is_guest_vinyl?: boolean;
}

interface SmartTiming {
  track_duration?: number;
  next_sample_in?: number;
  reasoning?: string;
}

export default function SmartAudioRecognitionSystem() {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [recognitionMode, setRecognitionMode] = useState<'manual' | 'smart_continuous' | 'album_follow'>('smart_continuous');
  const [lastRecognition, setLastRecognition] = useState<RecognitionResult | null>(null);
  const [recognitionCandidates, setRecognitionCandidates] = useState<RecognitionResult[]>([]);
  const [status, setStatus] = useState<string>('');
  const [sampleDuration, setSampleDuration] = useState<number>(15);

  
  // Smart timing state
  const [smartTiming, setSmartTiming] = useState<SmartTiming | null>(null);
  const [dynamicInterval, setDynamicInterval] = useState<number>(30);
  const [isSmartTimingEnabled, setIsSmartTimingEnabled] = useState<boolean>(true);
  
  // Enhanced countdown and progress tracking
  const [nextRecognitionCountdown, setNextRecognitionCountdown] = useState<number>(0);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingProgress, setRecordingProgress] = useState<number>(0);
  const [isCountdownActive, setIsCountdownActive] = useState<boolean>(false);
  const [recognitionCount, setRecognitionCount] = useState<number>(0);
  const [lastRecognitionTime, setLastRecognitionTime] = useState<Date | null>(null);
  const [recognitionHistory, setRecognitionHistory] = useState<Array<{
    time: Date;
    track: string;
    source: string;
    duration?: number;
    nextSampleIn?: number;
  }>>([]);
  
  // Audio handling refs
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isListeningRef = useRef<boolean>(false);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const continuousTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  const startCountdown = useCallback((seconds: number, callback: () => void): void => {
    console.log(`⏱️ Starting ${isSmartTimingEnabled ? 'smart' : 'fixed'} countdown: ${seconds} seconds`);
    
    setNextRecognitionCountdown(seconds);
    setIsCountdownActive(true);
    
    countdownIntervalRef.current = setInterval(() => {
      setNextRecognitionCountdown(prev => {
        const newValue = prev - 1;
        
        if (newValue <= 0) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          setIsCountdownActive(false);
          setNextRecognitionCountdown(0);
          
          console.log('⏰ Countdown finished, starting recognition...');
          callback();
          return 0;
        }
        
        return newValue;
      });
    }, 1000);
  }, [isSmartTimingEnabled]);

  // FIXED: Enhanced audio analysis with COLLECTION PRIORITY
  const analyzeAudio = useCallback(async (audioBlob: Blob): Promise<void> => {
    setStatus('🎯 Analyzing audio with COLLECTION PRIORITY (Vinyl > Cassettes > 45s)...');
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);

      const response = await fetch('/api/audio-recognition', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('🎵 Recognition result:', result);
      
      if (result.success && result.track) {
        console.log('✅ Recognition successful:', result.track);
        
        const track = result.track;
        const candidates = result.candidates || [];
        
        setLastRecognition(track);
        setRecognitionCandidates(candidates);
        
        // Handle smart timing
        if (result.smart_timing) {
          setSmartTiming(result.smart_timing);
          if (isSmartTimingEnabled && result.smart_timing.next_sample_in) {
            setDynamicInterval(result.smart_timing.next_sample_in);
          }
        }
        
        // Add to recognition history
        setRecognitionHistory(prev => [
          {
            time: new Date(),
            track: `${track.artist} - ${track.title}`,
            source: track.collection_match ? `Collection (${track.collection_match.folder})` : 'Guest Vinyl',
            duration: track.duration,
            nextSampleIn: track.next_recognition_delay
          },
          ...prev.slice(0, 9) // Keep last 10
        ]);
        
        // Build status message with collection priority info
        let statusMessage = '';
        
        if (track.collection_match) {
          statusMessage = `🏆 COLLECTION MATCH: ${track.title} by ${track.artist}`;
          statusMessage += ` [FROM ${track.collection_match.folder.toUpperCase()}]`;
        } else {
          statusMessage = `👤 GUEST VINYL: ${track.title} by ${track.artist}`;
        }
        
        if (track.album) {
          statusMessage += ` (${track.album})`;
        }
        
        statusMessage += ` | Confidence: ${Math.round((track.confidence || 0.8) * 100)}%`;
        statusMessage += ` | Service: ${track.service || 'Unknown'}`;
        
        if (track.duration) {
          statusMessage += ` | Duration: ${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, '0')}`;
        }
        
        if (candidates.length > 0) {
          statusMessage += ` | +${candidates.length} candidates`;
        }
        
        if (isSmartTimingEnabled && track.next_recognition_delay) {
          statusMessage += ` | Next sample: ${track.next_recognition_delay}s`;
        }
        
        setStatus(statusMessage);
        
      } else {
        const errorMsg = result.error || 'No recognition found';
        setStatus(`❌ Recognition failed: ${errorMsg}`);
        console.log('❌ Recognition failed:', result);
        setRecognitionCandidates([]);
      }
    } catch (error: unknown) {
      console.error('❌ Recognition error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setStatus(`❌ Analysis error: ${errorMessage}`);
      setRecognitionCandidates([]);
    }
  }, [isSmartTimingEnabled]);

  const recordAndAnalyze = useCallback((onComplete: () => void): void => {
    if (!streamRef.current) {
      console.error('No audio stream available');
      return;
    }

    console.log(`🎤 Starting recording for ${sampleDuration} seconds...`);
    
    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: 'audio/webm;codecs=opus'
    });
    
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];
    setIsRecording(true);
    setRecordingProgress(0);

    const startTime = Date.now();
    recordingIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min((elapsed / sampleDuration) * 100, 100);
      setRecordingProgress(progress);
      
      if (progress >= 100) {
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
      }
    }, 100);

    mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      console.log('🎤 Recording stopped, analyzing...');
      setIsRecording(false);
      setRecordingProgress(0);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      await analyzeAudio(audioBlob);
      setLastRecognitionTime(new Date());
      setRecognitionCount(prev => prev + 1);
      onComplete();
    };

    setStatus(`🎤 Recording ${sampleDuration}s audio sample...`);
    mediaRecorder.start();

    setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    }, sampleDuration * 1000);
  }, [sampleDuration, analyzeAudio]);

  const startListening = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        } 
      });
      
      streamRef.current = stream;
      setIsListening(true);
      isListeningRef.current = true;
      setRecognitionCount(0);
      
      console.log(`🎵 Started listening in ${recognitionMode} mode`);
      
      if (recognitionMode === 'manual') {
        setStatus('🎤 Manual mode: Recording single sample...');
        recordAndAnalyze(() => {
          setIsListening(false);
          isListeningRef.current = false;
        });
      } else {
        setStatus('🔄 Starting smart continuous recognition...');
        startSmartContinuous();
      }

    } catch (error: unknown) {
      console.error('❌ Microphone access error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setStatus(`❌ Microphone error: ${errorMessage}`);
      setIsListening(false);
      isListeningRef.current = false;
    }
  };

  const startSmartContinuous = useCallback((): void => {
    if (!isListeningRef.current) return;
    
    console.log('🔄 Smart continuous: Starting recognition cycle...');
    
    recordAndAnalyze(() => {
      if (isListeningRef.current) {
        // Use smart timing if available, otherwise fall back to default
        const nextInterval = isSmartTimingEnabled ? dynamicInterval : 30;
        console.log(`⏱️ Next recognition in ${nextInterval} seconds (${isSmartTimingEnabled ? 'smart' : 'fixed'} timing)`);
        setStatus(`✅ Recognition complete. Next sample in ${nextInterval}s (${isSmartTimingEnabled ? 'smart timing' : 'fixed timing'})...`);
        
        startCountdown(nextInterval, () => {
          if (isListeningRef.current) {
            startSmartContinuous();
          }
        });
      }
    });
  }, [dynamicInterval, isSmartTimingEnabled, recordAndAnalyze, startCountdown]);

  const stopListening = (): void => {
    console.log('🛑 Stopping recognition system...');
    
    setIsListening(false);
    isListeningRef.current = false;
    setIsRecording(false);
    setRecordingProgress(0);
    setNextRecognitionCountdown(0);
    setIsCountdownActive(false);
    
    [countdownIntervalRef, recordingIntervalRef, continuousTimeoutRef].forEach(ref => {
      if (ref.current) {
        clearTimeout(ref.current);
        clearInterval(ref.current);
        ref.current = null;
      }
    });

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setStatus('🛑 Recognition stopped');
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return 'Unknown';
    return formatTime(seconds);
  };

  return (
    <div style={{ padding: 24, background: "#fff", color: "#222", minHeight: "100vh" }}>
      <h1 style={{ marginBottom: 32, fontSize: '28px', fontWeight: 'bold' }}>
        🎯 Smart BYO Vinyl Recognition System
      </h1>
      
      {/* Collection Priority Info Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
        color: 'white',
        padding: 20,
        borderRadius: 12,
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 16
      }}>
        <div style={{ fontSize: '2rem' }}>🏆</div>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: 4 }}>
            Collection Priority System Active
          </div>
          <div style={{ fontSize: '14px', opacity: 0.9 }}>
            Searches YOUR collection FIRST: Vinyl (highest) → Cassettes → 45s. External services only as fallback.
          </div>
        </div>
      </div>
      
      {/* FIXED: Current Recognition at the top */}
      {lastRecognition && (
        <div style={{ 
          background: lastRecognition.collection_match ? "#f0fdf4" : "#fff7ed", 
          padding: 24, 
          borderRadius: 12, 
          border: `2px solid ${lastRecognition.collection_match ? "#16a34a" : "#f59e0b"}`,
          marginBottom: 24
        }}>
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>
            {lastRecognition.collection_match ? '🏆 Collection Match' : '👤 Guest Vinyl'}
          </h2>
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
            <Image 
              src={lastRecognition.image_url || '/images/coverplaceholder.png'}
              alt={lastRecognition.album || lastRecognition.title}
              width={80}
              height={80}
              style={{ objectFit: "cover", borderRadius: 8 }}
              unoptimized
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                {lastRecognition.title}
              </div>
              <div style={{ fontSize: 16, color: "#666", marginBottom: 4 }}>
                {lastRecognition.artist}
              </div>
              {lastRecognition.album && (
                <div style={{ fontSize: 14, color: "#888", marginBottom: 4 }}>
                  Album: {lastRecognition.album}
                </div>
              )}
              <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>
                {Math.round((lastRecognition.confidence || 0.8) * 100)}% confidence • 
                Service: {lastRecognition.service || 'Unknown'}
                {lastRecognition.duration && ` • Duration: ${formatDuration(lastRecognition.duration)}`}
              </div>
              <div style={{ 
                fontSize: 12, 
                padding: "4px 8px", 
                borderRadius: 6,
                background: lastRecognition.collection_match ? "#dcfce7" : "#fef3c7",
                color: lastRecognition.collection_match ? "#16a34a" : "#92400e",
                display: "inline-block",
                fontWeight: 600
              }}>
                {lastRecognition.collection_match ? 
                  `FROM ${lastRecognition.collection_match.folder?.toUpperCase()} COLLECTION` : 
                  "GUEST VINYL (not in collection)"
                }
              </div>
            </div>
          </div>
          
          {/* Smart Timing Info */}
          {smartTiming && (
            <div style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid #3b82f6',
              borderRadius: 8,
              padding: 12,
              marginTop: 12
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1d4ed8', marginBottom: 4 }}>
                🧠 Smart Timing Active
              </div>
              <div style={{ fontSize: 12, color: '#1e40af' }}>
                {smartTiming.reasoning}
              </div>
            </div>
          )}
        </div>
      )}

      {/* System Status & Controls */}
      <div style={{ 
        background: "#f0fdf4", 
        padding: 24, 
        borderRadius: 12, 
        marginBottom: 24,
        border: "2px solid #16a34a"
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, color: '#16a34a' }}>System Status & Controls</h2>
          <div style={{ display: 'flex', gap: 16, fontSize: 14, color: '#166534' }}>
            <span><strong>Recognitions:</strong> {recognitionCount}</span>
            {lastRecognitionTime && (
              <span><strong>Last:</strong> {lastRecognitionTime.toLocaleTimeString()}</span>
            )}
            <span><strong>Mode:</strong> {recognitionMode.replace('_', ' ')}</span>
            <span><strong>Smart Timing:</strong> {isSmartTimingEnabled ? 'ON' : 'OFF'}</span>
          </div>
        </div>
        
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: 16, 
          marginBottom: 16,
          padding: 16,
          background: isListening ? "#dcfce7" : "#f1f5f9",
          borderRadius: 8,
          border: `2px solid ${isListening ? "#16a34a" : "#64748b"}`
        }}>
          <div style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: isListening ? "#16a34a" : "#64748b",
            animation: isListening ? "pulse 2s infinite" : "none"
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              Status: {isListening ? "🟢 ACTIVE" : "🔴 STOPPED"}
            </div>
            <div style={{ fontSize: 14, color: "#666" }}>
              {status || "Ready to start recognition"}
            </div>
          </div>
        </div>

        {/* Recording Progress */}
        {isRecording && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              marginBottom: 8,
              fontSize: 14,
              fontWeight: 600
            }}>
              <span>🎤 Recording Audio Sample</span>
              <span>{Math.round(recordingProgress)}% ({formatTime(Math.round(recordingProgress * sampleDuration / 100))} / {formatTime(sampleDuration)})</span>
            </div>
            <div style={{
              width: "100%",
              height: 8,
              background: "#e5e7eb",
              borderRadius: 4,
              overflow: "hidden"
            }}>
              <div style={{
                width: `${recordingProgress}%`,
                height: "100%",
                background: "#16a34a",
                transition: "width 0.1s ease"
              }} />
            </div>
          </div>
        )}

        {/* Smart Countdown Timer */}
        {isCountdownActive && nextRecognitionCountdown > 0 && !isRecording && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: 20,
            background: smartTiming ? "#3b82f6" : "#fbbf24",
            color: "white",
            borderRadius: 12,
            marginBottom: 16,
            animation: nextRecognitionCountdown <= 5 ? "pulse 1s infinite" : "none"
          }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "white",
              color: smartTiming ? "#3b82f6" : "#fbbf24",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: "bold"
            }}>
              {nextRecognitionCountdown}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 16 }}>
                {isSmartTimingEnabled && smartTiming ? '🧠 Smart Timing' : '⏰ Next Recognition Sample'}
              </div>
              <div style={{ fontSize: 14, opacity: 0.9 }}>
                Starting in {nextRecognitionCountdown} seconds... 
                {isSmartTimingEnabled && smartTiming && ` (${smartTiming.reasoning?.split(' - ')[0]})`}
              </div>
            </div>
            <div style={{
              width: "120px",
              height: "8px",
              background: "rgba(255,255,255,0.3)",
              borderRadius: "4px",
              overflow: "hidden"
            }}>
              <div style={{
                width: `${((dynamicInterval - nextRecognitionCountdown) / dynamicInterval) * 100}%`,
                height: "100%",
                background: "white",
                borderRadius: "4px",
                transition: "width 1s linear"
              }} />
            </div>
          </div>
        )}

        {/* Recognition Controls */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <button 
            onClick={isListening ? stopListening : startListening}
            style={{
              background: isListening ? "#dc2626" : "#16a34a",
              color: "white",
              border: "none",
              padding: "16px 32px",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 16,
              fontWeight: 600
            }}
          >
            {isListening 
              ? "🛑 Stop Recognition" 
              : `🎯 Start Collection-Priority Recognition`
            }
          </button>
          
          <button 
            onClick={() => window.open('/now-playing-tv', '_blank')}
            style={{
              background: "#7c3aed",
              color: "white",
              border: "none",
              padding: "16px 32px",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 16,
              fontWeight: 600
            }}
          >
            🖥️ Open TV Display
          </button>
        </div>
      </div>

      {/* Smart Timing Controls - Hidden when listening */}
      {!isListening && (
        <div style={{ 
          background: "#f0f9ff", 
          padding: 24, 
          borderRadius: 12, 
          marginBottom: 24,
          border: "1px solid #0369a1"
        }}>
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>🧠 Smart Recognition Configuration</h2>
          
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: 12
            }}>
              <input
                type="checkbox"
                checked={isSmartTimingEnabled}
                onChange={(e) => setIsSmartTimingEnabled(e.target.checked)}
                style={{ transform: 'scale(1.2)' }}
              />
              Enable Smart Timing (recommended)
            </label>
            <p style={{ 
              fontSize: 14, 
              color: '#6b7280', 
              margin: '0 0 16px 28px',
              lineHeight: 1.5
            }}>
              When enabled, the system calculates optimal timing for next recognition based on track duration. 
              Reduces unnecessary API calls and improves accuracy.
            </p>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
            {[
              { value: 'manual', label: 'Manual Sample', desc: 'Single recognition sample' },
              { value: 'smart_continuous', label: 'Smart Continuous', desc: 'Automatic sampling with smart timing' },
              { value: 'album_follow', label: 'Album Follow', desc: 'Context-aware recognition with collection priority' }
            ].map(mode => (
              <label 
                key={mode.value}
                style={{ 
                  display: "flex", 
                  flexDirection: "column",
                  padding: 16,
                  border: recognitionMode === mode.value ? "2px solid #2563eb" : "1px solid #ddd",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: recognitionMode === mode.value ? "#eff6ff" : "#fff"
                }}
              >
                <input
                  type="radio"
                  name="recognitionMode"
                  value={mode.value}
                  checked={recognitionMode === mode.value}
                  onChange={(e) => setRecognitionMode(e.target.value as 'manual' | 'smart_continuous' | 'album_follow')}
                  style={{ marginBottom: 8 }}
                />
                <strong>{mode.label}</strong>
                <span style={{ fontSize: "12px", color: "#666" }}>{mode.desc}</span>
              </label>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                Sample Duration (seconds)
              </label>
              <input 
                type="number"
                min="10"
                max="30"
                value={sampleDuration}
                onChange={(e) => setSampleDuration(parseInt(e.target.value) || 15)}
                style={{ 
                  width: "100%", 
                  padding: "8px 12px", 
                  border: "1px solid #ddd", 
                  borderRadius: 6,
                  fontSize: 14
                }}
              />
            </div>
            
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                Fallback Interval (when no duration available)
              </label>
              <input 
                type="number"
                min="15"
                max="300"
                value={dynamicInterval}
                onChange={(e) => setDynamicInterval(parseInt(e.target.value) || 30)}
                disabled={isSmartTimingEnabled}
                style={{ 
                  width: "100%", 
                  padding: "8px 12px", 
                  border: "1px solid #ddd", 
                  borderRadius: 6,
                  fontSize: 14,
                  opacity: isSmartTimingEnabled ? 0.6 : 1
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Recognition History */}
      {recognitionHistory.length > 0 && (
        <div style={{
          background: "#f8fafc",
          padding: 20,
          borderRadius: 12,
          marginBottom: 24,
          border: "1px solid #e2e8f0"
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
            📊 Recognition History ({recognitionHistory.length})
          </h3>
          <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recognitionHistory.map((entry, index) => (
              <div key={index} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 8,
                background: entry.source.includes('Collection') ? '#f0fdf4' : '#fff7ed',
                borderRadius: 6,
                border: `1px solid ${entry.source.includes('Collection') ? '#bbf7d0' : '#fed7aa'}`
              }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{entry.track}</span>
                  <span style={{ color: '#666', marginLeft: 8 }}>({entry.source})</span>
                </div>
                <div style={{ fontSize: 11, color: '#888' }}>
                  {entry.time.toLocaleTimeString()}
                  {entry.duration && ` • ${formatDuration(entry.duration)}`}
                  {entry.nextSampleIn && ` • Next: ${entry.nextSampleIn}s`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recognition Candidates */}
      {recognitionCandidates.length > 0 && (
        <div style={{ 
          background: "#fff7ed", 
          padding: 24, 
          borderRadius: 12, 
          marginBottom: 24,
          border: "1px solid #ea580c"
        }}>
          <h3 style={{ margin: 0, marginBottom: 16, color: "#ea580c" }}>
            🎯 Recognition Candidates ({recognitionCandidates.length})
          </h3>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            {recognitionCandidates.map((candidate, index) => (
              <div 
                key={index}
                style={{
                  background: "#fff",
                  border: candidate.collection_match ? "2px solid #16a34a" : "2px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 16,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  gap: 12,
                  alignItems: "center"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = candidate.collection_match ? "#15803d" : "#f59e0b";
                  e.currentTarget.style.background = candidate.collection_match ? "#f0fdf4" : "#fffbeb";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = candidate.collection_match ? "#16a34a" : "#e5e7eb";
                  e.currentTarget.style.background = "#fff";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <Image 
                  src={candidate.image_url || '/images/coverplaceholder.png'}
                  alt={candidate.album || candidate.title}
                  width={64}
                  height={64}
                  style={{ objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
                  unoptimized
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>{candidate.title}</div>
                  <div style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>
                    {candidate.artist} {candidate.album && `• ${candidate.album}`}
                  </div>
                  <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>
                    {Math.round((candidate.confidence || 0.8) * 100)}% confidence • {candidate.service || 'Unknown'}
                    {candidate.duration && ` • ${formatDuration(candidate.duration)}`}
                  </div>
                  <div style={{ 
                    fontSize: 11, 
                    padding: "3px 8px", 
                    borderRadius: 6,
                    background: candidate.collection_match ? "#dcfce7" : "#fef3c7",
                    color: candidate.collection_match ? "#16a34a" : "#92400e",
                    display: "inline-block",
                    fontWeight: 600
                  }}>
                    {candidate.collection_match ? 
                      `COLLECTION: ${candidate.collection_match.folder?.toUpperCase()}` : 
                      "GUEST VINYL"
                    }
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `
      }} />
    </div>
  );
}