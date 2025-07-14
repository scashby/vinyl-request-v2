// src/app/admin/audio-recognition/page.tsx - COMPLETELY FIXED VERSION
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
  updated_at?: string;
}

interface SystemStatus {
  database: boolean;
  recognitionAPI: boolean;
  manualAPI: boolean;
  services: string[];
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
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    database: false,
    recognitionAPI: false,
    manualAPI: false,
    services: []
  });
  
  // Enhanced countdown and progress tracking
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

  // Check system status
  const checkSystemStatus = useCallback(async (): Promise<void> => {
    const status: SystemStatus = {
      database: false,
      recognitionAPI: false,
      manualAPI: false,
      services: []
    };

    try {
      // Test database
      const { error: dbError } = await supabase.from('now_playing').select('id').limit(1);
      status.database = !dbError;

      // Test recognition API
      try {
        const recognitionResponse = await fetch('/api/audio-recognition');
        status.recognitionAPI = recognitionResponse.ok;
        if (recognitionResponse.ok) {
          const recognitionData = await recognitionResponse.json();
          status.services = recognitionData.enabledServices || [];
        }
      } catch {
        status.recognitionAPI = false;
      }

      // Test manual API
      try {
        const manualResponse = await fetch('/api/manual-recognition');
        status.manualAPI = manualResponse.ok;
      } catch {
        status.manualAPI = false;
      }
    } catch (error) {
      console.error('Error checking system status:', error);
    }

    setSystemStatus(status);
  }, []);

  useEffect(() => {
    loadCurrentAlbumContext();
    checkSystemStatus();
    
    return () => {
      stopListening();
    };
  }, [loadCurrentAlbumContext, checkSystemStatus]);

  const startCountdown = useCallback((seconds: number, callback: () => void): void => {
    console.log(`⏱️ Starting countdown: ${seconds} seconds`);
    
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
  }, []);

  // FIXED: Enhanced audio analysis with album context priority and BYO vinyl filtering
  const analyzeAudio = useCallback(async (audioBlob: Blob): Promise<void> => {
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
        
        let finalTrack = result.track;
        let candidates = result.candidates || [];
        
        // FIXED: Album Follow Mode - Check if we have album context and should prefer it
        if (recognitionMode === 'album_follow' && albumContext) {
          console.log('🎯 Album Follow Mode: Checking context match...');
          
          // Look for context matches in all candidates
          const contextMatches = [finalTrack, ...candidates].filter((candidate: RecognitionResult) => {
            const artistMatch = candidate.artist.toLowerCase().includes(albumContext.artist.toLowerCase()) ||
                               albumContext.artist.toLowerCase().includes(candidate.artist.toLowerCase());
            const albumMatch = candidate.album && 
                              (candidate.album.toLowerCase().includes(albumContext.title.toLowerCase()) ||
                               albumContext.title.toLowerCase().includes(candidate.album.toLowerCase()));
            
            return artistMatch && albumMatch;
          });
          
          if (contextMatches.length > 0) {
            console.log('✅ Found context match, prioritizing...');
            finalTrack = contextMatches[0];
            // Move other context matches to top of candidates, remove the selected one
            candidates = [
              ...contextMatches.slice(1),
              ...candidates.filter((c: RecognitionResult) => !contextMatches.includes(c))
            ];
          }
        }
        
        // FIXED: Filter for BYO Vinyl only (Vinyl, 45s, Cassettes folders)
        const byoFolders = ['vinyl', '45s', 'cassettes'];
        
        // Filter final track
        if (finalTrack.collection_match && 
            !byoFolders.includes(finalTrack.collection_match.folder?.toLowerCase() || '')) {
          finalTrack.collection_match = undefined;
          finalTrack.is_guest_vinyl = true;
        }
        
        // Filter candidates
        candidates = candidates.map((candidate: RecognitionResult) => {
          if (candidate.collection_match && 
              !byoFolders.includes(candidate.collection_match.folder?.toLowerCase() || '')) {
            return {
              ...candidate,
              collection_match: undefined,
              is_guest_vinyl: true
            };
          }
          return candidate;
        });
        
        setLastRecognition(finalTrack);
        setRecognitionCandidates(candidates);
        
        // Build status message
        let statusMessage = `✅ RECOGNIZED: ${finalTrack.title} by ${finalTrack.artist}`;
        
        if (finalTrack.album) {
          statusMessage += ` (${finalTrack.album})`;
        }
        
        if (finalTrack.collection_match) {
          statusMessage += ` [FROM COLLECTION: ${finalTrack.collection_match.folder || 'Unknown Folder'}]`;
        } else if (finalTrack.is_guest_vinyl) {
          statusMessage += ` [GUEST VINYL]`;
        }
        
        statusMessage += ` | Confidence: ${Math.round((finalTrack.confidence || 0.8) * 100)}%`;
        statusMessage += ` | Service: ${finalTrack.service || 'Unknown'}`;
        
        if (candidates.length > 0) {
          statusMessage += ` | +${candidates.length} more candidates`;
        }
        
        if (recognitionMode === 'album_follow' && albumContext) {
          statusMessage += ` | 🎯 Album Follow Mode`;
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
  }, [recognitionMode, albumContext]);

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
        setStatus('🔄 Starting continuous recognition...');
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
        console.log(`⏱️ Next recognition in ${smartInterval} seconds...`);
        setStatus(`✅ Recognition complete. Next sample in ${smartInterval}s...`);
        
        startCountdown(smartInterval, () => {
          if (isListeningRef.current) {
            startSmartContinuous();
          }
        });
      }
    });
  }, [smartInterval, recordAndAnalyze, startCountdown]);

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

  // FIXED: selectRecognitionCandidate function with proper database update
  const selectRecognitionCandidate = async (candidate: RecognitionResult): Promise<void> => {
    console.log('👆 User selected candidate:', candidate);
    setLastRecognition(candidate);
    
    // FIXED: Update the now_playing table that the TV display reads from
    try {
      const updateData = {
        id: 1,
        artist: candidate.artist,
        title: candidate.title, // This is the track title
        album_title: candidate.album, // This is the album title
        recognition_image_url: candidate.image_url,
        album_id: candidate.collection_match?.id || null,
        started_at: new Date().toISOString(),
        recognition_confidence: candidate.confidence || 0.8,
        service_used: candidate.service || 'manual_selection',
        updated_at: new Date().toISOString()
      };

      const { error: nowPlayingError } = await supabase
        .from('now_playing')
        .upsert(updateData);

      if (nowPlayingError) {
        throw nowPlayingError;
      }

      console.log('✅ Updated now_playing table for TV display:', updateData);
    } catch (error) {
      console.error('❌ Error updating now_playing table:', error);
      setStatus('❌ Error updating TV display');
      return; // Exit early if database update fails
    }
    
    // FIXED: For Album Follow Mode, set album context when user selects an album
    if (recognitionMode === 'album_follow' && candidate.album && candidate.artist) {
      try {
        await supabase.from('album_context').delete().neq('id', 0);
        await supabase.from('album_context').insert({
          artist: candidate.artist,
          title: candidate.album,
          year: new Date().getFullYear().toString(),
          collection_id: candidate.collection_match?.id || null,
          source: 'user_selection',
          created_at: new Date().toISOString()
        });
        
        await loadCurrentAlbumContext();
        console.log('✅ Album context set from user selection');
      } catch (error) {
        console.error('Error setting album context:', error);
      }
    }
    
    // Update status message
    const collectionStatus = candidate.collection_match ? 
      `FROM COLLECTION (${candidate.collection_match.folder})` : 
      'GUEST VINYL';
    
    setStatus(`✅ Selected: ${candidate.title} by ${candidate.artist} [${collectionStatus}] - TV updated!`);
  };

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
        🎵 BYO Vinyl Audio Recognition System
      </h1>
      
      {/* FIXED: Current Recognition at the top */}
      {lastRecognition && (
        <div style={{ 
          background: "#f0fdf4", 
          padding: 24, 
          borderRadius: 12, 
          border: "2px solid #16a34a",
          marginBottom: 24
        }}>
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>✅ Current Recognition</h2>
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

      {/* FIXED: System Status with Recognition Controls integrated */}
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

        {/* System Health */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div style={{ 
            padding: 8, 
            background: systemStatus.database ? '#dcfce7' : '#fee2e2',
            borderRadius: 6,
            fontSize: 12,
            textAlign: 'center'
          }}>
            <div style={{ fontWeight: 600 }}>Database</div>
            <div style={{ color: systemStatus.database ? '#16a34a' : '#dc2626' }}>
              {systemStatus.database ? '✅ Connected' : '❌ Error'}
            </div>
          </div>
          <div style={{ 
            padding: 8, 
            background: systemStatus.recognitionAPI ? '#dcfce7' : '#fee2e2',
            borderRadius: 6,
            fontSize: 12,
            textAlign: 'center'
          }}>
            <div style={{ fontWeight: 600 }}>Recognition API</div>
            <div style={{ color: systemStatus.recognitionAPI ? '#16a34a' : '#dc2626' }}>
              {systemStatus.recognitionAPI ? '✅ Ready' : '❌ Error'}
            </div>
          </div>
          <div style={{ 
            padding: 8, 
            background: systemStatus.manualAPI ? '#dcfce7' : '#fee2e2',
            borderRadius: 6,
            fontSize: 12,
            textAlign: 'center'
          }}>
            <div style={{ fontWeight: 600 }}>Manual API</div>
            <div style={{ color: systemStatus.manualAPI ? '#16a34a' : '#dc2626' }}>
              {systemStatus.manualAPI ? '✅ Ready' : '❌ Error'}
            </div>
          </div>
          <div style={{ 
            padding: 8, 
            background: '#f0f9ff',
            borderRadius: 6,
            fontSize: 12,
            textAlign: 'center'
          }}>
            <div style={{ fontWeight: 600 }}>Services</div>
            <div style={{ color: '#0369a1' }}>
              {systemStatus.services.length} Active
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

        {/* Countdown Timer */}
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

          <button 
            onClick={checkSystemStatus}
            style={{
              background: "#0369a1",
              color: "white",
              border: "none",
              padding: "16px 32px",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 16,
              fontWeight: 600
            }}
          >
            🔧 Test System
          </button>
        </div>
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
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8
            }}>
              <span style={{ fontSize: 18 }}>🎯</span>
              <h3 style={{ 
                margin: 0, 
                color: "#16a34a", 
                fontSize: "16px" 
              }}>
                Album Context Active - {recognitionMode === 'album_follow' ? 'PRIORITY MODE' : 'Background Mode'}
              </h3>
            </div>
            <div style={{ 
              fontSize: '16px', 
              fontWeight: 600, 
              marginBottom: 4 
            }}>
              {albumContext.artist} - {albumContext.title}
            </div>
            <div style={{ 
              fontSize: '14px', 
              color: '#666', 
              marginBottom: 8 
            }}>
              {albumContext.track_count && albumContext.track_count > 0 ? 
                `${albumContext.track_count} tracks` : 
                'Track count unknown'
              } • 
              {albumContext.folder && ` ${albumContext.folder} • `}
              Set {getContextAge()} • 
              Source: {albumContext.source || 'unknown'}
            </div>
            
            {albumContext.track_listing && albumContext.track_listing.length > 0 && (
              <div style={{ fontSize: 12, color: '#065f46' }}>
                Tracks: {albumContext.track_listing.slice(0, 3).join(', ')}
                {albumContext.track_listing.length > 3 && ` (+${albumContext.track_listing.length - 3} more)`}
              </div>
            )}
          </div>
          <button
            onClick={clearAlbumContext}
            style={{
              background: "#dc2626",
              color: "white",
              border: "none",
              borderRadius: 6,
              padding: "8px 12px",
              fontSize: "12px",
              cursor: "pointer"
            }}
          >
            Clear
          </button>
        </div>
      )}

      {/* FIXED: Recognition Configuration - Hidden when listening */}
      {!isListening && (
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
              { value: 'album_follow', label: 'Album Follow', desc: 'Context-aware recognition - PRIORITIZES album context matches' }
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
      )}

      {/* FIXED: Combined Album Context Search and Recognition Candidates */}
      <div style={{ 
        background: "#fff7ed", 
        padding: 24, 
        borderRadius: 12, 
        marginBottom: 24,
        border: "1px solid #ea580c"
      }}>
        <h3 style={{ margin: 0, marginBottom: 16, color: "#ea580c" }}>Set Album Context & Recognition Candidates</h3>
        
        {/* Manual Search Section */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 14, color: "#ea580c", marginBottom: 16 }}>
            Enter artist and album to set album context for better track recognition in Album Follow mode.
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
                placeholder="e.g. Wilco"
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
                placeholder="e.g. Yankee Hotel Foxtrot"
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

        {/* Recognition Candidates */}
        {recognitionCandidates.length > 0 && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h4 style={{ margin: 0, color: "#92400e" }}>
                🎯 Recognition Candidates ({recognitionCandidates.length})
              </h4>
              <div style={{ fontSize: 14, color: "#92400e" }}>
                Click any candidate to select it for TV display
                {recognitionMode === 'album_follow' && ' and set album context'}
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
                        `BYO COLLECTION (${candidate.collection_match.folder || 'Unknown'})` : 
                        "GUEST VINYL"
                      }
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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