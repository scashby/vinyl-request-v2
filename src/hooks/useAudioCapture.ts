// src/hooks/useAudioCapture.ts
import { useState, useCallback, useRef, useEffect } from 'react';

export interface AudioCaptureConfig {
  sampleRate?: number;
  channels?: number;
  bitDepth?: number;
  bufferSize?: number;
}

export interface UseAudioCaptureReturn {
  isCapturing: boolean;
  devices: MediaDeviceInfo[];
  selectedDevice: string | null;
  startCapture: (deviceId?: string) => Promise<void>;
  stopCapture: () => void;
  getAudioData: () => ArrayBuffer | null;
}

export function useAudioCapture(config: AudioCaptureConfig = {}): UseAudioCaptureReturn {
  const [isCapturing, setIsCapturing] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const loadDevices = useCallback(async () => {
    try {
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = deviceList.filter(device => device.kind === 'audioinput');
      setDevices(audioInputs);
    } catch (error) {
      console.error('Error loading audio devices:', error);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const startCapture = useCallback(async (deviceId?: string) => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          sampleRate: config.sampleRate || 44100,
          channelCount: config.channels || 2,
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setSelectedDevice(deviceId || null);

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.start(100); // Collect data every 100ms
      setIsCapturing(true);
    } catch (error) {
      console.error('Error starting audio capture:', error);
      throw error;
    }
  }, [config.sampleRate, config.channels]);

  const stopCapture = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsCapturing(false);
  }, []);

  const getAudioData = useCallback((): ArrayBuffer | null => {
    if (chunksRef.current.length === 0) return null;
    
    const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
    return blob.arrayBuffer() as unknown as ArrayBuffer;
  }, []);

  return {
    isCapturing,
    devices,
    selectedDevice,
    startCapture,
    stopCapture,
    getAudioData
  };
}