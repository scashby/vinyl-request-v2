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
  const [isContinuous, setIsContinuous] = useState<boolean>(false);
  const [recognitionService, setRecognitionService] = useState<RecognitionService>('shazam');
  const [lastRecognition, setLastRecognition] = useState<RecognitionResult | null>(null);
  const [status, setStatus] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [servicesStatus, setServicesStatus] = useState<ServiceStatus | null>(null);
  const [sampleDuration, setSampleDuration] = useState<number>(15); // Default 15 seconds
  const [continuousInterval, setContinuousInterval] = useState<number>(30); // Default 30 seconds between samples
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const continuousTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

    // Load saved settings
    const savedService = localStorage.getItem('recognitionService') as RecognitionService;
    const savedApiKey = localStorage.getItem('audioApiKey');
    const savedDuration = localStorage.getItem('sampleDuration');
    const savedInterval = localStorage.getItem('continuousInterval');
    
    if (savedService) setRecognitionService(savedService);
    if (savedApiKey) setApiKey(savedApiKey);
    if (savedDuration) setSampleDuration(parseInt(savedDuration));
    if (savedInterval) setContinuousInterval(parseInt(savedInterval));

    // Cleanup on unmount
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
      
      if (isContinuous) {
        startContinuousRecognition();
      } else {
        startSingleRecognition();
      }
      
      setIsListening(true);
      setStatus(isContinuous ? 'Starting continuous recognition...' : `Recording ${sampleDuration} seconds of audio...`);

    } catch (error: unknown) {
      console.error('Error accessing microphone:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setStatus(`Error: Could not access microphone - ${errorMessage}`);
    }
  };

  const startSingleRecognition = (): void => {
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
      await recognizeAudio(audioBlob);
      
      // Clean up stream after single recognition
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };

    mediaRecorder.start();

    // Stop recording after specified duration
    recordingTimeoutRef.current = setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        setIsListening(false);
      }
    }, sampleDuration * 1000);
  };

  const startContinuousRecognition = (): void => {
    const recordSample = () => {
      if (!streamRef.current || !isListening) return;

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
        await recognizeAudio(audioBlob);
        
        // Schedule next sample if still in continuous mode
        if (isListening && isContinuous) {
          continuousTimeoutRef.current = setTimeout(recordSample, continuousInterval * 1000);
        }
      };

      setStatus(`Recording sample ${sampleDuration}s...`);
      mediaRecorder.start();

      // Stop this sample after specified duration
      recordingTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, sampleDuration * 1000);
    };

    // Start first sample
    recordSample();
  };

  const stopListening = (): void => {
    setIsListening(false);
    
    // Clear timeouts
    if (continuousTimeoutRef.current) {
      clearTimeout(continuousTimeoutRef.current);
      continuousTimeoutRef.current = null;
    }
    
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }

    // Stop current recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    // Stop stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

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
        setStatus(isContinuous ? 'No match found, continuing...' : (result.error || 'No match found'));
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
          console.log(`Database error: ${error.message}`);
        } else {
          console.log('✅ Updated now playing in database');
        }
      }
    } catch (error: unknown) {
      console.error('Database update error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      console.log(`Database update failed: ${errorMessage}`);
    }
  };

  const saveSettings = (): void => {
    localStorage.setItem('recognitionService', recognitionService);
    localStorage.setItem('audioApiKey', apiKey);
    localStorage.setItem('sampleDuration', sampleDuration.toString());
    localStorage.setItem('continuousInterval', continuousInterval.toString());
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
      <h1 style={{ marginBottom: 32 }}>Enhanced Audio Recognition</h1>
      
      {/* Service Configuration */}
      {servicesStatus?.needsManualConfig && (
        <div style={{ 
          background: "#f9f9f9", 
          padding: 24, 
          borderRadius: 8, 
          marginBottom: 24,
          border: "1px solid #ddd"
        }}>
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>Manual Service Configuration</h2>
          
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

      {/* Recognition Settings */}
      <div style={{ 
        background: "#f0f9ff", 
        padding: 24, 
        borderRadius: 8, 
        marginBottom: 24,
        border: "1px solid #0369a1"
      }}>
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>Recognition Settings</h2>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Sample Duration (seconds)
            </label>
            <input 
              type="number"
              min="5"
              max="60"
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
              Continuous Interval (seconds)
            </label>
            <input 
              type="number"
              min="10"
              max="300"
              value={continuousInterval}
              onChange={(e) => setContinuousInterval(parseInt(e.target.value) || 30)}
              style={{ 
                width: "100%", 
                padding: "8px 12px", 
                border: "1px solid #ddd", 
                borderRadius: 4,
                fontSize: 14
              }}
            />
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 28 }}>
            <input
              type="checkbox"
              id="continuous"
              checked={isContinuous}
              onChange={(e) => setIsContinuous(e.target.checked)}
            />
            <label htmlFor="continuous" style={{ fontWeight: 600 }}>
              Continuous Recognition
            </label>
          </div>
        </div>
        
        <button 
          onClick={saveSettings}
          style={{
            background: "#059669",
            color: "white",
            border: "none",
            padding: "8px 16px",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 500
          }}
        >
          Save Recognition Settings
        </button>
      </div>

      {/* Audio Recognition Controls */}
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
            {isListening 
              ? (isContinuous ? "🔴 Stop Continuous Recognition" : "🔴 Stop Recording") 
              : (isContinuous ? "🎵 Start Continuous Recognition" : "🎵 Start Single Recognition")
            }
          </button>
          
          {isListening && (
            <span style={{ 
              background: "#fef3c7", 
              color: "#92400e", 
              padding: "8px 12px", 
              borderRadius: 4,
              fontSize: 14
            }}>
              {isContinuous 
                ? `Continuous recognition active (${sampleDuration}s samples every ${continuousInterval}s)`
                : `Recording ${sampleDuration} seconds of audio...`
              }
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
      </div>

      {/* Last Recognition */}
      {lastRecognition && (
        <div style={{ 
          background: "#f0fdf4", 
          padding: 24, 
          borderRadius: 8, 
          border: "1px solid #16a34a",
          marginBottom: 24
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
        border: "1px solid #f59e0b"
      }}>
        <h3 style={{ marginTop: 0, color: "#92400e" }}>Enhanced Features</h3>
        <ul style={{ color: "#92400e", lineHeight: 1.6 }}>
          <li><strong>Configurable Duration:</strong> Set sample length from 5-60 seconds for better recognition</li>
          <li><strong>Continuous Recognition:</strong> Automatically recognize tracks every X seconds</li>
          <li><strong>Multiple Services:</strong> Supports ACRCloud (Shazam-like) and AudD.io</li>
          <li><strong>Automatic Updates:</strong> Recognized tracks automatically update the now-playing display</li>
          <li><strong>Persistent Settings:</strong> Your preferences are saved between sessions</li>
        </ul>
      </div>
    </div>
  );
}