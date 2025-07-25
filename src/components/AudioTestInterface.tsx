// src/components/AudioTestInterface.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

// Proper TypeScript interfaces
interface BufferStatus {
  bufferSize: number;
  maxSize: number;
  isPlaying: boolean;
  lastUpdate: number;
}

interface RecognitionHistoryEntry {
  id: number;
  timestamp: string;
  result: Record<string, unknown>;
  audioLevel: number;
}

interface AudioResources {
  stream: MediaStream | null;
  context: AudioContext | null;
  analyser: AnalyserNode | null;
  source: MediaStreamAudioSourceNode | null;
}

export default function AudioTestInterface() {
  const [isActive, setIsActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [bufferStatus, setBufferStatus] = useState<BufferStatus>({
    bufferSize: 0,
    maxSize: 50,
    isPlaying: false,
    lastUpdate: 0
  });
  const [status, setStatus] = useState('');
  const [recognitionHistory, setRecognitionHistory] = useState<RecognitionHistoryEntry[]>([]);
  const [isManualRecognizing, setIsManualRecognizing] = useState(false);

  // Use refs to store audio resources
  const audioResourcesRef = useRef<AudioResources>({
    stream: null,
    context: null,
    analyser: null,
    source: null
  });
  const animationFrameRef = useRef<number | null>(null);

  const loadDevices = useCallback(async () => {
    try {
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = deviceList.filter(device => device.kind === 'audioinput');
      setDevices(audioInputs);
      
      if (audioInputs.length > 0 && !selectedDevice) {
        setSelectedDevice(audioInputs[0].deviceId);
      }
    } catch (error) {
      console.error('Error loading devices:', error);
      // Add mock devices for testing
      setDevices([
        { deviceId: 'default', kind: 'audioinput', label: 'Default Audio Input', groupId: '' } as MediaDeviceInfo,
        { deviceId: 'line-in', kind: 'audioinput', label: 'Line In (Audio Interface)', groupId: '' } as MediaDeviceInfo
      ]);
      if (!selectedDevice) {
        setSelectedDevice('default');
      }
    }
  }, [selectedDevice]);

  const stopCapture = useCallback(() => {
    setIsActive(false);
    setAudioLevel(0);
    setIsPlaying(false);
    setBufferStatus(prev => ({ ...prev, bufferSize: 0, isPlaying: false }));
    
    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Clean up audio resources
    const resources = audioResourcesRef.current;
    
    if (resources.stream) {
      resources.stream.getTracks().forEach(track => track.stop());
      resources.stream = null;
    }
    
    if (resources.source) {
      resources.source.disconnect();
      resources.source = null;
    }
    
    if (resources.context && resources.context.state !== 'closed') {
      resources.context.close();
      resources.context = null;
    }
    
    resources.analyser = null;
  }, []);

  const startCapture = useCallback(async (deviceId?: string) => {
    try {
      const constraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const audioContext = new (window.AudioContext || (window as typeof AudioContext).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);

      // Store resources in ref
      audioResourcesRef.current = {
        stream,
        context: audioContext,
        analyser,
        source
      };

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      setIsActive(true);

      // Analysis loop
      const analyze = () => {
        if (!isActive || !audioResourcesRef.current.analyser) return;

        audioResourcesRef.current.analyser.getByteFrequencyData(dataArray);
        
        // Calculate audio level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const level = sum / dataArray.length / 255;
        
        setAudioLevel(level);
        setIsPlaying(level > 0.01);
        setBufferStatus(prev => ({
          ...prev,
          bufferSize: Math.min(prev.bufferSize + 1, prev.maxSize),
          isPlaying: level > 0.01,
          lastUpdate: Date.now()
        }));

        animationFrameRef.current = requestAnimationFrame(analyze);
      };

      analyze();

    } catch (error) {
      console.error('Error starting audio capture:', error);
      throw error;
    }
  }, [isActive]);

  useEffect(() => {
    loadDevices();
    return () => {
      stopCapture();
    };
  }, [loadDevices, stopCapture]);

  const handleStartCapture = async () => {
    try {
      setStatus('Starting audio capture...');
      await startCapture(selectedDevice);
      setStatus('✅ Audio capture started successfully!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`❌ Failed to start capture: ${errorMessage}`);
    }
  };

  const handleStopCapture = () => {
    stopCapture();
    setStatus('⏹️ Audio capture stopped');
  };

  const triggerManualRecognition = async () => {
    if (!isActive || !isPlaying) {
      setStatus('⚠️ Start audio capture and play music first');
      return;
    }

    setIsManualRecognizing(true);
    setStatus('🎵 Attempting manual recognition...');

    try {
      const response = await fetch('/api/audio-recognition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          triggeredBy: 'manual_test',
          source: 'line_in_test',
          audioLevel: audioLevel,
          audioData: {
            level: audioLevel,
            sampleRate: 44100
          },
          timestamp: Date.now()
        }),
      });

      const result = await response.json();
      
      setRecognitionHistory(prev => [{
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        result: result,
        audioLevel: Math.round(audioLevel * 100)
      }, ...prev.slice(0, 9)]);

      if (result.success) {
        setStatus('✅ Recognition completed! Check results below.');
      } else {
        setStatus(`❌ Recognition failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`❌ Recognition error: ${errorMessage}`);
    } finally {
      setIsManualRecognizing(false);
    }
  };

  const audioLevelPercent = Math.round(audioLevel * 100);
  const audioLevelColor = isPlaying ? '#10b981' : '#6b7280';

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '2rem auto',
      padding: '2rem',
      background: '#fff',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '2rem',
        paddingBottom: '1rem',
        borderBottom: '2px solid #e5e7eb'
      }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          margin: '0 0 0.5rem 0',
          color: '#1f2937'
        }}>
          Audio Recognition Test Interface
        </h1>
        <p style={{
          color: '#6b7280',
          margin: 0,
          fontSize: '1rem'
        }}>
          Test your turntable line-in setup and audio recognition system
        </p>
      </div>

      {/* Device Selection */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: '600',
          margin: '0 0 1rem 0',
          color: '#374151'
        }}>
          Audio Input Device
        </h3>
        
        <div style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            disabled={isActive}
            style={{
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              minWidth: '200px',
              background: isActive ? '#f3f4f6' : '#fff'
            }}
          >
            <option value="">Select audio input device...</option>
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Device ${device.deviceId.slice(0, 8)}...`}
              </option>
            ))}
          </select>
          
          <button
            onClick={loadDevices}
            disabled={isActive}
            style={{
              padding: '0.5rem 1rem',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: isActive ? 'not-allowed' : 'pointer',
              opacity: isActive ? 0.5 : 1
            }}
          >
            🔄 Refresh Devices
          </button>
        </div>

        <div style={{
          marginTop: '1rem',
          fontSize: '14px',
          color: '#6b7280'
        }}>
          💡 <strong>Tip:</strong> Connect your turntable to a line-in port or USB audio interface, 
          then select it from the dropdown above.
        </div>
      </div>

      {/* Control Panel */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        {/* Audio Capture Controls */}
        <div style={{
          background: '#fff',
          border: '2px solid #e5e7eb',
          borderRadius: '8px',
          padding: '1.5rem'
        }}>
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: '600',
            margin: '0 0 1rem 0',
            color: '#374151'
          }}>
            Audio Capture
          </h3>
          
          <div style={{
            display: 'flex',
            gap: '0.75rem',
            marginBottom: '1rem'
          }}>
            <button
              onClick={handleStartCapture}
              disabled={isActive || !selectedDevice}
              style={{
                padding: '0.75rem 1.5rem',
                background: isActive ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: isActive || !selectedDevice ? 'not-allowed' : 'pointer',
                opacity: isActive || !selectedDevice ? 0.5 : 1
              }}
            >
              {isActive ? '🎤 Recording...' : '▶️ Start Capture'}
            </button>
            
            <button
              onClick={handleStopCapture}
              disabled={!isActive}
              style={{
                padding: '0.75rem 1.5rem',
                background: !isActive ? '#9ca3af' : '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: !isActive ? 'not-allowed' : 'pointer',
                opacity: !isActive ? 0.5 : 1
              }}
            >
              ⏹️ Stop Capture
            </button>
          </div>
          
          {/* Audio Level Meter */}
          <div style={{ marginTop: '1rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem'
            }}>
              <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                Audio Level: {audioLevelPercent}%
              </span>
              <span style={{
                fontSize: '12px',
                fontWeight: '600',
                color: isPlaying ? '#10b981' : '#6b7280',
                padding: '2px 8px',
                borderRadius: '12px',
                background: isPlaying ? '#dcfce7' : '#f3f4f6'
              }}>
                {isPlaying ? '🎵 MUSIC DETECTED' : '🔇 SILENCE'}
              </span>
            </div>
            
            <div style={{
              width: '100%',
              height: '8px',
              background: '#e5e7eb',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${audioLevelPercent}%`,
                height: '100%',
                background: audioLevelColor,
                transition: 'width 0.1s ease, background-color 0.3s ease'
              }} />
            </div>
          </div>
        </div>

        {/* Recognition Controls */}
        <div style={{
          background: '#fff',
          border: '2px solid #e5e7eb',
          borderRadius: '8px',
          padding: '1.5rem'
        }}>
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: '600',
            margin: '0 0 1rem 0',
            color: '#374151'
          }}>
            Recognition Test
          </h3>
          
          <button
            onClick={triggerManualRecognition}
            disabled={!isActive || !isPlaying || isManualRecognizing}
            style={{
              width: '100%',
              padding: '0.75rem 1.5rem',
              background: (!isActive || !isPlaying || isManualRecognizing) ? '#9ca3af' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: (!isActive || !isPlaying || isManualRecognizing) ? 'not-allowed' : 'pointer',
              opacity: (!isActive || !isPlaying || isManualRecognizing) ? 0.5 : 1
            }}
          >
            {isManualRecognizing ? '🔄 Recognizing...' : '🎵 Test Recognition'}
          </button>
          
          {/* Buffer Status */}
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            background: '#f8fafc',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#6b7280'
          }}>
            <div><strong>Buffer:</strong> {bufferStatus.bufferSize}/{bufferStatus.maxSize} frames</div>
            <div><strong>Status:</strong> {bufferStatus.isPlaying ? 'Recording audio' : 'Waiting for audio'}</div>
            {bufferStatus.lastUpdate > 0 && (
              <div><strong>Last update:</strong> {new Date(bufferStatus.lastUpdate).toLocaleTimeString()}</div>
            )}
          </div>
        </div>
      </div>

      {/* Status Display */}
      {status && (
        <div style={{
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          fontSize: '14px',
          fontWeight: '500',
          background: status.includes('❌') ? '#fef2f2' : 
                     status.includes('✅') ? '#f0fdf4' : 
                     status.includes('⚠️') ? '#fefbeb' : '#f0f9ff',
          color: status.includes('❌') ? '#dc2626' : 
                 status.includes('✅') ? '#16a34a' : 
                 status.includes('⚠️') ? '#d97706' : '#2563eb',
          border: `1px solid ${status.includes('❌') ? '#fca5a5' : 
                               status.includes('✅') ? '#bbf7d0' : 
                               status.includes('⚠️') ? '#fcd34d' : '#93c5fd'}`
        }}>
          {status}
        </div>
      )}

      {/* Recognition History */}
      {recognitionHistory.length > 0 && (
        <div style={{
          background: '#fff',
          border: '2px solid #e5e7eb',
          borderRadius: '8px',
          padding: '1.5rem'
        }}>
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: '600',
            margin: '0 0 1rem 0',
            color: '#374151'
          }}>
            Recognition History
          </h3>
          
          <div style={{
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            {recognitionHistory.map((entry, index) => (
              <div
                key={entry.id}
                style={{
                  padding: '1rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  marginBottom: '0.75rem',
                  background: index === 0 ? '#f0fdf4' : '#f8fafc'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem'
                }}>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151'
                  }}>
                    {entry.timestamp}
                  </span>
                  <span style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    background: '#f3f4f6',
                    padding: '2px 8px',
                    borderRadius: '12px'
                  }}>
                    Level: {entry.audioLevel}%
                  </span>
                </div>
                
                <pre style={{
                  fontSize: '12px',
                  background: '#f1f5f9',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  overflow: 'auto',
                  margin: 0,
                  color: '#1e293b'
                }}>
                  {JSON.stringify(entry.result, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Setup Instructions */}
      <div style={{
        marginTop: '2rem',
        padding: '1.5rem',
        background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)',
        border: '1px solid #bfdbfe',
        borderRadius: '8px'
      }}>
        <h3 style={{
          fontSize: '1.125rem',
          fontWeight: '600',
          margin: '0 0 1rem 0',
          color: '#1e40af'
        }}>
          🎧 Setup Instructions
        </h3>
        
        <ol style={{
          margin: 0,
          paddingLeft: '1.5rem',
          lineHeight: 1.6,
          color: '#1e40af'
        }}>
          <li>Connect your turntable to your computer&apos;s line-in port or a USB audio interface</li>
          <li>Select the correct audio input device from the dropdown above</li>
          <li>Click &quot;Start Capture&quot; to begin monitoring audio levels</li>
          <li>Play a record - you should see the audio level meter respond and &quot;MUSIC DETECTED&quot; appear</li>
          <li>Click &quot;Test Recognition&quot; to manually trigger recognition of the current audio</li>
          <li>Check the recognition history below to see results</li>
        </ol>
        
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          background: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '6px',
          fontSize: '14px'
        }}>
          <strong>💡 Pro Tip:</strong> The Sonos delay gives you 3-5 seconds between recognition and audio playback, 
          perfect for updating the TV display before guests hear the music!
        </div>
      </div>
    </div>
  );
}