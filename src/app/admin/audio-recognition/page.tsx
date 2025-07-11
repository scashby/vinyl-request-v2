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

interface ApiResponse {
  success: boolean;
  track?: RecognitionResult;
  error?: string;
}

interface ServiceStatus {
  enabledServices: string[];
  disabledServices: string[];
  needsManualConfig: boolean;
}

interface CollectionItem {
  id: string;
  artist: string;
  title: string;
  [key: string]: unknown;
}

interface SupabaseError {
  message: string;
  details?: string;
  hint?: string;
}

type RecognitionService = 'shazam' | 'audd' | 'gracenote' | 'spotify';

export default function AudioRecognitionPage() {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [recognitionService, setRecognitionService] = useState<RecognitionService>('shazam');
  const [lastRecognition, setLastRecognition] = useState<RecognitionResult | null>(null);
  const [status, setStatus] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [servicesStatus, setServicesStatus] = useState<ServiceStatus | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    // Check service configuration
    const checkServices = async () => {
      try {
        const response = await fetch('/api/audio-recognition');
        const data = await response.json();
        setServicesStatus({
          enabledServices: data.enabledServices || [],
          disabledServices: data.disabledServices || [],
          needsManualConfig: (data.enabledServices || []).length === 0
        });
        
        if (data.enabledServices && data.enabledServices.length > 0) {
          setStatus(`✅ Services configured: ${data.enabledServices.join(', ')}`);
        } else {
          setStatus('⚠️ No services configured in environment variables');
        }
      } catch (error) {
        console.error('Error checking services:', error);
        setServicesStatus({ enabledServices: [], disabledServices: [], needsManualConfig: true });
      }
    };

    checkServices();

    // Load saved settings for manual config fallback
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

    } catch (error: unknown) {
      console.error('Error accessing microphone:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setStatus(`Error: Could not access microphone - ${errorMessage}`);
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
      
      // Only send manual API key if no services are configured via environment
      if (servicesStatus?.needsManualConfig) {
        formData.append('service', recognitionService);
        formData.append('apiKey', apiKey);
      }

      const response = await fetch('/api/audio-recognition', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse = await response.json();
      
      if (result.success && result.track) {
        setLastRecognition(result.track);
        setStatus(`✅ Recognized: ${result.track.artist} - ${result.track.title} (via ${result.track.service})`);
        
        // Update now playing in database
        await updateNowPlaying(result.track);
      } else {
        setStatus(result.error || 'No match found');
      }
    } catch (error: unknown) {
      console.error('Recognition error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setStatus(`Error during recognition: ${errorMessage}`);
    }
  };

  const updateNowPlaying = async (track: RecognitionResult): Promise<void> => {
    try {
      // Find matching album in collection
      const { data: albums, error: queryError } = await supabase
        .from('collection')
        .select('*')
        .ilike('artist', `%${track.artist}%`)
        .ilike('title', `%${track.title}%`)
        .limit(1);

      if (queryError) {
        console.error('Query error:', queryError);
        setStatus('Error querying collection');
        return;
      }

      if (albums && albums.length > 0) {
        const album = albums[0] as CollectionItem;
        
        // Update or create now playing entry
        const { error: upsertError } = await supabase
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

        if (upsertError) {
          console.error('Upsert error:', upsertError);
          const error = upsertError as SupabaseError;
          setStatus(`Database error: ${error.message}`);
        } else {
          setStatus('✅ Updated now playing in database');
        }
      } else {
        setStatus('No matching album found in collection');
      }
    } catch (error: unknown) {
      console.error('Database update error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      setStatus(`Database update failed: ${errorMessage}`);
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
      
      {/* Service Configuration - Only show if manual config needed */}
      {servicesStatus?.needsManualConfig && (
        <div style={{ 
          background: "#f9f9f9", 
          padding: 24, 
          borderRadius: 8, 
          marginBottom: 24,
          border: "1px solid #ddd"
        }}>
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>Manual Service Configuration</h2>
          <div style={{
            background: "#fef3c7",
            border: "1px solid #f59e0b",
            color: "#92400e",
            padding: 12,
            borderRadius: 4,
            marginBottom: 16,
            fontSize: 14
          }}>
            <strong>⚠️ Notice:</strong> No services configured via environment variables. 
            Add ACRCLOUD_ACCESS_KEY or AUDD_API_TOKEN to your .env.local for automatic configuration.
          </div>
          
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
      )}

      {/* Service Status - Show for environment-configured services */}
      {servicesStatus && !servicesStatus.needsManualConfig && (
        <div style={{ 
          background: "#f0fdf4", 
          padding: 24, 
          borderRadius: 8, 
          marginBottom: 24,
          border: "1px solid #16a34a"
        }}>
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>Service Status</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <strong style={{ color: "#16a34a" }}>✅ Enabled Services:</strong>
              <div style={{ marginTop: 8 }}>
                {servicesStatus.enabledServices.map((service, index) => (
                  <div key={index} style={{ 
                    background: "#dcfce7", 
                    padding: "6px 12px", 
                    borderRadius: 6, 
                    marginBottom: 4,
                    color: "#166534",
                    fontSize: 14
                  }}>
                    {service}
                  </div>
                ))}
              </div>
            </div>
            {servicesStatus.disabledServices.length > 0 && (
              <div>
                <strong style={{ color: "#6b7280" }}>⚠️ Available Services:</strong>
                <div style={{ marginTop: 8 }}>
                  {servicesStatus.disabledServices.map((service, index) => (
                    <div key={index} style={{ 
                      background: "#f3f4f6", 
                      padding: "6px 12px", 
                      borderRadius: 6, 
                      marginBottom: 4,
                      color: "#6b7280",
                      fontSize: 14
                    }}>
                      {service} (not configured)
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
            disabled={servicesStatus?.needsManualConfig && !apiKey}
            style={{
              background: isListening ? "#dc2626" : "#16a34a",
              color: "white",
              border: "none",
              padding: "12px 24px",
              borderRadius: 8,
              cursor: (servicesStatus?.needsManualConfig && !apiKey) ? "not-allowed" : "pointer",
              fontSize: 16,
              fontWeight: 600,
              marginRight: 12,
              opacity: (servicesStatus?.needsManualConfig && !apiKey) ? 0.5 : 1
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

        {servicesStatus?.needsManualConfig && !apiKey && (
          <div style={{ 
            background: "#fef2f2", 
            border: "1px solid #fca5a5", 
            color: "#dc2626", 
            padding: 12, 
            borderRadius: 4,
            fontSize: 14
          }}>
            Please enter an API key above or configure services via environment variables
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
        {servicesStatus?.needsManualConfig ? (
          <ol style={{ color: "#92400e", lineHeight: 1.6 }}>
            <li><strong>Recommended:</strong> Add environment variables to .env.local:
              <ul style={{ marginTop: 8, marginLeft: 20 }}>
                <li>ACRCLOUD_ACCESS_KEY=your_key_here</li>
                <li>AUDD_API_TOKEN=your_token_here</li>
              </ul>
            </li>
            <li>Restart your development server</li>
            <li>Or use manual configuration above as a temporary solution</li>
            <li>Allow microphone access when prompted</li>
            <li>Click &quot;Start Recognition&quot; to begin listening</li>
          </ol>
        ) : (
          <ol style={{ color: "#92400e", lineHeight: 1.6 }}>
            <li>✅ Services are configured via environment variables</li>
            <li>Allow microphone access when prompted</li>
            <li>Click &quot;Start Recognition&quot; to begin listening</li>
            <li>Recognition results will automatically update the now-playing display</li>
          </ol>
        )}
      </div>
    </div>
  );
}