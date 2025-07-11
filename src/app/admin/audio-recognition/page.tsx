// src/app/admin/audio-recognition/page.tsx - Smart Recognition with Album Context
"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from 'lib/supabaseClient';
import Image from 'next/image';

interface RecognitionResult {
  artist: string;
  title: string;
  album?: string;
  confidence?: number;
  service?: string;
}

interface CollectionMatch {
  id: number;
  artist: string;
  title: string;
  year: string;
  image_url?: string;
  folder?: string;
  format?: string;
  match_type: 'exact' | 'fuzzy_artist' | 'fuzzy_title' | 'album_context';
  match_score: number;
}

interface AlbumContext {
  album_id?: number;
  artist: string;
  album_title?: string;
  last_recognized: string;
  track_sequence: string[];
}

interface RecognitionCandidate {
  recognition: RecognitionResult;
  collection_matches: CollectionMatch[];
  selected_match?: CollectionMatch;
  confidence_score: number;
}

export default function SmartAudioRecognitionPage() {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [recognitionMode, setRecognitionMode] = useState<'manual' | 'smart_continuous' | 'album_follow'>('smart_continuous');
  const [lastRecognition, setLastRecognition] = useState<RecognitionResult | null>(null);
  const [albumContext, setAlbumContext] = useState<AlbumContext | null>(null);
  const [pendingSelection, setPendingSelection] = useState<RecognitionCandidate | null>(null);
  const [status, setStatus] = useState<string>('');
  const [sampleDuration, setSampleDuration] = useState<number>(15);
  const [smartInterval, setSmartInterval] = useState<number>(30);
  
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isListeningRef = useRef<boolean>(false);
  const lastAudioLevelRef = useRef<number>(0);
  const silenceCountRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

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
        setStatus('Starting album follow mode...');
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

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
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
          // Smart interval: shorter if we detected a good match, longer if not
          const interval = lastRecognition ? smartInterval : Math.min(smartInterval * 2, 120);
          setStatus(`Next sample in ${interval}s (smart mode)`);
          
          recognitionTimeoutRef.current = setTimeout(smartSample, interval * 1000);
        }
      });
    };
    
    smartSample();
  };

  const startAlbumFollowMode = (): void => {
    // TODO: Implement song change detection using audio level analysis
    const followAlbum = () => {
      if (!streamRef.current || !isListeningRef.current) return;
      
      // Monitor audio levels for song changes
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(streamRef.current);
      source.connect(analyser);
      
      const detectSongChange = () => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        
        const currentLevel = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        
        // Simple silence detection for song transitions
        if (currentLevel < 10) {
          silenceCountRef.current++;
        } else {
          if (silenceCountRef.current > 10) { // Detected song change
            console.log('Song change detected, sampling...');
            recordAndAnalyze(() => {});
            silenceCountRef.current = 0;
          }
          silenceCountRef.current = 0;
        }
        
        lastAudioLevelRef.current = currentLevel;
        
        if (isListeningRef.current) {
          setTimeout(detectSongChange, 500); // Check every 500ms
        }
      };
      
      detectSongChange();
    };
    
    followAlbum();
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
      await analyzeAudioWithContext(audioBlob);
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

  const analyzeAudioWithContext = async (audioBlob: Blob): Promise<void> => {
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
      
      if (result.success && result.track) {
        console.log('Recognition result:', result.track);
        
        // Find collection matches with context
        const matches = await findCollectionMatches(result.track);
        
        if (matches.length === 0) {
          setStatus(`❌ No collection matches for: ${result.track.artist} - ${result.track.title}`);
          setLastRecognition(result.track);
          return;
        }

        const candidate: RecognitionCandidate = {
          recognition: result.track,
          collection_matches: matches,
          confidence_score: result.track.confidence || 0.8
        };

        // Auto-select best match or prompt for selection
        if (matches.length === 1 || matches[0].match_score > 0.9) {
          await selectMatch(candidate, matches[0]);
        } else {
          setPendingSelection(candidate);
          setStatus(`🎵 Found ${matches.length} possible matches - please select`);
        }
      } else {
        setStatus(result.error || 'No match found');
      }
    } catch (error: unknown) {
      console.error('Recognition error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setStatus(`Error during recognition: ${errorMessage}`);
    }
  };

  const findCollectionMatches = async (track: RecognitionResult): Promise<CollectionMatch[]> => {
    const matches: CollectionMatch[] = [];

    // Strategy 1: Album context match (if we have context)
    if (albumContext) {
      const { data: contextMatches } = await supabase
        .from('collection')
        .select('*')
        .eq('id', albumContext.album_id)
        .single();

      if (contextMatches) {
        matches.push({
          ...contextMatches,
          match_type: 'album_context',
          match_score: 0.95
        });
      }
    }

    // Strategy 2: Exact artist + title
    const { data: exactMatches } = await supabase
      .from('collection')
      .select('*')
      .ilike('artist', track.artist)
      .ilike('title', track.title)
      .limit(3);

    if (exactMatches) {
      exactMatches.forEach(match => {
        matches.push({
          ...match,
          match_type: 'exact',
          match_score: 0.9
        });
      });
    }

    // Strategy 3: Fuzzy artist match
    const { data: artistMatches } = await supabase
      .from('collection')
      .select('*')
      .ilike('artist', `%${track.artist}%`)
      .limit(5);

    if (artistMatches) {
      artistMatches.forEach(match => {
        if (!matches.some(m => m.id === match.id)) {
          const artistScore = calculateSimilarity(track.artist, match.artist);
          const titleScore = match.title ? calculateSimilarity(track.title, match.title) : 0;
          
          matches.push({
            ...match,
            match_type: 'fuzzy_artist',
            match_score: (artistScore + titleScore) / 2
          });
        }
      });
    }

    // Strategy 4: Fuzzy title match
    const { data: titleMatches } = await supabase
      .from('collection')
      .select('*')
      .ilike('title', `%${track.title}%`)
      .limit(5);

    if (titleMatches) {
      titleMatches.forEach(match => {
        if (!matches.some(m => m.id === match.id)) {
          const titleScore = calculateSimilarity(track.title, match.title);
          
          matches.push({
            ...match,
            match_type: 'fuzzy_title',
            match_score: titleScore
          });
        }
      });
    }

    // Sort by match score
    return matches
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 8); // Top 8 matches
  };

  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1.0;
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;
    
    // Simple Levenshtein-like scoring
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  };

  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  };

  const selectMatch = async (candidate: RecognitionCandidate, selectedMatch: CollectionMatch): Promise<void> => {
    console.log('Selected match:', selectedMatch);
    
    // Update album context
    if (selectedMatch.match_type !== 'album_context') {
      setAlbumContext({
        album_id: selectedMatch.id,
        artist: selectedMatch.artist,
        album_title: selectedMatch.title,
        last_recognized: candidate.recognition.title,
        track_sequence: [candidate.recognition.title]
      });
    } else if (albumContext) {
      setAlbumContext({
        ...albumContext,
        last_recognized: candidate.recognition.title,
        track_sequence: [...albumContext.track_sequence, candidate.recognition.title]
      });
    }

    // Update now playing
    await updateNowPlaying(candidate.recognition, selectedMatch);
    
    setLastRecognition(candidate.recognition);
    setPendingSelection(null);
    setStatus(`✅ Playing: ${selectedMatch.artist} - ${selectedMatch.title}`);
  };

  const updateNowPlaying = async (track: RecognitionResult, match: CollectionMatch): Promise<void> => {
    try {
      const nowPlayingData = {
        id: 1,
        artist: track.artist,
        title: track.title,
        album_id: match.id,
        started_at: new Date().toISOString(),
        recognition_confidence: track.confidence || 0.8,
        service_used: track.service || 'ACRCloud',
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('now_playing')
        .upsert(nowPlayingData);

      if (error) {
        console.error('Database update error:', error);
      } else {
        console.log('✅ Now playing updated successfully');
      }
    } catch (error) {
      console.error('Failed to update now playing:', error);
    }
  };

  const clearAlbumContext = (): void => {
    setAlbumContext(null);
    setStatus('Album context cleared');
  };

  return (
    <div style={{ padding: 24, background: "#fff", color: "#222", minHeight: "100vh" }}>
      <h1 style={{ marginBottom: 32 }}>Smart Audio Recognition</h1>
      
      {/* Recognition Mode Selection */}
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

      {/* Album Context Display */}
      {albumContext && (
        <div style={{ 
          background: "#f0fdf4", 
          padding: 20, 
          borderRadius: 8, 
          marginBottom: 24,
          border: "1px solid #16a34a"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, color: "#16a34a" }}>Album Context Active</h3>
            <button 
              onClick={clearAlbumContext}
              style={{
                background: "#ef4444",
                color: "white",
                border: "none",
                padding: "6px 12px",
                borderRadius: 4,
                fontSize: 12,
                cursor: "pointer"
              }}
            >
              Clear Context
            </button>
          </div>
          <div style={{ fontSize: 14 }}>
            <strong>Album:</strong> {albumContext.album_title} by {albumContext.artist}<br/>
            <strong>Track Sequence:</strong> {albumContext.track_sequence.join(' → ')}<br/>
            <strong>Last Recognized:</strong> {albumContext.last_recognized}
          </div>
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
              ? "🔴 Stop Recognition" 
              : `🎵 Start ${recognitionMode.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`
            }
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

      {/* Match Selection */}
      {pendingSelection && (
        <div style={{ 
          background: "#fffbeb", 
          padding: 24, 
          borderRadius: 8, 
          marginBottom: 24,
          border: "1px solid #f59e0b"
        }}>
          <h3 style={{ marginTop: 0, color: "#92400e" }}>
            Select Best Match for: &ldquo;{pendingSelection.recognition.artist} - {pendingSelection.recognition.title}&rdquo;
          </h3>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {pendingSelection.collection_matches.map((match) => (
              <div 
                key={match.id}
                onClick={() => selectMatch(pendingSelection, match)}
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
                  e.currentTarget.style.borderColor = "#2563eb";
                  e.currentTarget.style.background = "#eff6ff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e5e7eb";
                  e.currentTarget.style.background = "#fff";
                }}
              >
                {match.image_url && (
                  <Image 
                    src={match.image_url}
                    alt={match.title}
                    width={60}
                    height={60}
                    style={{ objectFit: "cover", borderRadius: 6 }}
                    unoptimized
                  />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{match.title}</div>
                  <div style={{ fontSize: 14, color: "#666", marginBottom: 4 }}>{match.artist} • {match.year}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>
                    {match.match_type} • {Math.round(match.match_score * 100)}% match
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last Recognition */}
      {lastRecognition && (
        <div style={{ 
          background: "#f0fdf4", 
          padding: 24, 
          borderRadius: 8, 
          border: "1px solid #16a34a"
        }}>
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>Last Recognition</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div><strong>Artist:</strong> {lastRecognition.artist}</div>
            <div><strong>Title:</strong> {lastRecognition.title}</div>
            <div><strong>Album:</strong> {lastRecognition.album || 'Unknown'}</div>
            <div><strong>Confidence:</strong> {Math.round((lastRecognition.confidence || 0.8) * 100)}%</div>
          </div>
        </div>
      )}
    </div>
  );
}