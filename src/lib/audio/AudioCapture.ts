// src/lib/audio/AudioCapture.ts
export class AudioCapture {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;
  private isCapturing = false;
  private onAudioDataCallback?: (data: AudioData) => void;

  constructor() {
    // Initialize audio context when needed
  }

  async getAvailableDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'audioinput');
    } catch (error) {
      console.error('Error getting audio devices:', error);
      return [];
    }
  }

  async startCapture(deviceId?: string): Promise<void> {
    try {
      // Create audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Get user media with specific device if provided
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Create analyser
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;
      
      // Connect source to analyser
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.source.connect(this.analyser);
      
      // Set up data array
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      
      this.isCapturing = true;
      this.startAnalysisLoop();
      
      console.log('Audio capture started successfully');
    } catch (error) {
      console.error('Error starting audio capture:', error);
      throw error;
    }
  }

  stopCapture(): void {
    this.isCapturing = false;
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
    this.dataArray = null;
    
    console.log('Audio capture stopped');
  }

  onAudioData(callback: (data: AudioData) => void): void {
    this.onAudioDataCallback = callback;
  }

  private startAnalysisLoop(): void {
    if (!this.isCapturing || !this.analyser || !this.dataArray) return;

    const analyze = () => {
      if (!this.isCapturing || !this.analyser || !this.dataArray) return;

      // Get frequency data
      this.analyser.getByteFrequencyData(this.dataArray);
      
      // Calculate audio level and determine if audio is playing
      const audioLevel = this.calculateAudioLevel(this.dataArray);
      const isPlaying = this.isAudioPlaying(audioLevel);
      
      // Get time domain data for waveform
      const timeDomainData = new Uint8Array(this.analyser.fftSize);
      this.analyser.getByteTimeDomainData(timeDomainData);

      const audioData: AudioData = {
        frequencyData: new Uint8Array(this.dataArray),
        timeDomainData,
        audioLevel,
        isPlaying,
        timestamp: Date.now(),
        sampleRate: this.audioContext?.sampleRate || 44100
      };

      // Call callback if provided
      if (this.onAudioDataCallback) {
        this.onAudioDataCallback(audioData);
      }

      // Continue loop
      requestAnimationFrame(analyze);
    };

    analyze();
  }

  private calculateAudioLevel(frequencyData: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      sum += frequencyData[i];
    }
    return sum / frequencyData.length / 255; // Normalize to 0-1
  }

  private isAudioPlaying(audioLevel: number, threshold = 0.01): boolean {
    return audioLevel > threshold;
  }

  getAudioLevel(): number {
    if (!this.analyser || !this.dataArray) return 0;
    
    this.analyser.getByteFrequencyData(this.dataArray);
    return this.calculateAudioLevel(this.dataArray);
  }

  isCurrentlyPlaying(): boolean {
    const level = this.getAudioLevel();
    return this.isAudioPlaying(level);
  }
}

// Types
export interface AudioData {
  frequencyData: Uint8Array;
  timeDomainData: Uint8Array;
  audioLevel: number;
  isPlaying: boolean;
  timestamp: number;
  sampleRate: number;
}

// src/lib/audio/AudioProcessor.ts
export class AudioProcessor {
  private audioCapture: AudioCapture;
  private isProcessing = false;
  private lastRecognitionTime = 0;
  private recognitionInterval = 10000; // 10 seconds between recognition attempts
  private audioBuffer: AudioData[] = [];
  private maxBufferSize = 50; // Keep last 50 audio frames

  constructor() {
    this.audioCapture = new AudioCapture();
    this.setupAudioDataHandler();
  }

  async start(deviceId?: string): Promise<void> {
    await this.audioCapture.startCapture(deviceId);
    this.isProcessing = true;
    console.log('Audio processor started');
  }

  stop(): void {
    this.isProcessing = false;
    this.audioCapture.stopCapture();
    this.audioBuffer = [];
    console.log('Audio processor stopped');
  }

  async getAvailableDevices(): Promise<MediaDeviceInfo[]> {
    return this.audioCapture.getAvailableDevices();
  }

  private setupAudioDataHandler(): void {
    this.audioCapture.onAudioData((audioData: AudioData) => {
      if (!this.isProcessing) return;

      // Add to buffer
      this.audioBuffer.push(audioData);
      
      // Maintain buffer size
      if (this.audioBuffer.length > this.maxBufferSize) {
        this.audioBuffer.shift();
      }

      // Check if we should attempt recognition
      this.checkForRecognition(audioData);
    });
  }

  private checkForRecognition(audioData: AudioData): void {
    const now = Date.now();
    
    // Only attempt recognition if:
    // 1. Audio is playing
    // 2. Enough time has passed since last recognition
    // 3. We have enough audio data
    if (
      audioData.isPlaying &&
      now - this.lastRecognitionTime > this.recognitionInterval &&
      this.audioBuffer.length >= 10 // At least 10 frames of audio
    ) {
      this.attemptRecognition();
      this.lastRecognitionTime = now;
    }
  }

  private async attemptRecognition(): Promise<void> {
    try {
      console.log('Attempting audio recognition...');
      
      // Get recent audio data for recognition
      const recentAudio = this.audioBuffer.slice(-20); // Last 20 frames
      
      // Generate audio fingerprint
      const fingerprint = this.generateFingerprint(recentAudio);
      
      // Call recognition API
      const response = await fetch('/api/audio-recognition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fingerprint,
          audioData: {
            level: recentAudio[recentAudio.length - 1]?.audioLevel || 0,
            sampleRate: recentAudio[0]?.sampleRate || 44100,
            timestamp: Date.now()
          },
          triggeredBy: 'audio_processor',
          source: 'line_in'
        }),
      });

      const result = await response.json();
      console.log('Recognition result:', result);
      
    } catch (error) {
      console.error('Recognition attempt failed:', error);
    }
  }

  private generateFingerprint(audioFrames: AudioData[]): string {
    // Simple fingerprint generation
    // In a real implementation, you'd use more sophisticated algorithms
    
    if (audioFrames.length === 0) return '';
    
    // Combine frequency data from multiple frames
    const combinedData: number[] = [];
    
    audioFrames.forEach(frame => {
      // Take every 8th frequency bin to reduce data size
      for (let i = 0; i < frame.frequencyData.length; i += 8) {
        combinedData.push(frame.frequencyData[i]);
      }
    });
    
    // Convert to base64 string for easy transmission
    return btoa(String.fromCharCode(...combinedData.slice(0, 1000))); // Limit size
  }

  getCurrentAudioLevel(): number {
    return this.audioCapture.getAudioLevel();
  }

  isAudioPlaying(): boolean {
    return this.audioCapture.isCurrentlyPlaying();
  }

  getBufferStatus(): {
    bufferSize: number;
    maxSize: number;
    isPlaying: boolean;
    lastUpdate: number;
  } {
    const lastFrame = this.audioBuffer[this.audioBuffer.length - 1];
    return {
      bufferSize: this.audioBuffer.length,
      maxSize: this.maxBufferSize,
      isPlaying: lastFrame?.isPlaying || false,
      lastUpdate: lastFrame?.timestamp || 0
    };
  }
}

// src/hooks/useAudioCapture.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { AudioProcessor } from 'lib/audio/AudioProcessor';

export function useAudioCapture() {
  const [isActive, setIsActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [bufferStatus, setBufferStatus] = useState({
    bufferSize: 0,
    maxSize: 0,
    isPlaying: false,
    lastUpdate: 0
  });

  const processorRef = useRef<AudioProcessor | null>(null);

  useEffect(() => {
    processorRef.current = new AudioProcessor();
    
    // Load available devices
    loadDevices();
    
    return () => {
      if (processorRef.current) {
        processorRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      if (processorRef.current) {
        setAudioLevel(processorRef.current.getCurrentAudioLevel());
        setIsPlaying(processorRef.current.isAudioPlaying());
        setBufferStatus(processorRef.current.getBufferStatus());
      }
    }, 100); // Update 10 times per second

    return () => clearInterval(interval);
  }, [isActive]);

  const loadDevices = async () => {
    if (processorRef.current) {
      const deviceList = await processorRef.current.getAvailableDevices();
      setDevices(deviceList);
      
      // Auto-select the first device if none selected
      if (deviceList.length > 0 && !selectedDevice) {
        setSelectedDevice(deviceList[0].deviceId);
      }
    }
  };

  const startCapture = useCallback(async (deviceId?: string) => {
    if (!processorRef.current) return;

    try {
      await processorRef.current.start(deviceId || selectedDevice);
      setIsActive(true);
    } catch (error) {
      console.error('Failed to start audio capture:', error);
      throw error;
    }
  }, [selectedDevice]);

  const stopCapture = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.stop();
      setIsActive(false);
      setAudioLevel(0);
      setIsPlaying(false);
    }
  }, []);

  return {
    isActive,
    audioLevel,
    isPlaying,
    devices,
    selectedDevice,
    setSelectedDevice,
    bufferStatus,
    startCapture,
    stopCapture,
    loadDevices
  };
}