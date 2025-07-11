// src/app/admin/audio-recognition/page.tsx - Clean Recognition System
"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from 'lib/supabaseClient';

interface RecognitionResult {
  artist: string;
  title: string;
  album?: string;
  image_url?: string;
  confidence?: number;
  service?: string;
}

interface CollectionMetadata {
  id: number;
  artist: string;
  title: string;
  year: string;
  image_url?: string;
  folder?: string;
}

export default function CleanRecognitionSystem() {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [recognitionMode, setRecognitionMode] = useState<'manual' | 'smart_continuous' | 'album_follow'>('smart_continuous');
  const [lastRecognition, setLastRecognition] = useState<RecognitionResult | null>(null);
  const [collectionMetadata, setCollectionMetadata] = useState<CollectionMetadata | null>(null);
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const songChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      
      setStatus('Album follow mode active - monitoring for song changes...');
      
      detectSongChange(analyser);
      
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
      setStatus(`Silence detected (${silenceCountRef.current}/20) - waiting for song change...`);
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
        
        await updateNowPlaying(result.track);
        setLastRecognition(result.track);
        
        await checkForCollectionMetadata(result.track);
        
        setStatus(`Now Playing: ${result.track.artist} - ${result.track.title} ${result.track.album ? `(${result.track.album})` : ''}`);
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

  const checkForCollectionMetadata = async (track: RecognitionResult): Promise<void> => {
    try {
      const { data: matches } = await supabase
        .from('collection')
        .select('*')
        .ilike('artist', track.artist.trim())
        .limit(1);

      if (matches && matches.length > 0) {
        const match = matches[0];
        setCollectionMetadata(match);
        
        await updateNowPlayingWithMetadata(track, match);
        
        console.log('Found collection metadata for format badge:', match.folder);
      } else {
        setCollectionMetadata(null);
        console.log('No collection metadata - guest vinyl (this is fine!)');
      }
    } catch (error) {
      console.error('Error checking collection metadata:', error);
      setCollectionMetadata(null);
    }
  };

  const updateNowPlaying = async (track: RecognitionResult): Promise<void> => {
    try {
      const trackInfo = extractTrackInfo(track.title);
      
      const nowPlayingData = {
        id: 1,
        artist: track.artist,
        title: track.title,
        album_title: track.album || null,
        recognition_image_url: track.image_url || null,
        album_id: null,
        track_number: trackInfo.number,
        track_side: trackInfo.side,
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
        setStatus('Failed to update TV display');
      } else {
        console.log('TV display updated with recognition data');
      }
    } catch (error) {
      console.error('Failed to update now playing:', error);
      setStatus('Failed to update TV display');
    }
  };

  const updateNowPlayingWithMetadata = async (track: RecognitionResult, metadata: CollectionMetadata): Promise<void> => {
    try {
      const trackInfo = extractTrackInfo(track.title);
      
      const nowPlayingData = {
        id: 1,
        artist: track.artist,
        title: track.title,
        album_title: track.album || null,
        recognition_image_url: track.image_url || null,
        album_id: metadata.id,
        track_number: trackInfo.number,
        track_side: trackInfo.side,
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
        console.log('TV display updated with recognition + format badge');
      }
    } catch (error) {
      console.error('Failed to update now playing:', error);
    }
  };

  const extractTrackInfo = (trackTitle: string): { number: string | null, side: string | null } => {
    const sideMatch = trackTitle.match(/\b(Side\s+)?([AB])\b/i);
    const trackMatch = trackTitle.match(/\b([AB]?)(\d+)\b/);
    
    return {
      number: trackMatch ? trackMatch[2] : null,
      side: sideMatch ? sideMatch[2].toUpperCase() : (trackMatch && trackMatch[1] ? trackMatch[1].toUpperCase() : null)
    };
  };

  const forceRecognitionUpdate = async (): Promise<void> => {
    if (!lastRecognition) return;
    
    setStatus('Forcing TV display update...');
    await updateNowPlaying(lastRecognition);
    setStatus('TV display force updated');
  };

  return (
    <div style={{ padding: 24, background: "#fff", color: "#222", minHeight: "100vh" }}>
      <h1 style={{ marginBottom: 32 }}>Pure Recognition System</h1>
      
      <div style={{ 
        background: "#e0f2fe", 
        padding: 20, 
        borderRadius: 8, 
        marginBottom: 24,
        border: "1px solid #0369a1"
      }}>
        <h3 style={{ margin: 0, marginBottom: 12, color: "#0c4a6e" }}>System Design</h3>
        <div style={{ fontSize: 14, lineHeight: 1.5 }}>
          <strong>Works for ANY album:</strong> Guest vinyls show recognition data + artwork<br/>
          <strong>Collection independent:</strong> Your collection only adds format badges<br/>
          <strong>No matching required:</strong> Recognition service provides all display data
        </div>
      </div>
      
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

      {collectionMetadata && (
        <div style={{ 
          background: "#f0fdf4", 
          padding: 20, 
          borderRadius: 8, 
          marginBottom: 24,
          border: "1px solid #16a34a"
        }}>
          <h3 style={{ margin: 0, marginBottom: 12, color: "#16a34a" }}>Bonus: Collection Metadata Found</h3>
          <div style={{ fontSize: 14 }}>
            <strong>Format Badge:</strong> {collectionMetadata.folder || 'Unknown'} • 
            <strong> Your Release Year:</strong> {collectionMetadata.year}
          </div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
            This adds a format badge to the display. Recognition data is still used for all text content.
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
          
          {lastRecognition.image_url ? (
            <div style={{ marginTop: 12, padding: 12, background: "#fff", borderRadius: 4, fontSize: 12 }}>
              <strong>Artwork URL:</strong><br/>
              <a href={lastRecognition.image_url} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", wordBreak: "break-all" }}>
                {lastRecognition.image_url}
              </a>
            </div>
          ) : (
            <div style={{ marginTop: 12, padding: 12, background: "#fef3c7", borderRadius: 4, fontSize: 12, color: "#92400e" }}>
              <strong>No artwork provided by recognition service</strong><br/>
              Check your /api/audio-recognition endpoint to ensure it extracts image_url from the ACRCloud response.
            </div>
          )}
          
          <div style={{ marginTop: 16, padding: 12, background: "#fff", borderRadius: 4, fontSize: 14 }}>
            <strong>Guest Vinyl Support:</strong> This system works for ANY album, even ones you do not own. 
            Recognition service provides all the data needed for display.
            {collectionMetadata && (
              <span> Bonus: Found {collectionMetadata.folder} badge for your collection.</span>
            )}
            {!collectionMetadata && (
              <span> Perfect for guest vinyls!</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}