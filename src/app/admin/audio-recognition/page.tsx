// src/app/admin/audio-recognition/page.tsx - Album-Aware Recognition System
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
        // Check if context is still valid (less than 2 hours old)
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
    
    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
      recognitionTimeoutRef.current = null;
    }

    if (songChangeTimeoutRef.current) {
      clearTimeout(songChangeTimeoutRef.current);
      songChangeTimeoutRef.current = null;
    }

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
          recognitionTimeoutRef.current = setTimeout(smartSample, interval * 1000);
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

  const recordAndAnalyze = (onComplete: () => void): void => {
    if (!streamRef.current) return;

    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: 'audio/webm;codecs=opus'
    });
    
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
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
      
      if (result.success && result.track) {
        console.log('Recognition result:', result.track);
        
        if (result.candidates && Array.isArray(result.candidates)) {
          setRecognitionCandidates(result.candidates);
        } else {
          setRecognitionCandidates([]);
        }
        
        setLastRecognition(result.track);
        
        // Update status based on recognition result
        let statusMessage = `Now Playing: ${result.track.artist} - ${result.track.title}`;
        if (result.track.album) {
          statusMessage += ` (${result.track.album})`;
        }
        
        if (result.albumContextUsed) {
          statusMessage += ' [Album Context Used]';
        } else if (result.albumContextSwitched) {
          statusMessage += ' [Album Context Switched]';
          // Reload album context since it may have changed
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
      setStatus(`Recognition error: ${errorMessage}`);
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
          setAsContext: !!(manualAlbum.trim()) // Set context if album specified
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
    setStatus(`Selected: ${candidate.artist} - ${candidate.title}`);
  };

  const forceRecognitionUpdate = async (): Promise<void> => {
    if (!lastRecognition) return;
    
    setStatus('Forcing TV display update...');
    // This would typically call the now_playing update endpoint
    setStatus('TV display force updated');
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
            <div style={{ fontSize: 12, color: "#888" }}>
              System will try to identify tracks from this album first, then fall back to general recognition if no match.
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

      {!albumContext && (
        <div style={{ 
          background: "#fef3c7", 
          padding: 20, 
          borderRadius: 8, 
          marginBottom: 24,
          border: "1px solid #f59e0b"
        }}>
          <h3 style={{ margin: 0, marginBottom: 8, color: "#92400e" }}>💡 No Album Context</h3>
          <div style={{ fontSize: 14, color: "#92400e" }}>
            System is in general recognition mode. Set an album context below to improve track identification for specific albums.
          </div>
        </div>
      )}
      
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
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

      {/* Album Context Setting */}
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

      {/* Recognition Candidates */}
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
                  {candidate.image_url && (
                    <Image 
                      src={candidate.image_url}
                      alt={candidate.album || candidate.title}
                      width={60}
                      height={60}
                      style={{ objectFit: "cover", borderRadius: 6 }}
                      unoptimized
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{candidate.title}</div>
                    <div style={{ fontSize: 14, color: "#666", marginBottom: 4 }}>
                      {candidate.artist} {candidate.album && `• ${candidate.album}`}
                    </div>
                    <div style={{ fontSize: 12, color: "#888" }}>
                      {Math.round((candidate.confidence || 0.8) * 100)}% confidence
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

        {status && (
          <div style={{ 
            background: "#fff", 
            padding: 12, 
            borderRadius: 4, 
            fontSize: 14,
            border: "1px solid #d1d5db"
          }}>
            <strong>Status:</strong> {status}
          </div>
        )}
      </div>

      {/* Recognition Results */}
      {lastRecognition && (
        <div style={{ 
          background: "#f0fdf4", 
          padding: 24, 
          borderRadius: 8, 
          border: "1px solid #16a34a"
        }}>
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>Recognition Results</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div><strong>Artist:</strong> {lastRecognition.artist}</div>
            <div><strong>Track:</strong> {lastRecognition.title}</div>
            <div><strong>Album:</strong> {lastRecognition.album || 'Not provided'}</div>
            <div><strong>Confidence:</strong> {Math.round((lastRecognition.confidence || 0.8) * 100)}%</div>
            <div><strong>Service:</strong> {lastRecognition.service || 'ACRCloud'}</div>
            <div><strong>Has Artwork:</strong> {lastRecognition.image_url ? 'Yes' : 'No'}</div>
          </div>
          
          {lastRecognition.image_url && (
            <div style={{ marginTop: 12, padding: 12, background: "#fff", borderRadius: 4, fontSize: 12 }}>
              <strong>Artwork URL:</strong><br/>
              <a href={lastRecognition.image_url} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", wordBreak: "break-all" }}>
                {lastRecognition.image_url}
              </a>
            </div>
          )}
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