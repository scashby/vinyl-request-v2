// src/lib/audio/AudioCapture.ts
export interface AudioCaptureConfig {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  bufferSize: number;
}

export class AudioCapture {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private isPlaying = false;

  constructor(private config: AudioCaptureConfig) {}

  async getCaptureState(): Promise<{ isPlaying: boolean }> {
    return { isPlaying: this.isPlaying };
  }

  async startCapture(deviceId?: string): Promise<void> {
    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        sampleRate: this.config.sampleRate,
        channelCount: this.config.channels,
      }
    };

    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.audioContext = new AudioContext();
    
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    
    source.connect(this.analyser);
    this.isPlaying = true;
  }

  stopCapture(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.isPlaying = false;
  }

  getAudioData(): Float32Array | null {
    if (!this.analyser) return null;
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    this.analyser.getFloatFrequencyData(dataArray);
    
    return dataArray;
  }
}