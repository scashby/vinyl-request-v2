// src/app/admin/audio-recognition/page.tsx - FIXED with proper countdown, collection matching, and multiple candidates
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from 'lib/supabaseClient';
import Image from 'next/image';

interface RecognitionResult {
  artist: string;
  title: string;
  album?: string;
  image_url?: string;
  confidence?: number;
  service?: string;
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

interface AlbumContext {
  id?: number;
  artist: string;
  title: string;
  year: string;
  image_url?: string;
  folder?: string;
  track_count?: number;
  track_listing?: string[];
  source?: string;
  created_at?: string;
}

export default function FixedAudioRecognitionSystem() {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [recognitionMode, setRecognitionMode] = useState<'manual' | 'smart_continuous' | 'album_follow'>('smart_continuous');
  const [lastRecognition, setLastRecognition] = useState<RecognitionResult | null>(null);
  const [recognitionCandidates, setRecognitionCandidates] = useState<RecognitionResult[]>([]);
  const [manualArtist, setManualArtist] = useState<string>('');
  const [manualAlbum, setManualAlbum] = useState<string>('');
  const [isManualSearching, setIsManualSearching] = useState<boolean>(false);
  const [albumContext, setAlbumContext] = useState<AlbumContext | null>(null);
  const [status, setStatus] = useState<string>('');
  const [sampleDuration, setSampleDuration] = useState<number>(15);
  const [smartInterval, setSmartInterval] = useState<number>(30);
  
  // FIXED: Enhanced countdown and progress tracking
  const [nextRecognitionCountdown, setNextRecognitionCountdown] = useState<number>(0);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingProgress, setRecordingProgress] = useState<number>(0);
  const [isCountdownActive, setIsCountdownActive] = useState<boolean>(false);
  const [recognitionCount, setRecognitionCount] = useState<number>(0);
  const [lastRecognitionTime, setLastRecognitionTime] = useState<Date | null>(null);
  
  // Audio handling refs
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isListeningRef = useRef<boolean>(false);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const continuousTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load album context
  const loadCurrentAlbumContext = useCallback(async (): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('album_context')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (!error && data) {
        const contextAge = Date.now() - new Date(data.created_at).getTime();
        const maxAge = 2 * 60 * 60 * 1000; // 2 hours
        
        if (contextAge <= maxAge) {
          setAlbumContext(data);
          console.log('✅ Album context loaded:', data);
        } else {
          console.log('Album context expired, clearing...');
          await supabase.from('album_context').delete().neq('id', 0);
          setAlbumContext(null);
        }
      }
    } catch (error) {
      console.error('Error loading album context:', error);
    }
  }, []);

  useEffect(() => {
    loadCurrentAlbumContext();
    
    return () => {
      stopListening();
    };
  }, [loadCurrentAlbumContext]);

  // FIXED: Enhanced countdown implementation
  const startCountdown = useCallback((seconds: number, callback: () => void): void => {
    console.log(`⏱️ Starting countdown: ${seconds} seconds`);
    
    setNextRecognitionCountdown(seconds);
    setIsCountdownActive(true);
    
    countdownIntervalRef.current = setInterval(() => {
      setNextRecognitionCountdown(prev => {
        const newValue = prev - 1;
        
        if (newValue <= 0) {
          // Cleanup and execute callback
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
  }, []);

  // FIXED: Enhanced recording with proper progress tracking
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

    // Track recording progress
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

    // Auto-stop after duration
    setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    }, sampleDuration * 1000);
  }, [sampleDuration]);

  // FIXED: Enhanced audio analysis with proper candidate handling
  const analyzeAudio = async (audioBlob: Blob): Promise<void> => {
    setStatus('🔍 Analyzing audio with multiple services...');
    
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
        
        // FIXED: Properly set all recognition data
        setLastRecognition(result.track);
        setRecognitionCandidates(result.candidates || []);
        
        // Build status message with collection info
        let statusMessage = `✅ RECOGNIZED: ${result.track.title} by ${result.track.artist}`;
        
        if (result.track.album) {
          statusMessage += ` (${result.track.album})`;
        }
        
        // FIXED: Proper collection status display
        if (result.track.collection_match) {
          statusMessage += ` [FROM COLLECTION: ${result.track.collection_match.folder || 'Unknown Folder'}]`;
        } else if (result.track.is_guest_vinyl) {
          statusMessage += ` [GUEST VINYL]`;
        }
        
        statusMessage += ` | Confidence: ${Math.round((result.track.confidence || 0.8) * 100)}%`;
        statusMessage += ` | Service: ${result.track.service || 'Unknown'}`;
        
        if (result.candidates && result.candidates.length > 0) {
          statusMessage += ` | +${result.candidates.length} more candidates`;
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
  };

  // Start listening with proper mode handling
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
      } else if (recognitionMode === 'smart_continuous') {
        setStatus('🔄 Smart continuous mode: Starting...');
        startSmartContinuous();
      } else if (recognitionMode === 'album_follow') {
        setStatus('🎯 Album follow mode: Monitoring...');
        // Implement album follow logic here
        startSmartContinuous(); // Use smart continuous for now
      }

    } catch (error: unknown) {
      console.error('❌ Microphone access error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setStatus(`❌ Microphone error: ${errorMessage}`);
      setIsListening(false);
      isListeningRef.current = false;
    }
  };

  // FIXED: Smart continuous mode with proper countdown
  const startSmartContinuous = useCallback((): void => {
    if (!isListeningRef.current) return;
    
    console.log('🔄 Smart continuous: Starting recognition cycle...');
    
    // Record immediately first
    recordAndAnalyze(() => {
      if (isListeningRef.current) {
        // Start countdown for next recognition
        console.log(`⏱️ Next recognition in ${smartInterval} seconds...`);
        setStatus(`✅ Recognition complete. Next sample in ${smartInterval}s...`);
        
        startCountdown(smartInterval, () => {
          if (isListeningRef.current) {
            startSmartContinuous(); // Recursive call for continuous operation
          }
        });
      }
    });
  }, [smartInterval, recordAndAnalyze, startCountdown]);

  // Stop listening and cleanup
  const stopListening = (): void => {
    console.log('🛑 Stopping recognition system...');
    
    setIsListening(false);
    isListeningRef.current = false;
    setIsRecording(false);
    setRecordingProgress(0);
    setNextRecognitionCountdown(0);
    setIsCountdownActive(false);
    
    // Clear all intervals and timeouts
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

  // Select a recognition candidate
  const selectRecognitionCandidate = async (candidate: RecognitionResult): Promise<void> => {
    console.log('👆 User selected candidate:', candidate);
    setLastRecognition(candidate);
    
    // Update TV display with selected candidate
    try {
      await supabase
        .from('now_playing')
        .upsert({
          id: 1,
          artist: candidate.artist,
          title: candidate.title,
          album_title: candidate.album,
          recognition_image_url: candidate.image_url,
          album_id: candidate.collection_match?.id || null,
          started_at: new Date().toISOString(),
          recognition_confidence: candidate.confidence || 0.8,
          service_used: candidate.service || 'manual_selection',
          updated_at: new Date().toISOString()
        });
      
      const collectionStatus = candidate.collection_match ? 
        `FROM COLLECTION (${candidate.collection_match.folder})` : 
        'GUEST VINYL';
      
      setStatus(`✅ Selected: ${candidate.title} by ${candidate.artist} [${collectionStatus}]`);
    } catch (error) {
      console.error('Error updating selection:', error);
      setStatus('❌ Error updating TV display');
    }
  };

  // Manual search and context setting
  const performManualSearch = async (): Promise<void> => {
    if (!manualArtist.trim()) {
      setStatus('Please enter an artist name');
      return;
    }

    setIsManualSearching(true);
    setStatus('🔍 Searching...');

    try {
      const response = await fetch('/api/manual-recognition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          artist: manualArtist.trim(),
          album: manualAlbum.trim() || undefined
        })
      });

      const result = await response.json();
      
      if (result.success && result.track) {
        setLastRecognition(result.track);
        
        if (manualAlbum.trim()) {
          // Set album context
          await supabase.from('album_context').delete().neq('id', 0);
          await supabase.from('album_context').insert({
            artist: manualArtist.trim(),
            title: manualAlbum.trim(),
            year: new Date().getFullYear().toString(),
            source: 'manual_search',
            created_at: new Date().toISOString()
          });
          
          await loadCurrentAlbumContext();
          setStatus(`✅ Album context set: ${manualArtist} - ${manualAlbum}`);
        } else {
          setStatus(`✅ Manual result: ${result.track.title} by ${result.track.artist}`);
        }
        
        setManualArtist('');
        setManualAlbum('');
      } else {
        setStatus(`❌ No results: ${result.error || 'Unknown error'}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`❌ Search error: ${errorMessage}`);
    } finally {
      setIsManualSearching(false);
    }
  };

  const clearAlbumContext = async (): Promise<void> => {
    try {
      await supabase.from('album_context').delete().neq('id', 0);
      setAlbumContext(null);
      setStatus('✅ Album context cleared');
    } catch (error) {
      console.error('Error clearing context:', error);
      setStatus('❌ Error clearing context');
    }
  };

  const getContextAge = (): string => {
    if (!albumContext?.created_at) return '';
    
    const age = Date.now() - new Date(albumContext.created_at).getTime();
    const minutes = Math.floor(age / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ago`;
    }
    return `${minutes}m ago`;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ padding: 24, background: "#fff", color: "#222", minHeight: "100vh" }}>
      <h1 style={{ marginBottom: 32, fontSize: '28px', fontWeight: 'bold' }}>
        🎵 Fixed Audio Recognition System
      </h1>
      
      {/* FIXED: Enhanced Status Panel with Recognition Stats */}
      <div style={{ 
        background: "#f0fdf4", 
        padding: 24, 
        borderRadius: 12, 
        marginBottom: 24,
        border: "2px solid #16a34a"
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, color: '#16a34a' }}>System Status</h2>
          <div style={{ display: 'flex', gap: 16, fontSize: 14, color: '#166534' }}>
            <span><strong>Recognitions:</strong> {recognitionCount}</span>
            {lastRecognitionTime && (
              <span><strong>Last:</strong> {lastRecognitionTime.toLocaleTimeString()}</span>
            )}
            <span><strong>Mode:</strong> {recognitionMode.replace('_', ' ')}</span>
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

        {/* FIXED: Enhanced Recording Progress */}
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

        {/* FIXED: Enhanced Countdown Timer */}
        {isCountdownActive && nextRecognitionCountdown > 0 && !isRecording && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: 20,
            background: "#fbbf24",
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
              color: "#fbbf24",
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
                ⏰ Next Recognition Sample
              </div>
              <div style={{ fontSize: 14, opacity: 0.9 }}>
                Starting in {nextRecognitionCountdown} seconds... ({formatTime(nextRecognitionCountdown)} remaining)
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
                width: `${((smartInterval - nextRecognitionCountdown) / smartInterval) * 100}%`,
                height: "100%",
                background: "white",
                borderRadius: "4px",
                transition: "width 1s linear"
              }} />
            </div>
          </div>
        )}
      </div>

      {/* Album Context Display */}
      {albumContext && (
        <div style={{ 
          background: "#e8f5e8", 
          padding: 24, 
          borderRadius: 12, 
          marginBottom: 24,
          border: "2px solid #16a34a",
          display: "flex",
          alignItems: "center",
          gap: 16
        }}>
          {albumContext.image_url && (
            <Image 
              src={albumContext.image_url}
              alt={albumContext.title}
              width={80}
              height={80}
              style={{ objectFit: "cover", borderRadius: 8 }}
              unoptimized
            />
          )}
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, marginBottom: 8, color: "#16a34a", display: "flex", alignItems: "center", gap: 8 }}>
              🎯 Album Context Active
            </h3>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
              {albumContext.artist} - {albumContext.title}
            </div>
            <div style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>
              {albumContext.track_count ? `${albumContext.track_count} tracks` : 'Track count unknown'} • 
              Set {getContextAge()} • Source: {albumContext.source || 'unknown'}
            </div>
          </div>
          <button
            onClick={clearAlbumContext}
            style={{
              background: "#dc2626",
              color: "white",
              border: "none",
              borderRadius: 6,
              padding: "8px 12px",
              fontSize: 12,
              cursor: "pointer"
            }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Recognition Mode Configuration */}
      <div style={{ 
        background: "#f0f9ff", 
        padding: 24, 
        borderRadius: 12, 
        marginBottom: 24,
        border: "1px solid #0369a1"
      }}>
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>Recognition Configuration</h2>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
          {[
            { value: 'manual', label: 'Manual Sample', desc: 'Single recognition sample' },
            { value: 'smart_continuous', label: 'Smart Continuous', desc: 'Automatic sampling with countdown' },
            { value: 'album_follow', label: 'Album Follow', desc: 'Context-aware recognition' }
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
              Smart Interval (seconds)
            </label>
            <input 
              type="number"
              min="15"
              max="300"
              value={smartInterval}
              onChange={(e) => setSmartInterval(parseInt(e.target.value) || 30)}
              style={{ 
                width: "100%", 
                padding: "8px 12px", 
                border: "1px solid #ddd", 
                borderRadius: 6,
                fontSize: 14
              }}
            />
          </div>
        </div>
      </div>

      {/* Manual Search Section */}
      <div style={{ 
        background: "#fff7ed", 
        padding: 24, 
        borderRadius: 12, 
        marginBottom: 24,
        border: "1px solid #ea580c"
      }}>
        <h3 style={{ margin: 0, marginBottom: 16, color: "#ea580c" }}>Set Album Context</h3>
        <p style={{ fontSize: 14, color: "#ea580c", marginBottom: 16 }}>
          Enter artist and album to set album context for better track recognition.
        </p>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 600 }}>
              Artist (required)
            </label>
            <input
              type="text"
              value={manualArtist}
              onChange={(e) => setManualArtist(e.target.value)}
              placeholder="e.g. Traffic"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 14
              }}
            />
          </div>
          
          <div>
            <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 600 }}>
              Album (for context setting)
            </label>
            <input
              type="text"
              value={manualAlbum}
              onChange={(e) => setManualAlbum(e.target.value)}
              placeholder="e.g. Mr. Fantasy"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 14
              }}
            />
          </div>
          
          <button
            onClick={performManualSearch}
            disabled={!manualArtist.trim() || isManualSearching}
            style={{
              background: manualArtist.trim() && !isManualSearching ? "#ea580c" : "#9ca3af",
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: manualArtist.trim() && !isManualSearching ? "pointer" : "not-allowed",
              whiteSpace: "nowrap"
            }}
          >
            {isManualSearching ? "Searching..." : (manualAlbum.trim() ? "Set Context" : "Search")}
          </button>
        </div>
      </div>

      {/* FIXED: Enhanced Recognition Candidates Display */}
      {recognitionCandidates.length > 0 && (
        <div style={{ 
          background: "#fffbeb", 
          padding: 24, 
          borderRadius: 12, 
          marginBottom: 24,
          border: "2px solid #f59e0b"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: "#92400e" }}>
              🎯 Recognition Candidates ({recognitionCandidates.length})
            </h3>
            <div style={{ fontSize: 14, color: "#92400e" }}>
              Click any candidate to select it for TV display
            </div>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            {recognitionCandidates.map((candidate, index) => (
              <div 
                key={index}
                onClick={() => selectRecognitionCandidate(candidate)}
                style={{
                  background: "#fff",
                  border: "2px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 16,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  gap: 12,
                  alignItems: "center"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#f59e0b";
                  e.currentTarget.style.background = "#fffbeb";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e5e7eb";
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
                      `FROM COLLECTION (${candidate.collection_match.folder || 'Unknown'})` : 
                      "GUEST VINYL"
                    }
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recognition Controls */}
      <div style={{ 
        background: "#f0f9ff", 
        padding: 24, 
        borderRadius: 12, 
        marginBottom: 24,
        border: "1px solid #0369a1"
      }}>
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>Recognition Controls</h2>
        
        <div style={{ marginBottom: 16 }}>
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
              fontWeight: 600,
              marginRight: 16
            }}
          >
            {isListening 
              ? "🛑 Stop Recognition" 
              : `🎵 Start ${recognitionMode.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`
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

      {/* Last Recognition Result */}
      {lastRecognition && (
        <div style={{ 
          background: "#f0fdf4", 
          padding: 24, 
          borderRadius: 12, 
          border: "2px solid #16a34a"
        }}>
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>✅ Current Recognition</h3>
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
                  `FROM COLLECTION (${lastRecognition.collection_match.folder || 'Unknown'})` : 
                  "GUEST VINYL"
                }
              </div>
            </div>
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