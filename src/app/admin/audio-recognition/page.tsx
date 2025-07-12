// src/app/admin/audio-recognition/page.tsx - Enhanced with visual feedback and history
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

interface RecognitionCandidate {
  artist: string;
  title: string;
  album?: string;
  image_url?: string;
  confidence?: number;
  service?: string;
}

interface RecognitionHistoryItem {
  timestamp: string;
  result: RecognitionResult;
  candidates?: RecognitionCandidate[];
  success: boolean;
  error?: string;
}

export default function AlbumAwareRecognitionSystem() {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [recognitionMode, setRecognitionMode] = useState<'manual' | 'smart_continuous' | 'album_follow'>('album_follow');
  const [lastRecognition, setLastRecognition] = useState<RecognitionResult | null>(null);
  const [recognitionCandidates, setRecognitionCandidates] = useState<RecognitionCandidate[]>([]);
  const [showCandidates, setShowCandidates] = useState<boolean>(false);
  const [manualArtist, setManualArtist] = useState<string>('');
  const [manualAlbum, setManualAlbum] = useState<string>('');
  const [isManualSearching, setIsManualSearching] = useState<boolean>(false);
  const [albumContext, setAlbumContext] = useState<AlbumContext | null>(null);
  const [status, setStatus] = useState<string>('');
  const [sampleDuration, setSampleDuration] = useState<number>(15);
  const [smartInterval, setSmartInterval] = useState<number>(30);
  
  // New state for visual feedback
  const [nextRecognitionCountdown, setNextRecognitionCountdown] = useState<number>(0);
  const [recognitionHistory, setRecognitionHistory] = useState<RecognitionHistoryItem[]>([]);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingProgress, setRecordingProgress] = useState<number>(0);
  
  // Refs for audio handling
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isListeningRef = useRef<boolean>(false);
  const lastAudioLevelRef = useRef<number>(0);
  const silenceCountRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const songChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load album context on component mount
  const clearAlbumContext = useCallback(async (): Promise<void> => {
    try {
      await supabase.from('album_context').delete().neq('id', 0);
      setAlbumContext(null);
      console.log('Album context cleared');
    } catch (error) {
      console.error('Error clearing album context:', error);
    }
  }, []);

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
          console.log('Loaded album context:', data);
        } else {
          console.log('Album context expired');
          await clearAlbumContext();
        }
      }
    } catch (error) {
      console.error('Error loading album context:', error);
    }
  }, [clearAlbumContext]);

  useEffect(() => {
    loadCurrentAlbumContext();
    
    return () => {
      stopListening();
    };
  }, [loadCurrentAlbumContext]);

  // Enhanced startListening with visual feedback
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
      
      if (recognitionMode === 'manual') {
        setStatus(`Recording ${sampleDuration} seconds...`);
        startSingleRecognition();
      } else if (recognitionMode === 'smart_continuous') {
        setStatus('Starting smart continuous recognition...');
        startSmartContinuous();
      } else if (recognitionMode === 'album_follow') {
        setStatus(albumContext ? 
          `Album follow mode: ${albumContext.artist} - ${albumContext.title}` :
          'Album follow mode active - monitoring for song changes...'
        );
        startAlbumFollowMode();
      }

    } catch (error: unknown) {
      console.error('Error accessing microphone:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setStatus(`Error: Could not access microphone - ${errorMessage}`);
      setIsListening(false);
      isListeningRef.current = false;
    }
  };

  const stopListening = (): void => {
    setIsListening(false);
    isListeningRef.current = false;
    setIsRecording(false);
    setRecordingProgress(0);
    setNextRecognitionCountdown(0);
    
    // Clear all intervals and timeouts
    [recognitionTimeoutRef, songChangeTimeoutRef, countdownIntervalRef, recordingIntervalRef].forEach(ref => {
      if (ref.current) {
        clearTimeout(ref.current);
        ref.current = null;
      }
    });

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setStatus('Stopped listening');
  };

  const startSingleRecognition = (): void => {
    recordAndAnalyze(() => {
      setIsListening(false);
      isListeningRef.current = false;
    });
  };

  const startSmartContinuous = (): void => {
    const smartSample = () => {
      if (!streamRef.current || !isListeningRef.current) return;
      
      recordAndAnalyze(() => {
        if (isListeningRef.current) {
          const interval = smartInterval;
          setStatus(`Next sample in ${interval}s (smart mode)`);
          startCountdown(interval, smartSample);
        }
      });
    };
    
    smartSample();
  };

  const startAlbumFollowMode = (): void => {
    if (!streamRef.current) return;

    try {
      audioContextRef.current = new AudioContext();
      const analyser = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      
      detectSongChange(analyser);
      
      // Initial recognition after 2 seconds
      setTimeout(() => {
        if (isListeningRef.current) {
          recordAndAnalyze(() => {});
        }
      }, 2000);
      
    } catch (error) {
      console.error('Error setting up audio analysis:', error);
      setStatus('Error setting up song change detection');
    }
  };

  const detectSongChange = (analyser: AnalyserNode): void => {
    if (!isListeningRef.current) return;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    
    const currentLevel = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    
    if (currentLevel < 15) {
      silenceCountRef.current++;
      const contextInfo = albumContext ? ` (${albumContext.artist} - ${albumContext.title})` : '';
      setStatus(`Silence detected (${silenceCountRef.current}/20) - waiting for song change...${contextInfo}`);
    } else {
      if (silenceCountRef.current >= 20) {
        console.log('Song change detected after silence, starting recognition...');
        setStatus('New song detected! Analyzing...');
        
        setTimeout(() => {
          if (isListeningRef.current) {
            recordAndAnalyze(() => {});
          }
        }, 3000);
        
        silenceCountRef.current = 0;
      } else {
        silenceCountRef.current = 0;
      }
    }
    
    lastAudioLevelRef.current = currentLevel;
    songChangeTimeoutRef.current = setTimeout(() => detectSongChange(analyser), 500);
  };

  // Enhanced recording with progress tracking
  const recordAndAnalyze = (onComplete: () => void): void => {
    if (!streamRef.current) return;

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
    }, 100);

    mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      setIsRecording(false);
      setRecordingProgress(0);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      await analyzeAudio(audioBlob);
      onComplete();
    };

    setStatus(`Recording ${sampleDuration}s sample...`);
    mediaRecorder.start();

    setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    }, sampleDuration * 1000);
  };

  // Enhanced countdown with visual feedback
  const startCountdown = (seconds: number, callback: () => void): void => {
    setNextRecognitionCountdown(seconds);
    
    countdownIntervalRef.current = setInterval(() => {
      setNextRecognitionCountdown(prev => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          callback();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Enhanced analysis with history tracking and TV update
  const analyzeAudio = async (audioBlob: Blob): Promise<void> => {
    setStatus('Analyzing audio...');
    
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
      console.log('Full API response:', result);
      
      const historyItem: RecognitionHistoryItem = {
        timestamp: new Date().toISOString(),
        success: result.success,
        result: result.track || { artist: '', title: '' },
        candidates: result.candidates || [],
        error: result.error
      };
      
      setRecognitionHistory(prev => [historyItem, ...prev.slice(0, 9)]); // Keep last 10
      
      if (result.success && result.track) {
        console.log('Recognition result:', result.track);
        
        if (result.candidates && Array.isArray(result.candidates)) {
          setRecognitionCandidates(result.candidates);
        } else {
          setRecognitionCandidates([]);
        }
        
        setLastRecognition(result.track);
        
        // Update TV display automatically
        await updateNowPlaying(result.track);
        
        let statusMessage = `✅ Now Playing: ${result.track.artist} - ${result.track.title}`;
        if (result.track.album) {
          statusMessage += ` (${result.track.album})`;
        }
        
        if (result.albumContextUsed) {
          statusMessage += ' [Album Context Used]';
        } else if (result.albumContextSwitched) {
          statusMessage += ' [Album Context Switched]';
          await loadCurrentAlbumContext();
        }
        
        setStatus(statusMessage);
      } else {
        setStatus(result.error || 'No recognition found');
        console.log('Recognition failed:', result);
      }
    } catch (error: unknown) {
      console.error('Recognition error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorHistoryItem: RecognitionHistoryItem = {
        timestamp: new Date().toISOString(),
        success: false,
        result: { artist: '', title: '' },
        error: errorMessage
      };
      setRecognitionHistory(prev => [errorHistoryItem, ...prev.slice(0, 9)]);
      setStatus(`Recognition error: ${errorMessage}`);
    }
  };

  // New function to update TV display
  const updateNowPlaying = async (track: RecognitionResult): Promise<void> => {
    try {
      const { error } = await supabase
        .from('now_playing')
        .upsert({
          id: 1,
          artist: track.artist,
          title: track.title,
          album_title: track.album,
          recognition_image_url: track.image_url,
          started_at: new Date().toISOString(),
          recognition_confidence: track.confidence || 0.8,
          service_used: track.service || 'Unknown',
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error updating now playing:', error);
      } else {
        console.log('TV display updated successfully');
      }
    } catch (error) {
      console.error('Error updating TV display:', error);
    }
  };

  const performManualSearch = async (): Promise<void> => {
    if (!manualArtist.trim()) {
      setStatus('Please enter an artist name for manual search');
      return;
    }

    setIsManualSearching(true);
    setStatus('Performing manual search...');
    
    try {
      const response = await fetch('/api/manual-recognition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          artist: manualArtist.trim(),
          album: manualAlbum.trim() || undefined,
          setAsContext: !!(manualAlbum.trim())
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Manual search result:', result);
      
      if (result.success && result.track) {
        setLastRecognition(result.track);
        
        if (result.contextSet) {
          await loadCurrentAlbumContext();
          setStatus(`Album context set: ${result.track.artist} - ${result.track.album || 'Unknown Album'}`);
        } else {
          setStatus(`Manual Override: ${result.track.artist} - ${result.track.title}`);
        }
        
        setManualArtist('');
        setManualAlbum('');
      } else {
        setStatus(result.error || 'Manual search failed');
      }
    } catch (error: unknown) {
      console.error('Manual search error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setStatus(`Manual search error: ${errorMessage}`);
    } finally {
      setIsManualSearching(false);
    }
  };

  const selectRecognitionCandidate = async (candidate: RecognitionCandidate): Promise<void> => {
    setLastRecognition(candidate);
    setShowCandidates(false);
    
    // Update TV display with selected candidate
    await updateNowPlaying(candidate);
    setStatus(`✅ Selected: ${candidate.artist} - ${candidate.title}`);
  };

  const forceRecognitionUpdate = async (): Promise<void> => {
    if (!lastRecognition) return;
    
    setStatus('Forcing TV display update...');
    await updateNowPlaying(lastRecognition);
    setStatus('✅ TV display force updated');
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

  return (
    <div style={{ padding: 24, background: "#fff", color: "#222", minHeight: "100vh" }}>
      <h1 style={{ marginBottom: 32 }}>Album-Aware Recognition System</h1>
      
      {/* Album Context Status */}
      {albumContext && (
        <div style={{ 
          background: "#e8f5e8", 
          padding: 24, 
          borderRadius: 8, 
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
              {isListening && (
                <div style={{
                  width: 12,
                  height: 12,
                  background: "#16a34a",
                  borderRadius: "50%",
                  animation: "pulse 2s infinite"
                }} />
              )}
            </h3>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
              {albumContext.artist} - {albumContext.title}
            </div>
            <div style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>
              {albumContext.track_count ? `${albumContext.track_count} tracks` : 'Track count unknown'} • 
              {albumContext.folder && ` ${albumContext.folder} • `}
              Set {getContextAge()}
            </div>
          </div>
          <button
            onClick={clearAlbumContext}
            style={{
              background: "#dc2626",
              color: "white",
              border: "none",
              borderRadius: 4,
              padding: "8px 12px",
              fontSize: 12,
              cursor: "pointer"
            }}
          >
            Clear Context
          </button>
        </div>
      )}

      {/* Recognition Status with Visual Feedback */}
      <div style={{ 
        background: "#f0f9ff", 
        padding: 24, 
        borderRadius: 8, 
        marginBottom: 24,
        border: "1px solid #0369a1"
      }}>
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>Recognition Status</h2>
        
        {/* Live Status Display */}
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
              Status: {isListening ? "Active" : "Stopped"}
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
              <span>Recording Audio Sample</span>
              <span>{Math.round(recordingProgress)}%</span>
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

        {/* Countdown Timer */}
        {nextRecognitionCountdown > 0 && !isRecording && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 12,
            background: "#fbbf24",
            color: "white",
            borderRadius: 6,
            marginBottom: 16
          }}>
            <div style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "white",
              color: "#fbbf24",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: "bold"
            }}>
              {nextRecognitionCountdown}
            </div>
            <span>Next recognition in {nextRecognitionCountdown} seconds...</span>
          </div>
        )}
      </div>

      {/* Recognition Mode Configuration - keeping existing code */}
      <div style={{ 
        background: "#f0f9ff", 
        padding: 24, 
        borderRadius: 8, 
        marginBottom: 24,
        border: "1px solid #0369a1"
      }}>
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>Recognition Mode</h2>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
          {[
            { value: 'manual', label: 'Manual Sample', desc: 'Single recognition sample' },
            { value: 'smart_continuous', label: 'Smart Continuous', desc: 'Adaptive sampling intervals' },
            { value: 'album_follow', label: 'Album Follow', desc: 'Detect song changes automatically' }
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
                borderRadius: 4,
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
              max="120"
              value={smartInterval}
              onChange={(e) => setSmartInterval(parseInt(e.target.value) || 30)}
              style={{ 
                width: "100%", 
                padding: "8px 12px", 
                border: "1px solid #ddd", 
                borderRadius: 4,
                fontSize: 14
              }}
            />
          </div>
        </div>
      </div>

      {/* Album Context Setting - keeping existing code */}
      <div style={{ 
        background: "#fff7ed", 
        padding: 24, 
        borderRadius: 8, 
        marginBottom: 24,
        border: "1px solid #ea580c"
      }}>
        <h3 style={{ margin: 0, marginBottom: 16, color: "#ea580c" }}>Set Album Context</h3>
        <p style={{ fontSize: 14, color: "#ea580c", marginBottom: 16 }}>
          Enter artist and album to set album context. This will help identify individual tracks from that album.
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
                borderRadius: 4,
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
                borderRadius: 4,
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
              borderRadius: 4,
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

      {/* Recognition History */}
      {recognitionHistory.length > 0 && (
        <div style={{ 
          background: "#f8fafc", 
          padding: 24, 
          borderRadius: 8, 
          marginBottom: 24,
          border: "1px solid #cbd5e1"
        }}>
          <h3 style={{ margin: 0, marginBottom: 16, color: "#1e293b" }}>Recognition History</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {recognitionHistory.map((item, index) => (
              <div 
                key={index}
                style={{
                  background: item.success ? "#f0fdf4" : "#fef2f2",
                  border: `1px solid ${item.success ? "#bbf7d0" : "#fca5a5"}`,
                  borderRadius: 8,
                  padding: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 12
                }}
              >
                <div style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: item.success ? "#16a34a" : "#dc2626",
                  flexShrink: 0
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    {item.success ? (
                      `${item.result.artist} - ${item.result.title}`
                    ) : (
                      "Recognition Failed"
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    {new Date(item.timestamp).toLocaleTimeString()} • 
                    {item.success ? (
                      <span> Confidence: {Math.round((item.result.confidence || 0.8) * 100)}%</span>
                    ) : (
                      <span> Error: {item.error}</span>
                    )}
                  </div>
                </div>
                {item.success && item.result.image_url && (
                  <Image
                    src={item.result.image_url}
                    alt={item.result.title}
                    width={40}
                    height={40}
                    style={{ objectFit: "cover", borderRadius: 4 }}
                    unoptimized
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enhanced Recognition Candidates with images */}
      {recognitionCandidates.length > 0 && (
        <div style={{ 
          background: "#fffbeb", 
          padding: 24, 
          borderRadius: 8, 
          marginBottom: 24,
          border: "1px solid #f59e0b"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: "#92400e" }}>
              Other Recognition Candidates ({recognitionCandidates.length})
            </h3>
            <button 
              onClick={() => setShowCandidates(!showCandidates)}
              style={{
                background: showCandidates ? "#6b7280" : "#f59e0b",
                color: "white",
                border: "none",
                padding: "8px 16px",
                borderRadius: 4,
                fontSize: 14,
                cursor: "pointer"
              }}
            >
              {showCandidates ? "Hide Candidates" : "Show Candidates"}
            </button>
          </div>
          
          {showCandidates && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {recognitionCandidates.map((candidate, index) => (
                <div 
                  key={index}
                  onClick={() => selectRecognitionCandidate(candidate)}
                  style={{
                    background: "#fff",
                    border: "2px solid #e5e7eb",
                    borderRadius: 8,
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
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#e5e7eb";
                    e.currentTarget.style.background = "#fff";
                  }}
                >
                  <Image 
                    src={candidate.image_url || '/images/coverplaceholder.png'}
                    alt={candidate.album || candidate.title}
                    width={60}
                    height={60}
                    style={{ objectFit: "cover", borderRadius: 6 }}
                    unoptimized
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{candidate.title}</div>
                    <div style={{ fontSize: 14, color: "#666", marginBottom: 4 }}>
                      {candidate.artist} {candidate.album && `• ${candidate.album}`}
                    </div>
                    <div style={{ fontSize: 12, color: "#888" }}>
                      {Math.round((candidate.confidence || 0.8) * 100)}% confidence • {candidate.service || 'Unknown'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recognition Controls */}
      <div style={{ 
        background: "#f0f9ff", 
        padding: 24, 
        borderRadius: 8, 
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
              padding: "12px 24px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 16,
              fontWeight: 600,
              marginRight: 12
            }}
          >
            {isListening 
              ? "Stop Recognition" 
              : `Start ${recognitionMode.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`
            }
          </button>
          
          <button 
            onClick={forceRecognitionUpdate}
            disabled={!lastRecognition}
            style={{
              background: lastRecognition ? "#0369a1" : "#9ca3af",
              color: "white",
              border: "none",
              padding: "12px 24px",
              borderRadius: 8,
              cursor: lastRecognition ? "pointer" : "not-allowed",
              fontSize: 16,
              fontWeight: 600
            }}
          >
            Force TV Update
          </button>
        </div>
      </div>

      {/* Recognition Results - keeping existing code but enhanced */}
      {lastRecognition && (
        <div style={{ 
          background: "#f0fdf4", 
          padding: 24, 
          borderRadius: 8, 
          border: "1px solid #16a34a"
        }}>
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>Last Recognition Result</h3>
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
              <div style={{ fontSize: 12, color: "#888" }}>
                {Math.round((lastRecognition.confidence || 0.8) * 100)}% confidence • 
                Service: {lastRecognition.service || 'Unknown'}
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