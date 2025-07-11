// src/app/admin/audio-recognition/page.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from 'lib/supabaseClient';

interface RecognitionResult {
  artist: string;
  title: string;
  album?: string;
  confidence?: number;
  service?: string;
}

type RecognitionService = 'shazam' | 'audd' | 'gracenote' | 'spotify';

export default function AudioRecognitionPage() {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [recognitionService, setRecognitionService] = useState<RecognitionService>('shazam');
  const [lastRecognition, setLastRecognition] = useState<RecognitionResult | null>(null);
  const [status, setStatus] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    // Load saved settings
    const savedService = localStorage.getItem('recognitionService') as RecognitionService;
    const savedApiKey = localStorage.getItem('audioApiKey');
    if (savedService) setRecognitionService(savedService);
    if (savedApiKey) setApiKey(savedApiKey);
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
      
      const mediaRecorder = new MediaRecorder(stream, {
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
        await recognizeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsListening(true);
      setStatus('Listening for audio...');

      // Record for 10 seconds, then analyze
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
          setIsListening(false);
        }
      }, 10000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      setStatus('Error: Could not access microphone');
    }
  };

  const stopListening = (): void => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
    setStatus('Stopped listening');
  };

  const recognizeAudio = async (audioBlob: Blob): Promise<void> => {
    setStatus('Analyzing audio...');
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);
      formData.append('service', recognitionService);
      formData.append('apiKey', apiKey);

      const response = await fetch('/api/audio-recognition', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (result.success && result.track) {
        setLastRecognition(result.track);
        setStatus(`Recognized: ${result.track.artist} - ${result.track.title}`);
        
        // Update now playing in database
        await updateNowPlaying(result.track);
      } else {
        setStatus('No match found');
      }
    } catch (error) {
      console.error('Recognition error:', error);
      setStatus('Error during recognition');
    }
  };

  const updateNowPlaying = async (track: RecognitionResult): Promise<void> => {
    try {
      // Find matching album in collection
      const { data: albums } = await supabase
        .from('collection')
        .select('*')
        .ilike('artist', `%${track.artist}%`)
        .ilike('title', `%${track.title}%`)
        .limit(1);

      if (albums && albums.length > 0) {
        const album = albums[0];
        
        // Update or create now playing entry
        const { error } = await supabase
          .from('now_playing')
          .upsert({
            id: 1, // Single row for current track
            artist: track.artist,
            title: track.title,
            album_id: album.id,
            started_at: new Date().toISOString(),
            recognition_confidence: track.confidence || 0.8,
            service_used: track.service || recognitionService,
            updated_at: new Date().toISOString()
          });

        if (!error) {
          setStatus('✅ Updated now playing in database');
        }
      }
    } catch (error) {
      console.error('Database update error:', error);
    }
  };

  const saveSettings = (): void => {
    localStorage.setItem('recognitionService', recognitionService);
    localStorage.setItem('audioApiKey', apiKey);
    setStatus('Settings saved');
  };

  const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    setRecognitionService(e.target.value as RecognitionService);
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setApiKey(e.target.value);
  };

  return (
    <div style={{ padding: 24, background: "#fff", color: "#222", minHeight: "100vh" }}>
      <h1 style={{ marginBottom: 32 }}>Audio Recognition Setup</h1>
      
      {/* Service Configuration */}
      <div style={{ 
        background: "#f9f9f9", 
        padding: 24, 
        borderRadius: 8, 
        marginBottom: 24,
        border: "1px solid #ddd"
      }}>
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>Recognition Service</h2>
        
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
            Service Provider
          </label>
          <select 
            value={recognitionService}
            onChange={handleServiceChange}
            style={{ 
              width: "100%", 
              padding: "8px 12px", 
              border: "1px solid #ddd", 
              borderRadius: 4,
              fontSize: 14
            }}
          >
            <option value="shazam">Shazam (ACRCloud)</option>
            <option value="audd">AudD.io</option>
            <option value="gracenote">Gracenote</option>
            <option value="spotify">Spotify Web API</option>
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
            API Key
          </label>
          <input 
            type="password"
            value={apiKey}
            onChange={handleApiKeyChange}
            placeholder="Enter your API key"
            style={{ 
              width: "100%", 
              padding: "8px 12px", 
              border: "1px solid #ddd", 
              borderRadius: 4,
              fontSize: 14
            }}
          />
        </div>

        <button 
          onClick={saveSettings}
          style={{
            background: "#2563eb",
            color: "white",
            border: "none",
            padding: "8px 16px",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 500
          }}
        >
          Save Settings
        </button>
      </div>

      {/* Audio Recognition */}
      <div style={{ 
        background: "#f0f9ff", 
        padding: 24, 
        borderRadius: 8, 
        marginBottom: 24,
        border: "1px solid #0369a1"
      }}>
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>Live Audio Recognition</h2>
        
        <div style={{ marginBottom: 16 }}>
          <button 
            onClick={isListening ? stopListening : startListening}
            disabled={!apiKey}
            style={{
              background: isListening ? "#dc2626" : "#16a34a",
              color: "white",
              border: "none",
              padding: "12px 24px",
              borderRadius: 8,
              cursor: apiKey ? "pointer" : "not-allowed",
              fontSize: 16,
              fontWeight: 600,
              marginRight: 12,
              opacity: apiKey ? 1 : 0.5
            }}
          >
            {isListening ? "🔴 Stop Listening" : "🎵 Start Recognition"}
          </button>
          
          {isListening && (
            <span style={{ 
              background: "#fef3c7", 
              color: "#92400e", 
              padding: "8px 12px", 
              borderRadius: 4,
              fontSize: 14
            }}>
              Recording 10 seconds of audio...
            </span>
          )}
        </div>

        {status && (
          <div style={{ 
            background: "#fff", 
            padding: 12, 
            borderRadius: 4, 
            marginBottom: 16,
            border: "1px solid #d1d5db",
            fontSize: 14
          }}>
            <strong>Status:</strong> {status}
          </div>
        )}

        {!apiKey && (
          <div style={{ 
            background: "#fef2f2", 
            border: "1px solid #fca5a5", 
            color: "#dc2626", 
            padding: 12, 
            borderRadius: 4,
            fontSize: 14
          }}>
            Please enter an API key to enable audio recognition
          </div>
        )}
      </div>

      {/* Last Recognition */}
      {lastRecognition && (
        <div style={{ 
          background: "#f0fdf4", 
          padding: 24, 
          borderRadius: 8, 
          border: "1px solid #16a34a"
        }}>
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>Last Recognition</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <strong>Artist:</strong> {lastRecognition.artist}
            </div>
            <div>
              <strong>Title:</strong> {lastRecognition.title}
            </div>
            <div>
              <strong>Album:</strong> {lastRecognition.album || 'Unknown'}
            </div>
            <div>
              <strong>Confidence:</strong> {Math.round((lastRecognition.confidence || 0.8) * 100)}%
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div style={{ 
        background: "#fffbeb", 
        padding: 24, 
        borderRadius: 8, 
        marginTop: 24,
        border: "1px solid #f59e0b"
      }}>
        <h3 style={{ marginTop: 0, color: "#92400e" }}>Setup Instructions</h3>
        <ol style={{ color: "#92400e", lineHeight: 1.6 }}>
          <li>Sign up for an audio recognition service (ACRCloud recommended)</li>
          <li>Get your API key and enter it above</li>
          <li>Allow microphone access when prompted</li>
          <li>Click &quot;Start Recognition&quot; to begin listening</li>
          <li>Recognition results will automatically update the now-playing display</li>
        </ol>
      </div>
    </div>
  );
}